import { describe, expect, it } from 'vitest'
import { usePlatformBanners } from '~/composables/usePlatformBanners'
import { maintenancePhase } from '~/components/platform-console/data/banners'
import { usePlatformAudit } from '~/composables/usePlatformAudit'

describe('usePlatformBanners', () => {
  it('seeds with mock banners', () => {
    const { banners } = usePlatformBanners()
    expect(banners.value.length).toBeGreaterThan(0)
  })

  it('resolveRecipients handles "all" scope', () => {
    const { resolveRecipients, banners } = usePlatformBanners()
    const all = banners.value.find(b => b.targetFilter.scope === 'all')!
    const recipients = resolveRecipients(all)
    expect(recipients.length).toBeGreaterThan(5)
  })

  it('resolveRecipients handles segment scope', () => {
    const { resolveRecipients, banners } = usePlatformBanners()
    const seg = banners.value.find(b => b.targetFilter.scope === 'segment')!
    // Segment: per_property + growth + id → t-10 matches (growth), t-1 doesn't (pro)
    const recipients = resolveRecipients(seg)
    expect(recipients).toContain('t-10')
    expect(recipients).not.toContain('t-1')
    expect(recipients).not.toContain('t-7')
  })

  it('resolveRecipients handles individual scope', () => {
    const { resolveRecipients, banners } = usePlatformBanners()
    const ind = banners.value.find(b => b.targetFilter.scope === 'individual')!
    expect(resolveRecipients(ind)).toEqual(['t-1', 't-7'])
  })

  it('liveBannersForTenant caps at 2 and respects priority', () => {
    const { liveBannersForTenant } = usePlatformBanners()
    const list = liveBannersForTenant('t-1', 'Admin')
    expect(list.length).toBeLessThanOrEqual(2)
  })

  it('liveBannersForTenant respects visible_roles', () => {
    const { liveBannersForTenant } = usePlatformBanners()
    const adminList = liveBannersForTenant('t-1', 'Admin')
    const housekeepingList = liveBannersForTenant('t-1', 'Housekeeping')
    expect(adminList.length).toBeGreaterThanOrEqual(housekeepingList.length)
  })

  it('createBanner sets status to live when startAt is now', () => {
    const { createBanner, banners } = usePlatformBanners()
    const b = createBanner({
      title: 'Test', body: 'Hello world', severity: 'info',
      targetScope: 'all', targetFilter: { scope: 'all' },
      visibleRoles: ['Admin'], dismissible: true, dismissalScope: 'account',
      startAt: new Date().toISOString(), createdByStaffId: 'staff-1',
    })
    expect(b.status).toBe('live')
    expect(b.id).toMatch(/^banner-/)
  })

  it('createBanner sets status to scheduled when startAt is future', () => {
    const { createBanner } = usePlatformBanners()
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const b = createBanner({
      title: 'Future', body: 'Scheduled banner', severity: 'info',
      targetScope: 'all', targetFilter: { scope: 'all' },
      visibleRoles: ['Admin'], dismissible: true, dismissalScope: 'account',
      startAt: future, createdByStaffId: 'staff-1',
    })
    expect(b.status).toBe('scheduled')
  })

  it('critical banner creation triggers banner_email_sent audit', () => {
    const { createBanner } = usePlatformBanners()
    const { auditLog } = usePlatformAudit()
    const before = auditLog.value.length
    createBanner({
      title: 'Critical test', body: 'Triggers email', severity: 'critical',
      targetScope: 'individual', targetFilter: { scope: 'individual', tenantIds: ['t-1'] },
      visibleRoles: ['Admin'], dismissible: true, dismissalScope: 'account',
      startAt: new Date().toISOString(), createdByStaffId: 'staff-1',
    })
    const sent = auditLog.value.slice(before).find(e => e.action === 'banner_email_sent')
    expect(sent).toBeTruthy()
  })

  it('retractBanner flips scheduled to retracted', () => {
    const { retractBanner, banners } = usePlatformBanners()
    const scheduled = banners.value.find(b => b.status === 'scheduled')!
    const r = retractBanner(scheduled.id, 'staff-1', 'Changed mind')
    expect(r.status).toBe('retracted')
  })

  it('dismiss records a dismissal', () => {
    const { dismiss, dismissals, banners } = usePlatformBanners()
    const banner = banners.value.find(b => b.status === 'live')!
    const before = dismissals.value.length
    dismiss(banner.id, 't-1', undefined)
    expect(dismissals.value.length).toBe(before + 1)
  })

  it('runSchedulingSweep transitions scheduled to live', () => {
    const { banners, runSchedulingSweep } = usePlatformBanners()
    banners.value = [...banners.value, {
      id: 'banner-future-1', title: 'Future', body: 'Soon', severity: 'info',
      targetScope: 'all', targetFilter: { scope: 'all' },
      visibleRoles: ['Admin'], dismissible: true, dismissalScope: 'user',
      startAt: new Date(Date.now() - 1000).toISOString(),
      status: 'scheduled', createdByStaffId: 'staff-1', createdAt: new Date().toISOString(),
    }]
    const result = runSchedulingSweep()
    expect(result.wentLive).toBeGreaterThanOrEqual(1)
  })

  describe('maintenance and lifecycle', () => {
    const base = {
      body: 'Body', severity: 'warning' as const, targetScope: 'individual' as const,
      targetFilter: { scope: 'individual' as const, tenantIds: ['t-1'] },
      visibleRoles: ['Admin' as const], dismissible: true, dismissalScope: 'account' as const,
      createdByStaffId: 'staff-1',
    }
    const hour = 3_600_000
    function window(startInMs: number, lengthMs = 30 * 60_000) {
      return {
        startAt: new Date(Date.now() + startInMs).toISOString(),
        endAt: new Date(Date.now() + startInMs + lengthMs).toISOString(),
        timezone: 'UTC', impact: 'offline' as const, affected: ['Inbox'],
      }
    }

    it('seeds banner-1 as a maintenance notice with a window', () => {
      const { banners } = usePlatformBanners()
      const b = banners.value.find(x => x.id === 'banner-1')!
      expect(b.kind).toBe('maintenance')
      expect(b.maintenance?.affected).toEqual(['Inbox', 'Reviews'])
    })

    it('rejects a maintenance window that ends before it starts', () => {
      const { createBanner } = usePlatformBanners()
      expect(() => createBanner({
        ...base, title: 'Bad', kind: 'maintenance',
        maintenance: { ...window(hour), endAt: new Date(Date.now()).toISOString() },
        startAt: new Date().toISOString(),
      })).toThrow(/end after it starts/)
    })

    it('rejects maintenance without a window', () => {
      const { createBanner } = usePlatformBanners()
      expect(() => createBanner({ ...base, title: 'No window', kind: 'maintenance', startAt: new Date().toISOString() })).toThrow()
    })

    it('emails on an opt-in non-critical banner, not on a plain one', () => {
      const { createBanner } = usePlatformBanners()
      const { auditLog } = usePlatformAudit()
      const before = auditLog.value.length
      createBanner({ ...base, title: 'Quiet', startAt: new Date().toISOString() })
      expect(auditLog.value.slice(before).some(e => e.action === 'banner_email_sent')).toBe(false)
      createBanner({ ...base, title: 'Loud', sendEmail: true, startAt: new Date().toISOString() })
      expect(auditLog.value.slice(before).some(e => e.action === 'banner_email_sent')).toBe(true)
    })

    it('does not email a critical banner that opted out', () => {
      const { createBanner } = usePlatformBanners()
      const { auditLog } = usePlatformAudit()
      const before = auditLog.value.length
      createBanner({ ...base, title: 'Critical, quiet', severity: 'critical', sendEmail: false, startAt: new Date().toISOString() })
      expect(auditLog.value.slice(before).some(e => e.action === 'banner_email_sent')).toBe(false)
    })

    it('schedules a banner for later and emails only once it goes live', () => {
      const { createBanner, banners, runSchedulingSweep } = usePlatformBanners()
      const { auditLog } = usePlatformAudit()
      const before = auditLog.value.length
      const b = createBanner({ ...base, title: 'Later', sendEmail: true, startAt: new Date(Date.now() + hour).toISOString() })
      expect(b.status).toBe('scheduled')
      expect(auditLog.value.slice(before).some(e => e.action === 'banner_email_sent')).toBe(false)
      banners.value = banners.value.map(x => x.id === b.id ? { ...x, startAt: new Date(Date.now() - 1000).toISOString() } : x)
      runSchedulingSweep()
      expect(banners.value.find(x => x.id === b.id)!.status).toBe('live')
      expect(auditLog.value.slice(before).some(e => e.action === 'banner_email_sent')).toBe(true)
    })

    it('postUpdate appends a note, audits it and re-surfaces a dismissed banner', async () => {
      const { createBanner, postUpdate, dismiss, liveBannersForTenant } = usePlatformBanners()
      const { auditLog } = usePlatformAudit()
      const b = createBanner({ ...base, title: 'Updatable', startAt: new Date().toISOString() })
      dismiss(b.id, 't-1')
      expect(liveBannersForTenant('t-1', 'Admin', Infinity).some(x => x.id === b.id)).toBe(false)
      await new Promise(r => setTimeout(r, 5))
      postUpdate(b.id, 'staff-1', '  Taking longer  ')
      const live = liveBannersForTenant('t-1', 'Admin', Infinity).find(x => x.id === b.id)!
      expect(live.updates?.[0]).toMatchObject({ kind: 'update', message: 'Taking longer' })
      expect(auditLog.value.some(e => e.action === 'banner_updated' && e.targetId === b.id)).toBe(true)
    })

    it('postUpdate refuses empty text and non-live banners', () => {
      const { createBanner, postUpdate } = usePlatformBanners()
      const live = createBanner({ ...base, title: 'Live', startAt: new Date().toISOString() })
      expect(() => postUpdate(live.id, 'staff-1', '   ')).toThrow()
      const later = createBanner({ ...base, title: 'Later', startAt: new Date(Date.now() + hour).toISOString() })
      expect(() => postUpdate(later.id, 'staff-1', 'hi')).toThrow(/live/)
    })

    it('resolveBanner flips to resolved, shortens the run and emails when asked', () => {
      const { createBanner, resolveBanner } = usePlatformBanners()
      const { auditLog } = usePlatformAudit()
      const b = createBanner({ ...base, title: 'Outage', severity: 'critical', startAt: new Date().toISOString() })
      const before = auditLog.value.length
      const r = resolveBanner(b.id, 'staff-1', '')
      expect(r.resolvedAt).toBeTruthy()
      expect(r.updates?.at(-1)).toMatchObject({ kind: 'resolved', message: 'This is resolved. No action needed.' })
      expect(new Date(r.endAt!).getTime() - Date.now()).toBeLessThanOrEqual(hour)
      const entries = auditLog.value.slice(before)
      expect(entries.some(e => e.action === 'banner_resolved')).toBe(true)
      expect(entries.some(e => e.action === 'banner_email_sent' && e.metadata?.reason === 'resolved')).toBe(true)
    })

    it('cannot resolve a maintenance whose window has not started, or resolve twice', () => {
      const { createBanner, resolveBanner } = usePlatformBanners()
      const upcoming = createBanner({
        ...base, title: 'Upcoming', kind: 'maintenance', maintenance: window(2 * hour),
        startAt: new Date().toISOString(),
      })
      expect(() => resolveBanner(upcoming.id, 'staff-1', 'x')).toThrow()
      const started = createBanner({
        ...base, title: 'Underway', kind: 'maintenance', maintenance: window(-10 * 60_000, hour),
        startAt: new Date(Date.now() - hour).toISOString(),
      })
      resolveBanner(started.id, 'staff-1', 'Done')
      expect(() => resolveBanner(started.id, 'staff-1', 'again')).toThrow()
    })

    it('maintenancePhase follows the window while live and goes quiet once withdrawn or ended', () => {
      const { createBanner, retractBanner, banners } = usePlatformBanners()
      const upcoming = createBanner({
        ...base, title: 'Phases', kind: 'maintenance', maintenance: window(2 * hour),
        startAt: new Date().toISOString(),
      })
      expect(maintenancePhase(upcoming)).toBe('upcoming')
      expect(maintenancePhase(upcoming, Date.now() + 2 * hour + 60_000)).toBe('in_progress')
      expect(maintenancePhase(upcoming, Date.now() + 4 * hour)).toBe('wrapping_up')

      const expired = { ...upcoming, status: 'expired' as const }
      expect(maintenancePhase(expired, Date.now() + 4 * hour)).toBeNull()
      expect(maintenancePhase({ ...expired, resolvedAt: new Date().toISOString() })).toBe('resolved')

      retractBanner(upcoming.id, 'staff-1', 'cancelled')
      expect(maintenancePhase(banners.value.find(b => b.id === upcoming.id)!)).toBeNull()
    })

    it('liveBannersForTenant caps by limit and Infinity lifts it', () => {
      const { createBanner, liveBannersForTenant } = usePlatformBanners()
      for (let i = 0; i < 3; i++) createBanner({ ...base, title: `Many ${i}`, startAt: new Date().toISOString() })
      expect(liveBannersForTenant('t-1', 'Admin').length).toBe(2)
      expect(liveBannersForTenant('t-1', 'Admin', Infinity).length).toBeGreaterThan(2)
    })

    it('announcementsForTenant lists dismissed and ended ones, hides scheduled and retracted', () => {
      const { createBanner, retractBanner, dismiss, announcementsForTenant, banners } = usePlatformBanners()
      const shown = createBanner({ ...base, title: 'Shown', startAt: new Date().toISOString() })
      const hidden = createBanner({ ...base, title: 'Hidden', startAt: new Date().toISOString() })
      const future = createBanner({ ...base, title: 'Future', startAt: new Date(Date.now() + hour).toISOString() })
      retractBanner(hidden.id, 'staff-1', 'oops')
      dismiss(shown.id, 't-1')
      const list = announcementsForTenant('t-1', 'Admin')
      const byId = (id: string) => list.find(a => a.banner.id === id)
      expect(byId(shown.id)).toMatchObject({ state: 'live', dismissed: true })
      expect(byId(hidden.id)).toBeUndefined()
      expect(byId(future.id)).toBeUndefined()
      expect(list.some(a => a.state === 'ended')).toBe(true)
      expect(banners.value.find(b => b.id === 'banner-4')!.status).toBe('expired')
    })

    it('duplicating a maintenance banner moves a past window to a future day', () => {
      const { createBanner, duplicateBanner } = usePlatformBanners()
      const past = createBanner({
        ...base, title: 'Past window', kind: 'maintenance', maintenance: window(-2 * hour, hour),
        startAt: new Date(Date.now() - 3 * hour).toISOString(),
      })
      const copy = duplicateBanner(past.id)
      expect(new Date(copy.maintenance!.startAt).getTime()).toBeGreaterThan(Date.now())
      expect(new Date(copy.maintenance!.endAt).getTime() - new Date(copy.maintenance!.startAt).getTime()).toBe(hour)
      expect(copy.status).toBe('live')
    })
  })
})
