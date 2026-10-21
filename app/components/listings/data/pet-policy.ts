/**
 * Whether a listing takes pets, and which pet packages guests choose from
 * when they declare one. Set in the listing's Guest Guide tab. A package is an
 * upsell from the catalog's Pet category (`upsell-services.ts`); the policy
 * stores its id only, the upsell itself stays the one source of its price.
 */
export interface PetPolicy {
  allowed: boolean
  /** Upsell service ids, category 'Pet', in the order guests see them. */
  packageIds: string[]
}

export const DEFAULT_PET_POLICY: PetPolicy = { allowed: false, packageIds: [] }

export function listingPetPolicy(listing: { petPolicy?: Partial<PetPolicy> } | null | undefined): PetPolicy {
  return { ...DEFAULT_PET_POLICY, ...listing?.petPolicy, packageIds: [...(listing?.petPolicy?.packageIds ?? [])] }
}

/** The upsell fields that decide whether a pet package reaches a listing's guests. */
interface OfferableService { id: string, status: string, assignedListings: string[] }

/** A pet package reaches guests only when it is active and the catalog offers it on that listing (by name). */
export function isPetPackageOffered(services: OfferableService[], serviceId: string, listingName: string): boolean {
  const service = services.find(s => s.id === serviceId)
  return Boolean(service && service.status === 'active' && service.assignedListings.includes(listingName))
}
