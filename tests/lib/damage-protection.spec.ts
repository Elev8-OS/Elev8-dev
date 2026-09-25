import type { DamageProtectionAssignment, DamageProtectionPolicy } from '~/components/reservations/data/damage-protection'
import type { DamageProtection, ProtectionClaim, ReservationEntry, SavedCard } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  assignmentForStay,
  buildOptions,
  canSettle,
  cardBrand,
  cardInputError,
  chargeableTotal,
  chargeMandateText,
  claimCoverage,
  claimEvidenceSummary,
  depositAmount,
  elev8FeeFor,
  formatSavedCard,
  hostCoverProtection,
  isChoiceValid,
  isClaimValid,
  isGuestStay,
  isLongStay,
  overlappingBands,
  passesLuhn,
  protectionActivityEvent,
  protectionOffered,
  remainingCover,
  resolveBucket,
  roundProtectionAmount,
  savedCardFrom,
  settleDueAt,
  settleOutcome,
  waiverAmount,
  waiverCover,
  waiverPotTotal,
} from '~/components/reservations/data/damage-protection'
import { recommendedTier, TERN_PRODUCTS, ternPriceFor, tierTooSmall } from '~/components/reservations/data/tern-products'

// Dates are relative to today on purpose: the decision deadline is evaluated
// against the current day, so a fixed fixture rots.
function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return localDay(d)
}

const CARD: SavedCard = {
  provider: 'stripe',
  paymentMethodId: 'pm_mock_4242',
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: 2028,
  savedAt: '2026-09-01T00:00:00.000Z',
}

function policy(patch: Partial<DamageProtectionPolicy> = {}): DamageProtectionPolicy {
  return {
    id: 'dp-1',
    name: 'Standard',
    currency: 'USD',
    offers: ['waiver', 'deposit'],
    waiver: { tier: 'bronze', guestPrice: 39 },
    deposit: { pricing: 'flat', rate: 500, settleWithinDays: 7 },
    channelPolicy: { Direct: 'offer' },
    termsVersion: 'v1',
    termsText: 'Terms',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

function stay(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    nights: 5,
    checkIn: isoDay(10),
    checkOut: isoDay(15),
    status: 'verified',
    channel: 'Direct',
    priceDetails: { subtotal: 1000, cleaningFee: 300, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1300, commission: 0, payout: 1300 },
    ...patch,
  } as ReservationEntry
}

function protection(patch: Partial<DamageProtection> = {}): DamageProtection {
  return {
    policyId: 'dp-1',
    option: 'deposit',
    state: 'card_on_file',
    amount: 500,
    currency: 'USD',
    termsVersion: 'v1',
    termsText: 'Terms',
    acceptedAt: new Date().toISOString(),
    acceptedVia: 'guest_guide',
    card: CARD,
    claims: [],
    ...patch,
  }
}

function claim(patch: Partial<ProtectionClaim> = {}): ProtectionClaim {
  return {
    id: 'clm-1',
    label: 'Broken lamp',
    amount: 80,
    coveredAmount: 80,
    excessAmount: 0,
    reason: 'Found at checkout inspection',
    evidenceUrls: ['/mock/lamp.jpg'],
    recordedBy: 'Komang Juliantara',
    recordedAt: new Date().toISOString(),
    guestNotifiedAt: new Date().toISOString(),
    ...patch,
  }
}

describe('protectionOffered', () => {
  it('covers every channel once the waiver is on, whatever the channel switches say', () => {
    const skipsEverything = policy({ channelPolicy: { Direct: 'skip', Airbnb: 'skip' } })
    for (const channel of ['Direct', 'Airbnb', 'Booking.com'] as const)
      expect(protectionOffered(skipsEverything, channel), channel).toBe(true)
  })

  it('lets a deposit-only policy pick its channels, falling back to skip', () => {
    const depositOnly = policy({ offers: ['deposit'], channelPolicy: { Direct: 'offer', Airbnb: 'skip' } })
    expect(protectionOffered(depositOnly, 'Direct')).toBe(true)
    expect(protectionOffered(depositOnly, 'Airbnb')).toBe(false)
    expect(protectionOffered(depositOnly, 'Booking.com')).toBe(false)
  })

  it('never offers without a policy or without options', () => {
    expect(protectionOffered(null, 'Direct')).toBe(false)
    expect(protectionOffered(policy({ offers: [] }), 'Direct')).toBe(false)
  })
})

describe('isGuestStay', () => {
  it('excludes owner stays, blocks and cancellations', () => {
    expect(isGuestStay('owner_request')).toBe(false)
    expect(isGuestStay('blocked')).toBe(false)
    expect(isGuestStay('cancelled')).toBe(false)
  })

  it('includes the five real guest statuses', () => {
    for (const status of ['inquiry', 'unverified', 'verified', 'checked_in', 'checked_out'] as const)
      expect(isGuestStay(status)).toBe(true)
  })
})

describe('pricing', () => {
  it('charges the guest the tenant\'s own per-stay price, and a flat deposit', () => {
    expect(waiverAmount(policy())).toBe(39)
    expect(depositAmount(policy(), stay())).toBe(500)
  })

  it('charges the guest nothing where the host pays', () => {
    expect(waiverAmount(policy(), 'host')).toBe(0)
  })

  it('reads the cover and the Elev8 fee off the Tern tier, never off the policy', () => {
    const bronze = ternPriceFor('bronze', 'USD')!
    expect(waiverCover(policy())).toEqual(bronze)
    expect(elev8FeeFor(policy())).toBe(bronze.perStayFee)
    expect(waiverCover(policy({ waiver: { tier: 'gold', guestPrice: 39 } }))?.coverageCap)
      .toBe(ternPriceFor('gold', 'USD')!.coverageCap)
  })

  it('has no cover in a currency Tern does not price, rather than converting', () => {
    expect(waiverCover(policy({ currency: 'IDR' }))).toBeNull()
    expect(elev8FeeFor(policy({ currency: 'IDR' }))).toBeNull()
  })

  it('reads percent from the subtotal, never the grand total', () => {
    const p = policy({ deposit: { pricing: 'percent_of_subtotal', rate: 20, settleWithinDays: 7 } })
    // subtotal 1000, cleaningFee 300. 20% of the subtotal is 200, not 260.
    expect(depositAmount(p, stay())).toBe(200)
  })

  it('returns zero rather than NaN without priceDetails', () => {
    const p = policy({ deposit: { pricing: 'percent_of_subtotal', rate: 20, settleWithinDays: 7 } })
    expect(depositAmount(p, stay({ priceDetails: undefined }))).toBe(0)
  })

  it('caps a percent deposit', () => {
    const p = policy({ deposit: { pricing: 'percent_of_subtotal', rate: 20, maxAmount: 750, settleWithinDays: 7 } })
    expect(depositAmount(p, stay({ priceDetails: { ...stay().priceDetails!, subtotal: 9000 } }))).toBe(750)
  })

  it('keeps the waiver price the same for any stay length', () => {
    expect(buildOptions(policy(), stay({ nights: 90 }), 'card')[0]!.amount).toBe(39)
  })
})

describe('tern products', () => {
  it('sizes the tier to the property by guest count', () => {
    expect(recommendedTier(2)).toBe('bronze')
    expect(recommendedTier(4)).toBe('bronze')
    expect(recommendedTier(6)).toBe('silver')
    expect(recommendedTier(9)).toBe('gold')
    expect(recommendedTier(40)).toBe('gold')
  })

  it('flags a tier smaller than the property calls for, never a bigger one', () => {
    expect(tierTooSmall('bronze', 6)).toBe(true)
    expect(tierTooSmall('silver', 6)).toBe(false)
    expect(tierTooSmall('gold', 2)).toBe(false)
  })

  it('names wear and tear among the exclusions of every tier', () => {
    for (const product of TERN_PRODUCTS)
      expect(product.exclusions.some(e => /wear and tear/i.test(e)), product.tier).toBe(true)
  })
})

describe('hostCoverProtection', () => {
  it('covers the stay without charging the guest, freezing the tier and the Elev8 fee', () => {
    const cover = hostCoverProtection(policy({ waiver: { tier: 'silver', guestPrice: 39 } }))!
    const silver = ternPriceFor('silver', 'USD')!
    expect(cover).toMatchObject({
      option: 'waiver',
      state: 'waiver_active',
      amount: 0,
      paidBy: 'host',
      tier: 'silver',
      coverageCap: silver.coverageCap,
      elev8Fee: silver.perStayFee,
      acceptedVia: 'host_cover',
    })
  })

  it('writes nothing for a deposit-only policy or a currency Tern does not price', () => {
    expect(hostCoverProtection(policy({ offers: ['deposit'] }))).toBeNull()
    expect(hostCoverProtection(policy({ currency: 'IDR' }))).toBeNull()
  })

  it('owes nothing back when a host-paid stay is cancelled', () => {
    const cover = hostCoverProtection(policy())!
    expect(resolveBucket(cover, { status: 'cancelled', checkOut: isoDay(10) })).toBe('settled')
    expect(resolveBucket({ ...cover, paidBy: 'guest', amount: 39 }, { status: 'cancelled', checkOut: isoDay(10) })).toBe('refund_due')
  })
})

describe('roundProtectionAmount', () => {
  it('rounds IDR whole and USD to cents', () => {
    expect(roundProtectionAmount(1234.56, 'IDR')).toBe(1235)
    expect(roundProtectionAmount(39.005, 'USD')).toBe(39.01)
  })
})

describe('bands', () => {
  const assignments: DamageProtectionAssignment[] = [
    { listingId: 'lst-1', policyId: 'dp-short', minNights: 1, maxNights: 27 },
    { listingId: 'lst-1', policyId: 'dp-long', minNights: 28, maxNights: null },
  ]

  it('picks the band covering the stay', () => {
    expect(assignmentForStay(assignments, 'lst-1', 7)?.policyId).toBe('dp-short')
    expect(assignmentForStay(assignments, 'lst-1', 30)?.policyId).toBe('dp-long')
    expect(assignmentForStay(assignments, 'lst-1', 365)?.policyId).toBe('dp-long')
  })

  it('returns null when no band covers the stay or the listing', () => {
    expect(assignmentForStay([{ listingId: 'lst-1', policyId: 'x', minNights: 5, maxNights: 9 }], 'lst-1', 2)).toBeNull()
    expect(assignmentForStay(assignments, 'lst-9', 7)).toBeNull()
  })

  it('treats adjacent bands as non-overlapping and true overlaps as overlapping', () => {
    expect(overlappingBands(assignments, 'lst-1')).toBe(false)
    expect(overlappingBands([
      { listingId: 'lst-1', policyId: 'a', minNights: 1, maxNights: 30 },
      { listingId: 'lst-1', policyId: 'b', minNights: 28, maxNights: null },
    ], 'lst-1')).toBe(true)
  })

  it('never collides bands across listings', () => {
    expect(overlappingBands([
      { listingId: 'lst-1', policyId: 'a', minNights: 1, maxNights: null },
      { listingId: 'lst-2', policyId: 'b', minNights: 1, maxNights: null },
    ], 'lst-1')).toBe(false)
  })

  it('marks 28 nights as a long stay', () => {
    expect(isLongStay(27)).toBe(false)
    expect(isLongStay(28)).toBe(true)
  })
})

describe('dates', () => {
  it('sets the decision deadline to check-out plus the settle window', () => {
    const due = new Date(settleDueAt(stay({ checkOut: isoDay(15) }), policy()))
    expect(localDay(due)).toBe(isoDay(22))
  })
})

describe('buildOptions', () => {
  it('lists the waiver first and pre-selects it, whatever order the policy names them in', () => {
    const views = buildOptions(policy({ offers: ['deposit', 'waiver'] }), stay(), 'card')
    expect(views.map(v => v.option)).toEqual(['waiver', 'deposit'])
    expect(views.map(v => v.isDefault)).toEqual([true, false])
  })

  it('gives the waiver a cap and exclusions, and the deposit its settle window', () => {
    const [waiver, deposit] = buildOptions(policy(), stay(), 'card')
    expect(waiver!.coverageCap).toBe(ternPriceFor('bronze', 'USD')!.coverageCap)
    expect(waiver!.exclusions).toEqual(TERN_PRODUCTS[0]!.exclusions)
    expect(waiver!.settleWithinDays).toBeUndefined()
    expect(deposit!.coverageCap).toBeUndefined()
    expect(deposit!.settleWithinDays).toBe(7)
  })

  it('offers the waiver only where a card cannot be saved', () => {
    expect(buildOptions(policy(), stay(), 'non_card').map(v => v.option)).toEqual(['waiver'])
    expect(buildOptions(policy({ offers: ['deposit'] }), stay(), 'non_card')).toEqual([])
  })

  it('makes a deposit the default only when it is the sole option', () => {
    const [only] = buildOptions(policy({ offers: ['deposit'] }), stay(), 'card')
    expect(only).toMatchObject({ option: 'deposit', isDefault: true })
  })
})

describe('chargeMandateText', () => {
  it('states the ceiling, that it is only for damage, only after telling the guest, and the deadline', () => {
    const text = chargeMandateText(500, 'USD', 7)
    expect(text).toContain('up to USD 500.00')
    expect(text).toContain('only for damage recorded during my stay')
    expect(text).toContain('only after I have been told')
    expect(text).toContain('no later than 7 days after check-out')
  })
})

describe('totals', () => {
  it('reports what the card is to be charged and no waiver pot', () => {
    const p = protection({ claims: [claim({ coveredAmount: 80 }), claim({ id: 'clm-2', coveredAmount: 20 })] })
    expect(chargeableTotal(p)).toBe(100)
    expect(waiverPotTotal(p)).toBe(0)
    expect(remainingCover(p)).toBe(400)
  })

  it('reports a waiver pot and nothing to charge', () => {
    const p = protection({ option: 'waiver', state: 'waiver_active', amount: 39, coverageCap: 2000, claims: [claim({ coveredAmount: 300 })] })
    expect(waiverPotTotal(p)).toBe(300)
    expect(chargeableTotal(p)).toBe(0)
    expect(remainingCover(p)).toBe(0)
  })

  it('never returns negative cover', () => {
    const p = protection({ claims: [claim({ coveredAmount: 900 })] })
    expect(remainingCover(p)).toBe(0)
  })
})

describe('claimCoverage', () => {
  it('covers damage inside the headroom with no excess', () => {
    expect(claimCoverage(protection(), 120)).toEqual({ coveredAmount: 120, excessAmount: 0 })
  })

  it('splits damage beyond the most the card may be charged', () => {
    expect(claimCoverage(protection(), 800)).toEqual({ coveredAmount: 500, excessAmount: 300 })
  })

  it('gives a second claim only the headroom the first one left', () => {
    const p = protection({ claims: [claim({ coveredAmount: 450 })] })
    expect(claimCoverage(p, 200)).toEqual({ coveredAmount: 50, excessAmount: 150 })
  })

  it('measures a waiver against the cap minus what the pot already paid', () => {
    const p = protection({ option: 'waiver', state: 'waiver_active', amount: 39, coverageCap: 2000, claims: [claim({ coveredAmount: 1800 })] })
    expect(claimCoverage(p, 500)).toEqual({ coveredAmount: 200, excessAmount: 300 })
  })
})

describe('resolveBucket', () => {
  const upcoming = { status: 'verified' as const, checkOut: isoDay(5) }
  const departed = { status: 'checked_out' as const, checkOut: isoDay(-1) }

  it('reports not_offered without a protection', () => {
    expect(resolveBucket(undefined, upcoming)).toBe('not_offered')
  })

  it('reads awaiting_choice, the declined charge and every closed state', () => {
    expect(resolveBucket(protection({ state: 'awaiting_choice' }), upcoming)).toBe('awaiting_choice')
    expect(resolveBucket(protection({ state: 'charge_failed' }), departed)).toBe('failed')
    for (const state of ['waiver_active', 'deposit_released', 'deposit_charged', 'cancelled'] as const)
      expect(resolveBucket(protection({ state }), departed), state).toBe('settled')
  })

  it('leaves a saved card alone until check-out', () => {
    expect(resolveBucket(protection(), upcoming)).toBe('on_file')
  })

  it('asks for a decision from check-out, and flags it overdue past the promised date', () => {
    const due = new Date(Date.now() + 3 * 86400000).toISOString()
    const passed = new Date(Date.now() - 86400000).toISOString()
    expect(resolveBucket(protection({ settleDueAt: due }), departed)).toBe('decision_due')
    expect(resolveBucket(protection({ settleDueAt: passed }), departed)).toBe('decision_overdue')
  })

  it('treats check-out day itself as the start of the decision', () => {
    expect(resolveBucket(protection(), { status: 'checked_out', checkOut: isoDay(0) })).toBe('decision_due')
  })

  it('releases a cancelled stay\'s card, or refunds its waiver fee, straight away', () => {
    const cancelled = { status: 'cancelled' as const, checkOut: isoDay(90) }
    expect(resolveBucket(protection(), cancelled)).toBe('decision_due')
    expect(resolveBucket(protection({ option: 'waiver', state: 'waiver_active' }), cancelled)).toBe('refund_due')
    expect(resolveBucket(protection({ state: 'cancelled' }), cancelled)).toBe('settled')
  })
})

describe('isChoiceValid', () => {
  const deposit = { option: 'deposit' as const, termsAccepted: true, card: CARD, chargeConsent: true }

  it('rejects unaccepted terms and an option the policy does not offer', () => {
    expect(isChoiceValid({ option: 'waiver', termsAccepted: false }, policy(), 'card', stay())).toBe(false)
    expect(isChoiceValid(deposit, policy({ offers: ['waiver'] }), 'card', stay())).toBe(false)
  })

  it('accepts a waiver on any rail', () => {
    expect(isChoiceValid({ option: 'waiver', termsAccepted: true }, policy(), 'non_card', stay())).toBe(true)
  })

  it('needs a saved card and consent to a later charge for a deposit', () => {
    expect(isChoiceValid(deposit, policy(), 'card', stay())).toBe(true)
    expect(isChoiceValid({ ...deposit, card: undefined }, policy(), 'card', stay())).toBe(false)
    expect(isChoiceValid({ ...deposit, chargeConsent: false }, policy(), 'card', stay())).toBe(false)
  })

  it('refuses a deposit where a card cannot be saved, even with one', () => {
    expect(isChoiceValid(deposit, policy(), 'non_card', stay())).toBe(false)
  })
})

describe('the card form', () => {
  const inAYear = `12/${String((new Date().getFullYear() + 1) % 100).padStart(2, '0')}`

  it('checks the number with Luhn, so a transposed digit is caught', () => {
    expect(passesLuhn('4242 4242 4242 4242')).toBe(true)
    expect(passesLuhn('4242 4242 4242 4224')).toBe(false)
  })

  it('names the brand from the number', () => {
    expect(cardBrand('4242424242424242')).toBe('visa')
    expect(cardBrand('5555555555554444')).toBe('mastercard')
    expect(cardBrand('378282246310005')).toBe('amex')
  })

  it('says what is wrong with the card as typed', () => {
    const ok = { number: '4242 4242 4242 4242', expiry: inAYear, cvc: '123' }
    expect(cardInputError(ok)).toBeNull()
    expect(cardInputError({ ...ok, number: '4242 4242 4242 4241' })).toBe('Check the card number.')
    expect(cardInputError({ ...ok, expiry: '13/30' })).toBe('Enter the expiry as MM/YY.')
    expect(cardInputError({ ...ok, expiry: '01/20' })).toBe('This card has expired.')
    expect(cardInputError({ ...ok, cvc: '12' })).toBe('Enter the 3 or 4 digit security code.')
  })

  it('treats a card as valid through the last day of its expiry month', () => {
    const now = new Date(2027, 5, 30, 12)
    expect(cardInputError({ number: '4242424242424242', expiry: '06/27', cvc: '123' }, now)).toBeNull()
  })

  it('keeps nothing of the card but a reference and the last four digits', () => {
    const card = savedCardFrom({ number: '4242 4242 4242 4242', expiry: '12/28', cvc: '123' }, 'pm_test_1')
    expect(card).toMatchObject({ provider: 'stripe', paymentMethodId: 'pm_test_1', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 })
    expect(JSON.stringify(card)).not.toContain('42424242')
    expect(JSON.stringify(card)).not.toContain('123')
  })

  it('prints a saved card the way a receipt would', () => {
    expect(formatSavedCard(CARD)).toBe('Visa •••• 4242, expires 12/28')
  })
})

const REPORT = {
  cleaningJobId: 'cln-x',
  findingId: 'cln-x:problem:b-1',
  finding: 'Cracked shower screen',
  checklistItem: 'Clean shower',
  photoUrls: ['/p/screen.jpg'],
  cleaningLabel: 'Check-out cleaning',
  reportedBy: 'Made Surya',
  reportedAt: '2026-09-20T05:30:00.000Z',
}

describe('isClaimValid', () => {
  const base = { label: 'Lamp', amount: 80, reason: 'Broken', evidenceUrls: ['/a.jpg'] }

  it('rejects a blank label, blank reason, no evidence and a zero amount', () => {
    expect(isClaimValid({ ...base, label: ' ' })).toBe(false)
    expect(isClaimValid({ ...base, reason: ' ' })).toBe(false)
    expect(isClaimValid({ ...base, evidenceUrls: [] })).toBe(false)
    expect(isClaimValid({ ...base, amount: 0 })).toBe(false)
  })

  it('accepts an amount beyond the remaining cover, because the excess is reported', () => {
    expect(isClaimValid({ ...base, amount: 99999 })).toBe(true)
  })

  it('accepts a cleaning report in place of an upload, and both together', () => {
    expect(isClaimValid({ ...base, evidenceUrls: [], cleaningReport: REPORT })).toBe(true)
    expect(isClaimValid({ ...base, cleaningReport: REPORT })).toBe(true)
  })
})

describe('claimEvidenceSummary', () => {
  it('names the cleaning report, the file count, or both', () => {
    expect(claimEvidenceSummary({ evidenceUrls: ['/a.jpg'] })).toBe('1 file')
    expect(claimEvidenceSummary({ evidenceUrls: ['/a.jpg', '/b.pdf'] })).toBe('2 files')
    expect(claimEvidenceSummary({ evidenceUrls: [], cleaningReport: { ...REPORT, photoUrls: [] } }))
      .toMatch(/^check-out cleaning report of \d{1,2} Sept? 2026$/)
    expect(claimEvidenceSummary({ evidenceUrls: ['/a.jpg'], cleaningReport: REPORT }))
      .toMatch(/^check-out cleaning report of .+ with 1 photo, 1 file$/)
  })

  it('counts the photos a reported problem carried', () => {
    expect(claimEvidenceSummary({ evidenceUrls: [], cleaningReport: { ...REPORT, photoUrls: ['/a.jpg', '/b.jpg'] } }))
      .toMatch(/^check-out cleaning report of .+ 2026 with 2 photos$/)
  })

  it('is empty when nothing backs the claim', () => {
    expect(claimEvidenceSummary({ evidenceUrls: [] })).toBe('')
  })
})

describe('canSettle', () => {
  it('refuses a waiver and a deposit with no card on file', () => {
    expect(canSettle(protection({ option: 'waiver', state: 'waiver_active' }))).toEqual({ ok: false, reason: 'not_a_deposit' })
    expect(canSettle(protection({ state: 'deposit_charged' }))).toEqual({ ok: false, reason: 'nothing_on_file' })
  })

  it('refuses while any claim is unnotified and passes once every claim is notified', () => {
    const unnotified = protection({ claims: [claim({ guestNotifiedAt: undefined })] })
    expect(canSettle(unnotified)).toEqual({ ok: false, reason: 'claim_not_notified' })
    expect(canSettle(protection({ claims: [claim()] }))).toEqual({ ok: true })
  })

  it('lets a declined charge be tried again', () => {
    expect(canSettle(protection({ state: 'charge_failed', claims: [claim()] }))).toEqual({ ok: true })
  })
})

describe('settleOutcome', () => {
  it('closes with nothing to charge, and charges when a claim is covered', () => {
    expect(settleOutcome(protection({ claims: [] }))).toBe('deposit_released')
    expect(settleOutcome(protection({ claims: [claim({ coveredAmount: 80 })] }))).toBe('deposit_charged')
  })
})

describe('protectionActivityEvent', () => {
  it('builds an id from the same kind that chose the title', () => {
    for (const kind of ['chosen', 'claimed', 'notified', 'charged', 'charge_failed', 'released', 'cancelled', 'undone'] as const) {
      const event = protectionActivityEvent(kind, protection(), 'Komang')
      expect(event.id).toContain(kind)
      expect(event.title).toBeTruthy()
    }
  })
})
