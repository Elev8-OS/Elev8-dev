// Owner domain — external ownership records and per-property mapping.
//
// Owners are managed-tenant-external people (e.g. co-owners of a villa who do
// not have Elev8 staff logins). Each owner can own a percentage of one or
// many listings, optionally scoped to a specific unit (room within a multi-
// unit listing). A single listing can have multiple owners who share its
// revenue (their ownership percentages sum to ≤ 100%).

export type OwnerStatus = 'draft' | 'invited' | 'active' | 'inactive'

export type OwnerLanguage = 'en' | 'id'

export type StatementCurrency = 'IDR' | 'USD' | 'AUD' | 'SGD' | 'EUR'

export type OwnerMagicLinkStatus = 'active' | 'revoked' | 'regenerated'

export interface Owner {
  id: string
  name: string
  email: string
  phone: string
  language: OwnerLanguage
  statementCurrency: StatementCurrency
  status: OwnerStatus
  /** How many nights per year the owner is allowed to stay at their own property for free. */
  annualOwnerUseNightCap?: number
  /** Portal magic-link lifecycle (Flow 8) — 'revoked' blocks future logins. */
  magicLinkStatus?: OwnerMagicLinkStatus
  magicLinkLastGeneratedAt?: string
  accessRevokedAt?: string
  invitedAt?: string
  activatedAt?: string
  createdAt: string
  updatedAt: string
}

export interface OwnerPropertyMapping {
  id: string
  ownerId: string
  listingId: string
  /** Optional: scope the ownership to a specific unit within a multi-unit listing. */
  unitId?: string
  /** 0–100. Mappings for the same listingId+unitId combination must sum to ≤ 100. */
  ownershipPercentage: number
  commissionRuleId: string
  effectiveFrom: string
  effectiveTo?: string
}

// --- Seed fixtures ----------------------------------------------------------

// One active single-property owner (Wayan Sari owns 100% of Villa lst-1).
// One active multi-property owner (I Putu owns 50% of lst-3 and 100% of lst-8).
// One invited co-owner (Ni Kadek shares the 50% balance of lst-3 with I Putu).
const createdAt = '2026-01-15T08:00:00.000Z'

export const mockOwners: Owner[] = [
  {
    id: 'own-1',
    name: 'Wayan Sari',
    email: 'wayan.sari@example.com',
    phone: '+6281234567001',
    language: 'id',
    statementCurrency: 'IDR',
    status: 'active',
    annualOwnerUseNightCap: 14,
    magicLinkStatus: 'active',
    magicLinkLastGeneratedAt: '2026-01-10T08:05:00.000Z',
    invitedAt: '2026-01-10T08:00:00.000Z',
    activatedAt: '2026-01-15T08:00:00.000Z',
    createdAt,
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'own-2',
    name: 'I Putu Antara',
    email: 'putu.antara@example.com',
    phone: '+6281234567002',
    language: 'en',
    statementCurrency: 'USD',
    status: 'active',
    magicLinkStatus: 'active',
    magicLinkLastGeneratedAt: '2025-11-20T08:00:00.000Z',
    invitedAt: '2025-11-20T08:00:00.000Z',
    activatedAt: '2025-12-01T08:00:00.000Z',
    createdAt: '2025-11-20T08:00:00.000Z',
    updatedAt: '2026-06-12T08:00:00.000Z',
  },
  {
    id: 'own-3',
    name: 'Ni Kadek Deviani',
    email: 'kadek.deviani@example.com',
    phone: '+6281234567003',
    language: 'id',
    statementCurrency: 'IDR',
    status: 'invited',
    invitedAt: '2026-07-01T08:00:00.000Z',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
]

export const mockOwnerPropertyMappings: OwnerPropertyMapping[] = [
  // Wayan — sole owner of lst-1 (Villa Canggu).
  {
    id: 'opm-1',
    ownerId: 'own-1',
    listingId: 'lst-1',
    ownershipPercentage: 100,
    commissionRuleId: 'cr-1',
    effectiveFrom: '2026-01-15',
  },
  // I Putu — 50% of lst-3 (Pererenan Beach House) and 100% of lst-8 (Ubud Jungle Villa).
  {
    id: 'opm-2',
    ownerId: 'own-2',
    listingId: 'lst-3',
    ownershipPercentage: 50,
    commissionRuleId: 'cr-2',
    effectiveFrom: '2025-12-01',
  },
  {
    id: 'opm-3',
    ownerId: 'own-2',
    listingId: 'lst-8',
    ownershipPercentage: 100,
    commissionRuleId: 'cr-3',
    effectiveFrom: '2025-12-01',
  },
  // Ni Kadek — 50% co-owner of lst-3 (shares with I Putu, total = 100%).
  {
    id: 'opm-4',
    ownerId: 'own-3',
    listingId: 'lst-3',
    commissionRuleId: 'cr-4',
    ownershipPercentage: 50,
    effectiveFrom: '2026-07-01',
  },
]
