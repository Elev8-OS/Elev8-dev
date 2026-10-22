import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import { formatMoney } from '~/components/cockpit/data/cockpit'
import { alterationChanges, declineReasonsFor, needsAnswer, requestTimeLeft } from '~/components/reservations/data/channel-requests'
import { initialReservations } from '~/components/reservations/data/reservations'

describe('channel requests', () => {
  it('offers channel-only decline reasons on that channel only', () => {
    const airbnb = declineReasonsFor('Airbnb').map(r => r.value)
    const booking = declineReasonsFor('Booking.com').map(r => r.value)
    expect(airbnb).toContain('better_reservation')
    expect(airbnb).not.toContain('details_incomplete')
    expect(booking).toEqual(expect.arrayContaining(['details_incomplete', 'outside_checkin_hours']))
    expect(booking).not.toContain('better_reservation')
  })

  it('counts down to the request expiry', () => {
    const now = new Date('2026-10-22T09:00:00')
    expect(requestTimeLeft('2026-10-23T03:30:00', now)).toEqual({ expired: false, label: 'Answer within 18 h' })
    expect(requestTimeLeft('2026-10-22T09:40:00', now).label).toBe('Answer within 40 min')
    expect(requestTimeLeft('2026-10-22T08:00:00', now)).toEqual({ expired: true, label: 'Expired' })
  })

  it('lists only what an alteration changes', () => {
    const r = initialReservations.find(x => x.id === 'res-1')! as ReservationEntry
    expect(needsAnswer(r)).toBe(true)
    expect(alterationChanges(r, formatMoney)).toEqual([
      { key: 'guests', label: 'Guests', from: '2', to: '3' },
      { key: 'total', label: 'Total', from: 'USD 750.00', to: 'USD 810.00' },
    ])
  })

  it('seeds one request to book', () => {
    const requests = initialReservations.filter(r => r.status === 'request')
    expect(requests).toHaveLength(1)
    expect(needsAnswer(requests[0]!)).toBe(true)
  })
})
