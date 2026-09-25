import type { CoverPartner } from '~/components/reservations/data/partner-claims'
import type { PartnerClaim } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  applyPartnerEvent,
  canTransition,
  newPartnerClaim,
  partnerBucket,
  partnerEligibility,
  payoutDueAt,
  payoutShortfall,
  stripePayoutAccountFor,
} from '~/components/reservations/data/partner-claims'

const PARTNER: CoverPartner = {
  id: 'p-1',
  name: 'Demo Cover Partner',
  policyNumber: 'MP-1',
  currency: 'USD',
  deductiblePerClaim: 100,
  maxPerClaim: 1000,
  paymentTermsDays: 14,
}

const ACCOUNT = { id: 'pay-1', accountName: 'Stripe Bali Main' }

const WAIVER = { option: 'waiver' as const, currency: 'USD' }

function claim(patch: Partial<PartnerClaim> = {}): PartnerClaim {
  return { ...newPartnerClaim(PARTNER, 220, ACCOUNT), status: 'submitted', ...patch }
}

let n = 0
function evt(status: Parameters<typeof applyPartnerEvent>[1]['status'], extra: object = {}) {
  return { id: `e-${++n}`, status, source: 'webhook' as const, ...extra }
}

describe('partnerEligibility', () => {
  it('claims what the waiver covered, less the deductible', () => {
    expect(partnerEligibility(WAIVER, { coveredAmount: 320 }, PARTNER)).toEqual({ eligible: true, claimable: 220, deductible: 100, capped: false })
  })

  it('leaves a claim at or below the deductible with the pot', () => {
    expect(partnerEligibility(WAIVER, { coveredAmount: 100 }, PARTNER)).toMatchObject({ eligible: false, reason: 'below_deductible' })
    expect(partnerEligibility(WAIVER, { coveredAmount: 60 }, PARTNER)).toMatchObject({ eligible: false, reason: 'below_deductible' })
  })

  it('caps a claim at the per-claim maximum and says so', () => {
    expect(partnerEligibility(WAIVER, { coveredAmount: 1800 }, PARTNER)).toEqual({ eligible: true, claimable: 1000, deductible: 100, capped: true })
  })

  it('never files a deposit claim, or one in another currency', () => {
    expect(partnerEligibility({ option: 'deposit', currency: 'USD' }, { coveredAmount: 500 }, PARTNER)).toMatchObject({ eligible: false, reason: 'not_a_waiver' })
    expect(partnerEligibility({ option: 'waiver', currency: 'IDR' }, { coveredAmount: 5_000_000 }, PARTNER)).toMatchObject({ eligible: false, reason: 'currency_mismatch' })
  })
})

describe('stripePayoutAccountFor', () => {
  const accounts = [
    { id: 'pay-doku', provider: 'doku' as const, status: 'connected' as const, currency: 'USD', listingIds: ['lst-1'], accountName: 'Doku' },
    { id: 'pay-a', provider: 'stripe' as const, status: 'connected' as const, currency: 'USD', listingIds: ['lst-2'], accountName: 'Stripe A' },
    { id: 'pay-b', provider: 'stripe' as const, status: 'connected' as const, currency: 'USD', listingIds: ['lst-1'], accountName: 'Stripe B' },
    { id: 'pay-idr', provider: 'stripe' as const, status: 'connected' as const, currency: 'IDR', listingIds: ['lst-3'], accountName: 'Stripe IDR' },
  ]

  it('pays into the Stripe account that settles the listing', () => {
    expect(stripePayoutAccountFor('lst-1', accounts, 'USD')).toEqual({ id: 'pay-b', accountName: 'Stripe B' })
  })

  it('falls back to another Stripe account in the policy currency, never another gateway or currency', () => {
    expect(stripePayoutAccountFor('lst-3', accounts, 'USD')).toEqual({ id: 'pay-a', accountName: 'Stripe A' })
  })

  it('finds nothing without a connected Stripe account in the currency', () => {
    expect(stripePayoutAccountFor('lst-1', accounts.filter(a => a.provider !== 'stripe'), 'USD')).toBeNull()
    expect(stripePayoutAccountFor('lst-1', [{ ...accounts[1]!, status: 'needs_setup' as const }], 'USD')).toBeNull()
  })
})

describe('newPartnerClaim', () => {
  it('freezes the policy, deductible, amount and payout account as they stand at submission', () => {
    expect(newPartnerClaim(PARTNER, 220, ACCOUNT)).toMatchObject({
      payoutAccountId: 'pay-1',
      payoutAccountName: 'Stripe Bali Main',
      partnerId: 'p-1',
      partnerName: 'Demo Cover Partner',
      policyNumber: 'MP-1',
      claimedAmount: 220,
      deductible: 100,
      status: 'submitting',
      events: [],
    })
  })
})

describe('the status machine', () => {
  it('moves forward only along the partner process', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true)
    expect(canTransition('under_review', 'approved')).toBe(true)
    expect(canTransition('approved', 'paid')).toBe(true)
    expect(canTransition('paid', 'received')).toBe(true)
    expect(canTransition('submitted', 'paid')).toBe(false)
    expect(canTransition('approved', 'under_review')).toBe(false)
  })

  it('ends at received, rejected or withdrawn', () => {
    for (const end of ['received', 'rejected', 'withdrawn'] as const)
      expect(canTransition(end, 'under_review')).toBe(false)
  })

  it('lets a failed submission be retried or given up', () => {
    expect(canTransition('submission_failed', 'submitting')).toBe(true)
    expect(canTransition('submission_failed', 'withdrawn')).toBe(true)
  })
})

describe('applyPartnerEvent', () => {
  it('logs the event and moves the status', () => {
    const result = applyPartnerEvent(claim(), evt('under_review'))
    expect(result.ok && result.claim.status).toBe('under_review')
    expect(result.ok && result.claim.events).toHaveLength(1)
  })

  it('applies a webhook delivered twice only once', () => {
    const event = evt('under_review')
    const first = applyPartnerEvent(claim(), event)
    expect(first.ok).toBe(true)
    if (first.ok)
      expect(applyPartnerEvent(first.claim, event)).toEqual({ ok: false, reason: 'duplicate_event' })
  })

  it('refuses an event that does not follow, rather than applying it out of order', () => {
    expect(applyPartnerEvent(claim(), evt('paid', { paidAmount: 220 }))).toEqual({ ok: false, reason: 'illegal_transition' })
  })

  it('needs the partner\'s question for an information request, and returns to review once we answer', () => {
    expect(applyPartnerEvent(claim(), evt('info_requested'))).toEqual({ ok: false, reason: 'missing_reason' })
    const asked = applyPartnerEvent(claim(), evt('info_requested', { infoRequest: 'Send the invoice' }))
    expect(asked.ok && asked.claim.infoRequest).toBe('Send the invoice')
    if (asked.ok) {
      const answered = applyPartnerEvent(asked.claim, { ...evt('info_sent'), source: 'staff' })
      expect(answered.ok && answered.claim.status).toBe('under_review')
    }
  })

  it('reads full or partial approval off the amount, and refuses more than was claimed', () => {
    const full = applyPartnerEvent(claim(), evt('approved'))
    expect(full.ok && [full.claim.status, full.claim.approvedAmount]).toEqual(['approved', 220])
    // An event labelled "approved" for less is still partial.
    const partial = applyPartnerEvent(claim(), evt('approved', { approvedAmount: 150 }))
    expect(partial.ok && partial.claim.status).toBe('partially_approved')
    expect(applyPartnerEvent(claim(), evt('approved', { approvedAmount: 300 }))).toEqual({ ok: false, reason: 'invalid_amount' })
  })

  it('needs a reason for a rejection', () => {
    expect(applyPartnerEvent(claim(), evt('rejected'))).toEqual({ ok: false, reason: 'missing_reason' })
    const rejected = applyPartnerEvent(claim(), evt('rejected', { rejectionReason: 'Excluded' }))
    expect(rejected.ok && rejected.claim.rejectionReason).toBe('Excluded')
  })

  it('defaults a payment to the approved amount and a receipt to what was paid', () => {
    const paid = applyPartnerEvent(claim({ status: 'approved', approvedAmount: 200 }), evt('paid', { payoutReference: 'TRF-1' }))
    expect(paid.ok && [paid.claim.paidAmount, paid.claim.payoutReference]).toEqual([200, 'TRF-1'])
    if (paid.ok) {
      const received = applyPartnerEvent(paid.claim, { ...evt('received'), source: 'staff' })
      expect(received.ok && received.claim.receivedAmount).toBe(200)
    }
  })
})

describe('payoutShortfall and payoutDueAt', () => {
  it('reports what fell short of the approval, and nothing before any money moved', () => {
    expect(payoutShortfall({ approvedAmount: 600, paidAmount: 600, receivedAmount: 585, currency: 'USD' })).toBe(15)
    expect(payoutShortfall({ approvedAmount: 600, paidAmount: 600, currency: 'USD' })).toBe(0)
    expect(payoutShortfall({ approvedAmount: 600, currency: 'USD' })).toBe(0)
  })

  it('counts the payment terms from the approval', () => {
    const approvedAt = '2026-09-01T10:00:00.000Z'
    const due = payoutDueAt({ events: [{ id: 'a', at: approvedAt, status: 'approved', source: 'webhook' }] }, PARTNER)
    expect(new Date(due!).getTime() - new Date(approvedAt).getTime()).toBe(14 * 86400000)
    expect(payoutDueAt({ events: [] }, PARTNER)).toBeNull()
  })
})

describe('partnerBucket', () => {
  it('sorts each status into the queue that has to act on it', () => {
    expect(partnerBucket(undefined)).toBe('to_submit')
    const map: Record<string, string> = {
      submission_failed: 'action_needed',
      info_requested: 'action_needed',
      submitted: 'with_partner',
      under_review: 'with_partner',
      approved: 'awaiting_payout',
      payout_scheduled: 'awaiting_payout',
      paid: 'to_confirm',
      received: 'closed',
      rejected: 'closed',
      withdrawn: 'closed',
    }
    for (const [status, bucket] of Object.entries(map))
      expect(partnerBucket(claim({ status: status as PartnerClaim['status'] })), status).toBe(bucket)
  })
})
