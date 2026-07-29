# Minut × Journeys Integration — Design Spec

> **Status:** Draft
> **Date:** 2026-07-29
> **Author:** Claude (brainstorming + design)
> **Scope:** Settings card + Journey triggers only (no notification alerts, no per-listing device pairing UI)

## 1. Purpose & Background

Elev8's automation surface (Journeys) currently reacts to **conversation events** (inquiry, host message) and **reservation events** (new booking, check-in, check-out, cancellation). Property managers increasingly deploy **Minut** sensors in their short-term rentals to monitor noise, smoke, temperature, motion, and connectivity. Today those events are invisible to Elev8 — staff must check Minut's dashboard separately and respond manually.

This spec adds **Minut as a first-class event source** for Journeys. When a Minut device fires (noise threshold crossed, smoke alarm, temperature spike, etc.), a matching Journey can run.

**Out of scope (intentionally deferred):**
- `MINUT_*` notification alert types — staff will read event history in the Minut integration sheet
- Per-listing device pairing UI in `ListingSettingsTab` — devices come in from the Minut workspace via the API key
- Per-event condition filters inside the Journey sidebar (e.g. "noise ≥ 90 dB")
- Real Minut API integration (mock-only, consistent with all other integrations in this codebase)
- Guest-facing "send quiet hours reminder" presets

## 2. User Stories

**As a property manager**, I want to:
1. Connect my Minut workspace to Elev8 from **Settings → Integrations** with an API key
2. See a list of devices in my Minut workspace inside the Minut integration sheet
3. Build a Journey that fires when a Minut noise event happens in any of my properties
4. Build a Journey that fires on a specific sensor type (smoke alarm vs noise vs temperature)
5. Have the Journey only fire for properties I've scoped to it (existing `properties` field)

**As a guest relations agent**, I want to:
6. See in a Journey's trigger summary which event type it reacts to (e.g. "Minut Smoke Alarm")

## 3. Architecture

### 3.1 Component map

```
Settings → Integrations (existing)
  └─ SettingsIntegrationsOverview.vue (modified)
      ├─ WhatsApp tile  (existing)
      ├─ 3CX tile       (existing)
      ├─ Smart Lock tile (existing)
      ├─ Payout tile    (existing)
      └─ Minut tile     (NEW) → opens Sheet
          └─ SettingsMinutIntegration.vue (NEW) — Sheet content

app/composables/useMinut.ts (NEW) — connection state, devices, mock events

Journeys editor (existing)
  └─ app/components/journeys/data/journeys.ts (modified)
      ├─ 7 new TriggerType keys
      ├─ New "Integration Events" triggerMeta category
      └─ triggerMeta entries for each new trigger
  └─ JourneyStepSidebar.vue (modified)
      └─ Hierarchical trigger picker: top-level "Minut" entry, expands to 7 sensor types when connected
  └─ useJourneys.ts (modified)
      └─ onMinutEvent(payload) — matches payload to journeys and runs them (mock)
```

### 3.2 Data flow

```
Minut workspace (external, mocked)
    │
    │ API key set in Settings
    ▼
useMinut().connection (useState, localStorage)
    │
    │ validateAndConnect(apiKey, workspaceName) — 1.5s mock
    ▼
useMinut().devices (mock: 6 devices, mixed providers — noise-only, noise+smoke, etc.)
    │
    │ "Sync Devices" button → emitMockEvents()
    ▼
Random sensor event generated → onMinutEvent({ type, listingId, deviceId, dbLevel?, temp?, timestamp })
    │
    ▼
useJourneys().onMinutEvent(payload)
    │
    ├─ Filter journeys:
    │   trigger.triggers[] contains matching minut_* type
    │   AND journey.properties includes payload.listingId
    │       OR journey.properties includes 'All Properties'
    │   AND journey.status === 'active'
    │
    └─ For each match → mock run:
        ├─ toast.info("Journey '<name>' triggered by Minut <type>")
        └─ (future) create inbox note on matching reservation if any
```

### 3.3 State persistence

- `useMinut().connection` — `useState<MinutConnection | null>('minut-connection')`, persisted to localStorage `elev8-minut-connection`
- `useMinut().devices` — `useState<MinutDevice[]>('minut-devices')`, persisted to localStorage `elev8-minut-devices`
- On disconnect: wipe connection + devices + clear localStorage keys

## 4. Data Model

```ts
// app/composables/useMinut.ts

export interface MinutConnection {
  id: string
  apiKey: string
  workspaceName: string
  status: 'connected' | 'disconnected'
  webhookToken: string
  webhookUrl: string
  deviceCount: number
  connectedAt: string
  lastSyncAt: string | null
}

export interface MinutDevice {
  deviceId: string
  name: string
  model: string       // e.g. "Minut Point", "Minut Point Pro"
  listingId: string   // assigned at the Minut workspace level (mock)
  listingName: string
  batteryLevel: number
  online: boolean
  sensors: MinutSensor[]   // each device has 1-3 sensors
  lastEventAt: string | null
}

export type MinutSensor = 'noise' | 'smoke' | 'temperature' | 'motion'

export interface MinutEvent {
  id: string
  type: 'noise' | 'smoke' | 'temperature' | 'motion' | 'battery' | 'tamper' | 'connectivity'
  deviceId: string
  listingId: string
  // Optional per-type payload
  dbLevel?: number        // noise events
  temperatureC?: number   // temperature events
  batteryLevel?: number   // battery events
  timestamp: string
}
```

```ts
// app/components/journeys/data/journeys.ts (additions)

export type MinutTriggerType =
  | 'minut_noise'
  | 'minut_smoke'
  | 'minut_temperature'
  | 'minut_motion'
  | 'minut_battery'
  | 'minut_tamper'
  | 'minut_connectivity'

// Add to existing TriggerType union:
export type TriggerType =
  | ... existing 15 types
  | MinutTriggerType   // 7 new keys

// triggerMeta additions — each gets category: 'integration'
export const triggerMeta = {
  ...existing,
  minut_noise:        { label: 'Minut Noise Event',         category: 'integration' },
  minut_smoke:        { label: 'Minut Smoke Alarm',         category: 'integration' },
  minut_temperature:  { label: 'Minut Temperature Event',   category: 'integration' },
  minut_motion:       { label: 'Minut Motion Event',        category: 'integration' },
  minut_battery:      { label: 'Minut Battery Low',         category: 'integration' },
  minut_tamper:       { label: 'Minut Tamper Event',        category: 'integration' },
  minut_connectivity: { label: 'Minut Device Offline',      category: 'integration' },
}

export type TriggerCategory = 'conversation' | 'reservation' | 'calendar' | 'integration'
```

## 5. UI Surfaces

### 5.1 Settings → Integrations: Minut tile

In `app/components/settings/SettingsIntegrationsOverview.vue`, add a 5th tile:

```vue
<!-- Minut (Noise & Sensor Monitoring) -->
<div class="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-border/80">
  <div class="mb-3 flex items-start justify-between">
    <div class="flex h-9 w-9 items-center justify-center rounded-md border bg-sky-500/10">
      <Icon name="lucide:audio-waveform" class="size-5 text-sky-600" />
    </div>
    <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
          :class="statusToneClass[minutPill.tone]">
      <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass[minutPill.tone]" />
      {{ minutPill.label }}
    </span>
  </div>
  <p class="mb-1 text-sm font-medium">Minut (Noise & Sensor Monitoring)</p>
  <p class="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
    Receive noise, smoke, motion, and sensor events from Minut devices and trigger Journeys on them.
  </p>
  <Button variant="outline" size="sm" class="self-start" @click="openSheet('minut')">
    {{ minutConnected ? 'Manage' : 'Connect' }}
  </Button>
</div>
```

`openIntegration` type union extended to include `'minut'`. `activeComponent` and `activeSheetTitle` getters extended. New `minutPill` computed reads from `useMinut()`.

### 5.2 SettingsMinutIntegration.vue

Mirrors `SmartLockIntegration.vue` (Sheet content) with these adjustments:

**Disconnected state:**
- API key input (`placeholder="mn_..."`, type="password")
- Workspace name input (optional)
- "Connect" button → 1.5s mock → success/error

**Connected state:**
- Workspace header card (name, device count, last sync)
- "Sync Devices" button → `emitMockEvents()` → toast.success
- Webhook URL card (copy button)
- Devices list (name, battery %, online dot, last event, scope label)

**Connect dialog:**
- API key validation: must start with `mn_` or `minut_`
- Error states surface inline

**Disconnect dialog:**
- Standard confirmation; wipes connection + devices

### 5.3 Journeys editor — hierarchical trigger picker

In `JourneyStepSidebar.vue`, the existing trigger Select currently groups triggers as **Conversation-Based**, **Reservation Events**, **Calendar-Based**. A new group **Integration Events** is added.

```
Trigger dropdown:
  Conversation-Based
    Conversational Trigger
    Sentiment Trigger
  Reservation Events
    Inquiry Received
    Host Message Received
    New Booking
    Check-in Day
    Check-out Day
    Guest Check-out
    Cancellation
  Calendar-Based
    Send Once
    Gap Nights
    Daily / Weekly / Monthly / Yearly
  ★ Integration Events        ← NEW group
    ┌─────────────────────────────────┐
    │ Minut  [● Connected]            │  ← selectable when connected
    │     Minut Noise Event           │
    │     Minut Smoke Alarm           │
    │     Minut Temperature Event     │  ← children render in a sub-menu
    │     Minut Motion Event          │
    │     Minut Battery Low           │
    │     Minut Tamper Event          │
    │     Minut Device Offline        │
    │                                 │
    │ Turno  [○ Not connected]        │  ← disabled (future)
    │ Tidy   [○ Not connected]        │  ← disabled (future)
    └─────────────────────────────────┘
```

**Implementation in `JourneyStepSidebar.vue`:**

- Extend `allTriggerOptions` filter to include the new `'integration'` category
- Render `integrationTriggers` as a **collapsible group** with a small header row that has the Minut/Turno/Tidy provider rows
- Each provider row has: icon, name, connection badge (reads `useMinut().isConnected`), and a chevron caret
- Clicking the provider row **expands a nested popover/menu** with the 7 sensor types
- Clicking a sensor type calls `setTriggerType(i, 'minut_noise')` etc. — same wiring as any other trigger
- When Minut is NOT connected: provider row is visible but children are hidden, the row is disabled, and a tooltip explains "Connect Minut in Settings → Integrations to enable these triggers"

**Visual design:**
- Provider rows use `bg-muted/40 hover:bg-muted` with a small chevron (`i-lucide-chevron-right`) that rotates 90° when expanded
- Connection badge: 6px green dot + "Connected" text, or 6px gray dot + "Not connected"
- Nested sensor types indented 16px, no separate group label
- This matches the visual rhythm of the existing Select dropdown without inventing a new nested-component pattern

### 5.4 Trigger settings (sidebar right pane)

When a `minut_*` trigger type is selected, the existing `immediate_delay` settings block renders (no new code):

```vue
<!-- This block already exists for inquiry_received, new_booking, etc.
     Just extend the includes() check in triggerSettingsType() to cover
     minut_* keys. The UI is identical. -->

Trigger immediately
  ☑ Trigger as soon as the Minut event is detected, with no delay.

OR (when unchecked):

Trigger after event
  [ 0 ] days  [ 0 ] hours  [ 0 ] minutes

At specific time (optional)
  [ --:-- ]
```

The setting `triggerImmediately` / delay / `specificTime` are already in `TriggerSettings`. **No new fields needed.** Just one line change: extend the `['inquiry_received', ...].includes(type)` check in `triggerSettingsType()`.

### 5.5 Trigger summary in step card

`JourneyStepCard.vue` line 73-78 already reads:
```ts
return entries.map((e: any) => triggerMeta[e.type]?.label ?? e.type).join(' · ')
```

With the new `triggerMeta` entries, Minut triggers render their label automatically — no code change needed.

## 6. Composable API

```ts
// app/composables/useMinut.ts

export function useMinut() {
  const connection = useState<MinutConnection | null>('minut-connection', () => loadFromStorage<MinutConnection | null>(CONNECTION_KEY, null))
  const devices    = useState<MinutDevice[]>('minut-devices', () => loadFromStorage<MinutDevice[]>(DEVICES_KEY, []))
  const isConnected = computed(() => connection.value?.status === 'connected')

  async function validateAndConnect(apiKey: string, workspaceName: string): Promise<{ success: boolean, error?: string }>
  function disconnect(): void
  function syncDevices(): void                       // bumps lastSyncAt
  function emitMockEvents(): MinutEvent[]            // generates 3-6 random events

  // Lookups
  function getDeviceById(deviceId: string): MinutDevice | undefined
  function getEventsByListing(listingId: string): MinutEvent[]
  function getEventsByType(type: MinutEvent['type']): MinutEvent[]

  return { connection, devices, isConnected, validateAndConnect, disconnect,
           syncDevices, emitMockEvents, getDeviceById, getEventsByListing, getEventsByType }
}
```

`useJourneys.ts` gains one function:

```ts
function onMinutEvent(event: MinutEvent) {
  const minutType = `minut_${event.type}` as MinutTriggerType
  for (const journey of journeys.value) {
    if (journey.status !== 'active') continue
    const triggerStep = journey.steps.find(s => s.type === 'trigger') as TriggerStep | undefined
    if (!triggerStep) continue
    const matches = triggerStep.triggers.some(t => t.type === minutType)
    if (!matches) continue
    const inScope = triggerStep.properties.includes('All Properties')
      || triggerStep.properties.includes(event.listingId)
    if (!inScope) continue
    // Mock execution
    toast.info(`Journey "${journey.name}" triggered by Minut ${event.type}`, {
      description: `Device ${event.deviceId} at listing ${event.listingId}`,
    })
  }
}
```

## 7. Mock Data

**6 seeded devices** (3 noise-only + 2 noise+smoke + 1 noise+temperature+smoke, covering the sensor matrix). Assigned to 4 different mock listings so journey property-scoping can be demonstrated:

```
dev-001  Minut Point     — Villa Kastila (noise)
dev-002  Minut Point     — Villa Canggu (noise)
dev-003  Minut Point Pro — Ubud Treehouse (noise + smoke)
dev-004  Minut Point     — Seminyak Loft (noise + smoke)
dev-005  Minut Point Pro — Villa Canggu (noise + temperature + smoke)
dev-006  Minut Point     — Villa Kastila (noise)
```

**Mock events** generated by `emitMockEvents()`:
- 60% noise (random 65–105 dB)
- 15% smoke (always critical — `dbLevel` absent)
- 10% temperature (random 5–40°C)
- 5% motion (no payload)
- 5% battery low (≤ 20%)
- 5% connectivity (device offline)

Each event picks a random device, generates the appropriate payload, calls `useJourneys().onMinutEvent(event)`.

## 8. Files Touched

**New:**
- `app/composables/useMinut.ts`
- `app/components/settings/SettingsMinutIntegration.vue`

**Modified:**
- `app/components/settings/SettingsIntegrationsOverview.vue` — add Minut tile, wire Sheet
- `app/components/journeys/data/journeys.ts` — add 7 trigger types, 1 new TriggerCategory, 7 triggerMeta entries, extend `defaultTriggerSettings` branch
- `app/components/journeys/JourneyStepSidebar.vue` — add `'integration'` category filter + hierarchical provider picker with connection badges
- `app/components/journeys/JourneyEditor.vue` — extend `makeStep` to handle the new trigger types? (No — `makeStep` only handles step types, not trigger sub-types. No change needed.)
- `app/composables/useJourneys.ts` — add `onMinutEvent()` function

## 9. Error Handling

| Scenario | Behavior |
|---|---|
| Empty API key | Inline error: "API key is required." (1.5s mock connection) |
| API key wrong prefix | Inline error: "Invalid API key format. Keys start with 'mn_' or 'minut_'." |
| Minut disconnected, user picks Minut trigger in Journey | Dropdown shows "Not connected" badge, trigger children not selectable, tooltip: "Connect Minut in Settings → Integrations to enable these triggers." |
| Journey has `minut_*` trigger but Minut gets disconnected | Journey is saved fine. At runtime, `onMinutEvent` is never called → journey silently never fires. Future enhancement: show a warning on the trigger card. |
| `emitMockEvents` called with no devices | Returns empty array, no toast |
| `onMinutEvent` called with unknown listing ID | No journey matches → silent no-op |

## 10. Testing (manual, mock-only — same as all other integrations)

| Manual test | Pass criteria |
|---|---|
| Settings → Integrations → Minut tile appears | Tile renders with "Not connected" pill |
| Click Connect → enter valid API key | Connection succeeds, tile pill flips to "Connected · 6 devices" |
| Click Manage on Minut tile | Sheet opens, workspace header + 6 devices listed |
| Click "Sync Devices" | Toast "Synced 6 Minut devices", random event toast.info fires (showing journey matches) |
| Disconnect Minut | Tile pill flips to "Not connected", devices wiped |
| Journeys → edit any journey → trigger Select → Integration Events group | "Minut" provider row appears with "Not connected" badge (since we disconnected) |
| Connect Minut again, return to Journey editor | "Minut" row now shows "Connected" badge, chevron expands, 7 sensor types visible |
| Pick "Minut Smoke Alarm" | Right sidebar shows the immediate_delay block with copy "Trigger as soon as the Minut event is detected, with no delay." |
| Toggle "Trigger immediately" off, set delay to 5 min | Delay fields appear, value saves to `trigger.settings.delayMinutes` |
| Add trigger → save journey | Trigger summary on step card shows "Minut Smoke Alarm" |
| Click Sync Devices with the smoke-triggering journey scoped to "Villa Kastila" only | When a smoke event fires for dev-001 (Villa Kastila), toast.info names the journey. Smoke events for other listings do not trigger it. |

## 11. Anti-patterns avoided

- ❌ Hardcoded colors → use `bg-sky-500/10`, `text-sky-600` (theme-consistent, follows SmartLock `bg-amber-500/10` precedent)
- ❌ Direct mutation of `journeys.value` → use spread (`journeys.value = [...]`)
- ❌ Generic `IntegrationStep` to ship Minut → instead a first-class trigger type, so users get the standard immediate_delay UX they already know
- ❌ Device picker inside the Journey sidebar → per user direction, devices stay paired at the Minut workspace level (matched via API key + listing metadata)
- ❌ Duplicating the trigger Select component → extend existing pattern with a hierarchical provider group inside the same Select
- ❌ New `MINUT_*` alert types → out of scope per user feedback; staff read event history in the Minut sheet
- ❌ New per-listing pairing UI in `ListingSettingsTab` → out of scope per user feedback

## 12. Open questions / Deferred to follow-up

1. **Per-event condition filters** ("noise ≥ 90 dB") — defer to a later iteration when staff ask for finer-grained triggers
2. **MINUT_* notification alerts** — defer; staff can audit events in the Minut sheet's devices table for now
3. **Per-listing device pairing UI** — defer; current mock assigns devices to listings server-side via the Minut workspace
4. **Guest-facing quiet-hours reminder preset journey** — defer; can ship as a marketplace template once noise triggers are in production
5. **Real Minut webhook receiver** (`/api/webhooks/minut`) — defer; same pattern as SmartLock's deferred webhook work
6. **Multi-device grouping** (rooms vs property) — defer; single-listing pairing only in v1

---

## 13. Self-review checklist (pre-handoff)

- [x] No TBDs or vague requirements
- [x] No internal contradictions — the user-confirmed scope (Minut → Journey only) is consistent across sections 3, 5, 8, 11
- [x] Single focused implementation plan possible — touches 2 new files + 4 modified files, ~400–500 LoC total
- [x] No ambiguity — Minut trigger scope is exactly 7 types; Settings card mirrors SmartLock; device pairing is deferred