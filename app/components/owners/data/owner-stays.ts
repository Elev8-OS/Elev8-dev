// Owner stays — owner-use nights (and partner nights) at their own listings.
// Each stay tracks three independent sync states so the dashboard can show
// which integrations are up to date and which need a retry.

export type OwnerStayStatus = 'active' | 'cancelled'

export type OwnerStaySyncTarget = 'cockpit' | 'channex' | 'notifications'

export type OwnerStaySyncState = 'pending' | 'synced' | 'failed'

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
  /** True when this counts against the owner's annual free-use night cap. */
  countsAgainstOwnerUseCap: boolean
  status: OwnerStayStatus
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
    countsAgainstOwnerUseCap: true,
    status: 'active',
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
    countsAgainstOwnerUseCap: true,
    status: 'active',
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
    countsAgainstOwnerUseCap: false,
    status: 'active',
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
    countsAgainstOwnerUseCap: true,
    status: 'cancelled',
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
]
