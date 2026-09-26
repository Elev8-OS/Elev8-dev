> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Minut Integration (`app/components/settings/MinutIntegration.vue` + `app/composables/useMinut.ts`)

Mock-only single-tenant connection that surfaces Minut (noise/sensor monitoring) events into Journeys. Pairing is **global** (one API key per tenant — devices are imported from the Minut workspace, no per-listing pairing UI).

#### Architecture
- **Connection** — `Settings → Integrations` tile (sky `lucide:audio-waveform` icon) → opens Sheet with `MinutIntegration.vue`
- **No pairing UI** — devices auto-seed on connect. No `useMinut().pairLock`-style flow; just `validateAndConnect` → `seedDevices` (6 mock devices, mixed sensor matrix across `lst-1`–`lst-4`)
- **No Inbox/Notification integration** — events flow only into Journeys via `useJourneys().onMinutEvent(event)` (toast.info mock)

#### Data model (`app/composables/useMinut.ts`)
- **`MinutConnection`** — `{ id, apiKey, workspaceName, status: 'connected' | 'disconnected', webhookToken, webhookUrl, deviceCount, connectedAt, lastSyncAt }` — one per tenant, keyed by `'minut-connection'` in `useState` + LocalStorage (`elev8-minut-connection`)
- **`MinutDevice`** — `{ deviceId, name, model, listingId, listingName, batteryLevel, online, sensors: MinutSensor[], lastEventAt }` — **6 mock devices seeded**: mixed sensor matrix (some noise-only, some multi-sensor + smoke, one with low battery + offline used for status demo), spread across `lst-1`–`lst-4`
  - `MinutSensor = 'noise' | 'smoke' | 'temperature' | 'motion'` (device-level capability)
- **`MinutEvent`** — `{ id, type: MinutEventType, deviceId, listingId, dbLevel?, temperatureC?, batteryLevel?, timestamp }`
  - `MinutEventType = 'noise' | 'smoke' | 'temperature' | 'motion' | 'battery' | 'tamper' | 'connectivity'` (last 3 are system-level — generated for any device)
  - Events stored in `useState('minut-events')` + LocalStorage (`elev8-minut-events`), capped at last 50
- **`MinutIntegration.vue`** — Sheet content (not a separate page): connection card (API key `mn_` / `minut_` prefix validation, 1.5s mock), connected state showing 6 mock devices with battery/online/sensor badges, **Sync Devices** button (800ms mock → calls `syncDevices` then `emitMockEvents` which generates 3-6 random events), webhook URL with copy button. Mirrors `SmartLockIntegration.vue` pattern

#### Composable (`useMinut.ts`)
- **State**: `connection` (`useState`+LocalStorage), `devices` (`useState`+LocalStorage), `events` (`useState`+LocalStorage, capped at 50); `isConnected` is `connection.value?.status === 'connected'`
- **Connection**: `validateAndConnect(apiKey, workspaceName)` — 1.5s mock, validates key prefix; auto-calls `seedDevices()`; auto-generates `webhookToken` (`whsec_*`) and `webhookUrl`
- **Disconnect**: `disconnect()` wipes connection only (devices + events persist on tenant cleanup — gated by user confirmation dialog)
- **Mock I/O**: `seedDevices()` (called once on first connect), `syncDevices()` (nudges `lastSyncAt`), `emitMockEvents()` (3-6 random events weighted by device sensor matrix; bumps `lastEventAt` per device)
- **Lookups**: `getEventsByListing(listingId)`, `getEventsByType(type)`

#### Journeys integration (`app/composables/useJourneys.ts`)
- **1 first-class Journey trigger type** (`minut_event`) that fires for any Minut sensor event — covers all 7 event subtypes (`noise | smoke | temperature | motion | battery | tamper | connectivity`) under a single trigger. `triggerMeta.minut_event.label`: "Trigger when Minut detects sensor events like noise or occupancy issues"
- **`onMinutEvent(event: Pick<MinutEvent, 'type' | 'deviceId' | 'listingId'>)`** — finds active journeys whose trigger type is `minut_event` AND whose listing scope includes the event's `listingId` (or scope = `'All Properties'`), then emits a `toast.info` per match. The function is **void** — it does NOT return the list of fired journey IDs (only fires toasts). The event subtype is shown in the toast description (e.g. "triggered by Minut noise" / "triggered by Minut smoke") for diagnostic context
- **`defaultTriggerSettings('minut_event')`** returns the standard `immediate_delay` block — reusing the existing sidebar form with Minut-specific copy ("Trigger as soon as a Minut sensor event is detected, with no delay.")

#### Hierarchical Integration Events trigger picker (`JourneyStepSidebar.vue`)
- Trigger Select now shows a new bottom group **"Integration Events"** after the standard ones (Booking, Guest Review, Inquiry, etc.). Contains 3 rows: **Minut / Turno / Tidy** (Turno + Tidy are stubbed rows to show the pattern)
- Each row has a **Connected / Not connected** badge in the right column. Minut's badge wires to `useMinut().isConnected` (green when connected, gray otherwise)
- When row is **Not connected**, clicking it is a no-op (or shows an inline "Connect at /settings/integrations" hint depending on row). When **Connected**, clicking expands to **1 child item** (`minut_event`) — the picker shows a single consolidated option labeled "Trigger when Minut detects sensor events like noise or occupancy issues"
- Selecting the sub-item sets the journey trigger type to `minut_event` and the existing `immediate_delay` block appears in the right sidebar — no new sidebar code required

#### Tests (`tests/composables/useMinut.spec.ts`, `tests/composables/useJourneys-minut.spec.ts`)
- 19 `useMinut` tests cover validateAndConnect (key prefix, errors), seedDevices (idempotent, replaces existing), syncDevices, emitMockEvents (event generation, sensor filtering, last-event-at updates), disconnect, getEventsByListing/Type, LocalStorage persistence
- 6 `useJourneys-minut` tests cover `onMinutEvent` matching (by single `minut_event` trigger + listing scope), firing (only active journeys), out-of-scope filtering (`listingId` mismatch), all-properties scope, and that the trigger fires for any event subtype (noise / smoke / battery) with a single `minut_event` trigger

#### NOT implemented (intentionally out of scope per user)
- **Notification alerts** — no `MINUT_*` alert types; events flow only through Journeys
- **Per-listing device pairing UI** — devices are workspace-scoped, not listing-scoped; no listing-level pair/unpair flow
- **Per-event condition filters** — every event of a type fires all matching journeys; no `dbLevel > X` or `temperatureC > Y` filtering
- **Real webhook receiver** — `/api/webhooks/minut` does not exist; events are simulated in-app via `emitMockEvents`
- **Multi-workspace / multi-account** — single-connection only (mirrors SmartLock v1)
