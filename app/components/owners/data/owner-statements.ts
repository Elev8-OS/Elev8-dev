// Owner statements — the monthly financial summary delivered to each owner.
// A statement is scoped to one (owner, listing, period) and is generated as a
// draft, then either published (frozen, owner-visible) or sent back for edits.
//
// Publication snapshots are immutable copies of the line items, so future
// adjustments to the live ledger do not retroactively change what the owner
// was originally told. Adjustments after publication create a separate
// "issue" record that links back to the original statement.

import type { StatementInput } from './owner-ledger'
import { roundCurrency } from './owner-ledger'

export type OwnerStatementStatus = 'draft' | 'in_preview' | 'published'

export type OwnerStatementLineCategory
  = | 'revenue'
    | 'expense'
    | 'commission'
    | 'tax'
    | 'fee'
    | 'adjustment'

export interface OwnerStatementLine {
  id: string
  category: OwnerStatementLineCategory
  label: string
  amount: number
  /** Source ledger entry this line was generated from. May be undefined for manual adjustments. */
  ledgerEntryId?: string
}

export interface OwnerIssueMessage {
  id: string
  author: 'owner' | 'staff'
  at: string
  message: string
}

export interface OwnerIssueResolution {
  /** 'explained' = staff clarified without changing the amount; 'adjusted' = amount changed. */
  type: 'explained' | 'adjusted'
  resolvedBy: string
  resolvedAt: string
  note?: string
  /** Set when the resolution produced an adjustment line (next-period). */
  adjustmentId?: string
}

export interface OwnerStatementIssue {
  id: string
  statementId: string
  /**
   * ID of the statement line the issue is attached to. Optional for
   *  backward-compatibility with existing fixtures (Task 1 seed has no
   *  per-line issues). The "one open issue per line" rule in
   *  `useOwnerStatements.raiseIssue` requires this field to be set for any
   *  issue created through the lifecycle composable.
   */
  lineId?: string
  description: string
  amount: number
  createdAt: string
  resolvedAt?: string
  /** Per-line dispute thread (PRD 5.5.6) — ordered messages, preserved after resolution. */
  thread?: OwnerIssueMessage[]
  /** How the dispute was closed — 'explained' or 'adjusted' (PRD 5.5.6). */
  resolution?: OwnerIssueResolution
}

export interface OwnerStatement {
  id: string
  ownerId: string
  listingId: string
  /** YYYY-MM period covered by this statement. */
  period: string
  currency: string
  status: OwnerStatementStatus
  lines: OwnerStatementLine[]
  /** Sum of all line amounts. Stored explicitly so the UI can render it without re-computing. */
  totalAmount: number
  createdAt: string
  publishedAt?: string
  /**
   * Staff id who published this statement. Set on the
   *  `publish()` transition; undefined while the statement is still a draft.
   */
  publishedBy?: string
  /** Frozen snapshot of the line items at the moment of publication. Only set when status === 'published'. */
  publishedSnapshot?: { lines: OwnerStatementLine[], totalAmount: number, currency: string }
  issues: OwnerStatementIssue[]
}

// --- Pure statement line builder --------------------------------------------

/**
 * Build the signed statement lines from a statement input. Revenue is positive;
 * expenses, commission, and taxes/fees are stored as negative amounts;
 * adjustments keep their sign. The line amounts sum to the net payout. The
 * adjustment line is omitted when there is no adjustment.
 */
export function buildStatementLines(input: StatementInput): OwnerStatementLine[] {
  const lines: OwnerStatementLine[] = [
    { id: 'line-revenue', category: 'revenue', label: 'Gross booking revenue', amount: roundCurrency(input.grossRevenue) },
    { id: 'line-expense', category: 'expense', label: 'Operating expenses', amount: roundCurrency(-input.operatingExpenses) },
    { id: 'line-commission', category: 'commission', label: 'Management commission', amount: roundCurrency(-input.commission) },
    { id: 'line-tax', category: 'tax', label: 'Taxes & platform fees', amount: roundCurrency(-input.taxesAndFees) },
  ]

  if (input.adjustments !== 0)
    lines.push({ id: 'line-adjustment', category: 'adjustment', label: 'Adjustments', amount: roundCurrency(input.adjustments) })

  return lines
}

// --- Seed fixtures ----------------------------------------------------------

export const mockOwnerStatements: OwnerStatement[] = [
  // Wayan — June 2026 statement for lst-1 (draft, awaiting publish).
  {
    id: 'stmt-1',
    ownerId: 'own-1',
    listingId: 'lst-1',
    period: '2026-06',
    currency: 'IDR',
    status: 'draft',
    createdAt: '2026-07-02T08:00:00.000Z',
    lines: [
      { id: 'sl-1', category: 'revenue', label: 'Gross booking revenue', amount: 38_500_000 },
      { id: 'sl-2', category: 'expense', label: 'Cleaning & laundry', amount: -2_100_000 },
      { id: 'sl-3', category: 'expense', label: 'Utilities', amount: -1_400_000 },
      { id: 'sl-4', category: 'commission', label: 'Management commission (20%)', amount: -7_700_000 },
      { id: 'sl-5', category: 'tax', label: 'Local tourism tax', amount: -1_925_000 },
      { id: 'sl-6', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_310_000 },
    ],
    totalAmount: 23_065_000,
    issues: [],
  },
  // Wayan — May 2026 statement for lst-1 (published, plus one resolved issue).
  {
    id: 'stmt-2',
    ownerId: 'own-1',
    listingId: 'lst-1',
    period: '2026-05',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-06-02T08:00:00.000Z',
    publishedAt: '2026-06-03T10:30:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-7', category: 'revenue', label: 'Gross booking revenue', amount: 42_000_000 },
      { id: 'sl-8', category: 'expense', label: 'Cleaning & laundry', amount: -2_300_000 },
      { id: 'sl-9', category: 'expense', label: 'Utilities', amount: -1_500_000 },
      { id: 'sl-10', category: 'commission', label: 'Management commission (20%)', amount: -8_400_000 },
      { id: 'sl-11', category: 'tax', label: 'Local tourism tax', amount: -2_100_000 },
      { id: 'sl-12', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_520_000 },
    ],
    totalAmount: 25_180_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 25_180_000,
      lines: [
        { id: 'sl-7', category: 'revenue', label: 'Gross booking revenue', amount: 42_000_000 },
        { id: 'sl-8', category: 'expense', label: 'Cleaning & laundry', amount: -2_300_000 },
        { id: 'sl-9', category: 'expense', label: 'Utilities', amount: -1_500_000 },
        { id: 'sl-10', category: 'commission', label: 'Management commission (20%)', amount: -8_400_000 },
        { id: 'sl-11', category: 'tax', label: 'Local tourism tax', amount: -2_100_000 },
        { id: 'sl-12', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_520_000 },
      ],
    },
    issues: [
      {
        id: 'sti-1',
        statementId: 'stmt-2',
        description: 'Utility undercharge — pool pump electricity corrected.',
        amount: -250_000,
        createdAt: '2026-06-07T09:00:00.000Z',
        resolvedAt: '2026-06-10T14:00:00.000Z',
      },
    ],
  },
  // I Putu — June 2026 statement for lst-8 (draft).
  {
    id: 'stmt-3',
    ownerId: 'own-2',
    listingId: 'lst-8',
    period: '2026-06',
    currency: 'USD',
    status: 'draft',
    createdAt: '2026-07-02T08:00:00.000Z',
    lines: [
      { id: 'sl-13', category: 'revenue', label: 'Gross booking revenue', amount: 9_400 },
      { id: 'sl-14', category: 'expense', label: 'Cleaning & laundry', amount: -320 },
      { id: 'sl-15', category: 'commission', label: 'Management base fee', amount: -250 },
      { id: 'sl-16', category: 'commission', label: 'Management commission (15%)', amount: -1_410 },
      { id: 'sl-17', category: 'tax', label: 'Local tourism tax', amount: -470 },
      { id: 'sl-18', category: 'fee', label: 'Platform fees (Booking.com)', amount: -564 },
    ],
    totalAmount: 6_386,
    issues: [],
  },
  // I Putu — June 2026 statement for lst-3 (draft, 50% co-owner share, IDR).
  // Commission follows cr-2 (tiered 18% / 22% on the first 50M IDR):
  //   Tier 1: 50_000_000 * 18% = 9_000_000
  //   Tier 2: 60_000_000 * 22% = 13_200_000
  //   Total:                       22_200_000 IDR
  {
    id: 'stmt-4',
    ownerId: 'own-2',
    listingId: 'lst-3',
    period: '2026-06',
    currency: 'IDR',
    status: 'draft',
    createdAt: '2026-07-02T08:00:00.000Z',
    lines: [
      { id: 'sl-19', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 110_000_000 },
      { id: 'sl-20', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_900_000 },
      { id: 'sl-21', category: 'commission', label: 'Management commission (tiered 18% / 22%)', amount: -22_200_000 },
      { id: 'sl-22', category: 'tax', label: 'Local tourism tax (50% share)', amount: -5_500_000 },
      { id: 'sl-23', category: 'fee', label: 'Platform fees (50% share)', amount: -6_600_000 },
    ],
    totalAmount: 72_800_000,
    issues: [],
  },
  // Ni Kadek — June 2026 statement for lst-3 (draft, 50% share).
  {
    id: 'stmt-5',
    ownerId: 'own-3',
    listingId: 'lst-3',
    period: '2026-06',
    currency: 'IDR',
    status: 'draft',
    createdAt: '2026-07-02T08:00:00.000Z',
    lines: [
      { id: 'sl-24', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 110_000_000 },
      { id: 'sl-25', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_900_000 },
      { id: 'sl-26', category: 'commission', label: 'Management commission (18%)', amount: -19_800_000 },
      { id: 'sl-27', category: 'tax', label: 'Local tourism tax (50% share)', amount: -5_500_000 },
      { id: 'sl-28', category: 'fee', label: 'Platform fees (50% share)', amount: -6_600_000 },
    ],
    totalAmount: 75_200_000,
    issues: [],
  },
  // --- Phase 2 extension: published history per owner -----------------------
  // The next 14 statements (stmt-6..stmt-19) bring every active owner up to
  // ≥6 published statements. Line amounts are reconciled against the
  // corresponding ledger entry (see mockOwnerLedgerEntries led-13..led-17,
  // led-28..led-30, led-43..led-46, led-58..led-61). The flat-20%
  // commission is a deliberate simplification for co-owned lst-3: cr-2
  // (tiered 18%/22%) and cr-4 (flat 18%) would diverge the numbers across
  // own-2/own-3, breaking the cross-owner isolation invariant that requires
  // identical line amounts for the same (listing, period) tuple.
  //
  // Wayan — July 2026 statement for lst-1 (published). Corresponds to led-13.
  {
    id: 'stmt-6',
    ownerId: 'own-1',
    listingId: 'lst-1',
    period: '2026-07',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-08-02T08:00:00.000Z',
    publishedAt: '2026-08-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-29', category: 'revenue', label: 'Gross booking revenue', amount: 49_000_000 },
      { id: 'sl-30', category: 'expense', label: 'Cleaning & laundry', amount: -2_700_000 },
      { id: 'sl-31', category: 'expense', label: 'Utilities', amount: -1_800_000 },
      { id: 'sl-32', category: 'commission', label: 'Management commission (20%)', amount: -9_800_000 },
      { id: 'sl-33', category: 'tax', label: 'Local tourism tax', amount: -2_450_000 },
      { id: 'sl-34', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_940_000 },
    ],
    totalAmount: 29_310_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 29_310_000,
      lines: [
        { id: 'sl-29', category: 'revenue', label: 'Gross booking revenue', amount: 49_000_000 },
        { id: 'sl-30', category: 'expense', label: 'Cleaning & laundry', amount: -2_700_000 },
        { id: 'sl-31', category: 'expense', label: 'Utilities', amount: -1_800_000 },
        { id: 'sl-32', category: 'commission', label: 'Management commission (20%)', amount: -9_800_000 },
        { id: 'sl-33', category: 'tax', label: 'Local tourism tax', amount: -2_450_000 },
        { id: 'sl-34', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_940_000 },
      ],
    },
    issues: [],
  },
  // Wayan — August 2026 statement for lst-1 (published). Corresponds to led-14.
  {
    id: 'stmt-7',
    ownerId: 'own-1',
    listingId: 'lst-1',
    period: '2026-08',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-09-02T08:00:00.000Z',
    publishedAt: '2026-09-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-35', category: 'revenue', label: 'Gross booking revenue', amount: 52_000_000 },
      { id: 'sl-36', category: 'expense', label: 'Cleaning & laundry', amount: -2_880_000 },
      { id: 'sl-37', category: 'expense', label: 'Utilities', amount: -1_920_000 },
      { id: 'sl-38', category: 'commission', label: 'Management commission (20%)', amount: -10_400_000 },
      { id: 'sl-39', category: 'tax', label: 'Local tourism tax', amount: -2_600_000 },
      { id: 'sl-40', category: 'fee', label: 'Platform fees (Airbnb)', amount: -3_120_000 },
    ],
    totalAmount: 31_080_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 31_080_000,
      lines: [
        { id: 'sl-35', category: 'revenue', label: 'Gross booking revenue', amount: 52_000_000 },
        { id: 'sl-36', category: 'expense', label: 'Cleaning & laundry', amount: -2_880_000 },
        { id: 'sl-37', category: 'expense', label: 'Utilities', amount: -1_920_000 },
        { id: 'sl-38', category: 'commission', label: 'Management commission (20%)', amount: -10_400_000 },
        { id: 'sl-39', category: 'tax', label: 'Local tourism tax', amount: -2_600_000 },
        { id: 'sl-40', category: 'fee', label: 'Platform fees (Airbnb)', amount: -3_120_000 },
      ],
    },
    issues: [],
  },
  // Wayan — September 2026 statement for lst-1 (published). Corresponds to led-15.
  {
    id: 'stmt-8',
    ownerId: 'own-1',
    listingId: 'lst-1',
    period: '2026-09',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-10-02T08:00:00.000Z',
    publishedAt: '2026-10-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-41', category: 'revenue', label: 'Gross booking revenue', amount: 32_000_000 },
      { id: 'sl-42', category: 'expense', label: 'Cleaning & laundry', amount: -1_740_000 },
      { id: 'sl-43', category: 'expense', label: 'Utilities', amount: -1_160_000 },
      { id: 'sl-44', category: 'commission', label: 'Management commission (20%)', amount: -6_400_000 },
      { id: 'sl-45', category: 'tax', label: 'Local tourism tax', amount: -1_600_000 },
      { id: 'sl-46', category: 'fee', label: 'Platform fees (Airbnb)', amount: -1_920_000 },
    ],
    totalAmount: 19_180_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 19_180_000,
      lines: [
        { id: 'sl-41', category: 'revenue', label: 'Gross booking revenue', amount: 32_000_000 },
        { id: 'sl-42', category: 'expense', label: 'Cleaning & laundry', amount: -1_740_000 },
        { id: 'sl-43', category: 'expense', label: 'Utilities', amount: -1_160_000 },
        { id: 'sl-44', category: 'commission', label: 'Management commission (20%)', amount: -6_400_000 },
        { id: 'sl-45', category: 'tax', label: 'Local tourism tax', amount: -1_600_000 },
        { id: 'sl-46', category: 'fee', label: 'Platform fees (Airbnb)', amount: -1_920_000 },
      ],
    },
    issues: [],
  },
  // Wayan — October 2026 statement for lst-1 (published). Corresponds to led-16.
  {
    id: 'stmt-9',
    ownerId: 'own-1',
    listingId: 'lst-1',
    period: '2026-10',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-11-02T08:00:00.000Z',
    publishedAt: '2026-11-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-47', category: 'revenue', label: 'Gross booking revenue', amount: 38_000_000 },
      { id: 'sl-48', category: 'expense', label: 'Cleaning & laundry', amount: -2_040_000 },
      { id: 'sl-49', category: 'expense', label: 'Utilities', amount: -1_360_000 },
      { id: 'sl-50', category: 'commission', label: 'Management commission (20%)', amount: -7_600_000 },
      { id: 'sl-51', category: 'tax', label: 'Local tourism tax', amount: -1_900_000 },
      { id: 'sl-52', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_280_000 },
    ],
    totalAmount: 22_820_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 22_820_000,
      lines: [
        { id: 'sl-47', category: 'revenue', label: 'Gross booking revenue', amount: 38_000_000 },
        { id: 'sl-48', category: 'expense', label: 'Cleaning & laundry', amount: -2_040_000 },
        { id: 'sl-49', category: 'expense', label: 'Utilities', amount: -1_360_000 },
        { id: 'sl-50', category: 'commission', label: 'Management commission (20%)', amount: -7_600_000 },
        { id: 'sl-51', category: 'tax', label: 'Local tourism tax', amount: -1_900_000 },
        { id: 'sl-52', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_280_000 },
      ],
    },
    issues: [],
  },
  // Wayan — November 2026 statement for lst-1 (published). Corresponds to led-17.
  {
    id: 'stmt-10',
    ownerId: 'own-1',
    listingId: 'lst-1',
    period: '2026-11',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-12-02T08:00:00.000Z',
    publishedAt: '2026-12-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-53', category: 'revenue', label: 'Gross booking revenue', amount: 40_000_000 },
      { id: 'sl-54', category: 'expense', label: 'Cleaning & laundry', amount: -2_160_000 },
      { id: 'sl-55', category: 'expense', label: 'Utilities', amount: -1_440_000 },
      { id: 'sl-56', category: 'commission', label: 'Management commission (20%)', amount: -8_000_000 },
      { id: 'sl-57', category: 'tax', label: 'Local tourism tax', amount: -2_000_000 },
      { id: 'sl-58', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_400_000 },
    ],
    totalAmount: 24_000_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 24_000_000,
      lines: [
        { id: 'sl-53', category: 'revenue', label: 'Gross booking revenue', amount: 40_000_000 },
        { id: 'sl-54', category: 'expense', label: 'Cleaning & laundry', amount: -2_160_000 },
        { id: 'sl-55', category: 'expense', label: 'Utilities', amount: -1_440_000 },
        { id: 'sl-56', category: 'commission', label: 'Management commission (20%)', amount: -8_000_000 },
        { id: 'sl-57', category: 'tax', label: 'Local tourism tax', amount: -2_000_000 },
        { id: 'sl-58', category: 'fee', label: 'Platform fees (Airbnb)', amount: -2_400_000 },
      ],
    },
    issues: [],
  },
  // I Putu — July 2026 statement for lst-8 (published). Corresponds to led-28.
  {
    id: 'stmt-11',
    ownerId: 'own-2',
    listingId: 'lst-8',
    period: '2026-07',
    currency: 'USD',
    status: 'published',
    createdAt: '2026-08-02T08:00:00.000Z',
    publishedAt: '2026-08-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-59', category: 'revenue', label: 'Gross booking revenue', amount: 7_800 },
      { id: 'sl-60', category: 'expense', label: 'Cleaning & laundry', amount: -270 },
      { id: 'sl-61', category: 'commission', label: 'Management commission (20%)', amount: -1_560 },
      { id: 'sl-62', category: 'tax', label: 'Local tourism tax', amount: -390 },
      { id: 'sl-63', category: 'fee', label: 'Platform fees (Booking.com)', amount: -468 },
    ],
    totalAmount: 5_112,
    publishedSnapshot: {
      currency: 'USD',
      totalAmount: 5_112,
      lines: [
        { id: 'sl-59', category: 'revenue', label: 'Gross booking revenue', amount: 7_800 },
        { id: 'sl-60', category: 'expense', label: 'Cleaning & laundry', amount: -270 },
        { id: 'sl-61', category: 'commission', label: 'Management commission (20%)', amount: -1_560 },
        { id: 'sl-62', category: 'tax', label: 'Local tourism tax', amount: -390 },
        { id: 'sl-63', category: 'fee', label: 'Platform fees (Booking.com)', amount: -468 },
      ],
    },
    issues: [],
  },
  // I Putu — August 2026 statement for lst-8 (published). Corresponds to led-29.
  {
    id: 'stmt-12',
    ownerId: 'own-2',
    listingId: 'lst-8',
    period: '2026-08',
    currency: 'USD',
    status: 'published',
    createdAt: '2026-09-02T08:00:00.000Z',
    publishedAt: '2026-09-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-64', category: 'revenue', label: 'Gross booking revenue', amount: 8_200 },
      { id: 'sl-65', category: 'expense', label: 'Cleaning & laundry', amount: -290 },
      { id: 'sl-66', category: 'commission', label: 'Management commission (20%)', amount: -1_640 },
      { id: 'sl-67', category: 'tax', label: 'Local tourism tax', amount: -410 },
      { id: 'sl-68', category: 'fee', label: 'Platform fees (Booking.com)', amount: -492 },
    ],
    totalAmount: 5_368,
    publishedSnapshot: {
      currency: 'USD',
      totalAmount: 5_368,
      lines: [
        { id: 'sl-64', category: 'revenue', label: 'Gross booking revenue', amount: 8_200 },
        { id: 'sl-65', category: 'expense', label: 'Cleaning & laundry', amount: -290 },
        { id: 'sl-66', category: 'commission', label: 'Management commission (20%)', amount: -1_640 },
        { id: 'sl-67', category: 'tax', label: 'Local tourism tax', amount: -410 },
        { id: 'sl-68', category: 'fee', label: 'Platform fees (Booking.com)', amount: -492 },
      ],
    },
    issues: [],
  },
  // I Putu — September 2026 statement for lst-8 (published). Corresponds to led-30.
  {
    id: 'stmt-13',
    ownerId: 'own-2',
    listingId: 'lst-8',
    period: '2026-09',
    currency: 'USD',
    status: 'published',
    createdAt: '2026-10-02T08:00:00.000Z',
    publishedAt: '2026-10-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-69', category: 'revenue', label: 'Gross booking revenue', amount: 8_900 },
      { id: 'sl-70', category: 'expense', label: 'Cleaning & laundry', amount: -310 },
      { id: 'sl-71', category: 'commission', label: 'Management commission (20%)', amount: -1_780 },
      { id: 'sl-72', category: 'tax', label: 'Local tourism tax', amount: -445 },
      { id: 'sl-73', category: 'fee', label: 'Platform fees (Booking.com)', amount: -534 },
    ],
    totalAmount: 5_831,
    publishedSnapshot: {
      currency: 'USD',
      totalAmount: 5_831,
      lines: [
        { id: 'sl-69', category: 'revenue', label: 'Gross booking revenue', amount: 8_900 },
        { id: 'sl-70', category: 'expense', label: 'Cleaning & laundry', amount: -310 },
        { id: 'sl-71', category: 'commission', label: 'Management commission (20%)', amount: -1_780 },
        { id: 'sl-72', category: 'tax', label: 'Local tourism tax', amount: -445 },
        { id: 'sl-73', category: 'fee', label: 'Platform fees (Booking.com)', amount: -534 },
      ],
    },
    issues: [],
  },
  // I Putu — July 2026 statement for lst-3 (published, 50% co-owner share, IDR).
  // Identical line amounts to stmt-16 (Ni Kadek's same-listing/same-period share)
  // so the cross-owner isolation invariant holds for published history too.
  // Corresponds to led-43.
  {
    id: 'stmt-14',
    ownerId: 'own-2',
    listingId: 'lst-3',
    period: '2026-07',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-08-02T08:00:00.000Z',
    publishedAt: '2026-08-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-74', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 96_000_000 },
      { id: 'sl-75', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_500_000 },
      { id: 'sl-76', category: 'commission', label: 'Management commission (20%)', amount: -19_200_000 },
      { id: 'sl-77', category: 'tax', label: 'Local tourism tax (50% share)', amount: -4_800_000 },
      { id: 'sl-78', category: 'fee', label: 'Platform fees (50% share)', amount: -5_760_000 },
    ],
    totalAmount: 63_740_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 63_740_000,
      lines: [
        { id: 'sl-74', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 96_000_000 },
        { id: 'sl-75', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_500_000 },
        { id: 'sl-76', category: 'commission', label: 'Management commission (20%)', amount: -19_200_000 },
        { id: 'sl-77', category: 'tax', label: 'Local tourism tax (50% share)', amount: -4_800_000 },
        { id: 'sl-78', category: 'fee', label: 'Platform fees (50% share)', amount: -5_760_000 },
      ],
    },
    issues: [],
  },
  // I Putu — August 2026 statement for lst-3 (published, 50% co-owner share, IDR).
  // Identical line amounts to stmt-17. Corresponds to led-44.
  {
    id: 'stmt-15',
    ownerId: 'own-2',
    listingId: 'lst-3',
    period: '2026-08',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-09-02T08:00:00.000Z',
    publishedAt: '2026-09-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-79', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 102_000_000 },
      { id: 'sl-80', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_700_000 },
      { id: 'sl-81', category: 'commission', label: 'Management commission (20%)', amount: -20_400_000 },
      { id: 'sl-82', category: 'tax', label: 'Local tourism tax (50% share)', amount: -5_100_000 },
      { id: 'sl-83', category: 'fee', label: 'Platform fees (50% share)', amount: -6_120_000 },
    ],
    totalAmount: 67_680_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 67_680_000,
      lines: [
        { id: 'sl-79', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 102_000_000 },
        { id: 'sl-80', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_700_000 },
        { id: 'sl-81', category: 'commission', label: 'Management commission (20%)', amount: -20_400_000 },
        { id: 'sl-82', category: 'tax', label: 'Local tourism tax (50% share)', amount: -5_100_000 },
        { id: 'sl-83', category: 'fee', label: 'Platform fees (50% share)', amount: -6_120_000 },
      ],
    },
    issues: [],
  },
  // Ni Kadek — July 2026 statement for lst-3 (published, 50% share, IDR).
  // Identical line amounts to stmt-14 (I Putu's same-listing/same-period share).
  // Corresponds to led-58.
  {
    id: 'stmt-16',
    ownerId: 'own-3',
    listingId: 'lst-3',
    period: '2026-07',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-08-02T08:00:00.000Z',
    publishedAt: '2026-08-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-84', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 96_000_000 },
      { id: 'sl-85', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_500_000 },
      { id: 'sl-86', category: 'commission', label: 'Management commission (20%)', amount: -19_200_000 },
      { id: 'sl-87', category: 'tax', label: 'Local tourism tax (50% share)', amount: -4_800_000 },
      { id: 'sl-88', category: 'fee', label: 'Platform fees (50% share)', amount: -5_760_000 },
    ],
    totalAmount: 63_740_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 63_740_000,
      lines: [
        { id: 'sl-84', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 96_000_000 },
        { id: 'sl-85', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_500_000 },
        { id: 'sl-86', category: 'commission', label: 'Management commission (20%)', amount: -19_200_000 },
        { id: 'sl-87', category: 'tax', label: 'Local tourism tax (50% share)', amount: -4_800_000 },
        { id: 'sl-88', category: 'fee', label: 'Platform fees (50% share)', amount: -5_760_000 },
      ],
    },
    issues: [],
  },
  // Ni Kadek — August 2026 statement for lst-3 (published, 50% share, IDR).
  // Identical line amounts to stmt-15. Corresponds to led-59.
  {
    id: 'stmt-17',
    ownerId: 'own-3',
    listingId: 'lst-3',
    period: '2026-08',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-09-02T08:00:00.000Z',
    publishedAt: '2026-09-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-89', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 102_000_000 },
      { id: 'sl-90', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_700_000 },
      { id: 'sl-91', category: 'commission', label: 'Management commission (20%)', amount: -20_400_000 },
      { id: 'sl-92', category: 'tax', label: 'Local tourism tax (50% share)', amount: -5_100_000 },
      { id: 'sl-93', category: 'fee', label: 'Platform fees (50% share)', amount: -6_120_000 },
    ],
    totalAmount: 67_680_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 67_680_000,
      lines: [
        { id: 'sl-89', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 102_000_000 },
        { id: 'sl-90', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -2_700_000 },
        { id: 'sl-91', category: 'commission', label: 'Management commission (20%)', amount: -20_400_000 },
        { id: 'sl-92', category: 'tax', label: 'Local tourism tax (50% share)', amount: -5_100_000 },
        { id: 'sl-93', category: 'fee', label: 'Platform fees (50% share)', amount: -6_120_000 },
      ],
    },
    issues: [],
  },
  // Ni Kadek — September 2026 statement for lst-3 (published, 50% share, IDR).
  // Corresponds to led-60.
  {
    id: 'stmt-18',
    ownerId: 'own-3',
    listingId: 'lst-3',
    period: '2026-09',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-10-02T08:00:00.000Z',
    publishedAt: '2026-10-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-94', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 118_000_000 },
      { id: 'sl-95', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -3_000_000 },
      { id: 'sl-96', category: 'commission', label: 'Management commission (20%)', amount: -23_600_000 },
      { id: 'sl-97', category: 'tax', label: 'Local tourism tax (50% share)', amount: -5_900_000 },
      { id: 'sl-98', category: 'fee', label: 'Platform fees (50% share)', amount: -7_080_000 },
    ],
    totalAmount: 78_420_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 78_420_000,
      lines: [
        { id: 'sl-94', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 118_000_000 },
        { id: 'sl-95', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -3_000_000 },
        { id: 'sl-96', category: 'commission', label: 'Management commission (20%)', amount: -23_600_000 },
        { id: 'sl-97', category: 'tax', label: 'Local tourism tax (50% share)', amount: -5_900_000 },
        { id: 'sl-98', category: 'fee', label: 'Platform fees (50% share)', amount: -7_080_000 },
      ],
    },
    issues: [],
  },
  // Ni Kadek — October 2026 statement for lst-3 (published, 50% share, IDR).
  // Corresponds to led-61.
  {
    id: 'stmt-19',
    ownerId: 'own-3',
    listingId: 'lst-3',
    period: '2026-10',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-11-02T08:00:00.000Z',
    publishedAt: '2026-11-03T10:00:00.000Z',
    publishedBy: 'staff-1',
    lines: [
      { id: 'sl-99', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 132_000_000 },
      { id: 'sl-100', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -3_400_000 },
      { id: 'sl-101', category: 'commission', label: 'Management commission (20%)', amount: -26_400_000 },
      { id: 'sl-102', category: 'tax', label: 'Local tourism tax (50% share)', amount: -6_600_000 },
      { id: 'sl-103', category: 'fee', label: 'Platform fees (50% share)', amount: -7_920_000 },
    ],
    totalAmount: 87_680_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 87_680_000,
      lines: [
        { id: 'sl-99', category: 'revenue', label: 'Gross booking revenue (50% share)', amount: 132_000_000 },
        { id: 'sl-100', category: 'expense', label: 'Cleaning & laundry (50% share)', amount: -3_400_000 },
        { id: 'sl-101', category: 'commission', label: 'Management commission (20%)', amount: -26_400_000 },
        { id: 'sl-102', category: 'tax', label: 'Local tourism tax (50% share)', amount: -6_600_000 },
        { id: 'sl-103', category: 'fee', label: 'Platform fees (50% share)', amount: -7_920_000 },
      ],
    },
    issues: [],
  },
]
