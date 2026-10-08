// The extend flow end to end: money, the OTA linked booking, and what follows
// the new check-out (cleaning, door codes, the guest's message).

import type { ReservationEntry, ReservationRoomLine } from '~/components/reservations/data/reservations'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useInbox } from '~/composables/useInbox'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useSmartLock } from '~/composables/useSmartLock'
import { PAYMENT_LINK_TOKEN, SAVED_CARD_CHARGE_MS, useStayExtension } from '~/composables/useStayExtension'
// extendReservation reassesses damage protection through a fire-and-forget
// import(); loaded up front so it never resolves after the environment is torn down.
import '~/composables/useDamageProtection'

function stay(over: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    ...initialReservations[0]!,
    id: 'res-x',
    channel: 'Direct',
    listingId: 'lst-1',
    listingName: 'Villa Test',
    guestName: 'Ana Lima',
    guestEmail: 'ana@example.com',
    checkIn: '2030-03-01',
    checkOut: '2030-03-04',
    nights: 3,
    totalPrice: 600,
    currency: 'USD',
    status: 'verified',
    rooms: undefined,
    priceDetails: { subtotal: 600, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 600, commission: 0, payout: 600 },
    cleaningSchedule: undefined,
    damageProtection: undefined,
    cityTaxSettlement: undefined,
    extensions: undefined,
    activity: [],
    ...over,
  }
}

function room(over: Partial<ReservationRoomLine> = {}): ReservationRoomLine {
  return { id: 'line-1', unitTypeId: 'ut-1', unitId: 'unit-a', unitName: 'Room A', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 300, ...over }
}

function seed(...entries: ReservationEntry[]) {
  useReservationsModule().reservations.value = entries
}

function find(id = 'res-x') {
  return useReservationsModule().reservations.value.find(r => r.id === id)!
}

beforeEach(() => {
  useCleaningJobs().jobs.value = []
  useSmartLock().codes.value = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('payment', () => {
  it('leaves guestPaid alone until a pending extension is marked paid', async () => {
    seed(stay())
    const ext = useStayExtension()
    const result = await ext.confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-06', payment: { method: 'at_property' } })
    expect(result.success).toBe(true)
    expect(find().priceDetails!.guestPaid).toBe(600)
    expect(find().priceDetails!.payout).toBe(1000)
    expect(find().extensions![0]!.paymentStatus).toBe('pending')

    expect(ext.markExtensionPaid('res-x', result.extensionId!)).toBe(true)
    expect(find().priceDetails!.guestPaid).toBe(1000)
    expect(find().extensions![0]!.paymentStatus).toBe('paid')
    expect(ext.markExtensionPaid('res-x', result.extensionId!)).toBe(false)
  })

  it('creates a payment link, puts it in the guest message, and closes it when paid', async () => {
    seed(stay())
    const ext = useStayExtension()
    const result = await ext.confirmExtension({
      reservationId: 'res-x',
      checkOut: '2030-03-05',
      payment: { method: 'payment_link', feeMode: 'no_fee' },
      guestMessage: `Pay here: ${PAYMENT_LINK_TOKEN}`,
    })
    const request = usePaymentRequests().requests.value.find(r => r.id === result.paymentRequestId)!
    expect(request).toMatchObject({ amount: 200, currency: 'USD', status: 'pending', title: 'Stay extension · res-x' })
    expect(result.guestNotified).toBe(true)

    const conversation = useInbox().conversations.value.find(c => c.reservationId === 'res-x')!
    expect(useInbox().messages.value[conversation.id]!.at(-1)!.content).toBe(`Pay here: ${request.paymentLink}`)

    ext.markExtensionPaid('res-x', result.extensionId!)
    expect(usePaymentRequests().requests.value.find(r => r.id === request.id)!.status).toBe('paid')
  })

  it('charges a saved card and counts the nights as paid', async () => {
    vi.useFakeTimers()
    seed(stay({ damageProtection: { card: { provider: 'stripe', paymentMethodId: 'pm_1', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2031, savedAt: '2030-01-01' } } as ReservationEntry['damageProtection'] }))
    const pending = useStayExtension().confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-05', payment: { method: 'saved_card' } })
    await vi.advanceTimersByTimeAsync(SAVED_CARD_CHARGE_MS)
    expect((await pending).success).toBe(true)
    expect(find().priceDetails!.guestPaid).toBe(800)
    expect(find().extensions![0]).toMatchObject({ paymentMethod: 'saved_card', paymentStatus: 'paid' })
  })

  it('refuses a saved-card charge when no card is on file, without touching the stay', async () => {
    seed(stay())
    const result = await useStayExtension().confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-05', payment: { method: 'saved_card' } })
    expect(result.success).toBe(false)
    expect(find().checkOut).toBe('2030-03-04')
  })
})

describe('oTA stay', () => {
  it('books the added nights as a linked direct booking and leaves the OTA booking alone', async () => {
    seed(stay({ channel: 'Airbnb', rooms: [room(), room({ id: 'line-2', unitId: 'unit-b', priceMode: 'per_stay', pricePerStay: 50, lineTotal: 50 })] }))
    const result = await useStayExtension().confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-06', payment: { method: 'already_paid' } })
    expect(result.success).toBe(true)
    expect(find()).toMatchObject({ checkOut: '2030-03-04', nights: 3, totalPrice: 600 })

    const linked = find(result.linkedReservationId!)
    expect(linked).toMatchObject({ channel: 'Direct', extensionOf: 'res-x', checkIn: '2030-03-04', checkOut: '2030-03-06', nights: 2, totalPrice: 200 })
    // Only the per-night room carries over; the flat-rate one was paid on the OTA booking.
    expect(linked.rooms).toHaveLength(1)
    expect(linked.rooms![0]!.lineTotal).toBe(200)
    expect(linked.priceDetails!.guestPaid).toBe(200)
  })

  it('chains a second extension from the linked booking, which never blocks its own stay', async () => {
    seed(stay({ channel: 'Booking.com' }))
    const { confirmExtension, preview } = useStayExtension()
    await confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-06', payment: { method: 'at_property' } })
    const view = preview(find(), '2030-03-08')
    expect(view.from).toBe('2030-03-06')
    expect(view.conflicts).toHaveLength(0)
    expect(view.quote.extraNights).toBe(2)

    const second = await confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-08', payment: { method: 'at_property' } })
    expect(find(second.linkedReservationId!)).toMatchObject({ checkIn: '2030-03-06', checkOut: '2030-03-08' })
    expect(find().extensions).toHaveLength(2)
  })
})

describe('operations', () => {
  function checkoutJob(over: Record<string, unknown> = {}) {
    return { id: 'cln-1', listingId: 'lst-1', listingName: 'Villa Test', scheduledAt: '2030-03-04T11:00:00+08:00', status: 'scheduled', source: 'checkout', reservationId: 'res-x', cleanerIds: [], cleanerNames: [], ...over } as never
  }

  it('moves the check-out cleaning and extends door codes ending on the old check-out', async () => {
    seed(stay())
    useCleaningJobs().jobs.value = [checkoutJob(), checkoutJob({ id: 'cln-done', status: 'done' })]
    useSmartLock().codes.value = [
      { id: 'code-1', lockId: 'lock-1', code: '123456', startsAt: '2030-03-01T06:00:00.000Z', endsAt: '2030-03-04T03:00:00.000Z', reservationId: 'res-x', status: 'active', providerCodeId: 'p1', scheduleType: 'range' },
      { id: 'code-2', lockId: 'lock-1', code: '999999', startsAt: '2030-03-01T06:00:00.000Z', endsAt: '2099-12-31T23:59:59.000Z', reservationId: 'res-x', status: 'active', providerCodeId: 'p2', scheduleType: 'ongoing' },
    ]
    const view = useStayExtension().preview(find(), '2030-03-06')
    expect(view).toMatchObject({ cleaningsToMove: 1, codesToExtend: 1 })

    const result = await useStayExtension().confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-06', payment: { method: 'already_paid' } })
    expect(result).toMatchObject({ cleaningsMoved: 1, codesExtended: 1 })
    const jobs = useCleaningJobs().jobs.value
    expect(jobs.find(j => j.id === 'cln-1')!.scheduledAt).toBe('2030-03-06T11:00:00+08:00')
    expect(jobs.find(j => j.id === 'cln-done')!.scheduledAt).toBe('2030-03-04T11:00:00+08:00')
    const codes = useSmartLock().codes.value
    expect(codes.find(c => c.id === 'code-1')!.endsAt).toBe('2030-03-06T03:00:00.000Z')
    expect(codes.find(c => c.id === 'code-2')!.endsAt).toBe('2099-12-31T23:59:59.000Z')
  })

  it('hands an OTA stay\'s check-out cleaning to the linked booking', async () => {
    seed(stay({ channel: 'Airbnb' }))
    useCleaningJobs().jobs.value = [checkoutJob()]
    const result = await useStayExtension().confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-05', payment: { method: 'already_paid' } })
    const job = useCleaningJobs().jobs.value.find(j => j.id === 'cln-1')!
    expect(job.reservationId).toBe(result.linkedReservationId)
    expect(job.scheduledAt).toBe('2030-03-05T11:00:00+08:00')
  })

  it('sends nothing when the message is blank', async () => {
    seed(stay())
    const result = await useStayExtension().confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-05', payment: { method: 'already_paid' }, guestMessage: '  ' })
    expect(result.guestNotified).toBe(false)
    expect(useInbox().conversations.value.some(c => c.reservationId === 'res-x')).toBe(false)
  })
})

describe('status', () => {
  async function extended() {
    seed(stay({ channel: 'Airbnb' }))
    const result = await useStayExtension().confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-06', payment: { method: 'already_paid' } })
    return result.linkedReservationId!
  }

  it('creates the extension with the stay\'s status', async () => {
    seed(stay({ channel: 'Airbnb', status: 'checked_in' }))
    const result = await useStayExtension().confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-06', payment: { method: 'already_paid' } })
    expect(find(result.linkedReservationId!).status).toBe('checked_in')
  })

  it('moves the extension with its stay, and the stay with its extension', async () => {
    const childId = await extended()
    const { updateReservationStatus } = useReservationsModule()
    expect(updateReservationStatus('res-x', 'checked_in')).toEqual(['res-x', childId])
    expect(find(childId).status).toBe('checked_in')
    expect(find(childId).activity.at(-1)?.description).toBe('Set to Checked in with res-x')

    updateReservationStatus(childId, 'checked_out')
    expect(find().status).toBe('checked_out')
  })

  it('cancels only the extension when the extension is cancelled, and never revives it', async () => {
    const childId = await extended()
    const { updateReservationStatus } = useReservationsModule()
    expect(updateReservationStatus(childId, 'cancelled')).toEqual([childId])
    expect(find().status).toBe('verified')

    updateReservationStatus('res-x', 'checked_in')
    expect(find(childId).status).toBe('cancelled')
  })

  it('cancels the extension along with its stay', async () => {
    const childId = await extended()
    useReservationsModule().updateReservationStatus('res-x', 'cancelled')
    expect(find(childId).status).toBe('cancelled')
  })
})

describe('extension filter', () => {
  it('lists extended stays with their linked bookings, and narrows to unpaid ones', async () => {
    seed(stay({ channel: 'Airbnb' }), stay({ id: 'res-paid', channel: 'Direct', listingId: 'lst-2' }), stay({ id: 'res-plain', listingId: 'lst-3' }))
    const { confirmExtension } = useStayExtension()
    const pending = await confirmExtension({ reservationId: 'res-x', checkOut: '2030-03-06', payment: { method: 'at_property' } })
    await confirmExtension({ reservationId: 'res-paid', checkOut: '2030-03-05', payment: { method: 'already_paid' } })

    const { filters, filteredReservations } = useReservationsModule()
    const ids = () => filteredReservations.value.map(r => r.id).sort()

    filters.value = { ...filters.value, extension: 'extended' }
    expect(ids()).toEqual([pending.linkedReservationId!, 'res-paid', 'res-x'].sort())

    filters.value = { ...filters.value, extension: 'unpaid' }
    expect(ids()).toEqual([pending.linkedReservationId!, 'res-x'].sort())

    filters.value = { ...filters.value, extension: 'all' }
    expect(ids()).toHaveLength(4)
  })
})
