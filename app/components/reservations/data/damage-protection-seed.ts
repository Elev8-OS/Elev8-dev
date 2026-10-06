import type { ListingProtectionSetup } from '~/components/damage-protection/data/listing-protection-setup'
import type { CoverPartner } from '~/components/reservations/data/partner-claims'
import type { ProtectionPayer } from '~/components/reservations/data/reservations'

const SEEDED_AT = '2026-09-01T00:00:00.000Z'

/**
 * The demo listings' damage protection. Their waiver packages are the
 * `svc-dp-bronze` (lst-1) and `svc-dp-silver` (lst-18) upsells; lst-2 takes a deposit only, no upsell, USD, all three paid out on the USD
 * Stripe account (`payouts.ts`): a package in another currency than the
 * payouts builds no policy, and only Stripe can keep a deposit card on file.
 * - lst-1: waiver (Bronze) with the deposit as the alternative;
 * - lst-2: the deposit only, asked on direct bookings;
 * - lst-18: the waiver only, Silver, carrying the demo's 60-night stay.
 */
export const seedListingProtectionSetups: ListingProtectionSetup[] = [
  { listingId: 'lst-1', waiver: true, deposit: true, depositLimit: 500, settleWithinDays: 7, updatedAt: SEEDED_AT },
  { listingId: 'lst-2', waiver: false, deposit: true, depositLimit: 750, settleWithinDays: 7, depositChannels: ['Direct'], updatedAt: SEEDED_AT },
  { listingId: 'lst-18', waiver: true, deposit: false, depositLimit: 500, settleWithinDays: 7, updatedAt: SEEDED_AT },
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
  name: 'Elev8 Cover',
  policyNumber: 'MP-2026-0001',
  currency: 'USD',
  deductiblePerClaim: 100,
  maxPerClaim: 5000,
  paymentTermsDays: 14,
}
