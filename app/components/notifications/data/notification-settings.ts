import type { AlertType } from './alerts'
import type { RoleId } from '~/components/users/data/roles'

export type NotificationChannel = 'in_app' | 'email' | 'mobile'

export interface RoleNotifications {
  enabledAlertTypes: AlertType[]
  channels: NotificationChannel[]
}

export type NotificationKind = 'system' | 'cleaning' | 'calls' | 'reviews' | 'upsell' | 'guest_activity'

export type NotificationCategoryId
  = | 'guest_activity'
    | 'cleaning'
    | 'tasks'
    | 'finance'
    | 'reviews'
    | 'upsells'
    | 'smart_locks'
    | 'system'

export interface NotificationCategoryDefinition {
  id: NotificationCategoryId
  label: string
  description: string
  alertTypes: AlertType[]
}

export const notificationChannels: { value: NotificationChannel, label: string, description: string }[] = [
  { value: 'in_app', label: 'In-app notification center', description: 'Show alerts in the dashboard bell.' },
  { value: 'email', label: 'Email', description: 'Configured for future email delivery.' },
  { value: 'mobile', label: 'Mobile / push', description: 'Configured for future mobile delivery.' },
]

// Non-owner alert types only — owner portal activity stays out of the role
// notification settings so dashboards never expose OWNER_* types in the editor.
const GUEST_ACTIVITY_TYPES: AlertType[] = [
  'GUEST_CHECKED_IN',
  'GUEST_CHECKED_OUT',
  'GUEST_ARRIVAL_SOON',
]

const CLEANING_TYPES: AlertType[] = [
  'CLEANING_NOT_STARTED_IMMINENT',
  'CLEANING_NOT_DONE_CHECKIN_PASSED',
  'NO_HOUSEKEEPING_ASSIGNED',
]

const TASK_TYPES: AlertType[] = [
  'TASK_OVERDUE',
]

const FINANCE_TYPES: AlertType[] = [
  'STRIPE_DISCONNECTED',
  'DEPOSIT_FAILED_AT_CHECKIN',
  'BOOKING_QUOTA_EMPTY',
  'BOOKING_QUOTA_LOW',
  'RATE_PLAN_UNMAPPED',
  'WARRANTY_EXPIRING_SOON',
  'WARRANTY_EXPIRED',
]

const REVIEW_TYPES: AlertType[] = [
  'AIRBNB_REVIEW_GENERATED',
  'AIRBNB_REVIEW_POSTED',
  'AIRBNB_REVIEW_FAILED',
  'REVIEW_GUEST_LEFT',
  'REVIEW_HOST_DUE',
]

const UPSELL_TYPES: AlertType[] = [
  'UPSELL_ORDER_REQUESTED',
  'UPSELL_ORDER_APPROVED',
  'UPSELL_ORDER_DECLINED',
  'UPSELL_PAYMENT_RECEIVED',
  'UPSELL_FULFILLMENT_STARTED',
  'UPSELL_FULFILLMENT_COMPLETED',
]

const SMART_LOCK_TYPES: AlertType[] = [
  'SMART_LOCK_DEAD',
  'SMART_LOCK_OFFLINE',
  'SMART_LOCK_CODE_FAILED',
  'SMART_LOCK_BATTERY_CRITICAL',
  'SMART_LOCK_BATTERY_LOW',
]

const SYSTEM_TYPES: AlertType[] = [
  'CHANNEL_DISCONNECTED',
  'DOUBLE_BOOKING',
  'BRIDGE_OFFLINE',
  'DYNAMIC_TEMPLATE_FAILED',
  'GUEST_GUIDE_NOT_SENT',
  'GUEST_GUIDE_OPENED',
  'GUEST_GUIDE_SUBMITTED',
  'KEY_NOT_RETURNED',
  'CALL_INCOMING',
  'CALL_MISSED',
  'CALL_COMPLETED',
]

// Subsets of SYSTEM_TYPES re-used by roles that should NOT receive every
// system alert — e.g. Guest Experience Manager only needs calls + guest
// guide signals, not channel/bridge/key/double-booking infrastructure alerts.
const CALL_TYPES: AlertType[] = [
  'CALL_INCOMING',
  'CALL_MISSED',
  'CALL_COMPLETED',
]

const GUEST_GUIDE_TYPES: AlertType[] = [
  'GUEST_GUIDE_NOT_SENT',
  'GUEST_GUIDE_OPENED',
  'GUEST_GUIDE_SUBMITTED',
]

export const notificationCategories: NotificationCategoryDefinition[] = [
  {
    id: 'guest_activity',
    label: 'Guest Activity',
    description: 'Arrivals, check-ins, and check-outs that trigger housekeeping and guest relations work.',
    alertTypes: GUEST_ACTIVITY_TYPES,
  },
  {
    id: 'cleaning',
    label: 'Cleaning',
    description: 'Cleaning job start, completion, and assignment alerts.',
    alertTypes: CLEANING_TYPES,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Operational task reminders and overdue notifications.',
    alertTypes: TASK_TYPES,
  },
  {
    id: 'finance',
    label: 'Finance & Inventory',
    description: 'Payment, booking quota, rate plan, and warranty alerts.',
    alertTypes: FINANCE_TYPES,
  },
  {
    id: 'reviews',
    label: 'Reviews',
    description: 'Guest review generation, posting, and host review due dates.',
    alertTypes: REVIEW_TYPES,
  },
  {
    id: 'upsells',
    label: 'Upsells',
    description: 'Upsell order requests, approvals, payments, and fulfillment milestones.',
    alertTypes: UPSELL_TYPES,
  },
  {
    id: 'smart_locks',
    label: 'Smart Locks',
    description: 'Smart lock battery, offline, and access code failure alerts.',
    alertTypes: SMART_LOCK_TYPES,
  },
  {
    id: 'system',
    label: 'System',
    description: 'Channel, bridge, dynamic templates, guest guide, keys, and incoming/missed/completed calls.',
    alertTypes: SYSTEM_TYPES,
  },
]

const ALLOWED_CHANNELS: NotificationChannel[] = ['in_app', 'email', 'mobile']

const ALL_SUPPORTED_TYPES: AlertType[] = notificationCategories.flatMap(
  category => category.alertTypes,
)

const ALL_CHANNELS: NotificationChannel[] = ['in_app', 'email', 'mobile']

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function buildPolicy(
  alertTypes: AlertType[],
  channels: NotificationChannel[],
): RoleNotifications {
  return {
    enabledAlertTypes: dedupe(alertTypes),
    channels: dedupe(channels),
  }
}

function buildFullPolicy(): RoleNotifications {
  return buildPolicy(ALL_SUPPORTED_TYPES, ALL_CHANNELS)
}

// Per-role default policies. Keep the brief's invariants:
// - Admin + GM get every supported alert type and every channel
// - Housekeeping + Housekeeping Manager cover guest activity, cleaning,
//   tasks, and smart locks with in-app + mobile
// - Guest Experience Manager covers guest activity, calls, reviews,
//   upsells, and guest-guide (all part of "system") with in-app + email
// - Finance/HR covers finance and operational task alerts with in-app + email
// - Other operational staff receive only their operational alert with in-app
// - Owner defaults never include OWNER_* types
const ROLE_DEFAULTS: Record<RoleId, RoleNotifications> = {
  'role-admin': buildFullPolicy(),
  'role-general-manager': buildFullPolicy(),
  'role-listing-manager': buildPolicy(
    [...GUEST_ACTIVITY_TYPES, ...CLEANING_TYPES, ...TASK_TYPES, ...FINANCE_TYPES, ...REVIEW_TYPES, ...UPSELL_TYPES, ...SMART_LOCK_TYPES, ...SYSTEM_TYPES],
    ['in_app', 'email'],
  ),
  'role-guest-experience-manager': buildPolicy(
    [...GUEST_ACTIVITY_TYPES, ...CALL_TYPES, ...REVIEW_TYPES, ...UPSELL_TYPES, ...GUEST_GUIDE_TYPES],
    ['in_app', 'email'],
  ),
  'role-quality-manager': buildPolicy(
    [...TASK_TYPES, ...REVIEW_TYPES],
    ['in_app', 'email'],
  ),
  'role-back-office': buildPolicy(
    [...TASK_TYPES, ...FINANCE_TYPES, ...UPSELL_TYPES],
    ['in_app', 'email'],
  ),
  'role-finance-hr': buildPolicy(
    [...FINANCE_TYPES, ...TASK_TYPES],
    ['in_app', 'email'],
  ),
  'role-housekeeping-manager': buildPolicy(
    [...GUEST_ACTIVITY_TYPES, ...CLEANING_TYPES, ...TASK_TYPES, ...SMART_LOCK_TYPES],
    ['in_app', 'mobile'],
  ),
  'role-housekeeping': buildPolicy(
    [...GUEST_ACTIVITY_TYPES, ...CLEANING_TYPES, ...TASK_TYPES, ...SMART_LOCK_TYPES],
    ['in_app', 'mobile'],
  ),
  'role-gardener': buildPolicy(TASK_TYPES, ['in_app']),
  'role-pool': buildPolicy(TASK_TYPES, ['in_app']),
  'role-engineering': buildPolicy(TASK_TYPES, ['in_app']),
  'role-electrician': buildPolicy(TASK_TYPES, ['in_app']),
  'role-it-team': buildPolicy(TASK_TYPES, ['in_app']),
  'role-laundry': buildPolicy(TASK_TYPES, ['in_app']),
  // Owner defaults never include OWNER_* types — owner portal activity
  // lives in a separate surface.
  'role-owner': buildPolicy([], ['in_app']),
}

export function getDefaultRoleNotifications(roleId: RoleId): RoleNotifications {
  const defaults = ROLE_DEFAULTS[roleId]
  if (defaults)
    return cloneRoleNotifications(defaults)
  // Unknown role id — fall back to the safest baseline (in-app only).
  return buildPolicy([], ['in_app'])
}

export function cloneRoleNotifications(value: RoleNotifications): RoleNotifications {
  return {
    enabledAlertTypes: [...value.enabledAlertTypes],
    channels: [...value.channels],
  }
}

function sanitizeAlertTypes(input: unknown): AlertType[] {
  if (!Array.isArray(input))
    return []
  return dedupe(
    input.filter(
      (value): value is AlertType =>
        typeof value === 'string' && (ALL_SUPPORTED_TYPES as string[]).includes(value),
    ),
  )
}

function sanitizeChannels(input: unknown): NotificationChannel[] {
  if (!Array.isArray(input))
    return []
  return dedupe(
    input.filter(
      (value): value is NotificationChannel =>
        typeof value === 'string' && (ALLOWED_CHANNELS as string[]).includes(value),
    ),
  )
}

export function normalizeRoleNotifications(
  value: unknown,
  roleId: RoleId,
): RoleNotifications {
  const defaults = getDefaultRoleNotifications(roleId)

  if (!value || typeof value !== 'object')
    return defaults

  const candidate = value as Partial<RoleNotifications>
  const enabledAlertTypes = sanitizeAlertTypes(candidate.enabledAlertTypes)
  const channels = sanitizeChannels(candidate.channels)

  // If either list collapses to empty, fall back to the role defaults
  // — every role must keep at least the in-app channel and at least
  // one alert type so a malformed payload cannot strip the policy bare.
  if (enabledAlertTypes.length === 0 || channels.length === 0)
    return defaults

  return {
    enabledAlertTypes,
    channels,
  }
}

// Reverse lookup table — AlertType → NotificationCategoryId. Built once from
// `notificationCategories` so callers cannot drift from the source of truth.
const ALERT_TYPE_CATEGORY_MAP: Map<AlertType, NotificationCategoryId> = (() => {
  const map = new Map<AlertType, NotificationCategoryId>()
  for (const category of notificationCategories) {
    for (const type of category.alertTypes)
      map.set(type, category.id)
  }
  return map
})()

export function getNotificationCategoryId(type: AlertType): NotificationCategoryId {
  // OWNER_* types are intentionally absent from `notificationCategories` (owner
  // activity lives in the owner portal), and any unknown/future AlertType will
  // also miss the map. In both cases we fall back to 'system' — the role
  // editor never surfaces these types anyway because they aren't in the
  // category list, so this fallback is a safe default for routing/labels.
  return ALERT_TYPE_CATEGORY_MAP.get(type) ?? 'system'
}

export function getNotificationKind(type: AlertType): NotificationKind {
  if (GUEST_ACTIVITY_TYPES.includes(type))
    return 'guest_activity'
  if (type.startsWith('CALL_'))
    return 'calls'
  if (CLEANING_TYPES.includes(type))
    return 'cleaning'
  if (REVIEW_TYPES.includes(type))
    return 'reviews'
  if (UPSELL_TYPES.includes(type))
    return 'upsell'
  return 'system'
}
