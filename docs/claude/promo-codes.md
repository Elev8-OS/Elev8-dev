> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Promo Codes Module (`app/components/promo-code/`, `app/composables/usePromoCodes.ts`, `app/pages/promo-codes/`)

Standalone global library of promo codes, referenced by ID from booking widgets (and designed to be referenced by the website builder later). Replaces the previous inline-per-widget `BookingWidgetPromoCode[]` shape so the same code can be reused across multiple surfaces.

- **Data + Types** (`app/components/promo-code/data/promo-codes.ts`)
  - `PromoCode` — id, code (uppercased), description, `discountType: '%' | 'fixed'`, value, currency (`null` for %), active, `validFrom?`/`validUntil?`, `usageLimit?`, `redemptionCount`, `createdAt`, `updatedAt`
  - `WidgetPromoCodeLink` — `{ promoCodeId, source: 'widget' | 'website', sourceId, usageCount, addedAt }` — join table for **per-usage-site analytics** (scaffolded now; event ingestion is deferred)
  - `PromoCodeStatus` — `'active' | 'inactive' | 'expired'` (computed from `active` + `validFrom`/`validUntil`)
  - `promoCodes` — `ref<PromoCode[]>` reactive store (seed: `promo-welcome10` "WELCOME10" 10% with 3 redemptions)
  - `widgetPromoCodeLinks` — `ref<WidgetPromoCodeLink[]>` (seeded with the WELCOME10 → `bk-widget-1` link)
  - Helpers: `getPromoCodeStatus`, `isPromoCodeExpired`, `isPromoCodeStarted`, `formatPromoDiscount`, `generatePromoId`

- **Composable** (`app/composables/usePromoCodes.ts`)
  - `useState<PromoCode[]>('promo-codes', ...)` + `useState<WidgetPromoCodeLink[]>('widget-promo-code-links', ...)` (survives across components)
  - **Filters**: `search`, `status` (`'all' | 'active' | 'inactive' | 'expired'`), `sortBy` (`'recent' | 'code' | 'redemptions'`)
  - **KPIs (computed)**: `activeCount`, `expiredCount`, `inactiveCount`, `totalRedemptions`
  - **CRUD**: `createPromoCode`, `updatePromoCode`, `deletePromoCode`, `duplicatePromoCode`, `toggleActive`, `isCodeTaken`
  - **Join helpers**: `setLinksForWidget(widgetId, codeIds)`, `getUsagesByCode(codeId)`, `getLinksForWidget(widgetId)` — `setLinksForWidget` is called from widget `saveWidget()` and is the only thing that keeps the analytics scaffold up to date
  - `clearFilters()`

- **Page** (`app/pages/promo-codes/index.vue`) — list page with header, KPI cards (active/expired/total redemptions), filter bar (search + status + sort), `<PromoCodeTable>`, create/edit/detail dialogs, empty state

- **Form module** (`app/components/promo-code/data/promo-code-form.ts`) — framework-free single home for the create/edit form rules (the dialogs own the reactive state and call in):
  - `PromoCodeFormDraft` — flatter than `PromoCode`: every field concrete and non-nullable, and `channel` / `websiteIds` hoisted out of `channelRestriction` because separate controls edit them
  - `PROMO_CODE_STEPS` — the four wizard steps (`basics | discount | scope | rules`) with title, description, icon
  - `createDefaultPromoCodeFormDraft()`, `promoCodeToFormDraft(code)`, `formDraftToPromoCodePayload(draft)`
  - `validatePromoCodeStep(draft, stepId, ctx)` / `validatePromoCodeForm(draft, ctx)` / `firstInvalidPromoCodeStep(draft, ctx)` — `ctx.isCodeTaken` is injected by the caller so the validator stays store-free (edit passes `isCodeTaken(code, ownId)` so a code can keep its own value). Errors are keyed by field; window errors are keyed positionally (`bookingWindows.0`) since a host can add any number
  - `formatDraftDiscount(draft)` — discount line for the review block
  - `listingIdsForWebsiteSelection(coverage, selectedIds)` — listing ids reachable through the picked websites (**union**: a code on two sites applies to anything either covers). Returns `null` for "no constraint" — nothing picked, or a picked site has **no coverage recorded**, since an un-migrated site may cover anything and guessing "nothing" would wrongly empty the listing list
  - `upsellServiceCoverage(assignedListings, scopedListingNames)` → `{ covered, total }`, and `unreachableUpsellItemIds(services, itemIds, scopedListingNames)` — how far a service reaches into the code's listing scope, and which picked items reach none of it. Services and listing names are **injected** (`PromoCodeValidationContext`) so the module stays free of the listing and upsell stores; omit either and the coverage check is skipped rather than guessed
  - Validation the flat form never had: end-before-start on any window, percentage capped at 100, usage limit ≥ 1
  - ⚠️ **`toDateInputValue` fixes a real bug**: seeded codes store full ISO timestamps (`2026-02-10T00:00:00Z`), which `<input type="date">` silently renders **blank**. The draft converter trims to `YYYY-MM-DD`, so editing a code with windows (e.g. FREESPA) now shows its dates

- **Components** (in `app/components/promo-code/`)
  - `PromoCodeTable.vue` — pure presentational table; props `{ codes }`; emits `view / edit / delete / duplicate / toggleActive`; columns: code (mono), discount, type, valid period, redemptions, status badge, active switch, dropdown actions
  - `PromoCodeCreateDialog.vue` — **create wizard** (4 steps: Code → Where it works → Discount → Limits). Step progress bar, one field group per step, per-step gating via `validatePromoCodeStep`, and a read-back of the whole draft (`PromoCodeDraftSummary`) on the last step next to the limits fields. Nothing reaches the store until **Create code**; that final submit re-validates every step (a host can walk back and break an earlier one) and jumps to the first failing step via `firstInvalidPromoCodeStep`. Same pattern as `DatevSetupWizard.vue`
  - `PromoCodeEditDialog.vue` — edit modal; **deliberately a flat form**, not the wizard: the host usually came to change one field, so stepping through four screens would be slower. Renders the same four field groups stacked with `<Separator>` between them, validated in one pass with `validatePromoCodeForm`
  - **Shared field groups** — `PromoCodeFieldsBasics.vue` (code, description), `PromoCodeFieldsDiscount.vue` (type cards + value/currency or the free-upsell item picker), `PromoCodeFieldsScope.vue` (channel radio + website list + listing scope), `PromoCodeFieldsRules.vue` (booking/stay windows, usage limit, active). Each takes `v-model` (a whole `PromoCodeFormDraft`, patched by spread so no prop is mutated), `:errors`, and `:id-prefix` (keeps DOM ids unique when create and edit are both mounted). The wizard renders one per step, the edit form stacks all four, so labels and validation copy cannot drift between the two surfaces
  - ⚠️ **Every picker is inline — no Popover.** The wizard split the form up precisely to make room. The earlier version put the upsell list, the listing list, and the website list each behind a Popover *inside the modal*, with a second Popover nested inside the listing one for tags — three stacked overlays. Do not reintroduce them; render lists in the step

- **Booking widget integration**
  - `BookingWidgetConfig.promoCodes: BookingWidgetPromoCode[]` → `promoCodeIds: string[]` (reference by ID)
  - `BookingWidgetPromoCode` interface **removed** from `app/components/booking-widget/data/widgets.ts`
  - `resolveWidgetPromoCodes(widget)` — returns `PromoCode[]` resolved from the shared store (sorted by `promoCodeIds` order)
  - `buildEmbedPreview` (in `useBookingWidgets()`) calls `resolveWidgetPromoCodes` so the embed payload still has `promoCodes: PromoCode[]` (runtime contract preserved)
  - `BookingWidgetEmbedPreview` — explicit type for the embed preview shape (was implicit); covers both the resolved codes and the `name`/`mode`/`listingIds`/`primaryListingId` fields the preview reads
  - **v1 widget** (`app/pages/booking-widgets/v1/new.vue`): the old 6-field inline editor is replaced with `<PromoCodePicker>` in a new "Promo codes" card. `saveWidget()` writes `promoCodeIds` and calls `setLinksForWidget(id, form.promoCodeIds)`.
  - **v2 widget** (`app/pages/booking-widgets/new.vue`): new "Promo codes" card with `<PromoCodePicker>`. Same save wiring.
  - **`BookingWidgetPreview.vue`**: promo codes row now shows count + up to 3 truncated code chips + `+N` overflow (was count only). Preview prop type changed to `BookingWidgetEmbedPreview`.

- **Sidebar entry**: Apps section, above "Booking Widgets" — `{ title: 'Promo Codes', icon: 'i-lucide-ticket-percent', link: '/promo-codes', new: true }`

- **Migration**: `bk-widget-1.promoCodes: [{ code: 'WELCOME10', ... }]` → `bk-widget-1.promoCodeIds: ['promo-welcome10']` + matching entry in `promoCodes` seed (with `redemptionCount: 3` preserved) + matching `WidgetPromoCodeLink`. The "Used in" section shows the link from day one.

- **The wizard asks one chain, in one direction: channel → websites → listings → upsells.**
  Each answer constrains the next, so no list ever has to filter a choice already made, and no
  two lists filter each other in a circle. This is why `PROMO_CODE_STEPS` runs
  `basics → scope → discount → rules` and why, inside the scope step, the channel comes before
  the websites and the websites before the listings. **Reordering these breaks the model, not
  just the layout.**
  - A website only covers the listings it markets — `Website.propertyIds?: string[]`
    (`app/components/website-builder/data/websites.ts`) records which Website Builder properties
    a site markets, the same ids `PropertyStep` collects but which were previously **never
    persisted on save**; `getListingIdsForWebsite` (`data/property-listings.ts`) resolves them
    through `propertyListingMap`. The field is optional, so a site with nothing recorded means
    "coverage unknown" (treat as covering everything), never "covers nothing". Pinning a code to
    specific sites therefore pins which properties it can apply to — `listingIdsForWebsiteSelection`
  - An upsell service is only offered at the properties it is assigned to, so the listings decide
    which upsells the code can give away — `upsellServiceCoverage` / `unreachableUpsellItemIds`

- **Picker UX rules** (the parts that carry the most confusion)
  - **Free upsell items** (`PromoCodeFieldsDiscount`) — groups render **expanded by default** (and
    always while searching); the host should not have to click a service open to learn what is in
    it. Each item shows its **price** and each service header its **price range**, because the host
    is giving that value away. Service checkbox is tri-state (`aria-checked="mixed"` when partial)
  - **Coverage is stated, never implied** — a service offered at only part of the listing scope is
    still pickable but carries "Offered at N of M listings" on its row, and a picked one raises a
    warning naming it. A service offered at **none** of them is hidden, with a line naming what was
    hidden and why. `validatePromoCodeStep` **blocks** the unreachable case: a code promising a free
    spa at a villa with no spa is a promise it cannot keep
  - **Listing scope** (`PromoCodeFieldsScope`) — an empty `listingIds` means "all listings", but
    showing that as a trigger labelled "All listings" reads the same whether the host chose every
    property or never touched the control. Scope is an explicit **All listings / Pick specific
    listings** radio; `scopeMode` is *derived* (`listingIds.length > 0 || specificChosen`) so the
    **persisted shape is unchanged** — only what the host sees. `specificChosen` remembers the
    intent while the selection is still empty
  - **Bulk actions** read against what is *visible*: "Select all (N)" becomes "Select these (N)"
    under a filter, so search + tags double as a bulk picker across 24 listings and 42 tags
  - **Both lists search**; the website list also matches the **template**, since a host may
    remember the look rather than the name
  - **Stranded selections** — narrowing the websites after picking listings can strand a listing
    outside the new scope. Stranded items are surfaced in an amber panel naming them with a
    "Remove them" action, never silently dropped
  - ⚠️ **No selected-item chips.** Each row carries a checkbox that already shows its state, so a
    chip row underneath only repeats it — and at 24 listings it becomes a wall of badges that
    pushes the list off screen. Feedback is the checked row plus a running count ("3 selected",
    "2 chosen", "Showing N of M"). Do not reintroduce the chips; `PromoCodePickers.spec.ts` guards
    against it
  - ⚠️ **Copy: a website "covers" listings, it never "sells" them**; an upsell service is "offered
    at" a property. Keep that vocabulary — the UI is for property managers, not retailers

- **Tests** — `tests/lib/promo-code-form.spec.ts` (30, the pure module: per-step validation, `firstInvalidPromoCodeStep`, draft round-trip, ISO→date trimming, channel re-nesting), `tests/components/promo-code/PromoCodeCreateDialog.spec.ts` (14, the wizard: step gating, no store write before the last step, review read-back, Back preserves input, focus lands on the failing field, reset on reopen), `tests/components/promo-code/PromoCodeEditDialog.spec.ts` (7, flat form: hydration, ISO date rendering, self-uniqueness, store write-back), `tests/components/promo-code/PromoCodePickers.spec.ts` (42, the two pickers: inline rendering, item prices, the cross-step count and the impossible-combination warning, explicit all-vs-specific scope, visible-scoped bulk select, inline tag filter, listings narrowed to the website selection, upsell coverage and the unreachable-service block, website search by name/url/template, and no-chips guards). Picker specs mount a field group behind a host that owns the draft — the groups patch by spread and emit, so without a real parent the writes never come back.
  ⚠️ The shadcn primitives (`Input`, `RadioGroup`, `Button`, …) **must** be registered in `global.components`. An unresolved `Input` falls back to a bare `<input model-value="...">` — the attribute never becomes the DOM value, so every value assertion passes vacuously.

- **Deferred (intentionally out of scope)**
  - **Website builder integration** — `source: 'website'` is reserved in `WidgetPromoCodeLink`; builder gets its own picker call site later
  - **Per-usage event ingestion** — `WidgetPromoCodeLink.usageCount` is scaffolded; no events wired up yet
  - **Per-listing scope** — codes are global; linking is at widget/site level
  - **Auto-expiration** — `validFrom` / `validUntil` stored, no background job. "Expired" filter computes at read time
  - **`/promo-codes/[id]` sub-page** — detail dialog covers current needs; per-code usage history page is a future addition
