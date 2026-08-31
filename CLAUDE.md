# CLAUDE.md — Elev8 Dashboard AI Design System

> **Stack**: Nuxt 3 + Vue 3 + shadcn-vue + Tailwind CSS v4
> **Font**: Inter (set in `app/assets/css/tailwind.css` via `--font-sans` / `--font-mono`, loaded by `@nuxt/fonts`)
> **Project**: elev8-dashboard — Property management for Bali vacation rentals
> **Current User**: Komang Juliantara (Guest Relations role)

---

## 🏗️ Project Overview

**Elev8** is a web dashboard for managing Bali vacation rental properties. Built with **Nuxt 3**, **Vue 3**, **shadcn-vue**, and **Tailwind CSS v4**.

### Main Modules
- **Inbox** — Guest messaging system (4-panel layout) with Phone call tab
- **Notification Center** — Bell icon in header with dropdown for CRITICAL/WARNING alerts
- **Finance** — Revenue (Reservations + Upsell), Costs, Integrations (Jurnal/Bexio)
- **Listings** — Property management with 6-tab detail page (Overview, Pricing, Calendar, Reviews, Maintenance, Settings) + compact hero with AI schedule Sheet (HostBuddy concept)
- **Upsells** — Full request system: Catalog CRUD, Order tracking with lifecycle (pending→confirmed→completed/cancelled), Cancellation flow with refund policies, Staff/Guest notifications, Inbox integration (UpsellOrderCreator, UpsellOfferCard in chat, linked orders in ReservationPanel)
- **AI Assistant** — Global Ask AI slide-over panel accessible from the top-right header on any page. Streams answers about reservations, cleaning, listings, occupancy, and revenue. **All ai-elements primitives** in use: `Message`/`Conversation`/`PromptInput`/`MessageResponse`/`MessageActions`/`Loader`/`Reasoning`/`Context`/`Confirmation`/`Suggestions`/`Attachments`/`Shimmer`/`ChainOfThought`. Mock-only v1 (pattern matcher + mock data + mock reasoning text), real-AI-ready via Vercel AI SDK streaming protocol. Follow-up suggestion chips appear above the textarea after each response.
- **Airbnb Reviews** — AI-powered guest review automation: tenant settings (language, tone, auto-post, delay), review queue with preview/edit/regenerate/post workflow, notification integration
- **Journeys** — AI-powered multi-step guest communication automation (Smart Flow section)
- **Kanban** — Task board
- **Tasks** — Data table with filtering (TanStack table)
- **Settings** — Profile, appearance, notifications, account
- **Auth** — Login, register, OTP, forgot password
- **Mail** — Email interface (demo)
- **Changelog** — Timeline-style release history page (version, date, badges, change categories)
- **Promo Codes** — Standalone promo code library (`/promo-codes`) reusable by booking widgets (and later the website builder) with per-source analytics scaffold
- **Branding Settings** — Tenant-level mock branding at `/settings/branding` (primary logo + favicon + invoice logo, plus Guest Guide primary/background/text colors). Dashboard sidebar logo + dashboard favicon + Guest Guide logo/favicon/CSS variables; invoice renderer is out of scope
- **Components Gallery** — All shadcn-vue component demos
- **Owner Portal (Phase 1)** — Dedicated, white-labeled external portal for property owners. Tenant staff manage owners at `/owners` and `/owner-statements`; the brand-aware portal lives under `/owner-portal` with a mock email magic-link login, owner dashboard, published-statement archive, issue flag, and owner self-stay create/modify/cancel with conflict detection, optional annual cap warnings, and three mock sync states.

---

## 👤 Current User Context

The logged-in user is **Komang Juliantara** (Guest Relations role), NOT "You" (Admin).

- `staff-1` / "You" in mock data = property owner
- Komang = active staff member viewing the dashboard
- This affects how you reference users in mock data vs. UI

---

## 📚 Key Documentation

- **Inbox Module Changelog** → `docs/superpowers/changelogs/2025-04-25-inbox-module.md`
- **Inbox Quick Reference** → `docs/superpowers/changelogs/2025-04-25-inbox-quick-ref.md`
- **Notification Center Spec** → `docs/superpowers/specs/2026-05-07-notification-center-design.md`
- **Notification Center Plan** → `docs/superpowers/plans/2026-05-07-notification-center-plan.md`
- **Auto-Translate Spec** → `docs/superpowers/specs/2026-05-25-auto-translate-design.md`
- **Auto-Translate Plan** → `docs/superpowers/plans/2026-05-25-auto-translate.md`
- **Listing Details Redesign Spec** → `docs/superpowers/specs/2026-06-01-listing-details-redesign.md`
- **Listing Details Redesign Plan** → `docs/superpowers/plans/2026-06-01-listing-details-redesign.md`
- **Listing Floating Menu + AI Auto-Fill Spec** → `docs/superpowers/specs/2026-06-01-listing-floating-menu-ai-autofill.md`
- **Listing Floating Menu + AI Auto-Fill Plan** → `docs/superpowers/plans/2026-06-01-listing-floating-menu-ai-autofill.md`
- **WhatsApp Integration UI Spec** → `docs/superpowers/specs/2026-06-01-whatsapp-ui-spec.md`

---

## 📊 Architecture Quick Reference

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

### Inbox Module (`app/components/inbox/`)

#### Data + Types (`app/components/inbox/data/conversations.ts`)
- `Conversation` type with `status: ConversationStatus | null`, `assignedTo?: string | null`, `tags: string[]`, `guestLanguage?: string`
- `Message` type with `aiWritten?: boolean`, `senderRole?: string`, `translatedContent?: string`
- `GuestDetails` type with `language: string`
- `StaffMember` list: You/Admin, Komang Juliantara/Guest Relations, Made Surya/Housekeeping, Wayan Adi/Maintenance
- `Reservation` type + mock data (6 conversations)
- **WhatsApp additions**: `otaSources` includes `WhatsApp` (`logos:whatsapp-icon`, green); `Conversation.waWindowExpired?: boolean` (24h window); `Message.mediaUrl?`/`mediaDims?` (photo messages); `StayStatus` includes `'unmatched'`; `UnmatchedMessage` type. WhatsApp conversations seeded: Max Müller (normal), Lisa Park (complaint + pool photos), Marcel Weber (window expired), + 3 `conv-um-*` unmatched (phone-number as guestName, `listingName: 'Unknown'`)

#### Shared State (`app/composables/useInbox.ts`)
- **Reactive**: `conversations` uses `useState<Conversation[]>` — mutations MUST use spread syntax to trigger Vue reactivity
- **Filters**:
  - `showActionNeeded` — boolean toggle
  - `assignedToMeFilter` — boolean
  - `activeStayFilter` — boolean
  - `activeListingFilter` — multi-select `string[]` (empty = no filter). Checkboxes in sidebar. Selected listings shown as removable chips.
  - `activeTagFilters` — multi-select `string[]` (AND logic). Tags button opens searchable Popover with checkboxes. Selected tags shown as removable chips.
  - `listingSearchText`, `searchValue`, `sortBy`
- **Actions**: `markAsHandled()`, `markAsUnread()`, `assignTo()`, `getAssignedStaff()`, `toggleListingFilter()`, `clearListingFilters()`, `toggleTagFilter()`, `clearTagFilters()`, `clearAllListingFilters()`, ElevAI toggle functions
- **Auto-read**: Selecting a conversation sets `unreadCount = 0`
- **Key type**: `ConversationStatus = 'action_needed'` (nullable — `null` = no action needed)
- **Phone**: `getPhoneCalls(conversationId)` returns `PhoneCall[]` for the conversation
- **Auto-translate**: `autoTranslate` boolean state (default `true`), `mockTranslate(text, lang)` async mock function (500ms delay)
  - Guest messages → translated to Bahasa Indonesia; Host messages → translated to `guestLanguage`
  - Toggle button (icon `lucide:languages`, ghost variant) in Thread header opens Popover with guest language info + Active/Disabled toggle
  - `ThreadMessage.vue`: when auto-translate ON → bubble shows translated text only + "Translated" label; when OFF → shows original
  - `ReplyBox.vue`: shows "Messages will be auto-translated to {guestLanguage}" indicator when ON

#### Phone Call Features
- `PhoneCall` interface with `direction`, `status`, `duration`, `transcript`, `summary`, `recording_url`
- Phone tab in Thread.vue — call history with transcript expand/collapse, download recording, AI summary block per call (gold-tinted, ElevAI badge)
- Call summaries in Notes tab — same layout as regular notes (caller name + date + ElevAI badge), caller derived from `direction` (outbound → "Komang Juliantara", inbound → guest name)
- Phone call entries in Activity timeline with Send button for unsent templates

#### Image Sending
- `ReplyBox.vue` — paperclip button opens native file picker (images only), preview thumbnail above textarea with X remove button, `canSend` computed enables Send for image-only messages
- `sendMessage()` accepts optional `mediaUrl` and `mediaDims` params, passes to `Message` object
- Image-only messages show "📷 Photo" in conversation list lastMessage
- `ThreadMessage.vue` already renders `mediaUrl` images in bubbles (no change needed)

#### Notes System
- Notes appear in both Messages tab (inline with chat) and Notes tab (dedicated view)
- Notes tab: call summaries first, then staff/guest notes; native checkbox for "Let ElevAI read this note" (Reka UI Checkbox has reactivity bug)
- Edit/delete on staff notes only (`authorId !== 'guest'`); inline edit mode with Textarea + ElevAI checkbox + Save/Cancel
- Messages tab notes: author name shown, edit/delete buttons below bubble, edit mode styled to match yellow bubble
- `useInbox` exports: `addNote()`, `editNote(conversationId, noteId, content, visibleToAI?)`, `deleteNote(conversationId, noteId)`

### WhatsApp Integration (`app/components/settings/` + `app/components/inbox/`)

> **Full UI spec** → `docs/superpowers/specs/2026-06-01-whatsapp-ui-spec.md` (Phase 1–4 wireframes, states, design tokens)

WhatsApp Business is integrated **into the existing inbox** (not a separate page). Mock/demo only — no real Meta API.

#### Settings → Integrations (`app/pages/settings/integrations.vue`)
- Route added to `SettingsSidebarNav.vue` + `constants/menus.ts`
- Shows only `SettingsWhatsAppIntegration`
- **`SettingsWhatsAppIntegration.vue`** — multi-account WhatsApp management: Connected tab (account cards with business name, listing count, Manage/Test Send/Disconnect) + Unassigned tab (bulk assign listings to accounts). **Manual credential form** (not OAuth) — user enters **Account name**, Access Token, WABA ID, Phone Number ID. Phone numbers are NOT displayed anywhere in the UI (no real phone data is available in this mock flow). On success: opens step-by-step flow (Step 1: Webhook → Step 2: Assign Listings). Clicking Manage on existing account opens dialog with 2 tabs: Credentials (edit account name/token/WABA/phone + webhook info) and Listings. Tabs hidden when no accounts connected.
- **Test Send dialog** — clicking Test Send opens a popup with: recipient phone input (`inputmode="numeric"`, country-agnostic `AsYouType` formatter with forced `+` prefix, keydown handler blocks non-digit keystrokes — only digits and clipboard shortcuts allowed), template picker (5 hardcoded templates: Welcome, Check-in, Check-out, House Rules, Custom), auto-generated variable inputs from template placeholders, live WhatsApp-style message preview, and Send button (disabled until phone + body valid).
- **`WhatsAppRoutingRules.vue`** — Routing rules (not currently used in UI)

#### Composables
- **`useWhatsApp.ts`** — `useState('whatsapp-accounts')`; multi-account `WhatsAppAccount[]` with `accessToken`, `wabaId`, `phoneNumberId`, `webhookToken` fields and `listingIds: string[]`. Key exports: `whatsappAccounts`, `isConnected`, `validateAndConnect(token, wabaId, phoneId, accountName)`, `addAccount()`, `removeAccount()`, `updateAccount()`, `assignListings()`, `bulkAssign()`, `disconnect()`. Persisted to localStorage. `validateAndConnect` mocks Graph API call (random mock business for `displayPhoneNumber`, uses user-supplied `accountName` as `businessName`) + auto-generates webhook token.
- **`useWhatsAppRules.ts`** — `useState('whatsapp-rules')`; `RoutingRule` type, `conditionTypeLabels`, `routeToLabels`, `ruleConditionText()`, `saveRule()`, `deleteRule()`, `toggleRule()` (component not currently used in UI)
- **`useWhatsAppTemplates.ts`** — `waTemplates` (booking_confirmation, checkin_instructions, upsell_early_checkin, review_request) + `renderTemplate()`

#### Inbox features (reuse existing channel filter / notes / assignment / AI / send-status)
- **Channel**: WhatsApp appears automatically in the List.vue Filters → Channel (from `otaSource`)
- **`WhatsAppSendModal.vue`** (`InboxWhatsAppSendModal`) — template picker + live preview; used by Thread (window-expired fallback) and reusable for reservation detail
- **Media messages** — `ThreadMessage.vue` renders `mediaUrl` image + dims caption inside bubble
- **24h window** — `Thread.vue` shows "window expired" banner + Send Template button when `otaSource === 'WhatsApp' && waWindowExpired`
- **Not-connected state** — `Thread.vue` shows "WhatsApp not connected" banner (link to `/settings/integrations`) when `otaSource === 'WhatsApp' && !useWhatsApp().isConnected`; takes priority over window-expired
- **Unmatched queue** — unmatched messages are conversations with `stayStatus: 'unmatched'`, filterable via the new "Unmatched" sidebar filter (`Nav.vue`). Thread shows an action bar (Match to Guest / Dismiss). `useInbox`: `matchUnmatched(umConvId, targetConvId)` (moves messages into target conv), `createFromUnmatched(umConvId)`, `dismissUnmatched(id)`
- **Automation channel** — Journeys builder (`JourneyStepSidebar.vue`) already had a `whatsapp` channel option
- **NOT implemented** (descoped per user): Claim/Release buttons, routing-mode badges (HostBuddy/Staff/Review) — `action_needed` status already covers escalation

#### Inbox SSR note
- `app/pages/inbox.vue` wraps `<InboxLayout>` in `<ClientOnly>` to avoid Reka UI `ScrollArea` hydration mismatches. `useInbox` merges fresh seed conversations/messages into `useState` so newly added seed data always appears.

#### Inbox reservation ID fix
- `app/components/inbox/Layout.vue` synthesizes `effectiveReservation` (passed to `ReservationPanel`) with `id: c.reservationId` — the **conversation's reservation ID** (`res-1`, `res-7`, etc.), NOT the conversation's own `id` (`conv-1`).
- This matters because any code that filters by `reservation.id === code.reservationId` (e.g. the Smart Lock tab) needs the synthesized id to match the code's `reservationId`. Using `c.id` here would cause the Smart Lock tab to always show "No active codes".

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

### Inbox Settings (gear icon in inbox header)

A gear icon (⚙️) sits next to the "Inbox" header title in `InboxLayout.vue`. Clicking it opens a **Popover** with two options:

- **Integrations** → opens a Sheet with `SettingsWhatsAppIntegration`
- **AI Conversation Settings** → opens `InboxAiSettings` Sheet

#### `InboxAiSettings.vue` (`app/components/inbox/AiSettings.vue`)
- `Sheet` (640px wide) with two-column layout: config sidebar (left, 192px) + form (right, scrollable)
- Multi-config support: **default** config (applies to all unlisted properties) + custom configs per listing
- Custom configs have a listing picker (checkboxes from `allProperties`) to select which listings they apply to
- Config form fields: Defer Behavior (5 options), Direct Contact, Use Signature + textarea, Conversation Closing, AI Transparency, Language (guest/always), Stop on Negative Sentiment, Message Delay (min/max), Customize Tone
- `defineModel<boolean>('open')` — controlled by parent
- `inboxView` state was added to `useInbox` but is unused (kept for future use)

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

**Currency display**: always `IDR` prefix (not `Rp`) for Indonesian Rupiah. CHF uses `de-CH` locale with 2 decimal places. Header amounts always in CHF (tenant currency).

**Integration filter**: all three tabs (Reservations, Upsell, Costs) have a `filterIntegration` select — `'all' | 'jurnal' | 'bexio' | 'none'`.

**Acctg. Amount column**: shown in Reservations, Upsell, and Costs tables when `showConvertedColumn` is true. Displays `—` for unsynced rows.

**Synced badge**: table rows in Reservations, Upsell, and Costs tabs all show cloud-check icon + Jurnal (blue) or Bexio (violet) badge when synced. Not-synced rows show cloud-off icon.

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

### Journeys Module (`app/components/journeys/`)

AI-powered multi-step guest communication automation. Replaces Dynamic Templates as the primary automation surface.

#### Data + Types (`app/components/journeys/data/journeys.ts`)
- Types: `Journey`, `JourneyStep` (union of `TriggerStep | WaitStep | MessageStep | ContextCheckStep | ActionStep`), `MarketplaceTemplate`
- Step types: `trigger` (purple), `wait` (gray), `message` (green), `context_check` (amber), `action` (red)
- Mock data: `mockJourneys` (4 journeys), `marketplaceTemplates` (4 templates), `generatedJourneyExample`
- `generatedJourneyExample` includes `aiReasoning: string` and `stats: { messages, contextChecks, estimatedTime }`

#### Composable (`app/composables/useJourneys.ts`)
- `journeys` — `useState<Journey[]>` with spread syntax mutations
- `toggleStatus(id)`, `saveJourney(journey)`, `deleteJourney(id)`

#### Components
- **JourneyList.vue** — Table of journeys with inline Switch toggle, status Badge, DropdownMenu (Edit/Delete), empty state
- **JourneyBuilderPrompt.vue** — Screen 1: textarea + example chips + 2×2 template grid
- **JourneyBuilderGenerating.vue** — Screen 2: 5-step animated progress (600ms per step), gold spinner for active step, emits `done(journey)` with `generatedJourneyExample`
- **JourneyBuilderReview.vue** — Screen 3: two-column step list + AI reasoning/stats/refine sidebar
- **JourneyEditor.vue** — Two-column editor: step timeline (left) + JourneyStepSidebar (right), inline editable journey name, Active switch, Save button, Add Step dropdown
- **JourneyStepCard.vue** — Step card with colored icon circle, HostBuddy AI gold badge on message steps, WhatsApp warning tooltip, hover trash button, connecting dashed line
- **JourneyStepSidebar.vue** — Dynamic form per step type (trigger/wait/message/context_check/action), emits `update(step)` on every change
- **JourneyMarketplace.vue** — Category filter tabs, 2-col grid, Preview Dialog (non-interactive step list), Install button

#### Page (`app/pages/journeys/index.vue`)
View states: `'list' | 'marketplace' | 'builder-prompt' | 'builder-generating' | 'builder-review' | 'editor'`
Flow: list → builder-prompt → builder-generating → builder-review → editor → (save) → list

#### Nav
Smart Flow section in `app/constants/menus.ts` — Journeys (`i-lucide-route`) + Templates

### Kanban Module (`app/components/kanban/`)
- **KanbanBoard.vue** — Main board component
- Composable: `app/composables/useKanban.ts`

### Upsells Module (`app/components/upsells/`)

#### Data + Types
- **`upsell-services.ts`** — `UpsellItem` (with `description?`, `image?`), `UpsellService` (with `availability: 'always' | 'by_request'`, `pricingEnabled`, `taxPercent`, `servicePercent`), 10 mock services
- **`upsell-orders.ts`** — `UpsellOrder` interface with `serviceDate`, `serviceEndDate?`, `source` ('manual' | 'inbox' | 'web'), `conversationId?`, `approvalStatus`, `paymentStatus`, `fulfillmentStatus`, `cancellationReason?`, `cancellationBy?`, `invoice?`; `OrderStatus` derived from lifecycle (`requested`, `awaiting_payment`, `paid_in_progress`, `completed`, `declined`); 11 mock orders
- **`upsell-notifications.ts`** — 7 notification types (order_created, order_confirmed, order_completed, order_cancelled, refund_issued, reminder_24h, reminder_1h), notification template system, 10 mock notifications
- **`cancellation-policies.ts`** — Per-service refund calculator (48h/24h/late windows); staff cancel = 100% refund always; guest cancel depends on timing

#### Composables
- **`useUpsellServices.ts`** — Catalog CRUD, filters (`activeCategoryFilter`, `activeStatusFilter`, `activeListingFilter`, `searchValue`)
- **`useUpsellOrders.ts`** — Orders state + CRUD, `updateStatus()`, `addOrder()`, `cancelOrder()` (with refund calculation), filters, `statusCounts`, `totalRevenue`
- **`useUpsellNotifications.ts`** — Notification state, `createNotification()`, `markAsRead()`, unread count

#### Components
- **`UpsellTable.vue`** — TanStack data table with columns: Name, Category, Price Range, Items, Listings, Availability, Status
- **`UpsellFilterBar.vue`** — Category pills + Status filter + Listing filter + Search input
- **`UpsellDrawer.vue`** — 2-tab Sheet drawer (Details + Items); Details: name, description, image upload (FileReader→base64), YouTube links, listings, availability selector, tax/service section; Items: modal dialog for adding items, vuedraggable sort with grip handle
- **`UpsellOrderTable.vue`** — Orders table with status filter pills, KPI cards
- **`UpsellOrderDrawer.vue`** — Order detail with reactive computed lookup from `useUpsellOrders` state, fulfillment section, approval/decline + payment actions, no notification log section
- **`UpsellNotificationList.vue`** — Staff notification list with unread/all filter, severity icons
- **`UpsellCancelModal.vue`** — Decline reason textarea + handled-by toggle (guest/staff)

#### Page (`app/pages/upsells.vue`)
- 3 tabs: Catalog / Orders / Notifications with KPI cards

### Upsells Inbox Integration (`app/components/inbox/`)

#### Components
- **`UpsellOrderCreator.vue`** — Mini Sheet drawer for creating upsell orders from chat; service picker (Select component), item checkboxes (with `isCreateDisabled` computed), date picker
- **`UpsellOfferCard.vue`** — Renders upsell offer in chat thread with service details, pricing breakdown, status badge, action buttons (Withdraw / View Order)
- **`ReplyBox.vue`** — "Upsell" button (shopping-cart icon) next to channel dropdown, opens UpsellOrderCreator
- **`ReservationUpsells.vue`** — Tab in ReservationPanel showing linked upsell orders from `conversation.linkedUpsellOrderIds`, displays order status (via `getOrderStatusMeta()`), service date, grand total
- **`Thread.vue`** — Linked order badges removed from thread header (moved to ReservationPanel Upsell tab)

#### Data + Types (`app/components/inbox/data/conversations.ts`)
- `Conversation` extended with `linkedUpsellOrderIds?: string[]`
- `Message` extended with `upsellOffer?: UpsellOffer`
- `UpsellOffer` type — `id`, `orderId`, `serviceName`, `items`, `subtotal`, `taxAmount`, `serviceAmount`, `grandTotal`, `currency`, `status: 'pending' | 'accepted' | 'declined' | 'withdrawn'`, `serviceDate`
- Mock `conv-21` (Emma Thompson) with accepted spa upsell + `ord-011` order
- Reservation `R-2026-0521` added for Emma Thompson

#### Composable (`app/composables/useInbox.ts`)
- `sendMessage()` accepts optional `upsellOffer` payload + optional `mediaUrl`/`mediaDims` for image attachments — creates order + sends chat message with offer card
- `getLinkedOrders(conversationId)` — returns UpsellOrder[] for a conversation
- `linkOrderToConversation(conversationId, orderId)` — adds order ID to `linkedUpsellOrderIds`

#### Upsell Offer Flow
1. Staff clicks Upsell button → UpsellOrderCreator opens → selects service/items/date → sends offer
2. `sendMessage()` creates order (status: pending) + sends message with `upsellOffer` payload
3. `UpsellOfferCard` renders in thread with pricing breakdown and status badge
4. Guest accepts → offer status becomes 'accepted', order status becomes 'confirmed'
5. Staff can withdraw offer → status becomes 'withdrawn'
6. Linked order appears in ReservationPanel → Upsell tab

#### Key Patterns
- `availability: 'always'` → auto-confirmed; `'by_request'` → pending confirmation
- Cancellation: staff cancel = 100% refund; guest cancel depends on policy timing
- Upsell offers embedded in chat via `UpsellOfferCard` component (not separate notification)
- Order drawer reactivity: use computed lookup from `useUpsellOrders` state, not prop snapshot

### Airbnb Reviews Module (`app/components/airbnb-reviews/`)

AI-powered guest review automation for Airbnb. Generates fair, professional reviews based on communication history and housekeeping feedback.

**New files:**
```
app/
├── pages/reviews.vue
├── components/airbnb-reviews/
│   ├── PreviewDialog.vue          # Editable preview (text, ratings, checkboxes)
│   └── data/reviews.ts            # Types, mock data, config defaults
├── components/settings/
│   └── AirbnbReviewConfig.vue     # Settings form in Integrations page
└── composables/useAirbnbReviews.ts # State + CRUD + mock generation
```

**Data Model:**
```ts
interface AutoReview {
  id: string
  booking_id: string
  property_id: string
  guest_name: string
  checkout_date: string
  listing_name: string
  listing_location: string
  num_guests: number
  nights: number
  status: 'pending' | 'generating' | 'draft' | 'posted' | 'failed'
  generated_at: string | null
  ai_model: string
  generation_cost: number | null
  host_language: HostLanguage
  strict_mode: boolean
  tone_mode: ToneMode
  public_review: string | null
  private_feedback: string | null
  ratings: ReviewRatings | null
  recommend_guest: boolean | null
  would_host_again: boolean | null
  manually_edited: boolean
  edited_at: string | null
  airbnb_review_id: string | null
  posted_to_airbnb_at: string | null
}

type ReviewStatus = 'pending' | 'generating' | 'draft' | 'posted' | 'failed'
type ToneMode = 'balanced' | 'gentle' | 'data-driven'
type HostLanguage = 'en' | 'de' | 'fr' | 'id' | 'es' | 'it' | 'pt'
```

**Settings (`ReviewAutomationConfig`):**
- `enabled` — toggle (default: false)
- `host_language` — 7 languages (en/de/fr/id/es/it/pt)
- `tone_mode` — balanced/gentle/data-driven
- `auto_post` — auto-post or save as draft
- `review_delay_hours` — 1-168 hours (default: 24)
- Persisted to localStorage (`elev8-airbnb-review-config`)

**Settings Page:** Review Hub settings moved to a right-side Sheet on `/reviews` page (via "Settings" button in page header). The `/settings/integrations` page now only contains WhatsApp integration. See **Review Hub Module** section for full config schema.

**Dashboard Page:** `/reviews` — stats cards (pending/draft/posted/failed), filter bar (search, status, listing), table with actions.

**Preview Dialog:** Single dialog for preview + edit. Draft reviews have editable Textareas, clickable star ratings, checkboxes, Regenerate/Save as Draft/Post to Airbnb buttons. Posted reviews are read-only.

**Status Lifecycle:** `pending` → `generating` → `draft` → `posted` (or `failed` → retry)

**Mock Generation:** `generateMockReview()` produces realistic reviews with positive/mixed variants. 1.5s simulated delay. `regenerateReview()` re-generates with different wording.

**Auto-open Preview:** Clicking Generate in table auto-opens preview dialog after generation completes.

**Composable (`useAirbnbReviews`):**
- `reviews` — `useState<AutoReview[]>` with JSON.parse(JSON.stringify(mockReviews))
- `config` — `useState<ReviewAutomationConfig>` with localStorage persistence
- `filterStatus`, `filterListing`, `searchQuery` — filter refs
- `filteredReviews` — computed from filters
- `stats` — computed counts by status
- `approveReview(id)` — sets status to posted
- `saveDraft(id, data)` — saves edits, marks manually_edited
- `generateReview(id)` — mock AI generation
- `regenerateReview(id)` — re-generates review
- `retryFailed(id)` — retries failed generation

**Notification Integration:**
- Alert types: `AIRBNB_REVIEW_GENERATED`, `AIRBNB_REVIEW_POSTED`, `AIRBNB_REVIEW_FAILED`
- Added to `alertDisplayLabels`, `alertIcons`, `alertRouteMap`, `getDescription()`
- `useNotifications` filter kind: `'reviews'`
- NotificationCenter kind tabs includes "Reviews" tab

**Sidebar:** Added under General section (`i-lucide-star` icon, marked `new: true`)

### Review Hub Module (`app/components/review-hub/`)

3-panel guest review aggregator (Airbnb + Booking.com + Direct), aligned with **Channex API**. Combines guest review replies, AI-drafted host review-of-guest, and Stay Operational Record (SOR) signals with tag enrichment.

**New files:**
```
app/
├── pages/reviews.vue                   # Page: feed table + ScoreCards + settings sheet + banner
├── components/review-hub/
│   ├── DetailDrawer.vue                # 3-panel drawer (guest review, SOR, reply, host review)
│   ├── DetailGuestPanel.vue            # Guest review + rating breakdown + Channex tags chips
│   ├── DetailSorPanel.vue              # Stay Report (cleaning, house rules, communication)
│   ├── FeedTable.vue                   # TanStack table with contextual action buttons
│   ├── Filters.vue                     # Status / channel / property (PropertyPicker)
│   ├── HostReviewPanel.vue             # AI host review of guest (Airbnb-only) + rating + tags
│   ├── MiniBadges.vue                  # Numeric badges: cleaning/house rules/communication
│   ├── ReplyPanel.vue                  # AI reply to guest review (text-only, all channels)
│   ├── ScoreCards.vue                  # Aggregate property scores above feed
│   ├── SourceBadge.vue                 # Channel badge (Airbnb / Booking.com / Direct)
│   ├── StatusChip.vue                  # Reply status chip (3 states)
│   └── data/
│       ├── types.ts                    # Channex-aligned types + tag mappings + display helpers
│       ├── mock-review-records.ts      # 10 mock records (Channex format, 0-10 scores)
│       └── mock-sor.ts                 # 10 mock SOR records
├── composables/useReviewHub.ts         # State + filters + computed status + tag enrichment
└── components/settings/AirbnbReviewConfig.vue  # Host review + reply auto-post settings
```

**Data Model (Channex-Aligned):**
```ts
type ReviewSource = 'airbnb' | 'booking_com' | 'direct'
type ReplyStatus = 'host_review_pending' | 'needs_reply' | 'replied'

interface ScoreCategory {
  category: string  // Channex: "clean", "accuracy", "communication", "location", etc.
  score: number     // 0-10 scale, all channels normalized
}

interface ReviewRecord {
  id: string
  reservation_id: string
  source: ReviewSource
  listing_id, listing_name, listing_location
  unit_id: string | null
  guest_name, num_guests, nights
  guest_rating_overall: number | null  // Channex: 0-10, all channels normalized
  scores: ScoreCategory[]              // Channex: [{category: "clean", score: 9.5}, ...]
  tags: string[]                       // Channex: ~80+ predefined tag codes (Airbnb only)
  guest_review_text: string | null
  is_hidden: boolean                   // Channex: Airbnb double-blind flag
  is_replied: boolean                  // Channex: host has replied
  private_feedback: string | null
  review_received_at, language_detected
  reply_status: ReplyStatus            // Elev8 computed
  reply_text, reply_posted_at
  host_review_id: string | null
  host_review_text: string | null
  host_review_ratings: { cleanliness, communication, respect_house_rules } | null  // Channex 1-5
  is_reviewee_recommended: boolean | null  // Channex flag
  host_review_tags: string[]           // Channex host review tags
  sor_id, checkout_date, created_at, updated_at
}
```

**Channex API Mapping:**
- `GET /reviews` → `ReviewRecord` (scores[], tags[], is_hidden, is_replied)
- `POST /reviews/:id/reply` → text-only reply (`{ reply: { reply: "text" } }`)
- `POST /reviews/:id/guest_review` → **Airbnb only**: scores, public_review, private_review, `is_reviewee_recommended`, tags[]
- Tags are Airbnb-only; Booking.com reviews have empty `tags[]`
- All scores normalized to 0-10 by Channex; display helpers: `getDisplayScore()` (Airbnb ÷2, Booking.com as-is), `getDisplayMax()` (Airbnb 5, Booking.com 10)

**Computed Status (getComputedStatus):**
- `replied` — `is_replied === true`
- `host_review_pending` — Airbnb: `!host_review_id && window > 0`; Booking.com: same + 365d window
- `needs_reply` — guest review visible + has content + not replied

**Airbnb Double-Blind (isGuestReviewHidden):**
- Hidden when: `is_hidden === true` + `!host_review_id` + `< 14 days since checkout`
- Auto-reveal: after 14d from checkout OR when host submits review (sets `is_hidden: false`)
- Reply window: Airbnb ~44d from checkout (14d blind + 30d reply), Booking.com 30d

**Host Review of Guest (Airbnb Only):**
- Channex `POST /guest_review` is Airbnb only — Booking.com/Direct don't support it
- HostReviewPanel rendered only when `showHostReviewPanel` computed is true:
  - Already submitted (readonly view)
  - Airbnb: guest review still hidden (double-blind active)
- Panel includes: public review, private feedback, 3 ratings (cleanliness, communication, respect_house_rules), `is_reviewee_recommended` toggle, 22 host review tags selector
- `generateHostReviewDraft()` returns tags[] derived from SOR signals (auto-selected on generate)
- `submitHostReview(id, text, ratings, isRecommended, tags)` — sets `is_hidden: false`

**Tag System:**
- **Guest review tags** (~80+): `guest_review_host_positive_spotless_furniture_and_linens`, `negative_dirty_or_dusty`, etc. Displayed as green/red chips in DetailGuestPanel (expandable, 4 visible + "+N more")
- **Host review tags** (22): 8 cleanliness, 7 house_rules, 7 communication — selectable chips in HostReviewPanel
- **Tag enrichment** (`enrichSorFromTags`): derives cleaning_score/communication_score/house_rule_flags from Channex tags when SOR data is missing or sparse. Does not override existing SOR data.

**ScoreCards:**
- Aggregate scores computed from `filteredFeedItems`: overall average + top 3 category scores with counts
- Rendered above feed table on `/reviews` page

**Settings (AirbnbReviewConfig.vue):**
- Two separate sections with distinct icons:
  - **Host Review of Guest** (icon: user-check): Airbnb auto-post toggle, submission delay (1-13d), auto-select tags toggle
  - **Reply to Guest Review** (icon: message-circle): Airbnb + Booking.com per-channel auto-post toggles, reply delay (0-30d)
- Shared: master toggle, language (7 options), tone (balanced/gentle/data-driven), generation delay (1-168h)
- Config fields: `auto_post_host_review`, `host_review_delay_days`, `auto_select_tags`, `auto_post_replies: { airbnb, booking_com }`, `reply_delay_days`

**Composable (`useReviewHub`):**
- `reviewRecords`, `sorRecords` — `useState<>()` with deep-cloned mock data
- `filteredFeedItems` — computed: filter by status (computed)/channel/property + search, sorted by checkout desc
- `feedItems` — computed: merges ReviewRecord + enriched SOR + hostReview from `useAirbnbReviews`
- `getComputedStatus(record)` — derives ReplyStatus from is_hidden/is_replied/host_review_id/countdown
- `isGuestReviewHidden(record)` — double-blind check (is_hidden + 14d)
- `isGuestReviewVisible(record)` — inverse
- `getHostReviewCountdown(checkout, source)` — 14d Airbnb / 365d Booking.com
- `getReplyCountdown(checkout, source)` — 44d Airbnb / 30d Booking.com
- `enrichSorFromTags(record, sor)` — tag-derived SOR signals
- `generateReplyDraft(recordId)` — 1.5s mock, positive/mixed/negative based on overall score (≥8 positive)
- `generateHostReviewDraft(recordId)` — 1.5s mock, returns `{ text, privateFeedback, ratings, tags }`
- `approveReply(recordId, text)` — sets is_replied + reply_status
- `submitHostReview(recordId, text, ratings, isRecommended, tags)` — sets host_review_id + is_hidden: false
- `translateReview(recordId)` — mock translate (700ms) of `guest_review_text`; target lang from `useAirbnbReviews().config.host_language`; persists `translated_content` + `translation_language` via `updateReviewRecord`; no-op when already translated, target == source, or no text; toast on success
- `resolveTargetLang()` — returns current `host_language` (default `'en'`)

**Translate Guest Review:**
- `DetailGuestPanel` shows a per-review **Translate** toggle next to the `Language:` label when the review language differs from the configured target (or a translation already exists)
- Toggle switches between original text and `translated_content`; "Translated to {language}" label (resolved via `hostLanguageOptions`) shown while translated
- `language_detected` values: `de` (rr-012, German text) and `fr` (rr-015, French text) — both map to English in `mockReviewTranslations` in `useReviewHub.ts`

**Mock Data (10 records):**
- 3 Airbnb (1 double-blind hidden, 2 visible), 3 Booking.com (1 replied, 2 host_review_pending), 2 Direct (1 replied, 1 no review), 2 past Airbnb (>14d, auto-revealed)
- All scores in 0-10 Channex format, realistic tags on Airbnb records
- 10 SOR records with cleaning_score 2-5, house_rule_flags 0-3, communication_score 3-5

### Payment Request Module (`app/components/payment-request/`)

**Full UI spec** → `docs/superpowers/specs/2026-06-18-payment-request-design.md`

Page for creating payment links, tracking status, and managing receipts. Integrated with Payouts module.

**New files:**
```
app/
├── pages/payment-requests/index.vue
├── components/payment-request/
│   ├── PaymentRequestCreateDialog.vue   # Create payment link wizard
│   ├── PaymentRequestTable.vue          # History table with filters
│   ├── PaymentRequestDetailDialog.vue   # Detail view (status, receipt, timeline)
│   ├── PaymentRequestShareDialog.vue    # Copy link, QR code, WhatsApp/Email
│   └── data/payment-requests.ts         # Types, mock data, helpers
└── composables/usePaymentRequests.ts    # State + CRUD + filters
```

**Data Model:**
```ts
interface PaymentRequest {
  id: string
  guestName: string
  guestEmail: string
  listingId: string
  title: string
  description?: string
  amount: number
  currency: 'USD' | 'IDR'
  feeMode: 'card' | 'manual'        // card = +3%, manual = no fee
  feeAmount: number
  totalAmount: number
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  payoutAccountId: string
  paymentLink: string
  qrCodeUrl?: string
  expiresAt: string
  paidAt?: string
  receiptUrl?: string
  createdAt: string
  createdBy: string
  notes?: string
}
```

**Create Flow (2-step Dialog):**
1. **Payment Details**: Guest name (searchable autocomplete from existing guests/inbox), Select Listing (with unassigned warning), Payment title, Description, Email, Amount, Currency, Fee mode (Card +3% / Manual no fee)
2. **Share & Confirm**: Generated link, QR code, WhatsApp/Email share, expiry selector, summary

**Guest Search:**
- Combobox with search — sources from `conversations` (inbox guests) + existing payment requests
- Selecting existing guest auto-fills email
- "New guest" option if not found
- Shows guest avatar + last stay if from inbox

**Payout Integration:**
- Auto-detect currency from assigned payout account
- Unassigned listing → warning banner + [Assign now] link (disabled until fixed)
- Minimum amount validation per provider (Stripe $0.50, Doku IDR 10k)

**Status Lifecycle:** `pending` → `paid` / `expired` (auto) / `cancelled` (staff)

**List View:** TanStack Table with columns: Guest, Title, Listing, Amount (with fee breakdown), Status badge, Created, Expires, Actions (View/Copy/Cancel)

**Filters:** Status, Listing multi-select, Date range, Search (guest/title)

**Empty States:**
- No payout accounts → CTA to Settings → Payouts
- No requests → "Create your first payment request"

**Edge Cases:**
- Duplicate detection (same guest + amount within 1h → confirm dialog)
- Expired link accessed → "Link expired" page
- Already paid → "Payment completed" with receipt
- Account disconnected → badge on old requests
- Currency mismatch → auto-switch or warning
- Network error → retry + toast

**Sidebar:** Added under Finance section (`i-lucide-link` icon)

### Operations Calendar Module (`app/components/operations-calendar/`)

Time-based view of guest stays, cleaning jobs, and tasks. Week/day views with hierarchical tree.

- **Data + types**: `app/components/operations-calendar/data/operations-calendar.ts`
  - `OperationsFilters` type with `listingSearch`, `listingTags` (AND logic), `eventTypes` (OR logic)
  - `CalendarEvent` type with `type: 'guest_stay' | 'cleaning' | 'task'`, `listingId`, scheduled times
  - Build helpers: `buildAllEvents()`, `eventsForDay()`, `getWeekDays()`, `groupEventsByListingAndDay()`
  - Events built from cleaning jobs + tasks (not inbox conversations)
- **State**: `app/composables/useOperationsCalendar.ts`
  - `filters` — `ref<OperationsFilters>` with spread assignment to trigger reactivity
  - Computed: `filteredListings` (search + tag AND filter), `filteredListingIds` (Set), `hasListingFilter`, `filteredEvents` (listing + event type), `eventsByDay`, `eventsByDayAndListing`, `eventsByListingAndDay`
  - Navigation: `previousWeek()`, `nextWeek()`, `goToToday()`
  - Actions: `moveCleaning()`, `clearFilters()`, `toggleEventType()`
- **Page**: `app/pages/operations-calendar.vue`
  - Week/Day toggle (Tabs), prev/next/Today navigation buttons
  - Filters bar + board grid, wrapped in `<ClientOnly>`
  - Lazy-loaded board, create dialog
- **Components**:
  - `OperationsCalendarFilters.vue` — Search input, Tags Popover (multi-select with search, AND logic), Event Types Popover (OR logic), Clear button
  - `OperationsCalendarBoard.vue` — Week/day grid rendering events by listing rows
  - `OperationsCalendarEventChip.vue` — Individual event chip in grid cells
  - `OperationsCalendarCreateDialog.vue` — New cleaning job / task creation
- **Key fix**: Reka UI `CheckboxRoot` ignores external `:checked` prop changes after initial render. Filter checkboxes use native `<button @click>` for toggle logic + plain `<span>` with reactive Tailwind classes for visual — no Reka UI checkbox component to avoid desync.

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

- **Components** (in `app/components/promo-code/`)
  - `PromoCodeTable.vue` — pure presentational table; props `{ codes }`; emits `view / edit / delete / duplicate / toggleActive`; columns: code (mono), discount, type, valid period, redemptions, status badge, active switch, dropdown actions
  - `PromoCodeCreateDialog.vue` — create modal; auto-uppercased code, unique-code validation against store
  - `PromoCodeEditDialog.vue` — edit modal (same form shape as create)
  - `PromoCodeDetailDialog.vue` — view modal with all fields + "Used in" list (widgets referencing the code with per-widget redemption counts); footer: Delete / Duplicate / Edit
  - `PromoCodePicker.vue` — reusable multi-select for use in widgets: Popover with search + active-only toggle + Command checkbox list + "Done" footer + selected Badges below the trigger; `v-model:modelValue="string[]"`

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

- **Deferred (intentionally out of scope)**
  - **Website builder integration** — `source: 'website'` is reserved in `WidgetPromoCodeLink`; builder gets its own picker call site later
  - **Per-usage event ingestion** — `WidgetPromoCodeLink.usageCount` is scaffolded; no events wired up yet
  - **Per-listing scope** — codes are global; linking is at widget/site level
  - **Auto-expiration** — `validFrom` / `validUntil` stored, no background job. "Expired" filter computes at read time
  - **`/promo-codes/[id]` sub-page** — detail dialog covers current needs; per-code usage history page is a future addition

### Branding Settings Module (`app/components/settings/` + `app/composables/useTenantBranding.ts`)

Tenant-level mock branding at `/settings/branding`:
- Primary logo → dashboard sidebar + public Guest Guide; invoice fallback
- Favicon → dashboard + public Guest Guide browser tabs
- Invoice logo → invoice preview/future invoice renderers only
- Guest Guide colors → primary, background, and text; never change dashboard colors
- `useTenantBranding` persists `TenantBranding` to `elev8-tenant-branding-v1` in LocalStorage and syncs to `PUT /api/tenant-branding`
- Calling `useTenantBranding()` registers a client-only `onMounted` hook that hydrates LocalStorage and resyncs the mock server after dashboard startup.
- Public `GET /api/guest-guides/by-token/:token` includes top-level `branding`; guide-app applies scoped CSS variables
- Invoice renderer/PDF generation and real file storage remain out of scope

#### Data + Types (`app/components/settings/data/branding.ts`)
- `BrandingAsset` — `{ name, type, size, dataUrl }` (data URL only; no remote storage)
- `BrandingAssetKind = 'primaryLogo' | 'favicon' | 'invoiceLogo'`
- `GuestGuideBrandColors` — `{ primary, background, text }` (all 6-digit hex)
- `TenantBranding` — `{ primaryLogo, favicon, invoiceLogo, guestGuideColors, updatedAt }`
- `PublicGuestGuideBranding` — `{ primaryLogo, favicon, guestGuideColors, cssVariables }` (no `invoiceLogo`, adds scoped CSS variables)
- `BRANDING_STORAGE_KEY = 'elev8-tenant-branding-v1'` (LocalStorage key)
- `DEFAULT_GUEST_GUIDE_COLORS = { primary: '#F6BB12', background: '#FFFFFF', text: '#18181B' }`
- Helpers: `createDefaultTenantBranding`, `cloneTenantBranding`, `isHexColor`, `normalizeHex`, `isTenantBranding` (full runtime validator: MIME-type allowlist + 1MB/512KB size caps + hex validation), `resolveInvoiceLogo` (invoice → primary fallback), `getBrandingFaviconHref` (custom → `/favicon.ico` fallback)

#### Asset rules (`app/lib/branding-assets.ts`)
- `BRANDING_ASSET_RULES` — per-kind allowlist of MIME types, extensions, max sizes, and copy for inline errors
  - Primary logo / Invoice logo: PNG/JPEG/WebP up to 1 MB
  - Favicon: PNG/ICO up to 512 KB
- `validateBrandingFile(file, kind)` — returns the inline error message or `null`
- `fileToBrandingAsset(file, kind, decode?)` — validates, reads via FileReader → data URL, runs an image decode (`Image.onload`) to reject corrupted files, normalizes `.ico` MIME type when FileReader reports `application/octet-stream`
- `decodeImageDataUrl(dataUrl)` — pluggable image decoder (default uses `new Image()`)
- `formatBrandingFileSize(bytes)` — KB / MB human-readable

#### Color helpers (`app/lib/branding-colors.ts`)
- `hexToHslChannels(hex)` → `"H S% L%"` (Tailwind HSL channel format consumed by shadcn tokens)
- `contrastRatio(a, b)` — WCAG relative luminance ratio
- `getReadableForeground(background)` — picks `#000000` or `#FFFFFF` based on contrast (auto primary-foreground)
- `mixHex(fg, bg, weight)` — alpha-style blend used to derive muted/border variants
- `buildGuestGuideCssVariables(colors)` — returns the scoped Tailwind CSS variable map for `--primary`, `--primary-foreground`, `--background`, `--card`, `--foreground`, `--card-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`

#### Composable (`app/composables/useTenantBranding.ts`)
- `branding: Ref<TenantBranding>` — `useState('tenant-branding')` with `createDefaultTenantBranding` initial value
- `isHydrated: Ref<boolean>` — flips `true` after first `hydrateBranding()` call (SSR-safe gate)
- `lastSyncError: Ref<string | null>` — populated when `PUT /api/tenant-branding` fails
- `resolvedInvoiceLogo` — computed (`invoiceLogo ?? primaryLogo`)
- `faviconHref` — computed (`custom favicon ?? '/favicon.ico'`)
- `hydrateBranding()` — reads LocalStorage on mount, validates with `isTenantBranding`, replaces `branding.value`, and fires `syncGuestGuideBranding()`. Idempotent (`isHydrated` gate)
- `saveBranding(draft)` — validates, writes LocalStorage, replaces state, syncs server. Returns `{ saved, synced, error? }`
- `syncGuestGuideBranding()` — `PUT /api/tenant-branding` via `$fetch`; swallows errors into `lastSyncError`

#### Settings components
- **`BrandingAssetField.vue`** — Per-kind upload field with native file picker, MIME + size validation via `BRANDING_ASSET_RULES`, image decode check, inline error line, replace/remove buttons, size readout, and validation-change emit for the form's disabled state
- **`BrandingForm.vue`** — Settings page form: draft state (clone of `branding`), three color pickers with WCAG ratio warning when text vs. background falls below 4.5:1, three asset fields, live preview, Reset button (rebuilds draft from defaults), Save (calls `saveBranding` → toast `success` / `error` for sync failure). Reactive preview binds to `draft.value`, not saved `branding.value`
- **`BrandingPreview.vue`** — 3-tab preview (Dashboard / Guest Guide / Invoice). Renders a faux sidebar header with the primary logo + favicon tab mock, a Guest Guide card with scoped CSS variables, and an invoice preview that prefers `resolvedInvoiceLogo` (invoice → primary → none)

#### Page (`app/pages/settings/branding.vue`)
- Thin wrapper that mounts `<SettingsLayout wide>` and embeds `<SettingsBrandingForm />`. Reachable from Settings sidebar and top-level user menu (`constants/menus.ts`)

#### Dashboard integration
- **`SidebarNavHeader.vue`** — Renders `<img>` for `branding.primaryLogo.dataUrl` when present, otherwise the static Elev8 wordmark. Logo swaps reactively after Save
- **`app.vue`** — `useHead()` reactive favicon link bound to `faviconHref` (custom data URL or `/favicon.ico`). Hydration-safe via the `isHydrated` gate — LocalStorage hydration runs only in `onMounted`, so SSR renders the default `/favicon.ico`; client hydration swaps to the custom data URL post-mount

#### Server (`server/`)
- **`server/utils/tenant-branding-store.ts`** — In-process singleton (`currentBranding`) with `getTenantBranding()` / `setTenantBranding(value)` / `resetTenantBranding()`. Stores deep clones; no persistence layer
- **`server/api/tenant-branding/index.put.ts`** — `PUT /api/tenant-branding` validates the body with `isTenantBranding` (returns 400 on invalid payload) and writes via the store
- **`server/api/guest-guides/by-token/[token].get.ts`** — Existing public Guest Guide endpoint now also returns a top-level `branding` object (`primaryLogo`, `favicon`, `guestGuideColors`, `cssVariables`) sourced from `getTenantBranding()` and `buildGuestGuideCssVariables(...)`. `invoiceLogo` is never exposed publicly

#### Guide-app (`guide-app/app/`)
- **`guide-app/app/components/BrandHeader.vue`** — Card with property manager logo above the guide sections. Renders only when `branding.primaryLogo` is present; `data-testid="guest-guide-brand-header"` / `data-testid="guest-guide-brand-logo"` for tests
- **`guide-app/app/pages/[token].vue`** — Applies scoped CSS variables to the guide root via `:style="guideBrandStyle"` (consumed from `data.value.branding.cssVariables`). `useHead()` writes the favicon `<link rel="icon">` from the same branding payload. No color is applied to dashboard chrome
- **`guide-app/app/assets/css/main.css`** — Minimal additions to support the scoped CSS variables (no global overrides)

#### Out of scope (intentionally deferred)
- Real cloud storage / signed URLs — assets live entirely as base64 data URLs in LocalStorage + the server's in-memory store
- Multi-tenant server persistence — store is process-local; restarts reset to defaults
- Invoice renderer / PDF generation — only the `BrandingPreview` invoice tab exists; nothing renders a real invoice
- Website Builder branding reuse — only the dashboard and Guest Guide are wired today

### Auth (`app/components/auth/`)
- **SignIn.vue**, **SignUp.vue**, **OTPForm.vue**, **OTPForm1.vue**, **OTPForm2.vue**, **ForgotPassword.vue**
- Layout: `app/components/layout/Auth.vue`

### Mail (`app/components/mail/`)
- **Layout.vue**, **List.vue**, **Display.vue**, **Nav.vue**, **AccountSwitcher.vue**
- Mock data: `app/components/mail/data/mails.ts`

---

## 🎨 UI Patterns

### Toast Notifications
- Uses `vue-sonner` (already configured in `app.vue`)
- Call `toast.success("Message saved")` / `toast.info("New message")` for user action feedback

### Unread Badges
- `Badge` component with `variant="default"` showing count
- Applied on: sidebar Inbox link, per-conversation in list

### AI Assistant Panel Color Tokens

The AI Assistant slide-over panel uses **primary color** (same as primary buttons), not ElevAI gold. Gold remains reserved for inline ElevAI brand elements (HostBuddy suggestion chip, etc.). See `docs/superpowers/specs/2026-07-10-elev8-ai-assistant-design.md`.

### AI-Written Messages
- `aiWritten: true` on host messages → shows:
  - "ElevAI" as sender name
  - Sparkle avatar
  - "AI" label instead of user name

### Action Needed Status
- Only `action_needed` or `null` (NO `needs_reply`, `waiting_on_guest`, `done`)
- Badge shown ONLY when `status === 'action_needed'` (destructive variant)

### reka-ui Form Controls (Switch / Checkbox) ⚠️

- **`Switch` and `Checkbox` use `model-value` / `@update:model-value`** — NOT `checked` / `@update:checked`. Using `:checked`/`@update:checked` silently does nothing (toggle appears dead).
  ```vue
  <Switch :model-value="isOn" @update:model-value="(v) => isOn = v" />
  ```
- **Never wrap a reka-ui `Checkbox` in a `<label>`** — the label re-dispatches the click to the underlying button, causing a double-toggle (net no change). For clickable rows, use a `div @click` with a custom checkbox visual instead (the Listings page tag-filter pattern):
  ```vue
  <div class="flex items-center gap-2 cursor-pointer" @click="toggle(item)">
    <div class="flex size-4 items-center justify-center rounded-[4px] border"
         :class="selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
      <Icon v-if="selected" name="lucide:check" class="size-3" />
    </div>
  
    <span>
  {{ item }}
  </span>
  </div>
  ```
- **Tag/multi-select filter pattern** (match Listings index): Popover + inner search `Input` + `ScrollArea` of custom-checkbox rows + "Clear all" footer. Selected items use AND logic (`every`), not OR.

### Scrollable Flex Children (⚠️ min-h-0 rule)

When a flex child should scroll (e.g. `<ScrollArea>` inside `flex flex-col h-full`), you **must** add `min-h-0`. Flex children have an implicit `min-height: auto`, which prevents them from shrinking below their content size — so the scroll never kicks in and the parent grows instead.

```vue
<!-- ✅ Works — scrolls when content overflows -->
<div class="flex flex-col h-full">
  <div class="flex-shrink-0">header</div>
  <ScrollArea class="flex-1 min-h-0">
    ...long content...
  </ScrollArea>
</div>

<!-- ❌ Bug — content overflows the panel, no scroll -->
<ScrollArea class="flex-1">...</ScrollArea>
```

The same `min-h-0` is needed on any flex child that should be allowed to shrink (e.g. the body of `ListingSetupResourcePanel` after many documents are uploaded). The Listings Setup Resource Panel previously had this bug — `flex-1` without `min-h-0` — so uploading 20 documents made the panel unable to scroll.

### Date Range Picker
- `app/components/base/DateRangePicker.vue`
- Used for filtering reservations by date range

### Search
- `app/components/Search.vue` — Global search component
- `app/components/PasswordInput.vue` — Password input with visibility toggle

---

## 🧩 Component Selection Hierarchy

When building UI, ALWAYS select components in this order:

### 1. shadcn-vue Components (atoms/primitives)
Located in `app/components/ui/` — **CHECK HERE FIRST**.

Most commonly used:
- **Basic**: `Button`, `Input`, `Label`, `Badge`, `Textarea`
- **Overlay**: `Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `AlertDialog`, `Drawer`, `HoverCard`, `Tooltip`, `ContextMenu`, `Command`, `Menubar`, `NavigationMenu`
- **Forms**: `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `Calendar`, `DatePicker`, `RangeCalendar`, `PinInput`, `NumberField`, `TagsInput`, `Combobox`
- **Data Display**: `Table`, `DataTable`, `Tabs`, `Accordion`, `Collapsible`, `Separator`, `ScrollArea`, `AspectRatio`, `Resizable`, `Progress`, `Skeleton`, `Stepper`, `Toggle`, `ToggleGroup`, `Avatar`, `Breadcrumb`, `Card`, `Carousel`, `Kbd`, `Pagination`
- **Feedback**: `Alert`, `Sonner` (toast), `Toast`
- **Layout**: `Sidebar` (from `layout/AppSidebar.vue` wrapper)

> ⚠️ **Never duplicate shadcn components**. Customize via:
> - Props (`variant`, `size`, `class`)
> - Slots (override content)
> - `cn()` utility for class merging

### 2. Custom Base Components
- `app/components/base/BreadcrumbCustom.vue`
- `app/components/base/DateRangePicker.vue`
- `app/components/Search.vue`
- `app/components/PasswordInput.vue`
- `app/components/AppSettings.vue`
- `app/components/DarkToggle.vue`
- `app/components/ThemeCustomize.vue`

### 3. Module-Specific Components
- **AI Assistant**: `ElevAIButton` (header trigger), `ElevAIPanel` (slide-over shell), `assistant/ElevAIAssistant` (chat root), `assistant/ElevAIConversation`, `assistant/ElevAIMessage`, `assistant/ElevAIResponse`, `assistant/ElevAIToolBadge`, `assistant/ElevAILoader`, `assistant/ElevAIEmptyState`, `assistant/ElevAISuggestionChip`
- **Inbox**: `inbox/Layout`, `inbox/List`, `inbox/Thread`, `inbox/ReplyBox`, `inbox/Nav`, `inbox/ActionCard`, etc.
- **Layout**: `layout/AppSidebar`, `layout/Header`, `layout/HeaderUserMenu`, `layout/Auth`
- **Auth**: `auth/SignIn`, `auth/SignUp`, `auth/OTPForm`
- **Tasks**: `tasks/components/DataTable` (complex TanStack table wrapper)
- **Kanban**: `kanban/KanbanBoard`
- **Settings**: `settings/Layout`, `settings/AccountForm`, etc.
- **Mail**: `mail/Layout`, `mail/List`, `mail/Display`

### 4. Build New (Last Resort)
Only when no existing component fits. Place in appropriate folder:
- `components/atoms/` — single element (future)
- `components/molecules/` — combination of atoms (future)
- `components/organisms/` — complex sections (future)
- Or alongside existing module: `components/<module>/NewComponent.vue`

---

## 🧱 shadcn-vue Usage Patterns

### Button Variants
```vue
<!-- Primary action -->
<Button>
Save
</Button>

<!-- Destructive action -->
<Button variant="destructive">
Delete
</Button>

<!-- Secondary / Cancel -->
<Button variant="outline">
Cancel
</Button>

<!-- Ghost / Icon only -->
<Button variant="ghost" size="icon">
<Icon />
</Button>

<!-- Link style -->
<Button variant="link">
Learn more
</Button>

<!-- With loading state -->
<Button :disabled="isLoading">
  <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
  Submit
</Button>
```

### Dialog Pattern
```vue
<Dialog v-model:open="isOpen">
  <DialogTrigger as-child>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Description of what this dialog does.</DialogDescription>
    </DialogHeader>
    <!-- Body content -->
    <DialogFooter>
      <Button variant="outline" @click="isOpen = false">Cancel</Button>
      <Button @click="handleConfirm">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Form Pattern (vee-validate + zod)
```vue
<script setup>
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'

const formSchema = toTypedSchema(z.object({
  username: z.string().min(2).max(50),
}))

function onSubmit(values) {
  console.log('Form submitted!', values)
}
</script>

<template>
  <Form v-slot="{ handleSubmit }" :validation-schema="formSchema">
    <form @submit="handleSubmit($event, onSubmit)">
      <FormField v-slot="{ componentField }" name="username">
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input type="text" placeholder="shadcn" v-bind="componentField" />
          </FormControl>
          <FormDescription>This is your public display name.</FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>
      <Button type="submit">
        Submit
      </Button>
    </form>
  </Form>
</template>
```

### Sheet (Slide-over) Pattern
```vue
<Sheet>
  <SheetTrigger as-child>
    <Button variant="outline">Open Sheet</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Edit profile</SheetTitle>
      <SheetDescription>Make changes to your profile here.</SheetDescription>
    </SheetHeader>
    <!-- Content -->
    <SheetFooter>
      <SheetClose as-child>
        <Button type="submit">Save changes</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### DataTable (TanStack)
```vue
<script setup>
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'

const table = useVueTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
})
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
          <TableHead v-for="header in headerGroup.headers" :key="header.id">
            <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="row in table.getRowModel().rows" :key="row.id">
          <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
            <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
```

---

## 🎨 Tailwind & Styling Rules

- **NO arbitrary colors** → use CSS variables: `bg-primary`, `text-destructive-foreground`, `bg-muted`, `text-muted-foreground`
- **ElevAI gold ONLY**: `bg-[#C8A84B]` for ElevAI branding; `bg-warning` for host chat bubbles and toggle
- **Responsive** → mobile-first (`md:`, `lg:`, `xl:`)
- **Spacing** → Tailwind scale: `p-4`, `gap-2`, `mb-6`, `space-y-4`
- **Dark mode** → handled automatically via `.dark` class + CSS variables in `app/assets/css/themes.css`
- **Merge classes** → always use `cn()` from `@/lib/utils`
- **No hardcoded colors** except ElevAI gold

### Common Utility Patterns
```vue
<!-- Container -->
<div class="flex flex-col gap-4 p-6">

<!-- Card-like container -->
<div class="rounded-lg border bg-card text-card-foreground shadow-sm">

<!-- Flex center -->
<div class="flex items-center justify-center">

<!-- Text hierarchy -->
<h2 class="text-2xl font-bold tracking-tight">Title</h2>
<p class="text-sm text-muted-foreground">Description</p>
```

---

## 🔌 Composables Reference

| Composable | File | Usage | Key Exports |
|-----------|------|-------|-------------|
| `useInbox` | `app/composables/useInbox.ts` | Inbox module state | `conversations`, filters, `autoTranslate`, `mockTranslate()`, `markAsHandled()`, `assignTo()`, `toggleListingFilter()`, `clearTagFilters()`, `getPhoneCalls()` |
| `useNotifications` | `app/composables/useNotifications.ts` | Notification Center | `alerts`, `unreadCount`, `filteredAlerts`, `markAsRead()`, `markAllAsRead()`, `dismiss()`, `navigateToAlert()` |
| `useKanban` | `app/composables/useKanban.ts` | Kanban board state | columns, cards, drag handlers |
| `useAppSettings` | `app/composables/useAppSettings.ts` | Theme/settings | dark mode, sidebar state, settings preferences |
| `useShortcuts` | `app/composables/useShortcuts.ts` | Keyboard shortcuts | `defineShortcuts` wrapper |
| `useListingMappings` | `app/composables/useListingMappings.ts` | Per-listing integration mapping (tag-based) | `getMappingFor()`, `setMapping(name, integration, tag)`, `hasAnyMapping`, `mappedByIntegration` |
| `useIntegrationAccounts` | `app/composables/useIntegrationAccounts.ts` | Per-integration default accounts (double-entry) | `getDefaults()`, `setBookingRevenueLine()`, `setUpsellRevenueLine()`, `setCostsLine()`, `setCityTax()`, `mappingTabs` |
| `useJurnal` | `app/composables/useJurnal.ts` | Jurnal integration state | `isConnected`, `exchangeRate`, `convertToAccounting()`, `formatAccounting()` |
| `useBexio` | `app/composables/useBexio.ts` | Bexio integration state | `isConnected`, `connect()`, `disconnect()`, `localSelections` |
| `useActiveIntegration` | `app/composables/useActiveIntegration.ts` | Per-listing accounting amount resolution | `showConvertedColumn`, `getAccountingAmount()`, `getCostAccountingAmount()` |
| `useCosts` | `app/composables/useCosts.ts` | Costs tab state + filters | `costs`, `filteredCosts`, all `filter*` refs, `markSynced()`, `clearFilters()` |
| `useReservations` | `app/composables/useReservations.ts` | Reservations state | `reservations`, `pushReservations()`, `pushSelected()`, `isPushingSelected` |
| `useUpsells` | `app/composables/useUpsells.ts` | Upsells (Finance) state | `upsells`, `pushUpsells()`, `isPushingUpsells` |
| `useUpsellServices` | `app/composables/useUpsellServices.ts` | Upsells Catalog state + CRUD | `services`, filters, `addService()`, `updateService()`, `deleteService()` |
| `useUpsellOrders` | `app/composables/useUpsellOrders.ts` | Upsell Orders state + CRUD | `orders`, `filteredOrders`, `statusCounts`, `totalRevenue`, `updateStatus()`, `addOrder()`, `cancelOrder()` |
| `useUpsellNotifications` | `app/composables/useUpsellNotifications.ts` | Upsell Notifications state | `notifications`, `unreadCount`, `createNotification()`, `markAsRead()` |
| `useAirbnbReviews` | `app/composables/useAirbnbReviews.ts` | Airbnb Review Automation state | `reviews`, `config`, `filteredReviews`, `stats`, `approveReview()`, `saveDraft()`, `generateReview()`, `regenerateReview()`, `retryFailed()`. Config persisted to localStorage. |
| `useWhatsApp` | `app/composables/useWhatsApp.ts` | WhatsApp connection state | `whatsappAccounts`, `isConnected`, `validateAndConnect(token, wabaId, phoneId, accountName)`, `addAccount()`, `removeAccount()`, `assignListings()`, `bulkAssign()`, `disconnect()`. Persisted to localStorage. |
| `useWhatsAppRules` | `app/composables/useWhatsAppRules.ts` | Routing rules CRUD | `rules`, `saveRule()`, `deleteRule()`, `toggleRule()` |
| `useWhatsAppTemplates` | `app/composables/useWhatsAppTemplates.ts` | Template messages | `waTemplates`, `renderTemplate()` |
| `useSmartLock` | `app/composables/useSmartLock.ts` | Smart lock connection + per-listing/room lock assignment + brand-shared access codes | `connection`, `isConnected`, `locks`, `codes`, `validateAndConnect(apiKey, workspaceName)`, `disconnect()`, `pairLock`, `unpairLock`, `setMainLock`, `renameLock`, `swapDevice(lockId, newProviderDeviceId)`, `generateAccessCode` (async, 700ms mock), `revokeAccessCode`, `findActiveBrandCode(reservationId, provider)`, `getLocksForListing`, `getLocksForUnit`, `getLockCount`, `getMainLock`, `syncDevices`, `emitMockAlerts`. Persisted to localStorage. |
| `useMinut` | `app/composables/useMinut.ts` | Minut noise/sensor monitoring — events feed Journeys | `connection`, `devices`, `events`, `isConnected`, `validateAndConnect(apiKey, workspaceName)`, `disconnect()`, `seedDevices()`, `syncDevices()`, `emitMockEvents()`, `getEventsByListing(listingId)`, `getEventsByType(type)`. Persisted to localStorage. |
| `useTenantBranding` | `app/composables/useTenantBranding.ts` | Tenant logo/favicon/Guest Guide color state | `branding`, `isHydrated`, `lastSyncError`, `resolvedInvoiceLogo`, `faviconHref`, `createDefaultBrandingDraft`, `hydrateBranding()`, `saveBranding()`, `syncGuestGuideBranding()`. Persisted to LocalStorage. |

### State Management Rules
- **Inbox conversations**: `useState<Conversation[]>()` — reactive, persists per request
- **Mutations**: ALWAYS use spread syntax:
  ```ts
  conversations.value = conversations.value.map(
    c => c.id === id ? { ...c, status: null, unreadCount: 0 } : c
  )
  ```
- **Filters**: Computed from reactive state (multi-select arrays)
- **Avoid direct mutation**: ❌ `conv.status = null` → ✅ spread replace

---

## 🖼️ Icon Rules

- **Default**: `lucide:` prefix via `lucide-vue-next`
  ```vue
  <Icon icon="lucide:user-check" />
  ```
- **OTA logos**: `logos:airbnb`, `simple-icons:bookingdotcom`
- **Custom icons**: Add to `app/components/ui/icon/` if needed

---

## 📁 File Structure Reference

```
app/
├── app.config.ts              # App config (shadcn-vue)
├── app.vue                    # Root app with Sonner/Toaster
├── assets/
│   └── css/
│       ├── tailwind.css       # Tailwind entry
│       └── themes.css         # Theme tokens (light/dark)
├── components/
│   ├── ui/                    ← shadcn-vue components (338 files)
│   ├── AppSettings.vue
│   ├── airbnb-reviews/           ← Airbnb Review Automation
│   │   ├── PreviewDialog.vue        # Editable preview with ratings, text, regenerate
│   │   └── data/
│   │       └── reviews.ts           # Types, mock data, config
│   ├── DarkToggle.vue
│   ├── PasswordInput.vue
│   ├── Search.vue
│   ├── ThemeCustomize.vue
│   ├── auth/
│   │   ├── ForgotPassword.vue
│   │   ├── OTPForm.vue
│   │   ├── OTPForm1.vue
│   │   ├── OTPForm2.vue
│   │   ├── SignIn.vue
│   │   └── SignUp.vue
│   ├── base/
│   │   ├── BreadcrumbCustom.vue
│   │   └── DateRangePicker.vue
│   ├── dashboard/
│   │   └── TotalVisitors.vue
│   ├── listings/
│   │   ├── data/
│   │   │   └── listings.ts        ← Listing type (unitType, stats, pricing, bookings, reviews, maintenance, resources), AiSchedule, Unit, UnitType (with aiStatus), RatePlan, RatePlanOffering, LengthOfStayDiscount, Fee, ListingResources, FieldConfig, ReservationStage, ref<Listing[]>, allTags/allLocations/allProperties/allOtas
│   │   ├── ListingHeroCompact.vue ← Compact hero: photo manager, unit switcher, editable name+tags, AI schedule Sheet, accepts openSchedule prop
│   │   ├── ListingOverviewTab.vue ← Stats cards + upcoming bookings + recent reviews
│   │   ├── ListingPricingTab.vue  ← Base pricing, discounts, seasonal rates
│   │   ├── ListingCalendarTab.vue ← Bookings list + blocked dates
│   │   ├── ListingReviewsTab.vue  ← Rating summary + filter + reviews with host reply
│   │   ├── ListingMaintenanceTab.vue ← Cleaning schedule + tasks + add-task dialog
│   │   ├── ListingSettingsTab.vue ← Property details form + amenities + distribution channels
│   │   ├── ListingFloatingMenu.vue ← Fixed floating pill bar (Listing Setup / Test AI / AI Schedule)
│   │   ├── ListingSetupOverlay.vue ← Full-screen overlay shell (Property/Rooms tabs + two-panel)
│   │   ├── ListingSetupFieldPanel.vue ← Left panel: 6 tabs + pencil config icons per field
│   │   ├── ListingSetupResourcePanel.vue ← Right panel: documents (incl. AI Generate) + Elev8 AI + auto-fill + copy
│   │   ├── LockRow.vue            ← Reusable per-lock row: brand pill, name (inline rename), battery, Unlock/Swap/Unpair actions
│   │   ├── RoomsPanel.vue         ← Rooms tab: sidebar of rooms grouped by type + room editor (reuses FieldPanel)
│   │   ├── UnitTypeManager.vue    ← Room type card with Details + Pricing tabs (multi-rate-plan supported)
│   │   ├── FieldConfigDialog.vue  ← Per-field: reservation stages + copy to properties
│   │   ├── ListingTestAIDialog.vue ← Guest chat simulation
│   │   ├── ListingAiStatusCell.vue ← AI Status table cell; aggregates from unitTypes for multi-unit
│   │   ├── ListingOtaCell.vue     ← OTA logos table cell
│   │   ├── ListingExpandRow.vue   ← Multi-unit expand panel: per-unit-type AI toggle + per-unit Switch
│   │   ├── ListingSingleToggle.vue ← Per-row status Switch (single + multi-unit logic)
│   │   └── ListingRowActions.vue  ← Dropdown menu (View Detail, Deactivate, Toggle AI)
│   ├── finance/
│   │   ├── BexioIntegration.vue  ← Bexio mapping UI, locks Jurnal-mapped listings
│   │   ├── CostDetailDrawer.vue  ← Shows linked material/task entries in drawer
│   │   ├── CostFilters.vue       ← Includes integration filter select
│   │   ├── CostTable.vue         ← Multi-currency, Acctg. Amount col, integration badge
│   │   ├── CostsTab.vue
│   │   ├── IntegrationsTab.vue
│   │   ├── JurnalIntegration.vue ← Locks Bexio-mapped listings
│   │   ├── OverviewTab.vue
│   │   ├── ReservationsTab.vue   ← Smart push label, integration filter, Acctg. Amount
│   │   ├── RevenueTab.vue        ← Sub-tabs wrapper (Reservations + Upsell)
│   │   ├── UpsellDetailDrawer.vue ← Guest avatar, type badge, sync info, invoice download
│   │   ├── UpsellTab.vue         ← Always Paid, integration filter, Acctg. Amount, detail drawer
│   │   └── data/
│   │       ├── bexio.ts          ← Bexio listing data (Swiss properties)
│   │       ├── costs.ts          ← CostEntry interface (linkedTaskId), mockCosts (IDR + CHF)
│   │       ├── integrations.ts
│   │       ├── jurnal.ts
│   │       ├── overview.ts
│   │       ├── revenue.ts        ← ReservationEntry, ReservationStatus, recentReservations
│   │       └── upsells.ts        ← UpsellEntry (no status), mockUpsells
│   ├── inbox/
│   │   ├── ActionCard.vue
│   │   ├── GuestSentiment.vue
│   │   ├── HostbuddySuggestion.vue
│   │   ├── Layout.vue
│   │   ├── List.vue
│   │   ├── ListItem.vue
│   │   ├── Nav.vue
│   │   ├── ReplyBox.vue            ← Upsell button next to channel dropdown
│   │   ├── ReservationActivity.vue
│   │   ├── ReservationGuest.vue
│   │   ├── ReservationListing.vue
│   │   ├── ReservationPanel.vue    ← Upsell + Smart Lock tabs
│   │   ├── ReservationSmartLocks.vue ← Smart Lock tab: paired locks, active codes, generate/copy/revoke
│   │   ├── ReservationSummary.vue
│   │   ├── ReservationTasks.vue
│   │   ├── ReservationUpsells.vue  ← Linked upsell orders from conversation
│   │   ├── Thread.vue              ← Phone tab + UpsellOfferCard in messages
│   │   ├── UpsellOfferCard.vue     ← Upsell offer UI in chat (status, pricing, actions)
│   │   ├── UpsellOrderCreator.vue  ← Mini drawer for creating orders from chat
│   │   ├── WhatsAppSendModal.vue   ← Template picker + live preview (window-expired fallback)
│   │   └── data/
│   │       └── conversations.ts    ← UpsellOffer type, linkedUpsellOrderIds, conv-21
│   ├── notifications/          ← Notification Center (new)
│   │   ├── NotificationCenter.vue
│   │   ├── NotificationItem.vue
│   │   └── data/
│   │       └── alerts.ts       ← Alert types + mock data
│   ├── upsells/
│   │   ├── data/
│   │   │   ├── upsell-services.ts  ← UpsellItem (desc/image), UpsellService (availability)
│   │   │   ├── upsell-orders.ts    ← UpsellOrder (serviceDate, source, cancellation)
│   │   │   ├── upsell-notifications.ts ← 7 notification types + templates
│   │   │   └── cancellation-policies.ts ← Per-service refund calculator
│   │   ├── UpsellFilterBar.vue
│   │   ├── UpsellTable.vue
│   │   ├── UpsellDrawer.vue        ← 2-tab: Details + Items (modal + drag-sort)
│   │   ├── UpsellOrderTable.vue
│   │   ├── UpsellOrderDrawer.vue   ← Order detail with cancel + notification log
│   │   ├── UpsellNotificationList.vue
│   │   └── UpsellCancelModal.vue
│   ├── kanban/
│   │   └── KanbanBoard.vue
│   ├── layout/
│   │   ├── AppSidebar.vue
│   │   ├── Auth.vue
│   │   ├── Header.vue
│   │   ├── HeaderUserMenu.vue
│   │   ├── LanguageSelector.vue    ← Mockup language switcher (circle-flags)
│   │   ├── SidebarNavFooter.vue
│   │   ├── SidebarNavGroup.vue
│   │   ├── SidebarNavHeader.vue
│   │   └── SidebarNavLink.vue
│   ├── mail/
│   │   ├── AccountSwitcher.vue
│   │   ├── Display.vue
│   │   ├── Layout.vue
│   │   ├── List.vue
│   │   ├── Nav.vue
│   │   └── data/
│   │       └── mails.ts
│   ├── navigation-menu/
│   │   └── DemoItem.vue
│   ├── settings/
│   │   ├── AccountForm.vue
│   │   ├── AppearanceForm.vue
│   │   ├── DisplayForm.vue
│   │   ├── Layout.vue
│   │   ├── NotificationsForm.vue
│   │   ├── ProfileForm.vue
│   │   ├── SidebarNav.vue
│   │   ├── BrandingAssetField.vue     ← Branding settings: per-kind upload field (logo/favicon/invoice)
│   │   ├── BrandingForm.vue           ← Branding settings: form + draft preview + Reset/Save
│   │   ├── BrandingPreview.vue        ← Branding settings: 3-tab live preview (Dashboard/Guide/Invoice)
│   │   ├── data/branding.ts           ← TenantBranding, BrandingAsset, GuestGuideBrandColors, validators, defaults
│   │   ├── WhatsAppIntegration.vue  ← Connection card (disconnected/connected states)
│   │   ├── WhatsAppRoutingRules.vue ← Routing rules (not currently used in UI)
│   │   ├── ThreeCxIntegration.vue   ← 3CX PBX connection + extension mapping
│   │   ├── SmartLockIntegration.vue ← Smart lock connection + webhook URL + device preview
│   │   ├── MinutIntegration.vue      ← Minut noise/sensor connection + sync + 6 mock devices
│   │   ├── SettingsIntegrationsOverview.vue ← Integrations hub tile grid (WhatsApp / 3CX / Smart Lock / Payout / Minut)
│   │   ├── PayoutGatewayPanel.vue   ← Payout gateway configuration
│   │   └── AirbnbReviewConfig.vue   ← Review automation settings (language, tone, auto-post)
│   └── tasks/
│       ├── components/
│       │   ├── columns.ts
│       │   ├── DataTable.vue
│       │   ├── DataTableColumnHeader.vue
│       │   ├── DataTableFacetedFilter.vue
│       │   ├── DataTablePagination.vue
│       │   ├── DataTableRowActions.vue
│       │   ├── DataTableToolbar.vue
│       │   └── DataTableViewOptions.vue
│       └── data/
│           ├── data.ts
│           └── schema.ts
├── composables/
│   ├── defineShortcuts.ts
│   ├── useActiveIntegration.ts  ← showConvertedColumn, getAccountingAmount, getCostAccountingAmount
│   ├── useAppSettings.ts
│   ├── useBexio.ts              ← Bexio connection + CHF accounting
│   ├── useCosts.ts              ← Costs filters, markSynced, totalThisMonth
│   ├── useInbox.ts
│   ├── useJurnal.ts             ← Jurnal connection + IDR accounting + push actions
│   ├── useKanban.ts
│   ├── useListingMappings.ts    ← Per-listing integration mapping (shared useState)
│   ├── useNotifications.ts      ← Notification Center state
│   ├── useReservations.ts       ← pushReservations(), pushSelected(), isPushingSelected
│   ├── useShortcuts.ts
│   ├── useUpsells.ts
│   ├── useUpsellServices.ts       ← Catalog CRUD
│   ├── useUpsellOrders.ts         ← Orders CRUD + cancelOrder()
│   ├── useUpsellNotifications.ts  ← Notification state + createNotification()
│   ├── useAirbnbReviews.ts        ← Airbnb Review state + config + generation
│   ├── useWhatsApp.ts             ← WhatsApp connection state (connect/disconnect)
│   ├── useWhatsAppRules.ts        ← Routing rules CRUD
│   ├── useWhatsAppTemplates.ts    ← Template messages (booking_confirmation, etc.)
│   ├── useSmartLock.ts            ← Smart lock connection + per-listing/room lock assignment + access codes
│   ├── useMinut.ts                ← Minut noise/sensor connection + 6 mock devices + event generation (LocalStorage)
│   ├── useTenantBranding.ts       ← Tenant logo/favicon/Guest Guide color state (LocalStorage + sync API)
├── layouts/
│   ├── blank.vue              # Auth pages
│   └── default.vue            # Main app layout
├── lib/
│   ├── branding-assets.ts       # Per-kind asset rules, validation, FileReader → data URL + image decode
│   ├── branding-colors.ts       # Hex↔HSL, WCAG contrast, readable foreground, scoped CSS variables builder
│   └── utils.ts               # cn(), formatDate(), etc.
└── pages/
    ├── (auth)/
    │   ├── forgot-password.vue
    │   ├── login-basic.vue
    │   ├── login.vue
    │   ├── otp-1.vue
    │   ├── otp-2.vue
    │   ├── otp.vue
    │   └── register.vue
    ├── (error)/
    │   ├── 401.vue
    │   ├── 403.vue
    │   ├── 404.vue
    │   ├── 500.vue
    │   └── 503.vue
    ├── changelog.vue
    ├── components/            # Component demo pages
    │   ├── accordion.vue
    │   ├── alert-dialog.vue
    │   ├── alert.vue
    │   ├── ... (all shadcn demos)
    │   └── tooltip.vue
    ├── email.vue
    ├── finance/
    │   └── index.vue           # Finance page (Overview/Revenue/Costs/Integrations tabs)
    ├── inbox.vue
    ├── index.vue               # Dashboard home
    ├── kanban.vue
    ├── listings/
    │   ├── index.vue           # Listings table (TanStack Table + search/tag/AI filters)
    │   └── [id].vue            # Listing detail page (HeroCompact + Overview/Pricing/Calendar/Reviews/Maintenance/Settings tabs)
    ├── reviews.vue             # Airbnb Reviews dashboard (queue, filters, generate/preview/edit)
    ├── settings/
    │   ├── account.vue
    │   ├── appearance.vue
    │   ├── display.vue
    │   ├── integrations.vue        ← WhatsApp connection + Airbnb review automation settings
    │   ├── notifications.vue
    │   ├── profile.vue
    │   └── branding.vue            ← Tenant branding settings page (wraps BrandingForm)
    └── tasks.vue
```

### Guide app (`guide-app/`) + server (`server/`) — branding surface

```
guide-app/
└── app/
    ├── assets/css/main.css                 ← Minimal additions for scoped CSS variables
    ├── components/
    │   └── BrandHeader.vue                 ← Renders primaryLogo at the top of public guides
    └── pages/
        └── [token].vue                     ← Applies scoped CSS variables + reactive favicon from branding

server/
├── api/
│   ├── tenant-branding/
│   │   └── index.put.ts                    ← PUT /api/tenant-branding (validates + writes in-memory store)
│   └── guest-guides/by-token/
│       └── [token].get.ts                  ← Adds top-level `branding` payload (logo, favicon, colors, cssVariables)
└── utils/
    └── tenant-branding-store.ts            ← In-process singleton (getTenantBranding / setTenantBranding / reset)
```

---

## 🚫 Anti-Patterns

- ❌ **Clone HTML** from existing component → **import & compose**
- ❌ Use `<a>` for internal navigation → **use `<NuxtLink>` or `<NuxtLinkLocale>`**
- ❌ Hardcode colors → **use theme tokens** (`bg-primary`, `text-muted-foreground`)
- ❌ Import shadcn components from elsewhere → **use `@/components/ui/`**
- ❌ Mutate state directly (`conv.status = null`) → **use spread syntax for reactivity**
- ❌ Create new component when shadcn exists → **customize existing via props/slots**
- ❌ Use raw HTML for layouts → **compose with existing molecules/organisms**
- ❌ Forget aria-labels on icon-only buttons → **always add accessible labels**
- ❌ Use `:checked`/`@update:checked` on `Switch`/`Checkbox` → **use `model-value`/`@update:model-value`**
- ❌ Wrap reka-ui `Checkbox` in `<label>` → **double-toggle bug; use `div @click` + custom checkbox visual**

---

## 🐛 Debugging Tips

- **Adoption report mismatch?** → Check `codebase-index.json` freshness; regenerate via script
- **Component marked unused but you know it's used?** → Verify imports use full path (not stem collision)
- **Reactivity issue?** → Check spread syntax in mutations; avoid direct property assignment
- **Icon shows wrong glyph (e.g. AI Status column renders OTA logo) and only fixes after an interaction?** → SSR hydration mismatch in a TanStack table — adjacent icon columns reuse each other's DOM nodes. Wrap the table in `<ClientOnly>` (see `listings/index.vue`). Per-cell `key`s and svg mode alone don't fix hydration-level reuse.
- **Style not applying?** → Check `cn()` merge order; ensure dark mode class is set
- **shadcn component not working?** → Check `app.config.ts` for component registration; verify import path
- **Build errors?** → Check `components.json` for shadcn-vue config; verify `lib/utils.ts` exports

---

## 🔄 Regeneration Instructions

> **Note:** The repository contains no `codebase-index.json` or `component-metadata/` artifacts and no scanner script that produces them. Steps 1–2 below are dormant documentation kept for historical context — they describe a workflow that has not been wired up in this repo. Update this section if a scanner is reintroduced.

When adding/removing major components or refactoring structure:

1. ~~Run codebase scanner to update `codebase-index.json`~~ (dormant — no scanner in repo)
2. ~~Update `component-metadata/` for new components~~ (dormant — no metadata in repo)
3. Add new composables to Composables Reference
4. Update File Structure if folders change
5. Check Anti-Patterns — any new ones discovered?

---

*Generated from AGENTS.md + codebase scan. Keep updated as project evolves.*
