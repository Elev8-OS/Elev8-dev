> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Listing Module (`app/components/listings/`)

#### Data + Types (`app/components/listings/data/listings.ts`)
- `Listing` type with `photos: string[]`, `unitType: 'single' | 'multi'`, `aiSchedule: AiSchedule`, plus `stats`, `pricing`, `bookings`, `blockedDates`, `reviews`, `maintenance`
- **AI schedule (HostBuddy concept)**:
  - `AiSchedule` = `{ always: boolean (24/7), days: DayHours[] (7, Mon→Sun), dateOverrides: DateOverride[] }`
  - `DayHours` = `{ enabled, slots: TimeSlot[], activeFor: OverrideAudience[] }` — multiple time ranges per day
  - `TimeSlot` = `{ id, start, end }` (24h "HH:MM")
  - `DateOverride` = `{ id, startDate, startTime, endDate, endTime, activeFor }` — date RANGES that override the weekly schedule
  - `OverrideAudience` = `'future' | 'current' | 'inquiry'`
  - `alwaysOn()` factory builds a 24/7 default schedule
- `ListingStats`, `ListingPricing` (nightlyRate/fees/discounts/seasonalRates), `Booking`, `Review`, `MaintenanceTask`, `ListingMaintenance`
- `Unit` — `{ id, name, identifier?, status?, otaConnected? }` (no longer carries `aiStatus` — moved to `UnitType`)
- `UnitType` — `{ id, name, identifier?, description?, quantity, maxAdults/Children/Infants, bedrooms, bathrooms, beds[], photos[], pricing: UnitTypePricing, aiStatus?: 'active' | 'paused' | 'not_set', units: Unit[] }` — AI status lives at the room-type level so toggling it applies to every physical room of that type
- `UnitTypePricing` — `{ currency, ratePlans: RatePlan[], offerings: RatePlanOffering[], lengthOfStayDiscounts: LengthOfStayDiscount[], fees: Fee[] }` — supports **multiple rate plans per room type** (e.g., Standard, Weekly, Monthly)
- `RatePlan` — Channex-style: `{ id, name, title, sellMode: 'per_room'|'per_person', rateMode: 'manual'|'derived'|'auto'|'cascade', currency, childrenFee, infantFee, maxStay[], minStayArrival[], minStayThrough[], closedToArrival[], closedToDeparture[], stopSell[], options: RatePlanOption[], parentRatePlanId, inherit*, autoRateSettings, mealType, taxSetId?, isBase }` — exactly one plan per `UnitType` has `isBase: true` and cannot be deleted. Use `createRatePlan()` for defaults, `ratePlanNightlyRate(rp)` / `ratePlanMaxOccupancy(rp)` to read the primary option (no more `pricePerNight`/`pricePerAdditionalGuest`)
- `RatePlanOffering` — derived from base (fixed/percent adjustment); not the same as a RatePlan
- `ListingDocument`, `ListingResources` (documents, basics, listingDetails, sops, topicsToAvoid, propertyUpsells, fieldConfig)
- `FieldConfig` = `{ stages: ReservationStage[] }` — per-field config stored in `listing.resources.fieldConfig[fieldKey]`
- `ReservationStage` = `'future' | 'inquiry_past' | 'current'`
- Reactive: `listings` uses `ref<Listing[]>` — mutations use `listings.value[index] = updated`
- Helper exports: `allTags`, `allLocations`, `allProperties`, `allOtas` (computed)
- Mock data: 16 listings with Unsplash photos (lst-1 has rich mock data + custom schedule; rest use `alwaysOn()` + defaults)

#### Page (`app/pages/listings/[id].vue`)
- 6-tab layout: Overview | Pricing | Calendar | Reviews | Maintenance | Settings
- Imports child components explicitly (not auto-imported)
- `ListingHeroCompact` emits `update`; tabs emit `update`/`switchTab` (Overview links to Calendar/Reviews tabs)

#### Child Components
- **`ListingHeroCompact.vue`** — Compact hero: editable cover photo (click → photo picker dialog), name, unit-type badge (single/multi), location, OTA badges, AI status **button** that opens a **Sheet** to manage schedules. The Sheet has Weekly Schedule + Date Overrides tabs, fixed footer (Clear All / Copy to Properties / Save Schedule), and a Copy-to-Listings dialog (search + tag filter + select all)
- **`ListingOverviewTab.vue`** — Stats cards (revenue/occupancy/rating/rate) + upcoming bookings + recent reviews
- **`ListingPricingTab.vue`** — Base pricing, discounts, seasonal rates table
- **`ListingCalendarTab.vue`** — Bookings list + blocked dates
- **`ListingReviewsTab.vue`** — Rating summary (category Progress bars) + filter + review cards with host reply
- **`ListingMaintenanceTab.vue`** — Cleaning schedule + tasks + add-task dialog
- **`ListingSettingsTab.vue`** — Property details form + amenities (Popover) + distribution channels + Smart Locks card with Property/Rooms tabs, compact per-lock cards in 1/2/3-col grid, per-lock Codes Dialog with 3-state time-status badge and add-code form (Ongoing / Start-end times) (AI schedule moved to hero Sheet)
- **`ListingRowActions.vue`** — Dropdown menu (View Detail, Deactivate, Toggle AI)
- **`ListingFloatingMenu.vue`** — Fixed floating pill bar at bottom of page: Listing Setup · Test AI · AI Schedule
- **`ListingSetupOverlay.vue`** — Full-screen overlay shell for Listing Setup (header with **Property/Rooms toggle** + two-panel layout + **footer with Save Changes**). For multi-unit listings the toggle is just Property ↔ Rooms (a single combined tab — unit types and individual units are managed inside `RoomsPanel`). Footer includes **"Copy to Other Units"** button (rooms view only) and **"Save Changes"** button with toast confirmation.
- **`ListingSetupFieldPanel.vue`** — Left panel: 6 tabs (Basics, Listing Details, Amenities, SOPs, Topics to Avoid, Property Upsells). **Supports Property/Unit view modes** — Property view shows property-level fields (name, location, check-in/out); Unit view shows unit-specific fields (unit name) and is embedded in `RoomsPanel` for the selected room. Each field has a pencil icon → opens `FieldConfigDialog`. Dot indicator on pencil when config saved.
- **`RoomsPanel.vue`** — Used inside the Listing Setup overlay for the **Rooms** view. 2-column layout: 240px sidebar (rooms grouped by collapsible type, with hover-revealed trash button per room, "+ Add Room" and "⚙ Manage Room Types" footer buttons) + main area (reuses `ListingSetupFieldPanel` in unit view for the selected room). Sidebar has its own `Add Room` Dialog (type selector + name input) and **Manage Room Types** Dialog (wraps `UnitTypeManager`).
- **`ListingSetupResourcePanel.vue`** — Right panel (300px, **`flex-1 min-h-0`** on inner ScrollArea — required, see Patterns): Property Documents (upload PDF/DOCX/TXT, download, delete, **"Generate with AI"** button → Dialog with prompt textarea, 6 example prompt chips, 1.5s mock generation, read-only preview, "Save Document" creates a `.txt` from the generated content and adds it to the documents list), Elev8 AI integration checklist, Auto-Fill (1.5s mock), Copy from Property
- **`UnitTypeManager.vue`** — Used inside the Listing Setup overlay's Rooms view (and inside the "Manage Room Types" Dialog). Per-type editable card with **Details** + **Pricing** tabs. Pricing tab now supports **multiple rate plans** (one is marked `Base`, others can be added/removed) plus Offerings, Length-of-Stay Discounts, and Advanced Pricing (Fees).
- **`FieldConfigDialog.vue`** — Per-field config: Property Type info, Reservation Stages (Future/Inquiry Past/Current), Copy to Other Properties
- **`ListingTestAIDialog.vue`** — Guest chat simulation dialog with mock AI responses based on listing data (check-in time, amenities, etc.)

> **Schedule overlap rule**: time slots within a day auto-adjust to never overlap (`normalizeSlots` sorts by start and pushes each start past the previous end). Clear All resets hours+audience only (keeps enabled state). When 24/7 is on, the Custom Schedule is shown dimmed + non-editable.

> **Floating menu**: `ListingFloatingMenu` emits `open-setup`, `open-test-ai`, `open-schedule`. Page handles these — setup/test-ai open their overlays, schedule triggers `openSchedule` prop on hero which programmatically opens the schedule Sheet.

#### Listings Index (`app/pages/listings/index.vue`)
- TanStack Table with search, tag filter (AND logic), AI status filter
- **Status toggle column** (leftmost) — `ListingSingleToggle` component per row; Switch reactive via `listings` store
- **Unit type label** — "Single unit" / "Multi-unit · N units" (grey text) below listing name
- **Expand row** (multi-unit only) — chevron expands `ListingExpandRow` with per-unit toggles
- **Inactive dim** — name, AI Status, OTA columns all dim (`opacity-40`) when listing/all-units inactive
- `listingsKey` computed forces table re-render on status/aiStatus changes
- **`ListingAiStatusCell.vue` / `ListingOtaCell.vue`** — AI Status and OTA columns are dedicated reactive components rendered directly in the template (`v-if cell.column.id === ...` with explicit `ai-${id}`/`ota-${id}` keys), NOT via `h(Icon)` in TanStack column `cell` functions.
- ⚠️ **Table wrapped in `<ClientOnly>`** (with a `#fallback` skeleton). **Required** — without it, SSR hydration mismatch causes adjacent icon-bearing columns (AI Status ↔ OTA) to reuse each other's DOM `<span>`/`<svg>` nodes, so the AI Status column shows an OTA logo until a `listingsKey` change (e.g. toggling a listing) forces a full table remount. Same pattern as `app/pages/inbox.vue`.
- **Icon mode** — `nuxt.config.ts` sets `icon.mode: 'svg'` + `serverBundle.collections: ['lucide', 'logos', 'simple-icons']` (deps: `@iconify-json/logos`, `@iconify-json/simple-icons`). SVG mode avoids CSS-mode `<span class="iconify i-...">` DOM reuse across icons.

#### Listing Status System
- `Listing.status?: 'active' | 'inactive'` — listing-level status
- `Listing.aiStatus: 'active' | 'paused' | 'not_set'` — listing-level AI status (used for single-unit + as a derived aggregate for multi-unit)
- `Unit.status?: 'active' | 'inactive'` — per-unit status
- `Unit.otaConnected?: string[]` — per-unit OTA override (falls back to listing OTA)
- `UnitType.aiStatus?: 'active' | 'paused' | 'not_set'` — **AI is now controlled at the room-type level**, not per physical room. Toggling it applies to every unit of that type.
- **Multi-unit logic**: property status derived from units — all inactive = property inactive
- **AI aggregation** (multi-unit only): for the table's AI Status column, `ListingAiStatusCell` aggregates from `unitTypes[]` — any unit type active → "Active", all unit types paused → "Paused", otherwise falls back to `listing.aiStatus`
- **Deactivate cascade**: turning off listing/unit pauses AI at the unit-type level (and updates the listing-level `aiStatus` derived aggregate)
- **`ListingExpandRow.vue`** — reactive expand panel; property toggle cascades to all units; **per-unit-type AI On/Off badge** (in the unit type header, not per-unit row) + per-unit Switch + OTA icons; shows `toast.info/success` on each toggle
- **`ListingSingleToggle.vue`** — handles both single and multi-unit toggle logic; for multi-unit it writes `unitType.aiStatus` (not per-unit); shows `toast.info/success` on activate/deactivate
- **`ListingRowActions.vue`** — "Activate/Deactivate Listing" in dropdown; implemented with spread mutation
