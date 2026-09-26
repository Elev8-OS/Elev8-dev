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

### Mail (`app/components/mail/`)
- **Layout.vue**, **List.vue**, **Display.vue**, **Nav.vue**, **AccountSwitcher.vue**
- Mock data: `app/components/mail/data/mails.ts`
