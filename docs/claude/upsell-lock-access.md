> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Upsell → Smart Lock Access (`app/components/upsells/data/lock-access.ts` + `app/composables/useUpsellLockAccess.ts`)

Selling access itself: a service can be configured to hand the guest a door code, and paying
for it issues that code automatically. Bridges the Upsells module to `useSmartLock` without
either one learning about the other.

**The chain**: a service names the locks it unlocks → an order is paid → a code is issued per
matching lock at that property → the guest is told, staff are told, and the drawer shows it.

#### Data model (two additive, optional fields, nothing existing needs migrating)
- `LockAccessConfig` = `{ enabled, lockNames: string[], instructions? }`, stored as
  `UpsellService.lockAccess?`
- `UpsellOrder.issuedAccessCodeIds?: string[]`: the codes this order handed out. Doubles as the
  **idempotency guard**: `markPaid` fires from both `UpsellOrderDrawer` and the `UpsellOrderTable`
  dropdown, and a live code in that array means access was already granted

⚠️ **Locks are matched by NAME, never by lock id.** A service is assigned to many listings while a
lock is paired to one, so an id would dangle the moment the host unpairs or swaps a device. A name
survives both, and a name with no lock behind it at a given property is *reported*, not dropped.

#### Pure module (`data/lock-access.ts`, framework-free)
- `resolveLockTargets(config, locks)` → `{ matched, unmatchedNames }`: case-insensitive, deduped
  by id, blank names skipped. Takes a structural `LockLike`, not `SmartLock`, so the rules stay
  testable without the smart-lock store (same trick as the GM dashboard's `AttentionConversation`)
- `buildAccessWindow(order, now)` → from payment until **noon on the check-out day**
  (`ACCESS_END_HOUR`), `scheduleType: 'range'`. Access bought mid-stay should last the rest of the
  stay, so the end is pinned to check-out and **not** to `serviceDate`. A purchase made after that
  point widens to `MIN_ACCESS_WINDOW_MS` (2h) rather than silently rolling to the next day
- `accessPurposeLabel(order)` → `Upsell · <service name>`, the `purpose` the listing Codes Dialog
  and the inbox Smart Lock tab already render
- `serviceGrantsLockAccess(service)`, `formatGuestAccessMessage(...)`

#### Composable (`useUpsellLockAccess.ts`)
`issueAccessForOrder(order)` resolves listing **name** → listing id (the same lookup
`ReservationSmartLocks` uses), calls `findActiveBrandCode` first so several locks of one make share
one code value for the guest, then `generateAccessCode` per lock. Returns
`{ issued, codeIds, skipped?, unmatchedNames }`; `LockAccessSkipReason` is one of
`already_issued | no_access_configured | not_connected | listing_not_found | no_lock_matched`.
`revokeAccessForOrder(order)` is the mirror image. Also exposes `isIssuing`, `issuedCodesFor`,
`hasLiveAccess`, `resolveTargetsForOrder`, `lockAccessConfigFor`.

⚠️ **It never writes to `useUpsellOrders`.** `useUpsellOrders` calls into here, so the ids are
returned and the caller stores them, otherwise the two import each other.
⚠️ **`messageGuest` uses a dynamic `import('./useInbox')`.** `useInbox` imports `useUpsellOrders`,
which calls into here, so a static import would close a cycle. The path is already async, so it
costs nothing. Do not "tidy" it into a top-level import.

#### Lifecycle wiring (`useUpsellOrders.ts`)
- `markPaid()` → `issueLockAccess(id)`, fire-and-forget (the 700ms mock drives the drawer spinner),
  writing `issuedAccessCodeIds` back on resolve. Payment is the trigger: an `always` service is
  approved and paid in one step, a `by_request` one still waits for staff approval first, and
  nobody gets a code before paying
- `declineOrder()` → `revokeAccessForOrder`. `cancelOrder` routes through `declineOrder`, so a
  refunded order can never leave a working code behind

#### Surfaces
- **Service wizard** (`UpsellDrawer.vue`, step 3 "Listings & Availability"): a Smart Lock Access
  switch, then a checkbox list of lock names drawn from the locks paired across the *selected*
  listings, each row stating its reach (`Paired at 3 of 16`). Names that no longer resolve are
  surfaced in an amber panel with a "Remove them" action, never silently dropped (same rule as the
  promo-code scope step). Plus a guest-instructions textarea
- **`UpsellOrderLockAccess.vue`** (`<UpsellsUpsellOrderLockAccess>`): the card in the order
  drawer: code in monospace, brand pill, validity, Copy and Revoke, a spinner while issuing, and a
  distinct empty state per skip reason (not connected / listing unknown / no lock named that here /
  not paid yet / paid but nothing issued, with an "Issue now" retry)
- **Inbox**: one host message into `order.conversationId` when there is one. A missing thread is
  swallowed: the code is already issued and the drawer still shows it
- **Reservation Smart Lock tab**: free, since codes are keyed by `reservationId`; it only needed
  the `purpose` label rendered so staff can see which upsell bought the code
- **Notifications**: `UPSELL_LOCK_ACCESS_ISSUED` (`INFO`) and `UPSELL_LOCK_ACCESS_FAILED`
  (`WARNING`, carrying the reason). Both map to the existing `upsell` notification kind via the
  `UPSELL_` prefix
- **Catalog discoverability**: an amber key badge next to the service name in `UpsellTable.vue`
  (tooltip: "Issues a code for X on payment") plus a **Lock access** select in `UpsellFilterBar.vue`
  backed by `useUpsellServices().filterLockAccess` (`all | lock | no_lock`)

⚠️ **Lock access is an attribute, never a category.** Do not add a `Smart Lock` value to
`UpsellCategory`: a service has exactly one category, so a spa treatment that also opens the spa
door would have to give one of them up. The category list is also duplicated in four places
(`UPSPELL_CATEGORIES`, `categoryBadgeClass` in `UpsellTable.vue`, `UpsellType` in
`finance/data/upsells.ts`, and the hardcoded tag lists in `JurnalIntegration.vue` /
`BexioIntegration.vue`), so a new value silently arrives unmapped in the accounting tags. The
badge and filter above are what a category would have bought, without any of that.

#### Seeded demo services and orders
Services: `svc-011` "Pool & Wellness Area Access" (`always` → instant buy, instant code, unlocks
`Pool Gate`) and `svc-012` "Private Workspace Access" (`by_request`, unlocks `Office Door`).

Orders, both on **The R Villa Merapi** so one property's pairing covers both demos, and both
carrying a `conversationId` so the guest message fires: `ord-012` (Marcus Johnson, `conv-11`,
svc-011, **Awaiting Payment**, one click from a code) and `ord-013` (Alex Rivera, `conv-4`,
svc-012, **Requested**, the approve-then-pay path). Each is listed in its conversation's
`linkedUpsellOrderIds`.

Both still need the Smart Lock integration connected and a lock of the matching name paired at that
listing; otherwise the drawer states exactly why no code was issued.

#### Tests
`tests/lib/upsell-lock-access.spec.ts` (14: name matching, the check-out window and its minimum,
labels, guest message) and `tests/composables/useUpsellLockAccess.spec.ts` (20: issuing, the
check-out end date, brand sharing across same-make locks vs. distinct codes across makes, every
refusal reason, partial issue with a flagged unmatched name, double-issue guard, revoke).
⚠️ Order fixtures use dates **relative to today** and a local `YYYY-MM-DD` formatter, because
`buildAccessWindow` parses check-out as a local date and a fixed 2026 fixture rots into a stay
that already ended. `settle()` fakes timers **before** the call, the only ordering that works
against the 700ms mock.

#### NOT implemented (intentionally out of scope)
- **Guest-side purchase**: the mock has no guest checkout; `UpsellOfferCard`'s "accepted" state is
  display-only, so payment is recorded by staff in the drawer or table
- **Extending an existing code window**: an Early Check-in upsell does not shift the front-door
  code's `startsAt`; this grants access to *additional* locks only
- **Per-item access**: the config lives on the service, not on individual `UpsellItem`s
- **Auto re-issue**: pairing a matching lock *after* an order was paid does not retroactively
  issue the code; the drawer's "Issue now" button is the manual path
