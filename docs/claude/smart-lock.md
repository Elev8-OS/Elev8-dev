> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### SmartLock Integration (`app/components/settings/` + `app/composables/useSmartLock.ts`)

Single-connection (one API key per tenant), multi-lock assignment (many locks per listing or per room). Mock/demo only — no real provider API calls. The integration is provider-agnostic; only the connection sheet references the underlying provider name.

#### Architecture (hybrid)
- **Global connection** — `Settings → Integrations` tile (amber `lucide:key-round` icon, next to WhatsApp / 3CX / Payout)
- **Per-listing pairing** — Smart Locks card in `ListingSettingsTab.vue` (Settings tab of each listing)
- **Per-room pairing** — Clickable amber lock count badge in the `RoomsPanel.vue` sidebar → opens per-room lock management Dialog (list of paired locks + inline pair form)

#### Data model
- **`SmartLockConnection`** — `{ id, apiKey, workspaceName, status, webhookToken, webhookUrl, deviceCount, connectedAt, lastSyncAt }` — one per tenant, keyed by `'smartlock-connection'` in `useState`
- **`SmartLockDevice`** — `{ deviceId, name, deviceType, provider, model, batteryLevel, online, paired }` — **10 mock devices seeded** (brand-grouped for sharing demo):
  - **August** (3): Front Door, Garage Door, Side Gate
  - **Yale** (2): Pool Gate, Office Door
  - **Schlage** (2): Safe, Wine Cellar
  - **Nuki** (2): Side Door, Boathouse (8% battery, offline — used for alert demo)
  - **igloohome** (1): Back Gate
- **`SmartLock`** — `{ id, providerDeviceId, name, assignment: 'property' | 'room', listingId, unitId?, isMain, batteryLevel, online, lastSeen, status, createdAt }` — `isMain` is per-scope (one main per listing for property-level, one main per unit for room-level); `setMainLock()` auto-demotes existing main in scope
- **`AccessCode`** — `{ id, lockId, code (6-digit), startsAt, endsAt, guestName?, reservationId?, purpose?, scheduleType?: 'ongoing' | 'range', status: 'active' | 'expired' | 'revoked', providerCodeId }` — `generateAccessCode` is **async** (700ms mock delay for visible loading states) and auto-revokes any prior active code on the **same lockId + reservationId** combo (so different guests can each have their own active code on the same lock). `scheduleType` reflects the host's explicit scheduling choice: `'ongoing'` = always active (`endsAt = '2099-12-31'`), `'range'` = host-supplied `startsAt`/`endsAt`, `undefined` = auto-generated 24h default window. `purpose` is the user-given "code name" label (free text).

#### Composable (`useSmartLock.ts`)
- State: `connection` (`SmartLockConnection | null`), `locks` (`SmartLock[]`), `codes` (`AccessCode[]`) — all `useState` + localStorage persisted (same pattern as `useThreeCX`)
- Query helpers: `getLocksForListing`, `getLocksForUnit`, `getLockCount`, `getMainLock(listingId, unitId?)`
- CRUD: `pairLock`, `unpairLock`, `setMainLock`, `renameLock`, `swapDevice(lockId, newProviderDeviceId)`, `generateAccessCode` (async), `revokeAccessCode`
- Brand sharing: `findActiveBrandCode(reservationId, provider)` returns the existing code value for a (reservation, brand) combo so multiple locks of the same brand share the same code value for each guest
- Connection: `validateAndConnect(apiKey, workspaceName)` — 1.5s mock, validates key prefix, `disconnect()` (wipes connection + locks + codes)
- Mock webhook sync: `syncDevices()` (nudges battery/online state), `emitMockAlerts()` — creates `SMART_LOCK_*` notifications via `useNotifications.createAlert`

#### Components
- **`SettingsSmartLockIntegration.vue`** — Sheet content (not a separate page). Connection card form (API key + workspace name), connected state showing device count + last sync, webhook URL with copy button, all-devices preview (Paired/Available pills), Sync Devices button (triggers `emitMockAlerts` → shows battery/offline alerts in Notification Center)
- **`SettingsIntegrationsOverview.vue`** — added 4th tile "Smart Lock" with amber icon and "Connected · N locks" pill
- **`InboxReservationSmartLocks.vue`** (NEW) — Smart Lock tab content for the Inbox reservation panel. Shows paired locks for the reservation's listing, active codes (filtered by `reservationId` + `status: 'active'`), each code in large monospace with Copy + Revoke actions. "Generate code" button per lock with per-lock loading state (spinner + "Generating…"). Empty states: not connected, listing not found, no locks paired, no codes.

#### Per-listing flow (`ListingSettingsTab.vue`)
- New "Smart Locks" card after Distribution Channels
- Card header holds `+ Add Lock` button (top-right) — click routes to `handleCardHeaderAdd` which opens the Pair Lock Dialog pre-scoped to the currently active tab (Property / first room of the Rooms tab)
- Not-connected state shows link to `/settings/integrations`
- **Tabs** (`<Tabs>` / `<TabsList>` / `<TabsTrigger>` / `<TabsContent>`): `🏢 Property [N]` and `🚪 Rooms [N]` with live count badges from `propertyLocks.length` / `totalRoomLocks`
- Inside each tab, locks render as **compact square cards** in a responsive 1 / 2 / 3-column grid (Tailwind `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`):
  - Header: lock icon + name (inline rename) + brand pill (e.g. `August`) + `Main` badge or set-main star
  - Meta row: battery % (amber when ≤20%) + online/offline dot + scope label
  - Actions row: **Unlock** (primary, 800ms mock spinner, disabled when offline) / **Codes N** (opens Dialog) / **Rename** / **Swap device** / **Unpair**
- **Per-lock Codes Dialog** (`<Dialog v-model:open="codesDialogOpen">`, scoped to one lock at a time via `codesDialogLockId` ref):
  - **Codes list** — each row: purpose (the free-form name the host gave), 6-digit code in monospace with letter-spacing, **time-status badge**, and schedule footer:
    - Schedule footer: `∞ Ongoing` / `🕒 2026-07-09 14:30 → 2026-07-10 11:00` / `⚡ Auto · 23h 42m left`, plus `· Revoked` suffix when applicable
    - Trash button to revoke active codes (sets `status: 'revoked'`)
  - **Add-code form** (bordered bottom section):
    - **Code name** input → stored as `purpose`
    - **Code** input (6 digits, `inputmode="numeric"`) + **Generate** button (refresh icon) → fills a fresh random 6-digit number on click
    - **Schedule** segmented control — `∞ Ongoing` / `🕒 Start/end times`:
      - **Ongoing** → helper "Always active. Revoke manually to disable."; `scheduleType = 'ongoing'` → `endsAt = 2099-12-31`
      - **Start/end times** → 2-column `datetime-local` pickers (Start, End); `scheduleType = 'range'` → uses provided startsAt/endsAt; inline validation that end > start
    - Inline error line in destructive red for validation failures (empty name, non-6-digit code, missing/invalid range)
    - "Close" + "Create code" footer (Create shows spinner during the 700ms mock)
- **Per-lock `lock` row is still inlined here (not via `LockRow.vue`)** — that reusable component exists for `RoomsPanel.vue` only; `ListingSettingsTab.vue` rolls its own card so the Codes Dialog opener can live next to the Unlock button without prop-tunnelling through `<LockRow>`
- **3-state time-status badge** driven by `getCodeTimeStatus(code)`:
  - `set` (green: `border-green-500/30 bg-green-500/10 text-green-700`) — explicit `scheduleType === 'ongoing'`, OR explicit `'range'` with `now >= startsAt && now < endsAt`
  - `setting` (amber: `border-amber-500/30 bg-amber-500/10 text-amber-700`) — explicit `'range'` scheduled for the future (`startsAt > now`), OR no `scheduleType` set yet (auto-generated 24h window)
  - `unset` (muted: `border-muted-foreground/30 bg-muted text-muted-foreground`) — `status === 'revoked'` OR `endsAt <= now` (expired)
- **`LockRow.vue`** — reusable per-lock row component used in `RoomsPanel.vue` only (not in `ListingSettingsTab.vue`):
  - Brand pill, lock name (inline rename), `Main` badge + set-main star, online/offline icon, battery %, assignment label
  - Action buttons: **Rename** / **Swap device** / **Unlock** (loading spinner) / **Unpair**
  - Emits `rename`, `unpair`, `set-main`, `swap`, `unlock`
- **"Add Lock" Dialog** (Pair Lock) opens via either `handleCardHeaderAdd` (card header) or the per-room `+ Add another` button:
  - **Assign to picker** (Property / Room segmented control) — Room mode shows a room Select dropdown
  - Device picker (cards with battery/online/model) of `availableDevices`
  - Name input (auto-fills from selected device name)
  - "Set as main" checkbox (default-checked when no lock yet in selected scope)
  - **Access codes** info card (minimal — single sentence "A code will be auto-generated for each current and future guest.")
  - "Also generate code for housekeeping" checkbox (with `lucide:brush-cleaning` icon — **NOT `lucide:broom`** which is not in `@iconify-json/lucide`) — generates one housekeeping code via `generateAccessCode`
  - Cancel / "Pair Lock" footer (disabled until device picked + room picked if Room scope)

#### Per-room flow (`RoomsPanel.vue`)
- Amber lock count badge (`🔒 N`) next to each room name in the sidebar — click to open per-room lock dialog
- When no locks paired + connected: hover-revealed "Lock" button (`lucide:lock-keyhole`) on the row
- Dialog contents: list of paired locks (with main star, battery, Rename / **Swap device** / Unpair actions), empty state, "Add Lock" button → inline pair form (device picker + name + "Set as main" + auto-generate info + housekeeping checkbox, scoped to that room)
- **Swap device** dialog: shows current device in info bar, lists swappable devices (excludes current), each shows Paired/Available state, disabled when offline

#### Brand sharing (auto-generate on Add Lock)
- When a lock is paired, `ListingSettingsTab.handlePair` / `RoomsPanel.handleRoomPair` iterates **`relevantReservations`** (current + future guests for the listing) and calls `generateAccessCode` for each
- For each (reservation, provider) combo: `findActiveBrandCode` is checked first; if a code exists for the same brand on a different lock, the new code reuses the same value (brand-shared)
- Success toast shows per-guest code with `(new)` or `(shared)` tag, e.g. `"Front Door" paired to this property. Codes: Anna Schmidt: 482915 (shared), Yuki Tanaka: 716234 (new), ...`
- Housekeeping code (if checked) is per-lock, not brand-shared

#### Inbox Smart Lock tab
- `app/components/inbox/ReservationPanel.vue` has a new `Smart Lock` tab (after Upsell, before History) with `lucide:key-round` icon
- `app/components/inbox/ReservationSmartLocks.vue` renders: locks paired to the conversation's listing (looked up by `reservation.listingName`), active codes filtered by `reservation.id`, per-lock "Generate code" button with per-lock loading state
- **Loading state**: each "Generate code" button has a `generatingLockId` ref; while loading, shows `lucide:loader-2` spinner + "Generating…" text + disabled. Prevents double-clicks via early-return guard
- **Code display**: large monospace with letter-spacing (e.g. `4 8 2 9 1 5`), guest name + expiry timestamp below, Copy button (clipboard) + Revoke button (sets status to `revoked`)
- ⚠️ **Required fix**: `app/components/inbox/Layout.vue` synthesizes `effectiveReservation` with `id: c.reservationId` (not `c.id` — the conversation ID). Without this, codes (keyed by `reservationId`) never match the synthesized reservation's `id`, and the tab shows "No active codes" even when codes exist

#### Notifications wiring
- `useNotifications.createAlert(type, severity, context)` — new **generic** alert creator (replaces the `createUpsellAlert`-only API)
- 3 `SMART_LOCK_*` alert types now wired from `useSmartLock.emitMockAlerts`:
  - `SMART_LOCK_BATTERY_CRITICAL` (≤5% battery) → `CRITICAL`
  - `SMART_LOCK_BATTERY_LOW` (≤20% battery) → `WARNING`
  - `SMART_LOCK_OFFLINE` (device offline) → `CRITICAL`
  - `SMART_LOCK_DEAD` + `SMART_LOCK_CODE_FAILED` defined but not yet emitted (no triggering UX yet)
- `SettingsIntegrationsOverview` "Sync Devices" button → `emitMockAlerts` → fires alerts into the bell icon dropdown

#### NOT implemented (intentionally out of scope)
- **Real provider API calls** — all API calls are 1.5s mocked; the `apiKey` is stored but never sent to a real endpoint
- **Web server webhook receiver** — `/api/webhooks/smartlock` route does not exist; webhook events are simulated in-app via `emitMockAlerts`
- **Auto-generate code on reservation create** — codes are auto-generated when pairing a lock, but not when a new reservation is created later
- **Guest-facing code share** — codes are generated but not auto-messaged to the guest (future: via WhatsApp/inbox)
