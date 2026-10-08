import type { AnalyticsUnit, RetiredLifecycle } from '~/components/analytics/data/analytics'
import { addIsoDays } from '~/components/gm/data/gm-dashboard'

/**
 * Demo listings that no longer sell: deleted ones are gone from `listings`
 * altogether, and the seed has no inactive one, so without these the
 * "include inactive / deleted" filters would have nothing to show. Analytics
 * only: no other module reads them, and the ids never resolve to a listing
 * page. Real listings set to inactive flow in through `toAnalyticsUnits`.
 */
interface RetiredListing extends Omit<AnalyticsUnit, 'lifecycle' | 'endedOn' | 'demoOnly'> {
  lifecycle: RetiredLifecycle
  /** How long before the anchor day the listing stopped selling. */
  endedDaysAgo: number
}

const RETIRED_LISTINGS: RetiredListing[] = [
  {
    listingId: 'retired-villa-bukit-sari',
    listingName: 'Villa Bukit Sari',
    location: 'Uluwatu, Bali',
    region: 'Bali',
    tags: ['Uluwatu', 'Pool', 'Ocean View'],
    currency: 'USD',
    nightlyRate: 185,
    capacity: 6,
    lifecycle: 'deleted',
    endedDaysAgo: 150,
  },
  {
    listingId: 'retired-canggu-loft',
    listingName: 'Canggu Surf Loft',
    location: 'Canggu, Bali',
    region: 'Bali',
    tags: ['Canggu', 'Budget', 'Surf'],
    currency: 'USD',
    nightlyRate: 85,
    capacity: 2,
    lifecycle: 'inactive',
    endedDaysAgo: 45,
  },
  {
    listingId: 'retired-ferienwohnung-am-see',
    listingName: 'Ferienwohnung am See',
    location: 'Waren (Müritz), Mecklenburg, Germany',
    region: 'Germany',
    tags: ['Müritz', 'Mecklenburg', 'EUR'],
    currency: 'EUR',
    nightlyRate: 130,
    capacity: 4,
    lifecycle: 'deleted',
    endedDaysAgo: 300,
  },
]

/** The retired demo listings as units, their end dates relative to `anchorIso`. */
export function retiredUnits(anchorIso: string): AnalyticsUnit[] {
  return RETIRED_LISTINGS.map(({ endedDaysAgo, ...unit }) => ({
    ...unit,
    endedOn: addIsoDays(anchorIso, -endedDaysAgo),
    demoOnly: true,
  }))
}
