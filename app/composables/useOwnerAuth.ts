// Owner portal authentication — mock magic-link flow.
//
// This composable backs the Owner Portal login screen. It is mock/demo only:
// no real network call is ever made, no email is ever sent, and the
// "magic link" is the `acceptDemoLink()` call the portal makes on the same
// device the email was requested from. The real flow would land here as
// `requestMagicLink` + a server-side `POST /owner-portal/auth/accept` that
// also issues an httpOnly session cookie.
//
// State lives in two `useState` buckets so it survives across composable
// instances, HMR reloads, and route changes within the same request.
//   - `elev8-owner-portal-session` — the active session (or null)
//   - `elev8-owner-pending-email` — the email that just requested a link,
//     awaiting a click. Cleared by either `acceptDemoLink` (on success) or
//     `logout`.
//
// ⚠️  Authentication contract — what we deliberately do NOT do:
//   - We do NOT reveal whether an email is seeded. `requestMagicLink`
//     returns the same `{ sent: true }` response no matter what. This
//     prevents an attacker from enumerating the owner list via the login
//     endpoint.
//   - We do NOT silently allow `acceptDemoLink` for inactive owners.
//     A deactivated account must be reactivated by staff before the owner
//     can re-enter the portal.
//   - We do NOT persist anything to LocalStorage. A real implementation
//     would use a server-issued httpOnly cookie; the demo resets on
//     reload on purpose so the seed fixtures always start from a known
//     blank state.

import type { AlertType } from '~/components/notifications/data/alerts'
import type { PortalAccessAction, PortalAccessLogEntry } from '~/components/owners/data/owner-portal-access'
import type { OwnerMagicLinkStatus } from '~/components/owners/data/owners'
import { computed } from 'vue'
import { mockPortalAccessLogs } from '~/components/owners/data/owner-portal-access'
import { mockOwners } from '~/components/owners/data/owners'
import { useNotifications } from '~/composables/useNotifications'

const SESSION_KEY = 'elev8-owner-portal-session'
const PENDING_EMAIL_KEY = 'elev8-owner-pending-email'
const ACCESS_LOG_KEY = 'elev8-owner-portal-access-log'

/** Lightweight session record. A real implementation would carry a token; the mock only needs the owner id. */
export interface OwnerSession {
  ownerId: string
  /** ISO timestamp captured at accept time. Surfaced for "last login" UI. */
  authenticatedAt: string
}

export interface MagicLinkSent {
  sent: true
}

export interface MagicLinkRejected {
  ok: false
}

export interface MagicLinkAccepted {
  ok: true
  ownerId: string
}

export type AcceptDemoLinkResult = MagicLinkAccepted | MagicLinkRejected

export type RevokeAccessResult
  = | { ok: true, sessionInvalidated: boolean }
    | { ok: false, error: string }

export type RegenerateAccessResult
  = | { ok: true, magicLink: string }
    | { ok: false, error: string }

/**
 * 500ms is short enough to feel responsive in a real click-flow, long
 * enough to exercise any loading-state UI hooks the caller wires up.
 */
const MAGIC_LINK_DELAY_MS = 500

export function useOwnerAuth() {
  const session = useState<OwnerSession | null>(SESSION_KEY, () => null)
  const pendingEmail = useState<string | null>(PENDING_EMAIL_KEY, () => null)
  const accessLog = useState<PortalAccessLogEntry[]>(ACCESS_LOG_KEY, () => structuredClone(mockPortalAccessLogs))
  // Shared owner directory — the same bucket `useOwners` writes to. Reading
  // from state (rather than the static seed) lets a revoke propagate to the
  // login check immediately. Seeded with the module reference (not a clone)
  // so in-place mutations of the shared seed — including the auth spec's
  // "refuses an inactive owner" fixture — stay observable.
  const ownerDirectory = useState<typeof mockOwners>('elev8-tenant-owners', () => mockOwners)
  const isAuthenticated = computed(() => Boolean(session.value?.ownerId))

  function nowIso(): string {
    return new Date().toISOString()
  }

  function appendLog(ownerId: string, action: PortalAccessAction, actor: string, note?: string): void {
    const entry: PortalAccessLogEntry = {
      id: `oplog-${globalThis.crypto.randomUUID()}`,
      ownerId,
      action,
      actor,
      at: nowIso(),
      note,
    }
    accessLog.value = [...accessLog.value, entry]
  }

  function ownerForEmail(email: string): typeof mockOwners[number] | undefined {
    return ownerDirectory.value.find(
      item => item.email.toLowerCase() === email && item.status !== 'inactive',
    )
  }

  /**
   * Record a pending magic-link request.
   *
   * The displayed response is always `{ sent: true }` — the caller cannot
   * tell from the return value whether the email is seeded. Trimming and
   * lower-casing happens synchronously so a follow-up `acceptDemoLink()`
   * call on the same device matches the stored seed exactly.
   */
  async function requestMagicLink(email: string): Promise<MagicLinkSent> {
    // Set BEFORE the await so the UI can show a "we sent you a link" state
    // and any subsequent `acceptDemoLink()` call finds the right pending
    // email even if it runs before the timer resolves.
    pendingEmail.value = email.trim().toLowerCase()
    await new Promise<void>(resolve => setTimeout(resolve, MAGIC_LINK_DELAY_MS))
    return { sent: true }
  }

  /**
   * Promote the pending email into a real session.
   *
   * Looks up the seeded owner by case-insensitive email match and refuses
   * to authenticate inactive accounts or owners whose magic link has been
   * revoked. Returns a discriminated union so the caller can branch on the
   * outcome without throwing.
   */
  function acceptDemoLink(): AcceptDemoLinkResult {
    const target = pendingEmail.value
    if (!target)
      return { ok: false }

    const owner = ownerForEmail(target)
    if (!owner)
      return { ok: false }

    // Flow 8 — a revoked link can never mint a session, even for an active owner.
    if (owner.magicLinkStatus === 'revoked')
      return { ok: false }

    session.value = {
      ownerId: owner.id,
      authenticatedAt: new Date().toISOString(),
    }
    appendLog(owner.id, 'link_used', 'owner')
    return { ok: true, ownerId: owner.id }
  }

  /**
   * Admin revokes an owner's portal access (Flow 8).
   *
   * Sets the owner's magic-link status to `revoked`, logs the action, and
   * immediately invalidates any active session for that owner — the owner is
   * logged out on the next navigation because the session is cleared.
   */
  function revokeAccess(ownerId: string, actor: string, note?: string): RevokeAccessResult {
    const owner = ownerDirectory.value.find(o => o.id === ownerId)
    if (!owner)
      return { ok: false, error: 'Owner not found.' }
    if (owner.status === 'inactive')
      return { ok: false, error: 'Owner is already inactive.' }

    const timestamp = nowIso()
    ownerDirectory.value = ownerDirectory.value.map(o => o.id === ownerId
      ? {
          ...o,
          magicLinkStatus: 'revoked' as OwnerMagicLinkStatus,
          accessRevokedAt: timestamp,
          updatedAt: timestamp,
        }
      : o)

    appendLog(ownerId, 'link_revoked', actor, note)

    // Invalidate an active session for this owner if one exists.
    let sessionInvalidated = false
    if (session.value?.ownerId === ownerId) {
      session.value = null
      pendingEmail.value = null
      sessionInvalidated = true
    }

    useNotifications().createAlert('OWNER_LINK_REVOKED' as AlertType, 'WARNING', {
      ownerId,
      ownerName: owner.name,
    })

    return { ok: true, sessionInvalidated }
  }

  /**
   * Admin regenerates an owner's magic link (Flow 8).
   *
   * Marks the owner's link as regenerated (future logins allowed), records
   * the action, and returns the mock link that would be re-sent.
   */
  function regenerateAccess(ownerId: string, actor: string, note?: string): RegenerateAccessResult {
    const owner = ownerDirectory.value.find(o => o.id === ownerId)
    if (!owner)
      return { ok: false, error: 'Owner not found.' }
    if (owner.status === 'inactive')
      return { ok: false, error: 'Owner is inactive — reactivate before regenerating the link.' }

    const timestamp = nowIso()
    ownerDirectory.value = ownerDirectory.value.map(o => o.id === ownerId
      ? {
          ...o,
          magicLinkStatus: 'regenerated' as OwnerMagicLinkStatus,
          magicLinkLastGeneratedAt: timestamp,
          accessRevokedAt: undefined,
          updatedAt: timestamp,
        }
      : o)

    appendLog(ownerId, 'link_regenerated', actor, note)

    // Mock link — a real implementation would mint a JWT and email/WhatsApp it.
    return { ok: true, magicLink: `https://portal.elev8.io/owner/${owner.id}/${globalThis.crypto.randomUUID().slice(0, 8)}` }
  }

  /** Staff manually records that a link was generated (e.g. initial invite). */
  function markLinkGenerated(ownerId: string, actor: string, note?: string): void {
    appendLog(ownerId, 'link_generated', actor, note)
  }

  /** Audit trail for one owner — sorted newest first. */
  function getAccessLog(ownerId: string): PortalAccessLogEntry[] {
    return accessLog.value
      .filter(entry => entry.ownerId === ownerId)
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at))
  }

  /**
   * Clear both the active session and the pending email. Safe to call
   * when already logged out (idempotent — both refs are already null in
   * that case).
   */
  function logout(): void {
    session.value = null
    pendingEmail.value = null
  }

  return {
    session,
    pendingEmail,
    accessLog,
    isAuthenticated,
    requestMagicLink,
    acceptDemoLink,
    logout,
    revokeAccess,
    regenerateAccess,
    markLinkGenerated,
    getAccessLog,
  }
}
