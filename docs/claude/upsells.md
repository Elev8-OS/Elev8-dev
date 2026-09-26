> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Upsells Module (`app/components/upsells/`)

#### Data + Types
- **`upsell-services.ts`** — `UpsellItem` (with `description?`, `image?`), `UpsellService` (with `availability: 'always' | 'by_request'`, `pricingEnabled`, `taxPercent`, `servicePercent`), 10 mock services
- **`upsell-orders.ts`** — `UpsellOrder` interface with `serviceDate`, `serviceEndDate?`, `source` ('manual' | 'inbox' | 'web'), `conversationId?`, `approvalStatus`, `paymentStatus`, `fulfillmentStatus`, `cancellationReason?`, `cancellationBy?`, `invoice?`, `issuedAccessCodeIds?`; `OrderStatus` derived from lifecycle (`requested`, `awaiting_payment`, `paid_in_progress`, `completed`, `declined`); 13 mock orders (`ord-012`/`ord-013` are the smart-lock access demos)
- **`upsell-notifications.ts`** — 7 notification types (order_created, order_confirmed, order_completed, order_cancelled, refund_issued, reminder_24h, reminder_1h), notification template system, 10 mock notifications
- **`cancellation-policies.ts`** — Per-service refund calculator (48h/24h/late windows); staff cancel = 100% refund always; guest cancel depends on timing

#### Composables
- **`useUpsellServices.ts`** — Catalog CRUD, filters (`activeCategoryFilter`, `activeStatusFilter`, `activeListingFilter`, `searchValue`)
- **`useUpsellOrders.ts`** — Orders state + CRUD, `updateStatus()`, `addOrder()`, `cancelOrder()` (with refund calculation), filters, `statusCounts`, `totalRevenue`
- **`useUpsellNotifications.ts`** — Notification state, `createNotification()`, `markAsRead()`, unread count

#### Components
- **`UpsellTable.vue`** — TanStack data table with columns: Name, Category, Price Range, Items, Listings, Availability, Status
- **`UpsellFilterBar.vue`**: Category + Status + Listing + **Lock access** filters + Search input
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
