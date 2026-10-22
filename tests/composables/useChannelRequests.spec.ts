import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOKING_SYNC_DELAY_MS, CHANNEL_ANSWER_DELAY_MS, useChannelRequests } from '~/composables/useChannelRequests'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

async function settle<T>(promise: Promise<T>, ms = CHANNEL_ANSWER_DELAY_MS) {
  await vi.advanceTimersByTimeAsync(ms)
  return promise
}

const find = (id: string) => useReservationsModule().reservations.value.find(r => r.id === id)!

describe('useChannelRequests', () => {
  it('lists the request first, then the alteration', () => {
    expect(useChannelRequests().pending.value.map(r => r.id)).toEqual(['res-req-1', 'res-1'])
  })

  it('accepting a request makes it an unverified reservation and logs it', async () => {
    const { acceptRequest, pending } = useChannelRequests()
    expect(await settle(acceptRequest('res-req-1'))).toEqual({ ok: true })
    const r = find('res-req-1')
    expect(r.status).toBe('unverified')
    expect(r.requestExpiresAt).toBeUndefined()
    expect(r.activity.at(-1)!.title).toBe('Request accepted')
    expect(pending.value.map(x => x.id)).toEqual(['res-1'])
    expect((await acceptRequest('res-req-1')).ok).toBe(false)
  })

  it('declining needs a reason and cancels with it', async () => {
    const { declineRequest } = useChannelRequests()
    expect(await declineRequest('res-req-1', '')).toEqual({ ok: false, error: 'Pick a reason. The channel asks for one.' })
    expect(await settle(declineRequest('res-req-1', 'better_reservation'))).toEqual({ ok: true })
    const r = find('res-req-1')
    expect(r.status).toBe('cancelled')
    expect(r.activity.at(-1)!.description).toBe('Reason sent to Airbnb: Waiting for a better reservation.')
  })

  it('refuses to accept a request whose dates another stay now holds', async () => {
    const { reservations, updateReservation } = useReservationsModule()
    const req = find('res-req-1')
    const other = reservations.value.find(r => r.id !== req.id && r.status === 'verified')!
    updateReservation(other.id, { listingId: req.listingId, checkIn: req.checkIn, checkOut: req.checkOut })
    const result = await useChannelRequests().acceptRequest('res-req-1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain(other.guestName)
    expect(find('res-req-1').status).toBe('request')
  })

  it('accepting an alteration rewrites the stay; declining leaves it', async () => {
    const { acceptAlteration, declineAlteration } = useChannelRequests()
    expect(await settle(acceptAlteration('res-1'))).toEqual({ ok: true })
    const r = find('res-1')
    expect(r).toMatchObject({ guestCount: 3, totalPrice: 810, alteration: undefined })

    useReservationsModule().updateReservation('res-1', { alteration: { id: 'a2', channelAlterationId: 'X', requestedAt: '', checkIn: r.checkIn, checkOut: r.checkOut, guestCount: 5, totalPrice: 900 } })
    await settle(declineAlteration('res-1'))
    expect(find('res-1')).toMatchObject({ guestCount: 3, totalPrice: 810, alteration: undefined })
  })

  it('sync brings in one new request once, with an alert in the bell', async () => {
    const { syncBookings, pending } = useChannelRequests()
    expect(await settle(syncBookings(), BOOKING_SYNC_DELAY_MS)).toBe(1)
    expect(pending.value.filter(r => r.status === 'request')).toHaveLength(2)
    expect(useNotifications().alerts.value[0]!.type).toBe('BOOKING_REQUEST_RECEIVED')
    expect(await settle(syncBookings(), BOOKING_SYNC_DELAY_MS)).toBe(0)
  })
})
