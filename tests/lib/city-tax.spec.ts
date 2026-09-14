import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  chargeableGuestCount,
  chargeableNights,
  cityTaxActivityEvent,
  cityTaxAlertStage,
  cityTaxTotals,
  collectorFor,
  computeCityTaxLine,
  isWithinApplicableRange,
  resolveCityTax,
} from '~/components/reservations/data/city-tax'

function taxItem(patch: Partial<ListingFeeTaxItem> = {}): ListingFeeTaxItem {
  return {
    id: 'ft-city',
    title: 'Kurtaxe',
    type: 'city_tax',
    logic: 'per_person_per_night',
    rate: 3,
    currency: 'EUR',
    isInclusive: false,
    skipNights: null,
    maxNights: null,
    applicableDateRanges: [],
    ...patch,
  }
}

describe('collectorFor', () => {
  it('reads the configured collector for the channel', () => {
    const config = {
      channelPolicy: { 'Airbnb': 'channel' as const, 'Booking.com': 'host' as const },
      chargeableGuests: { adults: true, children: false, infants: false },
    }
    expect(collectorFor(config, 'Airbnb')).toBe('channel')
    expect(collectorFor(config, 'Booking.com')).toBe('host')
  })

  it('falls back to host for an unset channel, so nothing goes silently uncollected', () => {
    const config = {
      channelPolicy: { Airbnb: 'channel' as const },
      chargeableGuests: { adults: true, children: false, infants: false },
    }
    expect(collectorFor(config, 'Direct')).toBe('host')
  })

  it('falls back to host when there is no config at all', () => {
    expect(collectorFor(undefined, 'Airbnb')).toBe('host')
  })
})

describe('chargeableGuestCount', () => {
  const adultsOnly = { adults: true, children: false, infants: false }

  it('counts only the enabled categories', () => {
    const reservation = { guestCount: 5, guestAdults: 2, guestChildren: 2, guestInfants: 1 }
    expect(chargeableGuestCount(reservation, { channelPolicy: {}, chargeableGuests: adultsOnly })).toBe(2)
    expect(chargeableGuestCount(reservation, {
      channelPolicy: {},
      chargeableGuests: { adults: true, children: true, infants: false },
    })).toBe(4)
  })

  it('treats guestCount as adults when there is no breakdown', () => {
    expect(chargeableGuestCount({ guestCount: 3 }, { channelPolicy: {}, chargeableGuests: adultsOnly })).toBe(3)
  })

  it('charges nobody when the breakdown is absent and adults are exempt', () => {
    expect(chargeableGuestCount({ guestCount: 3 }, {
      channelPolicy: {},
      chargeableGuests: { adults: false, children: true, infants: false },
    })).toBe(0)
  })

  it('defaults to adults only when no config is given', () => {
    expect(chargeableGuestCount({ guestCount: 4, guestAdults: 2, guestChildren: 2 })).toBe(2)
  })
})

describe('chargeableNights', () => {
  it('returns every night when nothing is configured', () => {
    expect(chargeableNights(taxItem(), 5)).toBe(5)
  })

  it('drops the skipped nights', () => {
    expect(chargeableNights(taxItem({ skipNights: 2 }), 5)).toBe(3)
  })

  it('caps at maxNights', () => {
    expect(chargeableNights(taxItem({ maxNights: 3 }), 10)).toBe(3)
  })

  it('applies skip before the cap', () => {
    expect(chargeableNights(taxItem({ skipNights: 2, maxNights: 3 }), 10)).toBe(3)
  })

  it('clamps at zero rather than going negative', () => {
    expect(chargeableNights(taxItem({ skipNights: 7 }), 2)).toBe(0)
  })
})

describe('isWithinApplicableRange', () => {
  it('applies always when no range is configured', () => {
    expect(isWithinApplicableRange(taxItem(), '2026-09-12')).toBe(true)
  })

  it('applies inside the range, inclusive of both ends', () => {
    const item = taxItem({ applicableDateRanges: [{ after: '2026-06-01', before: '2026-09-30' }] })
    expect(isWithinApplicableRange(item, '2026-06-01')).toBe(true)
    expect(isWithinApplicableRange(item, '2026-09-30')).toBe(true)
    expect(isWithinApplicableRange(item, '2026-07-15')).toBe(true)
  })

  it('does not apply outside the range', () => {
    const item = taxItem({ applicableDateRanges: [{ after: '2026-06-01', before: '2026-09-30' }] })
    expect(isWithinApplicableRange(item, '2026-05-31')).toBe(false)
    expect(isWithinApplicableRange(item, '2026-10-01')).toBe(false)
  })

  it('applies when any one of several ranges matches', () => {
    const item = taxItem({ applicableDateRanges: [
      { after: '2026-01-01', before: '2026-02-28' },
      { after: '2026-06-01', before: '2026-09-30' },
    ] })
    expect(isWithinApplicableRange(item, '2026-01-15')).toBe(true)
    expect(isWithinApplicableRange(item, '2026-04-01')).toBe(false)
  })
})

function reservation(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    id: 'res-ct-1',
    guestId: 'guest-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestPhone: '+49 170 1234567',
    guestLanguage: 'de',
    guestNotes: '',
    listingId: 'lst-1',
    listingName: 'Villa Merapi',
    channel: 'Direct',
    checkIn: '2026-07-10',
    checkOut: '2026-07-14',
    nights: 4,
    guestCount: 2,
    guestAdults: 2,
    guestChildren: 0,
    guestInfants: 0,
    totalPrice: 1000,
    currency: 'EUR',
    status: 'verified',
    activity: [],
    ...patch,
  } as ReservationEntry
}

describe('computeCityTaxLine', () => {
  it('prices per person per night off the chargeable counts', () => {
    const line = computeCityTaxLine(taxItem({ rate: 3 }), reservation())
    expect(line?.amount).toBe(24) // 2 guests x 4 nights x 3
    expect(line?.chargeableGuests).toBe(2)
    expect(line?.chargeableNights).toBe(4)
  })

  it('prices per person, ignoring nights', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'per_person', rate: 5 }), reservation())?.amount).toBe(10)
  })

  it('prices per night', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'per_night', rate: 7 }), reservation())?.amount).toBe(28)
  })

  it('prices per booking as a flat amount', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'per_booking', rate: 15 }), reservation())?.amount).toBe(15)
  })

  it('multiplies per_room and per_room_per_night by the booked room lines', () => {
    const twoRooms = reservation({
      rooms: [
        { id: 'rl-1', unitTypeId: 'ut-1', unitId: 'u-1', unitName: 'Room 1', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 400 },
        { id: 'rl-2', unitTypeId: 'ut-1', unitId: 'u-2', unitName: 'Room 2', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 400 },
      ],
    } as Partial<ReservationEntry>)
    expect(computeCityTaxLine(taxItem({ logic: 'per_room', rate: 10 }), twoRooms)?.amount).toBe(20)
    expect(computeCityTaxLine(taxItem({ logic: 'per_room_per_night', rate: 10 }), twoRooms)?.amount).toBe(80)
  })

  it('counts one room when the booking has no room lines', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'per_room', rate: 10 }), reservation())?.amount).toBe(10)
  })

  it('charges a percentage on the accommodation subtotal, never the grand total', () => {
    const withPrice = reservation({
      totalPrice: 1300,
      priceDetails: { subtotal: 1000, cleaningFee: 150, serviceFee: 50, tax: 100, extras: 0, guestPaid: 1300, commission: 0, payout: 1300 },
    })
    // 5% of the 1000 subtotal, not of the 1300 the guest paid.
    expect(computeCityTaxLine(taxItem({ logic: 'percent', rate: 5, currency: undefined }), withPrice)?.amount).toBe(50)
  })

  it('charges nothing on a percentage when there is no price breakdown to charge it on', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'percent', rate: 5 }), reservation())?.amount).toBe(0)
  })

  it('prices a percentage in the reservation currency, ignoring the item currency', () => {
    const withPrice = reservation({
      currency: 'EUR',
      priceDetails: { subtotal: 1000, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1000, commission: 0, payout: 1000 },
    })
    expect(computeCityTaxLine(taxItem({ logic: 'percent', rate: 5, currency: 'USD' }), withPrice)?.currency).toBe('EUR')
  })

  it('keeps the item currency for a fixed-amount logic', () => {
    const line = computeCityTaxLine(taxItem({ currency: 'EUR' }), reservation({ currency: 'IDR' }))
    expect(line?.currency).toBe('EUR')
  })

  it('falls back to the reservation currency when the item sets none', () => {
    const line = computeCityTaxLine(taxItem({ currency: undefined }), reservation({ currency: 'IDR' }))
    expect(line?.currency).toBe('IDR')
  })

  it('applies skipNights to a per-night logic', () => {
    expect(computeCityTaxLine(taxItem({ rate: 3, skipNights: 1 }), reservation())?.amount).toBe(18)
  })

  it('leaves a night-independent logic alone when nights are skipped away', () => {
    // per_booking is a flat charge. skipNights describes nights, so it has
    // nothing to act on here, and the stay still owes the flat amount.
    expect(computeCityTaxLine(taxItem({ logic: 'per_booking', rate: 15, skipNights: 10 }), reservation())?.amount).toBe(15)
  })

  it('returns null for an item that is not a city tax', () => {
    expect(computeCityTaxLine(taxItem({ type: 'fee' }), reservation())).toBeNull()
  })

  it('returns null when the stay falls outside the applicable season', () => {
    const item = taxItem({ applicableDateRanges: [{ after: '2026-01-01', before: '2026-03-31' }] })
    expect(computeCityTaxLine(item, reservation())).toBeNull()
  })

  it('rounds to the currency minor unit', () => {
    const withPrice = reservation({
      priceDetails: { subtotal: 333.33, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 333.33, commission: 0, payout: 333.33 },
    })
    expect(computeCityTaxLine(taxItem({ logic: 'percent', rate: 7.5 }), withPrice)?.amount).toBe(25)
  })
})

const hostConfig = {
  channelPolicy: { 'Direct': 'host' as const, 'Booking.com': 'host' as const, 'Airbnb': 'channel' as const },
  chargeableGuests: { adults: true, children: false, infants: false },
}

describe('cityTaxTotals', () => {
  it('sums lines that share a currency into one entry', () => {
    const lines = [
      { taxItemId: 'a', taxTitle: 'A', logic: 'per_booking' as const, rate: 1, chargeableGuests: 0, chargeableNights: 0, rooms: 1, amount: 10, currency: 'EUR' },
      { taxItemId: 'b', taxTitle: 'B', logic: 'per_booking' as const, rate: 1, chargeableGuests: 0, chargeableNights: 0, rooms: 1, amount: 5.5, currency: 'EUR' },
    ]
    expect(cityTaxTotals(lines)).toEqual([{ currency: 'EUR', amount: 15.5 }])
  })

  it('never blends two currencies into one number', () => {
    const lines = [
      { taxItemId: 'a', taxTitle: 'A', logic: 'per_booking' as const, rate: 1, chargeableGuests: 0, chargeableNights: 0, rooms: 1, amount: 10, currency: 'EUR' },
      { taxItemId: 'b', taxTitle: 'B', logic: 'per_booking' as const, rate: 1, chargeableGuests: 0, chargeableNights: 0, rooms: 1, amount: 50000, currency: 'IDR' },
    ]
    expect(cityTaxTotals(lines)).toEqual([
      { currency: 'EUR', amount: 10 },
      { currency: 'IDR', amount: 50000 },
    ])
  })
})

describe('resolveCityTax', () => {
  it('is due when the host collects on this channel', () => {
    const assessment = resolveCityTax(reservation(), [taxItem({ cityTax: hostConfig })])
    expect(assessment.status).toBe('due')
    expect(assessment.collector).toBe('host')
    expect(assessment.totals).toEqual([{ currency: 'EUR', amount: 24 }])
    expect(assessment.lines).toHaveLength(1)
  })

  it('says the channel collects and shows no amount to take', () => {
    const assessment = resolveCityTax(reservation({ channel: 'Airbnb' }), [taxItem({ cityTax: hostConfig })])
    expect(assessment.status).toBe('channel_collects')
    expect(assessment.collector).toBe('channel')
    expect(assessment.totals).toEqual([])
    expect(assessment.lines).toEqual([])
  })

  it('is not required when the listing levies no city tax', () => {
    expect(resolveCityTax(reservation(), []).status).toBe('not_required')
    expect(resolveCityTax(reservation(), [taxItem({ type: 'fee' })]).status).toBe('not_required')
  })

  it('is not required when every channel is marked not applicable', () => {
    const config = { ...hostConfig, channelPolicy: { Direct: 'not_applicable' as const } }
    expect(resolveCityTax(reservation(), [taxItem({ cityTax: config })]).status).toBe('not_required')
  })

  it('is not required when the stay falls outside the tax season and nothing else applies', () => {
    const item = taxItem({ cityTax: hostConfig, applicableDateRanges: [{ after: '2026-01-01', before: '2026-02-01' }] })
    expect(resolveCityTax(reservation(), [item]).status).toBe('not_required')
  })

  it('is not required when the computed amount is zero', () => {
    const item = taxItem({ cityTax: hostConfig, rate: 0 })
    expect(resolveCityTax(reservation(), [item]).status).toBe('not_required')
  })

  it('sums several city taxes on one listing into separate lines', () => {
    const assessment = resolveCityTax(reservation(), [
      taxItem({ id: 'ft-a', title: 'Kurtaxe', rate: 3, cityTax: hostConfig }),
      taxItem({ id: 'ft-b', title: 'Tourism levy', logic: 'per_booking', rate: 10, cityTax: hostConfig }),
    ])
    expect(assessment.lines).toHaveLength(2)
    expect(assessment.totals).toEqual([{ currency: 'EUR', amount: 34 }])
  })

  it('reports a settled stay from its stored settlement, not the live amount', () => {
    const settled = reservation({
      cityTaxSettlement: {
        state: 'collected',
        totals: [{ currency: 'EUR', amount: 18 }],
        settledAt: '2026-07-10T09:00:00.000Z',
        settledBy: 'Komang Juliantara',
        method: 'cash',
      },
    })
    const assessment = resolveCityTax(settled, [taxItem({ cityTax: hostConfig })])
    expect(assessment.status).toBe('collected')
    expect(assessment.settlement?.totals).toEqual([{ currency: 'EUR', amount: 18 }])
    // The live rules still say 24. The settlement is what was actually taken.
    expect(assessment.totals).toEqual([{ currency: 'EUR', amount: 24 }])
  })

  it('reports a waived stay', () => {
    const waived = reservation({
      cityTaxSettlement: {
        state: 'waived',
        totals: [{ currency: 'EUR', amount: 24 }],
        settledAt: '2026-07-10T09:00:00.000Z',
        settledBy: 'Komang Juliantara',
        reason: 'Business traveller, exempt under local rule',
      },
    })
    expect(resolveCityTax(waived, [taxItem({ cityTax: hostConfig })]).status).toBe('waived')
  })

  it('owes nothing on a cancelled stay', () => {
    const cancelled = reservation({ status: 'cancelled' })
    expect(resolveCityTax(cancelled, [taxItem({ cityTax: hostConfig })]).status).toBe('not_required')
  })

  it('re-evaluates an untouched booking when the policy flips, because status is derived', () => {
    const stay = reservation({ channel: 'Booking.com' })
    const collecting = taxItem({ cityTax: hostConfig })
    expect(resolveCityTax(stay, [collecting]).status).toBe('due')

    const handedToChannel = taxItem({
      cityTax: { ...hostConfig, channelPolicy: { ...hostConfig.channelPolicy, 'Booking.com': 'channel' as const } },
    })
    expect(resolveCityTax(stay, [handedToChannel]).status).toBe('channel_collects')
  })
})

describe('cityTaxAlertStage', () => {
  const today = '2026-07-12'

  function dueAssessment() {
    return resolveCityTax(reservation(), [taxItem({ cityTax: hostConfig })])
  }

  it('is upcoming before arrival', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: '2026-07-20', checkOut: '2026-07-24' }, today)).toBe('upcoming')
  })

  it('is due on the arrival day itself', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: today, checkOut: '2026-07-16' }, today)).toBe('due_today')
  })

  it('stays due while the guest is still in house, because it is still collectable', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: '2026-07-10', checkOut: '2026-07-16' }, today)).toBe('due_today')
  })

  it('is overdue on the departure day, once the guest can walk out', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: '2026-07-08', checkOut: today }, today)).toBe('overdue')
  })

  it('is overdue after departure', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: '2026-07-01', checkOut: '2026-07-05' }, today)).toBe('overdue')
  })

  it('is silent for anything that is not due', () => {
    const settled = resolveCityTax(
      reservation({
        cityTaxSettlement: {
          state: 'collected',
          totals: [{ currency: 'EUR', amount: 24 }],
          settledAt: '2026-07-10T09:00:00.000Z',
          settledBy: 'Komang Juliantara',
          method: 'cash',
        },
      }),
      [taxItem({ cityTax: hostConfig })],
    )
    expect(cityTaxAlertStage(settled, { checkIn: '2026-07-01', checkOut: '2026-07-05' }, today)).toBeNull()

    const channel = resolveCityTax(reservation({ channel: 'Airbnb' }), [taxItem({ cityTax: hostConfig })])
    expect(cityTaxAlertStage(channel, { checkIn: '2026-07-01', checkOut: '2026-07-05' }, today)).toBeNull()
  })
})

describe('cityTaxActivityEvent', () => {
  const settlement = {
    state: 'collected' as const,
    totals: [{ currency: 'EUR', amount: 24 }],
    settledAt: '2026-07-12T09:30:00.000Z',
    settledBy: 'Komang Juliantara',
    method: 'cash' as const,
  }

  it('states the amount and the method', () => {
    const event = cityTaxActivityEvent('collected', settlement, 'Komang Juliantara', '2026-07-12T09:30:00.000Z')
    expect(event.title).toBe('City tax collected')
    expect(event.description).toContain('EUR 24.00')
    expect(event.description).toContain('Cash')
    expect(event.actor).toBe('Komang Juliantara')
    expect(event.type).toBe('reservation')
    expect(event.colorDot).toBe('green')
  })

  it('states the reason on a waive', () => {
    const waived = { ...settlement, state: 'waived' as const, method: undefined, reason: 'Business traveller' }
    const event = cityTaxActivityEvent('waived', waived, 'Komang Juliantara', '2026-07-12T09:30:00.000Z')
    expect(event.title).toBe('City tax waived')
    expect(event.description).toContain('Reason: Business traveller')
  })

  it('lists every currency on a multi-currency settlement', () => {
    const mixed = { ...settlement, totals: [{ currency: 'EUR', amount: 24 }, { currency: 'IDR', amount: 50000 }] }
    const event = cityTaxActivityEvent('collected', mixed, 'Komang Juliantara', '2026-07-12T09:30:00.000Z')
    expect(event.description).toContain('EUR 24.00')
    expect(event.description).toContain('IDR 50,000.00')
  })

  it('describes a reopen without a settlement to read from', () => {
    const event = cityTaxActivityEvent('reopened', null, 'Komang Juliantara', '2026-07-12T09:30:00.000Z')
    expect(event.title).toBe('City tax reopened')
    expect(event.colorDot).toBe('gold')
  })

  it('gives two settlements of the same kind different ids, so an undo and a re-collect both show', () => {
    const first = cityTaxActivityEvent('collected', settlement, 'A', '2026-07-12T09:30:00.000Z')
    const second = cityTaxActivityEvent('collected', settlement, 'A', '2026-07-12T11:00:00.000Z')
    expect(first.id).not.toBe(second.id)
  })
})
