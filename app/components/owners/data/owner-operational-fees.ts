// Owner operational fees — cleaning, utilities, pool, etc. (PRD 5.1.3).
//
// Operational costs are ALWAYS separate from commission and never part of the
// percentage-based commission rate. Staff configure, per owner + listing, the
// PERCENTAGE of operational costs the owner bears:
//   - 100% → the owner covers all operational costs (cleaning, utilities, etc.)
//   - 0%   → the management company absorbs them
//
// The configured percentage flows into the owner contract (terms + PDF) and
// the statement as a separate line. It is set when the owner is created
// (onboarding), not on the contract tab.

export interface OwnerOperationalFee {
  id: string
  ownerId: string
  listingId: string
  /** 0–100 — share of operational costs borne by the owner. */
  percentage: number
  updatedAt: string
}

// --- Seed fixtures ----------------------------------------------------------

export const mockOwnerOperationalFees: OwnerOperationalFee[] = [
  {
    id: 'oef-1',
    ownerId: 'own-1',
    listingId: 'lst-1',
    percentage: 100,
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'oef-2',
    ownerId: 'own-2',
    listingId: 'lst-8',
    percentage: 100,
    updatedAt: '2025-12-01T08:00:00.000Z',
  },
  {
    id: 'oef-3',
    ownerId: 'own-3',
    listingId: 'lst-3',
    percentage: 100,
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
]
