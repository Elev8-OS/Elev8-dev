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
