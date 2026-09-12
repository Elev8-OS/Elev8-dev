import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  chargeableGuestCount,
  chargeableNights,
  collectorFor,
  computeCityTaxLine,
  isWithinApplicableRange,
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
