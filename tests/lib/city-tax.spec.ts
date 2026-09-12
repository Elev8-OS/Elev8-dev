import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import {
  chargeableGuestCount,
  chargeableNights,
  collectorFor,
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
