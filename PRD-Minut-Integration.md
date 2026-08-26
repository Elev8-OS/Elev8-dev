# PRD: Minut (Noise & Sensor Monitoring) Integration — Real API via HostBuddy

**Status:** Draft (Requirements — for engineering implementation)
**Owner:** Juli (Product)
**Module:** Settings → Integrations → Minut (`/settings/integrations` → Minut card)
**Last Updated:** 2026-08-25
**Type:** Real integration (NOT mock). Elev8 reads Minut devices/events through the **HostBuddy API**.

---

## TL;DR (Developer Quickstart)

Connect Elev8 to **Minut** noise/smoke/temperature/motion sensors through the **HostBuddy API** (the PMS that already sits between Elev8 and Minut). Staff authorize Elev8, import their Minut devices, map each device to a listing they own, and receive real-time **webhook events** from HostBuddy/Minut. Those events drive the existing **Journeys** automation engine via the `minut_event` trigger.

**Data flow is push-based (webhook), not polling.** Elev8 never talks to the Minut API directly — all device reads and event delivery go through HostBuddy's API and webhooks.

The existing `useMinut.ts` mock composable, `MinutIntegration.vue` mock sheet, and `onMinutEvent()` mock matcher are the **behavioral reference**. This PRD replaces their mock internals with a real client + server-side persistence + a webhook receiver, while keeping the same UI surfaces, status semantics, and Journeys trigger UX.

---

## 1. Problem Statement

Property managers deploy Minut sensors to detect noise, smoke, temperature, and motion in their short-term rentals. Today those events are invisible to Elev8 — staff check Minut's dashboard separately and respond manually. Minut must become a first-class event source so Elev8 can react automatically (via Journeys) and staff can see which device is paired to which listing.

---

## 2. Feature Summary

| Sub-feature | What it does |
|---|---|
| **OAuth connection (HostBuddy)** | Staff authorize Elev8 against HostBuddy; Elev8 stores the resulting tokens and connects the Minut workspace. |
| **Device import & mapping** | Pull the workspace's Minut devices and map each one to a listing the user owns (or leave unassigned). |
| **Webhook event ingestion** | HostBuddy/Minut push sensor events to an Elev8 webhook endpoint; Elev8 validates, persists, and dispatches them. |
| **Journeys trigger** | A single `minut_event` trigger fires active Journeys when a mapped device in a scoped listing emits an event. |
| **Integrations card + status pill** | Card shows `Not connected` / `Connected · N devices` driven by the real connection state. |

---

## 3. Scope

### In scope (v1)
- OAuth connect / disconnect against HostBuddy for the Minut integration.
- Pull Minut devices for the connected workspace via HostBuddy API.
- Map each device to one of the user's listings (`listings` data) or leave unassigned.
- Receive and persist real webhook events (noise, smoke, temperature, motion, battery, tamper, connectivity).
- Server-side persistence of connection, devices, events (no longer localStorage-only mocks).
- `minut_event` Journeys trigger, gated by `useMinut().isConnected`, with the `onMinutEvent()` matcher wired to real events.
- Integrations card + config sheet reflecting real state.

### Out of scope (v1)
- Direct Minut API integration (Elev8 ↔ Minut without HostBuddy).
- Per-event condition filters (e.g. "noise ≥ 90 dB") in the Journey sidebar.
- `MINUT_*` notification alert types in the Notification Center.
- Per-listing device pairing UI outside the Minut config sheet (e.g. `ListingSettingsTab`).
- Guest-facing "quiet hours reminder" preset Journeys.
- Device control/actuation (this is read-only monitoring + event consumption).

---

## 4. Architecture

### 4.1 System boundary

```
Minut sensors
     │
     ▼
HostBuddy (PMS — owns Minut connection, properties, bookings)
     │   ▲
     │   │  (a) REST: OAuth + pull devices / pull backfill events
     │   │  (b) Webhook: push sensor events to Elev8
     ▼   │
Elev8 server (Nitro)  ──►  Elev8 DB/persistence  ──►  UI (composables)  ──►  Journeys
```

- **(a) HostBuddy REST API** — OAuth token exchange, refresh, "list Minut devices", optional event backfill.
- **(b) HostBuddy/Minut webhook** — HostBuddy pushes each Minut sensor event to an Elev8 endpoint in near-real-time.

### 4.2 Real vs. existing mock

| Concern | Existing mock (`useMinut.ts`) | Real implementation |
|---|---|---|
| Connect | `completeOAuth()` — 1.5s `setTimeout` | OAuth authorization-code flow against HostBuddy |
| Devices | `seedDevices()` — 6 hardcoded fixtures | `GET` devices from HostBuddy API |
| Events | `emitMockEvents()` — random client-side | Webhook receiver + persisted event store |
| Persistence | `useState` + localStorage | Server-side store (DB / KV) keyed by tenant |
| Journeys match | `onMinutEvent()` — `toast.info` | Same matcher, fired on real webhook events |

The UI copy, status pill semantics, and device-mapping UX are **unchanged** from the mock — only the data source and transport change.

---

## 5. Data Model

### 5.1 Connection

```ts
interface MinutConnection {
  id: string                     // Elev8 internal id
  tenantId: string               // owning tenant
  workspaceId: string            // HostBuddy workspace id
  workspaceName: string
  status: 'connected' | 'disconnected'
  accessToken: string            // encrypted at rest
  refreshToken?: string          // encrypted at rest
  tokenExpiresAt: string         // ISO timestamp
  webhookId: string              // HostBuddy webhook registration id
  webhookSecret: string          // signing secret (encrypted at rest)
  connectedAt: string
  lastSyncAt: string | null
}
```

### 5.2 Device

```ts
type MinutSensor = 'noise' | 'smoke' | 'temperature' | 'motion'

interface MinutDevice {
  deviceId: string               // HostBuddy/Minut device id
  tenantId: string
  name: string
  model: string                  // e.g. "Minut Point", "Minut Point Pro"
  listingId: string | null       // Elev8 listing id; null = unassigned
  batteryLevel: number | null
  online: boolean
  sensors: MinutSensor[]
  lastEventAt: string | null
  lastSyncedAt: string
}
```

### 5.3 Event

```ts
type MinutEventType = 'noise' | 'smoke' | 'temperature' | 'motion' | 'battery' | 'tamper' | 'connectivity'

interface MinutEvent {
  id: string                     // Elev8 internal id (or provider event id)
  providerEventId: string        // HostBuddy/Minut event id (for dedupe)
  tenantId: string
  type: MinutEventType
  deviceId: string
  listingId: string | null       // resolved from device mapping at ingest time
  dbLevel?: number               // noise
  temperatureC?: number          // temperature
  batteryLevel?: number          // battery
  receivedAt: string             // Elev8 ingest timestamp
  occurredAt: string             // event occurrence timestamp from provider
}
```

---

## 6. Server API Surface

> Exact HostBuddy endpoint paths/auth are **Open Questions** (see §11). The contracts below describe *what* Elev8 needs; engineering confirms the *how* against the HostBuddy API during implementation.

### 6.1 Elev8 → HostBuddy (client calls, made server-side)

| Operation | Direction | Notes |
|---|---|---|
| OAuth authorize redirect | Elev8 → HostBuddy | `GET /auth/hostbuddy/authorize` style; returns redirect URL |
| OAuth token exchange | Elev8 → HostBuddy | Exchange code for access + refresh tokens |
| Token refresh | Elev8 → HostBuddy | On `401` / expiry, refresh access token |
| List Minut devices | Elev8 → HostBuddy | Returns devices + current metadata |
| (Optional) Backfill events | Elev8 → HostBuddy | Pull events missed during downtime |

### 6.2 Elev8 server endpoints (Nitro, `server/api/`)

| Route | Method | Purpose |
|---|---|---|
| `/api/integrations/minut/connect` | POST | Start OAuth; returns redirect URL |
| `/api/integrations/minut/callback` | GET | OAuth callback; exchanges code, persists connection |
| `/api/integrations/minut/disconnect` | POST | Revoke tokens, clear connection (preserve devices/events) |
| `/api/integrations/minut/devices` | GET | List devices for the tenant |
| `/api/integrations/minut/devices/:id/mapping` | PUT | Map/unmap a device to a listing |
| `/api/integrations/minut/events` | GET | List recent events for the tenant (filter by listing/type) |
| `/api/webhooks/minut` | POST | **Webhook receiver** — validate signature, dedupe, persist, dispatch to Journeys |

### 6.3 Webhook contract

- **Method:** `POST` with JSON body.
- **Signature validation:** verify `X-HostBuddy-Signature` (or equivalent) using the per-connection `webhookSecret` with HMAC-SHA256. Reject (`401`) on mismatch. **Do not process unsigned payloads.**
- **Idempotency:** dedupe on `providerEventId`; ignore already-seen events.
- **Response:** return `200` immediately after persisting (fast ack); do not block on Journeys dispatch.
- **Resolution:** `listingId` is resolved from the current device mapping at ingest time; unmapped devices produce `listingId: null` and are stored but do not fire Journeys.

---

## 7. Composable / Client Layer

### 7.1 `useMinut()` — public API (keep the same surface as the mock where possible)

```ts
const minut = useMinut()
// state
minut.connection       // Ref<MinutConnection | null>
minut.devices          // Ref<MinutDevice[]>
minut.events           // Ref<MinutEvent[]>
minut.isConnected      // Computed<boolean>
minut.userListings     // Computed<Listing[]>
minut.unassignedDevices
minut.assignedDeviceCount
// actions
await minut.connect()            // starts OAuth, opens redirect
await minut.disconnect()
await minut.syncDevices()        // pulls devices from HostBuddy
await minut.assignDeviceToListing(deviceId, listingId | null)
```

### 7.2 Journeys matcher (`useJourneys.onMinutEvent`)

Behavioral contract (unchanged from mock, now fed by real webhook events):

For each active Journey with a `trigger` step containing a `minut_event` trigger:

1. `journey.status === 'active'`
2. `event.listingId !== null` (device must be mapped)
3. `triggerStep.properties` includes `event.listingId` **or** `'All Properties'`
4. On match → execute the Journey (real execution replaces the mock `toast.info`).

---

## 8. UI Surfaces (unchanged behavior, real data)

### 8.1 Integrations card (`SettingsIntegrationsOverview.vue`)
- Category: **Devices & Sensors**. Icon `lucide:audio-waveform` on `bg-sky-500/10`.
- Title: `Minut (Noise & Sensor Monitoring)`.
- Status pill: `Not connected` (idle) → `Connected · N devices` (connected).
- Action: `Connect` / `Manage`.

### 8.2 Config sheet (`SettingsMinutIntegration.vue`)
- **Disconnected:** "Connect with Minut" → OAuth flow (redirect + callback), not an API-key form.
- **Connected:** workspace header (name, device count, mapped count, last sync), `Sync Devices`, `Test ping`, `Disconnect` (confirmation), and the **Device Mapping** table (search, listing filter, mapped-only toggle, per-row listing picker with `Unassigned`).
- All toasts (`toast.success`/`toast.info`) for connect, sync, map, disconnect.

### 8.3 Journeys trigger picker
- `Minut Sensor Event` under **Integration Events**, disabled with a `Not connected` badge until `useMinut().isConnected`.

---

## 9. Acceptance Criteria

1. Staff can complete OAuth against HostBuddy and the Minut card flips to `Connected`.
2. `Sync Devices` pulls the workspace's real Minut devices and renders them in the mapping table.
3. Each device can be mapped to any of the user's listings or set to `Unassigned`; unassigned/mapped counts stay correct.
4. Real sensor events arrive via webhook and appear in the device/event view.
5. Webhook requests with an invalid/missing signature are rejected (`401`) and never persisted.
6. Duplicate webhook deliveries (same `providerEventId`) are deduplicated.
7. Unmapped-device events are stored but do not fire Journeys.
8. A `minut_event` Journey fires only when: active, device mapped, and listing (or `All Properties`) in scope.
9. Disconnect revokes tokens and clears the connection but preserves device mappings and event history.
10. No secrets (access/refresh token, webhook secret) are ever sent to the client or logged.

---

## 10. Security & Reliability (non-functional requirements)

- **Secrets at rest:** access token, refresh token, and webhook secret are encrypted; never exposed via API responses or client state.
- **Secrets in transit:** all HostBuddy calls are HTTPS; webhook is verified via HMAC-SHA256 signature.
- **Token lifecycle:** refresh before expiry; on refresh failure, mark connection as needing re-auth (don't crash).
- **Rate limiting / backoff:** respect HostBuddy rate limits; exponential backoff on failed pulls.
- **Idempotent webhook:** dedupe by `providerEventId`; safe against redelivery.
- **Error isolation:** a single bad event must not break the webhook receiver or drop subsequent events.
- **No secrets in logs:** redact tokens/signatures from server logs.

---

## 11. Open Questions (for engineering to resolve against HostBuddy)

> These are blocking unknowns that require the HostBuddy API contract. Product defers to engineering to confirm and document during implementation.

1. **HostBuddy API base URL, auth model (OAuth 2.0 authorization code? client credentials?), and scopes** for reading Minut devices/events.
2. **Endpoint paths & payload schemas** for: list devices, pull events, webhook registration.
3. **Webhook event shape** — field names, event type enum values, and how Minut sensor subtypes (noise/smoke/temperature/motion/battery/tamper/connectivity) map to HostBuddy payloads.
4. **Webhook signature mechanism** — header name, HMAC vs. public-key, secret provisioning.
5. **Property mapping** — how HostBuddy properties align to Elev8 listings (by id? external id? name?).
6. **Device identity** — stable device id field, model naming, sensor capability list.
7. **Webhook redelivery / ordering guarantees** — does HostBuddy retry? Is ordering guaranteed per device?
8. **Where the Minut→HostBuddy pairing itself is configured** — staff-side in HostBuddy's Minut integration (out of Elev8's control), confirmed via the HostBuddy API surface.

---

## 12. Definition of Done (DoD)

### Functional
- [ ] OAuth connect against HostBuddy succeeds and stores an encrypted connection.
- [ ] Token refresh works; expired/invalid tokens trigger re-auth, not a crash.
- [ ] `syncDevices` pulls real devices and maps them to Elev8 listings (or unassigned).
- [ ] Device mapping (assign/unassign) persists server-side and is reactive in the UI.
- [ ] Webhook receiver validates signatures, dedupes on `providerEventId`, persists events, and resolves `listingId`.
- [ ] `onMinutEvent` fires active, in-scope Journeys on real events only when the device is mapped.
- [ ] Disconnect revokes tokens, preserves device mappings + event history.

### Security
- [ ] No tokens or webhook secret are exposed client-side or in logs.
- [ ] Unsigned / incorrectly-signed webhooks are rejected with `401`.
- [ ] Secrets encrypted at rest; all outbound calls HTTPS.

### Reliability
- [ ] Duplicate webhook deliveries are idempotent (no double Journey fire).
- [ ] A malformed event does not break the receiver or drop subsequent events.
- [ ] Backoff/rate-limit handling on HostBuddy pull failures.

### UI / UX
- [ ] Integrations card status pill + Connect/Manage label reflect real state.
- [ ] Config sheet surfaces connect/disconnect/sync/mapping with toast feedback.
- [ ] Journeys `Minut Sensor Event` option gated by connection state.

### Quality
- [ ] `pnpm typecheck` passes (no new type errors).
- [ ] `pnpm lint` passes.
- [ ] `pnpm build` succeeds.
- [ ] Unit tests cover: webhook signature validation, dedupe, listing-resolution, and `onMinutEvent` matching.
- [ ] Dev-server smoke test: connect flow, sync, a webhook event, and a fired Journey all render without Vue warnings.

---

## 13. File Inventory (target)

| File | Change |
|---|---|
| `server/api/integrations/minut/*.ts` | New — OAuth, devices, mapping, events endpoints. |
| `server/api/webhooks/minut.post.ts` | New — webhook receiver (validate, dedupe, persist, dispatch). |
| `server/utils/minut-store.ts` | New — server-side persistence + encryption for connection/devices/events. |
| `server/utils/hostbuddy-client.ts` | New — typed HostBuddy API client (OAuth, devices, events, webhook register). |
| `app/composables/useMinut.ts` | Replace mock internals with calls to the server API; keep public surface. |
| `app/components/settings/MinutIntegration.vue` | Wire to real composable; keep UI structure; swap mock actions. |
| `app/components/settings/SettingsIntegrationsOverview.vue` | Card + status pill already present; ensure it reads real `useMinut()` state. |
| `app/composables/useJourneys.ts` | Keep `onMinutEvent` matcher; feed it real webhook events. |
| `app/components/journeys/data/journeys.ts` | `minut_event` type + `triggerMeta` already present (no change). |
| `app/components/journeys/JourneyStepSidebar.vue` | Gated `Minut Sensor Event` option already present (no change). |
| `tests/**` | Replace mock spec with real client/receiver specs. |

---

## 14. Out-of-scope / Deferred

- Direct Minut API (non-HostBuddy) integration.
- Per-event condition filters in Journeys.
- `MINUT_*` notification alerts.
- Guest-facing quiet-hours presets.
- Device actuation/control.
