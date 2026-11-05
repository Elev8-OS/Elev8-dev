export type StaffRole = 'viewer' | 'finance' | 'approver' | 'admin'

export type PermissionAction =
  | 'view_directory'
  | 'view_billing'
  | 'view_pricing'
  | 'view_users'
  | 'view_activity'
  | 'view_audit'
  | 'adjust_next_charge'
  | 'propose_override'
  | 'approve_override'
  | 'revoke_override'
  | 'compose_banner'
  | 'retract_banner'
  | 'manage_roles'

// 16 tenant-side role names (from existing useStaffAuth references in spec)
// Source of truth lives here; useStaffAuth re-exports.
export type StaffRoleName =
  | 'Admin' | 'General Manager' | 'Listing Manager'
  | 'Guest Experience Manager' | 'Quality Manager' | 'Back Office'
  | 'Finance/HR' | 'Housekeeping Manager'
  | 'Housekeeping' | 'Gardener' | 'Pool' | 'Engineering'
  | 'Electrician' | 'IT Team' | 'Laundry' | 'Owner'

export const ALL_STAFF_ROLES: StaffRoleName[] = [
  'Admin', 'General Manager', 'Listing Manager',
  'Guest Experience Manager', 'Quality Manager', 'Back Office',
  'Finance/HR', 'Housekeeping Manager',
  'Housekeeping', 'Gardener', 'Pool', 'Engineering',
  'Electrician', 'IT Team', 'Laundry', 'Owner',
]

// Role label shown in the RoleSwitcher
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  viewer: 'Platform Viewer',
  finance: 'Platform Finance',
  approver: 'Platform Approver',
  admin: 'Platform Admin',
}

// Single permission matrix. Order: viewer ⊂ finance ⊂ approver ⊂ admin
export const PERMISSIONS: Record<PermissionAction, StaffRole[]> = {
  view_directory: ['viewer', 'finance', 'approver', 'admin'],
  view_users: ['viewer', 'finance', 'approver', 'admin'],
  view_activity: ['viewer', 'finance', 'approver', 'admin'],
  view_billing: ['finance', 'approver', 'admin'],
  view_pricing: ['finance', 'approver', 'admin'],
  view_audit: ['finance', 'approver', 'admin'],
  adjust_next_charge: ['approver', 'admin'],
  propose_override: ['finance', 'approver', 'admin'],
  approve_override: ['approver', 'admin'],
  revoke_override: ['admin'],
  compose_banner: ['admin'],
  retract_banner: ['admin'],
  manage_roles: ['admin'],
}

export const STAFF_USERS = [
  { id: 'staff-1', name: 'Juliantara', role: 'admin' as StaffRole, label: 'Elev8 staff' },
  { id: 'staff-2', name: 'Made Wirawan', role: 'approver' as StaffRole, label: 'Finance Lead' },
  { id: 'staff-3', name: 'Komang Sari', role: 'finance' as StaffRole, label: 'Sales' },
  { id: 'staff-4', name: 'Wayan Putri', role: 'viewer' as StaffRole, label: 'Customer Support' },
]
