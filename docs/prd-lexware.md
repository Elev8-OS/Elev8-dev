# PRD: Lexware Accounting Integration (Canonical)

**Status:** V2 — Real-Flow (mock API, real app data) · **Final**
**Owner:** Finance (Product)
**Module:** Finance → Integrations
**Integration:** Lexware Public API (contact + invoice endpoints, webhooks)
**Last Updated:** 2026-08-02

---

## TL;DR (Developer Quickstart)

**What is this?** A Finance integration card (`/finance?tab=integrations` → Lexware) that pushes finalized EUR-denominated revenue as GoBD-ready **draft invoices** into Lexware for German bookkeeping. The API handshake is mocked, but the data pipeline is **real**: it reads live reservations from `useReservations()` and real listing pricing from the listings store.

**What does it do?**
- Connect with an API key → masked display, health status, webhook subscriptions
- **Real pipeline**: unsynced EUR reservations (on EUR listings) are pushed as Lexware **drafts** (`voucherStatus: draft`); host finalizes inside Lexware
- Line items built from **real listing pricing** (nightlyRate × nights + cleaningFee + serviceFee), reconciled to the booking total
- Independent sync flag `syncedToLexware` — does NOT touch Jurnal/Bexio `synced`
- Enforces Lexware VAT bands (**0% / 7% / 19%** only) — other rates hold the invoice in "Needs mapping"
- Cancellation auto-issues a credit note in Lexware
- Account & tag mapping (SKR03 chart of accounts) with double-entry debit/credit per line item
- Bulk historical sync throttled to **2 req/sec** (Lexware rate limit)
- 5 alert types wired into the notification center; `/finance?tab=integrations` deep-link lands on Integrations tab

**Key files:**
| File | Purpose |
|---|---|
| `app/components/finance/data/lexware.ts` | Chart of accounts (SKR03), VAT rate helpers |
| `app/components/finance/data/lexware-invoices.ts` | Types, `getEurListings()` from real listings, mock history seeds |
| `app/composables/useLexware.ts` | Connection, real-data pipeline (`pushEligibleReservations`), credit notes, bulk sync, stats |
| `app/composables/useReservations.ts` | `markSyncedToLexware` + `unsyncedToLexwareCount` (independent flag) |
| `app/components/finance/ReservationsTab.vue` | Revenue tab: "Push to Lexware" button + dual sync badges |
| `app/components/finance/LexwareIntegration.vue` | Integration card + dialogs (mapping, drafts, exceptions, history) |
| `app/components/finance/IntegrationsTab.vue` | Mount point + connected-status wiring |
| `app/composables/useIntegrationAccounts.ts` | Shared mapping defaults per integration |
| `app/composables/useListingMappings.ts` | `'Germany'` region + pre-seeded lexware mappings |
| `app/composables/useNotifications.ts` | Alert creation (`createLexwareAlert`) |
| `tests/composables/useLexware.spec.ts` | Behavioral tests incl. real-data pipeline |

---

## 1. Problem Statement

Elev8 operates EUR-denominated properties (Germany) alongside IDR/USD ones. Hosts use Lexware for German bookkeeping (GoBD, DATEV/SKR03). Today, revenue records never reach Lexware — Finance re-keys each booking manually. The integration must produce **compliant, draft-first** invoices while surfacing every edge case (tax band mismatch, non-EUR bookings, dropped connections) as actionable exceptions.

## 2. Roles & Access

| Role | Access |
|---|---|
| **Admin / Finance** | Connect/disconnect, edit account & tag mapping, retry failed invoices, bulk historical sync, resolve exceptions |
| **Guest Relations** | View-only: connection status, draft/exception readouts |

## 3. Scope

### In Scope (V2 — mock API, real data flow)
- **Lexware connection lifecycle** — connect / disconnect / reconnect / health check, API-key masking, webhook subscription mock (`contact.changed`, `invoice.changed`), "Needs attention" state.
- **Real-data push pipeline** — EUR reservations (from `useReservations()`) pushed as Lexware drafts; eligibility = `currency === 'EUR'` AND listing has `EUR` tag (`lst-20…lst-24`).
- **Line items from real listing pricing** — accommodation (7%), cleaning fee (19%), platform fee (0%), with reconciliation fallback to the booking total.
- **Independent sync flag** — `syncedToLexware` on `ReservationEntry`; Jurnal/Bexio `synced` untouched.
- **VAT band enforcement** — only 0%/7%/19%; other rates hold the invoice in `needs_mapping` + Finance alert.
- **Auto credit note** on cancellation (idempotent).
- **Account & tag mapping** (SKR03 double-entry, 4 tabs: booking revenue, upsell, costs, city tax) — editable, applies prospectively.
- **Revenue tab integration** — "Push to Lexware" button (banner + selection), per-row Lexware badge, Lexware integration filter.
- **Bulk historical sync** — 50 mock EUR bookings, throttled 2 req/sec, progress bar.
- **5 Lexware alert types** in Notification Center, deep-linking to `/finance?tab=integrations` (query-param handling added).
- **Webhook-status transitions** — `markFinalized()` / `markPaid()` / `issueCreditNoteForCancellation()` as composable/tests-level simulations.
- **Behavioral tests** for connection lifecycle, real-data pipeline, VAT hold, credit notes, retry, bulk throttle, stats.

### Out of Scope (this version)
- **Real Lexware Public API** — all API calls are mocked (handshake, push latency, webhook receive). Requires API credentials + a production webhook receiver.
- **Non-EUR properties** (IDR/USD/CHF) — never synced to Lexware; Mekari Jurnal covers those.
- **Upsell & cost entries pushed to Lexware** — only reservations flow today (see Known Gap #4).
- **City tax line generation** — mapping config exists, but no `CityTax` line is emitted (see Known Gap #3).
- **Guest email enrichment** — drafts push with an empty email; no inbox/booking data join (see Known Gap #2).
- **Checkout-status gating** — all unsynced EUR reservations are eligible regardless of booking status/future check-in (see Known Gap #1).
- **Real payment webhook receiver** — `markPaid` has no production trigger or UI control (see Known Gap #5).
- **Persistence** — invoices, flags, and mappings are in-memory (`useState`); refresh resets to seed (see Known Gap #9).
- **Currency conversion** — EUR-only accounting; no exchange-rate logic (Lexware is EUR-only by design).

## 4. Core Requirements

1. **EUR-only eligibility** — only EUR-denominated listings sync. Non-EUR bookings appear in a "Not eligible for Lexware export" digest (with listing, check-in, currency, reason).
2. **Draft-only creation** — Elev8 never finalizes invoices. It creates drafts (`voucherStatus: draft`); the host finalizes inside Lexware. Payment state is read-only via webhooks.
3. **VAT band enforcement** — only 0%, 7%, 19% accepted. A line item with any other rate holds the invoice in `needs_mapping` and notifies Finance.
4. **Double-entry mapping** — every line item maps to a Debit + Credit account (SKR03). Mapping edits apply prospectively; existing Lexware invoices are never re-categorized.
5. **Auto credit note** — booking cancellation issues a credit note in Lexware referencing the original invoice.
6. **Connection health** — scheduled health check pings Lexware; 401/403 or missing webhook subscription flips to "Needs attention" + Admin alert. Invoices created while unhealthy are queued as `sync_failed`.
7. **Rate-limit throttle** — all pushes honor Lexware's **2 req/sec** token-bucket limit.

## 5. Data Model

### ReservationEntry (extended)
```
… existing fields …
synced: boolean            // Jurnal/Bexio sync (unchanged)
syncedToLexware?: boolean  // Lexware-specific — independent of `synced`
syncedToLexwareAt?: string
```

### LexwareInvoice
```
id, lexwareInvoiceId (LS-…, null until created), reservationId, listingId, listingName,
guestName, guestEmail, currency: 'EUR', totalAmount,
status, lineItems[], createdAt, finalizedAt?, paidAt?, cancelledAt?, creditNoteId?,
failureReason?, needsMappingReason?
```

### LexwareInvoiceLineItem
```
category: Accommodation | CleaningFee | Upsell | PlatformFee | CityTax
description, quantity, unitPrice (EUR), vatRate (0|7|19), postingAccountId
```

### Status Lifecycle
```
draft_created → open_in_lexware → paid          (host finalizes; invoice.changed webhook)
             ↘ credit_note_created               (cancellation)
needs_mapping  (VAT rate ∉ {0,7,19})            → Finance remaps
sync_failed    (connection lost mid-request)    → Retry after reconnect
```

### Connection Health
```
LexwareConnectionHealth { status: connected | needs_attention | disconnected,
                          lastCheckedAt, failedReason?, webhookSubscriptions[] }
```
Webhooks subscribed on connect: `contact.changed`, `invoice.changed`.

## 6. Account & Tag Mapping (SKR03)

Four tabs, each a Debit/Credit selector table:

| Tab | Line Items | Notes |
|---|---|---|
| **Booking Revenue** | Accommodation (7% VAT), Cleaning Fee (19%), Upsell (19%), VAT Output (pinned to 7%/19% liability) | Full double-entry |
| **Upsell** | Upsell Revenue | Pushed as separate Lexware invoice, never appended to booking invoice |
| **Costs** | Operational Costs | Cost types bundled into a single line item |
| **City Tax** | Tax Collected / Tax Remitted | Collection mode: Elev8 vs OTA. Both tax accounts validated as liability (2xxx) |

VAT liability accounts are pinned: `la-3800` (19%), `la-3810` (7%), `la-3820` (0%).

## 7. End-to-End Flow (detailed)

### Step 0 — Connect (one-time)
1. Open **Finance → Integrations** → Lexware card → "Connect Lexware".
2. Enter API key (`lx-…`, generated at `app.lexware.de/addons/public-api`).
3. `connect()` runs a 1.2s mock handshake, then:
   - Masks the API key (shows last 4 chars)
   - Sets company to "Elev8 Suite DACH GmbH"
   - Subscribes webhooks `contact.changed` + `invoice.changed`
   - Sets health = `connected`, `step = 'mapping'`
4. The **Account & Tag Mapping** dialog auto-opens. Finance maps the SKR03 chart of accounts (booking revenue, upsell, costs, city tax — Debit/Credit per line item). Save → `step = 'connected'`.

### Step 1 — A booking lands on an EUR listing
- A new reservation appears in the real app store `useReservations()` (e.g. a guest at Villa Luwa, `lst-20`).

### Step 2 — Eligibility check (automatic, real data)
`useLexware` watches the live reservation list. A reservation is **eligible** only when BOTH:
- `currency === 'EUR'`, AND
- the listing (matched by display name against the listings store) has the `EUR` tag — i.e. one of `lst-20…lst-24`.

Anything else (IDR/CHF/USD, or EUR on a non-EUR listing) is **excluded** and surfaces in the `nonEligibleDigest` (listing, check-in, currency, reason). It is never pushed.

### Step 3 — Push to Lexware (user trigger, Revenue tab)
- The Revenue tab shows an amber banner: **"N EUR reservations ready as Lexware draft invoices"** + **Push to Lexware** button (also available per-selection in the row action bar).
- `pushEligibleReservations()` iterates every eligible + `!syncedToLexware` reservation:
  1. `buildLineItems()` derives line items from **real listing pricing**:
     - Accommodation: `nightlyRate × nights`, VAT 7%, posting `la-8210`
     - Cleaning fee: `cleaningFee`, VAT 19%, posting `la-8300`
     - Platform fee: `serviceFee`, VAT 0%, posting `la-4500` (only if > 0)
     - If the breakdown doesn't reconcile with `res.amount`, fall back to a single Accommodation line of the full amount (invoice total always equals the booking).
  2. `createDraftInvoice()` — throttled at **2 req/sec** (Lexware rate limit):
     - VAT rate outside 0/7/19 → `needs_mapping` + Finance alert (never pushed)
     - Connection unhealthy → `sync_failed` (queued for retry)
     - Success → `draft_created` with Lexware ID `LS-2026-xxxx` + alert `LEXWARE_DRAFT_INVOICE_READY`
  3. `markSyncedToLexware(id, checkIn)` → `syncedToLexware = true`. **`synced` (Jurnal/Bexio) is untouched.**

### Step 4 — Finalize (host-side, webhook-driven)
- Elev8 **never** finalizes. The host opens Lexware and finalizes the draft there.
- Lexware emits `invoice.changed` → Elev8 mirrors via `markFinalized()`: `draft_created → open_in_lexware` (sets `finalizedAt`).
- Payment later → `markPaid()`: `open_in_lexware → paid` (sets `paidAt`).
- **There is no "Simulate finalize" button in the UI** — the transition is driven by the webhook simulation in the composable/tests.

### Step 5 — Cancellation → credit note (automatic)
- "Cancel" on a draft/open/paid invoice → `issueCreditNoteForCancellation()`:
  - Generates a new `creditNoteId` (`LS-2026-xxxx`)
  - Flips status to `credit_note_created`, sets `cancelledAt`
  - Alerts Finance via `LEXWARE_CREDIT_NOTE_CREATED`
  - Idempotent — a second call no-ops.

### Step 6 — Exceptions & health
- **Needs mapping** (VAT ∉ bands) → Exceptions dialog, "Finance to remap".
- **Sync failed** → Retry button (after reconnect). `retryFailedInvoice()` re-pushes and clears `failureReason`.
- **Connection health** — "Run health check" pings; a 401/403/missing webhook flips to `needs_attention` → red banner + Admin alert. New pushes while unhealthy become `sync_failed`.

### Step 7 — Bulk historical sync
- Confirmation dialog → pushes 50 mock historical EUR bookings as drafts, throttled 2 req/sec (~25s), progress bar, one-time backfill.

### Step 8 — Disconnect
- Confirmation dialog → API key removed, webhooks deactivated. Existing Lexware invoices stay intact.

## 8. Notification Alerts

| Alert Type | Trigger |
|---|---|
| `LEXWARE_DRAFT_INVOICE_READY` | Draft created successfully |
| `LEXWARE_CONNECTION_NEEDS_ATTENTION` | Health check failed (401/403/missing webhook) |
| `LEXWARE_TAX_MAPPING_HOLD` | VAT rate outside 0/7/19 |
| `LEXWARE_CREDIT_NOTE_CREATED` | Credit note auto-issued |
| `LEXWARE_NON_EUR_EXCLUDED` | Non-EUR booking skipped |

All route to `/finance?tab=integrations`.

## 9. Known Gaps (not yet implemented — tracked)

These are deliberate, documented gaps for follow-up. They do not block the current mock-real flow.

1. **No status filter on eligibility** — `eligibleUnsyncedReservations` includes bookings that are `Unverified`/`Verified` (not yet checked out) and future check-ins. Real-world rule: only push after checkout. **Risk:** premature drafts.
2. **`guestEmail` is empty** — `ReservationEntry` has no email; drafts push with `''`. Needs a guest-email source (inbox/booking data) before real API go-live.
3. **City Tax config is unused** — the City Tax mapping tab (collection mode, 2xxx accounts) exists but `buildLineItems()` never adds a `CityTax` line. Dead config today.
4. **Upsells & costs not wired** — PRD promises upsells as separate invoices, but `pushEligibleReservations` only processes reservations; `useUpsells`/`useCosts` (EUR) are not connected. No EUR upsell/cost seed exists either.
5. **`markPaid` has no UI trigger** — after removing "Simulate finalize", `draft → open → paid` transitions only run via tests. In a demo, invoices stay `draft_created` forever. Needs a webhook-simulation control or auto-progression.
6. **`flagNeedsAttention` never fires from UI** — the red "Needs attention" banner/Admin alert can only appear via tests; `runHealthCheck()` always returns `connected`. The manual health-check button can't actually fail.
7. **Digest misses EUR-on-non-EUR-listing** — `nonEligibleDigest` filters `currency !== 'EUR'`; a EUR reservation on a non-EUR listing is silently skipped (not in digest, not pushed).
8. **`totalSyncedEur` counts `open_in_lexware`** — open invoices are counted as "synced revenue" even though unpaid. Confirm the intended metric.
9. **No persistence** — invoices, `syncedToLexware`, and mappings are in-memory `useState`; a page refresh resets to seed. Consistent with Jurnal/Bexio, but not demo-proof.
10. **Line-item reconciliation fallback** — when the pricing breakdown ≠ `res.amount`, the whole invoice collapses to one Accommodation line (drops cleaning/platform fees). Confirm with Finance whether `res.amount` or the breakdown is the source of truth.

## 10. Acceptance Criteria

- [ ] Connecting masks the API key, sets company, subscribes both webhooks, lands on mapping step
- [ ] Revenue tab shows "Push to Lexware" when connected + `lexwareDraftReadyCount > 0`; pushing creates drafts with real `listingId` (`lst-20…24`) and real totals from listing pricing
- [ ] `pushEligibleReservations` flips `syncedToLexware` only — Jurnal's `synced` is untouched
- [ ] EUR rows show Lexware badge (synced/pending) in the Synced column; Integration filter has Lexware option
- [ ] Line item with VAT 16% → invoice `needs_mapping` + Finance alert; 0/7/19 pass
- [ ] Connection flagged needs-attention → new pushes become `sync_failed`, Retry re-pushes after reconnect
- [ ] Cancellation → credit note created, idempotent (second call no-ops)
- [ ] Bulk sync pushes all drafts at ≤2 req/sec, progress reaches 100%, no concurrent runs
- [ ] Non-EUR listings never sync; they appear in the digest with a reason
- [ ] Mapping changes apply prospectively only
- [ ] `/finance?tab=integrations` lands on the Integrations tab (alert deep-links work)
- [ ] All 5 alert types appear in Notification Center and route to the integrations tab

## 11. Definition of Done

- [ ] Unit tests cover: connection lifecycle, real-data pipeline (`eligibleUnsyncedReservations`, `pushEligibleReservations`, `buildLineItems` reconciliation), VAT hold, sync-failed, credit note (idempotent), retry, bulk throttle, stats (`totalSyncedEur`), formatting
- [ ] All tests green (`pnpm test`); `pnpm typecheck` and `pnpm lint` pass
- [ ] Integration card reflects `useLexware` connected state in the Integrations grid
- [ ] No hardcoded colors outside ElevAI gold / brand yellow (`#F6BB12` only for Lexware brand)

## 12. Dependencies & Open Questions

- **Real API** — API handshake and push are mocked; requires Lexware Public API credentials and webhook receiver (production server job for health checks).
- **VAT edge cases** — platform fees assumed 0% VAT; confirm per-OTA (Airbnb/Booking.com) booking fee treatment with Finance.
- **Non-EUR future** — IDR/USD properties out of scope for Lexware; separate accounting integration (Mekari Jurnal) covers those.
- **Guest email** — see Known Gap #2; resolve before real API go-live.
- **Line-item reconciliation** — see Known Gap #10; confirm the source of truth with Finance.
