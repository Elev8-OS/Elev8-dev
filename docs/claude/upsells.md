> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Upsells Module (`app/components/upsells/`)

#### Data + Types
- **`upsell-services.ts`** — `UpsellItem` (with `description?`, `image?`), `UpsellService` (with `priceUnit?`, `addToHousekeepingPrep?`, `availability: 'always' | 'by_request'`, `pricingEnabled`, `taxPercent`, `servicePercent`), 10 mock services
- **`upsell-orders.ts`** — `UpsellOrder` interface with `serviceDate`, `serviceEndDate?`, `source` ('manual' | 'inbox' | 'web'), `conversationId?`, `approvalStatus`, `paymentStatus`, `fulfillmentStatus`, `cancellationReason?`, `cancellationBy?`, `invoice?`, `issuedAccessCodeIds?`; `OrderStatus` derived from lifecycle (`requested`, `awaiting_payment`, `paid_in_progress`, `completed`, `declined`); 13 mock orders (`ord-012`/`ord-013` are the smart-lock access demos)
- **`upsell-notifications.ts`** — 7 notification types (order_created, order_confirmed, order_completed, order_cancelled, refund_issued, reminder_24h, reminder_1h), notification template system, 10 mock notifications
- **`cancellation-policies.ts`** — Per-service refund calculator (48h/24h/late windows); staff cancel = 100% refund always; guest cancel depends on timing

#### Composables
- **`useUpsellServices.ts`** — Catalog CRUD, filters (`activeCategoryFilter`, `activeStatusFilter`, `activeListingFilter`, `searchValue`)
- **`useUpsellOrders.ts`** — Orders state + CRUD, `updateStatus()`, `addOrder()`, `cancelOrder()` (with refund calculation), filters, `statusCounts`, `totalRevenue`
- **`useUpsellNotifications.ts`** — Notification state, `createNotification()`, `markAsRead()`, unread count

#### Components
- ⚠️ **Catalog filters live in `useState`** (`upsell-filter-*`, 2026-10-08): the filter bar and `UpsellTable` each call `useUpsellServices()`, so plain `ref`s gave each its own copy and the filters did nothing. They now persist across navigation until Clear filters. `UpsellTable` pages the filtered list (10/20/30/50 rows, page 1 on any filter or search change)
- **`UpsellTable.vue`** — TanStack data table with columns: Name, Category, Price Range, Items, Listings, Availability, Status
- **`UpsellFilterBar.vue`**: Search (`searchQuery`: name, category, description text, item names) + Category + Status + Listing + **Lock access** filters + Search input
- ⚠️ **Category `Damage Protection` is not a normal upsell** (2026-10-06): it sells ONE Elev8 Cover package (its single item: `UpsellItem.coverTier` + guest price; Bronze and Silver are two services) and has no listings (2026-10-08: the tenant picks ONE package for every listing in Settings, Damage protection; the drawer has no Listings step for it and saves `assignedListings: []`). `sellableServices` / `isProtectionService` keep it out of inbox orders, the folio catalog and promo codes, and (2026-10-08) off the Upsells page entirely: `filteredServices` drops it and `CATALOG_CATEGORIES` (the create menu and category filter) leaves the category out. Its one package is managed in Settings, Damage protection. See `damage-protection.md`.
- **`UpsellDrawer.vue`** — 2-tab Sheet drawer (Details + Items); Details: name, description (2026-10-08: WYSIWYG via `shared/RichTextEditor.vue`, stored as HTML; variable chips insert `<guest_first_name>`, `<guest_last_name>`, `<listing_name>` as escaped text. ⚠️ Legacy plain descriptions hold those variables, which `isRichText` mistakes for tags: load through `hasRichTextTags` + `plainTextToHtml` and show previews with `richTextToPlainText`, as the drawer and `UpsellTable` do), image upload (FileReader→base64), YouTube links, listings, availability selector, tax/service section; **Assigned Listings** step: search + Tags popover (AND, tags from `listings.ts` by name), removable tag chips, a select-all row that acts on the visible rows only (tri-state), tag pills per row, custom-checkbox rows (no reka Checkbox). Filters reset on open; their refs sit above the `immediate` open watcher. **Notify Users** (Basic Info, no channel named in the UI): Popover picker of `useUsers().activeUsers` (search by name or role, custom-checkbox rows), still stored as names in `notificationUsers`; a stored name with no active user still lists, with initials only. Footer: create mode is Cancel/Back + Next/Create; edit mode is a trash icon (delete confirm) on the left and Cancel/Back, Next (outline) and Save Changes on the right, so edits save from any step. Items: modal dialog for adding items, vuedraggable sort with grip handle. For categories in `PRICE_UNIT_CATEGORIES` (only `Miscellaneous`, 2026-10-08) Basic Info shows a **Unit Price** select under Description (`PRICE_UNIT_OPTIONS`: Flat fee, Per person, Per night, Per person per night, Per pet, Per pet per night) stored once as `UpsellService.priceUnit`, so every item shares the same unit; missing means flat fee. The items list and the item dialog's Price label show the suffix via `priceUnitSuffix()`. Display only: order totals and the folio still charge `price` once, the unit is not multiplied yet. Same categories, under Unit Price (2026-10-12): a **Service Hours** switch with Start/End `base/TimePicker.vue` selects (00:00 to 23:00, 30 min; never a native time input), stored as `UpsellService.serviceHours?: { start, end }` (`HH:mm`, missing = off/any time; save blocks end <= start). Config only: nothing restricts the order date picker yet. The Floating Breakfast mocks use 07:00 to 11:00. Same categories, under Description (2026-10-12): **Upsell Type** cards, Internal (default) or External (`UpsellService.fulfillment?`, missing = internal). External shows only a required **External Link** (`externalUrl`, http(s) via `isValidExternalUrl`, checked on Next and Save) and hides Currency, Unit Price, Service Hours, Housekeeping, the Items step, Availability, Smart Lock Access and Tax and Service; it saves `items: []`, `pricingEnabled: false`, no lock access. ⚠️ `orderableServices()` (sellable and not external) feeds the inbox `UpsellOrderCreator` and promo code picker; the catalog keeps using `sellableServices` so external rows still list (price/availability "—", an "External link" badge). Mock: `svc-015` Nusa Penida Snorkeling Trip. Basic Info also has a **Currency** select (`UPSELL_CURRENCIES`, no conversion of typed prices) and an **Add order to Housekeeping Preparation** switch (`UpsellService.addToHousekeepingPrep`), both hidden for Damage Protection (USD only). The switch is a stored setting only: nothing reads it yet
- **`UpsellVisibilityGroup.vue`** (2026-10-08): the drawer's Visibility step renders it twice, **Show when** (`visibility` + `visibilityMatchMode`) and **Hide when** (`hideVisibility?` + `hideVisibilityMatchMode?`, missing = no hide rules). Hide wins over show. Rules are added from an "Add rule" menu and removed with ×; the All/Any toggle and the and/or connectors appear from two rules up. The `excludeIfUpsellPurchased` key now means "guest bought any of these" in either group (name kept for stored data). ⚠️ Config only: nothing evaluates these rules yet (no guest-facing upsell list reads them)
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
- **Promo-code orders** (`UpsellOrder.promoRedemption`): created by `usePromoRedemption` for free-upsell codes, grand total 0, catalog price frozen in `originalPrice`. `approveOrder` on one goes straight to paid (no payment link). `addOrder` returns the created order. See `promo-codes.md`
- `availability: 'always'` → auto-confirmed; `'by_request'` → pending confirmation
- Cancellation: staff cancel = 100% refund; guest cancel depends on policy timing
- Upsell offers embedded in chat via `UpsellOfferCard` component (not separate notification)
- Order drawer reactivity: use computed lookup from `useUpsellOrders` state, not prop snapshot
