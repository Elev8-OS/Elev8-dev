import type { ProtectionSettings } from '~/components/damage-protection/data/listing-protection-setup'
import type { CoverPartner } from '~/components/reservations/data/partner-claims'

const SEEDED_AT = '2026-09-01T00:00:00.000Z'

/**
 * The demo tenant's damage protection, set once for every listing: the waiver
 * with the `svc-dp-bronze` package and, with it, the deposit (a card on file,
 * up to 500 in each listing's currency). Guest-paid.
 *
 * Only listings paid out in USD (lst-1, lst-2, lst-18, on the Stripe account in
 * `payouts.ts`) or with no payout account run it: the IDR listings build no
 * policy, since nothing is converted. Stays already protected keep the terms
 * frozen on them (the demo's Silver long stay on lst-18 among them).
 */
export const seedProtectionSettings: ProtectionSettings = {
  waiver: true,
  packageServiceId: 'svc-dp-bronze',
  deposit: true,
  depositLimit: 500,
  settleWithinDays: 7,
  depositChannels: ['Direct'],
  payer: 'guest',
  updatedAt: SEEDED_AT,
}

/**
 * Tern, the insurance partner behind the waiver: Elev8's own integration, the
 * same for every tenant, which is why no tenant configures it. The policy
 * number, deductible and terms are mock figures until the contract lands.
 * Guests never see this name: to them it is a waiver, never insurance.
 * Each tenant's payouts land in its own Stripe payout account.
 */
export const elev8CoverPartner: CoverPartner = {
  id: 'partner-tern',
  name: 'Elev8 Cover',
  policyNumber: 'MP-2026-0001',
  currency: 'USD',
  deductiblePerClaim: 100,
  maxPerClaim: 5000,
  paymentTermsDays: 14,
}
