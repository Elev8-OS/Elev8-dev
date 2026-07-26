# Role-Based Notification Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-level alert-type and delivery-channel configuration, then use it to route guest activity alerts such as guest checkout notifications to assigned housekeeping users.

**Architecture:** Keep notification policy on the existing `Role` model and persist it through `useRoles`/`elev8-tenant-roles`. Centralize alert-category metadata in a focused notification-settings data module, use a pure routing helper for role/channel/listing filtering, and keep `useNotifications` responsible for reactive state and current-user integration. Add a focused `NotificationSettings.vue` editor to `RoleDetailSheet.vue`; do not add personal overrides or a second auth system.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, shadcn-vue/reka UI, Vue Test Utils, Vitest, jsdom.

---

## File map

| File | Responsibility |
| --- | --- |
| `app/components/notifications/data/alerts.ts` | Extend the central alert union, labels, icons, routes, and descriptions with guest activity events. |
| `app/components/notifications/data/notification-settings.ts` | Define notification channels, category metadata, supported role-alert types, defaults, and normalization. |
| `app/components/users/data/roles.ts` | Add `Role.notifications` and attach defaults to all 16 system roles. |
| `app/composables/useRoles.ts` | Migrate old local-storage roles and normalize notification settings on load/update. |
| `app/lib/notification-routing.ts` | Pure role/channel/listing visibility predicates that can be tested without Nuxt state. |
| `app/composables/useCurrentDashboardUser.ts` | Resolve the existing mock dashboard user (`user-1`) without introducing personal preferences. |
| `app/composables/useNotifications.ts` | Apply role visibility before active/unread/severity/kind filtering and expose guest-alert creation. |
| `app/components/notifications/NotificationCenter.vue` | Add the Guest Activity kind filter and use role-filtered alert collections. |
| `app/components/users/NotificationSettings.vue` | Present role notification channels and grouped alert-type controls. |
| `app/components/users/RoleDetailSheet.vue` | Embed the notification editor and save/reset the new role field. |
| `app/composables/useCleaningJobs.ts` | Emit `GUEST_CHECKED_OUT` when a checkout cleaning job is created. |
| `tests/components/users/NotificationSettings.spec.ts` | Test channel/category/alert selection behavior. |
| `tests/composables/useRoles-notifications.spec.ts` | Test default role data, migration, save, and reset behavior. |
| `tests/lib/notification-routing.spec.ts` | Test role, channel, and listing assignment filtering. |
| `tests/composables/useNotifications.spec.ts` | Test visible alerts, unread counts, kind filters, and guest alert creation. |
| `tests/composables/useCleaningJobs-notifications.spec.ts` | Test checkout cleaning creation emits the guest checkout alert. |

No new API route or server persistence is needed for this mock-only feature.

---

### Task 1: Add guest alert types and notification policy metadata

**Files:**
- Modify: `app/components/notifications/data/alerts.ts:1-155,204-287`
- Create: `app/components/notifications/data/notification-settings.ts`
- Test: `tests/composables/useRoles-notifications.spec.ts`

- [ ] **Step 1: Write the failing metadata tests**

Create a Vitest test that expects guest lifecycle metadata and excludes owner activity from role categories:

```ts
import { describe, expect, it } from 'vitest'
import type { AlertType } from '~/components/notifications/data/alerts'
import { alertDisplayLabels } from '~/components/notifications/data/alerts'
import {
  notificationCategories,
  getDefaultRoleNotifications,
  normalizeRoleNotifications,
} from '~/components/notifications/data/notification-settings'

describe('notification settings metadata', () => {
  it('defines guest checkout as a role-configurable alert', () => {
    const guestCategory = notificationCategories.find(category => category.id === 'guest_activity')
    expect(guestCategory?.alertTypes).toContain('GUEST_CHECKED_OUT')
    expect(alertDisplayLabels.GUEST_CHECKED_OUT).toBe('Guest Checked Out')
  })

  it('does not expose owner activity in role categories', () => {
    const configuredTypes = notificationCategories.flatMap(category => category.alertTypes)
    expect(configuredTypes).not.toContain('OWNER_STATEMENT_DRAFT_READY')
    expect(configuredTypes).not.toContain('OWNER_STAY_CONFIRMED')
  })

  it('enables checkout alerts for housekeeping roles', () => {
    expect(getDefaultRoleNotifications('role-housekeeping').enabledAlertTypes)
      .toContain('GUEST_CHECKED_OUT')
    expect(getDefaultRoleNotifications('role-housekeeping-manager').enabledAlertTypes)
      .toContain('GUEST_CHECKED_OUT')
  })

  it('normalizes malformed policies to safe defaults', () => {
    const normalized = normalizeRoleNotifications({
      enabledAlertTypes: ['NOT_A_REAL_ALERT' as AlertType],
      channels: ['pager' as never],
    }, 'role-housekeeping')

    expect(normalized.enabledAlertTypes).toEqual(
      getDefaultRoleNotifications('role-housekeeping').enabledAlertTypes,
    )
    expect(normalized.channels).toEqual(['in_app', 'mobile'])
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run tests/composables/useRoles-notifications.spec.ts
```

Expected: FAIL because the guest alert constants and notification-settings module do not exist yet.

- [ ] **Step 3: Extend `AlertType` and its metadata**

Add these alert types to `app/components/notifications/data/alerts.ts`:

```ts
| 'GUEST_CHECKED_IN'
| 'GUEST_CHECKED_OUT'
| 'GUEST_ARRIVAL_SOON'
```

Add matching entries to `alertDisplayLabels`, `alertIcons`, and `alertRouteMap`:

```ts
GUEST_CHECKED_IN: 'Guest Checked In',
GUEST_CHECKED_OUT: 'Guest Checked Out',
GUEST_ARRIVAL_SOON: 'Guest Arrival Soon',
```

Use `i-lucide:log-in`, `i-lucide:log-out`, and `i-lucide:clock-3`. Route guest activity to `/inbox` so the notification opens the relevant guest/reservation workflow.

Add description cases before the existing owner cases:

```ts
case 'GUEST_CHECKED_IN':
  return `${context.guest_name || 'Guest'} checked in at ${context.listing_name || 'property'}.`
case 'GUEST_CHECKED_OUT':
  return `${context.guest_name || 'Guest'} checked out of ${context.listing_name || 'property'}. Housekeeping has been notified.`
case 'GUEST_ARRIVAL_SOON':
  return `${context.guest_name || 'Guest'} arrives soon at ${context.listing_name || 'property'}.`
```

- [ ] **Step 4: Create the centralized policy metadata module**

Create `app/components/notifications/data/notification-settings.ts` with these concrete interfaces and exports:

```ts
import type { AlertType } from './alerts'
import type { RoleId } from '~/components/users/data/roles'

export type NotificationChannel = 'in_app' | 'email' | 'mobile'

export interface RoleNotifications {
  enabledAlertTypes: AlertType[]
  channels: NotificationChannel[]
}

export type NotificationKind = 'system' | 'cleaning' | 'calls' | 'reviews' | 'upsell' | 'guest_activity'

export type NotificationCategoryId =
  | 'guest_activity'
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
```

Define `notificationCategories` with the supported non-owner alert types. The Guest Activity category must contain the three new guest types; existing cleaning, call/review/upsell types must remain assigned to their current filters. Keep call alerts mapped to the existing `calls` Notification Center kind even if they are shown under the System category in the role editor; this preserves the current Calls filter without adding an extra role-editor category.

Implement:

```ts
export function getDefaultRoleNotifications(roleId: RoleId): RoleNotifications
export function normalizeRoleNotifications(value: unknown, roleId: RoleId): RoleNotifications
export function getNotificationCategoryId(type: AlertType): NotificationCategoryId
export function getNotificationKind(type: AlertType): NotificationKind
export function cloneRoleNotifications(value: RoleNotifications)
```

Use `roleId`-specific defaults. Admin and General Manager receive all supported alert types and all channels. Housekeeping and Housekeeping Manager receive guest activity, cleaning, tasks, and smart-lock operational alerts with `['in_app', 'mobile']`. Guest Experience Manager receives guest activity, calls, reviews, upsells, and guest-guide alerts with `['in_app', 'email']`. Finance/HR receives finance/activity alerts with `['in_app', 'email']`. Other operational roles receive only their operational alerts with `['in_app']`. Owner defaults contain no owner activity types.

`normalizeRoleNotifications()` must:

- Accept missing/unknown input.
- Keep only alert types present in `notificationCategories`.
- Keep only `in_app`, `email`, and `mobile` channels.
- Fall back to the role default when input is missing, malformed, or has no valid channels.
- Deduplicate both arrays.

- [ ] **Step 5: Run the metadata tests and commit the data-layer change**

Run:

```bash
pnpm exec vitest run tests/composables/useRoles-notifications.spec.ts
```

Expected: PASS for all metadata tests.

Commit:

```bash
git add app/components/notifications/data/alerts.ts app/components/notifications/data/notification-settings.ts tests/composables/useRoles-notifications.spec.ts
git commit -m "feat: add role notification metadata"
```

---

### Task 2: Extend role data and migrate persisted roles

**Files:**
- Modify: `app/components/users/data/roles.ts:1-41,202-475`
- Modify: `app/composables/useRoles.ts:12-20,48-75`
- Test: `tests/composables/useRoles-notifications.spec.ts`

- [ ] **Step 1: Add failing role persistence tests**

Add tests for defaults, old local-storage data, save, and reset. Use the existing global `useState` shim and browser local storage:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultRoles } from '~/components/users/data/roles'
import { useRoles } from '~/composables/useRoles'

beforeEach(() => {
  window.localStorage.clear()
})

describe('role notification persistence', () => {
  it('gives every default role notification settings', () => {
    expect(defaultRoles).toHaveLength(16)
    expect(defaultRoles.every(role => role.notifications.channels.length > 0)).toBe(true)
  })

  it('migrates a stored role that predates notification settings', () => {
    const legacyRole = JSON.parse(JSON.stringify(defaultRoles[0]))
    delete legacyRole.notifications
    window.localStorage.setItem('elev8-tenant-roles', JSON.stringify([legacyRole]))

    const { getRole } = useRoles()
    const migrated = getRole(legacyRole.id)

    expect(migrated?.notifications.enabledAlertTypes.length).toBeGreaterThan(0)
    expect(migrated?.notifications.channels).toContain('in_app')
  })

  it('saves and resets notification settings with the role', () => {
    const { getRole, updateRole, resetRoleToDefaults } = useRoles()
    const role = getRole('role-housekeeping')!

    updateRole(role.id, {
      notifications: { enabledAlertTypes: [], channels: ['email'] },
    })
    expect(getRole(role.id)?.notifications.channels).toEqual(['email'])

    resetRoleToDefaults(role.id)
    expect(getRole(role.id)?.notifications.channels).toEqual(['in_app', 'mobile'])
    expect(getRole(role.id)?.notifications.enabledAlertTypes)
      .toContain('GUEST_CHECKED_OUT')
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm exec vitest run tests/composables/useRoles-notifications.spec.ts
```

Expected: FAIL because `Role` does not yet require `notifications` and `useRoles` does not migrate it.

- [ ] **Step 3: Add notification defaults to the `Role` type and all default roles**

Import `RoleNotifications` and `getDefaultRoleNotifications` into `roles.ts`, then extend the interface:

```ts
export interface Role {
  id: RoleId
  name: string
  description: string
  workingHours: WorkingHours
  defaultPermissions: Record<PermissionModule, ModulePermissions>
  notifications: RoleNotifications
}
```

Add `notifications: getDefaultRoleNotifications('<role-id>')` to every object in `defaultRoles`, using its exact `RoleId`. Keep permissions and working-hours values unchanged.

- [ ] **Step 4: Normalize notification settings in `useRoles`**

Update `useRoles.ts` to import `normalizeRoleNotifications` and merge the new field together with permissions:

```ts
function mergeWithDefaults(roles: Role[]): Role[] {
  const defaults = defaultPerms()
  return roles.map(role => ({
    ...role,
    defaultPermissions: {
      ...defaults,
      ...role.defaultPermissions,
    },
    notifications: normalizeRoleNotifications(role.notifications, role.id),
  }))
}
```

Use `mergeWithDefaults()` when loading local storage. Also normalize notification data inside `updateRole()` before replacing the role so malformed UI/test patches cannot be persisted. Keep `resetRoleToDefaults()` and `resetAllRolesToDefaults()` deep-cloning `defaultRoles`.

- [ ] **Step 5: Run typecheck and role tests, then commit**

Run:

```bash
pnpm exec vitest run tests/composables/useRoles-notifications.spec.ts
pnpm typecheck
```

Expected: PASS with no TypeScript errors.

Commit:

```bash
git add app/components/users/data/roles.ts app/composables/useRoles.ts tests/composables/useRoles-notifications.spec.ts
git commit -m "feat: persist notification defaults on roles"
```

---

### Task 3: Implement pure alert routing and current-user resolution

**Files:**
- Create: `app/lib/notification-routing.ts`
- Create: `app/composables/useCurrentDashboardUser.ts`
- Test: `tests/lib/notification-routing.spec.ts`

- [ ] **Step 1: Write failing routing tests**

Create tests using a minimal user and role fixture:

```ts
import { describe, expect, it } from 'vitest'
import type { Alert } from '~/components/notifications/data/alerts'
import type { Role } from '~/components/users/data/roles'
import type { User } from '~/components/users/data/users'
import { isAlertVisibleToUser } from '~/lib/notification-routing'

const user: User = {
  id: 'user-housekeeping', name: 'Ketut', phone: '', preferredLanguage: 'id',
  email: '', employeeNumber: '', monthlySalaryAmount: 0, workingDaysPerMonth: 26,
  hoursPerDay: 8, roleId: 'role-housekeeping', listingIds: ['lst-1'], status: 'active',
  initials: 'K', createdAt: '', updatedAt: '',
}

const role = {
  id: 'role-housekeeping',
  notifications: { enabledAlertTypes: ['GUEST_CHECKED_OUT'], channels: ['in_app'] },
} as Role

const checkoutAlert = {
  alert_id: 'guest-checkout-1', type: 'GUEST_CHECKED_OUT', severity: 'INFO', status: 'ACTIVE',
  listing_id: 'lst-1', property_id: null, triggered_at: '', resolved_at: null,
  auto_resolve: true, resolve_condition: '', context: {},
} as Alert

describe('isAlertVisibleToUser', () => {
  it('shows enabled in-app alerts for assigned listings', () => {
    expect(isAlertVisibleToUser(checkoutAlert, user, role)).toBe(true)
  })

  it('hides alerts for an unassigned listing', () => {
    expect(isAlertVisibleToUser({ ...checkoutAlert, listing_id: 'lst-2' }, user, role)).toBe(false)
  })

  it('hides alert types disabled by the role', () => {
    expect(isAlertVisibleToUser({ ...checkoutAlert, type: 'GUEST_CHECKED_IN' }, user, role)).toBe(false)
  })

  it('hides alerts when the role has no in-app channel', () => {
    expect(isAlertVisibleToUser(checkoutAlert, user, {
      ...role, notifications: { ...role.notifications, channels: ['email'] },
    })).toBe(false)
  })

  it('treats an empty listing assignment as all-listings scope', () => {
    expect(isAlertVisibleToUser(checkoutAlert, { ...user, listingIds: [] }, role)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the routing tests and verify they fail**

Run:

```bash
pnpm exec vitest run tests/lib/notification-routing.spec.ts
```

Expected: FAIL because the routing helper does not exist.

- [ ] **Step 3: Implement the pure routing helper**

Create `app/lib/notification-routing.ts`:

```ts
import type { Alert } from '~/components/notifications/data/alerts'
import type { Role } from '~/components/users/data/roles'
import type { User } from '~/components/users/data/users'

export function isAlertVisibleToUser(
  alert: Alert,
  user: User | undefined,
  role: Role | undefined,
): boolean {
  if (!user || !role)
    return false
  if (!role.notifications.channels.includes('in_app'))
    return false
  if (!role.notifications.enabledAlertTypes.includes(alert.type))
    return false
  if (alert.listing_id && user.listingIds.length > 0 && !user.listingIds.includes(alert.listing_id))
    return false
  return true
}

export function filterAlertsForUser(alerts: Alert[], user: User | undefined, role: Role | undefined): Alert[] {
  return alerts.filter(alert => isAlertVisibleToUser(alert, user, role))
}
```

- [ ] **Step 4: Add the mock current-user composable**

Create `app/composables/useCurrentDashboardUser.ts`:

```ts
import { useUsers } from '~/composables/useUsers'

export const CURRENT_DASHBOARD_USER_ID = 'user-1'

export function useCurrentDashboardUser() {
  const { getUser } = useUsers()
  const currentUser = computed(() => getUser(CURRENT_DASHBOARD_USER_ID))
  return { currentUser }
}
```

This preserves the existing Komang mock context and leaves room for a real auth provider later. It does not create user-editable preferences.

- [ ] **Step 5: Run tests and typecheck, then commit**

Run:

```bash
pnpm exec vitest run tests/lib/notification-routing.spec.ts
pnpm typecheck
```

Expected: PASS with no type errors.

Commit:

```bash
git add app/lib/notification-routing.ts app/composables/useCurrentDashboardUser.ts tests/lib/notification-routing.spec.ts
git commit -m "feat: add role-aware notification routing"
```

---

### Task 4: Apply routing in `useNotifications` and expose Guest Activity filtering

**Files:**
- Modify: `app/composables/useNotifications.ts:1-217`
- Modify: `app/components/notifications/NotificationCenter.vue:1-57`
- Test: `tests/composables/useNotifications.spec.ts`

- [ ] **Step 1: Write failing composable tests**

Add tests for the role-filtered unread count and guest activity kind. The default mock user (`user-1`, Komang) already receives Guest Activity under the approved Guest Experience Manager defaults; housekeeping-specific listing behavior is covered by `tests/lib/notification-routing.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { useNotifications } from '~/composables/useNotifications'

describe('useNotifications role filtering', () => {
  it('counts only visible active alerts as unread', () => {
    const { alerts, activeAlerts, unreadCount } = useNotifications()
    alerts.value = [
      {
        alert_id: 'visible', type: 'GUEST_CHECKED_OUT', severity: 'INFO', status: 'ACTIVE',
        listing_id: 'lst-1', property_id: null, triggered_at: '', resolved_at: null,
        auto_resolve: true, resolve_condition: '', context: { guest_name: 'Anna', listing_name: 'Villa Bidadari' },
      },
      {
        alert_id: 'hidden', type: 'OWNER_STAY_CONFIRMED', severity: 'INFO', status: 'ACTIVE',
        listing_id: null, property_id: null, triggered_at: '', resolved_at: null,
        auto_resolve: true, resolve_condition: '', context: {},
      },
    ]

    expect(activeAlerts.value.map(alert => alert.alert_id)).toEqual(['visible'])
    expect(unreadCount.value).toBe(1)
  })

  it('creates a guest checkout alert with listing context', () => {
    const { alerts, createGuestActivityAlert } = useNotifications()
    createGuestActivityAlert('GUEST_CHECKED_OUT', {
      listing_id: 'lst-1', listing_name: 'Villa Bidadari', guest_name: 'Anna Schmidt',
    })

    expect(alerts.value[0].type).toBe('GUEST_CHECKED_OUT')
    expect(alerts.value[0].listing_id).toBe('lst-1')
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm exec vitest run tests/composables/useNotifications.spec.ts
```

Expected: FAIL because the composable currently counts all active alerts and has no `createGuestActivityAlert` or Guest Activity kind.

- [ ] **Step 3: Add role visibility before existing filters**

Import `filterAlertsForUser`, `useCurrentDashboardUser`, and `useRoles`. Add `guest_activity` to `NotificationKindFilter`. Derive:

```ts
const { currentUser } = useCurrentDashboardUser()
const { getRole } = useRoles()
const currentRole = computed(() => currentUser.value ? getRole(currentUser.value.roleId) : undefined)
const visibleAlerts = computed(() => filterAlertsForUser(alerts.value, currentUser.value, currentRole.value))
const activeAlerts = computed(() => visibleAlerts.value.filter(alert => alert.status === 'ACTIVE'))
const unreadCount = computed(() => activeAlerts.value.length)
```

Make `filteredAlerts` start from `activeAlerts.value` or `visibleAlerts.value` as appropriate, then apply severity and kind filters. Do not let hidden alerts contribute to the bell badge.

Update `markAllAsRead()` to resolve only visible active alerts:

```ts
function markAllAsRead() {
  const visibleIds = new Set(activeAlerts.value.map(alert => alert.alert_id))
  const now = new Date().toISOString()
  alerts.value = alerts.value.map(alert => visibleIds.has(alert.alert_id)
    ? { ...alert, status: 'RESOLVED' as const, resolved_at: now }
    : alert)
}
```

Keep `markAsRead()` and `dismiss()` spread-based and prevent UI actions from mutating an alert outside `visibleAlerts`.

- [ ] **Step 4: Add category-aware kind mapping and guest alert creation**

Import `getNotificationKind`. Replace the duplicated kind sets with a central mapping:

```ts
function getAlertKind(type: Alert['type']): NotificationKindFilter {
  return getNotificationKind(type)
}
```

`getNotificationKind()` must return `calls` for `CALL_INCOMING`, `CALL_MISSED`, and `CALL_COMPLETED`, `cleaning` for cleaning types, `reviews` for review types, `upsell` for `UPSELL_*`, `guest_activity` for the three guest types, and `system` for the remaining types.

Add:

```ts
function createGuestActivityAlert(
  type: 'GUEST_CHECKED_IN' | 'GUEST_CHECKED_OUT' | 'GUEST_ARRIVAL_SOON',
  context: Record<string, any>,
) {
  createAlert(type, 'INFO', context)
}
```

Return `visibleAlerts` and `createGuestActivityAlert` alongside existing exports. Preserve all current alert producers and `createUpsellAlert()` behavior.

- [ ] **Step 5: Update the Notification Center UI**

Add `guest_activity` to the kind tabs:

```ts
{ label: 'Guest Activity', value: 'guest_activity' },
```

Import `getNotificationKind` in `NotificationCenter.vue` and use it for `alertKind()` so a `GUEST_CHECKED_OUT` alert is labeled “Guest Activity” and existing Calls/Cleanings/Reviews/Upsell filters retain their current behavior. Keep the existing `min-h-0` ScrollArea behavior and accessible button labels.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
pnpm exec vitest run tests/composables/useNotifications.spec.ts
pnpm exec vitest run tests/components/notifications tests/composables/useNotifications.spec.ts
pnpm typecheck
```

Expected: PASS with no TypeScript errors.

Commit:

```bash
git add app/composables/useNotifications.ts app/components/notifications/NotificationCenter.vue tests/composables/useNotifications.spec.ts
 git commit -m "feat: filter notifications by role and category"
```

---

### Task 5: Connect checkout cleaning creation to guest activity alerts

**Files:**
- Modify: `app/composables/useCleaningJobs.ts:1-66`
- Test: `tests/composables/useCleaningJobs-notifications.spec.ts`

- [ ] **Step 1: Write the failing checkout notification test**

Add a test that seeds shared notifications, creates a checkout cleaning job, and verifies both outputs:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useNotifications } from '~/composables/useNotifications'

beforeEach(() => {
  window.localStorage.clear()
})

describe('checkout cleaning notifications', () => {
  it('creates a guest checkout alert with the cleaning job', () => {
    const { alerts } = useNotifications()
    const { createFromCheckout } = useCleaningJobs()

    const job = createFromCheckout({
      id: 'res-1', listingId: 'lst-1', listingName: 'Villa Bidadari',
      checkOut: '2026-07-26', guestName: 'Anna Schmidt',
    })

    expect(job.source).toBe('checkout')
    expect(alerts.value.some(alert =>
      alert.type === 'GUEST_CHECKED_OUT'
      && alert.listing_id === 'lst-1'
      && alert.context.guest_name === 'Anna Schmidt',
    )).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm exec vitest run tests/composables/useCleaningJobs-notifications.spec.ts
```

Expected: FAIL because `createFromCheckout()` does not accept `guestName` or emit an alert.

- [ ] **Step 3: Emit the guest checkout alert from `createFromCheckout`**

Import `useNotifications()` inside `useCleaningJobs()` and destructure `createGuestActivityAlert`:

```ts
export function useCleaningJobs() {
  const { createGuestActivityAlert } = useNotifications()
  const jobs = useState<CleaningJob[]>('cleaning-jobs', () => cleaningJobs.value)
  // existing computed values and methods remain unchanged
```

Extend the checkout input and emit the alert after creating the job:

```ts
function createFromCheckout(reservation: {
  id: string
  listingId: string
  listingName: string
  checkOut: string
  guestName?: string
}) {
  const job = createJob({
    listingId: reservation.listingId,
    listingName: reservation.listingName,
    scheduledAt: `${reservation.checkOut}T11:00:00+08:00`,
    cleanerId: null,
    cleanerName: null,
    teamName: 'Housekeeping',
    status: 'draft',
    priority: 'high',
    durationMinutes: 180,
    notes: `Auto-generated from checkout ${reservation.id}.`,
    source: 'checkout',
    reservationId: reservation.id,
    recurrence: null,
  })

  createGuestActivityAlert('GUEST_CHECKED_OUT', {
    listing_id: reservation.listingId,
    listing_name: reservation.listingName,
    guest_name: reservation.guestName || 'Guest',
    checkout_at: `${reservation.checkOut}T11:00:00+08:00`,
    reservation_id: reservation.id,
  })

  return job
}
```

Keep the existing cleaning job object and return value unchanged. The alert is an additional side effect representing “housekeeping has been notified.”

- [ ] **Step 4: Run the checkout and regression tests, then commit**

Run:

```bash
pnpm exec vitest run tests/composables/useCleaningJobs-notifications.spec.ts tests/composables/useNotifications.spec.ts
pnpm typecheck
```

Expected: PASS with no TypeScript errors.

Commit:

```bash
git add app/composables/useCleaningJobs.ts tests/composables/useCleaningJobs-notifications.spec.ts
 git commit -m "feat: notify housekeeping after guest checkout"
```

---

### Task 6: Build the role notification editor

**Files:**
- Create: `app/components/users/NotificationSettings.vue`
- Modify: `app/components/users/RoleDetailSheet.vue:12-75,158-165`
- Test: `tests/components/users/NotificationSettings.spec.ts`

- [ ] **Step 1: Write failing component tests**

Mount the focused editor with a housekeeping policy and assert channel, category, and alert toggles emit a cloned updated value:

```ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationSettings from '~/components/users/NotificationSettings.vue'
import { getDefaultRoleNotifications } from '~/components/notifications/data/notification-settings'

describe('NotificationSettings', () => {
  it('renders channels and excludes owner activity', () => {
    const wrapper = mount(NotificationSettings, {
      props: {
        modelValue: getDefaultRoleNotifications('role-housekeeping'),
      },
    })

    expect(wrapper.get('[data-testid="notification-channel-in_app"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="notification-alert-GUEST_CHECKED_OUT"]')).toBeTruthy()
    expect(wrapper.find('[data-testid="notification-alert-OWNER_STAY_CONFIRMED"]').exists()).toBe(false)
  })

  it('emits an updated policy when an alert is toggled', async () => {
    const value = getDefaultRoleNotifications('role-housekeeping')
    const wrapper = mount(NotificationSettings, { props: { modelValue: value } })
    const checkout = wrapper.get('[data-testid="notification-alert-GUEST_CHECKED_OUT"]')

    await checkout.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toEqual(expect.objectContaining({
      enabledAlertTypes: expect.not.arrayContaining(['GUEST_CHECKED_OUT']),
    }))
    expect(value.enabledAlertTypes).toContain('GUEST_CHECKED_OUT')
  })

  it('emits channel changes and does not mutate the prop object', async () => {
    const value = getDefaultRoleNotifications('role-housekeeping')
    const wrapper = mount(NotificationSettings, { props: { modelValue: value } })

    await wrapper.get('[data-testid="notification-channel-email"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0][0]).toEqual(expect.objectContaining({
      channels: expect.arrayContaining(['email']),
    }))
    expect(value.channels).not.toContain('email')
  })
})
```

- [ ] **Step 2: Run the component tests and verify they fail**

Run:

```bash
pnpm exec vitest run tests/components/users/NotificationSettings.spec.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `NotificationSettings.vue`**

Use props/emits:

```ts
const props = defineProps<{ modelValue: RoleNotifications }>()
const emit = defineEmits<{ 'update:modelValue': [value: RoleNotifications] }>()

function update(patch: Partial<RoleNotifications>) {
  emit('update:modelValue', {
    enabledAlertTypes: [...(patch.enabledAlertTypes ?? props.modelValue.enabledAlertTypes)],
    channels: [...(patch.channels ?? props.modelValue.channels)],
  })
}
```

Render `notificationChannels` and `notificationCategories`. Use native `<button>` elements with a custom checked visual for each channel and alert type; do not wrap reka-ui checkboxes in labels. Add `data-testid` attributes exactly matching the tests. Use `cn()` and theme tokens only (`bg-primary`, `bg-muted`, `text-muted-foreground`, `border-input`).

Implement:

- `toggleChannel(channel)` with immutable arrays.
- `toggleAlertType(type)` with immutable arrays.
- `selectCategory(category)` and `clearCategory(category)`.
- Category disclosure state with one category open initially: `guest_activity`.
- Summary text showing selected alert count and selected channel count.
- A short explanatory message for email/mobile that these are configured for future delivery.
- `aria-pressed`, visible text labels, and keyboard-operable buttons.

- [ ] **Step 4: Integrate the editor into `RoleDetailSheet.vue`**

Import the new component. Add:

```ts
function setNotifications(next: RoleNotifications) {
  if (!draft.value) return
  draft.value.notifications = next
}
```

Pass it under the existing `PermissionMatrix`:

```vue
<PermissionMatrix
  :permissions="draft.defaultPermissions"
  @update:permissions="setPermissions"
/>
<NotificationSettings
  v-model="draft.notifications"
/>
```

If the implementation uses an explicit event instead of `v-model`, call `setNotifications`. Update `handleSave()` to include `notifications: draft.value.notifications` in `updateRole()`. Keep the existing reset and toast behavior. Ensure the scrollable sheet body retains `min-h-0`.

- [ ] **Step 5: Add save validation and run UI tests**

Before `updateRole()` in `handleSave()`, reject an empty channel list:

```ts
if (draft.value.notifications.channels.length === 0) {
  toast.error('Select at least one notification channel')
  return
}
```

Run:

```bash
pnpm exec vitest run tests/components/users/NotificationSettings.spec.ts tests/composables/useRoles-notifications.spec.ts
pnpm typecheck
```

Expected: PASS with no type errors.

Commit:

```bash
git add app/components/users/NotificationSettings.vue app/components/users/RoleDetailSheet.vue tests/components/users/NotificationSettings.spec.ts
 git commit -m "feat: configure notifications from role editor"
```

---

### Task 7: Run the complete verification suite and update the plan/spec references

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-role-notification-settings-design.md` only if implementation details materially differ from the approved design.

- [ ] **Step 1: Run all focused tests together**

Run:

```bash
pnpm exec vitest run \
  tests/composables/useRoles-notifications.spec.ts \
  tests/lib/notification-routing.spec.ts \
  tests/composables/useNotifications.spec.ts \
  tests/composables/useCleaningJobs-notifications.spec.ts \
  tests/components/users/NotificationSettings.spec.ts
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run the project typecheck and lint**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: no TypeScript or lint errors. If lint reports only pre-existing unrelated files, record the exact paths and leave unrelated code unchanged.

- [ ] **Step 3: Verify the user flow manually**

Start the app with:

```bash
pnpm dev
```

Verify:

1. Open `/users` and select the Roles tab.
2. Open Housekeeping and confirm Notifications contains Guest Activity and `Guest Checked Out`, but no Owner Activity.
3. Toggle a channel and an alert, save, reopen, and confirm the values persist.
4. Reset the role and confirm housekeeping defaults restore `GUEST_CHECKED_OUT` plus in-app/mobile.
5. Trigger/create a checkout cleaning job for an assigned listing and confirm the generated alert says housekeeping has been notified.
6. Confirm the Notification Center shows Guest Activity and does not count alerts excluded by the current user’s role/listing scope.

- [ ] **Step 4: Commit final verification changes if any**

If the verification step required a small implementation correction, run the focused tests again and commit:

```bash
git add app tests docs/superpowers/specs/2026-07-26-role-notification-settings-design.md
git commit -m "test: verify role-based notification delivery"
```

---

## Plan self-review

- **Spec coverage:** Role-level settings, alert types, channels, guest checkout routing, housekeeping listing scope, owner activity exclusion, migration, validation, and tests are covered by Tasks 1–7.
- **No personal override:** No task creates a user preference store or UI override.
- **No owner deletion:** Existing owner alert types/producers remain; only role-selector metadata excludes them.
- **Type consistency:** `RoleNotifications`, `NotificationChannel`, `NotificationCategoryId`, `getDefaultRoleNotifications()`, `normalizeRoleNotifications()`, `isAlertVisibleToUser()`, and `createGuestActivityAlert()` are defined before use.
- **Test command consistency:** The repository has no `test` script, so every command uses `pnpm exec vitest run`; `pnpm typecheck` and `pnpm lint` use existing scripts.
- **Scope:** No API/server work or unrelated refactor is included.
