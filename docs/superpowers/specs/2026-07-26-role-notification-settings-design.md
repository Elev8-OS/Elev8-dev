# Role-Based Notification Settings

**Date:** 2026-07-26
**Status:** Approved design

## Summary

Add notification configuration to the existing Users → Roles editor. Administrators can configure, per role, which alert types are enabled and which delivery channels are configured. Individual users cannot override role defaults.

In-app filtering will be functional in the mock dashboard. Email and mobile/push channel settings will be persisted as role policy but remain mocked until delivery integrations exist.

## Goals

- Let role administrators configure notification alert types from the existing role editor.
- Let role administrators configure delivery channels: in-app, email, and mobile/push.
- Route guest activity notifications to appropriate operational roles.
- Ensure a guest checkout notification can inform assigned housekeeping users for the affected listing.
- Keep notification configuration separate from dashboard/mobile feature permissions while reusing the existing role persistence flow.
- Preserve existing owner-portal functionality without exposing owner activity in this role notification selector.

## Non-goals

- Personal notification overrides.
- Real email or mobile/push delivery.
- A new notification service or server persistence layer.
- Deleting existing owner-portal alert producers or owner functionality.
- Room-level notification assignments; listing/property scope remains the existing V1 assignment model.

## Product decisions

### Role-level source of truth

Each role owns its notification defaults. Users inherit those defaults and cannot change them from Settings → Notifications.

### Alert scope

The role editor includes these categories:

- Guest Activity
- Cleaning and Housekeeping
- Tasks and Operations
- Finance and Payments
- Reviews
- Upsells
- Smart Locks
- Integrations and System

There is no Owner Activity category in the selector. Existing owner alert types remain available to existing owner-portal functionality and are not removed from the application by this feature.

### Guest checkout routing

Add guest lifecycle alert types where missing, including `GUEST_CHECKED_OUT` and related guest activity events. A checkout alert carries listing/property context and guest details:

```ts
{
  listing_id,
  property_id,
  listing_name,
  guest_name,
  checkout_at,
}
```

Housekeeping and Housekeeping Manager defaults enable guest checkout alerts. A user receives a listing-scoped alert only when:

1. Their role has the alert type enabled.
2. Their role has at least one configured delivery channel.
3. Their assigned listing IDs include the alert listing ID.

Alerts without listing scope use role and channel configuration only.

## Data model

Add a dedicated notification type in the role data model:

```ts
type NotificationChannel = 'in_app' | 'email' | 'mobile'

interface RoleNotifications {
  enabledAlertTypes: AlertType[]
  channels: NotificationChannel[]
}
```

Extend `Role`:

```ts
interface Role {
  id: RoleId
  name: string
  description: string
  workingHours: WorkingHours
  defaultPermissions: Record<PermissionModule, ModulePermissions>
  notifications: RoleNotifications
}
```

Alert category and display metadata should be centralized alongside `AlertType`, so the role editor and Notification Center do not maintain separate alert lists. Owner alert types should be excluded from the role-editor category metadata.

## Default role policies

- **Admin / General Manager:** all supported alert types and all channels.
- **Housekeeping / Housekeeping Manager:** guest checkout and guest activity, cleaning, tasks, and relevant smart-lock operational alerts; in-app and mobile by default.
- **Finance / HR:** finance, payment, attendance/activity-related alerts; in-app and email by default.
- **Guest Experience Manager:** guest activity, inbox/call, upsell, review, and guest guide alerts; in-app and email by default.
- **Listing Manager:** listing, reservation, guest activity, cleaning operations, and system alerts; in-app and email by default.
- **Other operational roles:** only relevant operational alerts; in-app by default.
- **Owner:** no owner activity selector; only guest/reservation alerts explicitly supported by the role policy.

These defaults are implemented as data helpers so newly created or migrated roles receive complete settings.

## Role editor UI

`RoleDetailSheet.vue` keeps its current metadata and permissions layout and adds a Notifications card below the permission matrix.

### Delivery channels

Use existing shadcn/reka controls for:

- In-app notification center
- Email
- Mobile/push

At least one channel is required to save.

### Alert categories

Each category is collapsible and contains individual alert type rows. The UI provides:

- Select all per category.
- Clear per category.
- Alert label and short description.
- Summary of selected alert types and channels.
- No Owner Activity category.

The existing draft-copy, Cancel, Save changes, and Reset to defaults behavior remains unchanged.

## Notification data flow

```text
Reservation checkout
  → createAlert('GUEST_CHECKED_OUT', context)
  → useNotifications resolves active dashboard user
  → resolve role notification defaults
  → check enabled alert type
  → check configured channel policy
  → check listing assignment when listing-scoped
  → Notification Center renders the alert
```

The global alert store remains compatible with current producers. Role filtering is applied when calculating user-visible alerts rather than changing every producer immediately.

`useNotifications` should expose the existing alert collections and filters while inserting a role-visibility step before severity/kind filtering:

```text
all alerts
  → active alerts
  → role/listing visibility
  → severity filter
  → kind filter
```

The current mock dashboard user context resolves the logged-in user (Komang by default) without adding a personal preference layer.

## Persistence and migration

Continue using `useRoles` and `elev8-tenant-roles` local storage:

- `updateRole()` accepts the new `notifications` field.
- `resetRoleToDefaults()` restores permissions and notifications.
- Existing stored roles missing `notifications` are merged with the corresponding role defaults.
- Invalid channels or alert types are replaced with defaults.
- Role edits remain tenant-wide role configuration, not personal settings.

## Validation and error handling

- Prevent save when no delivery channel is selected.
- Validate alert type values against the central alert metadata/type list.
- Normalize malformed or missing saved notification data during role loading.
- Use the existing toast pattern for successful saves, resets, and validation errors.
- Keep the role editor draft isolated so Cancel never partially mutates the persisted role.
- If the current user or role cannot be resolved, fail closed for role-filtered alerts rather than showing restricted notifications.

## Testing

Add coverage for:

1. Migration of stored roles without notification settings.
2. Saving and resetting role notification settings.
3. Housekeeping receiving `GUEST_CHECKED_OUT`.
4. Disabled role alert types not appearing in visible alerts.
5. Listing-scoped alerts respecting assigned listing IDs.
6. Save validation when all channels are disabled.
7. Owner activity not appearing in the role notification selector.
8. Existing severity/kind filters and Notification Center actions continuing to work.

## Files expected to change

- `app/components/users/data/roles.ts`
- `app/components/notifications/data/alerts.ts`
- `app/composables/useRoles.ts`
- `app/composables/useNotifications.ts`
- `app/components/users/RoleDetailSheet.vue`
- Potentially a focused notification settings subcomponent under `app/components/users/`
- Relevant reservation/checkout mock producer or notification fixture
- Tests for role migration, routing, and UI validation

## Open implementation constraint

The dashboard is currently mock-authenticated as Komang Juliantara, while the Users page contains several staff records. The implementation should use the existing current-user context rather than introducing personal notification preferences or a second authentication model.
