> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Notification Center Module (`app/components/notifications/`)

#### Data + Types (`app/components/notifications/data/alerts.ts`)
- `AlertType` — 18 alert types (SMART_LOCK_DEAD, CLEANING_NOT_STARTED_IMMINENT, STRIPE_DISCONNECTED, etc.)
- `AlertSeverity` — `'CRITICAL' | 'WARNING'`
- `Alert` interface with `alert_id`, `type`, `severity`, `status`, `triggered_at`, `auto_resolve`, `context`
- `alertDisplayLabels`, `alertRouteMap`, `getDescription()`, `mockAlerts` (7 mock alerts)

#### Shared State (`app/composables/useNotifications.ts`)
- `alerts` — `useState<Alert[]>` with spread syntax for reactivity
- Computed: `activeAlerts`, `unreadCount`, `filteredAlerts` (by severity)
- Actions: `markAsRead()`, `markAllAsRead()`, `dismiss()`, `navigateToAlert()`
- Severity filter: `selectedSeverity` ref (`'all' | 'critical' | 'warning'`)
- **Generic `createAlert(type, severity, context)`** — accepts any `AlertType` (used by `useSmartLock.emitMockAlerts` for `SMART_LOCK_BATTERY_CRITICAL`, `SMART_LOCK_BATTERY_LOW`, `SMART_LOCK_OFFLINE`). The older `createUpsellAlert` is now a thin wrapper that calls `createAlert` with the right severity for upsell types.

#### Components
- **NotificationCenter.vue** — Bell icon in Header with unread Badge, Popover dropdown with filter tabs (All/Critical/Warning), ScrollArea list
- **NotificationItem.vue** — Single alert row with severity-based coloring (red/amber), keyboard accessible, dismiss + navigate actions

### Layout (`app/components/layout/`)
- **Header.vue** — SidebarTrigger + language selector + notification bell + user menu
- **HeaderUserMenu.vue** — Komang Juliantara + "Guest Relations" role dropdown (includes Changelog link)
- **LanguageSelector.vue** — Mockup language switcher (circle-flags SVGs from hatscripts.github.io). Popover dropdown with EN/DE/FR/ID/NL options. Flag icon + uppercase code in trigger button. Purely visual - no i18n integration.
- **AppSidebar.vue** — No footer (user menu moved to topbar)
- **SidebarNavLink.vue** — Unread count badge on Inbox link
- **Sidebar layout** (`constants/menus.ts`, 2026-10-12): General keeps Home, Inbox, Analytics, Cockpit, Listing Health and Owner Portal as links; the rest sit in collapsible groups (Bookings: Reservations, Guest Registration; Properties: Listings, Channels; Upsells: Catalog, Orders, Damage Protection; Guest Experience: Review Hub, Guest Guides, Backfill Guides, Journeys; Marketing: Website Builder, Promo Codes, Booking Widget v1/v2; Finance). Apps keeps Platform Console and Kanban Board. An **Operations** section (own heading, after General) lists Tasks, Operations Calendar, Key Management, Inventory, Procurement and Users as plain links. `SidebarNavGroup.vue` opens a group that holds the current page and marks its header active while collapsed; it shows the requested upsell order count on Orders (and on the closed Upsells header). Labels truncate instead of wrapping; group headers carry no New pill. ⚠️ `AppSidebar` gates PMS_ONLY modules by title: group children are filtered by their own title and an emptied group is dropped, so a gated module (Cockpit, Review Hub, Website Builder) must keep its exact title, as a link or a child

### Tasks Module (`app/components/tasks/`)
- **DataTable.vue** — TanStack table wrapper
- **DataTableToolbar.vue**, **DataTableFacetedFilter.vue**, **DataTablePagination.vue**, **DataTableViewOptions.vue**, **DataTableColumnHeader.vue**, **DataTableRowActions.vue**
- Schema: `app/components/tasks/data/schema.ts`
- Mock data: `app/components/tasks/data/data.ts`
- Columns: `app/components/tasks/components/columns.ts`

### Kanban Module (`app/components/kanban/`)
- **KanbanBoard.vue** — Main board component
- Composable: `app/composables/useKanban.ts`

### Auth (`app/components/auth/`)
- **SignIn.vue**, **SignUp.vue**, **OTPForm.vue**, **OTPForm1.vue**, **OTPForm2.vue**, **ForgotPassword.vue**
- Layout: `app/components/layout/Auth.vue`

