# PRD: Upsell Smart Lock Access

| | |
|---|---|
| **Status** | Shipped (mock), PR #15, merged `e054080` |
| **Date** | 2026-09-09 |
| **Owner** | Komang Juliantara, Guest Relations |
| **Modules** | Upsells, Smart Locks, Inbox, Notifications |
| **Scope** | Mock only. No provider API calls, no guest checkout. |

---

## 1. Problem

Elev8 already sells extras to guests and already opens doors. The two never met.

A property manager with a paired pool gate has no way to sell access to it. The workaround is
manual: the guest asks, staff open the listing, find the lock, generate a code, copy it into the
chat, and remember to revoke it if the guest never pays. Every step is a place to forget one.

Meanwhile the Upsells module can sell anything with a price and a date, but everything it sells
has to be fulfilled by a person. There is no product in the catalog that fulfils itself.

**The opportunity.** Access is the one upsell a property management system can deliver instantly,
at zero marginal cost, at any hour, without waking anyone in Bali. A pool gate code costs the host
nothing and the guest pays IDR 350,000 for it.

## 2. Goals

- Selling access requires no new module, no new order lifecycle, and no second catalog.
- Paying issues the code. No staff step between the two.
- A code that was paid for is revoked when the money is refunded.
- When a code cannot be issued, a human is told which property and which lock, immediately.

### Non-goals

- Replacing the existing manual code generation in listing settings or the reservation panel.
- Any change to how locks are paired, named, or swapped.
- Selling access on channels outside Elev8 (an Airbnb listing cannot carry this).

## 3. Users

| Who | What they do here |
|---|---|
| **Property manager** | Configures which locks a service unlocks, once, per service. |
| **Guest Relations staff** (Komang) | Records payment. Sees the code, copies it, revokes it if needed. |
| **Guest** | Buys the access, receives the code in their existing chat thread. |

## 4. Design decisions

The two calls below shaped everything else and are the ones most likely to be revisited by
someone who was not in the room.

### 4.1 Locks are matched by name, not by lock id

**Chosen.** A service stores `lockNames: ['Pool Gate']`. On payment, the order's listing is
resolved to its paired locks and matched by name, case-insensitively.

**Rejected.** Storing `lockId`s directly.

**Why.** One service covers many listings; a lock belongs to exactly one. A service assigned to
sixteen villas would need sixteen lock ids, re-entered every time a host pairs, unpairs, or swaps
a device. A name survives all three. It also degrades honestly: a name with no lock behind it at a
given property is *reported*, never silently skipped.

**Cost accepted.** Renaming a lock breaks the link. The service wizard surfaces stranded names in
an amber panel with a one-click removal, so the break is visible rather than silent.

### 4.2 Lock access is an attribute on a service, not a category

**Chosen.** `UpsellService.lockAccess?: LockAccessConfig`.

**Rejected.** A `Smart Lock` value in `UpsellCategory`, or a separate catalog.

**Why.** A service has exactly one category. A spa treatment that also opens the spa door would
have to give one of them up, and "Smart Lock" describes how a thing is delivered, not what the
guest is buying. The category list is duplicated in four places (`UPSPELL_CATEGORIES`,
`categoryBadgeClass` in `UpsellTable.vue`, `UpsellType` in `finance/data/upsells.ts`, and the
hardcoded tag lists in `JurnalIntegration.vue` and `BexioIntegration.vue`), so a thirteenth value
would arrive unmapped in the accounting tags. A separate catalog would be worse still: it
duplicates approval, payment, refunds, cancellation policies, and notifications.

**What the category would have bought**, delivered instead as: a key badge on the catalog row and
a **Lock access** filter (`All` / `Grants lock access` / `No lock access`).

### 4.3 Payment is the trigger

**Chosen.** `markPaid()` issues.

**Rejected.** Approval (the guest would hold a working code while the order sits unpaid) and
fulfilment start (it stops being automatic and becomes a staff task).

An `always` service is approved and paid in one step, so the guest experience is buy-then-open. A
`by_request` service still waits for staff approval first. Neither can hand out a code before
payment.

### 4.4 The code lasts the rest of the stay

From payment until **noon on the check-out day**. Access bought mid-stay should still work the
next morning, so the end is pinned to check-out and never to the service date.

## 5. Functional requirements

| # | Requirement | Priority |
|---|---|---|
| FR-1 | A service can be configured with one or more lock names it unlocks, plus optional guest instructions. | Must |
| FR-2 | The lock picker offers only names of locks actually paired across the service's assigned listings, each row stating its reach ("Paired at 3 of 16"). | Must |
| FR-3 | Recording payment issues one code per matching lock at the order's property. | Must |
| FR-4 | The code is valid from payment until noon on the check-out day, with a 2-hour floor for a late purchase and a 24-hour fallback when no check-out date exists. | Must |
| FR-5 | Locks of the same brand reuse the guest's existing code value, so one number opens every lock of that make. | Must |
| FR-6 | Marking an already-paid order paid again must not issue a second code. | Must |
| FR-7 | Declining or cancelling an order revokes every code it issued. | Must |
| FR-8 | Every refusal to issue raises a staff notification naming the property and the reason. | Must |
| FR-9 | The order drawer shows each issued code with Copy and Revoke, and states the specific reason when none was issued. | Must |
| FR-10 | When the order came from the inbox, the code is posted into that thread as a host message. | Should |
| FR-11 | Issued codes appear in the reservation's Smart Lock tab labelled with the upsell that bought them. | Should |
| FR-12 | The catalog marks lock-granting services with a badge and can filter to them. | Should |
| FR-13 | A service naming a lock the property does not have still issues codes for the locks it does have, and flags the rest. | Should |

## 6. Lifecycle

```
requested ──approve──► awaiting_payment ──mark paid──► paid_in_progress ──► completed
    │                        │                   │
    └────────decline─────────┴───────────────────┴──► declined
                                                 │
                        ISSUE ◄──────────────────┘
                        REVOKE ◄── decline / cancel
```

`cancelOrder` routes through `declineOrder`, so refund and revocation cannot diverge.

## 7. Failure modes

Every refusal is named, not swallowed. The order drawer renders one state per reason.

| Reason | What staff sees |
|---|---|
| `no_access_configured` | Nothing. The card does not render for a service that grants no access. |
| `not_connected` | "Smart Lock is not connected, so no code can be issued", with a link to Integrations. |
| `listing_not_found` | The order names a property that no longer resolves to a listing. |
| `no_lock_matched` | Amber panel naming the lock the service wants and the property that lacks it. |
| `already_issued` | The existing codes, not a duplicate. |
| Paid, nothing issued | An **Issue now** button to retry by hand. |

Two alert types back this: `UPSELL_LOCK_ACCESS_ISSUED` (INFO, names the locks opened) and
`UPSELL_LOCK_ACCESS_FAILED` (WARNING, carries the reason). Both land in the existing `upsell`
notification kind.

## 8. Surfaces

| Surface | What it does |
|---|---|
| Service wizard, step 3 | Toggle, lock-name picker with coverage, guest instructions. |
| Order drawer | The code card: monospace code, brand pill, validity, Copy, Revoke, per-reason empty states. |
| Inbox thread | One host message with the lock, code, expiry, and instructions. |
| Reservation Smart Lock tab | The code alongside the reservation's others, labelled `Upsell · <service>`. |
| Notification bell | Issued and failed alerts. |
| Catalog table and filter | Key badge, and a Lock access filter. |

## 9. Data model

```ts
interface LockAccessConfig {
  enabled: boolean
  lockNames: string[]     // matched case-insensitively against paired lock names
  instructions?: string   // appended to the guest message
}

// UpsellService gains
lockAccess?: LockAccessConfig

// UpsellOrder gains
issuedAccessCodeIds?: string[]  // also the idempotency guard
```

Both fields are optional, so no existing service or order needs migrating.

### Architecture

- `app/components/upsells/data/lock-access.ts` holds the rules, framework-free, taking a
  structural `LockLike` so it is testable without the smart-lock store.
- `app/composables/useUpsellLockAccess.ts` performs the effect. It returns the new code ids rather
  than writing to `useUpsellOrders`, because `useUpsellOrders` calls into it.
- The inbox is reached through a dynamic `import('./useInbox')`. `useInbox` imports
  `useUpsellOrders`, so a static import would close a cycle.

## 10. Demo data

Services: `svc-011` Pool & Wellness Area Access (IDR 350,000, always available, unlocks
`Pool Gate`) and `svc-012` Private Workspace Access (IDR 500,000, by request, unlocks
`Office Door`).

Orders, both on The R Villa Merapi so one pairing covers both: `ord-012` (Marcus Johnson,
`conv-11`, Awaiting Payment) and `ord-013` (Alex Rivera, `conv-4`, Requested).

## 11. Out of scope

- **Guest-side purchase.** The mock has no checkout; `UpsellOfferCard`'s accepted state is display
  only, so payment is recorded by staff.
- **Extending an existing window.** An Early Check-in upsell does not shift the front-door code's
  start. This grants access to *additional* locks.
- **Per-item access.** The config lives on the service, not on individual items.
- **Auto re-issue.** Pairing a matching lock after an order was paid does not retroactively issue
  the code. The drawer's Issue now button is the manual path.
- **Real provider calls.** `generateAccessCode` is a 700ms mock.

## 12. Success metrics

| Metric | Why |
|---|---|
| Attach rate on access services vs. staff-fulfilled services | Tests the premise that instant delivery converts better. |
| Median time from payment to guest holding the code | Target: under a minute. The manual baseline is hours. |
| Share of paid access orders that raise `UPSELL_LOCK_ACCESS_FAILED` | A high rate means the naming model is failing in practice. |
| Codes revoked by staff after issue | A high rate means the window or the trigger is wrong. |

## 13. Open questions

1. **Renames.** Should renaming a lock offer to update the services that name it?
2. **Retroactive issue.** Should pairing a lock scan for already-paid orders that wanted it?
3. **Guest self-service.** When a real checkout exists, does the code appear in the guest guide
   rather than the chat?
4. **Per-room access.** Locks can be room-scoped. Should a service be able to target the guest's
   own room rather than a named lock?

## 14. Testing

34 tests across `tests/lib/upsell-lock-access.spec.ts` (name matching, window and its floor,
labels, guest message) and `tests/composables/useUpsellLockAccess.spec.ts` (issuing, brand sharing,
every refusal reason, partial issue, double-issue guard, revoke, catalog filter).

Order fixtures use dates relative to today and a local `YYYY-MM-DD` formatter, because
`buildAccessWindow` parses check-out as a local date and a fixed fixture rots into a stay that
already ended. `settle()` fakes timers before the call, the only ordering that works against the
700ms mock.
