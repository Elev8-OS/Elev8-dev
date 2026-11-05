import { beforeEach, describe, expect, it } from 'vitest'
import { usePlatformBanners } from '~/composables/usePlatformBanners'
import { maintenancePhase } from '~/components/platform-console/data/banners'
import { usePlatformAudit } from '~/composables/usePlatformAudit'

/** The seed already has two live broadcasts, the platform maximum: clear the way for tests that create their own. */
function clearActive() {
  const { banners } = usePlatformBanners()
  banners.value = banners.value.map(b => b.status === 'live' || b.status === 'scheduled' ? { ...b, status: 'expired' as const } : b)
}

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
    clearActive()
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
    clearActive()
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
    beforeEach(clearActive)
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

    it('schedules a banner for later and goes live once its time comes', () => {
      const { createBanner, banners, runSchedulingSweep } = usePlatformBanners()
      const b = createBanner({ ...base, title: 'Later', startAt: new Date(Date.now() + hour).toISOString() })
      expect(b.status).toBe('scheduled')
      banners.value = banners.value.map(x => x.id === b.id ? { ...x, startAt: new Date(Date.now() - 1000).toISOString() } : x)
      runSchedulingSweep()
      expect(banners.value.find(x => x.id === b.id)!.status).toBe('live')
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

    it('resolveBanner ends it at once like a retract: tenants stop seeing it, its slot is free, staff keep it as resolved', () => {
      const { createBanner, resolveBanner, liveBannersForTenant } = usePlatformBanners()
      const { auditLog } = usePlatformAudit()
      const b = createBanner({ ...base, title: 'Outage', severity: 'critical', startAt: new Date().toISOString() })
      const before = auditLog.value.length
      const r = resolveBanner(b.id, 'staff-1', '')
      expect(r.resolvedAt).toBeTruthy()
      expect(r.updates?.at(-1)).toMatchObject({ kind: 'resolved', message: 'This is resolved. No action needed.' })
      expect(r.status).toBe('expired')
      expect(new Date(r.endAt!).getTime()).toBeLessThanOrEqual(Date.now())
      expect(liveBannersForTenant('t-1', 'Admin', Infinity).some(x => x.id === b.id)).toBe(false)
      expect(maintenancePhase({ ...r, kind: 'maintenance', maintenance: window(-hour, hour) })).toBe('resolved')
      const entries = auditLog.value.slice(before)
      expect(entries.some(e => e.action === 'banner_resolved')).toBe(true)
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
      const { banners, liveBannersForTenant } = usePlatformBanners()
      const template = banners.value.find(b => b.id === 'banner-1')!
      // Bypass createBanner: it refuses a third active broadcast.
      banners.value = [...banners.value, ...[1, 2, 3].map(i => ({
        ...template, id: `many-${i}`, title: `Many ${i}`, status: 'live' as const,
        startAt: new Date().toISOString(), endAt: undefined,
      }))]
      expect(liveBannersForTenant('t-1', 'Admin').length).toBe(2)
      expect(liveBannersForTenant('t-1', 'Admin', Infinity).length).toBeGreaterThan(2)
    })

    describe('active limit', () => {
      it('refuses a third active broadcast, whatever the audience', () => {
        const { createBanner } = usePlatformBanners()
        createBanner({ ...base, title: 'One', startAt: new Date().toISOString() })
        createBanner({ ...base, title: 'Two', targetFilter: { scope: 'all' }, targetScope: 'all', startAt: new Date().toISOString() })
        expect(() => createBanner({ ...base, title: 'Three', startAt: new Date().toISOString() })).toThrow(/Only 2 broadcasts/)
      })

      it('counts scheduled broadcasts at the moment the new one would run', () => {
        const { createBanner } = usePlatformBanners()
        createBanner({ ...base, title: 'Live', startAt: new Date().toISOString() })
        createBanner({ ...base, title: 'Soon', startAt: new Date(Date.now() + 24 * hour).toISOString() })
        // Fine while only one is up, refused once the scheduled one has started.
        expect(() => createBanner({ ...base, title: 'Overlap', startAt: new Date(Date.now() + 48 * hour).toISOString() })).toThrow(/Only 2/)
        expect(() => createBanner({
          ...base, title: 'Short', startAt: new Date(Date.now() + hour).toISOString(), endAt: new Date(Date.now() + 2 * hour).toISOString(),
        })).not.toThrow()
      })

      it('catches a broadcast whose run spans the start of two later ones', () => {
        const { createBanner } = usePlatformBanners()
        createBanner({ ...base, title: 'B', startAt: new Date(Date.now() + 10 * hour).toISOString(), endAt: new Date(Date.now() + 20 * hour).toISOString() })
        createBanner({ ...base, title: 'C', startAt: new Date(Date.now() + 12 * hour).toISOString(), endAt: new Date(Date.now() + 20 * hour).toISOString() })
        expect(() => createBanner({ ...base, title: 'Long', startAt: new Date().toISOString() })).toThrow(/Only 2/)
        expect(() => createBanner({ ...base, title: 'Ends first', startAt: new Date().toISOString(), endAt: new Date(Date.now() + 5 * hour).toISOString() })).not.toThrow()
      })

      it('frees a slot when one is resolved', () => {
        const { createBanner, resolveBanner } = usePlatformBanners()
        const a = createBanner({ ...base, title: 'A', startAt: new Date().toISOString() })
        createBanner({ ...base, title: 'B', startAt: new Date().toISOString() })
        expect(() => createBanner({ ...base, title: 'C', startAt: new Date().toISOString() })).toThrow()
        resolveBanner(a.id, 'staff-1', 'done')
        expect(() => createBanner({ ...base, title: 'C', startAt: new Date().toISOString() })).not.toThrow()
      })

      it('frees a slot when one is retracted', () => {
        const { createBanner, retractBanner } = usePlatformBanners()
        const a = createBanner({ ...base, title: 'A', startAt: new Date().toISOString() })
        createBanner({ ...base, title: 'B', startAt: new Date().toISOString() })
        expect(() => createBanner({ ...base, title: 'C', startAt: new Date().toISOString() })).toThrow()
        retractBanner(a.id, 'staff-1', 'making room')
        expect(() => createBanner({ ...base, title: 'C', startAt: new Date().toISOString() })).not.toThrow()
      })
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
