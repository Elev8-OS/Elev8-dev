# Reservation Folio Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let front-office staff post and remove chargeable items on a guest reservation from the reservation detail sheet, with a live folio total and a per-item paid state.

**Architecture:** A framework-free rules module (`data/folio.ts`) owns all arithmetic and state rules. A single composable (`useReservationFolio`) is the only writer, patching through the existing `updateReservation(id, patch)` so each posting and its activity entry land in one mutation. Three Vue components render it inside the existing `ReservationDetailSheet`. The upsell catalog is read as a price list and never written to.

**Tech Stack:** Nuxt 3, Vue 3, shadcn-vue, Tailwind v4, Vitest with @vue/test-utils.

**Spec:** `docs/superpowers/specs/2026-09-09-reservation-folio-items-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `app/components/reservations/data/folio.ts` (create) | Types, line arithmetic, summary, state rules, validation, factories, catalog rows, activity events. No reactive state, no store imports. |
| `app/components/reservations/data/reservations.ts` (modify) | Add `folioItems?: FolioItem[]` to `ReservationEntry`; seed three items. |
| `app/composables/useReservationFolio.ts` (create) | The only writer. Reads `useUpsellServices`, writes via `useReservationsModule`. |
| `app/components/reservations/FolioAddItemDialog.vue` (create) | Catalog picker plus custom-item form. |
| `app/components/reservations/FolioVoidDialog.vue` (create) | Reason prompt for voiding a paid item. |
| `app/components/reservations/ReservationFolioSection.vue` (create) | The folio accordion: booked lines, staff items, totals. |
| `app/components/reservations/ReservationDetailSheet.vue` (modify) | Mount the section after the Rooms accordion. |
| `tests/lib/reservation-folio.spec.ts` (create) | The rules module. |
| `tests/composables/useReservationFolio.spec.ts` (create) | The writer. |
| `tests/components/reservations/ReservationFolio.spec.ts` (create) | The three components. |
| `CLAUDE.md` (modify) | Document the module. |

**How to run tests:** there is no `test` script in `package.json`. Use `npx vitest run <path>`.

---

## Task 1: Folio types and line arithmetic

**Files:**
- Create: `app/components/reservations/data/folio.ts`
- Test: `tests/lib/reservation-folio.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/reservation-folio.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  folioLineNet,
  folioLineService,
  folioLineTax,
  folioLineTotal,
} from '~/components/reservations/data/folio'

/** A priceable line. Only the four pricing fields are needed. */
function line(over: Partial<{ quantity: number, unitPrice: number, taxPercent: number, servicePercent: number }> = {}) {
  return { quantity: 1, unitPrice: 0, taxPercent: 0, servicePercent: 0, ...over }
}

describe('folio line arithmetic', () => {
  it('multiplies quantity by unit price for the net', () => {
    expect(folioLineNet(line({ quantity: 2, unitPrice: 6 }))).toBe(12)
  })

  it('applies tax and service to the net in parallel, never compounded', () => {
    const item = line({ quantity: 1, unitPrice: 100, taxPercent: 11, servicePercent: 5 })

    expect(folioLineTax(item)).toBe(11)
    expect(folioLineService(item)).toBe(5)
    // Compounding would make this 116.55 instead of 116.
    expect(folioLineTotal(item)).toBe(116)
  })

  it('rounds to the currency minor unit, not the whole unit', () => {
    // A CHF 6.00 beer at 10 percent owes 0.60, not 1.
    expect(folioLineTax(line({ quantity: 1, unitPrice: 6, taxPercent: 10 }))).toBe(0.6)
    expect(folioLineTotal(line({ quantity: 1, unitPrice: 6, taxPercent: 10 }))).toBe(6.6)
  })

  it('prices a whole-unit currency line without stray decimals', () => {
    const item = line({ quantity: 1, unitPrice: 350000, taxPercent: 11, servicePercent: 5 })

    expect(folioLineTotal(item)).toBe(406000)
  })

  it('treats a zero-percent line as its net', () => {
    expect(folioLineTotal(line({ quantity: 3, unitPrice: 4 }))).toBe(12)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: FAIL, cannot resolve `~/components/reservations/data/folio`.

- [ ] **Step 3: Write the minimal implementation**

Create `app/components/reservations/data/folio.ts`:

```ts
export type FolioItemStatus = 'unpaid' | 'paid' | 'voided'
export type FolioPaymentMethod = 'cash' | 'card' | 'room'
export type FolioItemSource = 'catalog' | 'custom'

export interface FolioItem {
  id: string
  label: string
  quantity: number
  unitPrice: number
  taxPercent: number
  servicePercent: number
  note?: string
  source: FolioItemSource
  /** Provenance only, never a live join back into the catalog. */
  catalogServiceId?: string
  catalogItemId?: string
  status: FolioItemStatus
  paymentMethod?: FolioPaymentMethod
  /**
   * When the money was actually collected. Survives a void on purpose: a paid
   * item that gets voided still owes the guest a refund, and that falls out of
   * the summary arithmetic only if the collection is still on record.
   */
  paidAt?: string
  voidReason?: string
  voidedAt?: string
  voidedBy?: string
  addedBy: string
  addedAt: string
}

/** The four fields a line needs to price itself. Structural so a draft prices too. */
export type FolioPriceable = Pick<FolioItem, 'quantity' | 'unitPrice' | 'taxPercent' | 'servicePercent'>

export const FOLIO_PAYMENT_METHOD_LABELS: Record<FolioPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  room: 'Charge to room',
}

/** Round to the currency's minor unit. IDR amounts are whole already. */
export function roundFolioAmount(value: number): number {
  return Math.round(value * 100) / 100
}

export function folioLineNet(item: FolioPriceable): number {
  return roundFolioAmount(item.quantity * item.unitPrice)
}

export function folioLineTax(item: FolioPriceable): number {
  return roundFolioAmount(folioLineNet(item) * (item.taxPercent / 100))
}

export function folioLineService(item: FolioPriceable): number {
  return roundFolioAmount(folioLineNet(item) * (item.servicePercent / 100))
}

export function folioLineTotal(item: FolioPriceable): number {
  return roundFolioAmount(folioLineNet(item) + folioLineTax(item) + folioLineService(item))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/data/folio.ts tests/lib/reservation-folio.spec.ts
git commit -m "feat(reservations): folio item type and line arithmetic"
```

---

## Task 2: Booking total and folio summary

The summary has to agree with what the detail sheet already renders above it, so the payment fee is computed exactly as `ReservationRoomsSection.vue:460` does: 3 percent of the room lines for `card`, `paymentCustomFeePct` for `manual`, nothing otherwise. Paid and balance cover the extras only, because nothing on `ReservationEntry` records whether the booking itself was settled.

**Files:**
- Modify: `app/components/reservations/data/folio.ts`
- Test: `tests/lib/reservation-folio.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/reservation-folio.spec.ts`. Add `buildFolioSummary` and `folioBookingTotal` to the existing import block, and add this above the new describe block:

```ts
import type { FolioItem } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'

/** A reservation carrying only what the folio reads. */
function reservation(over: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    id: 'res-test',
    guestId: 'guest-test',
    guestName: 'Test Guest',
    guestEmail: 't@example.com',
    guestPhone: '+10000000000',
    guestLanguage: 'English',
    guestNotes: '',
    listingId: 'lst-2',
    listingName: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    channel: 'Direct',
    checkIn: '2026-09-08',
    checkOut: '2026-09-12',
    nights: 4,
    guestCount: 2,
    totalPrice: 640,
    currency: 'USD',
    status: 'checked_in',
    activity: [],
    ...over,
  }
}

function folioItem(over: Partial<FolioItem> = {}): FolioItem {
  return {
    id: 'fol-test',
    label: 'Minibar - Beer',
    quantity: 1,
    unitPrice: 6,
    taxPercent: 0,
    servicePercent: 0,
    source: 'custom',
    status: 'unpaid',
    addedBy: 'Komang Juliantara',
    addedAt: '2026-09-09T10:00:00Z',
    ...over,
  }
}
```

```ts
describe('folio booking total', () => {
  it('uses totalPrice when the reservation has no room lines', () => {
    expect(folioBookingTotal(reservation())).toBe(640)
  })

  it('folds room lines, charges and the card payment fee', () => {
    const r = reservation({
      totalPrice: 1000,
      paymentFeeMode: 'card',
      rooms: [
        { id: 'r1', unitTypeId: 'ut-1', unitId: 'un-1', unitName: 'Master Suite', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 700 },
        { id: 'r2', unitTypeId: 'ut-1', unitId: 'un-2', unitName: 'Garden Room', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 75, lineTotal: 300 },
      ],
      charges: [
        { id: 'chg-1', kind: 'cleaning', label: 'Cleaning Fee', amount: 85 },
        { id: 'chg-2', kind: 'city_tax', label: 'City Tax', amount: 25 },
      ],
    })

    // 1000 rooms + 110 charges + 30 card fee
    expect(folioBookingTotal(r)).toBe(1140)
  })

  it('applies the custom percentage for a manual payment fee', () => {
    const r = reservation({
      paymentFeeMode: 'manual',
      paymentCustomFeePct: 1.5,
      rooms: [{ id: 'r1', unitTypeId: 'ut-1', unitId: 'un-1', unitName: 'Suite', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 400 }],
    })

    expect(folioBookingTotal(r)).toBe(406)
  })
})

describe('buildFolioSummary', () => {
  it('reports zeros for extras when nothing has been posted', () => {
    const summary = buildFolioSummary(reservation())

    expect(summary.itemsTotal).toBe(0)
    expect(summary.itemsPaid).toBe(0)
    expect(summary.itemsBalance).toBe(0)
    expect(summary.refundDue).toBe(0)
    expect(summary.grandTotal).toBe(640)
  })

  it('adds live items to the grand total and leaves them owing', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [
        folioItem({ id: 'f1', quantity: 2, unitPrice: 6 }),
        folioItem({ id: 'f2', label: 'Laundry', unitPrice: 4 }),
      ],
    }))

    expect(summary.itemsTotal).toBe(16)
    expect(summary.grandTotal).toBe(656)
    expect(summary.itemsBalance).toBe(16)
  })

  it('counts a paid item as collected so it leaves the balance', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [
        folioItem({ id: 'f1', unitPrice: 12, status: 'paid', paymentMethod: 'cash', paidAt: '2026-09-09T11:00:00Z' }),
        folioItem({ id: 'f2', label: 'Laundry', unitPrice: 4 }),
      ],
    }))

    expect(summary.itemsTotal).toBe(16)
    expect(summary.itemsPaid).toBe(12)
    expect(summary.itemsBalance).toBe(4)
  })

  it('leaves a charge-to-room item owing, since nothing was collected', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [folioItem({ unitPrice: 18, paymentMethod: 'room' })],
    }))

    expect(summary.itemsPaid).toBe(0)
    expect(summary.itemsBalance).toBe(18)
  })

  it('drops a voided unpaid item out of the total with no refund', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [folioItem({ unitPrice: 18, status: 'voided', voidReason: 'wrong room' })],
    }))

    expect(summary.itemsTotal).toBe(0)
    expect(summary.voidedTotal).toBe(18)
    expect(summary.itemsBalance).toBe(0)
    expect(summary.refundDue).toBe(0)
  })

  it('turns a voided paid item into a refund due', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [folioItem({
        unitPrice: 18,
        status: 'voided',
        paymentMethod: 'cash',
        paidAt: '2026-09-09T11:00:00Z',
        voidReason: 'charged twice',
      })],
    }))

    expect(summary.itemsTotal).toBe(0)
    expect(summary.itemsPaid).toBe(18)
    expect(summary.itemsBalance).toBe(-18)
    expect(summary.refundDue).toBe(18)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: FAIL, `buildFolioSummary is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `app/components/reservations/data/folio.ts`. Add the type import at the top of the file, above the type declarations:

```ts
import type { ReservationEntry } from '~/components/reservations/data/reservations'
```

```ts
export interface FolioSummary {
  /** Room lines, charges and the payment fee, or totalPrice when there are no rooms. */
  bookingTotal: number
  /** Live (non-voided) staff items. */
  itemsTotal: number
  /** Voided staff items, kept for display only. */
  voidedTotal: number
  grandTotal: number
  /** Extras actually collected, including a voided item that had been paid. */
  itemsPaid: number
  itemsBalance: number
  refundDue: number
}

/** Mirrors ReservationRoomsSection.vue:460 so the folio cannot disagree with it. */
export function folioPaymentFee(reservation: ReservationEntry, roomLinesTotal: number): number {
  if (reservation.paymentFeeMode === 'card')
    return roundFolioAmount(roomLinesTotal * 0.03)
  if (reservation.paymentFeeMode === 'manual')
    return roundFolioAmount(roomLinesTotal * ((reservation.paymentCustomFeePct ?? 0) / 100))
  return 0
}

export function folioBookingTotal(reservation: ReservationEntry): number {
  if (!reservation.rooms?.length)
    return reservation.totalPrice

  const rooms = reservation.rooms.reduce((sum, line) => sum + line.lineTotal, 0)
  const charges = (reservation.charges ?? []).reduce((sum, charge) => sum + charge.amount, 0)
  return roundFolioAmount(rooms + charges + folioPaymentFee(reservation, rooms))
}

export function buildFolioSummary(reservation: ReservationEntry): FolioSummary {
  const items = reservation.folioItems ?? []
  const sum = (list: FolioItem[]) => roundFolioAmount(list.reduce((total, item) => total + folioLineTotal(item), 0))

  const bookingTotal = folioBookingTotal(reservation)
  const itemsTotal = sum(items.filter(item => item.status !== 'voided'))
  const voidedTotal = sum(items.filter(item => item.status === 'voided'))
  // paidAt, not status: a voided item that was paid still owes a refund.
  const itemsPaid = sum(items.filter(item => Boolean(item.paidAt)))
  const itemsBalance = roundFolioAmount(itemsTotal - itemsPaid)

  return {
    bookingTotal,
    itemsTotal,
    voidedTotal,
    grandTotal: roundFolioAmount(bookingTotal + itemsTotal),
    itemsPaid,
    itemsBalance,
    refundDue: itemsBalance < 0 ? roundFolioAmount(-itemsBalance) : 0,
  }
}
```

Note: `folioItems` is added to `ReservationEntry` in Task 5. Until then TypeScript flags `reservation.folioItems`. That is expected; the test passes because Vitest does not typecheck. Do not add a cast to silence it. Task 5 removes the error.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/data/folio.ts tests/lib/reservation-folio.spec.ts
git commit -m "feat(reservations): folio booking total and summary"
```

---

## Task 3: State rules, validation and item factories

**Files:**
- Modify: `app/components/reservations/data/folio.ts`
- Test: `tests/lib/reservation-folio.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/reservation-folio.spec.ts`, adding `canDeleteFolioItem`, `canVoidFolioItem`, `createDefaultFolioItemDraft`, `folioDraftFromCatalog`, `folioItemFromDraft`, `isFolioItemDraftValid` and `validateFolioItemDraft` to the import block:

```ts
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'

describe('folio state rules', () => {
  it('lets an unpaid item be removed but not voided', () => {
    const item = folioItem()

    expect(canDeleteFolioItem(item)).toBe(true)
    expect(canVoidFolioItem(item)).toBe(false)
  })

  it('lets a paid item be voided but not removed', () => {
    const item = folioItem({ status: 'paid', paidAt: '2026-09-09T11:00:00Z' })

    expect(canDeleteFolioItem(item)).toBe(false)
    expect(canVoidFolioItem(item)).toBe(true)
  })

  it('keeps a charge-to-room item removable, since it is still unpaid', () => {
    expect(canDeleteFolioItem(folioItem({ paymentMethod: 'room' }))).toBe(true)
  })

  it('allows neither action on a voided item', () => {
    const item = folioItem({ status: 'voided', voidReason: 'duplicate' })

    expect(canDeleteFolioItem(item)).toBe(false)
    expect(canVoidFolioItem(item)).toBe(false)
  })
})

describe('validateFolioItemDraft', () => {
  it('accepts a complete draft', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: 'Minibar - Beer', quantity: 2, unitPrice: 6 }

    expect(validateFolioItemDraft(draft)).toEqual({})
    expect(isFolioItemDraftValid(draft)).toBe(true)
  })

  it('rejects a blank or whitespace label', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: '   ', unitPrice: 6 }

    expect(validateFolioItemDraft(draft).label).toBeTruthy()
  })

  it('rejects a quantity below one and a price at or below zero', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: 'Laundry', quantity: 0, unitPrice: 0 }
    const errors = validateFolioItemDraft(draft)

    expect(errors.quantity).toBeTruthy()
    expect(errors.unitPrice).toBeTruthy()
  })

  it('rejects percentages outside 0 to 100', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: 'Spa', unitPrice: 80, taxPercent: 120, servicePercent: -1 }
    const errors = validateFolioItemDraft(draft)

    expect(errors.taxPercent).toBeTruthy()
    expect(errors.servicePercent).toBeTruthy()
  })
})

describe('folioDraftFromCatalog', () => {
  const service = mockUpsellServices.find(s => s.id === 'svc-001')!
  const item = service.items[0]!

  it('copies the price and both percentages when the currency matches', () => {
    const draft = folioDraftFromCatalog(service, item, 'IDR')

    expect(draft.unitPrice).toBe(item.price)
    expect(draft.taxPercent).toBe(service.taxPercent)
    expect(draft.servicePercent).toBe(service.servicePercent)
    expect(draft.source).toBe('catalog')
    expect(draft.catalogServiceId).toBe('svc-001')
    expect(draft.catalogItemId).toBe(item.id)
    expect(draft.label).toContain(service.name)
    expect(draft.label).toContain(item.name)
  })

  it('leaves the price empty across currencies rather than inventing a rate', () => {
    const draft = folioDraftFromCatalog(service, item, 'USD')

    expect(draft.unitPrice).toBe(0)
    // The percentages still transfer; only the amount needs a human.
    expect(draft.taxPercent).toBe(service.taxPercent)
  })

  it('leaves the price empty when the service does not price its items', () => {
    const draft = folioDraftFromCatalog({ ...service, pricingEnabled: false }, item, 'IDR')

    expect(draft.unitPrice).toBe(0)
    expect(draft.taxPercent).toBe(0)
    expect(draft.servicePercent).toBe(0)
  })
})

describe('folioItemFromDraft', () => {
  it('posts an unpaid item stamped with the actor', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: '  Minibar - Beer  ', quantity: 2, unitPrice: 6 }
    const item = folioItemFromDraft(draft, 'Komang Juliantara', '2026-09-09T10:00:00Z')

    expect(item.label).toBe('Minibar - Beer')
    expect(item.status).toBe('unpaid')
    expect(item.paidAt).toBeUndefined()
    expect(item.addedBy).toBe('Komang Juliantara')
    expect(item.addedAt).toBe('2026-09-09T10:00:00Z')
    expect(item.id).toBeTruthy()
  })

  it('gives each posting its own id', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: 'Beer', unitPrice: 6 }

    expect(folioItemFromDraft(draft, 'A').id).not.toBe(folioItemFromDraft(draft, 'A').id)
  })

  it('snapshots the catalog price so a later price change cannot rewrite it', () => {
    const service = { ...mockUpsellServices.find(s => s.id === 'svc-001')! }
    const catalogItem = { ...service.items[0]! }
    const draft = folioDraftFromCatalog(service, catalogItem, 'IDR')
    const posted = folioItemFromDraft(draft, 'Komang Juliantara')

    catalogItem.price = 999999
    service.taxPercent = 50

    expect(posted.unitPrice).toBe(350000)
    expect(posted.taxPercent).toBe(11)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: FAIL, `canDeleteFolioItem is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `app/components/reservations/data/folio.ts`. Add the catalog type import to the top of the file:

```ts
import type { UpsellItem, UpsellService } from '~/components/upsells/data/upsell-services'
```

```ts
export interface FolioItemDraft {
  label: string
  quantity: number
  unitPrice: number
  taxPercent: number
  servicePercent: number
  note?: string
  source: FolioItemSource
  catalogServiceId?: string
  catalogItemId?: string
}

export type FolioDraftField = 'label' | 'quantity' | 'unitPrice' | 'taxPercent' | 'servicePercent'
export type FolioDraftErrors = Partial<Record<FolioDraftField, string>>

export function canDeleteFolioItem(item: FolioItem): boolean {
  return item.status === 'unpaid'
}

export function canVoidFolioItem(item: FolioItem): boolean {
  return item.status === 'paid'
}

export function validateFolioItemDraft(draft: FolioItemDraft): FolioDraftErrors {
  const errors: FolioDraftErrors = {}

  if (!draft.label.trim())
    errors.label = 'Give the item a name.'
  if (!Number.isFinite(draft.quantity) || draft.quantity < 1)
    errors.quantity = 'Quantity must be at least 1.'
  if (!Number.isFinite(draft.unitPrice) || draft.unitPrice <= 0)
    errors.unitPrice = 'Enter a price above 0.'
  if (!Number.isFinite(draft.taxPercent) || draft.taxPercent < 0 || draft.taxPercent > 100)
    errors.taxPercent = 'Tax must be between 0 and 100.'
  if (!Number.isFinite(draft.servicePercent) || draft.servicePercent < 0 || draft.servicePercent > 100)
    errors.servicePercent = 'Service must be between 0 and 100.'

  return errors
}

export function isFolioItemDraftValid(draft: FolioItemDraft): boolean {
  return Object.keys(validateFolioItemDraft(draft)).length === 0
}

export function createDefaultFolioItemDraft(): FolioItemDraft {
  return {
    label: '',
    quantity: 1,
    unitPrice: 0,
    taxPercent: 0,
    servicePercent: 0,
    note: '',
    source: 'custom',
  }
}

/**
 * A catalog pick is a snapshot. The price transfers only when it can be charged
 * as-is: same currency, and the service actually prices its items. Otherwise the
 * amount is left for staff, because no exchange rate belongs on a guest's bill.
 *
 * A service with `pricingEnabled: false` lends no percentages either, matching
 * `UpsellOrderCreator.vue:79`, which bills zero tax and zero service for one.
 */
export function folioDraftFromCatalog(service: UpsellService, item: UpsellItem, reservationCurrency: string): FolioItemDraft {
  const usablePrice = service.pricingEnabled && service.currency === reservationCurrency

  return {
    label: `${service.name} · ${item.name}`,
    quantity: 1,
    unitPrice: usablePrice ? item.price : 0,
    taxPercent: service.pricingEnabled ? service.taxPercent : 0,
    servicePercent: service.pricingEnabled ? service.servicePercent : 0,
    note: '',
    source: 'catalog',
    catalogServiceId: service.id,
    catalogItemId: item.id,
  }
}

let folioIdCounter = 0

export function generateFolioItemId(): string {
  folioIdCounter += 1
  return `fol-${Date.now().toString(36)}-${folioIdCounter}`
}

export function folioItemFromDraft(draft: FolioItemDraft, actor: string, now: string = new Date().toISOString()): FolioItem {
  return {
    id: generateFolioItemId(),
    label: draft.label.trim(),
    quantity: draft.quantity,
    unitPrice: draft.unitPrice,
    taxPercent: draft.taxPercent,
    servicePercent: draft.servicePercent,
    note: draft.note?.trim() || undefined,
    source: draft.source,
    catalogServiceId: draft.catalogServiceId,
    catalogItemId: draft.catalogItemId,
    status: 'unpaid',
    addedBy: actor,
    addedAt: now,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: PASS, 28 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/data/folio.ts tests/lib/reservation-folio.spec.ts
git commit -m "feat(reservations): folio state rules, validation and factories"
```

---

## Task 4: Catalog rows and activity events

`UpsellService.assignedListings` holds listing **names**, not ids (`upsell-services.ts:313`), so the match is against `reservation.listingName`.

**Files:**
- Modify: `app/components/reservations/data/folio.ts`
- Test: `tests/lib/reservation-folio.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/reservation-folio.spec.ts`, adding `filterFolioCatalogRows`, `folioActivityEvent` and `folioCatalogRows` to the import block:

```ts
describe('folioCatalogRows', () => {
  it('lists items of active services offered at the property, by listing name', () => {
    const rows = folioCatalogRows(mockUpsellServices, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'IDR')

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.itemId && row.serviceName)).toBe(true)
    // svc-002 is assigned to five other villas only.
    expect(rows.some(row => row.serviceId === 'svc-002')).toBe(false)
  })

  it('returns nothing for a property no service is assigned to', () => {
    expect(folioCatalogRows(mockUpsellServices, 'Villa Nowhere', 'IDR')).toEqual([])
  })

  it('skips inactive services', () => {
    const services = mockUpsellServices.map(s => ({ ...s, status: 'inactive' as const }))

    expect(folioCatalogRows(services, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'IDR')).toEqual([])
  })

  it('flags a row whose price cannot be used as-is on this folio', () => {
    const same = folioCatalogRows(mockUpsellServices, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'IDR')
    const across = folioCatalogRows(mockUpsellServices, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'USD')

    expect(same.every(row => row.needsPrice === false)).toBe(true)
    expect(across.every(row => row.needsPrice === true)).toBe(true)
    // The catalog is still offered across currencies, not hidden.
    expect(across.length).toBe(same.length)
  })

  it('matches the query against service name, item name and description', () => {
    const rows = folioCatalogRows(mockUpsellServices, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'IDR')

    expect(filterFolioCatalogRows(rows, 'sedan').length).toBe(1)
    expect(filterFolioCatalogRows(rows, 'AIRPORT').length).toBeGreaterThan(0)
    expect(filterFolioCatalogRows(rows, '')).toEqual(rows)
  })
})

describe('folioActivityEvent', () => {
  it('records a posting with the actor, the label and the amount', () => {
    const item = folioItem({ quantity: 2, unitPrice: 6 })
    const event = folioActivityEvent('added', item, 'Komang Juliantara', 'USD', '2026-09-09T10:00:00Z')

    expect(event.type).toBe('reservation')
    expect(event.actor).toBe('Komang Juliantara')
    expect(event.timestamp).toBe('2026-09-09T10:00:00Z')
    expect(event.title).toBe('Folio item added')
    expect(event.description).toContain('Minibar - Beer')
    expect(event.description).toContain('12')
    expect(event.id).toBeTruthy()
  })

  it('names the payment method when money is collected', () => {
    const item = folioItem({ status: 'paid', paymentMethod: 'cash', paidAt: '2026-09-09T11:00:00Z' })
    const event = folioActivityEvent('paid', item, 'Komang Juliantara', 'USD')

    expect(event.title).toBe('Folio item paid')
    expect(event.description).toContain('Cash')
    expect(event.colorDot).toBe('green')
  })

  it('carries the reason when an item is voided', () => {
    const item = folioItem({ status: 'voided', voidReason: 'charged twice' })
    const event = folioActivityEvent('voided', item, 'Komang Juliantara', 'USD')

    expect(event.title).toBe('Folio item voided')
    expect(event.description).toContain('charged twice')
  })

  it('says the charge was deferred rather than collected', () => {
    const item = folioItem({ paymentMethod: 'room' })
    const event = folioActivityEvent('deferred', item, 'Komang Juliantara', 'USD')

    expect(event.title).toBe('Folio item charged to room')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: FAIL, `folioCatalogRows is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `app/components/reservations/data/folio.ts`. Add the activity type import to the top of the file:

```ts
import type { ActivityEvent } from '~/components/inbox/data/conversations'
```

```ts
export interface FolioCatalogRow {
  serviceId: string
  serviceName: string
  itemId: string
  itemName: string
  description?: string
  price: number
  /** The service's own currency, which may not be the folio's. */
  currency: string
  /** The price cannot be charged as-is: another currency, or an unpriced service. */
  needsPrice: boolean
}

/**
 * Catalog rows offered at this property. assignedListings holds listing NAMES,
 * not ids, so the caller passes reservation.listingName.
 */
export function folioCatalogRows(services: UpsellService[], listingName: string, reservationCurrency: string): FolioCatalogRow[] {
  return services
    .filter(service => service.status === 'active' && service.assignedListings.includes(listingName))
    .flatMap(service => service.items.map(item => ({
      serviceId: service.id,
      serviceName: service.name,
      itemId: item.id,
      itemName: item.name,
      description: item.description,
      price: item.price,
      currency: service.currency,
      needsPrice: !service.pricingEnabled || service.currency !== reservationCurrency,
    })))
}

export function filterFolioCatalogRows(rows: FolioCatalogRow[], query: string): FolioCatalogRow[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return rows

  return rows.filter(row =>
    `${row.serviceName} ${row.itemName} ${row.description ?? ''}`.toLowerCase().includes(q))
}

export type FolioActivityKind = 'added' | 'paid' | 'deferred' | 'removed' | 'voided'

const folioActivityTitles: Record<FolioActivityKind, string> = {
  added: 'Folio item added',
  paid: 'Folio item paid',
  deferred: 'Folio item charged to room',
  removed: 'Folio item removed',
  voided: 'Folio item voided',
}

const folioActivityColors: Record<FolioActivityKind, ActivityEvent['colorDot']> = {
  added: 'blue',
  paid: 'green',
  deferred: 'blue',
  removed: 'gray',
  voided: 'gray',
}

export function folioActivityEvent(
  kind: FolioActivityKind,
  item: FolioItem,
  actor: string,
  currency: string,
  now: string = new Date().toISOString(),
): ActivityEvent {
  const amount = `${folioLineTotal(item).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
  const parts = [`${item.label} · ${item.quantity} × ${item.unitPrice} = ${amount}`]

  if (kind === 'paid' && item.paymentMethod)
    parts.push(FOLIO_PAYMENT_METHOD_LABELS[item.paymentMethod])
  if (kind === 'voided' && item.voidReason)
    parts.push(`Reason: ${item.voidReason}`)

  return {
    id: `act-fol-${item.id}-${kind}`,
    type: 'reservation',
    title: folioActivityTitles[kind],
    description: parts.join(' · '),
    actor,
    timestamp: now,
    colorDot: folioActivityColors[kind],
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: PASS, 37 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/data/folio.ts tests/lib/reservation-folio.spec.ts
git commit -m "feat(reservations): folio catalog rows and activity events"
```

---

## Task 5: Attach folioItems to the reservation and seed the states

Seeds go on `res-3` (Emily Chen, `checked_in`, USD, `lst-2`, has `priceDetails`) so all three states are visible on a stay that is actually in house.

**Files:**
- Modify: `app/components/reservations/data/reservations.ts` (type at line ~142, seed at line ~882)
- Test: `tests/lib/reservation-folio.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/reservation-folio.spec.ts`, adding `initialReservations` to the imports:

```ts
import { initialReservations } from '~/components/reservations/data/reservations'

describe('seeded folio items', () => {
  const seeded = initialReservations.find(r => r.id === 'res-3')!

  it('gives the in-house stay one item in each state', () => {
    const statuses = (seeded.folioItems ?? []).map(item => item.status)

    expect(statuses).toContain('unpaid')
    expect(statuses).toContain('paid')
    expect(statuses).toContain('voided')
  })

  it('leaves the seeded stay with a refund due from the voided paid item', () => {
    const summary = buildFolioSummary(seeded)

    expect(summary.refundDue).toBeGreaterThan(0)
    expect(summary.itemsTotal).toBeGreaterThan(0)
  })

  it('keeps priceDetails.extras in step with the live items', () => {
    const summary = buildFolioSummary(seeded)

    expect(seeded.priceDetails?.extras).toBe(summary.itemsTotal)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: FAIL, `statuses` is empty so `toContain('unpaid')` fails.

- [ ] **Step 3: Write the minimal implementation**

In `app/components/reservations/data/reservations.ts`, add the type import at the top of the file, next to the existing `ActivityEvent` import:

```ts
import type { FolioItem } from '~/components/reservations/data/folio'
```

Add the field to `ReservationEntry`, directly after `charges?: ReservationCharge[]`:

```ts
  /**
   * Items posted on the stay by staff (minibar, laundry, a spa slot booked at
   * the desk). Optional, so every existing reservation keeps working untouched.
   */
  folioItems?: FolioItem[]
```

In the `res-3` object, add the seed after `upsellIds: ['ord-003'],`:

```ts
    folioItems: [
      {
        id: 'fol-res3-1',
        label: 'Minibar - Bintang Beer',
        quantity: 2,
        unitPrice: 6,
        taxPercent: 10,
        servicePercent: 0,
        source: 'custom',
        status: 'unpaid',
        addedBy: 'Komang Juliantara',
        addedAt: '2026-08-09T14:02:00Z',
      },
      {
        id: 'fol-res3-2',
        label: 'Laundry - Express same day',
        quantity: 3,
        unitPrice: 4,
        taxPercent: 10,
        servicePercent: 0,
        note: 'Two shirts and one pair of trousers.',
        source: 'custom',
        status: 'paid',
        paymentMethod: 'cash',
        paidAt: '2026-08-10T09:15:00Z',
        addedBy: 'Komang Juliantara',
        addedAt: '2026-08-10T08:40:00Z',
      },
      {
        id: 'fol-res3-3',
        label: 'Breakfast - Continental',
        quantity: 1,
        unitPrice: 18,
        taxPercent: 10,
        servicePercent: 0,
        source: 'custom',
        status: 'voided',
        paymentMethod: 'card',
        paidAt: '2026-08-10T09:20:00Z',
        voidReason: 'Charged twice at the desk.',
        voidedAt: '2026-08-10T09:31:00Z',
        voidedBy: 'Komang Juliantara',
        addedBy: 'Komang Juliantara',
        addedAt: '2026-08-10T07:55:00Z',
      },
    ],
```

Then update `res-3`'s `priceDetails` so the Price accordion agrees with the folio. Live items are the unpaid minibar (2 × 6 = 12, plus 10 percent tax = 13.2) and the paid laundry (3 × 4 = 12, plus 10 percent tax = 13.2), so extras are 26.4 and `guestPaid` moves from 640 to 666.4:

```ts
    priceDetails: {
      subtotal: 600,
      cleaningFee: 25,
      serviceFee: 0,
      tax: 15,
      extras: 26.4,
      guestPaid: 666.4,
      commission: 64,
      payout: 576,
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/reservation-folio.spec.ts`
Expected: PASS, 40 tests.

- [ ] **Step 5: Confirm the whole existing suite still passes**

Run: `npx vitest run`
Expected: PASS. The new optional field must not disturb any other spec. If a reservations or finance spec fails on the `res-3` totals, update that spec's expectation to the new `guestPaid` and note it in the commit body.

- [ ] **Step 6: Commit**

```bash
git add app/components/reservations/data/reservations.ts tests/lib/reservation-folio.spec.ts
git commit -m "feat(reservations): carry folio items on a reservation and seed them"
```

---

## Task 6: The useReservationFolio composable

The only writer. Every action patches the items array and its activity entry in **one** `updateReservation` call, so a posting and its audit line can never land apart.

**Files:**
- Create: `app/composables/useReservationFolio.ts`
- Test: `tests/composables/useReservationFolio.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/composables/useReservationFolio.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultFolioItemDraft } from '~/components/reservations/data/folio'
import { useReservationFolio } from '~/composables/useReservationFolio'
import { useReservationsModule } from '~/composables/useReservationsModule'

/** res-3 is the in-house USD stay carrying the seeded folio. */
const RES = 'res-3'

function draft(over: Record<string, unknown> = {}) {
  return { ...createDefaultFolioItemDraft(), label: 'Minibar - Beer', quantity: 2, unitPrice: 6, ...over }
}

function reservation() {
  return useReservationsModule().reservations.value.find(r => r.id === RES)!
}

describe('useReservationFolio', () => {
  beforeEach(() => {
    // tests/setup.ts clears the useState store between tests, so each test
    // starts from the seeded reservations.
    useReservationsModule()
  })

  it('posts an unpaid item onto the reservation', () => {
    const folio = useReservationFolio()
    const before = folio.itemsFor(RES).length

    const posted = folio.addItem(RES, draft())

    expect(posted).not.toBeNull()
    expect(folio.itemsFor(RES)).toHaveLength(before + 1)
    expect(folio.itemsFor(RES).at(-1)!.status).toBe('unpaid')
  })

  it('stamps the posting with the current dashboard user', () => {
    const folio = useReservationFolio()

    folio.addItem(RES, draft())

    expect(folio.itemsFor(RES).at(-1)!.addedBy).toBe('Komang Juliantara')
  })

  it('writes exactly one activity entry per posting', () => {
    const folio = useReservationFolio()
    const before = reservation().activity.length

    folio.addItem(RES, draft())

    expect(reservation().activity).toHaveLength(before + 1)
    expect(reservation().activity[0]!.title).toBe('Folio item added')
  })

  it('refuses an invalid draft without touching the reservation', () => {
    const folio = useReservationFolio()
    const items = folio.itemsFor(RES).length
    const activity = reservation().activity.length

    expect(folio.addItem(RES, draft({ label: '  ', unitPrice: 0 }))).toBeNull()
    expect(folio.itemsFor(RES)).toHaveLength(items)
    expect(reservation().activity).toHaveLength(activity)
  })

  it('refuses to post onto a cancelled reservation', () => {
    const folio = useReservationFolio()
    const cancelled = useReservationsModule().reservations.value.find(r => r.status === 'cancelled')!

    expect(folio.canPostTo(cancelled.id)).toBe(false)
    expect(folio.addItem(cancelled.id, draft())).toBeNull()
  })

  it('marks an item paid and drops it out of the balance', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    const owed = folio.summaryFor(RES)!.itemsBalance

    folio.markPaid(RES, posted.id, 'cash')

    const item = folio.itemsFor(RES).find(i => i.id === posted.id)!
    expect(item.status).toBe('paid')
    expect(item.paymentMethod).toBe('cash')
    expect(item.paidAt).toBeTruthy()
    // The draft carries no tax, so a 2 x 6 line is 12.
    expect(folio.summaryFor(RES)!.itemsBalance).toBe(Math.round((owed - 12) * 100) / 100)
  })

  it('leaves a charge-to-room item unpaid and still owing', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    const owed = folio.summaryFor(RES)!.itemsBalance

    folio.markPaid(RES, posted.id, 'room')

    const item = folio.itemsFor(RES).find(i => i.id === posted.id)!
    expect(item.status).toBe('unpaid')
    expect(item.paymentMethod).toBe('room')
    expect(item.paidAt).toBeUndefined()
    expect(folio.summaryFor(RES)!.itemsBalance).toBe(owed)
  })

  it('removes an unpaid item outright', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!

    folio.deleteItem(RES, posted.id)

    expect(folio.itemsFor(RES).some(i => i.id === posted.id)).toBe(false)
    expect(reservation().activity[0]!.title).toBe('Folio item removed')
  })

  it('will not remove a paid item', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    folio.markPaid(RES, posted.id, 'card')

    folio.deleteItem(RES, posted.id)

    expect(folio.itemsFor(RES).some(i => i.id === posted.id)).toBe(true)
  })

  it('voids a paid item with a reason and raises a refund due', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    folio.markPaid(RES, posted.id, 'card')
    const refundBefore = folio.summaryFor(RES)!.refundDue

    folio.voidItem(RES, posted.id, '  charged twice  ')

    const item = folio.itemsFor(RES).find(i => i.id === posted.id)!
    expect(item.status).toBe('voided')
    expect(item.voidReason).toBe('charged twice')
    expect(item.voidedBy).toBe('Komang Juliantara')
    expect(folio.summaryFor(RES)!.refundDue).toBe(Math.round((refundBefore + 12) * 100) / 100)
  })

  it('will not void without a reason, or void an unpaid item', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!

    folio.voidItem(RES, posted.id, '   ')
    expect(folio.itemsFor(RES).find(i => i.id === posted.id)!.status).toBe('unpaid')

    folio.markPaid(RES, posted.id, 'cash')
    folio.voidItem(RES, posted.id, '')
    expect(folio.itemsFor(RES).find(i => i.id === posted.id)!.status).toBe('paid')
  })

  it('keeps priceDetails.extras and guestPaid in step with the folio', () => {
    const folio = useReservationFolio()
    const before = reservation().priceDetails!

    folio.addItem(RES, draft())

    const after = reservation().priceDetails!
    const summary = folio.summaryFor(RES)!
    expect(after.extras).toBe(summary.itemsTotal)
    // guestPaid moves by the change in extras, not by the whole extras total.
    expect(after.guestPaid).toBe(Math.round((before.guestPaid - before.extras + after.extras) * 100) / 100)
  })

  it('offers the catalog rows for the reservation property and currency', () => {
    const folio = useReservationFolio()
    const rows = folio.catalogRowsFor(RES)

    expect(rows.length).toBeGreaterThan(0)
    // res-3 is USD while the seeded services are IDR, so every price needs a human.
    expect(rows.every(row => row.needsPrice)).toBe(true)
  })

  it('never writes to the upsell catalog', () => {
    const folio = useReservationFolio()
    const { services } = useUpsellServices()
    const snapshot = JSON.stringify(services.value)

    folio.addItem(RES, draft({ source: 'catalog', catalogServiceId: 'svc-001', catalogItemId: 'itm-001a' }))

    expect(JSON.stringify(services.value)).toBe(snapshot)
  })
})
```

- [ ] **Step 2: Add the auto-imports these tests rely on**

`useUpsellServices` and `useCurrentDashboardUser` are Nuxt auto-imports, so they are not resolvable in Vitest. Add them to `tests/setup.ts` next to the existing `globalThis.useOnboarding` line:

```ts
import { useCurrentDashboardUser } from '../app/composables/useCurrentDashboardUser'
import { useUpsellServices } from '../app/composables/useUpsellServices'

// The folio reads the upsell catalog and the acting staff member as auto-imports.
globalThis.useUpsellServices = useUpsellServices
globalThis.useCurrentDashboardUser = useCurrentDashboardUser
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/composables/useReservationFolio.spec.ts`
Expected: FAIL, cannot resolve `~/composables/useReservationFolio`.

- [ ] **Step 4: Write the minimal implementation**

Create `app/composables/useReservationFolio.ts`:

```ts
import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { FolioCatalogRow, FolioItem, FolioItemDraft, FolioPaymentMethod, FolioSummary } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import {
  buildFolioSummary,
  canDeleteFolioItem,
  canVoidFolioItem,
  folioActivityEvent,
  folioCatalogRows,
  folioItemFromDraft,
  isFolioItemDraftValid,
  roundFolioAmount,
} from '~/components/reservations/data/folio'
import { useReservationsModule } from '~/composables/useReservationsModule'

/**
 * Staff-posted charges on a stay. The only writer of `ReservationEntry.folioItems`.
 *
 * It reads the upsell catalog as a price list and never writes to it, and it
 * never touches `useUpsellOrders`: keeping a folio line out of the order
 * lifecycle is what keeps one number for one charge.
 */
export function useReservationFolio() {
  const { reservations, updateReservation } = useReservationsModule()
  const { services } = useUpsellServices()
  const { currentUser } = useCurrentDashboardUser()

  const actor = computed(() => currentUser.value?.name ?? 'Staff')

  function reservationById(id: string): ReservationEntry | null {
    return reservations.value.find(r => r.id === id) ?? null
  }

  function itemsFor(id: string): FolioItem[] {
    return reservationById(id)?.folioItems ?? []
  }

  function summaryFor(id: string): FolioSummary | null {
    const reservation = reservationById(id)
    return reservation ? buildFolioSummary(reservation) : null
  }

  /** A cancelled or blocked stay takes no new charges. */
  function canPostTo(id: string): boolean {
    const reservation = reservationById(id)
    if (!reservation)
      return false
    return reservation.status !== 'cancelled' && reservation.status !== 'blocked'
  }

  function catalogRowsFor(id: string): FolioCatalogRow[] {
    const reservation = reservationById(id)
    if (!reservation)
      return []
    return folioCatalogRows(services.value, reservation.listingName, reservation.currency)
  }

  /**
   * One patch, so the items and their audit line can never land apart. Keeps
   * priceDetails in step where a reservation has one, and leaves `totalPrice`
   * alone: that is the booked price and much of the app reads it.
   */
  function commit(reservation: ReservationEntry, items: FolioItem[], event: ActivityEvent) {
    const patch: Partial<ReservationEntry> = {
      folioItems: items,
      activity: [event, ...reservation.activity],
    }

    if (reservation.priceDetails) {
      const extras = buildFolioSummary({ ...reservation, folioItems: items }).itemsTotal
      patch.priceDetails = {
        ...reservation.priceDetails,
        extras,
        guestPaid: roundFolioAmount(reservation.priceDetails.guestPaid - reservation.priceDetails.extras + extras),
      }
    }

    updateReservation(reservation.id, patch)
  }

  function addItem(reservationId: string, draft: FolioItemDraft): FolioItem | null {
    const reservation = reservationById(reservationId)
    if (!reservation || !canPostTo(reservationId) || !isFolioItemDraftValid(draft))
      return null

    const item = folioItemFromDraft(draft, actor.value)
    commit(reservation, [...itemsFor(reservationId), item], folioActivityEvent('added', item, actor.value, reservation.currency))
    toast.success(`Added ${item.label}`)
    return item
  }

  function markPaid(reservationId: string, itemId: string, method: FolioPaymentMethod) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return

    const current = itemsFor(reservationId).find(item => item.id === itemId)
    if (!current || current.status !== 'unpaid')
      return

    // 'room' defers the charge: it stays unpaid and keeps counting in the balance.
    const updated: FolioItem = method === 'room'
      ? { ...current, paymentMethod: 'room' }
      : { ...current, status: 'paid', paymentMethod: method, paidAt: new Date().toISOString() }

    const items = itemsFor(reservationId).map(item => (item.id === itemId ? updated : item))
    commit(reservation, items, folioActivityEvent(method === 'room' ? 'deferred' : 'paid', updated, actor.value, reservation.currency))
    toast.success(method === 'room' ? `${updated.label} charged to room` : `${updated.label} marked paid`)
  }

  function deleteItem(reservationId: string, itemId: string) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return

    const item = itemsFor(reservationId).find(entry => entry.id === itemId)
    if (!item || !canDeleteFolioItem(item))
      return

    const items = itemsFor(reservationId).filter(entry => entry.id !== itemId)
    commit(reservation, items, folioActivityEvent('removed', item, actor.value, reservation.currency))
    toast.success(`Removed ${item.label}`)
  }

  function voidItem(reservationId: string, itemId: string, reason: string) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return

    const trimmed = reason.trim()
    if (!trimmed)
      return

    const item = itemsFor(reservationId).find(entry => entry.id === itemId)
    if (!item || !canVoidFolioItem(item))
      return

    const voided: FolioItem = {
      ...item,
      status: 'voided',
      voidReason: trimmed,
      voidedAt: new Date().toISOString(),
      voidedBy: actor.value,
    }

    const items = itemsFor(reservationId).map(entry => (entry.id === itemId ? voided : entry))
    commit(reservation, items, folioActivityEvent('voided', voided, actor.value, reservation.currency))
    toast.success(`Voided ${item.label}`)
  }

  return {
    actor,
    itemsFor,
    summaryFor,
    canPostTo,
    catalogRowsFor,
    addItem,
    markPaid,
    deleteItem,
    voidItem,
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/composables/useReservationFolio.spec.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useReservationFolio.ts tests/composables/useReservationFolio.spec.ts tests/setup.ts
git commit -m "feat(reservations): useReservationFolio, the single folio writer"
```

---

## Task 7: The add-item dialog

Two paths in one dialog: a catalog list filtered to this property, and a custom line. A property with no assigned service opens on the custom form rather than on an empty list.

**Files:**
- Create: `app/components/reservations/FolioAddItemDialog.vue`
- Test: `tests/components/reservations/ReservationFolio.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/reservations/ReservationFolio.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import FolioAddItemDialog from '~/components/reservations/FolioAddItemDialog.vue'
import { initialReservations } from '~/components/reservations/data/reservations'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'
import { Textarea } from '~/components/ui/textarea'

/**
 * The shadcn primitives must be registered or an unresolved `Input` renders as a
 * bare element whose model-value never becomes the DOM value, and every value
 * assertion passes vacuously. The Dialog parts matter just as much: the dialog
 * components have `<Dialog>` as their root, so without it they render nothing.
 */
const components = {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Separator,
  Textarea,
  Icon: { template: '<i />' },
}

function mountDialog(reservationId = 'res-3') {
  const reservation = initialReservations.find(r => r.id === reservationId)!
  return mount(FolioAddItemDialog, {
    props: { open: true, reservation },
    global: { components, stubs: { Teleport: true } },
    attachTo: document.body,
  })
}

describe('FolioAddItemDialog', () => {
  it('lists catalog rows for the reservation property', () => {
    const wrapper = mountDialog()

    expect(wrapper.text()).toContain('Airport Transfer')
    expect(wrapper.text()).toContain('Standard Sedan')
  })

  it('marks a cross-currency row and does not copy its price', async () => {
    const wrapper = mountDialog()

    // res-3 is USD; the seeded services are IDR.
    expect(wrapper.text()).toContain('Priced in IDR')

    await wrapper.findAll('[data-testid="folio-catalog-row"]')[0]!.trigger('click')
    await nextTick()

    const price = wrapper.find('[data-testid="folio-unit-price"]')
    expect((price.element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('Enter the amount in USD')
  })

  it('carries the label and both percentages over from a catalog pick', async () => {
    const wrapper = mountDialog()

    await wrapper.findAll('[data-testid="folio-catalog-row"]')[0]!.trigger('click')
    await nextTick()

    expect((wrapper.find('[data-testid="folio-label"]').element as HTMLInputElement).value).toContain('Standard Sedan')
    expect((wrapper.find('[data-testid="folio-tax"]').element as HTMLInputElement).value).toBe('11')
    expect((wrapper.find('[data-testid="folio-service"]').element as HTMLInputElement).value).toBe('5')
  })

  it('filters the catalog by the search query', async () => {
    const wrapper = mountDialog()

    await wrapper.find('[data-testid="folio-catalog-search"]').setValue('sedan')
    await nextTick()

    expect(wrapper.findAll('[data-testid="folio-catalog-row"]')).toHaveLength(1)
  })

  it('keeps Add disabled until the line is valid, and shows the running total', async () => {
    const wrapper = mountDialog()
    const addButton = () => wrapper.findAll('button').find(b => b.text() === 'Add item')!

    expect(addButton().attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="folio-label"]').setValue('Minibar - Beer')
    await wrapper.find('[data-testid="folio-quantity"]').setValue('2')
    await wrapper.find('[data-testid="folio-unit-price"]').setValue('6')
    await nextTick()

    expect(addButton().attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="folio-line-total"]').text()).toContain('12')
  })

  it('emits the draft it built rather than writing to the store itself', async () => {
    const wrapper = mountDialog()

    await wrapper.find('[data-testid="folio-label"]').setValue('Laundry')
    await wrapper.find('[data-testid="folio-unit-price"]').setValue('4')
    await nextTick()
    await wrapper.findAll('button').find(b => b.text() === 'Add item')!.trigger('click')

    const submitted = wrapper.emitted('submit')
    expect(submitted).toHaveLength(1)
    expect((submitted![0]![0] as { label: string }).label).toBe('Laundry')
  })

  it('opens on the custom form when no service is offered at the property', () => {
    const orphan = { ...initialReservations.find(r => r.id === 'res-3')!, listingName: 'Villa Nowhere' }
    const wrapper = mount(FolioAddItemDialog, {
      props: { open: true, reservation: orphan },
      global: { components, stubs: { Teleport: true } },
      attachTo: document.body,
    })

    expect(wrapper.findAll('[data-testid="folio-catalog-row"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No catalog items')
    expect(wrapper.find('[data-testid="folio-label"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/reservations/ReservationFolio.spec.ts`
Expected: FAIL, cannot resolve `~/components/reservations/FolioAddItemDialog.vue`.

- [ ] **Step 3: Write the minimal implementation**

Create `app/components/reservations/FolioAddItemDialog.vue`:

```vue
<script setup lang="ts">
import type { FolioCatalogRow, FolioItemDraft } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import {
  createDefaultFolioItemDraft,
  filterFolioCatalogRows,
  folioCatalogRows,
  folioDraftFromCatalog,
  folioLineTotal,
  validateFolioItemDraft,
} from '~/components/reservations/data/folio'

const props = defineProps<{
  open: boolean
  reservation: ReservationEntry
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [draft: FolioItemDraft]
}>()

const { services } = useUpsellServices()

const draft = ref<FolioItemDraft>(createDefaultFolioItemDraft())
const search = ref('')
const pickedItemId = ref<string | null>(null)

const rows = computed(() => folioCatalogRows(services.value, props.reservation.listingName, props.reservation.currency))
const visibleRows = computed(() => filterFolioCatalogRows(rows.value, search.value))
const pickedRow = computed(() => rows.value.find(row => row.itemId === pickedItemId.value) ?? null)

const errors = computed(() => validateFolioItemDraft(draft.value))
const canSubmit = computed(() => Object.keys(errors.value).length === 0)
const lineTotal = computed(() => folioLineTotal(draft.value))

function fmt(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

function pick(row: FolioCatalogRow) {
  const service = services.value.find(entry => entry.id === row.serviceId)
  const item = service?.items.find(entry => entry.id === row.itemId)
  if (!service || !item)
    return

  pickedItemId.value = row.itemId
  draft.value = folioDraftFromCatalog(service, item, props.reservation.currency)
}

function reset() {
  draft.value = createDefaultFolioItemDraft()
  search.value = ''
  pickedItemId.value = null
}

function submit() {
  if (!canSubmit.value)
    return
  emit('submit', { ...draft.value })
  reset()
  emit('update:open', false)
}

watch(() => props.open, (open) => {
  if (open)
    reset()
})
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Add item to folio</DialogTitle>
        <DialogDescription>
          Posted on {{ reservation.guestName }}'s stay at {{ reservation.listingName }}.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 sm:grid-cols-2">
        <!-- Catalog -->
        <div class="flex min-h-0 flex-col gap-2">
          <Label :for="'folio-catalog-search'" class="text-xs text-muted-foreground">
            Catalog
          </Label>
          <Input
            id="folio-catalog-search"
            v-model="search"
            data-testid="folio-catalog-search"
            placeholder="Search the catalog"
          />

          <ScrollArea class="h-64 min-h-0 rounded-md border">
            <div v-if="!visibleRows.length" class="p-4 text-xs text-muted-foreground">
              <template v-if="!rows.length">
                No catalog items are offered at this property. Add a custom item instead, or assign an
                upsell service to it.
              </template>
              <template v-else>
                Nothing matches "{{ search }}".
              </template>
            </div>

            <button
              v-for="row in visibleRows"
              :key="row.itemId"
              type="button"
              data-testid="folio-catalog-row"
              class="flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
              :class="pickedItemId === row.itemId ? 'bg-muted' : ''"
              @click="pick(row)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ row.itemName }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ row.serviceName }}</span>
              </span>
              <span class="shrink-0 text-right">
                <span class="block text-sm">{{ fmt(row.price, row.currency) }}</span>
                <Badge v-if="row.needsPrice" variant="outline" class="mt-0.5 text-[10px]">
                  Priced in {{ row.currency }}
                </Badge>
              </span>
            </button>
          </ScrollArea>
        </div>

        <!-- The line being posted -->
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label for="folio-label">Item</Label>
            <Input id="folio-label" v-model="draft.label" data-testid="folio-label" placeholder="Minibar - Beer" />
            <p v-if="errors.label" class="text-xs text-destructive">
              {{ errors.label }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <Label for="folio-quantity">Qty</Label>
              <Input
                id="folio-quantity"
                :model-value="draft.quantity"
                data-testid="folio-quantity"
                type="number"
                inputmode="numeric"
                min="1"
                @update:model-value="(v) => draft.quantity = Number(v)"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="folio-unit-price">Unit price ({{ reservation.currency }})</Label>
              <Input
                id="folio-unit-price"
                :model-value="draft.unitPrice || ''"
                data-testid="folio-unit-price"
                type="number"
                inputmode="decimal"
                min="0"
                @update:model-value="(v) => draft.unitPrice = Number(v)"
              />
            </div>
          </div>

          <p v-if="pickedRow?.needsPrice" class="text-xs text-muted-foreground">
            This item is priced in {{ pickedRow.currency }}. Enter the amount in {{ reservation.currency }}.
          </p>
          <p v-if="errors.unitPrice" class="text-xs text-destructive">
            {{ errors.unitPrice }}
          </p>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <Label for="folio-tax">Tax %</Label>
              <Input
                id="folio-tax"
                :model-value="draft.taxPercent"
                data-testid="folio-tax"
                type="number"
                min="0"
                max="100"
                @update:model-value="(v) => draft.taxPercent = Number(v)"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="folio-service">Service %</Label>
              <Input
                id="folio-service"
                :model-value="draft.servicePercent"
                data-testid="folio-service"
                type="number"
                min="0"
                max="100"
                @update:model-value="(v) => draft.servicePercent = Number(v)"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="folio-note">Note</Label>
            <Textarea id="folio-note" v-model="draft.note" data-testid="folio-note" rows="2" />
          </div>

          <Separator />

          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Line total</span>
            <span data-testid="folio-line-total" class="font-semibold">
              {{ fmt(lineTotal, reservation.currency) }}
            </span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button :disabled="!canSubmit" @click="submit">
          Add item
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/reservations/ReservationFolio.spec.ts`
Expected: PASS, 7 tests. If the `Dialog` portal keeps content out of the wrapper, register the dialog parts in `components` (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `~/components/ui/dialog`) and assert against `document.body.textContent` for the portalled subtree, the way `tests/components/reservations/AddCleaningAssignee.spec.ts` does.

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/FolioAddItemDialog.vue tests/components/reservations/ReservationFolio.spec.ts
git commit -m "feat(reservations): folio add-item dialog with catalog and custom paths"
```

---

## Task 8: The void dialog

**Files:**
- Create: `app/components/reservations/FolioVoidDialog.vue`
- Test: `tests/components/reservations/ReservationFolio.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/components/reservations/ReservationFolio.spec.ts`, adding `import FolioVoidDialog from '~/components/reservations/FolioVoidDialog.vue'` to the imports:

```ts
describe('FolioVoidDialog', () => {
  const item = {
    id: 'fol-1',
    label: 'Breakfast - Continental',
    quantity: 1,
    unitPrice: 18,
    taxPercent: 0,
    servicePercent: 0,
    source: 'custom' as const,
    status: 'paid' as const,
    paymentMethod: 'card' as const,
    paidAt: '2026-09-09T09:20:00Z',
    addedBy: 'Komang Juliantara',
    addedAt: '2026-09-09T07:55:00Z',
  }

  function mountVoid() {
    return mount(FolioVoidDialog, {
      props: { open: true, item, currency: 'USD' },
      global: { components, stubs: { Teleport: true } },
      attachTo: document.body,
    })
  }

  it('names the item and the amount being reversed', () => {
    expect(mountVoid().text()).toContain('Breakfast - Continental')
  })

  it('keeps Void disabled until a reason is given', async () => {
    const wrapper = mountVoid()
    const voidButton = () => wrapper.findAll('button').find(b => b.text() === 'Void item')!

    expect(voidButton().attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="folio-void-reason"]').setValue('Charged twice')
    await nextTick()

    expect(voidButton().attributes('disabled')).toBeUndefined()
  })

  it('treats a whitespace reason as no reason', async () => {
    const wrapper = mountVoid()

    await wrapper.find('[data-testid="folio-void-reason"]').setValue('   ')
    await nextTick()

    expect(wrapper.findAll('button').find(b => b.text() === 'Void item')!.attributes('disabled')).toBeDefined()
  })

  it('emits the reason it collected', async () => {
    const wrapper = mountVoid()

    await wrapper.find('[data-testid="folio-void-reason"]').setValue('Charged twice')
    await nextTick()
    await wrapper.findAll('button').find(b => b.text() === 'Void item')!.trigger('click')

    expect(wrapper.emitted('confirm')![0]![0]).toBe('Charged twice')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/reservations/ReservationFolio.spec.ts`
Expected: FAIL, cannot resolve `~/components/reservations/FolioVoidDialog.vue`.

- [ ] **Step 3: Write the minimal implementation**

Create `app/components/reservations/FolioVoidDialog.vue`:

```vue
<script setup lang="ts">
import type { FolioItem } from '~/components/reservations/data/folio'
import { folioLineTotal } from '~/components/reservations/data/folio'

const props = defineProps<{
  open: boolean
  item: FolioItem | null
  currency: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [reason: string]
}>()

const reason = ref('')

const canConfirm = computed(() => reason.value.trim().length > 0)

const amount = computed(() => {
  if (!props.item)
    return ''
  return `${folioLineTotal(props.item).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${props.currency}`
})

function confirm() {
  if (!canConfirm.value)
    return
  emit('confirm', reason.value.trim())
  reason.value = ''
  emit('update:open', false)
}

watch(() => props.open, (open) => {
  if (open)
    reason.value = ''
})
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Void this item</DialogTitle>
        <DialogDescription>
          The guest already paid for this line, so it cannot be deleted. Voiding reverses the charge
          and leaves it on the folio with your reason.
        </DialogDescription>
      </DialogHeader>

      <div v-if="item" class="rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <p class="font-medium">
          {{ item.label }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ item.quantity }} × {{ item.unitPrice }} = {{ amount }}
        </p>
      </div>

      <div class="space-y-1.5">
        <Label for="folio-void-reason">Reason</Label>
        <Textarea
          id="folio-void-reason"
          v-model="reason"
          data-testid="folio-void-reason"
          rows="3"
          placeholder="Charged twice at the desk."
        />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button variant="destructive" :disabled="!canConfirm" @click="confirm">
          Void item
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/reservations/ReservationFolio.spec.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/FolioVoidDialog.vue tests/components/reservations/ReservationFolio.spec.ts
git commit -m "feat(reservations): folio void dialog with a required reason"
```

---

## Task 9: The folio section and its place in the detail sheet

**Files:**
- Create: `app/components/reservations/ReservationFolioSection.vue`
- Modify: `app/components/reservations/ReservationDetailSheet.vue` (imports at line 1-12, insertion after the Rooms accordion which closes at line 563)
- Test: `tests/components/reservations/ReservationFolio.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/components/reservations/ReservationFolio.spec.ts`, adding these imports:

```ts
import ReservationFolioSection from '~/components/reservations/ReservationFolioSection.vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
```

```ts
describe('ReservationFolioSection', () => {
  const sectionComponents = {
    ...components,
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  }

  /**
   * The section is a collapsed Accordion, and reka-ui does not mount
   * AccordionContent until it opens. Every assertion below is about the content,
   * so the helper opens it first.
   */
  async function mountSection(reservationId = 'res-3') {
    const reservation = initialReservations.find(r => r.id === reservationId)!
    const wrapper = mount(ReservationFolioSection, {
      props: { reservation },
      global: { components: sectionComponents, stubs: { Teleport: true } },
      attachTo: document.body,
    })
    await wrapper.find('button').trigger('click')
    await nextTick()
    return wrapper
  }

  it('renders every seeded item with its state', async () => {
    const text = (await mountSection()).text()

    expect(text).toContain('Minibar - Bintang Beer')
    expect(text).toContain('Laundry - Express same day')
    expect(text).toContain('Breakfast - Continental')
    expect(text).toContain('Unpaid')
    expect(text).toContain('Paid')
    expect(text).toContain('Voided')
  })

  it('shows the void reason on a voided line', async () => {
    expect((await mountSection()).text()).toContain('Charged twice at the desk.')
  })

  it('states the booking total, the extras and the combined total', async () => {
    const text = (await mountSection()).text()

    expect(text).toContain('Booking total')
    expect(text).toContain('Extras')
    expect(text).toContain('Total')
  })

  it('reports a refund due rather than a negative balance', async () => {
    const wrapper = await mountSection()

    // Extras 26.40 posted, 33.00 collected (laundry 13.20 + the voided breakfast 19.80),
    // so the folio owes 6.60 back and never prints a negative balance.
    expect(wrapper.text()).toContain('Refund due')
    expect(wrapper.text()).toContain('6.6')
    expect(wrapper.text()).not.toContain('-6.6')
  })

  it('offers Add item on a live stay', async () => {
    const add = (await mountSection()).find('[data-testid="folio-add"]')

    expect(add.exists()).toBe(true)
    expect(add.attributes('disabled')).toBeUndefined()
  })

  it('disables Add item on a cancelled stay and says why', async () => {
    const cancelled = initialReservations.find(r => r.status === 'cancelled')!
    const wrapper = mount(ReservationFolioSection, {
      props: { reservation: cancelled },
      global: { components: sectionComponents, stubs: { Teleport: true } },
      attachTo: document.body,
    })
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="folio-add"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('cancelled')
  })

  it('shows an empty state on a stay with nothing posted', async () => {
    const wrapper = await mountSection('res-1')

    expect(wrapper.text()).toContain('Nothing posted yet')
  })

  /**
   * DropdownMenuContent is unmounted until the menu opens and portals out of the
   * wrapper, so it is read off document.body. One menu per mount: two open
   * portals in one document make a negative assertion meaningless, since the
   * other row's items are also on the page.
   */
  async function openRowMenu(rowIndex: number) {
    const wrapper = await mountSection()
    const rows = wrapper.findAll('[data-testid="folio-item-row"]')
    expect(rows).toHaveLength(3)

    await rows[rowIndex]!.find('[aria-label="Item actions"]').trigger('click')
    await nextTick()
    await nextTick()
    return document.body.textContent ?? ''
  }

  it('offers Remove but not Void on the unpaid row', async () => {
    const menu = await openRowMenu(0)

    expect(menu).toContain('Remove')
    expect(menu).not.toContain('Void item')
  })

  it('offers Void but not Remove on the paid row', async () => {
    const menu = await openRowMenu(1)

    expect(menu).toContain('Void item')
    expect(menu).not.toContain('Remove')
  })

  it('offers no actions at all on a voided row', async () => {
    const wrapper = await mountSection()
    const rows = wrapper.findAll('[data-testid="folio-item-row"]')

    expect(rows[2]!.find('[aria-label="Item actions"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/reservations/ReservationFolio.spec.ts`
Expected: FAIL, cannot resolve `~/components/reservations/ReservationFolioSection.vue`.

- [ ] **Step 3: Write the minimal implementation**

Create `app/components/reservations/ReservationFolioSection.vue`:

```vue
<script setup lang="ts">
import type { FolioItem, FolioItemDraft, FolioPaymentMethod } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import FolioAddItemDialog from '~/components/reservations/FolioAddItemDialog.vue'
import FolioVoidDialog from '~/components/reservations/FolioVoidDialog.vue'
import {
  buildFolioSummary,
  canDeleteFolioItem,
  canVoidFolioItem,
  FOLIO_PAYMENT_METHOD_LABELS,
  folioLineTotal,
} from '~/components/reservations/data/folio'
import { useReservationFolio } from '~/composables/useReservationFolio'

const props = defineProps<{
  reservation: ReservationEntry
}>()

const folio = useReservationFolio()

const addOpen = ref(false)
const voidOpen = ref(false)
const voidTargetId = ref<string | null>(null)

const items = computed<FolioItem[]>(() => props.reservation.folioItems ?? [])
const summary = computed(() => buildFolioSummary(props.reservation))
const canPost = computed(() => folio.canPostTo(props.reservation.id))
const voidTarget = computed(() => items.value.find(item => item.id === voidTargetId.value) ?? null)

const statusLabels: Record<FolioItem['status'], string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  voided: 'Voided',
}

const statusClasses: Record<FolioItem['status'], string> = {
  unpaid: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  paid: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  voided: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

function statusLabel(item: FolioItem): string {
  if (item.status === 'unpaid' && item.paymentMethod === 'room')
    return 'Unpaid, on room account'
  if (item.status === 'paid' && item.paymentMethod)
    return `Paid · ${FOLIO_PAYMENT_METHOD_LABELS[item.paymentMethod]}`
  return statusLabels[item.status]
}

function fmt(amount: number): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${props.reservation.currency}`
}

function submitDraft(draft: FolioItemDraft) {
  folio.addItem(props.reservation.id, draft)
}

function pay(item: FolioItem, method: FolioPaymentMethod) {
  folio.markPaid(props.reservation.id, item.id, method)
}

function remove(item: FolioItem) {
  folio.deleteItem(props.reservation.id, item.id)
}

function openVoid(item: FolioItem) {
  voidTargetId.value = item.id
  voidOpen.value = true
}

function confirmVoid(reason: string) {
  if (voidTargetId.value)
    folio.voidItem(props.reservation.id, voidTargetId.value, reason)
  voidTargetId.value = null
}
</script>

<template>
  <Accordion type="single" collapsible class="w-full border-b px-2">
    <AccordionItem value="folio" class="border-b-0">
      <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
        <span class="flex flex-1 items-center gap-2">
          <Icon name="lucide:receipt-text" class="size-4" />
          Charges & extras
          <Badge v-if="items.length" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
            {{ items.length }}
          </Badge>
          <span class="ml-auto mr-2 font-medium text-foreground">{{ fmt(summary.grandTotal) }}</span>
        </span>
      </AccordionTrigger>

      <AccordionContent class="px-3 pb-3">
        <div class="space-y-2">
          <!-- Staff-posted items -->
          <p v-if="!items.length" class="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            Nothing posted yet. Add a minibar item, a laundry bag or anything else the guest owes.
          </p>

          <div
            v-for="item in items"
            :key="item.id"
            data-testid="folio-item-row"
            class="rounded-md border px-3 py-2"
            :class="item.status === 'voided' ? 'bg-muted/20' : 'bg-muted/40'"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium" :class="item.status === 'voided' ? 'line-through text-muted-foreground' : ''">
                  {{ item.label }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ item.quantity }} × {{ fmt(item.unitPrice) }}
                  <template v-if="item.taxPercent">
                    · tax {{ item.taxPercent }}%
                  </template>
                  <template v-if="item.servicePercent">
                    · service {{ item.servicePercent }}%
                  </template>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="text-sm font-medium" :class="item.status === 'voided' ? 'line-through text-muted-foreground' : ''">
                  {{ fmt(folioLineTotal(item)) }}
                </span>
                <DropdownMenu v-if="canDeleteFolioItem(item) || canVoidFolioItem(item)">
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-7" aria-label="Item actions">
                      <Icon name="lucide:ellipsis-vertical" class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <template v-if="item.status === 'unpaid'">
                      <DropdownMenuItem data-testid="folio-pay-cash" @click="pay(item, 'cash')">
                        Mark paid · Cash
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="folio-pay-card" @click="pay(item, 'card')">
                        Mark paid · Card
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="item.paymentMethod !== 'room'"
                        data-testid="folio-pay-room"
                        @click="pay(item, 'room')"
                      >
                        Charge to room
                      </DropdownMenuItem>
                    </template>
                    <DropdownMenuItem
                      v-if="canDeleteFolioItem(item)"
                      data-testid="folio-remove"
                      class="text-destructive"
                      @click="remove(item)"
                    >
                      Remove
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="canVoidFolioItem(item)"
                      data-testid="folio-void"
                      class="text-destructive"
                      @click="openVoid(item)"
                    >
                      Void item
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div class="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" class="h-4 px-1 text-[9px]" :class="statusClasses[item.status]">
                {{ statusLabel(item) }}
              </Badge>
              <span class="text-[10px] text-muted-foreground">{{ item.addedBy }}</span>
            </div>

            <p v-if="item.note" class="mt-1 text-xs text-muted-foreground">
              {{ item.note }}
            </p>
            <p v-if="item.voidReason" class="mt-1 text-xs text-muted-foreground">
              Voided by {{ item.voidedBy }} · {{ item.voidReason }}
            </p>
          </div>

          <!-- Totals -->
          <Separator />
          <div class="space-y-1 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Booking total</span>
              <span>{{ fmt(summary.bookingTotal) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Extras</span>
              <span>{{ fmt(summary.itemsTotal) }}</span>
            </div>
            <div class="flex items-center justify-between border-t pt-1 text-sm font-semibold">
              <span>Total</span>
              <span>{{ fmt(summary.grandTotal) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Extras paid</span>
              <span>{{ fmt(summary.itemsPaid) }}</span>
            </div>
            <div v-if="summary.refundDue > 0" class="flex items-center justify-between font-medium text-destructive">
              <span>Refund due</span>
              <span>{{ fmt(summary.refundDue) }}</span>
            </div>
            <div v-else class="flex items-center justify-between font-medium">
              <span>Extras balance</span>
              <span>{{ fmt(summary.itemsBalance) }}</span>
            </div>
          </div>

          <!-- Add -->
          <Button
            data-testid="folio-add"
            variant="outline"
            size="sm"
            class="w-full"
            :disabled="!canPost"
            @click="addOpen = true"
          >
            <Icon name="lucide:plus" class="mr-1 size-4" />
            Add item
          </Button>
          <p v-if="!canPost" class="text-center text-[10px] text-muted-foreground">
            This reservation is {{ reservation.status === 'blocked' ? 'blocked' : 'cancelled' }}, so no new
            charges can be posted.
          </p>
        </div>
      </AccordionContent>
    </AccordionItem>

    <FolioAddItemDialog
      v-model:open="addOpen"
      :reservation="reservation"
      @submit="submitDraft"
    />
    <FolioVoidDialog
      v-model:open="voidOpen"
      :item="voidTarget"
      :currency="reservation.currency"
      @confirm="confirmVoid"
    />
  </Accordion>
</template>
```

- [ ] **Step 4: Mount it in the detail sheet**

In `app/components/reservations/ReservationDetailSheet.vue`, add the import next to the other reservation-component imports (after line 8):

```ts
import ReservationFolioSection from '~/components/reservations/ReservationFolioSection.vue'
```

Insert the section immediately after the Rooms accordion's closing `</Accordion>` (line 563) and before the `<!-- Guest -->` block:

```vue
            <!-- Charges & extras (staff-posted folio) -->
            <ReservationFolioSection :reservation="reservation" />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/reservations/ReservationFolio.spec.ts`
Expected: PASS, 21 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/components/reservations/ReservationFolioSection.vue app/components/reservations/ReservationDetailSheet.vue tests/components/reservations/ReservationFolio.spec.ts
git commit -m "feat(reservations): folio section in the reservation detail sheet"
```

---

## Task 10: Typecheck, lint and document

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors. The `reservation.folioItems` reference in `folio.ts` resolves once Task 5 has added the field. If `Input`'s `model-value` complains about a number, coerce at the binding (`:model-value="String(draft.quantity)"`) rather than widening the draft type.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. If the repo's eslint prefers a different import order in the new files, run `npm run format` and re-run lint.

- [ ] **Step 3: Document the module in CLAUDE.md**

Add this section after the `### Reservations` material and before `### SmartLock Integration`:

```markdown
### Reservation Folio Items (`app/components/reservations/data/folio.ts` + `app/composables/useReservationFolio.ts`)

Staff-posted charges on a stay: a minibar beer, a laundry bag, a spa slot booked
at the desk. `ReservationEntry.folioItems?: FolioItem[]`, optional so no seeded
reservation migrates.

- **`data/folio.ts`** is framework-free: line arithmetic, `buildFolioSummary`,
  the state rules, draft validation, the item factories, catalog rows and the
  activity-event builder. The composable owns the reactive state and calls in.
- **A catalog pick is a snapshot.** Label, price and both percentages are copied
  from the `UpsellService` / `UpsellItem` at posting time. `catalogServiceId` is
  provenance, never a live join, so a later price change cannot rewrite a
  guest's bill.
- **Tax and service each apply to the line net, in parallel**, matching
  `UpsellOrderCreator.vue:79`, so a folio line and an upsell order price the
  same. Rounding is to the currency's minor unit, not the whole unit.
- **`paidAt` survives a void on purpose.** A voided item drops out of
  `itemsTotal` but stays in `itemsPaid`, which is exactly what turns a voided
  paid line into `refundDue`. Do not filter `itemsPaid` on `status`.
- **`paymentMethod: 'room'` keeps the item `unpaid`.** Charge to room defers the
  charge, so it still counts in the balance. Treating it as paid would read the
  balance as zero for money nobody collected.
- **Paid and balance cover the extras only**, and the labels say so: nothing on
  `ReservationEntry` records whether the booking itself was settled.
- ⚠️ **`UpsellService.assignedListings` holds listing NAMES, not ids**
  (`upsell-services.ts:313`), so `folioCatalogRows` matches
  `reservation.listingName`.
- ⚠️ **No currency conversion, ever.** A catalog row priced in another currency
  keeps its own price, carries a `Priced in IDR` badge, and transfers its
  percentages but not its amount. An invented exchange rate on a guest's bill is
  worse than asking staff to type the number.
- ⚠️ **`useReservationFolio` never writes to `useUpsellOrders`**, and each action
  patches the items array and its `ActivityEvent` in **one**
  `updateReservation` call so a posting and its audit line cannot land apart.
- `totalPrice` is deliberately never written. It is the booked room-and-fees
  price that much of the app reads; the grand total is derived.
  `priceDetails.extras` and `guestPaid` are kept in step where a reservation has
  a `priceDetails` block.

**Components:** `ReservationFolioSection.vue` (accordion in
`ReservationDetailSheet.vue`, after Rooms), `FolioAddItemDialog.vue` (catalog
list plus custom form), `FolioVoidDialog.vue` (required reason).

**NOT implemented (intentionally out of scope):** no Finance or accounting flow
(the revenue tables read `finance/data/revenue.ts`, a separate mock dataset with
no join to `ReservationEntry`); no invoice document or PDF; no per-room folio on
a multi-room booking; no editing a posted item (remove while unpaid, void once
paid).

**Tests:** `tests/lib/reservation-folio.spec.ts` (40),
`tests/composables/useReservationFolio.spec.ts` (14),
`tests/components/reservations/ReservationFolio.spec.ts` (21).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the reservation folio module"
```

---

## Manual verification

- [ ] Run `npm run dev`, open `/reservations`, and click Emily Chen (`res-3`, checked in).
- [ ] Expand Charges & extras: three seeded lines (an unpaid minibar, a paid laundry, a voided breakfast with its reason), `Extras 26.40`, `Extras paid 33.00` and `Refund due 6.60`.
- [ ] Add a custom item: the total and the extras balance move, and the Activity timeline gains one `Folio item added` entry naming Komang Juliantara.
- [ ] Open the catalog path: rows are Airport Transfer and the other Bali services, each badged `Priced in IDR`, and picking one leaves the price blank with the helper line.
- [ ] Mark that item paid with Cash: the balance drops and Remove is replaced by Void item.
- [ ] Void it with a reason: the line goes struck through, the total drops, and `Refund due` rises.
- [ ] Open a cancelled reservation: Add item is disabled and says why.
