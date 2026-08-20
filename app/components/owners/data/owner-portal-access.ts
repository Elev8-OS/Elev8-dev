// Owner portal access log — audit trail for magic-link lifecycle (Flow 8).
//
// Every link generation, revocation, regeneration, use, and session expiry
// is recorded so staff can audit who accessed the portal and when. Revoking
// an owner's access invalidates their active session immediately.

export type PortalAccessStatus = 'active' | 'revoked' | 'regenerated'

export type PortalAccessAction
  = | 'link_generated'
    | 'link_revoked'
    | 'link_regenerated'
    | 'link_used'
    | 'otp_sent'
    | 'otp_verified'
    | 'session_expired'

export interface PortalAccessLogEntry {
  id: string
  ownerId: string
  action: PortalAccessAction
  /** Who performed the action — staff id, 'owner' (self), or 'system'. */
  actor: string
  at: string
  note?: string
}

export const portalAccessActionLabels: Record<PortalAccessAction, string> = {
  link_generated: 'Link generated',
  link_revoked: 'Access revoked',
  link_regenerated: 'Link regenerated',
  link_used: 'Link used',
  otp_sent: 'OTP sent',
  otp_verified: 'OTP verified',
  session_expired: 'Session expired',
}

// --- Seed fixtures ----------------------------------------------------------

export const mockPortalAccessLogs: PortalAccessLogEntry[] = [
  {
    id: 'oplog-1',
    ownerId: 'own-1',
    action: 'link_generated',
    actor: 'staff-1',
    at: '2026-01-10T08:05:00.000Z',
    note: 'Initial invite',
  },
  {
    id: 'oplog-2',
    ownerId: 'own-1',
    action: 'link_used',
    actor: 'owner',
    at: '2026-01-15T08:10:00.000Z',
  },
  {
    id: 'oplog-3',
    ownerId: 'own-2',
    action: 'link_generated',
    actor: 'staff-1',
    at: '2025-11-20T08:00:00.000Z',
    note: 'Initial invite',
  },
  {
    id: 'oplog-4',
    ownerId: 'own-2',
    action: 'link_used',
    actor: 'owner',
    at: '2025-12-01T09:00:00.000Z',
  },
  {
    id: 'oplog-5',
    ownerId: 'own-3',
    action: 'link_generated',
    actor: 'staff-1',
    at: '2026-07-01T08:00:00.000Z',
    note: 'Initial invite — waiting for first use',
  },
]
