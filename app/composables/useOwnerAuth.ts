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

import { computed } from 'vue'
import { mockOwners } from '~/components/owners/data/owners'

const SESSION_KEY = 'elev8-owner-portal-session'
const PENDING_EMAIL_KEY = 'elev8-owner-pending-email'

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

/**
 * 500ms is short enough to feel responsive in a real click-flow, long
 * enough to exercise any loading-state UI hooks the caller wires up.
 */
const MAGIC_LINK_DELAY_MS = 500

export function useOwnerAuth() {
  const session = useState<OwnerSession | null>(SESSION_KEY, () => null)
  const pendingEmail = useState<string | null>(PENDING_EMAIL_KEY, () => null)
  const isAuthenticated = computed(() => Boolean(session.value?.ownerId))

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
   * to authenticate inactive accounts. Returns a discriminated union so
   * the caller can branch on the outcome without throwing.
   */
  function acceptDemoLink(): AcceptDemoLinkResult {
    const target = pendingEmail.value
    if (!target)
      return { ok: false }

    const owner = mockOwners.find(
      item => item.email.toLowerCase() === target && item.status !== 'inactive',
    )
    if (!owner)
      return { ok: false }

    session.value = {
      ownerId: owner.id,
      authenticatedAt: new Date().toISOString(),
    }
    return { ok: true, ownerId: owner.id }
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
    isAuthenticated,
    requestMagicLink,
    acceptDemoLink,
    logout,
  }
}
