// Owner contracts — auto-generated from commission/service terms and gated
// behind e-signature before the owner can log in (PRD 5.3).
//
// The contract lives at the OWNER level (never per-listing) — it references
// the included listings via `listingIds`, and a single copy is stored in the
// owner's Document Center as a contract-category document.

import type { CommissionBasis } from './commission-rules'

export type OwnerContractStatus = 'draft' | 'sent' | 'signed'

export interface OwnerContractTerms {
  commissionType: 'fixed_net' | 'gross'
  rate: number
  fixedAmount?: number
  basis: CommissionBasis
  /** Services bundled into the commission (channel management, guest comms, etc.). */
  includedServices: string[]
  /**
   * Operational costs are always separate from commission (PRD 5.1.3).
   * Percentage (0–100) of operational costs borne by the owner — 100% means
   * the owner covers all costs, 0% means the management company absorbs them.
   */
  operationalFee: number
}

export interface OwnerContractSignature {
  name: string
  signedAt: string
  /** PNG data URL of the drawn signature (PRD 5.3 — draw-to-sign). */
  imageDataUrl?: string
}

export interface OwnerContract {
  id: string
  ownerId: string
  /** Listings the agreement covers. */
  listingIds: string[]
  status: OwnerContractStatus
  terms: OwnerContractTerms
  generatedAt: string
  sentAt?: string
  signedAt?: string
  signature?: OwnerContractSignature
  /** Owner-level Document Center entry (category 'contract'). */
  documentId?: string
}

export interface GenerateContractInput {
  ownerId: string
  listingIds: string[]
  terms: OwnerContractTerms
}

export const OWNER_CONTRACT_STATUS_LABELS: Record<OwnerContractStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
}

// --- Seed fixtures ----------------------------------------------------------

export const mockOwnerContracts: OwnerContract[] = [
  // Wayan — signed contract covering lst-1 (gross model).
  {
    id: 'ocn-1',
    ownerId: 'own-1',
    listingIds: ['lst-1'],
    status: 'signed',
    terms: {
      commissionType: 'gross',
      rate: 20,
      basis: 'gross',
      includedServices: ['Channel management', 'Guest communication', 'Listing optimization'],
      operationalFee: 100,
    },
    generatedAt: '2026-01-16T09:00:00.000Z',
    sentAt: '2026-01-16T09:05:00.000Z',
    signedAt: '2026-01-16T10:12:00.000Z',
    signature: { name: 'Wayan Sari', signedAt: '2026-01-16T10:12:00.000Z' },
    documentId: 'odoc-1',
  },
  // I Putu — contract signed covering lst-3 + lst-8 (net model).
  {
    id: 'ocn-2',
    ownerId: 'own-2',
    listingIds: ['lst-3', 'lst-8'],
    status: 'signed',
    terms: {
      commissionType: 'fixed_net',
      rate: 15,
      fixedAmount: 250,
      basis: 'net',
      includedServices: ['Channel management', 'Revenue management'],
      operationalFee: 100,
    },
    generatedAt: '2025-11-21T08:00:00.000Z',
    sentAt: '2025-11-21T08:10:00.000Z',
    signedAt: '2025-11-22T09:00:00.000Z',
    signature: { name: 'I Putu Antara', signedAt: '2025-11-22T09:00:00.000Z' },
    documentId: 'odoc-3',
  },
  // Ni Kadek — sent, awaiting signature (invited, no access until signed).
  {
    id: 'ocn-3',
    ownerId: 'own-3',
    listingIds: ['lst-3'],
    status: 'sent',
    terms: {
      commissionType: 'gross',
      rate: 18,
      basis: 'gross',
      includedServices: ['Channel management'],
      operationalFee: 100,
    },
    generatedAt: '2026-07-01T08:00:00.000Z',
    sentAt: '2026-07-01T08:05:00.000Z',
  },
]
