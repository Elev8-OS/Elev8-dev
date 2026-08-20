// Owner stays — owner-use nights (and partner nights) at their own listings.
// Each stay tracks three independent sync states so the dashboard can show
// which integrations are up to date and which need a retry.

export type OwnerStayStatus = 'pending_approval' | 'active' | 'rejected' | 'cancelled'

export type OwnerStaySyncTarget = 'cockpit' | 'channex' | 'notifications'

export type OwnerStaySyncState = 'pending' | 'synced' | 'failed'

/** How a stay was created. Owner portal submits go through the approval flow; staff blocks bypass it. */
export type OwnerStaySource = 'owner_request' | 'staff_block'

export interface OwnerStayApproval {
  /** Staff member id that decided the approval request. */
  decidedBy: string
  decidedAt: string
  /** Required when rejecting. */
  reason?: string
}

export interface OwnerStayCancelRequest {
  requestedAt: string
  reason: string
  status: 'pending' | 'approved' | 'denied'
  decidedBy?: string
  decidedAt?: string
}

export interface OwnerStayCleaningTaskIds {
  pre: string[]
  post: string[]
}

export interface OwnerStay {
  id: string
  ownerId: string
  listingId: string
  unitId?: string
  /** Display label for the guest column — usually the owner's name, or a friend they brought. */
  guestName: string
  checkIn: string
  checkOut: string
  /** Number of nights consumed by this stay. */
  nights: number
  /** Number of guests accompanying the owner. */
  guestCount?: number
  /** True when this counts against the owner's annual free-use night cap. */
  countsAgainstOwnerUseCap: boolean
  status: OwnerStayStatus
  /** How the stay was created — portal requests are approval-gated, staff blocks are direct. */
  source?: OwnerStaySource
  /** Set when the stay went through (or was submitted for) the approval flow. */
  approval?: OwnerStayApproval
  /** Set when the owner requested cancellation inside the 72h cutoff window. */
  cancelRequest?: OwnerStayCancelRequest
  /** Ids of the auto-created pre/post cleaning jobs (Flow 5/6). */
  cleaningTaskIds?: OwnerStayCleaningTaskIds
  /** Id of the smart-lock access code provisioned for the stay (Flow 5/6). */
  accessCodeId?: string
  /** Internal "Owner Stay" reservation id (Rp0, tagged separately from commercial bookings). */
  reservationId?: string
  notes?: string
  syncState: Record<OwnerStaySyncTarget, OwnerStaySyncState>
  createdAt: string
  updatedAt: string
  /** When set, this stay was cancelled at this time. */
  cancelledAt?: string
  cancellationReason?: string
}

export const ownerStaySyncTargetLabels: Record<OwnerStaySyncTarget, string> = {
  cockpit: 'Cockpit',
  channex: 'Channex',
  notifications: 'Notifications',
}

export const ownerStayStatusLabels: Record<OwnerStayStatus, string> = {
  pending_approval: 'Pending approval',
  active: 'Active',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

/** Cancellation / reschedule window (Flow 7): before this many hours before check-in the owner can self-serve. */
export const CANCEL_CUTOFF_HOURS = 72

// --- Seed fixtures ----------------------------------------------------------

export const mockOwnerStays: OwnerStay[] = [
  // Wayan used her own villa for 3 nights last month; everything is synced.
  {
    id: 'ost-1',
    ownerId: 'own-1',
    listingId: 'lst-1',
    guestName: 'Wayan Sari',
    checkIn: '2026-06-10',
    checkOut: '2026-06-13',
    nights: 3,
    guestCount: 4,
    countsAgainstOwnerUseCap: true,
    status: 'active',
    source: 'owner_request',
    reservationId: 'ost-res-1',
    cleaningTaskIds: { pre: ['cln-ost-1-pre'], post: ['cln-ost-1-post'] },
    accessCodeId: 'code-ost-1',
    notes: 'Family stay',
    syncState: {
      cockpit: 'synced',
      channex: 'synced',
      notifications: 'synced',
    },
    createdAt: '2026-05-20T08:00:00.000Z',
    updatedAt: '2026-06-13T11:00:00.000Z',
  },
  // I Putu has a stay scheduled next month at lst-8 — cockpit synced, channex pending, notifications failed.
  {
    id: 'ost-2',
    ownerId: 'own-2',
    listingId: 'lst-8',
    guestName: 'I Putu Antara',
    checkIn: '2026-08-05',
    checkOut: '2026-08-12',
    nights: 7,
    guestCount: 2,
    countsAgainstOwnerUseCap: true,
    status: 'active',
    source: 'owner_request',
    approval: { decidedBy: 'staff-1', decidedAt: '2026-07-12T08:00:00.000Z' },
    reservationId: 'ost-res-2',
    notes: 'Annual family holiday',
    syncState: {
      cockpit: 'synced',
      channex: 'pending',
      notifications: 'failed',
    },
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z',
  },
  // I Putu invited a friend to use lst-3 — does not count against the cap.
  {
    id: 'ost-3',
    ownerId: 'own-2',
    listingId: 'lst-3',
    guestName: 'Komang Wirawan',
    checkIn: '2026-05-15',
    checkOut: '2026-05-18',
    nights: 3,
    guestCount: 2,
    countsAgainstOwnerUseCap: false,
    status: 'active',
    source: 'owner_request',
    reservationId: 'ost-res-3',
    notes: 'Friend stay — courtesy',
    syncState: {
      cockpit: 'synced',
      channex: 'synced',
      notifications: 'synced',
    },
    createdAt: '2026-04-30T08:00:00.000Z',
    updatedAt: '2026-05-18T11:00:00.000Z',
  },
  // Cancelled stay — repainted room became unavailable.
  {
    id: 'ost-4',
    ownerId: 'own-1',
    listingId: 'lst-1',
    guestName: 'Wayan Sari',
    checkIn: '2026-07-20',
    checkOut: '2026-07-25',
    nights: 5,
    guestCount: 4,
    countsAgainstOwnerUseCap: true,
    status: 'cancelled',
    source: 'owner_request',
    notes: 'Cancelled — booked a guest stay instead.',
    syncState: {
      cockpit: 'synced',
      channex: 'synced',
      notifications: 'synced',
    },
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-07-02T08:00:00.000Z',
    cancelledAt: '2026-07-02T08:00:00.000Z',
    cancellationReason: 'Replaced by confirmed guest booking.',
  },
  // Pending approval — Wayan wants a high-season stay at lst-1 (Jul/Aug 2026 is Peak Season).
  {
    id: 'ost-5',
    ownerId: 'own-1',
    listingId: 'lst-1',
    guestName: 'Wayan Sari',
    checkIn: '2026-08-20',
    checkOut: '2026-08-24',
    nights: 4,
    guestCount: 5,
    countsAgainstOwnerUseCap: true,
    status: 'pending_approval',
    source: 'owner_request',
    notes: 'Family holiday during high season',
    syncState: {
      cockpit: 'pending',
      channex: 'pending',
      notifications: 'pending',
    },
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-18T08:00:00.000Z',
  },
  // Rejected — I Putu requested a lst-8 stay that overlapped a confirmed guest booking.
  {
    id: 'ost-6',
    ownerId: 'own-2',
    listingId: 'lst-8',
    guestName: 'I Putu Antara',
    checkIn: '2026-09-02',
    checkOut: '2026-09-06',
    nights: 4,
    guestCount: 3,
    countsAgainstOwnerUseCap: true,
    status: 'rejected',
    source: 'owner_request',
    approval: { decidedBy: 'staff-1', decidedAt: '2026-08-10T08:00:00.000Z', reason: 'Dates overlap a confirmed guest booking with high revenue.' },
    notes: 'Requested late summer stay',
    syncState: {
      cockpit: 'pending',
      channex: 'pending',
      notifications: 'pending',
    },
    createdAt: '2026-08-08T08:00:00.000Z',
    updatedAt: '2026-08-10T08:00:00.000Z',
  },
]
