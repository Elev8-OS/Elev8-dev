import type { DamageProtectionAssignment, DamageProtectionPolicy } from '~/components/reservations/data/damage-protection'

const SEEDED_AT = '2026-09-01T00:00:00.000Z'

/**
 * Seeded in USD against the Stripe account that covers lst-1 and lst-2
 * (`payouts.ts`). Assigning a USD policy to a listing whose payout account
 * settles IDR is refused by `assignBand`, so the demo data has to agree with
 * the gateway it would charge on.
 */
export const seedProtectionPolicies: DamageProtectionPolicy[] = [
  {
    id: 'dp-standard',
    name: 'Standard stay',
    currency: 'USD',
    offers: ['waiver', 'deposit'],
    defaultOption: 'waiver',
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
    deposit: { pricing: 'flat', rate: 500, chargeLeadDays: 3, refundSlaDays: 7 },
    channelPolicy: { Direct: 'offer' },
    termsVersion: 'v1',
    termsText: 'The damage waiver is a non-refundable fee. It waives your liability for accidental damage up to the stated cover. It is not insurance. The security deposit is charged before arrival and returned within the stated window, less any itemised deduction we have told you about.',
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: 'dp-deposit-only',
    name: 'Deposit only',
    currency: 'USD',
    offers: ['deposit'],
    defaultOption: 'deposit',
    waiver: { pricing: 'flat', rate: 0, coverageCap: 0, exclusions: [] },
    deposit: { pricing: 'flat', rate: 750, chargeLeadDays: 3, refundSlaDays: 7 },
    channelPolicy: { Direct: 'offer' },
    termsVersion: 'v1',
    termsText: 'The security deposit is charged before arrival and returned within the stated window, less any itemised deduction we have told you about.',
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
    defaultOption: 'waiver',
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
    deposit: { pricing: 'flat', rate: 0, chargeLeadDays: 3, refundSlaDays: 7 },
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
]
