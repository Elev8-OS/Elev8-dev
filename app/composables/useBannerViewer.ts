import type { StaffRoleName } from '~/components/platform-console/data/staff'

/**
 * Who is reading platform broadcasts in the tenant dashboard.
 *
 * The prototype has no tenant session, so this is fixed to the demo tenant and
 * the Admin role, which every seeded banner reaches. Wire a real session here
 * and the banner strip, the announcements page and the bell link follow.
 */
export function useBannerViewer(): { tenantId: string, role: StaffRoleName } {
  return { tenantId: 't-1', role: 'Admin' }
}
