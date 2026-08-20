// Owner stay approval requests — the manual-approval path of the "Book My
// Stay" flow (Flow 4). When an owner requests a stay that overlaps a
// high-season window, the request lands here for GM/Admin review instead of
// being auto-approved.

import type { OwnerStaySyncTarget } from './owner-stays'
import { listings } from '~/components/listings/data/listings'

export type OwnerStayApprovalRequestStatus = 'pending' | 'approved' | 'rejected'

export interface OwnerStayApprovalRequest {
  id: string
  /** The OwnerStay row this request belongs to (status `pending_approval`). */
  stayId: string
  ownerId: string
  listingId: string
  checkIn: string
  checkOut: string
  nights: number
  guestCount?: number
  /** Free-text reason the owner submitted with the request. */
  reason?: string
  requestedAt: string
  status: OwnerStayApprovalRequestStatus
  decidedBy?: string
  decidedAt?: string
  /** Required when rejecting — surfaced to the owner in the portal. */
  decisionReason?: string
}

/**
 * High-season detection for the auto-approval rule (Flow 4, Rule A vs B).
 *
 * A date range is "high season" when it overlaps a listing's `seasonalRates`
 * entry whose label signals peak pricing (Peak / High / Season). Overlapping
 * ranges go to the manual approval queue; everything else auto-approves.
 *
 * Uses the same `[start, end)` interval semantics as owner-stay conflicts so
 * a stay ending exactly on a season start does not count as high season.
 */
export function isHighSeasonRange(
  listingId: string,
  checkIn: string,
  checkOut: string,
): boolean {
  const listing = listings.value.find(item => item.id === listingId)
  if (!listing || !listing.pricing?.seasonalRates?.length)
    return false

  return listing.pricing.seasonalRates.some((season) => {
    const isPeak = /peak|high|season/i.test(season.label)
    if (!isPeak)
      return false
    return checkIn < season.endDate && season.startDate < checkOut
  })
}

// --- Seed fixtures ----------------------------------------------------------

export const mockOwnerStayApprovals: OwnerStayApprovalRequest[] = [
  {
    id: 'osa-1',
    stayId: 'ost-5',
    ownerId: 'own-1',
    listingId: 'lst-1',
    checkIn: '2026-08-20',
    checkOut: '2026-08-24',
    nights: 4,
    guestCount: 5,
    reason: 'Family holiday during high season',
    requestedAt: '2026-08-18T08:00:00.000Z',
    status: 'pending',
  },
  {
    id: 'osa-2',
    stayId: 'ost-6',
    ownerId: 'own-2',
    listingId: 'lst-8',
    checkIn: '2026-09-02',
    checkOut: '2026-09-06',
    nights: 4,
    guestCount: 3,
    reason: 'Requested late summer stay',
    requestedAt: '2026-08-08T08:00:00.000Z',
    status: 'rejected',
    decidedBy: 'staff-1',
    decidedAt: '2026-08-10T08:00:00.000Z',
    decisionReason: 'Dates overlap a confirmed guest booking with high revenue.',
  },
]

export const ownerStayApprovalSyncTargets: OwnerStaySyncTarget[] = ['cockpit', 'channex', 'notifications']
