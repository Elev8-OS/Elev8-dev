// Owner maintenance records — cost-bearing repairs and work orders surfaced
// to owners (Flow 10 sub-flow B).
//
// Status timeline: Reported → In Progress → Vendor Assigned → Completed.
// Repairs whose estimated cost exceeds the configurable tenant threshold go
// through `awaiting_owner_approval` first — the owner must approve the cost
// before the vendor starts. For urgent cases (e.g. AC down with guests in
// house) staff can `emergencyOverride` past the owner's response.

export type MaintenanceStatus
  = | 'reported'
    | 'in_progress'
    | 'vendor_assigned'
    | 'awaiting_owner_approval'
    | 'completed'
    | 'cancelled'

export type MaintenanceOwnerApprovalStatus
  = | 'not_required'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'emergency_override'

export interface MaintenanceOwnerApproval {
  status: MaintenanceOwnerApprovalStatus
  decidedAt?: string
  decidedBy?: string
  /** Owner's note when responding, or the staff note on emergency override. */
  note?: string
}

export interface MaintenanceRecord {
  id: string
  ownerId: string
  listingId: string
  title: string
  description: string
  reportedAt: string
  reportedBy: string
  status: MaintenanceStatus
  estimatedCost: number
  actualCost?: number
  vendorName?: string
  ownerApproval: MaintenanceOwnerApproval
  /** Photo URLs (mock) captured before the repair. */
  photosBefore?: string[]
  /** Photo URLs (mock) captured after the repair. */
  photosAfter?: string[]
  /** Vendor invoice document id (links into the Document Center). */
  invoiceId?: string
  /** Statement period (YYYY-MM) this record was synced to as a deduction. */
  syncedToStatementPeriod?: string
  createdAt: string
  updatedAt: string
}

export interface MaintenanceRecordInput {
  ownerId: string
  listingId: string
  title: string
  description: string
  estimatedCost: number
  reportedBy: string
}

export interface OwnerMaintenanceConfig {
  /** Estimated costs at or above this amount require owner approval first. */
  approvalThreshold: number
  currency: string
}

export const ownerMaintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  reported: 'Reported',
  in_progress: 'In Progress',
  vendor_assigned: 'Vendor Assigned',
  awaiting_owner_approval: 'Awaiting Owner Approval',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const ownerMaintenanceApprovalLabels: Record<MaintenanceOwnerApprovalStatus, string> = {
  not_required: 'Not required',
  pending: 'Pending owner approval',
  approved: 'Approved by owner',
  rejected: 'Rejected by owner',
  emergency_override: 'Emergency override',
}

// --- Seed fixtures ----------------------------------------------------------

export const ownerMaintenanceConfig: OwnerMaintenanceConfig = {
  approvalThreshold: 500_000,
  currency: 'IDR',
}

export const mockMaintenanceRecords: MaintenanceRecord[] = [
  // Completed — below threshold, never needed approval. Synced to a statement period.
  {
    id: 'mnt-1',
    ownerId: 'own-1',
    listingId: 'lst-1',
    title: 'Garden sprinkler valve replacement',
    description: 'One sprinkler valve seized and leaking. Replaced with a new valve and re-sealed joints.',
    reportedAt: '2026-05-02T09:00:00.000Z',
    reportedBy: 'staff-4',
    status: 'completed',
    estimatedCost: 350_000,
    actualCost: 320_000,
    vendorName: 'Bali Garden Services',
    ownerApproval: { status: 'not_required' },
    photosBefore: ['https://example.com/photos/mnt-1-before.jpg'],
    photosAfter: ['https://example.com/photos/mnt-1-after.jpg'],
    invoiceId: 'odoc-inv-mnt-1',
    syncedToStatementPeriod: '2026-05',
    createdAt: '2026-05-02T09:00:00.000Z',
    updatedAt: '2026-05-05T15:00:00.000Z',
  },
  // Awaiting owner approval — above threshold, owner has not responded yet.
  {
    id: 'mnt-2',
    ownerId: 'own-2',
    listingId: 'lst-8',
    title: 'AC unit not cooling — main bedroom',
    description: 'Guest reported the main bedroom AC blows warm air. Technician estimates compressor repair needed.',
    reportedAt: '2026-08-15T08:30:00.000Z',
    reportedBy: 'staff-3',
    status: 'awaiting_owner_approval',
    estimatedCost: 1_250_000,
    vendorName: 'Bali Cool Air',
    ownerApproval: { status: 'pending' },
    createdAt: '2026-08-15T08:30:00.000Z',
    updatedAt: '2026-08-15T08:30:00.000Z',
  },
  // Emergency override — urgent AC failure while guests were in house; owner
  // did not respond in time, staff overrode with a retroactive note.
  {
    id: 'mnt-3',
    ownerId: 'own-1',
    listingId: 'lst-1',
    title: 'Emergency: water heater failure',
    description: 'Water heater failed during an active guest stay. Emergency repair authorized to avoid guest compensation.',
    reportedAt: '2026-07-11T14:00:00.000Z',
    reportedBy: 'staff-2',
    status: 'completed',
    estimatedCost: 750_000,
    actualCost: 780_000,
    vendorName: 'Canggu Plumb Tech',
    ownerApproval: {
      status: 'emergency_override',
      decidedAt: '2026-07-11T14:30:00.000Z',
      decidedBy: 'staff-1',
      note: 'Urgent — guest in house. Override authorized; owner will be notified retroactively.',
    },
    photosBefore: ['https://example.com/photos/mnt-3-before.jpg'],
    photosAfter: ['https://example.com/photos/mnt-3-after.jpg'],
    invoiceId: 'odoc-inv-mnt-3',
    syncedToStatementPeriod: '2026-07',
    createdAt: '2026-07-11T14:00:00.000Z',
    updatedAt: '2026-07-12T10:00:00.000Z',
  },
  // In progress — below threshold, vendor working.
  {
    id: 'mnt-4',
    ownerId: 'own-2',
    listingId: 'lst-3',
    title: 'Pool pump filter replacement',
    description: 'Pool pump filter clogged and reducing circulation. Replacing filter element.',
    reportedAt: '2026-08-17T07:00:00.000Z',
    reportedBy: 'staff-4',
    status: 'in_progress',
    estimatedCost: 450_000,
    vendorName: 'Aqua Bali Pools',
    ownerApproval: { status: 'not_required' },
    createdAt: '2026-08-17T07:00:00.000Z',
    updatedAt: '2026-08-18T09:00:00.000Z',
  },
]
