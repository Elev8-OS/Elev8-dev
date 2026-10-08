// Gross / net / owner net on the Analytics page. Pinned: channel fees, the
// owner commission reusing the statements' `calculateCommission`, co-owner
// shares, net-basis rules, months a stay crosses, and that the breakdown adds up.

import type { AnalyticsBooking, AnalyticsUnit } from '~/components/analytics/data/analytics'
import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type { OwnerPropertyMapping } from '~/components/owners/data/owners'
import { describe, expect, it } from 'vitest'
import { channelMix, periodPerformance } from '~/components/analytics/data/analytics'
import { buildCommissionRates, makeValuer, netFactor, revenueBreakdown } from '~/components/analytics/data/revenue-basis'

function booking(over: Partial<AnalyticsBooking> = {}): AnalyticsBooking {
  return {
    id: 'b1',
    listingId: 'l1',
    channel: 'Airbnb',
    currency: 'USD',
    bookedOn: '2026-08-01',
    checkIn: '2026-09-10',
    checkOut: '2026-09-14',
    nights: 4,
    guests: 2,
    nightlyRate: 100,
    leadDays: 40,
    country: 'AU',
    ...over,
  }
}

const unit: AnalyticsUnit = { listingId: 'l1', listingName: 'Villa', location: 'Ubud, Bali', region: 'Bali', tags: [], currency: 'USD', nightlyRate: 100, capacity: 4, lifecycle: 'active' }
const SEPT = { start: '2026-09-01', end: '2026-09-30' }

function mapping(over: Partial<OwnerPropertyMapping> = {}): OwnerPropertyMapping {
  return { id: 'm1', ownerId: 'o1', listingId: 'l1', ownershipPercentage: 100, commissionRuleId: 'r1', effectiveFrom: '2026-01-01', ...over }
}

const flat20: CommissionRule = { id: 'r1', ownerId: 'o1', listingId: 'l1', type: 'flat', rate: 20, basis: 'gross', effectiveFrom: '2026-01-01' } as CommissionRule

describe('net', () => {
  it('takes the OTA commission off OTA stays and card fees off direct ones', () => {
    expect(netFactor('Airbnb')).toBeCloseTo(0.85)
    expect(netFactor('Booking.com')).toBeCloseTo(0.85)
    expect(netFactor('Direct')).toBeCloseTo(0.971)
    const net = makeValuer('net')
    expect(net(booking(), SEPT)).toBeCloseTo(340)
    expect(net(booking({ channel: 'Direct' }), SEPT)).toBeCloseTo(388.4)
  })

  it('values revenue, ADR and RevPAR on the chosen basis; occupancy stays the same', () => {
    const gross = periodPerformance([booking()], [unit], SEPT, 'USD')
    const net = periodPerformance([booking()], [unit], SEPT, 'USD', makeValuer('net'))
    expect(gross.revenue).toBe(400)
    expect(net.revenue).toBeCloseTo(340)
    expect(net.adr).toBeCloseTo(85)
    expect(net.revpar).toBeCloseTo(340 / 30)
    expect(net.occupancy).toBe(gross.occupancy)
  })

  it('values the channel mix on the basis too', () => {
    const mix = channelMix([booking()], 'USD', makeValuer('net'))
    expect(mix[0]!.revenue).toBeCloseTo(340)
  })
})

describe('owner net', () => {
  it('applies a flat gross rule as a share of each night', () => {
    const rates = buildCommissionRates([booking()], [mapping()], [flat20])
    expect(rates.get('l1|2026-09')).toBeCloseTo(0.2)
    // 400 gross, 60 OTA fee, 80 management commission.
    expect(makeValuer('owner_net', rates)(booking(), SEPT)).toBeCloseTo(260)
  })

  it('charges a net-basis rule on gross minus platform fees', () => {
    const onNet = { ...flat20, basis: 'net' } as CommissionRule
    const rates = buildCommissionRates([booking()], [mapping()], [onNet])
    // 20% of (400 - 60) = 68, as a share of 400 gross.
    expect(rates.get('l1|2026-09')).toBeCloseTo(68 / 400)
  })

  it('charges each co-owner on their share, and nothing on a share nobody holds', () => {
    const half = [mapping({ ownershipPercentage: 50 })]
    const rates = buildCommissionRates([booking()], half, [flat20])
    expect(rates.get('l1|2026-09')).toBeCloseTo(0.1)
  })

  it('leaves a listing without an owner contract at net', () => {
    const rates = buildCommissionRates([booking({ listingId: 'free' })], [mapping()], [flat20])
    expect(rates.has('free|2026-09')).toBe(false)
    expect(makeValuer('owner_net', rates)(booking({ listingId: 'free' }), SEPT)).toBeCloseTo(340)
  })

  it('reads the rule in effect for each month a stay crosses', () => {
    const stay = booking({ checkIn: '2026-09-29', checkOut: '2026-10-03', nights: 4 })
    const rules = [flat20, { ...flat20, id: 'r2', rate: 10, effectiveFrom: '2026-10-01' } as CommissionRule]
    const rates = buildCommissionRates([stay], [mapping()], rules)
    expect(rates.get('l1|2026-09')).toBeCloseTo(0.2)
    expect(rates.get('l1|2026-10')).toBeCloseTo(0.1)
    // Two nights at 0.85 - 0.2, two at 0.85 - 0.1.
    expect(makeValuer('owner_net', rates)(stay, { start: '2026-09-01', end: '2026-10-31' })).toBeCloseTo(200 * 0.65 + 200 * 0.75)
  })

  it('ignores cancelled stays when working out the month', () => {
    const rates = buildCommissionRates([booking({ cancelledOn: '2026-09-01' })], [mapping()], [flat20])
    expect(rates.size).toBe(0)
  })
})

describe('revenueBreakdown', () => {
  it('adds up from gross to owner net, in one currency', () => {
    const rows = [booking(), booking({ id: 'b2', channel: 'Direct' }), booking({ id: 'b3', currency: 'EUR' })]
    const rates = buildCommissionRates(rows, [mapping()], [flat20])
    const b = revenueBreakdown(rows, SEPT, 'USD', rates)
    expect(b.gross).toBe(800)
    expect(b.gross - b.otaCommission - b.paymentFees).toBeCloseTo(b.net)
    expect(b.net - b.managementCommission).toBeCloseTo(b.ownerNet)
    expect(b.otaCommission).toBeCloseTo(60)
    expect(b.paymentFees).toBeCloseTo(11.6)
  })
})
