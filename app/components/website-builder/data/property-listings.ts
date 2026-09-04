// Maps Website Builder mock properties (PropertyStep) to Review Hub listing ids.
// Configurable: extend this map as mock data grows.
export const propertyListingMap: Record<string, string[]> = {
  'prop-1': ['lst-1', 'lst-5'], // Villa Sunset Bay
  'prop-2': ['lst-12'], // Ubud Jungle Retreat
  'prop-3': ['lst-1', 'lst-12'], // Beachfront Canggu Villa
  'prop-4': ['lst-5'], // Cliffside Uluwatu
}

export const propertyNames: Record<string, string> = {
  'prop-1': 'Villa Sunset Bay',
  'prop-2': 'Ubud Jungle Retreat',
  'prop-3': 'Beachfront Canggu Villa',
  'prop-4': 'Cliffside Uluwatu',
}

export function getListingsForProperty(propertyId: string | null): string[] {
  if (!propertyId)
    return []
  return propertyListingMap[propertyId] ?? []
}

export function getListingsForProperties(propertyIds: string[]): string[] {
  const seen = new Set<string>()
  for (const id of propertyIds) {
    for (const listingId of propertyListingMap[id] ?? []) {
      seen.add(listingId)
    }
  }
  return [...seen]
}

/**
 * Listing ids a website covers, resolved through the properties it markets.
 *
 * A website with no `propertyIds` recorded returns an empty array, which
 * callers must read as "coverage unknown", not "covers nothing" — see
 * `websiteCoversScope` in the promo-code form module.
 */
export function getListingIdsForWebsite(website: { propertyIds?: string[] }): string[] {
  return getListingsForProperties(website.propertyIds ?? [])
}
