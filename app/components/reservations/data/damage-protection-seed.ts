import type { DamageProtectionAssignment, DamageProtectionPolicy } from '~/components/reservations/data/damage-protection'
import type { CoverPartner } from '~/components/reservations/data/partner-claims'
import type { ProtectionPayer } from '~/components/reservations/data/reservations'
import { policyFromTemplate } from '~/components/reservations/data/damage-protection'

const SEEDED_AT = '2026-09-01T00:00:00.000Z'

/**
 * Built from the templates, so what a new tenant starts from and what the demo
 * shows are the same policies. Seeded in USD against the Stripe account that covers lst-1, lst-2 and lst-18
 * (`payouts.ts`). Stripe is also what makes the deposit possible there: a
 * deposit is a card saved with Stripe, so a listing on any other gateway is
 * offered the waiver only. Assigning a USD policy to a listing whose payout account
 * settles IDR is refused by `assignBand`, so the demo data has to agree with
 * the gateway it would charge on.
 */
export const seedProtectionPolicies: DamageProtectionPolicy[] = [
  { ...policyFromTemplate('standard_short', 'USD', new Date(SEEDED_AT), 'dp-standard'), name: 'Standard stay' },
  policyFromTemplate('deposit_only', 'USD', new Date(SEEDED_AT), 'dp-deposit-only'),
  { ...policyFromTemplate('standard_long', 'USD', new Date(SEEDED_AT), 'dp-long-stay'), name: 'Long stay (28 nights and over)' },
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
 * Who pays for the waiver, per listing. Absent means the guest, so every
 * seeded listing is guest-paid; switching one to host-paid in settings is what
 * shows the host cover.
 */
export const seedProtectionPayers: Record<string, ProtectionPayer> = {}

/**
 * Tern, the insurance partner behind the waiver: Elev8's own integration, the
 * same for every tenant, which is why no tenant configures it. The policy
 * number, deductible and terms are mock figures until the contract lands.
 * Guests never see this name: to them it is a waiver, never insurance.
 * Each tenant's payouts land in its own Stripe payout account.
 */
export const elev8CoverPartner: CoverPartner = {
  id: 'partner-tern',
  name: 'Tern',
  policyNumber: 'MP-2026-0001',
  currency: 'USD',
  deductiblePerClaim: 100,
  maxPerClaim: 5000,
  paymentTermsDays: 14,
}
