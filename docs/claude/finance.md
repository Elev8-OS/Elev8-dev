> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Finance Module (`app/components/finance/`)

#### Overview
- **OverviewTab.vue** — Header KPI cards (Net Revenue, Total Costs, Upsell Revenue, Unsynced count) + Pending Actions + Recent Activity tables
- **RevenueTab.vue** — Wrapper with sub-tabs: Reservations + Upsell
- **CostsTab.vue** — Cost tracking with filters and detail drawer
- **IntegrationsTab.vue** — Jurnal + Bexio integration cards
- Page: `app/pages/finance/index.vue`

#### Accounting Integration System
Two integrations supported: **Mekari Jurnal** (IDR, Indonesia) and **Bexio** (CHF, Switzerland).

**Composables:**
- `useListingMappings` (`app/composables/useListingMappings.ts`) — shared `useState<Record<string, ListingMapping>>` keyed by listing name. `ListingMapping = { integration, tag }` (tag replaces old accountId). `initialMappings` pre-seeds all known listings: Bali + first 12 Swiss → Jurnal, last 16 Swiss → Bexio. Key exports: `getMappingFor(name)`, `setMapping(name, integration, tag)`, `hasAnyMapping`, `mappedByIntegration`
- `useIntegrationAccounts` (`app/composables/useIntegrationAccounts.ts`) — per-integration default accounts for double-entry bookkeeping. `DefaultAccounts` has 4 sections: `bookingRevenue` (accommodation/platformFee/fee/tax, each with debit/credit), `upsellRevenue` (debit/credit), `costs` (debit/credit), `cityTax` (collectionMode + taxCollected/taxRemitted). Key exports: `getDefaults(integration)`, `setBookingRevenueLine()`, `setUpsellRevenueLine()`, `setCostsLine()`, `setCityTax()`, `mappingTabs`, `isValidAccountType()`, `getAccountTypeLabel()`
- `useJurnal` (`app/composables/useJurnal.ts`) — Jurnal connection state, exchange rate (CHF → IDR), `convertToAccounting(chf)`, `formatAccounting(idr)`
- `useBexio` (`app/composables/useBexio.ts`) — Bexio connection state (starts disconnected), CHF accounting, `connect(key)`, `disconnect()`, `localSelections` for tag mapping
- `useActiveIntegration` (`app/composables/useActiveIntegration.ts`) — derives column visibility and per-listing accounting amounts:
  - `showConvertedColumn` — true if any integration is connected with mapped listings
  - `getAccountingAmount(listingName, chfAmount)` — for reservations/upsells (CHF input)
  - `getCostAccountingAmount(listingName, amount, currency)` — for costs (IDR or CHF input)

**Connection flow (both integrations):**
1. Not connected → "Connect" button → API key input → Save & Connect
2. On success → toast + mapping popup opens automatically
3. Connected state → "Account & Tag Mapping" button + "Disconnect" button
4. Disconnect → confirmation dialog

**Account & Tag Mapping popup (4 tabs):**
1. **Booking Revenue** — double-entry table: Accommodation (debit/credit), Platform Fee (debit/credit), Fee (debit/credit), Tax (debit/credit). Each row has 2 Select dropdowns showing all accounts.
2. **Upsell Revenue** — double-entry table: 1 row (debit/credit)
3. **Costs** — double-entry table: 1 row (debit/credit). Cost types handled via Cost Tags.
4. **City Tax** — collection mode (Elev8/OTA) + taxCollected/taxRemitted accounts with validation (must be 2-xxx liability)

**Tag sections (below tabs in popup):**
- **Property Tags** — per-listing tag assignment via autocomplete badge-in-field. Search + city tag filter. Popover with listing table.
- **OTA Channel Tags** — per-channel tag (Airbnb, Booking.com, Direct, Expedia, Agoda, VRBO, Google Travel)
- **Upsell Tags** — per-category tag (12 categories: Airport Transport, Private Chef, Spa, etc.)
- **Cost Tags** — per-cost-type tag (Activity, Cleaning Cost, Manual Cost, Task)

**Tag field UX:** Badge inside input field, autocomplete suggestions on focus, "Create" option for new tags, single tag per item.

**Account data:**
- Jurnal: 14 accounts across 4 categories (asset 1-xxx, liability 2-xxx, revenue 4-xxx, expense 5-xxx/6-xxx)
- Bexio: 12 accounts across 4 categories (asset 1xxx, liability 2xxx, revenue 3xxx, expense 4xxx/5xxx/6xxx)

**Validation:** Account type constraints enforced — deposit/tax must be 2-xxx, revenue must be 4-xxx (Jurnal) or 3xxx (Bexio). Validation uses account code (not ID). Errors shown inline with red border.

**Logos:** `FinanceJurnalLogo.vue` and `FinanceBexioLogo.vue` — used in connection cards and integrations tab.

**1 listing = 1 integration rule**: enforced at UI level — rows mapped to the other integration show a lock badge and disabled select in both `JurnalIntegration.vue` and `BexioIntegration.vue`.

**Currency display**: Always format currencies using 3-letter ISO code in front with a space (e.g. `USD 150.00`, `EUR 231.00`, `IDR 500,000`, `CHF 1,200.00`), never symbols like `$`, `€`, `£`, `Rp`, and never suffix after the amount. Format: `${currency} ${amount}`. Input prefixes must use currency codes with sufficient padding (`pl-14`). CHF uses `de-CH` locale with 2 decimal places. Header amounts always in CHF (tenant currency).

**Integration filter**: all three tabs (Reservations, Upsell, Costs) have a `filterIntegration` select — `'all' | 'jurnal' | 'bexio' | 'none'`.

**Acctg. Amount column**: shown in Reservations, Upsell, and Costs tables when `showConvertedColumn` is true. Displays `—` for unsynced rows.

**Synced badge**: table rows in Reservations, Upsell, and Costs tabs all show cloud-check icon + Jurnal (blue) or Bexio (violet) badge when synced. Not-synced rows show cloud-off icon.

#### DATEV Export (`Finance → Exports` tab)

German tax advisors work in DATEV. Tenants generate an **EXTF "Buchungsstapel"** (posting batch,
format 700 / record version 13), review it, then download it or open a prefilled e-mail draft.

> ⚠️ **DATEV is not a connection.** There is no API, no auth, and no per-row sync state — it is a
> file handoff. It must never feed the "Unsynced Entries" KPI or reuse Connect/Connected wording.
> Its tile status is `configured` / `available` (labelled "Not set up"), not `connected`.

**Two surfaces:**
- **Settings** → `DatevExportSettings.vue`, opened from the DATEV tile in the Integrations tab
  (deep-link `/finance?tab=integrations&integration=datev`)
- **Action** → `DatevExportTab.vue` on the new `Exports` tab (`/finance?tab=exports`)

**A tenant starts NOT set up.** `useDatev` seeds `createDefaultDatevSettings()` (blank
Beraternummer/Mandantennummer, pre-seeded account suggestions) and an **empty** export history —
there is no `mockDatevSettings`/`mockDatevExports` seed any more. `exampleDatevSettings` remains
exported as a configured fixture for tests. Everything downstream is gated on `isConfigured`:
the Exports tab shows the setup card, `generate()`/`generateFromSelection()` return `null`, the
Reservations "Export N to DATEV" button is hidden, and the tile reads "Not set up".

**First-run flow** — `Exports → Set up DATEV` (or the tile's `Set up`) opens the sheet on
`DatevSetupWizard.vue`, a 3-step guided setup: **Advisor & client → Kontenrahmen & accounts →
Handover** (the last step carries a review block). Each step gates on its own fields via
`validateDatevSetupStep(settings, stepId)` — validating the whole object per step would light up
fields the tenant has not reached. Finish saves once, then a success panel offers
**Go to Exports** (sets `finance-active-tab` + closes the sheet through the shared
`finance-integration-sheet-open` state) or **Review settings** (emits `done` → the flat form).
`DatevExportSettings` picks its mode in `onMounted` after the synchronous `hydrate()`, held as
LOCAL state — deriving it from `isConfigured` would swap the wizard's success panel away the
instant it saved.

**Shared field groups** — `DatevFieldsAdvisor.vue`, `DatevFieldsAccounts.vue`,
`DatevFieldsHandover.vue` each take `v-model` (a whole `DatevSettings` draft, patched by spread so
no prop is mutated) plus `:errors`. The wizard renders one per step, the flat form stacks all three,
so labels and validation copy cannot drift between the two surfaces.

**Format writer** (`app/lib/datev-extf.ts`) — framework-free and the part that must not regress:
- `;` separator, CRLF endings, CP1252 encoding (`encodeCp1252`), exactly 125 fields per record
- Text fields are always quoted (empty → `""`); numeric/date fields are never quoted (empty → bare).
  Quoting an empty numeric field raises one DATEV-checker message per field.
- Amounts use a decimal comma and are always positive — the sign lives in the S/H flag
- Belegdatum is `TTMM`; Leistungsdatum is `DDMMYYYY`; header dates are `YYYYMMDD`
- **BU-Schlüssel is left empty and Festschreibung is 0 on purpose** — the advisor assigns VAT keys
  on import. Do not "fix" this.
- Cancellations post as **Generalumkehr** (field 118 = 1), not as a second revenue line

**Scope** — reuses Lexware's EUR gate (`getEurListings()`, listings tagged `EUR`) so both
German-market surfaces agree on which properties count. Bookings are dated by **check-out**
(service completion). Excluded bookings surface as a grouped digest, mirroring `nonEligibleDigest`.

**Per-tenant settings** (`app/components/finance/data/datev.ts`) — all supplied by the advisor:
Beraternummer (≤7 digits), Mandantennummer (≤5), SKR03/SKR04, fiscal-year start, Debitorenkonto,
default Erlöskonto, per-channel revenue accounts (Airbnb / Booking.com / Direct / Ctrip),
include-cancelled toggle, advisor e-mail. Switching SKR re-seeds every account (`applySkrDefaults`)
— SKR03 revenue is 8xxx, SKR04 is 4xxx.

**Two entry points, one builder** — `generate()` exports the selected period; `generateFromSelection(rows)`
exports a hand-picked set from the **Revenue → Reservations** row selection ("Export N to DATEV" in
the selection bar, reviewed in a Dialog that reuses `DatevPreview`). Both funnel through
`buildRecord()`, so a manual export is byte-identical to a period one over the same rows — there is
a test asserting exactly that. A manual selection derives its period from its own check-out dates
and still passes the EUR gate, so hand-picking cannot smuggle a CHF booking into a German batch;
the button counts only eligible rows and the dialog lists what was dropped.

**Duplicate guard** — `existingExportForPeriod` warns before re-exporting a period already handed
over; generated files are retained in history so a period can be re-downloaded rather than rebuilt.

**Delivery** — `downloadExport` writes CP1252 **bytes** (never a UTF-8 string). `mailto:` cannot
carry an attachment, so `emailExport` downloads first, then opens the draft.

**Tests** — `tests/lib/datev-extf.spec.ts` (28, format rules), `tests/composables/useDatev.spec.ts`
(36, scope/postings/generate/selection/history/first-run), plus render tests under
`tests/components/finance/` for the Exports tab, the setup wizard
(`DatevSetupWizard.spec.ts`), the settings sheet deep-link, and the Reservations selection
button. Anything that produces a file must call setup first — the specs share a `configure()`
helper built from `exampleDatevSettings`. Nuxt auto-imported children must be registered in `global.components` to render in
Vitest, and `resolveComponent` is shimmed in `tests/setup.ts`.

> ⚠️ `import.meta.client` is **not** replaced under Vitest despite the `define` in
> `vitest.config.ts` — it evaluates to `undefined`, so any code behind it is unreachable in tests.
> `useDatev` guards persistence on storage availability (`typeof localStorage`) instead, which is
> both SSR-correct and testable.

#### Reservations Tab (`ReservationsTab.vue`)
- Data: `app/components/finance/data/revenue.ts` — `ReservationEntry` interface + `recentReservations[]`
- `ReservationStatus` = `'Unverified' | 'Verified' | 'Checked-in' | 'Checked-out'`
- `invoice: string` — required field (all confirmed reservations have an invoice)
- Composable: `app/composables/useReservations.ts`
  - `pushReservations()` — push all unsynced
  - `pushSelected(keys)` — push specific rows only
  - `isPushingSelected` ref — separate loading state for partial push
- **Selection bar** (inline, appears on row select): `X rows selected | Clear | [Download X invoices] | [Export CSV] | [Push X to {integration}]`
  - Push button label is smart: detects which integrations are mapped for selected rows (Jurnal / Bexio / accounting)
- **Checkbox fix**: Reka UI `CheckboxRoot` maintains internal state — use `clearKey` ref that increments on `clearSelection()` and bind as `:key` on each `<Checkbox>` to force re-mount on clear

#### Upsell Tab (`UpsellTab.vue`)
- Data: `app/components/finance/data/upsells.ts` — `UpsellEntry` interface + `mockUpsells[]`
- No `status` field — all upsells are always Paid
- `invoice: string` — required field (always present)
- `UpsellType` = `'Vehicle Rental' | 'Airport Transport' | 'Private Chef' | 'Spa' | 'Activity' | 'Late Check-out' | 'Early Check-in' | 'Mid-stay Cleaning' | 'Office Equipment' | 'Baby' | 'Miscellaneous' | 'Pet'`
- Composable: `app/composables/useUpsells.ts`
- Same checkbox `clearKey` pattern as ReservationsTab
- **Selection bar**: `X rows selected | Clear | [Download X invoices] | [Export CSV]`
- **Detail drawer**: `UpsellDetailDrawer.vue` — opens on row click or "View detail" dropdown. Shows guest avatar + type badge, date/amount/acctg. amount, channel + icon, reservation ID, sync status with integration badge, note, invoice download.

#### Costs Tab (`CostsTab.vue`)
- Data: `app/components/finance/data/costs.ts` — `CostEntry` interface + `mockCosts[]`
- `CostType` = `'Manual' | 'Cleaning' | 'Activity' | 'Task'`
- `CostCategory` = `'Cleaning Labor' | 'Cleaning Supplies' | 'Maintenance' | 'Consumables' | 'Other'`
- **Currency**: IDR for Bali staff, CHF for Swiss staff — `currency` field on each entry
- **Invoice rules**: Manual entries always have an invoice. Task and Activity entries may optionally have an invoice.
- **Split entry pattern** (labor vs. materials): Task/Activity entries track labor only (duration × rate). If materials were purchased, a separate Manual entry is created with `linkedTaskId` pointing to the Task/Activity id. This keeps labor and material accounting clean for different GL accounts.
  - `linkedTaskId?: string` on Manual entries → links to the Task/Activity parent
  - `CostDetailDrawer.vue` shows "Material Entry" card when viewing a Task/Activity that has a linked Manual entry, and "Linked Task" card when viewing a linked Manual entry
- Composable: `app/composables/useCosts.ts`
  - `costs`, `filteredCosts`, `filterListing`, `filterType`, `filterSynced`, `filterStaff`, `filterIntegration`, `filterDateFrom`, `filterDateTo`
  - `totalThisMonth`, `unsyncedCount`, `markSynced()`, `clearFilters()`, `hasActiveFilters`
- Staff: Bali housekeeping/maintenance + Swiss staff (Petra Keller, Hans Müller, Markus Weber, Anna Brunner)
- Cleaning labor rate: IDR 625/minute

#### Checkbox Controlled State Pattern
Reka UI `CheckboxRoot` ignores external `:checked` prop changes after initial render when used without `v-model`. Fix:
```ts
const clearKey = ref(0)
function clearSelection() {
  selected.value = []
  clearKey.value++
}
```
```vue
<Checkbox :key="`${rowId}-${clearKey}`" :checked="..." @click.stop="toggleRow(id)" />
```
