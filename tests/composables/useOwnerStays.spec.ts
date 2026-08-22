import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as operationsCalendar from '~/components/operations-calendar/data/operations-calendar'
import { mockOwnerStays } from '~/components/owners/data/owner-stays'
import {
  countNights,
  dateRangesOverlap,
  DEFAULT_ANNUAL_OWNER_USE_CAP,
  useOwnerStays,
} from '~/composables/useOwnerStays'

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

const guestReservations = [
  {
    id: 'res-guest-1',
    listingId: 'lst-conflicts',
    checkIn: '2026-09-10',
    checkOut: '2026-09-12',
    status: 'confirmed',
  },
  {
    id: 'res-cancelled',
    listingId: 'lst-conflicts',
    checkIn: '2026-09-12',
    checkOut: '2026-09-15',
    status: 'cancelled',
  },
]

function resetStays() {
  const state = useState<OwnerStay[]>('elev8-owner-stays')
  state.value = structuredClone(mockOwnerStays)
}

function activeStay(overrides: Partial<OwnerStay> = {}): OwnerStay {
  return {
    id: 'ost-existing',
    ownerId: 'own-conflict',
    listingId: 'lst-conflicts',
    guestName: 'Existing owner stay',
    checkIn: '2026-09-20',
    checkOut: '2026-09-22',
    nights: 2,
    countsAgainstOwnerUseCap: true,
    status: 'active',
    syncState: { cockpit: 'synced', channex: 'synced', notifications: 'synced' },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('owner stay calendar events', () => {
  it('maps active stays to all-day events and excludes cancelled stays without mutating input', () => {
    const stays = [
      activeStay({
        id: 'ost-calendar-active',
        listingId: 'lst-1',
        guestName: 'Wayan Sari',
        checkIn: '2026-09-20',
        checkOut: '2026-09-22',
        notes: 'Family stay',
      }),
      activeStay({
        id: 'ost-calendar-cancelled',
        listingId: 'lst-1',
        guestName: 'Cancelled stay',
        status: 'cancelled',
      }),
    ]
    const original = structuredClone(stays)
    const buildOwnerStayEvents = (
      operationsCalendar as typeof operationsCalendar & {
        buildOwnerStayEvents?: (source: OwnerStay[]) => operationsCalendar.CalendarEvent[]
      }
    ).buildOwnerStayEvents

    expect(buildOwnerStayEvents).toBeTypeOf('function')
    if (!buildOwnerStayEvents)
      return

    const events = buildOwnerStayEvents(stays)

    expect(operationsCalendar.eventTypeLabels.owner_stay).toBe('Owner stay')
    expect(operationsCalendar.eventTypeTones.owner_stay).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(expect.objectContaining({
      id: 'owner-stay-ost-calendar-active',
      listingId: 'lst-1',
      type: 'owner_stay',
      title: 'Wayan Sari',
      start: '2026-09-20T00:00:00+08:00',
      end: '2026-09-22T00:00:00+08:00',
      guestName: 'Wayan Sari',
      status: 'active',
      notes: 'Family stay',
    }))
    expect(events[0]?.listingName).toBeTruthy()
    expect(events[0]?.colorIndex).toEqual(expect.any(Number))
    expect(stays).toEqual(original)
  })
})

describe('owner stay date helpers', () => {
  it('treats stays as half-open intervals', () => {
    expect(dateRangesOverlap('2026-09-10', '2026-09-12', '2026-09-11', '2026-09-13')).toBe(true)
    expect(dateRangesOverlap('2026-09-10', '2026-09-12', '2026-09-12', '2026-09-15')).toBe(false)
    expect(dateRangesOverlap('2026-09-12', '2026-09-15', '2026-09-10', '2026-09-12')).toBe(false)
  })

  it('counts nights between check-in and check-out', () => {
    expect(countNights('2026-09-10', '2026-09-13')).toBe(3)
    expect(countNights('2026-09-13', '2026-09-13')).toBe(0)
    expect(countNights('2026-09-14', '2026-09-13')).toBe(0)
  })
})

describe('useOwnerStays', () => {
  beforeEach(() => {
    resetStays()
    notificationsMock.callLog.length = 0
  })

  it('detects guest, blocked-date, and active owner-stay conflicts while ignoring cancelled records', () => {
    const { stays, detectConflicts } = useOwnerStays()
    stays.value = [activeStay()]

    const conflicts = detectConflicts({
      listingId: 'lst-conflicts',
      checkIn: '2026-09-10',
      checkOut: '2026-09-23',
      guestReservations,
      blockedDates: ['2026-09-16'],
    })

    expect(conflicts.map(conflict => conflict.type)).toEqual([
      'guest_reservation',
      'blocked_date',
      'owner_stay',
    ])
    expect(conflicts.find(conflict => conflict.id === 'res-cancelled')).toBeUndefined()
  })

  it('normalizes cancelled guest reservation statuses case-insensitively and accepts numeric 2', () => {
    const { detectConflicts } = useOwnerStays()
    const reservations = [
      { ...guestReservations[0], id: 'res-uppercase', status: 'CANCELLED' },
      { ...guestReservations[0], id: 'res-us-spelling', status: 'Canceled' },
      { ...guestReservations[0], id: 'res-numeric', status: 2 },
      { ...guestReservations[0], id: 'res-active', status: 'CONFIRMED' },
    ]

    const conflicts = detectConflicts({
      listingId: 'lst-conflicts',
      checkIn: '2026-09-10',
      checkOut: '2026-09-12',
      guestReservations: reservations,
    })

    expect(conflicts.map(conflict => conflict.id)).toEqual(['res-active'])
  })

  it('matches blocked date ranges and does not conflict on same-day turnover', () => {
    const { detectConflicts } = useOwnerStays()

    expect(detectConflicts({
      listingId: 'lst-conflicts',
      checkIn: '2026-09-12',
      checkOut: '2026-09-15',
      guestReservations: [guestReservations[0]],
    })).toHaveLength(0)

    expect(detectConflicts({
      listingId: 'lst-conflicts',
      checkIn: '2026-09-16',
      checkOut: '2026-09-18',
      blockedDates: [{ startDate: '2026-09-17', endDate: '2026-09-19' }],
    })).toEqual([
      expect.objectContaining({ type: 'blocked_date', start: '2026-09-17', end: '2026-09-19' }),
    ])
  })

  it('limits conflicts to the requested listing and unit', () => {
    const { detectConflicts } = useOwnerStays()

    expect(detectConflicts({
      listingId: 'lst-other',
      checkIn: '2026-09-20',
      checkOut: '2026-09-22',
      guestReservations: [guestReservations[0]],
      blockedDates: [{ listingId: 'lst-different', date: '2026-09-20' }],
    })).toHaveLength(0)

    expect(detectConflicts({
      listingId: 'lst-conflicts',
      unitId: 'unit-a',
      checkIn: '2026-09-20',
      checkOut: '2026-09-22',
      guestReservations: [{ ...guestReservations[0], unitId: 'unit-b' }],
    })).toHaveLength(0)
  })

  it('excludes the stay being modified from conflict results', () => {
    const { stays, detectConflicts } = useOwnerStays()
    stays.value = [activeStay()]

    expect(detectConflicts({
      listingId: 'lst-conflicts',
      checkIn: '2026-09-20',
      checkOut: '2026-09-22',
      excludeStayId: 'ost-existing',
    })).toHaveLength(0)
  })

  it('blocks create when a conflict exists and emits a conflict alert', () => {
    const { createStay, stays } = useOwnerStays()
    const result = createStay({
      ownerId: 'own-new',
      listingId: 'lst-conflicts',
      guestName: 'New owner guest',
      checkIn: '2026-09-10',
      checkOut: '2026-09-12',
      guestReservations,
    })

    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'conflict' }))
    expect(stays.value.some(stay => stay.guestName === 'New owner guest')).toBe(false)
    expect(notificationsMock.callLog).toContainEqual(expect.objectContaining({
      type: 'OWNER_STAY_CONFLICT',
      severity: 'CRITICAL',
    }))
  })

  it('creates a conflict-free stay with computed nights and confirmation alert', () => {
    const { createStay, stays } = useOwnerStays()
    const result = createStay({
      ownerId: 'own-new',
      listingId: 'lst-new',
      guestName: 'New owner guest',
      checkIn: '2026-09-10',
      checkOut: '2026-09-13',
      countsAgainstOwnerUseCap: true,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stay.id).toMatch(/^ost-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(result.stay.nights).toBe(3)
      expect(result.stay.status).toBe('active')
      expect(result.stay.syncState).toEqual({ cockpit: 'synced', channex: 'synced', notifications: 'synced' })
    }
    expect(stays.value).toHaveLength(mockOwnerStays.length + 1)
    expect(notificationsMock.callLog).toContainEqual(expect.objectContaining({
      type: 'OWNER_STAY_CONFIRMED',
      severity: 'INFO',
    }))
  })

  it('warns on an annual cap exceedance without blocking the stay', () => {
    const { createStay, getCapWarning, ownerUseNightsForYear } = useOwnerStays()
    const existing = activeStay({ ownerId: 'own-cap', checkIn: '2026-01-01', checkOut: '2026-01-11', nights: 10 })
    useState<OwnerStay[]>('elev8-owner-stays').value = [existing]

    expect(ownerUseNightsForYear('own-cap', 2026)).toBe(10)
    expect(getCapWarning('own-cap', '2026-02-01', '2026-02-06', 12)).toEqual(expect.objectContaining({
      exceeds: true,
      usedNights: 10,
      requestedNights: 5,
      projectedNights: 15,
      cap: 12,
    }))

    const result = createStay({
      ownerId: 'own-cap',
      listingId: 'lst-cap',
      guestName: 'Cap warning guest',
      checkIn: '2026-02-01',
      checkOut: '2026-02-06',
      countsAgainstOwnerUseCap: true,
      annualCap: 12,
    })

    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.capWarning?.exceeds).toBe(true)
    expect(notificationsMock.callLog).toContainEqual(expect.objectContaining({
      type: 'OWNER_USE_CAP_EXCEEDED',
      severity: 'WARNING',
    }))
  })

  it('enforces the default annual cap when create omits annualCap', () => {
    const { createStay, stays } = useOwnerStays()
    stays.value = [activeStay({
      id: 'ost-cap-used',
      ownerId: 'own-default-cap',
      listingId: 'lst-cap-used',
      checkIn: '2026-01-01',
      checkOut: '2026-01-30',
      nights: 29,
    })]

    const result = createStay({
      ownerId: 'own-default-cap',
      listingId: 'lst-default-cap',
      guestName: 'Default cap guest',
      checkIn: '2026-02-01',
      checkOut: '2026-02-03',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.capWarning).toEqual(expect.objectContaining({
        exceeds: true,
        usedNights: 29,
        requestedNights: 2,
        projectedNights: 31,
        cap: DEFAULT_ANNUAL_OWNER_USE_CAP,
      }))
    }
    expect(notificationsMock.callLog).toContainEqual(expect.objectContaining({
      type: 'OWNER_USE_CAP_EXCEEDED',
      severity: 'WARNING',
    }))
  })

  it('enforces the default annual cap when update omits annualCap', () => {
    const { stays, updateStay } = useOwnerStays()
    stays.value = [
      activeStay({
        id: 'ost-cap-used',
        ownerId: 'own-default-cap',
        listingId: 'lst-cap-used',
        checkIn: '2026-01-01',
        checkOut: '2026-01-30',
        nights: 29,
      }),
      activeStay({
        id: 'ost-cap-update',
        ownerId: 'own-default-cap',
        listingId: 'lst-cap-update',
        checkIn: '2026-03-01',
        checkOut: '2026-03-02',
        nights: 1,
      }),
    ]

    const result = updateStay('ost-cap-update', {
      checkIn: '2026-02-01',
      checkOut: '2026-02-03',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.capWarning).toEqual(expect.objectContaining({
        exceeds: true,
        usedNights: 29,
        requestedNights: 2,
        projectedNights: 31,
        cap: DEFAULT_ANNUAL_OWNER_USE_CAP,
      }))
    }
    expect(notificationsMock.callLog).toContainEqual(expect.objectContaining({
      type: 'OWNER_USE_CAP_EXCEEDED',
      severity: 'WARNING',
    }))
  })

  it('projects requested nights independently for each calendar year', () => {
    const { getCapWarning, stays } = useOwnerStays()
    stays.value = [activeStay({
      id: 'ost-next-year-used',
      ownerId: 'own-cross-year',
      listingId: 'lst-cap-used',
      checkIn: '2027-01-01',
      checkOut: '2027-01-30',
      nights: 29,
    })]

    expect(getCapWarning('own-cross-year', '2026-12-31', '2027-01-03')).toEqual({
      exceeds: true,
      ownerId: 'own-cross-year',
      year: 2027,
      usedNights: 29,
      requestedNights: 2,
      projectedNights: 31,
      cap: DEFAULT_ANNUAL_OWNER_USE_CAP,
    })
  })

  it('supports update while excluding the current stay from conflict checks', () => {
    const { stays, updateStay } = useOwnerStays()
    stays.value = [activeStay({ ownerId: 'own-update' })]

    const result = updateStay('ost-existing', {
      guestName: 'Updated guest',
      checkIn: '2026-09-21',
      checkOut: '2026-09-24',
    })

    expect(result.ok).toBe(true)
    expect(stays.value[0]).toEqual(expect.objectContaining({
      guestName: 'Updated guest',
      checkIn: '2026-09-21',
      checkOut: '2026-09-24',
      nights: 3,
    }))
  })

  it('clears unitId and notes when update receives explicit null values', () => {
    const { stays, updateStay } = useOwnerStays()
    stays.value = [activeStay({
      unitId: 'unit-a',
      notes: 'Remove these details',
    })]

    const result = updateStay('ost-existing', {
      unitId: null,
      notes: null,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stay.unitId).toBeUndefined()
      expect(result.stay.notes).toBeUndefined()
    }
    expect(stays.value[0]?.unitId).toBeUndefined()
    expect(stays.value[0]?.notes).toBeUndefined()
  })

  it('blocks an update when the new dates conflict', () => {
    const { stays, updateStay } = useOwnerStays()
    stays.value = [
      activeStay(),
      activeStay({ id: 'ost-other', checkIn: '2026-09-25', checkOut: '2026-09-27' }),
    ]

    const result = updateStay('ost-existing', { checkIn: '2026-09-26', checkOut: '2026-09-28' })

    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'conflict' }))
    expect(stays.value.find(stay => stay.id === 'ost-existing')?.checkIn).toBe('2026-09-20')
  })

  it('starts an independent three-target sync operation for update and retries each failed target', () => {
    const { stays, retrySync, updateStay } = useOwnerStays()
    stays.value = [activeStay({
      ownerId: 'own-update-sync',
      syncState: { cockpit: 'synced', channex: 'failed', notifications: 'pending' },
    })]

    const result = updateStay('ost-existing', {
      guestName: 'Updated with sync failures',
      syncFailureTargets: ['cockpit', 'notifications'],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stay.status).toBe('active')
      expect(result.stay.syncState).toEqual({
        cockpit: 'failed',
        channex: 'synced',
        notifications: 'failed',
      })
      expect(retrySync(result.stay.id, 'cockpit')).toEqual({ ok: true })
      expect(retrySync(result.stay.id, 'notifications')).toEqual({ ok: true })
      expect(stays.value.find(stay => stay.id === result.stay.id)?.syncState).toEqual({
        cockpit: 'synced',
        channex: 'synced',
        notifications: 'synced',
      })
    }
    expect(notificationsMock.callLog).toContainEqual(expect.objectContaining({
      type: 'OWNER_STAY_CONFIRMED',
      severity: 'INFO',
      context: expect.objectContaining({ modified: true }),
    }))
  })

  it('preserves the stay and exposes retry when one downstream sync fails', () => {
    const { createStay, retrySync, stays } = useOwnerStays()
    const result = createStay({
      ownerId: 'own-sync',
      listingId: 'lst-sync',
      guestName: 'Sync failure guest',
      checkIn: '2026-10-01',
      checkOut: '2026-10-03',
      syncFailureTargets: ['channex'],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stay.syncState).toEqual({ cockpit: 'synced', channex: 'failed', notifications: 'synced' })
      expect(result.stay.status).toBe('active')
      expect(retrySync(result.stay.id, 'channex')).toEqual({ ok: true })
      expect(stays.value.find(stay => stay.id === result.stay.id)?.syncState.channex).toBe('synced')
    }
  })

  it('cancels a stay, releases its dates, and records cancellation details', () => {
    const { stays, cancelStay, detectConflicts } = useOwnerStays()
    stays.value = [activeStay({
      ownerId: 'own-cancel',
      syncState: { cockpit: 'pending', channex: 'failed', notifications: 'failed' },
    })]

    const result = cancelStay('ost-existing', 'Plans changed')

    expect(result).toEqual({ ok: true })
    expect(stays.value[0]).toEqual(expect.objectContaining({
      status: 'cancelled',
      cancellationReason: 'Plans changed',
      syncState: { cockpit: 'synced', channex: 'synced', notifications: 'synced' },
    }))
    expect(detectConflicts({
      listingId: 'lst-conflicts',
      checkIn: '2026-09-20',
      checkOut: '2026-09-22',
    })).toHaveLength(0)
  })

  it('preserves a cancelled stay when independent cancellation sync targets fail and supports retry', () => {
    const { cancelStay, retrySync, stays } = useOwnerStays()
    stays.value = [activeStay({
      ownerId: 'own-cancel-sync',
      syncState: { cockpit: 'failed', channex: 'pending', notifications: 'synced' },
    })]

    const result = cancelStay('ost-existing', 'Owner cancelled', {
      syncFailureTargets: ['cockpit', 'notifications'],
    })

    expect(result).toEqual({ ok: true })
    expect(stays.value[0]).toEqual(expect.objectContaining({
      id: 'ost-existing',
      status: 'cancelled',
      cancellationReason: 'Owner cancelled',
      syncState: {
        cockpit: 'failed',
        channex: 'synced',
        notifications: 'failed',
      },
    }))

    expect(retrySync('ost-existing', 'cockpit')).toEqual({ ok: true })
    expect(retrySync('ost-existing', 'notifications')).toEqual({ ok: true })
    expect(stays.value[0]?.status).toBe('cancelled')
    expect(stays.value[0]?.syncState).toEqual({
      cockpit: 'synced',
      channex: 'synced',
      notifications: 'synced',
    })
  })

  describe('flow 7 — cancellation (no approval required)', () => {
    it('cancels immediately regardless of how close the check-in is', () => {
      const { stays, cancelStay } = useOwnerStays()
      // Today is 2026-08-19 in the fixture environment; a check-in 1 day out
      // used to sit inside the 72h management window.
      const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const soonOut = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().slice(0, 10)
      stays.value = [activeStay({
        id: 'ost-soon',
        checkIn: soon,
        checkOut: soonOut,
        listingId: 'lst-conflicts',
      })]

      const result = cancelStay('ost-soon', 'Family emergency')

      expect(result).toEqual({ ok: true })
      const stay = stays.value.find(s => s.id === 'ost-soon')
      expect(stay?.status).toBe('cancelled')
      expect(stay?.cancellationReason).toBe('Family emergency')
      expect(stay?.cancelRequest).toBeUndefined()
      // Alert fired — immediate cancellation, no approval flag.
      expect(notificationsMock.callLog.some(call =>
        call.type === 'OWNER_STAY_CANCELLED' && call.context.requiresApproval === false)).toBe(true)
    })

    it('keeps approve/deny helpers harmless when no cancel request exists', () => {
      const { stays, cancelStay, approveCancelRequest, denyCancelRequest } = useOwnerStays()
      const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const soonOut = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().slice(0, 10)
      stays.value = [activeStay({
        id: 'ost-soon',
        checkIn: soon,
        checkOut: soonOut,
        listingId: 'lst-conflicts',
      })]

      cancelStay('ost-soon', 'Family emergency')
      // The stay is already cancelled directly — no pending request exists.
      expect(approveCancelRequest('ost-soon', 'staff-1')).toEqual({ ok: false, reason: 'no_cancel_request' })
      expect(denyCancelRequest('ost-soon', 'staff-1')).toEqual({ ok: false, reason: 'no_cancel_request' })
      expect(stays.value.find(s => s.id === 'ost-soon')?.status).toBe('cancelled')
    })
  })
})
