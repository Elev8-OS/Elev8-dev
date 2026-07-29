// app/components/users/data/permissions.ts

export type PermissionModule
  // Dashboard modules
  = | 'dashboard'
    | 'analytics'
    | 'reservations'
    | 'cockpit_calendar'
    | 'journeys'
    | 'iot_automations'
    | 'listings'
    | 'inbox'
    | 'review_hub'
    | 'task_reports'
    | 'upsells'
    | 'orders'
    | 'cleaning_reports'
    | 'housekeeping_schedule'
    | 'activity_reports'
    | 'finance'
    | 'payment_requests'
    | 'integrations'
    | 'users'
    | 'role_management'
    | 'attendance_log'
    | 'billing'
  // Mobile-only modules
    | 'upcoming_checkin'
    | 'chatroom'
    | 'tasks'
    | 'cleaning'
    | 'activity_tracking'

export interface ModulePermissions {
  dashboardView: boolean
  dashboardEdit: boolean
  mobileView: boolean
  mobileEdit: boolean
}

export const DASHBOARD_PERMISSION_MODULES: { id: PermissionModule, label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'cockpit_calendar', label: 'Cockpit (Calendar)' },
  { id: 'journeys', label: 'Journey' },
  { id: 'iot_automations', label: 'IoT and Automations' },
  { id: 'listings', label: 'Listing Content/Listing Details' },
  { id: 'inbox', label: 'Guest Inbox' },
  { id: 'review_hub', label: 'Review Hub' },
  { id: 'task_reports', label: 'Task Reports' },
  { id: 'upsells', label: 'Upsells' },
  { id: 'orders', label: 'Orders' },
  { id: 'cleaning_reports', label: 'Cleaning Reports' },
  { id: 'housekeeping_schedule', label: 'Housekeeping Schedule' },
  { id: 'activity_reports', label: 'Activity Reports' },
  { id: 'finance', label: 'Finance' },
  { id: 'payment_requests', label: 'Payment Requests' },
  { id: 'integrations', label: 'Integrations (API/Smart Locks)' },
  { id: 'users', label: 'Users' },
  { id: 'role_management', label: 'Role Managements' },
  { id: 'attendance_log', label: 'Attendance Log' },
  { id: 'billing', label: 'Billing' },
]

export const MOBILE_PERMISSION_MODULES: { id: PermissionModule, label: string }[] = [
  { id: 'reservations', label: 'Reservation' },
  { id: 'upcoming_checkin', label: 'Upcoming Check-in' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'iot_automations', label: 'IoT and Automations' },
  { id: 'chatroom', label: 'Internal Inbox' },
  { id: 'tasks', label: 'Task' },
  { id: 'activity_tracking', label: 'Activity (Time Tracking)' },
  { id: 'cleaning', label: 'Cleaning' },
]

export const PERMISSION_MODULES: { id: PermissionModule, label: string }[] = [
  ...DASHBOARD_PERMISSION_MODULES,
  ...MOBILE_PERMISSION_MODULES.filter(m => !DASHBOARD_PERMISSION_MODULES.some(d => d.id === m.id)),
]

// Default permissions for an empty role (deny everything)
export function emptyModulePermissions(): ModulePermissions {
  return {
    dashboardView: false,
    dashboardEdit: false,
    mobileView: false,
    mobileEdit: false,
  }
}

// Convenience helpers
export function hasAnyAccess(p: ModulePermissions): boolean {
  return p.dashboardView || p.dashboardEdit || p.mobileView || p.mobileEdit
}

export function defaultPerms(): Record<PermissionModule, ModulePermissions> {
  return PERMISSION_MODULES.reduce(
    (acc, m) => ({ ...acc, [m.id]: emptyModulePermissions() }),
    {} as Record<PermissionModule, ModulePermissions>,
  )
}
