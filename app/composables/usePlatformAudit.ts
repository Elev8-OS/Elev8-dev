import { computed } from 'vue'
import { useStaffAuth } from '~/composables/useStaffAuth'

export type AuditAction =
  | 'view_billing' | 'view_pricing' | 'view_users' | 'view_activity'
  | 'next_charge_adjusted' | 'next_charge_reverted'
  | 'override_proposed' | 'override_approved' | 'override_rejected' | 'override_revoked' | 'override_expired'
  | 'banner_created' | 'banner_scheduled' | 'banner_live' | 'banner_retracted' | 'banner_retracted_before_live' | 'banner_expired'
  | 'banner_updated' | 'banner_resolved'
  | 'banner_target_excluded' | 'banner_email_sent'
  | 'role_changed' | 'login' | 'logout'

export interface PlatformAuditEntry {
  id: string
  actorStaffId: string
  actorRole: string
  action: AuditAction
  targetType: 'tenant' | 'banner' | 'override' | 'system'
  targetId: string
  metadata?: Record<string, unknown>
  createdAt: string
}

function seedAuditLog(): PlatformAuditEntry[] {
  const now = Date.now()
  return [
    { id: 'audit-seed-1', actorStaffId: 'staff-1', actorRole: 'admin', action: 'login', targetType: 'system', targetId: '-', createdAt: new Date(now - 3600_000).toISOString() },
    { id: 'audit-seed-2', actorStaffId: 'staff-2', actorRole: 'approver', action: 'override_approved', targetType: 'override', targetId: 'ovr-seed-1', metadata: { tenantId: 't-1' }, createdAt: new Date(now - 7200_000).toISOString() },
    { id: 'audit-seed-3', actorStaffId: 'staff-3', actorRole: 'finance', action: 'view_billing', targetType: 'tenant', targetId: 't-2', createdAt: new Date(now - 10_800_000).toISOString() },
    { id: 'audit-seed-4', actorStaffId: 'staff-1', actorRole: 'admin', action: 'banner_live', targetType: 'banner', targetId: 'banner-1', metadata: { severity: 'critical', recipientCount: 9 }, createdAt: new Date(now - 14_400_000).toISOString() },
    { id: 'audit-seed-5', actorStaffId: 'staff-1', actorRole: 'admin', action: 'banner_email_sent', targetType: 'banner', targetId: 'banner-1', metadata: { tenantId: 't-1', recipientCount: 5 }, createdAt: new Date(now - 14_400_000).toISOString() },
  ]
}

export function usePlatformAudit() {
  const auditLog = useState<PlatformAuditEntry[]>('platform-audit-log', () => seedAuditLog())

  function log(
    action: AuditAction,
    targetType: PlatformAuditEntry['targetType'],
    targetId: string,
    metadata?: Record<string, unknown>,
  ): PlatformAuditEntry {
    const { currentRole } = useStaffAuth()
    const entry: PlatformAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actorStaffId: 'staff-1',
      actorRole: currentRole.value,
      action,
      targetType,
      targetId,
      metadata,
      createdAt: new Date().toISOString(),
    }
    auditLog.value = [...auditLog.value, entry]
    return entry
  }

  function byTenant(tenantId: string): PlatformAuditEntry[] {
    return auditLog.value.filter(
      e => (e.targetType === 'tenant' && e.targetId === tenantId)
        || e.metadata?.tenantId === tenantId,
    )
  }

  function byActor(staffId: string): PlatformAuditEntry[] {
    return auditLog.value.filter(e => e.actorStaffId === staffId)
  }

  return { auditLog, log, byTenant, byActor }
}