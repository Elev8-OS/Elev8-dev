// Owner-visible per-statement reservation list — the drill-down data for
// the statement detail page. Each entry is the owner-facing summary of a
// guest reservation that contributed to the period's revenue. Owner
// isolation is preserved at the read site (filtered by statementId which
// is itself owner-scoped via useOwnerPortal).

import type { OwnerLedgerSource } from './owner-ledger'

export interface OwnerReservationForStatement {
  id: string
  statementId: string
  guestName: string
  source: OwnerLedgerSource
  checkIn: string  // ISO date
  checkOut: string // ISO date
  nights: number
  grossAmount: number
  channelFee: number
  netToOwner: number
}

export const mockOwnerReservationsForPeriod: OwnerReservationForStatement[] = [
  // --- stmt-2 (own-1, lst-1, 2026-05) ---
  {
    id: 'osr-1',
    statementId: 'stmt-2',
    guestName: 'Amelia Hart',
    source: 'airbnb',
    checkIn: '2026-05-04',
    checkOut: '2026-05-11',
    nights: 7,
    grossAmount: 12_800_000,
    channelFee: -768_000,
    netToOwner: 12_032_000,
  },
  {
    id: 'osr-2',
    statementId: 'stmt-2',
    guestName: 'Daniel Ortega',
    source: 'airbnb',
    checkIn: '2026-05-14',
    checkOut: '2026-05-21',
    nights: 7,
    grossAmount: 14_700_000,
    channelFee: -882_000,
    netToOwner: 13_818_000,
  },
  {
    id: 'osr-3',
    statementId: 'stmt-2',
    guestName: 'Maya Patel',
    source: 'direct',
    checkIn: '2026-05-23',
    checkOut: '2026-05-28',
    nights: 5,
    grossAmount: 14_500_000,
    channelFee: 0,
    netToOwner: 14_500_000,
  },
  // --- stmt-3 (own-2, lst-8, 2026-05) ---
  {
    id: 'osr-4',
    statementId: 'stmt-3',
    guestName: 'Emily Carter',
    source: 'booking_com',
    checkIn: '2026-05-12',
    checkOut: '2026-05-18',
    nights: 6,
    grossAmount: 1_980,
    channelFee: -198,
    netToOwner: 1_782,
  },
  {
    id: 'osr-5',
    statementId: 'stmt-3',
    guestName: 'Oliver Brown',
    source: 'airbnb',
    checkIn: '2026-05-22',
    checkOut: '2026-05-26',
    nights: 4,
    grossAmount: 1_320,
    channelFee: -79,
    netToOwner: 1_241,
  },
  // --- stmt-4 (own-2, lst-3, 2026-05) ---
  {
    id: 'osr-6',
    statementId: 'stmt-4',
    guestName: 'Hiroshi Tanaka',
    source: 'airbnb',
    checkIn: '2026-05-08',
    checkOut: '2026-05-15',
    nights: 7,
    grossAmount: 21_000_000,
    channelFee: -1_260_000,
    netToOwner: 19_740_000,
  },
  {
    id: 'osr-7',
    statementId: 'stmt-4',
    guestName: 'Sophie Laurent',
    source: 'booking_com',
    checkIn: '2026-05-19',
    checkOut: '2026-05-25',
    nights: 6,
    grossAmount: 18_000_000,
    channelFee: -1_800_000,
    netToOwner: 16_200_000,
  },
  // --- stmt-5 (own-3, lst-3, 2026-05) — co-owner, identical amounts to stmt-4 ---
  {
    id: 'osr-8',
    statementId: 'stmt-5',
    guestName: 'Hiroshi Tanaka',
    source: 'airbnb',
    checkIn: '2026-05-08',
    checkOut: '2026-05-15',
    nights: 7,
    grossAmount: 21_000_000,
    channelFee: -1_260_000,
    netToOwner: 19_740_000,
  },
  {
    id: 'osr-9',
    statementId: 'stmt-5',
    guestName: 'Sophie Laurent',
    source: 'booking_com',
    checkIn: '2026-05-19',
    checkOut: '2026-05-25',
    nights: 6,
    grossAmount: 18_000_000,
    channelFee: -1_800_000,
    netToOwner: 16_200_000,
  },
  // --- new statements added in Task 3 ---
  {
    id: 'osr-10',
    statementId: 'stmt-7',
    guestName: 'Kenji Watanabe',
    source: 'airbnb',
    checkIn: '2026-07-05',
    checkOut: '2026-07-12',
    nights: 7,
    grossAmount: 16_200_000,
    channelFee: -972_000,
    netToOwner: 15_228_000,
  },
  {
    id: 'osr-11',
    statementId: 'stmt-7',
    guestName: 'Maria Santos',
    source: 'direct',
    checkIn: '2026-07-18',
    checkOut: '2026-07-25',
    nights: 7,
    grossAmount: 17_500_000,
    channelFee: 0,
    netToOwner: 17_500_000,
  },
  {
    id: 'osr-12',
    statementId: 'stmt-7',
    guestName: 'Liam O\'Brien',
    source: 'booking_com',
    checkIn: '2026-07-27',
    checkOut: '2026-07-31',
    nights: 4,
    grossAmount: 11_300_000,
    channelFee: -1_130_000,
    netToOwner: 10_170_000,
  },
]
