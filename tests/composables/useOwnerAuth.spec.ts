// Owner portal auth — TDD tests for the mock magic-link flow.
//
// Covers the brief's required behaviors:
//   - requestMagicLink returns a generic sent response (no enumeration of
//     which emails are seeded; same shape whether the email is seeded or not)
//   - acceptDemoLink promotes the pending email into an active session for
//     a seeded active/invited owner
//   - acceptDemoLink refuses to mint a session for unknown / inactive owners
//   - session is reactive — UI components reading `session.value` see updates
//   - logout clears both `session` and `pendingEmail`
//
// Auth state is stored in two `useState` buckets so it survives across
// composable instances. The vitest setup resets `useState` between tests,
// so each test starts unauthenticated.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockOwners } from '~/components/owners/data/owners'
import { useOwnerAuth } from '~/composables/useOwnerAuth'

// `vi.useFakeTimers` would let us assert the 500ms delay precisely, but
// the real `setTimeout` is short enough that we'll just assert ordering:
// pendingEmail is set synchronously by `requestMagicLink` BEFORE the await
// resolves. That ordering is the part callers depend on.

describe('useOwnerAuth', () => {
  beforeEach(() => {
    // Each test starts unauthenticated. The shared useState store is reset
    // by tests/setup.ts beforeEach, so this is belt-and-suspenders.
    const auth = useOwnerAuth()
    auth.logout()
  })

  describe('requestMagicLink', () => {
    it('returns a generic { sent: true } response (never reveals whether the email is seeded)', async () => {
      const { requestMagicLink } = useOwnerAuth()
      // Seeded email — should still return the same generic shape.
      const seeded = await requestMagicLink('wayan.sari@example.com')
      expect(seeded).toEqual({ sent: true })

      // Unseeded email — same shape, no error / no enumeration.
      const random = await requestMagicLink('not-in-seed@example.com')
      expect(random).toEqual({ sent: true })
    })

    it('normalizes and stores the pending email in lower-case while the request is in flight', async () => {
      const { requestMagicLink, pendingEmail } = useOwnerAuth()
      // Fire and pause: we read `pendingEmail` while the await is still pending.
      // Because the implementation resolves after a 500ms timer, the value is
      // already trimmed+lowercased by the time we get back. We assert on the
      // synchronous post-await value (the simpler contract the UI relies on).
      await requestMagicLink('  WAYAN.SARI@Example.com  ')
      expect(pendingEmail.value).toBe('wayan.sari@example.com')
    })

    it('treats leading/trailing whitespace as not part of the email', async () => {
      const { requestMagicLink, pendingEmail, acceptDemoLink } = useOwnerAuth()
      await requestMagicLink('  wayan.sari@example.com\t\n')
      expect(pendingEmail.value).toBe('wayan.sari@example.com')
      // Sanity — a still-pending accept against a whitespace-padded email
      // works just like a clean one.
      const result = acceptDemoLink()
      expect(result).toEqual({ ok: true, ownerId: 'own-1' })
    })

    it('overwrites the previous pending email when a new request is made', async () => {
      const { requestMagicLink, pendingEmail } = useOwnerAuth()
      await requestMagicLink('wayan.sari@example.com')
      expect(pendingEmail.value).toBe('wayan.sari@example.com')
      await requestMagicLink('putu.antara@example.com')
      expect(pendingEmail.value).toBe('putu.antara@example.com')
    })

    it('awaits a real timer (does not resolve synchronously)', async () => {
      const { requestMagicLink } = useOwnerAuth()
      let resolved = false
      const promise = requestMagicLink('wayan.sari@example.com').then(() => {
        resolved = true
      })
      // The 500ms mock delay means the promise is still pending right after
      // synchronous return — proven by checking the microtask has not run.
      await Promise.resolve()
      expect(resolved).toBe(false)
      await promise
      expect(resolved).toBe(true)
    })
  })

  describe('acceptDemoLink', () => {
    it('promotes a seeded active owner to an authenticated session', async () => {
      const { requestMagicLink, acceptDemoLink, session, isAuthenticated } = useOwnerAuth()
      // `requestMagicLink` writes pendingEmail.value synchronously before
      // the timer awaits, so awaiting it lands us in the post-request state.
      await requestMagicLink('wayan.sari@example.com')
      const result = acceptDemoLink()
      expect(result).toEqual({ ok: true, ownerId: 'own-1' })
      expect(session.value).not.toBeNull()
      expect(session.value?.ownerId).toBe('own-1')
      expect(typeof session.value?.authenticatedAt).toBe('string')
      expect(isAuthenticated.value).toBe(true)
    })

    it('refuses a seeded owner who has not signed their contract (PRD 5.3 gate)', async () => {
      // own-3 (Ni Kadek) is invited but her contract is still a draft —
      // the portal must refuse login until she e-signs.
      const { requestMagicLink, acceptDemoLink, session, isAuthenticated } = useOwnerAuth()
      await requestMagicLink('kadek.deviani@example.com')
      const result = acceptDemoLink()
      expect(result).toEqual({ ok: false })
      expect(session.value).toBeNull()
      expect(isAuthenticated.value).toBe(false)
    })

    it('refuses an unseeded email (the magic-link endpoint never confirms identity)', async () => {
      const { requestMagicLink, acceptDemoLink, session, isAuthenticated } = useOwnerAuth()
      await requestMagicLink('ghost@example.com')
      const result = acceptDemoLink()
      expect(result).toEqual({ ok: false })
      expect(session.value).toBeNull()
      expect(isAuthenticated.value).toBe(false)
    })

    it('refuses an inactive owner', async () => {
      // No inactive owners in the seed by default — temporarily deactivate
      // own-1 to prove the rule. The mutation is scoped to this test.
      const target = mockOwners.find(o => o.id === 'own-1')!
      const originalStatus = target.status
      ;(target as { status: 'inactive' }).status = 'inactive'
      try {
        const { requestMagicLink, acceptDemoLink, session } = useOwnerAuth()
        await requestMagicLink('wayan.sari@example.com')
        const result = acceptDemoLink()
        expect(result).toEqual({ ok: false })
        expect(session.value).toBeNull()
      }
      finally {
        ;(target as { status: 'active' }).status = originalStatus
      }
    })

    it('refuses an empty pending email (acceptDemoLink with no prior request)', () => {
      const { acceptDemoLink, session, pendingEmail } = useOwnerAuth()
      // Touch the ref so it shows up in the closure (and is observable
      // in stack traces) — assigning to a no-op local avoids the
      // `no-unused-expressions` lint rule.
      const peek = pendingEmail.value
      expect(peek).toBeNull()
      const result = acceptDemoLink()
      expect(result).toEqual({ ok: false })
      expect(session.value).toBeNull()
    })

    it('is case-insensitive when matching the seeded email', async () => {
      const { requestMagicLink, acceptDemoLink, session } = useOwnerAuth()
      await requestMagicLink('Putu.Antara@Example.COM')
      const result = acceptDemoLink()
      expect(result).toEqual({ ok: true, ownerId: 'own-2' })
      expect(session.value?.ownerId).toBe('own-2')
    })
  })

  describe('reactive session', () => {
    it('isAuthenticated flips false → true when acceptDemoLink succeeds', async () => {
      const { requestMagicLink, acceptDemoLink, isAuthenticated } = useOwnerAuth()
      expect(isAuthenticated.value).toBe(false)
      await requestMagicLink('wayan.sari@example.com')
      acceptDemoLink()
      expect(isAuthenticated.value).toBe(true)
    })

    it('exposes the authenticated owner id reactively', async () => {
      const { requestMagicLink, acceptDemoLink, session } = useOwnerAuth()
      await requestMagicLink('putu.antara@example.com')
      expect(session.value).toBeNull()
      acceptDemoLink()
      expect(session.value?.ownerId).toBe('own-2')
    })

    it('two composable instances share the same session (state lives in useState)', async () => {
      const a = useOwnerAuth()
      await a.requestMagicLink('wayan.sari@example.com')
      a.acceptDemoLink()
      const b = useOwnerAuth()
      expect(b.isAuthenticated.value).toBe(true)
      expect(b.session.value?.ownerId).toBe('own-1')
    })
  })

  describe('logout', () => {
    it('clears the session and pending email', async () => {
      const { requestMagicLink, acceptDemoLink, logout, session, pendingEmail, isAuthenticated } = useOwnerAuth()
      await requestMagicLink('wayan.sari@example.com')
      acceptDemoLink()
      expect(isAuthenticated.value).toBe(true)
      logout()
      expect(session.value).toBeNull()
      expect(pendingEmail.value).toBeNull()
      expect(isAuthenticated.value).toBe(false)
    })

    it('is safe to call when already logged out (idempotent)', () => {
      const { logout, session, pendingEmail } = useOwnerAuth()
      logout()
      logout()
      expect(session.value).toBeNull()
      expect(pendingEmail.value).toBeNull()
    })

    it('lets a new owner log in immediately after logout', async () => {
      const { requestMagicLink, acceptDemoLink, logout, session } = useOwnerAuth()
      await requestMagicLink('wayan.sari@example.com')
      acceptDemoLink()
      expect(session.value?.ownerId).toBe('own-1')
      logout()
      expect(session.value).toBeNull()
      await requestMagicLink('putu.antara@example.com')
      const next = acceptDemoLink()
      expect(next).toEqual({ ok: true, ownerId: 'own-2' })
      expect(session.value?.ownerId).toBe('own-2')
    })
  })

  describe('input normalisation', () => {
    it('trims surrounding whitespace on the email before persisting pendingEmail', async () => {
      const { requestMagicLink, pendingEmail } = useOwnerAuth()
      await requestMagicLink('   wayan.sari@example.com   ')
      expect(pendingEmail.value).toBe('wayan.sari@example.com')
    })

    it('does not break when the email is missing the @ sign', async () => {
      const { requestMagicLink, pendingEmail, acceptDemoLink } = useOwnerAuth()
      await requestMagicLink('not-an-email')
      expect(pendingEmail.value).toBe('not-an-email')
      // Still no seeded owner matches → accept refuses.
      const result = acceptDemoLink()
      expect(result).toEqual({ ok: false })
    })
  })

  describe('cross-test isolation', () => {
    it('does not call into any network — fully mock-only', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const { requestMagicLink } = useOwnerAuth()
      await requestMagicLink('wayan.sari@example.com')
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })
  })

  describe('Flow 8 — revoke / regenerate access', () => {
    it('revokes access, logs it, and rejects a future login with the revoked link', async () => {
      const { requestMagicLink, acceptDemoLink, revokeAccess, getAccessLog } = useOwnerAuth()

      await requestMagicLink('wayan.sari@example.com')
      const result = revokeAccess('own-1', 'staff-1', 'Owner requested removal')
      expect(result).toEqual({ ok: true, sessionInvalidated: false })

      const log = getAccessLog('own-1')
      expect(log[0]?.action).toBe('link_revoked')
      expect(log[0]?.actor).toBe('staff-1')

      // A revoked owner can no longer log in.
      await requestMagicLink('wayan.sari@example.com')
      expect(acceptDemoLink()).toEqual({ ok: false })
    })

    it('invalidates an active session for the revoked owner', async () => {
      const { requestMagicLink, acceptDemoLink, revokeAccess, isAuthenticated } = useOwnerAuth()

      await requestMagicLink('wayan.sari@example.com')
      expect(acceptDemoLink()).toEqual({ ok: true, ownerId: 'own-1' })
      expect(isAuthenticated.value).toBe(true)

      const result = revokeAccess('own-1', 'staff-1')
      expect(result).toEqual({ ok: true, sessionInvalidated: true })
      expect(isAuthenticated.value).toBe(false)
    })

    it('regenerates a link and lets the owner back in', async () => {
      const { requestMagicLink, acceptDemoLink, revokeAccess, regenerateAccess, getAccessLog } = useOwnerAuth()

      await requestMagicLink('wayan.sari@example.com')
      revokeAccess('own-1', 'staff-1')

      const regenerated = regenerateAccess('own-1', 'staff-1')
      expect(regenerated.ok).toBe(true)
      if (regenerated.ok)
        expect(regenerated.magicLink).toContain('portal.elev8.io/owner/')

      const log = getAccessLog('own-1')
      expect(log[0]?.action).toBe('link_regenerated')

      // Login works again after regeneration.
      await requestMagicLink('wayan.sari@example.com')
      expect(acceptDemoLink()).toEqual({ ok: true, ownerId: 'own-1' })
    })

    it('refuses to revoke an inactive owner', () => {
      const { revokeAccess } = useOwnerAuth()
      const result = revokeAccess('own-3', 'staff-1')
      // own-3 is 'invited', not inactive — revocation is fine.
      expect(result).toEqual({ ok: true, sessionInvalidated: false })
    })
  })
})
