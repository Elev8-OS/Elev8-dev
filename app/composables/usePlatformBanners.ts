import { computed } from 'vue'
import type {
  PlatformBanner, BannerSeverity, BannerStatus, BannerTargetFilter, BannerDismissal, DismissalScope,
  BannerKind, MaintenanceWindow, BannerUpdate, AnnouncementState,
} from '~/components/platform-console/data/banners'
import {
  mockBanners, shouldEmail, canResolve, lastActivityAt, RESOLVED_GRACE_MS, MAINTENANCE_WRAP_UP_MS,
} from '~/components/platform-console/data/banners'
import type { StaffRoleName } from '~/components/platform-console/data/staff'
import { useTenants } from '~/composables/useTenants'
import { usePlatformAudit } from '~/composables/usePlatformAudit'

export interface CreateBannerInput {
  title: string
  body: string
  severity: BannerSeverity
  ctaLabel?: string
  ctaUrl?: string
  targetScope: 'all' | 'segment' | 'individual'
  targetFilter: BannerTargetFilter
  visibleRoles: StaffRoleName[]
  dismissible: boolean
  dismissalScope: DismissalScope
  startAt: string
  endAt?: string
  createdByStaffId: string
  kind?: BannerKind
  maintenance?: MaintenanceWindow
  sendEmail?: boolean
}

export interface TenantAnnouncement {
  banner: PlatformBanner
  state: AnnouncementState
  dismissed: boolean
}

const SEVERITY_RANK: Record<BannerSeverity, number> = { critical: 1, warning: 2, info: 3 }

function genId() {
  return `banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const DAY_MS = 86_400_000

export function usePlatformBanners() {
  const banners = useState<PlatformBanner[]>('platform-banners', () => JSON.parse(JSON.stringify(mockBanners)))
  const dismissals = useState<BannerDismissal[]>('banner-dismissals', () => [])
  const { tenants } = useTenants()
  const { log } = usePlatformAudit()

  function resolveRecipients(banner: PlatformBanner): string[] {
    const eligible = tenants.value.filter(t => !t.isInternal)
    if (banner.targetFilter.scope === 'all') {
      return eligible.map(t => t.id)
    }
    if (banner.targetFilter.scope === 'segment') {
      const f = banner.targetFilter
      return eligible.filter(t => {
        if (f.planTypes && !f.planTypes.includes(t.plan)) return false
        if (f.tiers && !f.tiers.includes(t.packageTier)) return false
        if (f.regions && !f.regions.includes(t.region)) return false
        if (f.hasChannelManager !== undefined && t.hasChannelManager !== f.hasChannelManager) return false
        return true
      }).map(t => t.id)
    }
    const allowed = new Set(eligible.map(t => t.id))
    return banner.targetFilter.tenantIds.filter(id => allowed.has(id))
  }

  /**
   * A dismissal hides the banner until staff post something new on it: an update
   * or the all clear is newer than the dismissal, so it comes back once.
   */
  function isDismissed(bannerId: string, tenantId: string): boolean {
    const banner = banners.value.find(b => b.id === bannerId)
    const since = banner ? lastActivityAt(banner) : ''
    return dismissals.value.some(d => d.bannerId === bannerId && d.tenantId === tenantId && d.dismissedAt >= since)
  }

  function reachesViewer(b: PlatformBanner, tenantId: string, userRole: StaffRoleName): boolean {
    return resolveRecipients(b).includes(tenantId) && b.visibleRoles.includes(userRole)
  }

  function isLiveAt(b: PlatformBanner, now: number): boolean {
    if (b.status !== 'live') return false
    if (new Date(b.startAt).getTime() > now) return false
    if (b.endAt && new Date(b.endAt).getTime() < now) return false
    return true
  }

  /** Banners a tenant user currently sees on the dashboard. `limit` caps the strip (default 2). */
  function liveBannersForTenant(tenantId: string, userRole: StaffRoleName, limit = 2): PlatformBanner[] {
    const now = Date.now()
    return banners.value
      .filter(b => isLiveAt(b, now) && reachesViewer(b, tenantId, userRole) && !isDismissed(b.id, tenantId))
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.startAt.localeCompare(a.startAt))
      .slice(0, limit)
  }

  /**
   * Everything a tenant user has been shown, newest activity first, dismissed or not.
   * Scheduled banners (not shown yet) and retracted ones (withdrawn) never appear.
   */
  function announcementsForTenant(tenantId: string, userRole: StaffRoleName): TenantAnnouncement[] {
    const now = Date.now()
    return banners.value
      .filter(b => (b.status === 'live' || b.status === 'expired')
        && new Date(b.startAt).getTime() <= now
        && reachesViewer(b, tenantId, userRole))
      .map((banner): TenantAnnouncement => {
        const live = isLiveAt(banner, now)
        const state: AnnouncementState = live ? (banner.resolvedAt ? 'resolved' : 'live') : 'ended'
        return { banner, state, dismissed: live && isDismissed(banner.id, tenantId) }
      })
      .sort((a, b) => lastActivityAt(b.banner).localeCompare(lastActivityAt(a.banner)))
  }

  function fireEmailTrigger(banner: PlatformBanner, reason: 'live' | 'update' | 'resolved' = 'live'): void {
    const recipients = resolveRecipients(banner)
    for (const tenantId of recipients) {
      log('banner_email_sent', 'banner', banner.id, {
        tenantId,
        title: banner.title,
        recipientCount: banner.visibleRoles.length,
        reason,
      })
    }
  }

  function createBanner(input: CreateBannerInput): PlatformBanner {
    if (input.kind === 'maintenance') {
      const w = input.maintenance
      if (!w) throw new Error('Maintenance needs a window')
      if (new Date(w.endAt).getTime() <= new Date(w.startAt).getTime()) throw new Error('Maintenance window must end after it starts')
    }
    const isLive = new Date(input.startAt).getTime() <= Date.now()
    const banner: PlatformBanner = {
      id: genId(),
      ...input,
      status: isLive ? 'live' : 'scheduled',
      createdAt: new Date().toISOString(),
    }
    banners.value = [...banners.value, banner]
    log(isLive ? 'banner_live' : 'banner_scheduled', 'banner', banner.id, {
      severity: banner.severity,
      recipientCount: resolveRecipients(banner).length,
    })
    if (shouldEmail(banner) && isLive) {
      fireEmailTrigger(banner)
    }
    return banner
  }

  function updateBanner(id: string, patch: Partial<PlatformBanner>): PlatformBanner {
    const existing = banners.value.find(b => b.id === id)
    if (!existing) throw new Error('Banner not found')
    const updated = { ...existing, ...patch }
    banners.value = banners.value.map(b => b.id === id ? updated : b)
    return updated
  }

  function retractBanner(id: string, staffId: string, reason: string): PlatformBanner {
    const existing = banners.value.find(b => b.id === id)
    if (!existing) throw new Error('Banner not found')
    const updated: PlatformBanner = {
      ...existing,
      status: 'retracted',
      retractedAt: new Date().toISOString(),
      retractedByStaffId: staffId,
      retractionReason: reason,
    }
    banners.value = banners.value.map(b => b.id === id ? updated : b)
    log(
      existing.status === 'scheduled' ? 'banner_retracted_before_live' : 'banner_retracted',
      'banner', id, { reason, wasLive: existing.status === 'live' },
    )
    return updated
  }

  /** Posts a progress note on a live banner. Tenants who dismissed it see it again. */
  function postUpdate(id: string, staffId: string, message: string): PlatformBanner {
    const existing = banners.value.find(b => b.id === id)
    if (!existing) throw new Error('Banner not found')
    if (existing.status !== 'live') throw new Error('Only a live banner can take an update')
    const text = message.trim()
    if (!text) throw new Error('Write the update first')
    const update: BannerUpdate = {
      id: `${id}-u${(existing.updates?.length ?? 0) + 1}`,
      kind: 'update', message: text, createdAt: new Date().toISOString(), createdByStaffId: staffId,
    }
    const updated: PlatformBanner = { ...existing, updates: [...(existing.updates ?? []), update] }
    banners.value = banners.value.map(b => b.id === id ? updated : b)
    log('banner_updated', 'banner', id, { message: text })
    if (shouldEmail(updated)) fireEmailTrigger(updated, 'update')
    return updated
  }

  /**
   * The all clear. The banner flips to "Resolved" for everyone and stays up for
   * RESOLVED_GRACE_MS, then the sweep expires it.
   */
  function resolveBanner(id: string, staffId: string, note: string): PlatformBanner {
    const existing = banners.value.find(b => b.id === id)
    if (!existing) throw new Error('Banner not found')
    if (!canResolve(existing)) throw new Error('This banner cannot be resolved')
    const now = new Date()
    const text = note.trim() || 'This is resolved. No action needed.'
    const update: BannerUpdate = {
      id: `${id}-u${(existing.updates?.length ?? 0) + 1}`,
      kind: 'resolved', message: text, createdAt: now.toISOString(), createdByStaffId: staffId,
    }
    const updated: PlatformBanner = {
      ...existing,
      resolvedAt: now.toISOString(),
      endAt: new Date(now.getTime() + RESOLVED_GRACE_MS).toISOString(),
      updates: [...(existing.updates ?? []), update],
    }
    banners.value = banners.value.map(b => b.id === id ? updated : b)
    log('banner_resolved', 'banner', id, { note: text })
    if (shouldEmail(updated)) fireEmailTrigger(updated, 'resolved')
    return updated
  }

  function duplicateBanner(id: string): PlatformBanner {
    const existing = banners.value.find(b => b.id === id)
    if (!existing) throw new Error('Banner not found')
    // A copied window that already passed would open as "wrapping up", so move it to the next free day.
    let maintenance = existing.maintenance
    let endAt: string | undefined
    if (maintenance) {
      const startMs = new Date(maintenance.startAt).getTime()
      const shift = startMs <= Date.now() ? Math.ceil((Date.now() - startMs) / DAY_MS) * DAY_MS : 0
      maintenance = {
        ...maintenance,
        startAt: new Date(startMs + shift).toISOString(),
        endAt: new Date(new Date(maintenance.endAt).getTime() + shift).toISOString(),
      }
      endAt = new Date(new Date(maintenance.endAt).getTime() + MAINTENANCE_WRAP_UP_MS).toISOString()
    }
    return createBanner({
      title: `${existing.title} (copy)`,
      body: existing.body,
      severity: existing.severity,
      ctaLabel: existing.ctaLabel,
      ctaUrl: existing.ctaUrl,
      targetScope: existing.targetScope,
      targetFilter: existing.targetFilter,
      visibleRoles: existing.visibleRoles,
      dismissible: existing.dismissible,
      dismissalScope: existing.dismissalScope,
      kind: existing.kind,
      maintenance,
      sendEmail: existing.sendEmail,
      startAt: new Date().toISOString(),
      endAt,
      createdByStaffId: 'staff-1',
    })
  }

  function dismiss(bannerId: string, tenantId: string, _userId?: string): void {
    dismissals.value = [...dismissals.value, {
      bannerId, tenantId,
      dismissedAt: new Date().toISOString(),
    }]
  }

  function runSchedulingSweep(): { wentLive: number; expired: number } {
    const now = Date.now()
    let wentLive = 0
    let expired = 0
    banners.value = banners.value.map((b) => {
      if (b.status === 'scheduled' && new Date(b.startAt).getTime() <= now) {
        wentLive++
        log('banner_live', 'banner', b.id, { severity: b.severity, recipientCount: resolveRecipients(b).length })
        if (shouldEmail(b)) fireEmailTrigger(b)
        return { ...b, status: 'live' as BannerStatus }
      }
      if (b.status === 'live' && b.endAt && new Date(b.endAt).getTime() < now) {
        expired++
        log('banner_expired', 'banner', b.id, {})
        return { ...b, status: 'expired' as BannerStatus }
      }
      return b
    })
    return { wentLive, expired }
  }

  return {
    banners, dismissals,
    resolveRecipients, liveBannersForTenant, announcementsForTenant, isDismissed,
    createBanner, updateBanner, retractBanner, duplicateBanner, postUpdate, resolveBanner,
    dismiss, runSchedulingSweep,
  }
}