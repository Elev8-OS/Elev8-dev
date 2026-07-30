// app/components/users/data/roles.ts
import type { RoleNotifications } from '~/components/notifications/data/notification-settings'
import type { ModulePermissions, PermissionModule } from './permissions'
import { getDefaultRoleNotifications } from '~/components/notifications/data/notification-settings'
import { defaultPerms } from './permissions'

export type RoleId
  = | 'role-admin'
    | 'role-general-manager'
    | 'role-listing-manager'
    | 'role-guest-experience-manager'
    | 'role-quality-manager'
    | 'role-back-office'
    | 'role-finance-hr'
    | 'role-housekeeping-manager'
    | 'role-housekeeping'
    | 'role-gardener'
    | 'role-pool'
    | 'role-engineering'
    | 'role-electrician'
    | 'role-it-team'
    | 'role-laundry'
    | 'role-owner'

export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
export const WEEK_DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const ALL_DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAY_DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export interface WorkingHours {
  scheduleType: 'flexible' | 'fixed'
  startTime?: string
  endTime?: string
  days: WeekDay[]
}

export interface Role {
  id: RoleId
  name: string
  description: string
  workingHours: WorkingHours
  defaultPermissions: Record<PermissionModule, ModulePermissions>
  notifications: RoleNotifications
}

type AccessLevel = 'rw' | 'r' | 'no'
type DashboardPermissionPatch = Partial<Record<PermissionModule, Pick<ModulePermissions, 'dashboardView' | 'dashboardEdit'>>>
type MobilePermissionPatch = Partial<Record<PermissionModule, Pick<ModulePermissions, 'mobileView' | 'mobileEdit'>>>
type PermissionPatch = Partial<Record<PermissionModule, Partial<ModulePermissions>>>

function a(level: AccessLevel): Pick<ModulePermissions, 'dashboardView' | 'dashboardEdit'> {
  if (level === 'rw')
    return { dashboardView: true, dashboardEdit: true }
  if (level === 'r')
    return { dashboardView: true, dashboardEdit: false }
  return { dashboardView: false, dashboardEdit: false }
}

function buildPerms(patches: PermissionPatch): Record<PermissionModule, ModulePermissions> {
  const base = defaultPerms()
  for (const [module, patch] of Object.entries(patches)) {
    base[module as PermissionModule] = {
      ...base[module as PermissionModule],
      ...patch,
    }
  }
  return base
}

function withMobile(
  dashboard: DashboardPermissionPatch,
  mobile: MobilePermissionPatch,
): Record<PermissionModule, ModulePermissions> {
  const patch: PermissionPatch = {}
  for (const [module, value] of Object.entries(dashboard)) {
    patch[module as PermissionModule] = { ...patch[module as PermissionModule], ...value }
  }
  for (const [module, value] of Object.entries(mobile)) {
    patch[module as PermissionModule] = { ...patch[module as PermissionModule], ...value }
  }
  return buildPerms(patch)
}

const DASHBOARD_FULL_ACCESS: DashboardPermissionPatch = {
  dashboard: a('rw'),
  analytics: a('rw'),
  reservations: a('rw'),
  cockpit_calendar: a('rw'),
  journeys: a('rw'),
  iot_automations: a('rw'),
  listings: a('rw'),
  inbox: a('rw'),
  review_hub: a('rw'),
  task_reports: a('rw'),
  upsells: a('rw'),
  orders: a('rw'),
  cleaning_reports: a('rw'),
  housekeeping_schedule: a('rw'),
  activity_reports: a('rw'),
  finance: a('rw'),
  payment_requests: a('rw'),
  integrations: a('rw'),
  users: a('rw'),
  role_management: a('rw'),
  attendance_log: a('rw'),
  billing: a('rw'),
}

const MOBILE_FULL_ACCESS: MobilePermissionPatch = {
  reservations: { mobileView: true, mobileEdit: true },
  upcoming_checkin: { mobileView: true, mobileEdit: true },
  inbox: { mobileView: true, mobileEdit: true },
  iot_automations: { mobileView: true, mobileEdit: true },
  chatroom: { mobileView: true, mobileEdit: true },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: true, mobileEdit: true },
  cleaning: { mobileView: true, mobileEdit: true },
}

const MOBILE_SHARED_STAFF: MobilePermissionPatch = {
  reservations: { mobileView: true, mobileEdit: false },
  upcoming_checkin: { mobileView: true, mobileEdit: false },
  inbox: { mobileView: true, mobileEdit: true },
  iot_automations: { mobileView: true, mobileEdit: true },
  chatroom: { mobileView: true, mobileEdit: true },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: true, mobileEdit: true },
  cleaning: { mobileView: false, mobileEdit: false },
}

const MOBILE_FINANCE_HR: MobilePermissionPatch = {
  reservations: { mobileView: true, mobileEdit: false },
  upcoming_checkin: { mobileView: true, mobileEdit: false },
  inbox: { mobileView: true, mobileEdit: true },
  iot_automations: { mobileView: false, mobileEdit: false },
  chatroom: { mobileView: true, mobileEdit: true },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: true, mobileEdit: true },
  cleaning: { mobileView: false, mobileEdit: false },
}

const MOBILE_BACK_OFFICE: MobilePermissionPatch = {
  reservations: { mobileView: false, mobileEdit: false },
  upcoming_checkin: { mobileView: true, mobileEdit: false },
  inbox: { mobileView: true, mobileEdit: true },
  iot_automations: { mobileView: false, mobileEdit: false },
  chatroom: { mobileView: true, mobileEdit: true },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: true, mobileEdit: true },
  cleaning: { mobileView: false, mobileEdit: false },
}

const MOBILE_HOUSEKEEPING_MANAGER: MobilePermissionPatch = {
  reservations: { mobileView: true, mobileEdit: false },
  upcoming_checkin: { mobileView: true, mobileEdit: false },
  inbox: { mobileView: true, mobileEdit: true },
  iot_automations: { mobileView: true, mobileEdit: true },
  chatroom: { mobileView: true, mobileEdit: true },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: true, mobileEdit: true },
  cleaning: { mobileView: true, mobileEdit: true },
}

const MOBILE_HOUSEKEEPING: MobilePermissionPatch = {
  reservations: { mobileView: false, mobileEdit: false },
  upcoming_checkin: { mobileView: true, mobileEdit: false },
  inbox: { mobileView: true, mobileEdit: true },
  iot_automations: { mobileView: true, mobileEdit: true },
  chatroom: { mobileView: true, mobileEdit: true },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: true, mobileEdit: true },
  cleaning: { mobileView: true, mobileEdit: true },
}

const MOBILE_OPERATIONAL_STAFF: MobilePermissionPatch = {
  reservations: { mobileView: true, mobileEdit: false },
  upcoming_checkin: { mobileView: false, mobileEdit: false },
  inbox: { mobileView: true, mobileEdit: true },
  iot_automations: { mobileView: false, mobileEdit: false },
  chatroom: { mobileView: true, mobileEdit: true },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: true, mobileEdit: true },
  cleaning: { mobileView: false, mobileEdit: false },
}

const MOBILE_IT_TEAM: MobilePermissionPatch = {
  reservations: { mobileView: false, mobileEdit: false },
  upcoming_checkin: { mobileView: false, mobileEdit: false },
  inbox: { mobileView: true, mobileEdit: true },
  iot_automations: { mobileView: false, mobileEdit: false },
  chatroom: { mobileView: true, mobileEdit: true },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: true, mobileEdit: true },
  cleaning: { mobileView: false, mobileEdit: false },
}

const MOBILE_OWNER: MobilePermissionPatch = {
  reservations: { mobileView: true, mobileEdit: false },
  upcoming_checkin: { mobileView: false, mobileEdit: false },
  inbox: { mobileView: false, mobileEdit: false },
  iot_automations: { mobileView: false, mobileEdit: false },
  chatroom: { mobileView: false, mobileEdit: false },
  tasks: { mobileView: true, mobileEdit: true },
  activity_tracking: { mobileView: false, mobileEdit: false },
  cleaning: { mobileView: false, mobileEdit: false },
}

export const defaultRoles: Role[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Tenant administrator with full access to every module, settings, and configuration.',
    workingHours: { scheduleType: 'flexible', days: ALL_DAYS },
    notifications: getDefaultRoleNotifications('role-admin'),
    defaultPermissions: withMobile(DASHBOARD_FULL_ACCESS, MOBILE_FULL_ACCESS),
  },
  {
    id: 'role-general-manager',
    name: 'General Manager',
    description: 'Oversees all daily operations of the properties. Has broad access to manage staff, financials, guest relations, and property maintenance.',
    workingHours: { scheduleType: 'flexible', days: ALL_DAYS },
    notifications: getDefaultRoleNotifications('role-general-manager'),
    defaultPermissions: withMobile({
      dashboard: a('rw'),
      analytics: a('rw'),
      reservations: a('rw'),
      cockpit_calendar: a('rw'),
      journeys: a('rw'),
      iot_automations: a('rw'),
      listings: a('rw'),
      inbox: a('rw'),
      review_hub: a('rw'),
      task_reports: a('rw'),
      upsells: a('rw'),
      orders: a('rw'),
      cleaning_reports: a('rw'),
      housekeeping_schedule: a('rw'),
      activity_reports: a('rw'),
      finance: a('no'),
      payment_requests: a('rw'),
      integrations: a('rw'),
      users: a('rw'),
      role_management: a('no'),
      attendance_log: a('rw'),
      billing: a('no'),
    }, MOBILE_SHARED_STAFF),
  },
  {
    id: 'role-listing-manager',
    name: 'Listing Manager',
    description: 'Manages property listings on all booking platforms. Responsible for pricing, availability, and marketing content to maximize occupancy and revenue.',
    workingHours: { scheduleType: 'flexible', days: ALL_DAYS },
    notifications: getDefaultRoleNotifications('role-listing-manager'),
    defaultPermissions: withMobile({
      dashboard: a('r'),
      analytics: a('no'),
      reservations: a('rw'),
      cockpit_calendar: a('rw'),
      journeys: a('rw'),
      iot_automations: a('rw'),
      listings: a('rw'),
      inbox: a('rw'),
      review_hub: a('no'),
      task_reports: a('rw'),
      upsells: a('rw'),
      orders: a('rw'),
      cleaning_reports: a('rw'),
      housekeeping_schedule: a('rw'),
      activity_reports: a('rw'),
      finance: a('no'),
      payment_requests: a('rw'),
      integrations: a('rw'),
      users: a('no'),
      role_management: a('no'),
      attendance_log: a('rw'),
      billing: a('no'),
    }, MOBILE_SHARED_STAFF),
  },
  {
    id: 'role-guest-experience-manager',
    name: 'Guest Experience Manager',
    description: 'Ensures a five-star guest experience from check-in to check-out. Handles all guest communication, special requests, and resolves any issues that arise during their stay.',
    workingHours: { scheduleType: 'flexible', days: ALL_DAYS },
    notifications: getDefaultRoleNotifications('role-guest-experience-manager'),
    defaultPermissions: withMobile({
      dashboard: a('r'),
      analytics: a('no'),
      reservations: a('rw'),
      cockpit_calendar: a('rw'),
      journeys: a('rw'),
      iot_automations: a('rw'),
      listings: a('rw'),
      inbox: a('rw'),
      review_hub: a('rw'),
      task_reports: a('rw'),
      upsells: a('rw'),
      orders: a('rw'),
      cleaning_reports: a('r'),
      housekeeping_schedule: a('r'),
      activity_reports: a('no'),
      finance: a('no'),
      payment_requests: a('rw'),
      integrations: a('no'),
      users: a('no'),
      role_management: a('no'),
      attendance_log: a('no'),
      billing: a('no'),
    }, MOBILE_SHARED_STAFF),
  },
  {
    id: 'role-quality-manager',
    name: 'Quality Manager',
    description: 'Responsible for upholding property standards. Conducts regular inspections, manages guest feedback, and coordinates with other teams to ensure consistent quality control.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-quality-manager'),
    defaultPermissions: withMobile({
      dashboard: a('r'),
      analytics: a('no'),
      reservations: a('r'),
      cockpit_calendar: a('r'),
      journeys: a('r'),
      iot_automations: a('r'),
      listings: a('r'),
      inbox: a('r'),
      review_hub: a('no'),
      task_reports: a('rw'),
      upsells: a('r'),
      orders: a('r'),
      cleaning_reports: a('r'),
      housekeeping_schedule: a('r'),
      activity_reports: a('r'),
      finance: a('no'),
      payment_requests: a('no'),
      integrations: a('no'),
      users: a('no'),
      role_management: a('no'),
      attendance_log: a('no'),
      billing: a('no'),
    }, MOBILE_SHARED_STAFF),
  },
  {
    id: 'role-back-office',
    name: 'Back Office',
    description: 'Handles administrative tasks, data entry, and general support for management. Can access reports and company documents but has limited editing permissions.',
    workingHours: { scheduleType: 'fixed', startTime: '08:00', endTime: '17:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-back-office'),
    defaultPermissions: withMobile({
      dashboard: a('r'),
      analytics: a('no'),
      reservations: a('r'),
      cockpit_calendar: a('no'),
      journeys: a('no'),
      iot_automations: a('no'),
      listings: a('rw'),
      inbox: a('r'),
      review_hub: a('no'),
      task_reports: a('rw'),
      upsells: a('r'),
      orders: a('r'),
      cleaning_reports: a('rw'),
      housekeeping_schedule: a('r'),
      activity_reports: a('no'),
      finance: a('no'),
      payment_requests: a('r'),
      integrations: a('r'),
      users: a('no'),
      role_management: a('no'),
      attendance_log: a('no'),
      billing: a('no'),
    }, MOBILE_BACK_OFFICE),
  },
  {
    id: 'role-finance-hr',
    name: 'Finance/HR',
    description: 'Manages payroll, invoicing, company expenses, and human resources tasks like onboarding and employee records. Has access to sensitive financial and employee data.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-finance-hr'),
    defaultPermissions: withMobile({
      dashboard: a('r'),
      analytics: a('rw'),
      reservations: a('r'),
      cockpit_calendar: a('no'),
      journeys: a('no'),
      iot_automations: a('no'),
      listings: a('r'),
      inbox: a('no'),
      review_hub: a('no'),
      task_reports: a('no'),
      upsells: a('no'),
      orders: a('no'),
      cleaning_reports: a('rw'),
      housekeeping_schedule: a('r'),
      activity_reports: a('rw'),
      finance: a('rw'),
      payment_requests: a('rw'),
      integrations: a('no'),
      users: a('rw'),
      role_management: a('no'),
      attendance_log: a('rw'),
      billing: a('no'),
    }, MOBILE_FINANCE_HR),
  },
  {
    id: 'role-housekeeping-manager',
    name: 'Housekeeping Manager',
    description: 'Responsible for overseeing all housekeeping operations. Ensures properties are cleaned, prepared, and inspected to the highest standard before guest arrivals. Can manage cleaning schedules, assign tasks, and review reports.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-housekeeping-manager'),
    defaultPermissions: withMobile({
      dashboard: a('no'),
      analytics: a('no'),
      reservations: a('r'),
      cockpit_calendar: a('r'),
      journeys: a('no'),
      iot_automations: a('no'),
      listings: a('rw'),
      inbox: a('no'),
      review_hub: a('no'),
      task_reports: a('rw'),
      upsells: a('no'),
      orders: a('no'),
      cleaning_reports: a('rw'),
      housekeeping_schedule: a('rw'),
      activity_reports: a('no'),
      finance: a('no'),
      payment_requests: a('no'),
      integrations: a('no'),
      users: a('no'),
      role_management: a('no'),
      attendance_log: a('no'),
      billing: a('no'),
    }, MOBILE_HOUSEKEEPING_MANAGER),
  },
  {
    id: 'role-housekeeping',
    name: 'Housekeeping',
    description: 'Responsible for the cleaning and preparation of properties for guest arrivals. Can view cleaning schedules, report maintenance issues, and update property status.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: ALL_DAYS },
    notifications: getDefaultRoleNotifications('role-housekeeping'),
    defaultPermissions: withMobile({}, MOBILE_HOUSEKEEPING),
  },
  {
    id: 'role-gardener',
    name: 'Gardener',
    description: 'Maintains the gardens, landscaping, and all outdoor areas of the properties. Can view work schedules and report on landscaping needs.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-gardener'),
    defaultPermissions: withMobile({}, MOBILE_OPERATIONAL_STAFF),
  },
  {
    id: 'role-pool',
    name: 'Pool',
    description: 'Responsible for the cleaning, maintenance, and chemical balancing of all swimming pools. Can view maintenance schedules and log service reports.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-pool'),
    defaultPermissions: withMobile({}, MOBILE_OPERATIONAL_STAFF),
  },
  {
    id: 'role-engineering',
    name: 'Engineering',
    description: 'Oversees general property maintenance and repairs. Manages the maintenance team, assigns tasks, and tracks the completion of work orders.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-engineering'),
    defaultPermissions: withMobile({}, MOBILE_OPERATIONAL_STAFF),
  },
  {
    id: 'role-electrician',
    name: 'Electrician',
    description: 'Specialized role for handling all electrical installations, repairs, and safety checks. Can access and respond to electrical-specific maintenance requests.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-electrician'),
    defaultPermissions: withMobile({}, MOBILE_OPERATIONAL_STAFF),
  },
  {
    id: 'role-it-team',
    name: 'IT Team',
    description: 'Manages the company\'s technology infrastructure, including Wi-Fi, smart home devices, and software systems. Provides technical support to staff and guests.',
    workingHours: { scheduleType: 'flexible', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    notifications: getDefaultRoleNotifications('role-it-team'),
    defaultPermissions: withMobile({}, MOBILE_IT_TEAM),
  },
  {
    id: 'role-laundry',
    name: 'Laundry',
    description: 'Manages the collection, washing, drying, and distribution of linens and towels for all listings. Can view schedules and report on linen inventory levels.',
    workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-laundry'),
    defaultPermissions: withMobile({}, MOBILE_IT_TEAM),
  },
  {
    id: 'role-owner',
    name: 'Owner',
    description: 'Property owner with high-level visibility into reservations and overall business performance. Can view guest reservations and stay activity, but does not manage daily operations, listings, payments, staff, or system configuration unless explicitly granted additional permissions.',
    workingHours: { scheduleType: 'flexible', days: WEEKDAY_DAYS },
    notifications: getDefaultRoleNotifications('role-owner'),
    defaultPermissions: withMobile({
      dashboard: a('r'),
      analytics: a('no'),
      reservations: a('no'),
      cockpit_calendar: a('r'),
      journeys: a('no'),
      iot_automations: a('no'),
      listings: a('no'),
      inbox: a('no'),
      review_hub: a('no'),
      task_reports: a('no'),
      upsells: a('no'),
      orders: a('no'),
      cleaning_reports: a('no'),
      housekeeping_schedule: a('no'),
      activity_reports: a('no'),
      finance: a('no'),
      payment_requests: a('no'),
      integrations: a('no'),
      users: a('no'),
      role_management: a('no'),
      attendance_log: a('no'),
      billing: a('no'),
    }, MOBILE_OWNER),
  },
]

// Helper to find a role's defaults (used by "Reset to defaults" button)
export function findDefaultRole(id: RoleId): Role | undefined {
  return defaultRoles.find(r => r.id === id)
}

export function isRoleId(value: string): value is RoleId {
  return defaultRoles.some(r => r.id === value)
}
