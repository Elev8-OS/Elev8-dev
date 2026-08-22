import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockOwnerBookingModes, mockOwnerSeasonalQuotas } from '~/components/owners/data/owner-quotas'
import { mockOwnerStays } from '~/components/owners/data/owner-stays'
import { useOwnerQuotas } from '~/composables/useOwnerQuotas'

interface AlertCall {
  type: string
  severity: string
  context: Record<string, unknown>
}

const notificationsMock = vi.hoisted(() => {
  const callLog: AlertCall[] = []
  return {
    callLog,
    spy: {
      createAlert: (type: string, severity: string, context: Record<string, unknown>) => {
        callLog.push({ type, severity, context })
      },
    },
  }
})

vi.mock('~/composables/useNotifications', () => ({
  useNotifications: () => notificationsMock.spy,
}))

function resetState() {
  const stays = useState<OwnerStay[]>('elev8-owner-stays')
  stays.value = structuredClone(mockOwnerStays)
  const quotas = useState('elev8-owner-seasonal-quotas')
  quotas.value = structuredClone(mockOwnerSeasonalQuotas)
  const modes = useState('elev8-owner-booking-modes')
  modes.value = structuredClone(mockOwnerBookingModes)
}

describe('useOwnerQuotas', () => {
  beforeEach(() => {
    resetState()
  })

  it('returns the configured booking mode and falls back to direct', () => {
    const { getBookingMode } = useOwnerQuotas()
    expect(getBookingMode('own-1', 'lst-1')).toBe('direct')
    expect(getBookingMode('own-2', 'lst-8')).toBe('request')
    // No config → direct (preferred default per PRD 5.2).
    expect(getBookingMode('own-3', 'lst-3')).toBe('direct')
  })

  it('blocks a direct booking that exceeds a quota window', () => {
    const { checkQuota } = useOwnerQuotas()
    // own-1 / lst-1: Jul 1 – Aug 31 has maxNights 0 (fully blocked).
    const result = checkQuota('own-1', 'lst-1', '2026-08-10', '2026-08-13')
    expect(result.ok).toBe(false)
    expect(result.exceeded).toBe(true)
    expect(result.windows[0]?.maxNights).toBe(0)
  })

  it('allows a booking inside a window with remaining nights', () => {
    const { checkQuota } = useOwnerQuotas()
    // own-1 / lst-1: Apr 1 – Jun 30 has maxNights 14 (capped by the annual
    // use cap); seed ost-1 uses 3 of them (Jun 10–13), so 11 remain.
    const result = checkQuota('own-1', 'lst-1', '2026-04-10', '2026-04-13')
    expect(result.ok).toBe(true)
    expect(result.windows[0]?.remaining).toBe(11)
  })

  it('counts existing active stays against the window usage (non-accumulating)', () => {
    const { checkQuota } = useOwnerQuotas()
    // Seed ost-2: own-2 / lst-8, 2026-08-05 → 08-12 (7 nights) — but the
    // quota window for own-2/lst-8 is Dec 20 – Jan 5, so no overlap.
    const result = checkQuota('own-2', 'lst-8', '2026-12-22', '2026-12-24')
    expect(result.windows[0]?.maxNights).toBe(7)
    expect(result.ok).toBe(true)
  })

  it('computes remaining quota for the active window', () => {
    const { getRemainingQuota } = useOwnerQuotas()
    // own-1/lst-1 Apr window: 14 nights, 3 used by seed ost-1 → 11.
    expect(getRemainingQuota('own-1', 'lst-1', '2026-04-15')).toBe(11)
    // Date outside any window → unlimited.
    expect(getRemainingQuota('own-1', 'lst-1', '2026-09-15')).toBe(Number.POSITIVE_INFINITY)
  })

  it('upserts and removes quota windows', () => {
    const { upsertQuota, removeQuota, quotasForOwnerListing } = useOwnerQuotas()
    const added = upsertQuota({
      ownerId: 'own-1',
      listingId: 'lst-1',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      maxNights: 5,
    })
    expect(added.success).toBe(true)
    if (added.success) {
      const windows = quotasForOwnerListing('own-1', 'lst-1')
      expect(windows.some(w => w.id === added.quota?.id)).toBe(true)
      removeQuota(added.quota!.id)
      expect(quotasForOwnerListing('own-1', 'lst-1').some(w => w.id === added.quota?.id)).toBe(false)
    }
  })

  it('rejects invalid quota ranges', () => {
    const { upsertQuota } = useOwnerQuotas()
    expect(upsertQuota({
      ownerId: 'own-1',
      listingId: 'lst-1',
      startDate: '2026-09-30',
      endDate: '2026-09-01',
      maxNights: 5,
    }).success).toBe(false)
  })

  it('rejects a seasonal window larger than the owner annual cap', () => {
    const { upsertQuota } = useOwnerQuotas()
    // own-1 (Wayan) has an annual cap of 14 — a 15-night window is invalid.
    const result = upsertQuota({
      ownerId: 'own-1',
      listingId: 'lst-1',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      maxNights: 15,
    })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toContain('annual cap')
  })

  it('allows a seasonal window at or below the owner annual cap', () => {
    const { upsertQuota, quotasForOwnerListing } = useOwnerQuotas()
    const result = upsertQuota({
      ownerId: 'own-1',
      listingId: 'lst-1',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      maxNights: 14,
    })
    expect(result.success).toBe(true)
    if (result.success)
      expect(quotasForOwnerListing('own-1', 'lst-1').some(w => w.maxNights === 14)).toBe(true)
  })

  it('sets the booking mode per owner+listing', () => {
    const { setBookingMode, getBookingMode } = useOwnerQuotas()
    setBookingMode('own-1', 'lst-1', 'request')
    expect(getBookingMode('own-1', 'lst-1')).toBe('request')
  })
})
