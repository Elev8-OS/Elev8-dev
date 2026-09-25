import type { DamageProtectionAssignment, DamageProtectionPolicy } from '~/components/reservations/data/damage-protection'
import type { CoverPartner } from '~/components/reservations/data/partner-claims'

const SEEDED_AT = '2026-09-01T00:00:00.000Z'

/**
 * Seeded in USD against the Stripe account that covers lst-1, lst-2 and lst-18
 * (`payouts.ts`). Stripe is also what makes the deposit possible there: a
 * deposit is a card saved with Stripe, so a listing on any other gateway is
 * offered the waiver only. Assigning a USD policy to a listing whose payout account
 * settles IDR is refused by `assignBand`, so the demo data has to agree with
 * the gateway it would charge on.
 */
export const seedProtectionPolicies: DamageProtectionPolicy[] = [
  {
    id: 'dp-standard',
    name: 'Standard stay',
    currency: 'USD',
    offers: ['waiver', 'deposit'],
    waiver: {
      pricing: 'flat',
      rate: 39,
      coverageCap: 2000,
      exclusions: [
        'Intentional or malicious damage',
        'Damage caused by pets',
        'Smoking inside the property',
        'Missing or removed items',
      ],
    },
    deposit: { pricing: 'flat', rate: 500, settleWithinDays: 7 },
    channelPolicy: { Direct: 'offer' },
    termsVersion: 'v1',
    termsText: 'The damage waiver is a non-refundable fee. It waives your liability for accidental damage up to the stated cover. It is not insurance. The security deposit keeps your card on file instead: nothing is charged at booking, and after check-out the card may be charged up to the stated amount for damage recorded during your stay, once we have told you what was found and why.',
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: 'dp-deposit-only',
    name: 'Deposit only',
    currency: 'USD',
    offers: ['deposit'],
    waiver: { pricing: 'flat', rate: 0, coverageCap: 0, exclusions: [] },
    deposit: { pricing: 'flat', rate: 750, settleWithinDays: 7 },
    channelPolicy: { Direct: 'offer' },
    termsVersion: 'v1',
    termsText: 'The security deposit keeps your card on file: nothing is charged at booking, and after check-out the card may be charged up to the stated amount for damage recorded during your stay, once we have told you what was found and why.',
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    /**
     * Waiver ONLY, deliberately. Whether a months-long held deposit is a
     * tenancy deposit rather than a hospitality one is an open legal question
     * per market (Bali, Germany, Switzerland). Waiver-only is the safe default
     * until counsel answers, and it is the option the operator wants chosen.
     */
    id: 'dp-long-stay',
    name: 'Long stay (28 nights and over)',
    currency: 'USD',
    offers: ['waiver'],
    waiver: {
      pricing: 'flat',
      rate: 249,
      maxAmount: 249,
      coverageCap: 5000,
      exclusions: [
        'Normal wear and tear over a long stay, including mattresses, linens, paint and filters',
        'Intentional or malicious damage',
        'Damage caused by pets',
        'Smoking inside the property',
        'Missing or removed items',
      ],
    },
    deposit: { pricing: 'flat', rate: 0, settleWithinDays: 7 },
    channelPolicy: { Direct: 'offer' },
    termsVersion: 'v1-long',
    termsText: 'For stays of 28 nights and over, the damage waiver covers accidental damage up to the stated cover. Normal wear and tear is not accidental damage and is not covered. Claims may be recorded during your stay at each scheduled cleaning, not only at check-out.',
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
]

/** Bands must not overlap on a listing. 1-27 short, 28+ long. */
export const seedProtectionAssignments: DamageProtectionAssignment[] = [
  { listingId: 'lst-1', policyId: 'dp-standard', minNights: 1, maxNights: 27 },
  { listingId: 'lst-1', policyId: 'dp-long-stay', minNights: 28, maxNights: null },
  { listingId: 'lst-2', policyId: 'dp-deposit-only', minNights: 1, maxNights: 27 },
  { listingId: 'lst-2', policyId: 'dp-long-stay', minNights: 28, maxNights: null },
  // Long stays only: Room 3 carries the demo's 60-night stay.
  { listingId: 'lst-18', policyId: 'dp-long-stay', minNights: 28, maxNights: null },
]

/**
 * The insurance partner behind the waiver: Elev8's own integration, the same
 * for every tenant, which is why no tenant configures it. A fictional, clearly
 * mock partner: no real insurer is named anywhere in the demo. Each tenant's
 * payouts land in its own Stripe payout account.
 */
export const elev8CoverPartner: CoverPartner = {
  id: 'partner-demo',
  name: 'Demo Cover Partner',
  policyNumber: 'MP-2026-0001',
  currency: 'USD',
  deductiblePerClaim: 100,
  maxPerClaim: 5000,
  paymentTermsDays: 14,
}
