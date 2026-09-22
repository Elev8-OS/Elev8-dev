import type { DamageProtectionAssignment, DamageProtectionPolicy } from '~/components/reservations/data/damage-protection'
import type { DamageProtection, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  assignmentForStay,
  buildOptions,
  canRelease,
  chargeDueAt,
  claimCoverage,
  deductionTotal,
  depositAmount,
  isChoiceValid,
  isClaimValid,
  isGuestStay,
  isLongStay,
  overlappingBands,
  protectionActivityEvent,
  protectionOffered,
  refundableAmount,
  refundDueAt,
  resolveBucket,
  roundProtectionAmount,
  settledStateFor,
  waiverAmount,
  waiverPotTotal,
} from '~/components/reservations/data/damage-protection'

// Dates are relative to today on purpose: charge and refund stages are
// evaluated against the current day, so a fixed fixture rots.
function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return localDay(d)
}

function policy(patch: Partial<DamageProtectionPolicy> = {}): DamageProtectionPolicy {
  return {
    id: 'dp-1',
    name: 'Standard',
    currency: 'USD',
    offers: ['waiver', 'deposit'],
    defaultOption: 'waiver',
    waiver: { pricing: 'flat', rate: 39, coverageCap: 2000, exclusions: ['Intentional damage'] },
    deposit: { pricing: 'flat', rate: 500, chargeLeadDays: 3, refundSlaDays: 7 },
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
    state: 'deposit_held',
    amount: 500,
    currency: 'USD',
    termsVersion: 'v1',
    termsText: 'Terms',
    acceptedAt: new Date().toISOString(),
    acceptedVia: 'guest_guide',
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
  it('falls back to skip for an unset channel', () => {
    expect(protectionOffered(policy(), 'Airbnb')).toBe(false)
  })

  it('offers only where the policy says offer', () => {
    expect(protectionOffered(policy(), 'Direct')).toBe(true)
    expect(protectionOffered(policy({ channelPolicy: { Direct: 'skip' } }), 'Direct')).toBe(false)
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
  it('prices a flat waiver and a flat deposit', () => {
    expect(waiverAmount(policy(), stay())).toBe(39)
    expect(depositAmount(policy(), stay())).toBe(500)
  })

  it('prices per night and handles a zero-night stay', () => {
    const p = policy({ waiver: { pricing: 'per_night', rate: 8, coverageCap: 2000, exclusions: [] } })
    expect(waiverAmount(p, stay({ nights: 5 }))).toBe(40)
    expect(waiverAmount(p, stay({ nights: 0 }))).toBe(0)
  })

  it('reads percent from the subtotal, never the grand total', () => {
    const p = policy({ deposit: { pricing: 'percent_of_subtotal', rate: 20, chargeLeadDays: 3, refundSlaDays: 7 } })
    // subtotal 1000, cleaningFee 300. 20% of the subtotal is 200, not 260.
    expect(depositAmount(p, stay())).toBe(200)
  })

  it('returns zero rather than NaN without priceDetails', () => {
    const p = policy({ deposit: { pricing: 'percent_of_subtotal', rate: 20, chargeLeadDays: 3, refundSlaDays: 7 } })
    expect(depositAmount(p, stay({ priceDetails: undefined }))).toBe(0)
  })

  it('caps a per-night waiver on a long stay', () => {
    const p = policy({ waiver: { pricing: 'per_night', rate: 39, maxAmount: 249, coverageCap: 5000, exclusions: [] } })
    expect(waiverAmount(p, stay({ nights: 90 }))).toBe(249)
  })

  it('caps a percent deposit', () => {
    const p = policy({ deposit: { pricing: 'percent_of_subtotal', rate: 20, maxAmount: 750, chargeLeadDays: 3, refundSlaDays: 7 } })
    expect(depositAmount(p, stay({ priceDetails: { ...stay().priceDetails!, subtotal: 9000 } }))).toBe(750)
  })

  it('leaves an uncapped figure alone', () => {
    const p = policy({ waiver: { pricing: 'per_night', rate: 10, coverageCap: 2000, exclusions: [] } })
    expect(waiverAmount(p, stay({ nights: 90 }))).toBe(900)
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
  it('charges three days before a future check-in', () => {
    const due = new Date(chargeDueAt(stay({ checkIn: isoDay(10) }), policy()))
    expect(localDay(due)).toBe(isoDay(7))
  })

  it('clamps to now when the lead window has passed', () => {
    const now = new Date()
    const due = new Date(chargeDueAt(stay({ checkIn: isoDay(1) }), policy(), now))
    expect(due.getTime()).toBe(now.getTime())
  })

  it('sets the refund due date to check-out plus the SLA', () => {
    const due = new Date(refundDueAt(stay({ checkOut: isoDay(15) }), policy()))
    expect(localDay(due)).toBe(isoDay(22))
  })
})

describe('buildOptions', () => {
  it('returns one view per offered option, in order, with one default', () => {
    const views = buildOptions(policy(), stay())
    expect(views.map(v => v.option)).toEqual(['waiver', 'deposit'])
    expect(views.filter(v => v.isDefault)).toHaveLength(1)
  })

  it('gives the waiver a cap and exclusions, and the deposit dates', () => {
    const [waiver, deposit] = buildOptions(policy(), stay())
    expect(waiver!.coverageCap).toBe(2000)
    expect(waiver!.exclusions).toEqual(['Intentional damage'])
    expect(waiver!.chargeDueAt).toBeUndefined()
    expect(deposit!.coverageCap).toBeUndefined()
    expect(deposit!.refundSlaDays).toBe(7)
    expect(deposit!.chargeDueAt).toBeDefined()
  })
})

describe('totals', () => {
  it('reports a deposit deduction and no waiver pot', () => {
    const p = protection({ claims: [claim({ coveredAmount: 80 }), claim({ id: 'clm-2', coveredAmount: 20 })] })
    expect(deductionTotal(p)).toBe(100)
    expect(waiverPotTotal(p)).toBe(0)
    expect(refundableAmount(p)).toBe(400)
  })

  it('reports a waiver pot and no deduction', () => {
    const p = protection({ option: 'waiver', state: 'waiver_active', amount: 39, coverageCap: 2000, claims: [claim({ coveredAmount: 300 })] })
    expect(waiverPotTotal(p)).toBe(300)
    expect(deductionTotal(p)).toBe(0)
    expect(refundableAmount(p)).toBe(0)
  })

  it('never returns a negative refundable amount', () => {
    const p = protection({ claims: [claim({ coveredAmount: 900 })] })
    expect(refundableAmount(p)).toBe(0)
  })
})

describe('claimCoverage', () => {
  it('covers damage inside the headroom with no excess', () => {
    expect(claimCoverage(protection(), 120)).toEqual({ coveredAmount: 120, excessAmount: 0 })
  })

  it('splits damage beyond the deposit', () => {
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
  it('reports not_offered without a protection', () => {
    expect(resolveBucket(undefined, 'verified')).toBe('not_offered')
  })

  it('reads awaiting_choice, waiver_active and the failure states', () => {
    expect(resolveBucket(protection({ state: 'awaiting_choice' }), 'verified')).toBe('awaiting_choice')
    expect(resolveBucket(protection({ state: 'waiver_active' }), 'verified')).toBe('settled')
    expect(resolveBucket(protection({ state: 'deposit_failed' }), 'verified')).toBe('failed')
    expect(resolveBucket(protection({ state: 'refund_failed' }), 'verified')).toBe('failed')
    expect(resolveBucket(protection({ state: 'cancelled_refunded' }), 'verified')).toBe('settled')
  })

  it('holds a pending charge until its due date, then chases it', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const past = new Date(Date.now() - 86400000).toISOString()
    expect(resolveBucket(protection({ state: 'deposit_pending', chargeDueAt: future }), 'verified')).toBe('held')
    expect(resolveBucket(protection({ state: 'deposit_pending', chargeDueAt: past }), 'verified')).toBe('charge_due')
  })

  it('warns 48h before the refund is due and escalates after it', () => {
    const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString()
    const inOneDay = new Date(Date.now() + 86400000).toISOString()
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    expect(resolveBucket(protection({ refundDueAt: inThreeDays }), 'checked_out')).toBe('held')
    expect(resolveBucket(protection({ refundDueAt: inOneDay }), 'checked_out')).toBe('refund_due')
    expect(resolveBucket(protection({ refundDueAt: yesterday }), 'checked_out')).toBe('refund_overdue')
  })

  it('owes a cancelled stay its money back immediately, whatever the check-out date', () => {
    const farFuture = new Date(Date.now() + 90 * 86400000).toISOString()
    expect(resolveBucket(protection({ refundDueAt: farFuture }), 'cancelled')).toBe('refund_due')
    expect(resolveBucket(protection({ option: 'waiver', state: 'waiver_active' }), 'cancelled')).toBe('refund_due')
  })

  it('settles a cancelled stay that was never charged, so it is never chased', () => {
    expect(resolveBucket(protection({ state: 'deposit_pending' }), 'cancelled')).toBe('settled')
    expect(resolveBucket(protection({ state: 'cancelled_refunded' }), 'cancelled')).toBe('settled')
  })
})

describe('isChoiceValid', () => {
  it('rejects unaccepted terms and an option the policy does not offer', () => {
    expect(isChoiceValid({ option: 'waiver', termsAccepted: false }, policy(), 'card')).toBe(false)
    expect(isChoiceValid({ option: 'deposit', termsAccepted: true }, policy({ offers: ['waiver'] }), 'card')).toBe(false)
  })

  it('needs no bank details for a card deposit or for any waiver', () => {
    expect(isChoiceValid({ option: 'deposit', termsAccepted: true }, policy(), 'card')).toBe(true)
    expect(isChoiceValid({ option: 'waiver', termsAccepted: true }, policy(), 'non_card')).toBe(true)
  })

  it('requires all three bank fields for a non-card deposit', () => {
    const draft = { option: 'deposit' as const, termsAccepted: true }
    expect(isChoiceValid(draft, policy(), 'non_card')).toBe(false)
    expect(isChoiceValid({
      ...draft,
      refundDestination: { method: 'bank_transfer', accountName: 'A', accountNumber: '1', bankName: ' ' },
    }, policy(), 'non_card')).toBe(false)
    expect(isChoiceValid({
      ...draft,
      refundDestination: { method: 'bank_transfer', accountName: 'Anna', accountNumber: '123', bankName: 'BCA' },
    }, policy(), 'non_card')).toBe(true)
  })
})

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
})

describe('canRelease', () => {
  it('refuses a waiver and refuses when nothing is held', () => {
    expect(canRelease(protection({ option: 'waiver', state: 'waiver_active' }))).toEqual({ ok: false, reason: 'not_a_deposit' })
    expect(canRelease(protection({ state: 'deposit_pending' }))).toEqual({ ok: false, reason: 'nothing_held' })
  })

  it('refuses while any claim is unnotified and passes once every claim is notified', () => {
    const unnotified = protection({ claims: [claim({ guestNotifiedAt: undefined })] })
    expect(canRelease(unnotified)).toEqual({ ok: false, reason: 'claim_not_notified' })
    expect(canRelease(protection({ claims: [claim()] }))).toEqual({ ok: true })
  })
})

describe('settledStateFor', () => {
  it('reads the settled state off the arithmetic', () => {
    expect(settledStateFor(protection({ claims: [] }))).toBe('deposit_released')
    expect(settledStateFor(protection({ claims: [claim({ coveredAmount: 80 })] }))).toBe('deposit_partial')
    expect(settledStateFor(protection({ claims: [claim({ coveredAmount: 500 })] }))).toBe('deposit_forfeited')
  })
})

describe('protectionActivityEvent', () => {
  it('builds an id from the same kind that chose the title', () => {
    for (const kind of ['chosen', 'charged', 'charge_failed', 'claimed', 'notified', 'released', 'refund_failed', 'cancelled', 'undone'] as const) {
      const event = protectionActivityEvent(kind, protection(), 'Komang')
      expect(event.id).toContain(kind)
      expect(event.title).toBeTruthy()
    }
  })
})
