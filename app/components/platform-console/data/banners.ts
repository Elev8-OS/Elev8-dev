import type { TenantPlan, PackageTier, Region } from './tenants'
import type { StaffRoleName } from './staff'

export type BannerSeverity = 'info' | 'warning' | 'critical'
export type BannerStatus = 'scheduled' | 'live' | 'expired' | 'retracted'
export type TargetScope = 'all' | 'segment' | 'individual'
export type DismissalScope = 'account' | 'user'

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
    id: 'banner-1', title: 'Maintenance window — June 12, 02:00 UTC',
    body: 'Inbox and Reviews will be offline for ~30 min. Plan accordingly.',
    severity: 'critical', ctaLabel: 'View status', ctaUrl: 'https://status.elev8.io',
    targetScope: 'all', targetFilter: { scope: 'all' },
    visibleRoles: ['Admin', 'General Manager', 'Listing Manager', 'Guest Experience Manager', 'Finance/HR'],
    dismissible: true, dismissalScope: 'user',
    startAt: daysAgo(0), endAt: daysFromNow(7),
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