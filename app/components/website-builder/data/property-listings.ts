import { getUnits, listings } from '~/components/listings/data/listings'

/**
 * What a website markets, picked in Manage Listings. `propertyIds` are listing ids and `roomIds` the picked rooms
 * (units). A website stores only `propertyIds`, so the rooms are rebuilt from them (`selectionForListings`).
 */
export interface PropertySelection {
  propertyIds: string[]
  roomIds: string[]
}

// Maps the legacy Website Builder property ids (`prop-1`, saved before the picker read real listings) to listing ids.
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

const isListingId = (id: string) => listings.value.some(l => l.id === id)

/** A legacy property id maps to its listings; a listing id is its own listing; anything else covers nothing. */
function listingIdsFor(id: string): string[] {
  return propertyListingMap[id] ?? (isListingId(id) ? [id] : [])
}

export function getListingsForProperty(propertyId: string | null): string[] {
  if (!propertyId)
    return []
  return listingIdsFor(propertyId)
}

/** The selection for these listings with every room ticked, as when a saved website is opened. */
export function selectionForListings(listingIds: string[]): PropertySelection {
  const picked = listings.value.filter(l => listingIds.includes(l.id))
  return { propertyIds: picked.map(l => l.id), roomIds: picked.flatMap(l => getUnits(l).map(u => u.id)) }
}

export function getListingsForProperties(propertyIds: string[]): string[] {
  const seen = new Set<string>()
  for (const id of propertyIds) {
    for (const listingId of listingIdsFor(id)) {
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
