// Owner operational fees — per (owner, listing) config (PRD 5.1.3).
//
// Operational costs are always separate from commission and never part of
// the percentage-based commission rate. Staff configure, per owner + listing,
// the PERCENTAGE of operational costs the owner bears (100% = owner covers
// all costs). The value is set at owner creation (onboarding) and flows into
// the contract terms + PDF.

import type { OwnerOperationalFee } from '~/components/owners/data/owner-operational-fees'
import { mockOwnerOperationalFees } from '~/components/owners/data/owner-operational-fees'

export interface SaveOperationalFeeInput {
  ownerId: string
  listingId: string
  /** 0–100 — share of operational costs borne by the owner. */
  percentage: number
}

function nowIso(): string {
  return new Date().toISOString()
}

export function useOwnerOperationalFees() {
  const fees = useState<OwnerOperationalFee[]>(
    'elev8-owner-operational-fees',
    () => structuredClone(mockOwnerOperationalFees),
  )

  /** The configured fee for an (owner, listing) pair, or undefined when unset. */
  function getFeeFor(ownerId: string, listingId: string): OwnerOperationalFee | undefined {
    return fees.value.find(f => f.ownerId === ownerId && f.listingId === listingId)
  }

  /** All fees for one owner. */
  function feesForOwner(ownerId: string): OwnerOperationalFee[] {
    return fees.value.filter(f => f.ownerId === ownerId)
  }

  /** Create or update the operational cost share for an (owner, listing) pair. */
  function saveFee(input: SaveOperationalFeeInput): { success: boolean, error?: string, fee?: OwnerOperationalFee } {
    if (input.percentage < 0 || input.percentage > 100)
      return { success: false, error: 'Percentage must be between 0 and 100.' }

    const existing = getFeeFor(input.ownerId, input.listingId)
    const timestamp = nowIso()

    if (existing) {
      const updated: OwnerOperationalFee = {
        ...existing,
        percentage: input.percentage,
        updatedAt: timestamp,
      }
      fees.value = fees.value.map(f => f.id === existing.id ? updated : f)
      return { success: true, fee: updated }
    }

    const fee: OwnerOperationalFee = {
      id: `oef-${globalThis.crypto.randomUUID()}`,
      ownerId: input.ownerId,
      listingId: input.listingId,
      percentage: input.percentage,
      updatedAt: timestamp,
    }
    fees.value = [...fees.value, fee]
    return { success: true, fee }
  }

  return {
    fees,
    getFeeFor,
    feesForOwner,
    saveFee,
  }
}
