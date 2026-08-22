// Owner self-booking quotas + booking mode (PRD 5.2).
//
// Two booking modes:
//   - direct:  the owner's selected dates block the calendar immediately.
//   - request: the owner submits a request that staff approve/decline first.
//
// Seasonal quotas are date-range windows per (owner, listing), each with a
// max number of self-booked nights. Quotas are NON-accumulating — unused
// nights in one window do not roll over to the next.

export type OwnerBookingMode = 'direct' | 'request'

export interface OwnerSeasonalQuota {
  id: string
  ownerId: string
  listingId: string
  /** Inclusive date range (ISO YYYY-MM-DD). */
  startDate: string
  endDate: string
  /** Max self-booked nights in this window. */
  maxNights: number
}

export interface OwnerBookingModeConfig {
  ownerId: string
  listingId: string
  mode: OwnerBookingMode
}

export interface QuotaWindowUsage {
  startDate: string
  endDate: string
  maxNights: number
  /** Nights the owner has already booked (active stays overlapping the window). */
  usedNights: number
  /** Nights requested in the candidate range overlapping this window. */
  requestedNights: number
  remaining: number
}

export interface QuotaCheckResult {
  ok: boolean
  /** Windows the candidate range overlaps, with usage. */
  windows: QuotaWindowUsage[]
  /** True when any window is exceeded — blocks direct bookings. */
  exceeded: boolean
}

export const OWNER_BOOKING_MODE_LABELS: Record<OwnerBookingMode, string> = {
  direct: 'Direct booking',
  request: 'Request to book',
}

export const mockOwnerSeasonalQuotas: OwnerSeasonalQuota[] = [
  // Wayan (own-1 / lst-1): high season fully blocked, other seasons capped.
  {
    id: 'oq-1',
    ownerId: 'own-1',
    listingId: 'lst-1',
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    maxNights: 0,
  },
  {
    id: 'oq-2',
    ownerId: 'own-1',
    listingId: 'lst-1',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    maxNights: 10,
  },
  {
    id: 'oq-3',
    ownerId: 'own-1',
    listingId: 'lst-1',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    maxNights: 14,
  },
  // I Putu (own-2 / lst-8): holiday season capped at 7 nights.
  {
    id: 'oq-4',
    ownerId: 'own-2',
    listingId: 'lst-8',
    startDate: '2026-12-20',
    endDate: '2027-01-05',
    maxNights: 7,
  },
]

export const mockOwnerBookingModes: OwnerBookingModeConfig[] = [
  { ownerId: 'own-1', listingId: 'lst-1', mode: 'direct' },
  { ownerId: 'own-2', listingId: 'lst-8', mode: 'request' },
]
