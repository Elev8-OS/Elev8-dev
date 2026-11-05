import type { TenantPlan, PackageTier, Region } from './tenants'
import type { StaffRoleName } from './staff'

export type BannerSeverity = 'info' | 'warning' | 'critical'
export type BannerStatus = 'scheduled' | 'live' | 'expired' | 'retracted'
export type TargetScope = 'all' | 'segment' | 'individual'
export type DismissalScope = 'account' | 'user'
export type BannerKind = 'announcement' | 'maintenance'
export type MaintenanceImpact = 'offline' | 'degraded'
export type BannerUpdateKind = 'update' | 'resolved'
export type MaintenancePhase = 'upcoming' | 'in_progress' | 'wrapping_up' | 'resolved'

/** Most broadcasts that may be active (live or scheduled to be) at the same moment, across the whole platform. */
export const MAX_ACTIVE_BROADCASTS = 2

/** The banner stays up this long after a maintenance window closes, unless staff resolve it first. */
export const MAINTENANCE_WRAP_UP_MS = 60 * 60_000
/** A resolved broadcast keeps showing for this long so tenants see the all clear. */
export const RESOLVED_GRACE_MS = 60 * 60_000

export const MAINTENANCE_MODULES = [
  'Inbox', 'Reviews', 'Channels', 'Reservations', 'Payments', 'Smart locks',
  'Website builder', 'Guest guide', 'Mobile app', 'Everything',
] as const

export interface MaintenanceWindow {
  startAt: string
  endAt: string
  /** Zone staff composed in. Tenants always read the window in their own zone. */
  timezone: string
  impact: MaintenanceImpact
  affected: string[]
}

export interface BannerUpdate {
  id: string
  kind: BannerUpdateKind
  message: string
  createdAt: string
  createdByStaffId: string
}

export type BannerTargetFilter =
  | { scope: 'all' }
  | {
      scope: 'segment'
      planTypes?: TenantPlan[]
      tiers?: PackageTier[]
      regions?: Region[]
      hasChannelManager?: boolean
    }
  | { scope: 'individual'; tenantIds: string[] }

export interface PlatformBanner {
  id: string
  title: string
  body: string
  severity: BannerSeverity
  ctaLabel?: string
  ctaUrl?: string
  targetScope: TargetScope
  targetFilter: BannerTargetFilter
  visibleRoles: StaffRoleName[]
  dismissible: boolean
  dismissalScope: DismissalScope
  startAt: string
  endAt?: string
  status: BannerStatus
  createdByStaffId: string
  createdAt: string
  /** Absent on banners made before maintenance existed: those are announcements. */
  kind?: BannerKind
  maintenance?: MaintenanceWindow
  updates?: BannerUpdate[]
  resolvedAt?: string
  retractedAt?: string
  retractedByStaffId?: string
  retractionReason?: string
}

export interface BannerDismissal {
  bannerId: string
  tenantId: string
  userId?: string
  dismissedAt: string
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

export const mockBanners: PlatformBanner[] = [
  {
    id: 'banner-1', title: 'Planned maintenance: Inbox and Reviews',
    body: 'Inbox and Reviews will be offline for about 30 minutes. Plan accordingly.',
    severity: 'critical', ctaLabel: 'View status', ctaUrl: 'https://status.elev8.io',
    kind: 'maintenance',
    maintenance: {
      startAt: daysFromNow(2), endAt: new Date(Date.now() + 2 * 86_400_000 + 30 * 60_000).toISOString(),
      timezone: 'UTC', impact: 'offline', affected: ['Inbox', 'Reviews'],
    },
    targetScope: 'all', targetFilter: { scope: 'all' },
    visibleRoles: ['Admin', 'General Manager', 'Listing Manager', 'Guest Experience Manager', 'Finance/HR'],
    dismissible: true, dismissalScope: 'user',
    startAt: daysAgo(0), endAt: new Date(Date.now() + 2 * 86_400_000 + 30 * 60_000 + MAINTENANCE_WRAP_UP_MS).toISOString(),
    status: 'live', createdByStaffId: 'staff-1', createdAt: daysAgo(0),
  },
  {
    id: 'banner-2', title: "You're 2 units from your Growth ceiling",
    body: 'Upgrade now to Pro to avoid the paywall.',
    severity: 'warning', ctaLabel: 'Upgrade plan', ctaUrl: '/settings/billing',
    targetScope: 'segment', targetFilter: { scope: 'segment', planTypes: ['per_property'], tiers: ['growth'], regions: ['id'] },
    visibleRoles: ['Admin', 'General Manager', 'Finance/HR'],
    dismissible: true, dismissalScope: 'account',
    startAt: daysAgo(2), endAt: daysFromNow(14),
    status: 'live', createdByStaffId: 'staff-1', createdAt: daysAgo(2),
  },
  {
    id: 'banner-3', title: 'New: Guest Guide templates',
    body: 'Five pre-built templates now available in your Brand settings.',
    severity: 'info',
    targetScope: 'individual', targetFilter: { scope: 'individual', tenantIds: ['t-1', 't-7'] },
    visibleRoles: ['Admin', 'General Manager'],
    dismissible: true, dismissalScope: 'user',
    startAt: daysFromNow(3), endAt: daysFromNow(30),
    status: 'scheduled', createdByStaffId: 'staff-1', createdAt: daysAgo(1),
  },
  {
    id: 'banner-4', title: 'Resolved: Stripe webhook latency',
    body: 'Issue resolved. No action needed.',
    severity: 'critical',
    targetScope: 'all', targetFilter: { scope: 'all' },
    visibleRoles: ['Admin'],
    dismissible: true, dismissalScope: 'user',
    startAt: daysAgo(20), endAt: daysAgo(13),
    status: 'expired', createdByStaffId: 'staff-1', createdAt: daysAgo(20),
  },
]

export const SEVERITY_LABEL: Record<BannerSeverity, string> = {
  info: 'Info', warning: 'Warning', critical: 'Critical',
}

export const BANNER_STATUS_LABEL: Record<BannerStatus, string> = {
  scheduled: 'Scheduled', live: 'Live', expired: 'Expired', retracted: 'Retracted',
}

export const BANNER_KIND_LABEL: Record<BannerKind, string> = {
  announcement: 'Announcement', maintenance: 'Maintenance',
}

export const MAINTENANCE_PHASE_LABEL: Record<MaintenancePhase, string> = {
  upcoming: 'Upcoming', in_progress: 'In progress', wrapping_up: 'Wrapping up', resolved: 'Resolved',
}

export const MAINTENANCE_IMPACT_LABEL: Record<MaintenanceImpact, string> = {
  offline: 'Offline during the window', degraded: 'May be slow or partly unavailable',
}

export function bannerKind(b: Pick<PlatformBanner, 'kind'>): BannerKind {
  return b.kind ?? 'announcement'
}

export function maintenancePhase(b: PlatformBanner, now = Date.now()): MaintenancePhase | null {
  if (bannerKind(b) !== 'maintenance' || !b.maintenance) return null
  // A withdrawn or ended banner has no phase: the status badge already says so,
  // and a time-derived "Upcoming" or "Wrapping up" would be stale.
  if (b.status === 'retracted') return null
  if (b.status === 'expired') return b.resolvedAt ? 'resolved' : null
  if (b.resolvedAt) return 'resolved'
  if (now < new Date(b.maintenance.startAt).getTime()) return 'upcoming'
  if (now <= new Date(b.maintenance.endAt).getTime()) return 'in_progress'
  return 'wrapping_up'
}

/** Staff can only resolve something that has started: a maintenance not yet under way is retracted instead. */
export function canResolve(b: PlatformBanner, now = Date.now()): boolean {
  if (b.status !== 'live' || b.resolvedAt) return false
  return maintenancePhase(b, now) !== 'upcoming'
}

/** When the last thing tenants should notice happened: go-live, or the newest update. */
export function lastActivityAt(b: PlatformBanner): string {
  const updates = b.updates ?? []
  const newest = updates.reduce((acc, u) => (u.createdAt > acc ? u.createdAt : acc), b.startAt)
  return newest
}
