import type { WebsiteChannelState } from '~/components/channels/data/website-channel'
import type { Website, WebsiteStatus } from '~/components/website-builder/data/websites'
import { ruleSetForWebsite } from '~/components/channels/data/website-channel'
import { getListingIdsForWebsite } from '~/components/website-builder/data/property-listings'

export interface ListingWebsite {
  websiteId: string
  name: string
  url: string
  status: WebsiteStatus
  /** The Website channel rule set the site books under, or null when it is in none. */
  ruleSetName: string | null
}

/**
 * The Website Builder sites that sell a listing, in the order Website Builder
 * lists them. Read only: listings are never stored on the Website channel.
 * A site with no `propertyIds` has no coverage set, so it is left out rather
 * than shown as selling every listing.
 */
export function websitesForListing(
  listingId: string,
  sites: Pick<Website, 'id' | 'name' | 'url' | 'status' | 'propertyIds'>[],
  state: WebsiteChannelState,
): ListingWebsite[] {
  return sites
    .filter(site => (site.propertyIds?.length ?? 0) > 0 && getListingIdsForWebsite(site).includes(listingId))
    .map(site => ({
      websiteId: site.id,
      name: site.name,
      url: site.url,
      status: site.status,
      ruleSetName: ruleSetForWebsite(state, site.id)?.name ?? null,
    }))
}

export const WEBSITE_STATUS_LABEL: Record<WebsiteStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  building: 'Building',
}

/** Same badge colours as the Website Builder list. */
export const WEBSITE_STATUS_CLASS: Record<WebsiteStatus, string> = {
  published: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20',
  draft: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  building: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
}

/** The Listings table's Website column. Stored in saved views: keep it stable. */
export const WEBSITE_COLUMN_ID = 'website'
