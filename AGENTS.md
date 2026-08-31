# AGENTS.md

This file provides context for AI agents working on this project.

## Project Overview

**Elev8** — A web dashboard for property management (Bali vacation rentals). Built with **Nuxt 3**, **Vue 3**, **shadcn-vue**, and **Tailwind CSS**.

## Key Documentation

- **Inbox Module Changelog** → [`docs/superpowers/changelogs/2025-04-25-inbox-module.md`](docs/superpowers/changelogs/2025-04-25-inbox-module.md)
  - Full history of all changes, types, component structure, composables, and mock data for the 4-panel guest messaging inbox
- **Inbox Quick Reference** → [`docs/superpowers/changelogs/2025-04-25-inbox-quick-ref.md`](docs/superpowers/changelogs/2025-04-25-inbox-quick-ref.md)
  - Condensed reference: files, features, types, staff members, deviations from spec

## Architecture Quick Reference

### Listing Module (`app/components/listings/`)

- **Data + types**: `app/components/listings/data/listings.ts`
  - `Listing` type with `unitTypes?: UnitType[]` (Property → Unit Type → Unit hierarchy)
  - `UnitType` — `quantity`, `maxAdults/maxChildren/maxInfants`, `bedrooms/bathrooms`, `beds: Bed[]`, `photos[]`, `pricing: UnitTypePricing`
  - `Unit` — `name`, `identifier`, `status`, `aiStatus`, `otaConnected` (no per-unit capacity)
  - `UnitTypePricing` — `currency`, `ratePlans: RatePlan[]`, `offerings: RatePlanOffering[]`, `lengthOfStayDiscounts[]`, `fees: Fee[]`
  - `RatePlan` — Channex-style: `name`/`title`, `sellMode` (`per_room`/`per_person`), `rateMode` (`manual`/`derived`/`auto`/`cascade`), `currency`, `childrenFee`/`infantFee`, 7-day arrays `maxStay`/`minStayArrival`/`minStayThrough`/`closedToArrival`/`closedToDeparture`/`stopSell`, `options: RatePlanOption[]` (`occupancy`, `isPrimary`, `derivedOption`, `rate`), `parentRatePlanId`, `inherit*` flags, `autoRateSettings`, `mealType`, `taxSetId?`, `isBase`. Helpers: `createRatePlan()`, `ratePlanNightlyRate()`, `ratePlanMaxOccupancy()` (no more `pricePerNight`/`pricePerAdditionalGuest`)
  - `Fee` — `type: 'cleaning' | 'early_checkin' | 'late_checkout'`, `enabled`, `amount`
  - Helper exports: `getUnits()`, `getUnitTypes()`, `getUnitById()`, `getUnitTypeForUnit()`
  - Reactive: `listings` uses `ref<Listing[]>` — mutations use `listings.value[index] = updated`
  - Mock data: 19 listings with Unsplash photos

- **Page**: `app/pages/listings/[id].vue`
  - 6-tab layout: Overview | Pricing | Calendar | Reviews | Maintenance | Settings
  - Imports child components explicitly (not auto-imported)

- **Child components**:
  - `ListingHeroCompact.vue` — Photo gallery + name/location/AI badge + tags + OTA connections + unit switcher grouped by unit type
  - `ListingOverviewTab.vue` — Stats cards + upcoming bookings + recent reviews
  - `ListingPricingTab.vue` — Editable nightly rate, fees, discounts
  - `ListingCalendarTab.vue` — Bookings list, blocked dates
  - `ListingReviewsTab.vue` — Rating breakdown, host reply
  - `ListingMaintenanceTab.vue` — Cleaning schedule/jobs, tasks
  - `ListingSettingsTab.vue` — Distribution channels
  - `UnitTypeManager.vue` — CRUD for unit types with Details and Pricing tabs
  - `ListingExpandRow.vue` — Expanded rows grouped by unit type in table
  - `ListingSingleToggle.vue` — Status switch for table rows
  - `ListingAiStatusCell.vue` — AI status display
  - `ListingOtaCell.vue` — OTA icon display
  - `ListingRowActions.vue` — Dropdown menu: View Detail, Activate/Deactivate, Toggle AI
  - `SavedViewsDropdown.vue` — Save/load/update/delete table views

- **Listings index**: `app/pages/listings/index.vue`
  - TanStack Table with search, tag filter, AI status filter, column toggle, pagination

### Inbox Module (`app/components/inbox/`)

- **Data + types**: `app/components/inbox/data/conversations.ts`
  - `Conversation` type (with `status: ConversationStatus | null`, `assignedTo?: string | null`, `tags: string[]`)
  - `Message` type (with `aiWritten?: boolean`, `senderRole?: string`)
  - `StaffMember` list (You/Admin, Komang Juliantara/Guest Relations, Made Surya/Housekeeping, Wayan Adi/Maintenance)
  - `Reservation` type, mock data (6 conversations)
- **Shared state**: `app/composables/useInbox.ts`
  - **Reactive**: `conversations` uses `useState<Conversation[]>` — mutations use spread syntax to trigger Vue reactivity
  - Filters: `showActionNeeded`, `assignedToMeFilter`, `activeStayFilter`, `activeListingFilter` (multi-select `string[]`), `activeTagFilters`, `listingSearchText`, `searchValue`, `sortBy`
  - Listing filter: Multi-select — `activeListingFilter` is `string[]` (empty = no filter). Checkboxes in sidebar. Selected listings shown as removable chips.
  - Tag filter: Multi-select via searchable Popover — `activeTagFilters` is `string[]` (AND logic). Tags button opens popover with search + checkboxes. Selected tags shown as removable chips.
  - Actions: `markAsHandled()`, `markAsUnread()`, `assignTo()`, `getAssignedStaff()`, `toggleListingFilter()`, `clearListingFilters()`, `toggleTagFilter()`, `clearTagFilters()`, `clearAllListingFilters()`, ElevAI toggle functions
  - Auto-read: Selecting a conversation sets `unreadCount = 0`
  - Key type: `ConversationStatus = 'action_needed'` (nullable — `null` = no action needed)

### Journeys Module (`app/components/journeys/`)

- **Data + types**: `app/components/journeys/data/journeys.ts`
  - `TriggerType`: 15 types across 3 categories (no integration triggers):
    - **Conversation-Based**: `conversation_content` (keywords textarea), `sentiment_change` (Positive/Neutral/Negative toggle + immediate + delay + time)
    - **Reservation Events**: `inquiry_received`, `new_message_received`, `new_booking`, `guest_checkout`, `booking_cancelled` (immediate checkbox + delay + time), `checkin`, `checkout` (Before/On/After 3-way toggle + offsetAmount/offsetUnit + time)
    - **Calendar-Based**: `send_once` (date + time), `gap_nights` (min/max + before/after + delay + time), `daily`, `weekly`, `monthly`, `yearly`
  - `TriggerCategory = 'conversation' | 'reservation' | 'calendar'`
  - `WaitStep`: `waitMode: 'time_delay' | 'until_condition'` — Time Delay has `durationDays/Hours/Minutes` + optional `waitUntilSpecificTime` + `waitUntilTime`; Until Condition uses `rules` + `combinator` (same condition system as Hard Requirement/If-Else)
  - **IfElseStep**: `trueBranchStep` / `falseBranchStep` store full step configs (`Record<string, any>`)
    - Branch action picker uses same DropdownMenu as "Add Step" (groups + icons), **excludes If/Else** to prevent infinite loops
    - Selecting an action **auto-opens Dialog popup** with full step config for that type
    - Each branch shows a summary of the configured action (e.g., "Wait: 2d 3h", "Send a Message: AI Directive · WhatsApp")
    - Delete Action button in popup resets branch to "None"
    - Branches stack vertically (not grid) to fit sidebar width
    - `defaultBranchConfig()` initializes correct fields per type (including `hard_requirement` with `rules: [], combinator: 'and'`)
    - `branchStepType()` maps config to display type (handles `toggle_ai` → `toggle_ai_pause`/`toggle_ai_start`)
    - Condition modal targets: `'branchTrue'` / `'branchFalse'` for Hard Requirement branches
  - Condition system: `ConditionRule` with 14 types, `ConditionCombinator = 'and' | 'or'` — configured via `JourneyConditionsModal.vue` (reusable for Hard Requirement, If-Else, Wait Until Condition, and branch Hard Requirements)
  - `JourneyStatus = 'active' | 'inactive'` (no 'draft' — known pre-existing type error in `pages/journeys/index.vue`)
  - `addStepOptions`: Removed `context_check` and `end_journey`. Remaining: Wait, Send Message, If/Else, Hard Requirement, Create Action Item, Create Reservation Note, Pause/Start Auto-responses, Integrations
  - `handleStepUpdate` uses `splice` (not object spread) to avoid Select dropdown portal issues

- **Components**:
  - `JourneyEditor.vue` — Editor top bar (Add Requirements, Build with AI, Save as Template), step canvas, add step dropdown, sidebar
  - `JourneyStepSidebar.vue` — Step config UI for all step types + trigger config + branch dialog
  - `JourneyStepCard.vue` — Step cards with badges + summary text
  - `JourneyBuilderReview.vue` — AI-generated journey review screen
  - `JourneyConditionsModal.vue` — Reusable Configure Conditions modal (14 types, AND/OR)
  - `JourneySaveTemplateModal.vue` — Save as Template modal
  - `JourneyBuildAIModal.vue` — Build with AI modal
- **Shared**: `app/components/shared/PropertyPicker.vue` — Reusable multi-select property/listing picker with search and city tag filter. Globally auto-imported as `<SharedPropertyPicker>` — used in JourneyEditor but can be used on any page or component.

- **Page**: `app/pages/journeys/index.vue` — Marketplace view, builder flow, editor routing

### Booking Widgets Module (`app/components/booking-widget/`)

- **Data + types**: `app/components/booking-widget/data/widgets.ts`
  - `BookingWidgetConfig` type with new fields: `cleaningFee`, `prepayment`, `extraGuestPerNight`, `extraGuestStartAt`, `maxGuests`, `extraChildPerNight`, `seasonalConditions`, `lengthOfStayDiscounts`, `contactFields`, `status`
  - `ToggleableAmount` = `{ mode: 'currency' | 'percent', value: number }`
  - `SeasonalCondition` = `{ id, startDate, endDate, arrivalDays, departureDays }`
  - `LengthOfStayDiscountTier` = `{ id, minNights, discountType: '%' | 'fixed', value }`
  - `ContactFields` = `{ firstName, lastName, email, phone, country, address, notes, arrivalTime }` (each `'required' | 'optional' | 'hidden'`)
  - `bookingWidgets` ref (local reactive copy `widgets` used in index page for reliable reactivity)
  - `useBookingWidgets()` composable: `getWidgetById()`, `buildEmbedPreview()`, `copyEmbedSnippet()`, `getSnippetForForm()`

- **Page**: `app/pages/booking-widgets/index.vue`
  - Minimal card layout: widget name, listing count, status toggle (active/inactive), more menu (Edit/Preview/Delete)
  - Status toggle uses native `<button>` styled as switch (not shadcn Switch) for reliable reactivity
  - Delete confirmation dialog

- **Page**: `app/pages/booking-widgets/new.vue`
  - 3 tabs: Accommodation Setting | Booking System Setting | Embed in Website
  - **Accommodation tab**: multi-select listings (checkbox dialog with tags), cleaning fee/prepayment/extra guests/extra child (all with currency/% toggle), min days before arrival, max guests, seasonal conditions (RangeCalendar popover + arrival/departure day toggles), length of stay discounts, promo codes
  - **Booking System tab**: currency, payment methods (multi-select), default payment option, locked requestNumberOfPersons, contact field configuration (8 fields × Required/Optional/Hidden dropdown)
  - **Embed tab**: allowed domains, embed snippet, UTM params, preview dialog

- **Components**:
  - `BookingWidgetPreview.vue` — Embed preview with listing selector, deposit info
  - `BookingWidgetWysiwyg.vue` — WYSIWYG editor (unused after Contact section redesign)

### Payment Request Module (`app/components/payment-request/`)

- **Data + types**: `app/components/payment-request/data/payment-requests.ts`
  - `PaymentRequest` type (with `status: 'pending' | 'paid' | 'expired' | 'cancelled'`, `feeMode: 'card' | 'manual'`, `createdBy: string`, `cancelledAt?`, `cancelledBy?`)
  - `PaymentRequestDraft` type for creation
  - `GuestOption` type for guest search (sources: inbox, payment_request, manual)
  - Fee helpers: `calculateFee()` (3% for card, 0 for manual), `calculateTotal()`, `generatePaymentLink()`, `getStaffName()`
  - Mock data: 4 requests (pending, paid, expired, cancelled)
- **State**: `app/composables/usePaymentRequests.ts`
  - `requests` uses `useState<PaymentRequest[]>` — mutations use spread syntax
  - Filters: `status` (single), `listings` (multi-select `string[]`), `dateFrom`/`dateTo`, `search`
  - Actions: `createRequest()`, `cancelRequest(id, reason?)` (reason stored in `notes`), `duplicateRequest()`, `checkDuplicate()`, `expireOldRequests()`, `isListingAssigned()`
- **Page**: `app/pages/payment-requests/index.vue`
  - Filter bar: Search input, Status dropdown, Listing filter (Popover + search + Tags button inside search bar), Date range (RangeCalendar 2-month view)
  - Active filters shown as removable chips below filter bar
  - Stats: pending count, paid count
- **Components**:
  - `PaymentRequestCreateDialog.vue` — Create form with guest search (Popover+Command from inbox guests + previous PR guests + manual), listing picker (search + tag filter), fee mode toggle (Card/Manual), amount + title + description + expiry
  - `PaymentRequestTable.vue` — Table with Guest, Title, Listing, Amount, Status, Created by (avatar initials + name), Created (time ago)
  - `PaymentRequestDetailDialog.vue` — Status banner, creator info (name + date), cancellation info (who + when + reason), amount breakdown, payment link copy
  - `PaymentRequestShareDialog.vue` — Copy link (toast confirmation), WhatsApp share, Email share
  - `PaymentRequestCancelDialog.vue` — Cancel confirmation with reason selection (6 predefined reasons + "Other" with textarea). Stores reason in `request.notes`. Opens from both table row action and detail dialog.
  - `FeeCalculator.vue` — Live fee preview (Card: +3%, Manual: no fee)
- **Guest search**: Sources from `useInbox().conversations` + existing payment requests. "Add new guest" option when no match. Email auto-fills for existing guests, empty for new guests.
- **Share dialog**: Opens AFTER creation via `@created` event. No QR Code button.

### Key Management Module (`app/components/key-management/`)

- **Data + types**: `app/components/key-management/data/keys.ts`
  - `KeyType` union (`main_door`, `bedroom`, `gate`, `pool`, `safe`, `storage`, `motorbike`, `other`)
  - `KeyStatus = 'available' | 'checked_out' | 'lost'`
  - `PhysicalKey` — `id`, `listingId`, `type`, `label?`, `copyNumber`, `status`, `holderStaffId?`, `checkedOutAt?`, `expectedReturnAt?`, `location: 'office' | 'key_box'`, `keyBoxId?`, `replacedByKeyId?`, `createdAt`
  - `KeyEventAction = 'register' | 'checkout' | 'return' | 'mark_lost' | 'replace' | 'handover'`
  - `KeyEvent` — `id`, `keyId`, `action`, `staffId?` (holder/new holder), `previousStaffId?` (set on handover), `actorStaffId` (current user `staff-2`), `at`, `note?`
  - `KeyBox` — `id`, `listingId`, `name`, `location`, `pin`, `notes?`
  - Helpers: `keyTypeLabels`, `keyTypeIcons`, `keyEventLabels`, `getKeyDisplayName()`, `generateKeyId()`, `generateKeyEventId()`, `generateKeyBoxId()`, `nextCopyNumber()`
  - Mock data: 12 keys across 5 listings, 3 key boxes, ~20 seeded events
- **State**: `app/composables/useKeyManagement.ts`
  - `keys`, `keyEvents`, `keyBoxes` via `useState` (no localStorage persistence)
  - Filters: `search`, `status`, `type`, `listings: string[]`
  - Computed: `filteredKeys`, `stats` (`total`, `available`, `checkedOut`, `lost`, `overdue`), `overdueKeys`, `sortedEvents`
  - Actions: `registerKey()`, `checkoutKey()`, `returnKey()`, `handoverKey()`, `markKeyLost()`, `replaceKey()`, `addKeyBox()`, `updateKeyBox()`, `removeKeyBox()`, `checkOverdueKeys()`
  - `handoverKey(keyId, toStaffId, note?)` transfers custody between staff without returning the key; writes a `handover` event with `previousStaffId`
  - Overdue alert resolution: `returnKey` and `markKeyLost` resolve active `KEY_NOT_RETURNED` alerts for that key
- **Alerts**: `app/components/notifications/data/alerts.ts` includes `KEY_NOT_RETURNED` alert type
  - Generated by `useKeyManagement().checkOverdueKeys()` via `useNotifications().createAlert()`
  - Severity `WARNING`, routes to `/key-management`
- **Page**: `app/pages/key-management/index.vue`
  - Stats cards: Total keys, Available, Checked Out (with overdue count), Lost
  - Tabs: Keys | Key Boxes | Activity
  - `KeyTable.vue` with status badges, listing, holder, location, checked-out time, row actions
  - Row actions per status: `available` → Check out / Mark lost / History; `checked_out` → Return / Hand over / Mark lost / History; `lost` → Replace / History
  - Dialogs: `KeyRegisterDialog.vue`, `KeyCheckoutDialog.vue`, `KeyHandoverDialog.vue`, `KeyLostDialog.vue`, `KeyBoxDialog.vue`, `KeyHistorySheet.vue`
  - `KeyActivityTimeline.vue` global feed and `KeyHistorySheet.vue` per-key feed both render handovers as "From X → Y"
- **Sidebar**: `app/constants/menus.ts` adds "Key Management" nav item under Operations group

### Settings Module (`app/components/settings/`)

- **Payouts**: `app/pages/settings/payouts.vue` + `app/components/settings/PayoutGatewayPanel.vue`
  - Payout gateway configuration (Stripe, PayPal, bank transfer)
  - Custom SVG logos: `DokuLogo.vue`, `XenditLogo.vue`
  - Data: `app/components/settings/data/payouts.ts`

### Operations Calendar Module (`app/components/operations-calendar/`)

- **Data + types**: `app/components/operations-calendar/data/operations-calendar.ts`
  - `OperationsFilters` type with `listingSearch`, `listingTags` (AND logic), `eventTypes` (OR logic)
  - `CalendarEvent` type with `type: 'guest_stay' | 'cleaning' | 'task'`, `listingId`, scheduled times
- **State**: `app/composables/useOperationsCalendar.ts`
  - `filters` — `ref<OperationsFilters>`, computed filter pipelines
  - Navigation: `previousWeek()`, `nextWeek()`, `goToToday()`
- **Page**: `app/pages/operations-calendar.vue` — Week/Day toggle, filter bar, board grid
- **Components**:
  - `OperationsCalendarFilters.vue` — Search input, Tags Popover, Event Types Popover, Clear button. Uses native `<button @click>` + plain `<span>` checkbox visuals (bypasses Reka UI CheckboxRoot `:checked` prop issue)
  - `OperationsCalendarBoard.vue` — Week/day grid
  - `OperationsCalendarEventChip.vue` — Event chip in grid cells
  - `OperationsCalendarCreateDialog.vue` — Create cleaning job / task

### Notification Center (`app/components/notifications/`)

- **Data + types**: `app/components/notifications/data/alerts.ts`
  - `AlertType` — 29 alert types: system alerts (smart locks, channels, bookings, cleaning, Stripe, quotas, bridge, tasks, templates, warranties), upsell alerts, and call alerts
  - `AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO'`
  - `Alert` interface with `status: 'ACTIVE' | 'RESOLVED'`
  - `alertDisplayLabels` — Human-readable labels (uses single dash, no em dash)
  - `alertIcons` — Category-specific icons per alert type
  - `alertRouteMap` — Routes for navigation on click
  - `getDescription()` — Dynamic descriptions from context
  - Mock data: 13 alerts including 4 call alerts
- **Call alerts**: `CALL_INCOMING`, `CALL_MISSED`, `CALL_COMPLETED`
  - Context: `guestName`, `callerNumber`, `listingName`, `listingId`, `duration`, `aiSummary`
  - Falls back to phone number when guest name unknown
  - `CALL_COMPLETED` shows AI summary with sparkle icon (`i-lucide-sparkles`, color `#C8A84B`)
- **State**: `app/composables/useNotifications.ts`
  - `alerts` uses `useState<Alert[]>` — all alerts shown (ACTIVE + RESOLVED)
  - `activeAlerts` — only ACTIVE alerts (for unread count)
  - `unreadCount` — count of ACTIVE alerts
  - `selectedSeverity` — filter: `'all' | 'critical' | 'warning' | 'info'`
  - `selectedKind` — filter: `'all' | 'system' | 'upsell' | 'cleaning' | 'calls'`
  - `filteredAlerts` — alerts filtered by severity + kind
  - Actions: `markAsRead()`, `markAllAsRead()`, `navigateToAlert()`
- **Components**:
  - `NotificationCenter.vue` — Bell icon with unread badge (red only for CRITICAL alerts, muted otherwise), popover with kind tabs (All Types/System/Cleanings/Calls/Upsell), severity tabs (All/Critical/Warning/Info), Mark All Read button
  - `NotificationItem.vue` — Notification card with category icon (opacity 50%), severity-colored left border, display label, description, time ago, AI summary badge for calls
  - No X dismiss button — notifications stay visible after read with white background

### 3CX Telephony Module (`app/composables/useThreeCX.ts`, `app/composables/useThreeCxCalls.ts`, `app/composables/useCallsFilters.ts`)

- **Data + types**:
  - `ThreeCxAccount` — `id`, `fqdn`, `displayName`, `pbxVersion`, `accessToken`, `refreshToken`, `status: 'connected' | 'disconnected' | 'pending' | 'error'`, `connectedAt`, `extensionMappings: { staffId, extensionNumber }[]`, `webhookSubscriptions: string[]`
  - `UnmatchedCall` — `id`, `fromNumber`, `toExtension`, `timestamp`, `status`, `duration`, optional `recording_url`
  - `PhoneCall` extended with `transcriptionState: 'idle' | 'processing' | 'done' | 'failed'`, `transcriptionError?`, `extensionNumber?`, `staffId?` (in `app/components/inbox/data/conversations.ts`)
  - Mock data: starts from existing seed `phoneCalls`; live calls append on top, all persisted to `localStorage` key `elev8-threecx-phone-calls`

- **Connection & extension mapping**: `app/composables/useThreeCX.ts`
  - `accounts` uses `useState<ThreeCxAccount[]>` persisted to `localStorage` key `elev8-threecx-accounts`
  - `activeAccount` / `isConnected` computeds
  - `completeOAuthCallback(code, fqdn)` — mock OAuth exchange: FQDN-validated, mints access/refresh tokens, registers webhook subscriptions (`call.ringing`, `call.answered`, `call.ended`, `call.missed`, `call.voicemail`). V1 skips the 3CX authorization redirect and goes straight to connected state (gated on PRD Open Question #1)
  - `assignExtension(staffId, ext)` / `unassignExtension(staffId)` — maps staff to 3CX extension
  - `getExtensionForStaff(staffId)` / `getStaffForExtension(ext)` — bidirectional lookup
  - `disconnect()` — clears account but preserves call history (matches WhatsApp disconnect pattern)
  - `unmatchedCalls` state with `addUnmatchedCall`, `dismissUnmatchedCall`, `matchUnmatchedCall`

- **Call event pipeline (mock)**: `app/composables/useThreeCxCalls.ts`
  - **Mock ingestion** (deferred real webhook receiver — depends on PBX version, see PRD Open Question #1): `simulateInboundCall({ fromNumber, toExtension, outcome })` and `simulateOutboundCall({ fromExtension, toNumber, staffId, conversationId })`
  - Caller-number matching: `findConversationByPhone` compares last 9 digits of caller against `reservations[id].guestDetails.phone` — falls back to `unmatchedCalls` queue if no match
  - Missed/voicemail outcomes auto-flip `Conversation.status = 'action_needed'` and increment `unreadCount`
  - Matched inbound `completed` call triggers `startScreenPop` — push notification to assigned staff (`getStaffForExtension(call.to)`) or broadcasts to default team if no extension owner
  - `phoneCalls.value: Record<conversationId, PhoneCall[]>` — `upsertCall`, `getCallById`, `getCallsForConversation`, `allCalls` (flat sorted list)
  - `screenPops.value: ScreenPopNotification[]` — `dismissScreenPop(id)`, `getActiveScreenPopForCurrentUser()` (filters by current staff `staff-2`)

- **Async transcription job**:
  - `runTranscriptionJob(conversationId, callId, hasRecording)` — sets `transcriptionState: 'processing'`, schedules a `setTimeout` (target = `min(duration * 2s, 10min)`, minimum 1.5s)
  - 8% random failure rate — `transcriptionState: 'failed'` + `transcriptionError`; record keeps duration/recording, never blocks UI
  - On success: writes canned `transcript` and `summary` (from `MOCK_TRANSCRIPT_SAMPLES` / `MOCK_SUMMARY_SAMPLES`), `transcriptionState: 'done'`
  - No recording → job does not run; `transcript`/`summary` stay empty (no stuck "Processing" state)
  - `retryTranscription(conversationId, callId)` re-runs the job

- **Components**:
  - `SettingsThreeCxIntegration.vue` (`app/components/settings/ThreeCxIntegration.vue`) — Connect dialog (FQDN input + validation, goes straight to connected — no OAuth redirect in V1), connected card (status, webhook URL copy, disconnect), extension mapping table (search + per-staff extension input, unassign)
  - `pages/settings/integrations.vue` — registers 3CX card alongside WhatsApp
  - `CallsList.vue` (`app/components/inbox/CallsList.vue`) — list panel for calls view (replaces `InboxList` when `inboxView === 'calls'`); header with search input + filter popover (status, staff, date range), calls list (matched + unmatched sections), click-to-select, match dialog. Source: `useCallsFilters`
  - `CallsDetail.vue` (`app/components/inbox/CallsDetail.vue`) — call detail panel (replaces `InboxThread` when `inboxView === 'calls'`); header with caller info, "Open conversation" button (matched only) or "Unmatched" badge, body sections: Answered by card (avatar + name + role + extension), AI Summary, Recording (ai-elements `AiElementsAudioPlayer`), Transcript (Processing/Failed/Empty states). Empty state when no call selected
  - `ListingFilterSection.vue` (`app/components/inbox/ListingFilterSection.vue`) — reusable listing filter section (search input + Tags popover + selected chips + listing checkboxes); used by `Nav.vue` for both Conversations and Calls views
  - `CallScreenPop.vue` (`app/components/inbox/CallScreenPop.vue`) — bottom-right toast that appears on matched inbound calls; "Open conversation" jumps to it, "Dismiss" closes; auto-targeted to extension's assigned staff
  - `useCallsFilters.ts` (`app/composables/useCallsFilters.ts`) — shared filter state for calls view (`activeCallsFilter`, `activeListingFilter`, `activeTagFilters`, `staffFilter`, `dateRange`, `searchQuery`); computed `filteredMatched`/`filteredUnmatched`/`listingOptions`/`listingTags`/`callsCountByStatus`; uses `useThreeCX` for `unmatchedCalls` and `useThreeCxCalls` for `allCalls`/`getCallById`
  - `Layout.vue` — adds Conversations/Calls view toggle in inbox header, swaps list panel (`InboxList` ↔ `InboxCallsList`) and thread panel (`InboxThread` ↔ `InboxCallsDetail`); renders 3CX card in Integrations sheet, mounts `<InboxCallScreenPop />`
  - `Thread.vue` Calls tab — added Processing/Failed transcript state UI + Retry button on failure
  - `ReservationGuest.vue` — click-to-call icon button next to phone number (disabled when 3CX not connected)
  - `ReservationPanel.vue` — switches from `phoneCalls` seed to `useThreeCxCalls.getCallsForConversation` so live calls flow into the activity feed

- **Mock integration** (V1, deprecation strategy):
  - All ingestion is mocked client-side via `setTimeout`. Real 3CX webhook receiver requires PBX version confirmation (V20+ uses native REST + webhook subscriptions; older versions need a Call Flow App HTTP forwarder) — gated by PRD Open Questions #1 and #3
  - Recording URLs are placeholder `https://example.com/recordings/...` strings
  - Transcription is a canned-text picker, not a real STT call — provider selection gated by PRD Open Question #6

### CI/CD

- **GitHub Actions**: Two workflows — `CI` (lint + build check) and `Deploy to GitHub Pages`
- **ESLint**: `eslint.config.js` uses `@antfu/eslint-config` + Nuxt config. Ignores `docs/**`, `dist/**`, `.output/**`
- **Known pre-existing type errors**: `JourneyStatus` 'draft' in `pages/journeys/index.vue`, `useJourneys.ts` `lastModified` undefined — do not block deploy (build succeeds)

### Layout

- **Topbar**: `app/components/layout/Header.vue` — SidebarTrigger + user menu (no breadcrumb)
- **User menu**: `app/components/layout/HeaderUserMenu.vue` — Komang Juliantara + "Guest Relations" role dropdown
- **Sidebar**: `app/components/layout/AppSidebar.vue` — No footer (user menu moved to topbar)
- **Sidebar nav**: `app/components/layout/SidebarNavLink.vue` — Unread count badge on Inbox link

### UI Patterns

- **Toast notifications**: Uses `vue-sonner` (already in `app.vue`). Call `toast.success()` / `toast.info()` for user action feedback.
- **Unread badges**: `Badge` component with `variant="default"` showing count. On sidebar Inbox link and per-conversation in list.
- **AI-written messages**: `aiWritten: true` on host messages → shows "ElevAI" as sender name, sparkle avatar, "AI" label instead of user name
- **Action Needed status**: Only `action_needed` or `null` (no `needs_reply`, `waiting_on_guest`, `done`). Badge shown only when `status === 'action_needed'` (destructive variant).

### Current User Context

The logged-in user is **Komang Juliantara** (Guest Relations role), not "You" (Admin). The `staff-1` / "You" in data represents the property owner; Komang is the active staff member viewing the dashboard.

## Conventions

- **shadcn-vue components**: Use existing shadcn components from `app/components/ui/`
- **Semantic colors**: Use theme tokens (`bg-muted`, `text-muted-foreground`, `bg-warning`, etc.) — no hardcoded colors except ElevAI gold
- **ElevAI gold**: `bg-[#C8A84B]` only for ElevAI branding; `bg-warning` for host chat bubbles and toggle
- **Icons**: Use `lucide:` prefix (e.g. `lucide:user-check`); OTA icons use `logos:airbnb` and `simple-icons:bookingdotcom`
- **CSS framework**: Tailwind CSS v4
- **State mutations**: Always use spread syntax (`{ ...conv, field: value }`) when modifying conversation properties to ensure Vue reactivity triggers
