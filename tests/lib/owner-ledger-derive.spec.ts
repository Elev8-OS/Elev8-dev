// Deriving owner ledger rows from real reservations.
//
// The gap this closes: an owner created through the UI had no rows in
// `mockOwnerLedgerEntries`, so statement generation found nothing and drew
// nothing, without ever saying so.

import type { OwnerLedgerEntry } from '~/components/owners/data/owner-ledger'
import type { LedgerSourceReservation } from '~/components/owners/data/owner-ledger-derive'
import type { OwnerPropertyMapping } from '~/components/owners/data/owners'
import { describe, expect, it } from 'vitest'
import {
  channelToLedgerSource,
  deriveLedgerEntry,
  deriveMissingLedgerEntries,
  isLedgerRevenue,
  nightsInPeriod,
  reservationMoney,
  revenuePeriodOf,
  revenuePeriodsForListing,
} from '~/components/owners/data/owner-ledger-derive'

const NOW = '2026-10-01T00:00:00.000Z'

function reservation(over: Partial<LedgerSourceReservation> = {}): LedgerSourceReservation {
  return {
    id: 'r-1',
    listingId: 'lst-1',
    checkIn: '2026-07-10',
    checkOut: '2026-07-15',
    nights: 5,
    currency: 'IDR',
    channel: 'Airbnb',
    status: 'checked_out',
    totalPrice: 10_000_000,
    guestName: 'Guest One',
    priceDetails: {
      subtotal: 9_000_000,
      cleaningFee: 500_000,
      serviceFee: 0,
      tax: 450_000,
      extras: 50_000,
      guestPaid: 10_000_000,
      commission: 600_000,
      payout: 9_400_000,
    },
    ...over,
  }
}

function mapping(over: Partial<OwnerPropertyMapping> = {}): OwnerPropertyMapping {
  return {
    id: 'opm-x',
    ownerId: 'own-x',
    listingId: 'lst-1',
    ownershipPercentage: 50,
    commissionRuleId: 'cr-x',
    effectiveFrom: '2026-01-01',
    ...over,
  }
}

describe('what counts as revenue', () => {
  it('excludes an owner stay even though its status looks like a booking', () => {
    // The trap: owner stays are seeded as `unverified` reservations carrying
    // `blockReason: 'Owner stay'` and `totalPrice: 0`. A status-only filter
    // lets them through and bills the owner for their own holiday.
    const ownerStay = reservation({
      status: 'unverified',
      blockReason: 'Owner stay',
      totalPrice: 0,
      priceDetails: undefined,
    })
    expect(isLedgerRevenue(ownerStay)).toBe(false)
  })

  it('excludes every calendar block, whatever the reason reads', () => {
    expect(isLedgerRevenue(reservation({ blockReason: 'Maintenance' }))).toBe(false)
    expect(isLedgerRevenue(reservation({ blockReason: 'Owner stay — cancelled', status: 'cancelled' }))).toBe(false)
  })

  it('excludes statuses that earned nothing', () => {
    for (const status of ['cancelled', 'blocked', 'owner_request', 'inquiry'])
      expect(isLedgerRevenue(reservation({ status }))).toBe(false)
  })

  it('includes a booked or completed guest stay', () => {
    for (const status of ['unverified', 'verified', 'checked_in', 'checked_out'])
      expect(isLedgerRevenue(reservation({ status }))).toBe(true)
  })
})

describe('period and money', () => {
  it('dates revenue by check-out, matching the DATEV export', () => {
    // A stay running 28 Jun to 3 Jul is July revenue in both places, so an
    // owner statement and the tenant's tax file agree on the month.
    expect(revenuePeriodOf(reservation({ checkIn: '2026-06-28', checkOut: '2026-07-03' }))).toBe('2026-07')
  })

  it('counts the whole guest payment as gross, leaving tax and commission to be deducted later', () => {
    // A statement subtracts tax and commission further down, so netting them
    // here would deduct them twice.
    const money = reservationMoney(reservation())
    expect(money.gross).toBe(10_000_000)
    expect(money.tax).toBe(450_000)
    expect(money.platformFee).toBe(600_000)
  })

  it('reports a zero split rather than guessing when there is no price breakdown', () => {
    const money = reservationMoney(reservation({ priceDetails: undefined, totalPrice: 4_000_000 }))
    expect(money).toEqual({ gross: 4_000_000, tax: 0, platformFee: 0 })
  })

  it('knows how many nights a month has', () => {
    expect(nightsInPeriod('2026-02')).toBe(28)
    expect(nightsInPeriod('2026-07')).toBe(31)
    expect(nightsInPeriod('2026-06')).toBe(30)
  })

  it('maps booking channels onto the ledger vocabulary', () => {
    expect(channelToLedgerSource('Airbnb')).toBe('airbnb')
    expect(channelToLedgerSource('Booking.com')).toBe('booking_com')
    expect(channelToLedgerSource('Direct')).toBe('direct')
    expect(channelToLedgerSource('Something New')).toBe('direct')
  })
})

describe('deriveLedgerEntry', () => {
  it('rolls a period up from its reservations', () => {
    const result = deriveLedgerEntry({
      ownerId: 'own-x',
      mapping: mapping(),
      period: '2026-07',
      now: NOW,
      reservations: [
        reservation({ id: 'r-1', checkOut: '2026-07-15', nights: 5 }),
        reservation({ id: 'r-2', checkOut: '2026-07-25', nights: 4, channel: 'Direct' }),
      ],
    })
    const entry = result.entry!
    expect(entry.grossRevenue).toBe(20_000_000)
    expect(entry.taxes).toBe(900_000)
    expect(entry.platformFees).toBe(1_200_000)
    expect(entry.reservationCount).toBe(2)
    expect(entry.occupiedNights).toBe(9)
    expect(entry.availableNights).toBe(31)
    expect(entry.sources.map(s => s.source).sort()).toEqual(['airbnb', 'direct'])
    expect(entry.sources.reduce((sum, s) => sum + s.revenue, 0)).toBe(entry.grossRevenue)
  })

  it('carries the listing total, NOT the owner share', () => {
    // The seed convention: both co-owners of lst-3 carry the same 110,000,000
    // and `useOwnerDashboard` applies ownershipPercentage on top. Pre-scaling
    // here would be halved a second time downstream.
    const result = deriveLedgerEntry({
      ownerId: 'own-x',
      mapping: mapping({ ownershipPercentage: 50 }),
      period: '2026-07',
      now: NOW,
      reservations: [reservation()],
    })
    expect(result.entry!.grossRevenue).toBe(10_000_000)
  })

  it('reports no operating expenses rather than estimating one', () => {
    // Nothing in the app records a per-reservation cleaning or running cost.
    const result = deriveLedgerEntry({
      ownerId: 'own-x',
      mapping: mapping(),
      period: '2026-07',
      now: NOW,
      reservations: [reservation()],
    })
    expect(result.entry!.expenses).toBe(0)
  })

  it('returns nothing for a period with no qualifying stay', () => {
    const result = deriveLedgerEntry({
      ownerId: 'own-x',
      mapping: mapping(),
      period: '2026-07',
      now: NOW,
      reservations: [reservation({ status: 'cancelled' })],
    })
    expect(result.entry).toBeNull()
  })

  it('never blends currencies, and names the ones it left out', () => {
    const result = deriveLedgerEntry({
      ownerId: 'own-x',
      mapping: mapping(),
      period: '2026-07',
      now: NOW,
      reservations: [
        reservation({ id: 'r-1', currency: 'IDR' }),
        reservation({ id: 'r-2', currency: 'IDR' }),
        reservation({ id: 'r-3', currency: 'USD', totalPrice: 700, priceDetails: undefined }),
      ],
    })
    expect(result.entry!.currency).toBe('IDR')
    expect(result.entry!.grossRevenue).toBe(20_000_000)
    expect(result.skippedCurrencies).toEqual(['USD'])
  })

  it('caps occupancy at the length of the month', () => {
    // A stay is billed in its check-out month, so its nights can start before
    // that month began. Occupancy must stay a percentage.
    const result = deriveLedgerEntry({
      ownerId: 'own-x',
      mapping: mapping(),
      period: '2026-02',
      now: NOW,
      reservations: [reservation({ checkIn: '2026-01-05', checkOut: '2026-02-20', nights: 46 })],
    })
    expect(result.entry!.occupiedNights).toBe(28)
    expect(result.entry!.availableNights).toBe(28)
  })

  it('lists later stays as upcoming', () => {
    const result = deriveLedgerEntry({
      ownerId: 'own-x',
      mapping: mapping(),
      period: '2026-07',
      now: NOW,
      reservations: [
        reservation({ id: 'r-1', checkOut: '2026-07-15' }),
        reservation({ id: 'r-2', checkIn: '2026-08-10', checkOut: '2026-08-14' }),
      ],
    })
    expect(result.entry!.upcomingReservations.map(u => u.id)).toEqual(['r-2'])
  })

  it('leaves ratings at zero rather than inventing a score', () => {
    const result = deriveLedgerEntry({
      ownerId: 'own-x',
      mapping: mapping(),
      period: '2026-07',
      now: NOW,
      reservations: [reservation()],
    })
    expect(result.entry!.averageRating).toBe(0)
    expect(result.entry!.ratingsCount).toBe(0)
  })
})

describe('deriveMissingLedgerEntries', () => {
  const seeded: OwnerLedgerEntry[] = [{
    id: 'led-seed',
    ownerId: 'own-x',
    listingId: 'lst-1',
    period: '2026-07',
    currency: 'IDR',
    grossRevenue: 999,
    expenses: 0,
    taxes: 0,
    platformFees: 0,
    sources: [],
    occupiedNights: 1,
    availableNights: 31,
    nightlyRateSum: 999,
    reservationCount: 1,
    averageRating: 5,
    ratingsCount: 1,
    upcomingReservations: [],
    isPriorPeriodAdjustment: false,
    createdAt: NOW,
    updatedAt: NOW,
  }]

  it('never replaces a seeded row', () => {
    // The portal's demo figures, and the tests pinned to them, are built on
    // the fixture; recomputing those periods would move them.
    const derived = deriveMissingLedgerEntries({
      mappings: [mapping()],
      reservations: [reservation({ checkOut: '2026-07-15' })],
      seeded,
      now: NOW,
    })
    expect(derived).toHaveLength(0)
  })

  it('fills a period the fixture does not cover', () => {
    const derived = deriveMissingLedgerEntries({
      mappings: [mapping()],
      reservations: [reservation({ checkIn: '2026-09-01', checkOut: '2026-09-06' })],
      seeded,
      now: NOW,
    })
    expect(derived).toHaveLength(1)
    expect(derived[0]!.period).toBe('2026-09')
    expect(derived[0]!.ownerId).toBe('own-x')
  })

  it('does not pay an owner for revenue earned before they took the property on', () => {
    const derived = deriveMissingLedgerEntries({
      mappings: [mapping({ effectiveFrom: '2026-08-01' })],
      reservations: [reservation({ checkIn: '2026-06-01', checkOut: '2026-06-05' })],
      seeded: [],
      now: NOW,
    })
    expect(derived).toHaveLength(0)
  })

  it('stops at the end of a closed mapping', () => {
    const derived = deriveMissingLedgerEntries({
      mappings: [mapping({ effectiveTo: '2026-06-30' })],
      reservations: [reservation({ checkIn: '2026-09-01', checkOut: '2026-09-06' })],
      seeded: [],
      now: NOW,
    })
    expect(derived).toHaveLength(0)
  })

  it('gives each co-owner their own row for the same listing', () => {
    const derived = deriveMissingLedgerEntries({
      mappings: [
        mapping({ id: 'opm-a', ownerId: 'own-a' }),
        mapping({ id: 'opm-b', ownerId: 'own-b' }),
      ],
      reservations: [reservation({ checkIn: '2026-09-01', checkOut: '2026-09-06' })],
      seeded: [],
      now: NOW,
    })
    expect(derived.map(e => e.ownerId).sort()).toEqual(['own-a', 'own-b'])
    // Both carry the listing total; the share is applied downstream.
    expect(new Set(derived.map(e => e.grossRevenue))).toEqual(new Set([10_000_000]))
  })

  it('lists the periods a listing actually earned in', () => {
    const periods = revenuePeriodsForListing([
      reservation({ id: 'r-1', checkOut: '2026-07-15' }),
      reservation({ id: 'r-2', checkOut: '2026-09-15' }),
      reservation({ id: 'r-3', checkOut: '2026-08-15', status: 'cancelled' }),
      reservation({ id: 'r-4', checkOut: '2026-08-20', listingId: 'lst-other' }),
    ], 'lst-1')
    expect(periods).toEqual(['2026-07', '2026-09'])
  })
})
