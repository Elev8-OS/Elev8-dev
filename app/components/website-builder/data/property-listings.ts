// Maps Website Builder mock properties (PropertyStep) to Review Hub listing ids.
// Configurable: extend this map as mock data grows.
export const propertyListingMap: Record<string, string[]> = {
  'prop-1': ['lst-1', 'lst-5'], // Villa Sunset Bay
  'prop-2': ['lst-12'], // Ubud Jungle Retreat
  'prop-3': ['lst-1', 'lst-12'], // Beachfront Canggu Villa
  'prop-4': ['lst-5'], // Cliffside Uluwatu
}

export function getListingsForProperty(propertyId: string | null): string[] {
  if (!propertyId)
    return []
  return propertyListingMap[propertyId] ?? []
}
