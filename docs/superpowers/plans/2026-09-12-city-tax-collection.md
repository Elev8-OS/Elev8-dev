# City Tax Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tenant say, per channel, who collects a city tax, then make sure staff never miss a collection the host owes, through a reservation section, a status chip, three escalating alerts and a worklist page.

**Architecture:** A framework-free rules module (`app/components/reservations/data/city-tax.ts`) owns every calculation and every status decision. A composable (`app/composables/useCityTax.ts`) owns reactive state and is the only writer of `ReservationEntry.cityTaxSettlement`. Status is **derived** on every read so a policy change re-evaluates existing bookings; only the settlement is stored, with its totals frozen. City tax never touches `priceDetails`, `payout` or the folio, because it is a pass-through liability, not owner revenue.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, shadcn-vue, Tailwind v4, Vitest 4 + @vue/test-utils, vue-sonner for toasts.

**Spec:** `docs/superpowers/specs/2026-09-12-city-tax-collection-design.md`

**Test command:** this repo has **no `npm test` script**. Run Vitest directly:
```bash
npx vitest run tests/lib/city-tax.spec.ts
```

---

## Read this before Task 1

Five repo facts that will cost you an hour each if you learn them the hard way.

1. **`useFeesTaxes` uses module-level `ref`s, not `useState`.** They are created once at
   import time and are **not** reset by the `useState` shim in `tests/setup.ts`. Every spec
   that touches fee/tax items must reset them by hand in `beforeEach`.
2. **An alert that is not in a notification category is invisible.**
   `isAlertVisibleToUser` (`app/lib/notification-routing.ts:14`) drops any alert whose type
   is missing from `role.notifications.enabledAlertTypes`, and roles build that list from
   `notificationCategories`. Adding a type to `AlertType` alone shows nothing in the bell.
3. **reka-ui `Switch` and `Checkbox` use `model-value` / `@update:model-value`.**
   `:checked` / `@update:checked` silently does nothing. Never wrap a `Checkbox` in a
   `<label>`, it double-toggles.
4. **`import.meta.client` is not substituted under Vitest** despite the `define` in
   `vitest.config.ts`. Guard anything client-only on `typeof localStorage`.
5. **Nuxt auto-imported child components must be registered in `global.components`** in a
   component spec, or they render as unresolved stubs and your assertions pass vacuously.

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `app/components/reservations/data/city-tax.ts` | Pure rules: guest counting, night clamping, per-logic amounts, assessment, alert stage, activity event. No Vue, no stores. |
| `app/composables/useCityTax.ts` | Reactive state, the only writer of `cityTaxSettlement`, worklist computeds, alert emission. |
| `app/components/reservations/ReservationCityTaxSection.vue` | Accordion section in the reservation detail sheet. |
| `app/components/reservations/CityTaxCollectDialog.vue` | Method picker plus optional note. |
| `app/components/reservations/CityTaxWaiveDialog.vue` | Required reason. |
| `app/components/city-tax/CityTaxTable.vue` | Worklist table, one row per outstanding or settled stay. |
| `app/components/city-tax/CityTaxStatusChip.vue` | The shared chip, used by the table and `ReservationTable`. |
| `app/pages/city-tax/index.vue` | Worklist page: KPIs, tabs, filters, bulk collect. |
| `tests/lib/city-tax.spec.ts` | Rules module. |
| `tests/composables/useCityTax.spec.ts` | Composable. |
| `tests/components/reservations/ReservationCityTax.spec.ts` | Section render states. |

**Modify**

| File | Change |
|---|---|
| `app/components/listings/data/listings.ts` | `BookingChannel`, `CityTaxCollector`, `CityTaxConfig`, `ListingFeeTaxItem.cityTax?` |
| `app/components/reservations/data/reservations.ts` | `channel: BookingChannel`, `CityTaxSettlement`, `ReservationEntry.cityTaxSettlement?` |
| `app/components/notifications/data/alerts.ts` | 3 alert types, labels, icons, routes, descriptions |
| `app/components/notifications/data/notification-settings.ts` | 3 types into `FINANCE_TYPES` |
| `app/composables/useNotifications.ts` | `createCityTaxAlert` wrapper |
| `app/components/settings/FeesTaxesSettingsPanel.vue` | City tax collection block, notify switch |
| `app/components/reservations/ReservationDetailSheet.vue` | Mount the section after the folio |
| `app/components/reservations/ReservationTable.vue` | Status chip in the status cell |
| `app/constants/menus.ts` | Sidebar entry under Guest Registration |
| `app/composables/useFeesTaxes.ts` | Seed a demo city tax item with a channel policy |
| `CLAUDE.md` | Module documentation |

---

## Task 1: Types

**Files:**
- Modify: `app/components/listings/data/listings.ts:41-61`
- Modify: `app/components/reservations/data/reservations.ts:88-149`

No test: these are type declarations with no runtime behaviour. `vue-tsc` is the check.

- [ ] **Step 1: Add the channel and city tax config types to `listings.ts`**

Insert directly **above** `export interface ListingFeeTaxItem` (currently line 50):

```ts
/**
 * The booking channels a city tax policy can name. Declared here rather than in
 * `reservations.ts` because `listings.ts` imports nothing, so this direction can
 * never close an import cycle. `ReservationEntry.channel` imports it back.
 */
export type BookingChannel = 'Airbnb' | 'Booking.com' | 'Direct'

export const BOOKING_CHANNELS: BookingChannel[] = ['Airbnb', 'Booking.com', 'Direct']

export type CityTaxCollector = 'host' | 'channel' | 'not_applicable'

export interface CityTaxChargeableGuests {
  adults: boolean
  children: boolean
  infants: boolean
}

/**
 * Only meaningful when `ListingFeeTaxItem.type === 'city_tax'`.
 */
export interface CityTaxConfig {
  /**
   * Who collects this tax, per channel. An unset channel falls back to 'host'.
   * The fallback is deliberately the one that raises an alert: the feature
   * exists to stop a collection being missed, so an unconfigured channel must
   * over-alert rather than go silent. Do not "fix" this to 'not_applicable'.
   */
  channelPolicy: Partial<Record<BookingChannel, CityTaxCollector>>
  /** Which guest categories count toward a per-person logic. */
  chargeableGuests: CityTaxChargeableGuests
  /** Who levies it. Shown to staff at the desk. */
  authorityName?: string
  note?: string
}
```

- [ ] **Step 2: Add the field to `ListingFeeTaxItem`**

In `app/components/listings/data/listings.ts`, inside `export interface ListingFeeTaxItem`, after `applicableDateRanges: TaxDateRange[]`:

```ts
  /** Collection policy. Only read when `type === 'city_tax'`. */
  cityTax?: CityTaxConfig
```

- [ ] **Step 3: Add the settlement types to `reservations.ts`**

At the top of `app/components/reservations/data/reservations.ts`, add to the imports:

```ts
import type { BookingChannel } from '~/components/listings/data/listings'
```

Then insert above `export interface ReservationEntry` (currently line 88):

```ts
export type CityTaxPaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'other'

export interface CityTaxTotal {
  currency: string
  amount: number
}

/**
 * What staff did about the city tax on this stay. Deliberately the ONLY city
 * tax state stored on a reservation: the status ('due', 'channel_collects',
 * 'not_required') is derived on every read, so flipping a channel policy
 * re-evaluates every existing booking instead of leaving a stale flag behind.
 */
export interface CityTaxSettlement {
  state: 'collected' | 'waived'
  /** Frozen at settlement time so a later rate change cannot rewrite it. */
  totals: CityTaxTotal[]
  settledAt: string
  settledBy: string
  method?: CityTaxPaymentMethod
  /** Required when state is 'waived'. */
  reason?: string
  note?: string
}
```

- [ ] **Step 4: Use the types on `ReservationEntry`**

In `app/components/reservations/data/reservations.ts`, change line 98 from
`channel: 'Airbnb' | 'Booking.com' | 'Direct'` to `channel: BookingChannel`, change the
same literal on line 187 (the draft type) the same way, and add to `ReservationEntry`
after `folioItems?: FolioItem[]`:

```ts
  /** Set only once staff collect or waive. Absent means "nothing recorded yet". */
  cityTaxSettlement?: CityTaxSettlement
```

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json 2>&1 | grep -i "city-tax\|citytax\|BookingChannel" || echo "no city tax type errors"`
Expected: `no city tax type errors`

(The full typecheck is slow and the repo has pre-existing noise. Grepping for our own
symbols is the signal that matters.)

- [ ] **Step 6: Commit**

```bash
git add app/components/listings/data/listings.ts app/components/reservations/data/reservations.ts
git commit -m "feat(city-tax): add channel policy and settlement types"
```

---

## Task 2: Rules module, part 1 (collector, guests, nights, date ranges)

**Files:**
- Create: `app/components/reservations/data/city-tax.ts`
- Test: `tests/lib/city-tax.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/city-tax.spec.ts`:

```ts
import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import {
  chargeableGuestCount,
  chargeableNights,
  collectorFor,
  isWithinApplicableRange,
} from '~/components/reservations/data/city-tax'

function taxItem(patch: Partial<ListingFeeTaxItem> = {}): ListingFeeTaxItem {
  return {
    id: 'ft-city',
    title: 'Kurtaxe',
    type: 'city_tax',
    logic: 'per_person_per_night',
    rate: 3,
    currency: 'EUR',
    isInclusive: false,
    skipNights: null,
    maxNights: null,
    applicableDateRanges: [],
    ...patch,
  }
}

describe('collectorFor', () => {
  it('reads the configured collector for the channel', () => {
    const config = {
      channelPolicy: { 'Airbnb': 'channel' as const, 'Booking.com': 'host' as const },
      chargeableGuests: { adults: true, children: false, infants: false },
    }
    expect(collectorFor(config, 'Airbnb')).toBe('channel')
    expect(collectorFor(config, 'Booking.com')).toBe('host')
  })

  it('falls back to host for an unset channel, so nothing goes silently uncollected', () => {
    const config = {
      channelPolicy: { Airbnb: 'channel' as const },
      chargeableGuests: { adults: true, children: false, infants: false },
    }
    expect(collectorFor(config, 'Direct')).toBe('host')
  })

  it('falls back to host when there is no config at all', () => {
    expect(collectorFor(undefined, 'Airbnb')).toBe('host')
  })
})

describe('chargeableGuestCount', () => {
  const adultsOnly = { adults: true, children: false, infants: false }

  it('counts only the enabled categories', () => {
    const reservation = { guestCount: 5, guestAdults: 2, guestChildren: 2, guestInfants: 1 }
    expect(chargeableGuestCount(reservation, { channelPolicy: {}, chargeableGuests: adultsOnly })).toBe(2)
    expect(chargeableGuestCount(reservation, {
      channelPolicy: {},
      chargeableGuests: { adults: true, children: true, infants: false },
    })).toBe(4)
  })

  it('treats guestCount as adults when there is no breakdown', () => {
    expect(chargeableGuestCount({ guestCount: 3 }, { channelPolicy: {}, chargeableGuests: adultsOnly })).toBe(3)
  })

  it('charges nobody when the breakdown is absent and adults are exempt', () => {
    expect(chargeableGuestCount({ guestCount: 3 }, {
      channelPolicy: {},
      chargeableGuests: { adults: false, children: true, infants: false },
    })).toBe(0)
  })

  it('defaults to adults only when no config is given', () => {
    expect(chargeableGuestCount({ guestCount: 4, guestAdults: 2, guestChildren: 2 })).toBe(2)
  })
})

describe('chargeableNights', () => {
  it('returns every night when nothing is configured', () => {
    expect(chargeableNights(taxItem(), 5)).toBe(5)
  })

  it('drops the skipped nights', () => {
    expect(chargeableNights(taxItem({ skipNights: 2 }), 5)).toBe(3)
  })

  it('caps at maxNights', () => {
    expect(chargeableNights(taxItem({ maxNights: 3 }), 10)).toBe(3)
  })

  it('applies skip before the cap', () => {
    expect(chargeableNights(taxItem({ skipNights: 2, maxNights: 3 }), 10)).toBe(3)
  })

  it('clamps at zero rather than going negative', () => {
    expect(chargeableNights(taxItem({ skipNights: 7 }), 2)).toBe(0)
  })
})

describe('isWithinApplicableRange', () => {
  it('applies always when no range is configured', () => {
    expect(isWithinApplicableRange(taxItem(), '2026-09-12')).toBe(true)
  })

  it('applies inside the range, inclusive of both ends', () => {
    const item = taxItem({ applicableDateRanges: [{ after: '2026-06-01', before: '2026-09-30' }] })
    expect(isWithinApplicableRange(item, '2026-06-01')).toBe(true)
    expect(isWithinApplicableRange(item, '2026-09-30')).toBe(true)
    expect(isWithinApplicableRange(item, '2026-07-15')).toBe(true)
  })

  it('does not apply outside the range', () => {
    const item = taxItem({ applicableDateRanges: [{ after: '2026-06-01', before: '2026-09-30' }] })
    expect(isWithinApplicableRange(item, '2026-05-31')).toBe(false)
    expect(isWithinApplicableRange(item, '2026-10-01')).toBe(false)
  })

  it('applies when any one of several ranges matches', () => {
    const item = taxItem({ applicableDateRanges: [
      { after: '2026-01-01', before: '2026-02-28' },
      { after: '2026-06-01', before: '2026-09-30' },
    ] })
    expect(isWithinApplicableRange(item, '2026-01-15')).toBe(true)
    expect(isWithinApplicableRange(item, '2026-04-01')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/lib/city-tax.spec.ts`
Expected: FAIL, `Failed to resolve import "~/components/reservations/data/city-tax"`

- [ ] **Step 3: Write the module**

Create `app/components/reservations/data/city-tax.ts`:

```ts
import type {
  BookingChannel,
  CityTaxChargeableGuests,
  CityTaxCollector,
  CityTaxConfig,
  ListingFeeTaxItem,
} from '~/components/listings/data/listings'

/** Adults pay, nobody else does, until a tenant says otherwise. */
export const DEFAULT_CHARGEABLE_GUESTS: CityTaxChargeableGuests = {
  adults: true,
  children: false,
  infants: false,
}

/**
 * An unset channel falls back to 'host'. The whole feature exists so a
 * collection is never missed, so an unconfigured channel must raise an alert
 * rather than go quiet.
 */
export function collectorFor(config: CityTaxConfig | undefined, channel: BookingChannel): CityTaxCollector {
  return config?.channelPolicy?.[channel] ?? 'host'
}

/** Structural, so a draft or a fixture prices without a whole ReservationEntry. */
export interface CityTaxGuestCounts {
  guestCount: number
  guestAdults?: number
  guestChildren?: number
  guestInfants?: number
}

export function chargeableGuestCount(guests: CityTaxGuestCounts, config?: CityTaxConfig): number {
  const rules = config?.chargeableGuests ?? DEFAULT_CHARGEABLE_GUESTS
  const hasBreakdown = guests.guestAdults !== undefined
    || guests.guestChildren !== undefined
    || guests.guestInfants !== undefined

  // Without a breakdown the headcount is all we know. Treating it as adults is
  // the only reading that does not invent an exemption.
  if (!hasBreakdown)
    return rules.adults ? guests.guestCount : 0

  let total = 0
  if (rules.adults)
    total += guests.guestAdults ?? 0
  if (rules.children)
    total += guests.guestChildren ?? 0
  if (rules.infants)
    total += guests.guestInfants ?? 0
  return total
}

export type CityTaxNightRules = Pick<ListingFeeTaxItem, 'skipNights' | 'maxNights'>

/** Skip first, then cap, then clamp. A 2-night stay with skipNights 7 owes zero, never minus five. */
export function chargeableNights(item: CityTaxNightRules, nights: number): number {
  const afterSkip = nights - (item.skipNights ?? 0)
  const capped = item.maxNights == null ? afterSkip : Math.min(afterSkip, item.maxNights)
  return Math.max(0, capped)
}

export type CityTaxDateRules = Pick<ListingFeeTaxItem, 'applicableDateRanges'>

/**
 * Evaluated against check-in, and inclusive at both ends: a season that runs
 * "01 June to 30 September" includes a guest arriving on 30 September.
 */
export function isWithinApplicableRange(item: CityTaxDateRules, checkIn: string): boolean {
  const ranges = item.applicableDateRanges ?? []
  if (ranges.length === 0)
    return true
  return ranges.some(range => checkIn >= range.after && checkIn <= range.before)
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/lib/city-tax.spec.ts`
Expected: PASS, 16 tests

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/data/city-tax.ts tests/lib/city-tax.spec.ts
git commit -m "feat(city-tax): collector lookup, guest counting, night and season rules"
```

---

## Task 3: Rules module, part 2 (`computeCityTaxLine`)

**Files:**
- Modify: `app/components/reservations/data/city-tax.ts`
- Test: `tests/lib/city-tax.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/city-tax.spec.ts`. Add `computeCityTaxLine` to the existing import
from `~/components/reservations/data/city-tax`, add
`import type { ReservationEntry } from '~/components/reservations/data/reservations'` at
the top, then append:

```ts
function reservation(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    id: 'res-ct-1',
    guestId: 'guest-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestPhone: '+49 170 1234567',
    guestLanguage: 'de',
    guestNotes: '',
    listingId: 'lst-1',
    listingName: 'Villa Merapi',
    channel: 'Direct',
    checkIn: '2026-07-10',
    checkOut: '2026-07-14',
    nights: 4,
    guestCount: 2,
    guestAdults: 2,
    guestChildren: 0,
    guestInfants: 0,
    totalPrice: 1000,
    currency: 'EUR',
    status: 'verified',
    activity: [],
    ...patch,
  } as ReservationEntry
}

describe('computeCityTaxLine', () => {
  it('prices per person per night off the chargeable counts', () => {
    const line = computeCityTaxLine(taxItem({ rate: 3 }), reservation())
    expect(line?.amount).toBe(24) // 2 guests x 4 nights x 3
    expect(line?.chargeableGuests).toBe(2)
    expect(line?.chargeableNights).toBe(4)
  })

  it('prices per person, ignoring nights', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'per_person', rate: 5 }), reservation())?.amount).toBe(10)
  })

  it('prices per night', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'per_night', rate: 7 }), reservation())?.amount).toBe(28)
  })

  it('prices per booking as a flat amount', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'per_booking', rate: 15 }), reservation())?.amount).toBe(15)
  })

  it('multiplies per_room and per_room_per_night by the booked room lines', () => {
    const twoRooms = reservation({
      rooms: [
        { id: 'rl-1', unitTypeId: 'ut-1', unitId: 'u-1', unitName: 'Room 1', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 400 },
        { id: 'rl-2', unitTypeId: 'ut-1', unitId: 'u-2', unitName: 'Room 2', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 400 },
      ],
    } as Partial<ReservationEntry>)
    expect(computeCityTaxLine(taxItem({ logic: 'per_room', rate: 10 }), twoRooms)?.amount).toBe(20)
    expect(computeCityTaxLine(taxItem({ logic: 'per_room_per_night', rate: 10 }), twoRooms)?.amount).toBe(80)
  })

  it('counts one room when the booking has no room lines', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'per_room', rate: 10 }), reservation())?.amount).toBe(10)
  })

  it('charges a percentage on the accommodation subtotal, never the grand total', () => {
    const withPrice = reservation({
      totalPrice: 1300,
      priceDetails: { subtotal: 1000, cleaningFee: 150, serviceFee: 50, tax: 100, extras: 0, guestPaid: 1300, commission: 0, payout: 1300 },
    })
    // 5% of the 1000 subtotal, not of the 1300 the guest paid.
    expect(computeCityTaxLine(taxItem({ logic: 'percent', rate: 5, currency: undefined }), withPrice)?.amount).toBe(50)
  })

  it('charges nothing on a percentage when there is no price breakdown to charge it on', () => {
    expect(computeCityTaxLine(taxItem({ logic: 'percent', rate: 5 }), reservation())?.amount).toBe(0)
  })

  it('prices a percentage in the reservation currency, ignoring the item currency', () => {
    const withPrice = reservation({
      currency: 'EUR',
      priceDetails: { subtotal: 1000, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1000, commission: 0, payout: 1000 },
    })
    expect(computeCityTaxLine(taxItem({ logic: 'percent', rate: 5, currency: 'USD' }), withPrice)?.currency).toBe('EUR')
  })

  it('keeps the item currency for a fixed-amount logic', () => {
    const line = computeCityTaxLine(taxItem({ currency: 'EUR' }), reservation({ currency: 'IDR' }))
    expect(line?.currency).toBe('EUR')
  })

  it('falls back to the reservation currency when the item sets none', () => {
    const line = computeCityTaxLine(taxItem({ currency: undefined }), reservation({ currency: 'IDR' }))
    expect(line?.currency).toBe('IDR')
  })

  it('applies skipNights to a per-night logic', () => {
    expect(computeCityTaxLine(taxItem({ rate: 3, skipNights: 1 }), reservation())?.amount).toBe(18)
  })

  it('leaves a night-independent logic alone when nights are skipped away', () => {
    // per_booking is a flat charge. skipNights describes nights, so it has
    // nothing to act on here, and the stay still owes the flat amount.
    expect(computeCityTaxLine(taxItem({ logic: 'per_booking', rate: 15, skipNights: 10 }), reservation())?.amount).toBe(15)
  })

  it('returns null for an item that is not a city tax', () => {
    expect(computeCityTaxLine(taxItem({ type: 'fee' }), reservation())).toBeNull()
  })

  it('returns null when the stay falls outside the applicable season', () => {
    const item = taxItem({ applicableDateRanges: [{ after: '2026-01-01', before: '2026-03-31' }] })
    expect(computeCityTaxLine(item, reservation())).toBeNull()
  })

  it('rounds to the currency minor unit', () => {
    const withPrice = reservation({
      priceDetails: { subtotal: 333.33, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 333.33, commission: 0, payout: 333.33 },
    })
    expect(computeCityTaxLine(taxItem({ logic: 'percent', rate: 7.5 }), withPrice)?.amount).toBe(25)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/lib/city-tax.spec.ts`
Expected: FAIL, `computeCityTaxLine is not a function`

- [ ] **Step 3: Implement**

Append to `app/components/reservations/data/city-tax.ts`, and add
`import type { ReservationEntry } from '~/components/reservations/data/reservations'`
and `TaxLogic` to the `listings` type import at the top:

```ts
export interface CityTaxBasisLine {
  taxItemId: string
  taxTitle: string
  authorityName?: string
  /** The tenant's own note, carried through so the desk can read it on the stay. */
  note?: string
  logic: TaxLogic
  rate: number
  chargeableGuests: number
  chargeableNights: number
  rooms: number
  amount: number
  currency: string
}

export function roundCityTaxAmount(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * One priced line, or null when the item is not a city tax or the stay falls
 * outside its season.
 *
 * `skipNights` and `maxNights` describe nights, so they only bite on a logic
 * that multiplies by nights. A flat `per_booking` charge is unaffected by them.
 */
export function computeCityTaxLine(item: ListingFeeTaxItem, reservation: ReservationEntry): CityTaxBasisLine | null {
  if (item.type !== 'city_tax')
    return null
  if (!isWithinApplicableRange(item, reservation.checkIn))
    return null

  const config = item.cityTax
  const guests = chargeableGuestCount(reservation, config)
  const nights = chargeableNights(item, reservation.nights)
  const rooms = reservation.rooms?.length ?? 1

  let amount = 0
  switch (item.logic) {
    case 'percent':
      // The accommodation subtotal only. A tourist levy is not charged on the
      // cleaning fee, the service fee or a desk-posted extra.
      amount = (reservation.priceDetails?.subtotal ?? 0) * (item.rate / 100)
      break
    case 'per_booking':
      amount = item.rate
      break
    case 'per_night':
      amount = item.rate * nights
      break
    case 'per_room':
      amount = item.rate * rooms
      break
    case 'per_room_per_night':
      amount = item.rate * rooms * nights
      break
    case 'per_person':
      amount = item.rate * guests
      break
    case 'per_person_per_night':
      amount = item.rate * guests * nights
      break
  }

  return {
    taxItemId: item.id,
    taxTitle: item.title,
    authorityName: config?.authorityName,
    note: config?.note,
    logic: item.logic,
    rate: item.rate,
    chargeableGuests: guests,
    chargeableNights: nights,
    rooms,
    // A percentage is a slice of a price already in the reservation's currency.
    // A fixed amount is denominated by the tax item itself.
    currency: item.logic === 'percent' ? reservation.currency : (item.currency ?? reservation.currency),
    amount: roundCityTaxAmount(Math.max(0, amount)),
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/lib/city-tax.spec.ts`
Expected: PASS, 32 tests

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/data/city-tax.ts tests/lib/city-tax.spec.ts
git commit -m "feat(city-tax): price a tax line for every tax logic"
```

---

## Task 4: Rules module, part 3 (`resolveCityTax`)

**Files:**
- Modify: `app/components/reservations/data/city-tax.ts`
- Test: `tests/lib/city-tax.spec.ts`

- [ ] **Step 1: Write the failing test**

Add `cityTaxTotals` and `resolveCityTax` to the import, then append to
`tests/lib/city-tax.spec.ts`:

```ts
const hostConfig = {
  channelPolicy: { 'Direct': 'host' as const, 'Booking.com': 'host' as const, 'Airbnb': 'channel' as const },
  chargeableGuests: { adults: true, children: false, infants: false },
}

describe('cityTaxTotals', () => {
  it('sums lines that share a currency into one entry', () => {
    const lines = [
      { taxItemId: 'a', taxTitle: 'A', logic: 'per_booking' as const, rate: 1, chargeableGuests: 0, chargeableNights: 0, rooms: 1, amount: 10, currency: 'EUR' },
      { taxItemId: 'b', taxTitle: 'B', logic: 'per_booking' as const, rate: 1, chargeableGuests: 0, chargeableNights: 0, rooms: 1, amount: 5.5, currency: 'EUR' },
    ]
    expect(cityTaxTotals(lines)).toEqual([{ currency: 'EUR', amount: 15.5 }])
  })

  it('never blends two currencies into one number', () => {
    const lines = [
      { taxItemId: 'a', taxTitle: 'A', logic: 'per_booking' as const, rate: 1, chargeableGuests: 0, chargeableNights: 0, rooms: 1, amount: 10, currency: 'EUR' },
      { taxItemId: 'b', taxTitle: 'B', logic: 'per_booking' as const, rate: 1, chargeableGuests: 0, chargeableNights: 0, rooms: 1, amount: 50000, currency: 'IDR' },
    ]
    expect(cityTaxTotals(lines)).toEqual([
      { currency: 'EUR', amount: 10 },
      { currency: 'IDR', amount: 50000 },
    ])
  })
})

describe('resolveCityTax', () => {
  it('is due when the host collects on this channel', () => {
    const assessment = resolveCityTax(reservation(), [taxItem({ cityTax: hostConfig })])
    expect(assessment.status).toBe('due')
    expect(assessment.collector).toBe('host')
    expect(assessment.totals).toEqual([{ currency: 'EUR', amount: 24 }])
    expect(assessment.lines).toHaveLength(1)
  })

  it('says the channel collects and shows no amount to take', () => {
    const assessment = resolveCityTax(reservation({ channel: 'Airbnb' }), [taxItem({ cityTax: hostConfig })])
    expect(assessment.status).toBe('channel_collects')
    expect(assessment.collector).toBe('channel')
    expect(assessment.totals).toEqual([])
    expect(assessment.lines).toEqual([])
  })

  it('is not required when the listing levies no city tax', () => {
    expect(resolveCityTax(reservation(), []).status).toBe('not_required')
    expect(resolveCityTax(reservation(), [taxItem({ type: 'fee' })]).status).toBe('not_required')
  })

  it('is not required when every channel is marked not applicable', () => {
    const config = { ...hostConfig, channelPolicy: { Direct: 'not_applicable' as const } }
    expect(resolveCityTax(reservation(), [taxItem({ cityTax: config })]).status).toBe('not_required')
  })

  it('is not required when the stay falls outside the tax season and nothing else applies', () => {
    const item = taxItem({ cityTax: hostConfig, applicableDateRanges: [{ after: '2026-01-01', before: '2026-02-01' }] })
    expect(resolveCityTax(reservation(), [item]).status).toBe('not_required')
  })

  it('is not required when the computed amount is zero', () => {
    const item = taxItem({ cityTax: hostConfig, rate: 0 })
    expect(resolveCityTax(reservation(), [item]).status).toBe('not_required')
  })

  it('sums several city taxes on one listing into separate lines', () => {
    const assessment = resolveCityTax(reservation(), [
      taxItem({ id: 'ft-a', title: 'Kurtaxe', rate: 3, cityTax: hostConfig }),
      taxItem({ id: 'ft-b', title: 'Tourism levy', logic: 'per_booking', rate: 10, cityTax: hostConfig }),
    ])
    expect(assessment.lines).toHaveLength(2)
    expect(assessment.totals).toEqual([{ currency: 'EUR', amount: 34 }])
  })

  it('reports a settled stay from its stored settlement, not the live amount', () => {
    const settled = reservation({
      cityTaxSettlement: {
        state: 'collected',
        totals: [{ currency: 'EUR', amount: 18 }],
        settledAt: '2026-07-10T09:00:00.000Z',
        settledBy: 'Komang Juliantara',
        method: 'cash',
      },
    })
    const assessment = resolveCityTax(settled, [taxItem({ cityTax: hostConfig })])
    expect(assessment.status).toBe('collected')
    expect(assessment.settlement?.totals).toEqual([{ currency: 'EUR', amount: 18 }])
    // The live rules still say 24. The settlement is what was actually taken.
    expect(assessment.totals).toEqual([{ currency: 'EUR', amount: 24 }])
  })

  it('reports a waived stay', () => {
    const waived = reservation({
      cityTaxSettlement: {
        state: 'waived',
        totals: [{ currency: 'EUR', amount: 24 }],
        settledAt: '2026-07-10T09:00:00.000Z',
        settledBy: 'Komang Juliantara',
        reason: 'Business traveller, exempt under local rule',
      },
    })
    expect(resolveCityTax(waived, [taxItem({ cityTax: hostConfig })]).status).toBe('waived')
  })

  it('owes nothing on a cancelled stay', () => {
    const cancelled = reservation({ status: 'cancelled' })
    expect(resolveCityTax(cancelled, [taxItem({ cityTax: hostConfig })]).status).toBe('not_required')
  })

  it('re-evaluates an untouched booking when the policy flips, because status is derived', () => {
    const stay = reservation({ channel: 'Booking.com' })
    const collecting = taxItem({ cityTax: hostConfig })
    expect(resolveCityTax(stay, [collecting]).status).toBe('due')

    const handedToChannel = taxItem({
      cityTax: { ...hostConfig, channelPolicy: { ...hostConfig.channelPolicy, 'Booking.com': 'channel' as const } },
    })
    expect(resolveCityTax(stay, [handedToChannel]).status).toBe('channel_collects')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/lib/city-tax.spec.ts`
Expected: FAIL, `resolveCityTax is not a function`

- [ ] **Step 3: Implement**

Append to `app/components/reservations/data/city-tax.ts`, adding `CityTaxSettlement` and
`CityTaxTotal` to the `reservations` type import:

```ts
export type CityTaxStatus
  = 'not_required'
    | 'channel_collects'
    | 'due'
    | 'collected'
    | 'waived'

export interface CityTaxAssessment {
  status: CityTaxStatus
  collector: CityTaxCollector
  /**
   * One entry per currency present in `lines`. Almost always length 1. There is
   * deliberately no single `amount` field: two currencies must never be blended
   * into one number, and this app invents no exchange rates.
   */
  totals: CityTaxTotal[]
  lines: CityTaxBasisLine[]
  settlement: CityTaxSettlement | null
}

/**
 * Structural on purpose: a `CityTaxBasisLine` and a frozen `CityTaxTotal` both
 * satisfy it, so the live assessment and a settled stay sum through one
 * function instead of two that can drift apart.
 */
export function cityTaxTotals(amounts: Array<{ currency: string, amount: number }>): CityTaxTotal[] {
  const byCurrency = new Map<string, number>()
  for (const entry of amounts)
    byCurrency.set(entry.currency, roundCityTaxAmount((byCurrency.get(entry.currency) ?? 0) + entry.amount))
  return [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount }))
}

/**
 * The whole city tax picture for one stay, computed fresh every time.
 *
 * Nothing here reads a stored status, and that is the point: flipping a channel
 * policy must re-evaluate every existing booking on the spot. Only the
 * settlement is stored, and only once staff have acted.
 */
export function resolveCityTax(reservation: ReservationEntry, items: ListingFeeTaxItem[]): CityTaxAssessment {
  const settlement = reservation.cityTaxSettlement ?? null
  const cityTaxes = items.filter(item => item.type === 'city_tax')

  // A cancelled or blocked stay owes nothing, whatever the policy says.
  const dead = reservation.status === 'cancelled' || reservation.status === 'blocked'

  const lines = dead
    ? []
    : cityTaxes
        .filter(item => collectorFor(item.cityTax, reservation.channel) === 'host')
        .map(item => computeCityTaxLine(item, reservation))
        .filter((line): line is CityTaxBasisLine => line !== null && line.amount > 0)

  const totals = cityTaxTotals(lines)

  if (settlement)
    return { status: settlement.state, collector: 'host', totals, lines, settlement }

  if (lines.length > 0)
    return { status: 'due', collector: 'host', totals, lines, settlement: null }

  const channelCollects = !dead && cityTaxes.some(item =>
    collectorFor(item.cityTax, reservation.channel) === 'channel'
    && isWithinApplicableRange(item, reservation.checkIn))

  if (channelCollects)
    return { status: 'channel_collects', collector: 'channel', totals: [], lines: [], settlement: null }

  return { status: 'not_required', collector: 'not_applicable', totals: [], lines: [], settlement: null }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/lib/city-tax.spec.ts`
Expected: PASS, 45 tests

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/data/city-tax.ts tests/lib/city-tax.spec.ts
git commit -m "feat(city-tax): derive the assessment, keeping status out of storage"
```

---

## Task 5: Rules module, part 4 (alert stage and activity event)

**Files:**
- Modify: `app/components/reservations/data/city-tax.ts`
- Test: `tests/lib/city-tax.spec.ts`

- [ ] **Step 1: Write the failing test**

Add `cityTaxActivityEvent` and `cityTaxAlertStage` to the import, then append to
`tests/lib/city-tax.spec.ts`:

```ts
describe('cityTaxAlertStage', () => {
  const today = '2026-07-12'

  function dueAssessment() {
    return resolveCityTax(reservation(), [taxItem({ cityTax: hostConfig })])
  }

  it('is upcoming before arrival', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: '2026-07-20', checkOut: '2026-07-24' }, today)).toBe('upcoming')
  })

  it('is due on the arrival day itself', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: today, checkOut: '2026-07-16' }, today)).toBe('due_today')
  })

  it('stays due while the guest is still in house, because it is still collectable', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: '2026-07-10', checkOut: '2026-07-16' }, today)).toBe('due_today')
  })

  it('is overdue on the departure day, once the guest can walk out', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: '2026-07-08', checkOut: today }, today)).toBe('overdue')
  })

  it('is overdue after departure', () => {
    expect(cityTaxAlertStage(dueAssessment(), { checkIn: '2026-07-01', checkOut: '2026-07-05' }, today)).toBe('overdue')
  })

  it('is silent for anything that is not due', () => {
    const settled = resolveCityTax(
      reservation({
        cityTaxSettlement: {
          state: 'collected',
          totals: [{ currency: 'EUR', amount: 24 }],
          settledAt: '2026-07-10T09:00:00.000Z',
          settledBy: 'Komang Juliantara',
          method: 'cash',
        },
      }),
      [taxItem({ cityTax: hostConfig })],
    )
    expect(cityTaxAlertStage(settled, { checkIn: '2026-07-01', checkOut: '2026-07-05' }, today)).toBeNull()

    const channel = resolveCityTax(reservation({ channel: 'Airbnb' }), [taxItem({ cityTax: hostConfig })])
    expect(cityTaxAlertStage(channel, { checkIn: '2026-07-01', checkOut: '2026-07-05' }, today)).toBeNull()
  })
})

describe('cityTaxActivityEvent', () => {
  const settlement = {
    state: 'collected' as const,
    totals: [{ currency: 'EUR', amount: 24 }],
    settledAt: '2026-07-12T09:30:00.000Z',
    settledBy: 'Komang Juliantara',
    method: 'cash' as const,
  }

  it('states the amount and the method', () => {
    const event = cityTaxActivityEvent('collected', settlement, 'Komang Juliantara', '2026-07-12T09:30:00.000Z')
    expect(event.title).toBe('City tax collected')
    expect(event.description).toContain('24.00 EUR')
    expect(event.description).toContain('Cash')
    expect(event.actor).toBe('Komang Juliantara')
    expect(event.type).toBe('reservation')
    expect(event.colorDot).toBe('green')
  })

  it('states the reason on a waive', () => {
    const waived = { ...settlement, state: 'waived' as const, method: undefined, reason: 'Business traveller' }
    const event = cityTaxActivityEvent('waived', waived, 'Komang Juliantara', '2026-07-12T09:30:00.000Z')
    expect(event.title).toBe('City tax waived')
    expect(event.description).toContain('Reason: Business traveller')
  })

  it('lists every currency on a multi-currency settlement', () => {
    const mixed = { ...settlement, totals: [{ currency: 'EUR', amount: 24 }, { currency: 'IDR', amount: 50000 }] }
    const event = cityTaxActivityEvent('collected', mixed, 'Komang Juliantara', '2026-07-12T09:30:00.000Z')
    expect(event.description).toContain('24.00 EUR')
    expect(event.description).toContain('50,000.00 IDR')
  })

  it('describes a reopen without a settlement to read from', () => {
    const event = cityTaxActivityEvent('reopened', null, 'Komang Juliantara', '2026-07-12T09:30:00.000Z')
    expect(event.title).toBe('City tax reopened')
    expect(event.colorDot).toBe('gold')
  })

  it('gives two settlements of the same kind different ids, so an undo and a re-collect both show', () => {
    const first = cityTaxActivityEvent('collected', settlement, 'A', '2026-07-12T09:30:00.000Z')
    const second = cityTaxActivityEvent('collected', settlement, 'A', '2026-07-12T11:00:00.000Z')
    expect(first.id).not.toBe(second.id)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/lib/city-tax.spec.ts`
Expected: FAIL, `cityTaxAlertStage is not a function`

- [ ] **Step 3: Implement**

Append to `app/components/reservations/data/city-tax.ts`, adding
`import type { ActivityEvent, ActivityEventColor } from '~/components/inbox/data/conversations'`
and `CityTaxPaymentMethod` to the `reservations` type import:

```ts
export type CityTaxAlertStage = 'upcoming' | 'due_today' | 'overdue'

/**
 * `due_today` covers the whole stay, not just the arrival date: an in-house
 * guest can still be asked at the desk. It turns `overdue` on the check-out
 * date itself, the first day the guest can walk out without paying.
 */
export function cityTaxAlertStage(
  assessment: CityTaxAssessment,
  stay: Pick<ReservationEntry, 'checkIn' | 'checkOut'>,
  todayIso: string,
): CityTaxAlertStage | null {
  if (assessment.status !== 'due')
    return null
  if (stay.checkOut <= todayIso)
    return 'overdue'
  if (stay.checkIn <= todayIso)
    return 'due_today'
  return 'upcoming'
}

export const CITY_TAX_METHOD_LABELS: Record<CityTaxPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  other: 'Other',
}

export type CityTaxActivityKind = 'collected' | 'waived' | 'reopened'

const cityTaxActivityTitles: Record<CityTaxActivityKind, string> = {
  collected: 'City tax collected',
  waived: 'City tax waived',
  reopened: 'City tax reopened',
}

const cityTaxActivityColors: Record<CityTaxActivityKind, ActivityEventColor> = {
  collected: 'green',
  waived: 'gray',
  reopened: 'gold',
}

export function formatCityTaxTotal(total: CityTaxTotal): string {
  return `${total.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${total.currency}`
}

export function formatCityTaxTotals(totals: CityTaxTotal[]): string {
  return totals.length === 0 ? '0.00' : totals.map(formatCityTaxTotal).join(' + ')
}

/**
 * The id carries the timestamp rather than just the kind. Unlike a folio item,
 * a reservation has exactly one city tax settlement, so collect / undo /
 * collect again would otherwise produce three events sharing one id and the
 * timeline would render one.
 */
export function cityTaxActivityEvent(
  kind: CityTaxActivityKind,
  settlement: CityTaxSettlement | null,
  actor: string,
  now: string = new Date().toISOString(),
): ActivityEvent {
  const parts: string[] = []
  if (settlement) {
    parts.push(formatCityTaxTotals(settlement.totals))
    if (kind === 'collected' && settlement.method)
      parts.push(CITY_TAX_METHOD_LABELS[settlement.method])
    if (kind === 'waived' && settlement.reason)
      parts.push(`Reason: ${settlement.reason}`)
  }
  else {
    parts.push('Marked outstanding again')
  }

  return {
    id: `act-citytax-${kind}-${now}`,
    type: 'reservation',
    title: cityTaxActivityTitles[kind],
    description: parts.join(' · '),
    actor,
    timestamp: now,
    colorDot: cityTaxActivityColors[kind],
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/lib/city-tax.spec.ts`
Expected: PASS, 56 tests

- [ ] **Step 5: Commit**

```bash
git add app/components/reservations/data/city-tax.ts tests/lib/city-tax.spec.ts
git commit -m "feat(city-tax): alert staging and activity events"
```

---

## Task 6: Alert types and notification wiring

Do this **before** the composable: `useCityTax` calls `createCityTaxAlert`, and an alert
type missing from a notification category never reaches the bell.

**Files:**
- Modify: `app/components/notifications/data/alerts.ts`
- Modify: `app/components/notifications/data/notification-settings.ts`
- Modify: `app/composables/useNotifications.ts`
- Test: `tests/composables/useCityTaxAlerts.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/composables/useCityTaxAlerts.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  alertDisplayLabels,
  alertIcons,
  alertRouteMap,
  getDescription,
} from '~/components/notifications/data/alerts'
import { notificationCategories } from '~/components/notifications/data/notification-settings'

const CITY_TAX_TYPES = [
  'CITY_TAX_COLLECTION_UPCOMING',
  'CITY_TAX_COLLECTION_DUE',
  'CITY_TAX_COLLECTION_MISSED',
] as const

describe('city tax alert metadata', () => {
  it.each(CITY_TAX_TYPES)('%s has a label, an icon and a route', (type) => {
    expect(alertDisplayLabels[type]).toBeTruthy()
    expect(alertIcons[type]).toBeTruthy()
    expect(alertRouteMap[type]).toBe('/city-tax')
  })

  it('describes the collection with the guest, the property and the amount', () => {
    const description = getDescription('CITY_TAX_COLLECTION_DUE', {
      guest_name: 'Anna Schmidt',
      listing_name: 'Villa Merapi',
      amount_label: '24.00 EUR',
    })
    expect(description).toContain('Anna Schmidt')
    expect(description).toContain('Villa Merapi')
    expect(description).toContain('24.00 EUR')
  })

  it.each(CITY_TAX_TYPES)('%s sits in a notification category, or it is invisible in the bell', (type) => {
    const covered = notificationCategories.some(category => category.alertTypes.includes(type))
    expect(covered).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/composables/useCityTaxAlerts.spec.ts`
Expected: FAIL, the label lookups are `undefined`

- [ ] **Step 3: Add the types to `alerts.ts`**

In `app/components/notifications/data/alerts.ts`, add to the `AlertType` union (next to
the `GUEST_REGISTRATION_*` entries):

```ts
    | 'CITY_TAX_COLLECTION_UPCOMING'
    | 'CITY_TAX_COLLECTION_DUE'
    | 'CITY_TAX_COLLECTION_MISSED'
```

Add to `alertDisplayLabels`:

```ts
  CITY_TAX_COLLECTION_UPCOMING: 'City Tax - Collection Booked',
  CITY_TAX_COLLECTION_DUE: 'City Tax - Collection Due',
  CITY_TAX_COLLECTION_MISSED: 'City Tax - Not Collected',
```

Add to `alertIcons`:

```ts
  CITY_TAX_COLLECTION_UPCOMING: 'i-lucide-landmark',
  CITY_TAX_COLLECTION_DUE: 'i-lucide-landmark',
  CITY_TAX_COLLECTION_MISSED: 'i-lucide-alert-octagon',
```

Add to `alertRouteMap`:

```ts
  CITY_TAX_COLLECTION_UPCOMING: '/city-tax',
  CITY_TAX_COLLECTION_DUE: '/city-tax',
  CITY_TAX_COLLECTION_MISSED: '/city-tax',
```

Add to the `switch` in `getDescription`, before the default case:

```ts
    case 'CITY_TAX_COLLECTION_UPCOMING':
      return `${context.guest_name || 'Guest'} at ${context.listing_name || 'property'} owes ${context.amount_label || 'city tax'} on arrival. Collect it at the property.`
    case 'CITY_TAX_COLLECTION_DUE':
      return `${context.guest_name || 'Guest'} at ${context.listing_name || 'property'} owes ${context.amount_label || 'city tax'}. Collect it before check-out.`
    case 'CITY_TAX_COLLECTION_MISSED':
      return `${context.guest_name || 'Guest'} checked out of ${context.listing_name || 'property'} without paying ${context.amount_label || 'city tax'}.`
```

- [ ] **Step 4: Add the types to a notification category**

In `app/components/notifications/data/notification-settings.ts`, append to
`FINANCE_TYPES`:

```ts
  'CITY_TAX_COLLECTION_UPCOMING',
  'CITY_TAX_COLLECTION_DUE',
  'CITY_TAX_COLLECTION_MISSED',
```

Roles build `enabledAlertTypes` from these categories through
`getDefaultRoleNotifications`, so this is what makes the alerts visible at all.

- [ ] **Step 5: Add the creator wrapper**

In `app/composables/useNotifications.ts`, next to `createGuestRegistrationAlert`:

```ts
  function createCityTaxAlert(type: 'CITY_TAX_COLLECTION_UPCOMING' | 'CITY_TAX_COLLECTION_DUE' | 'CITY_TAX_COLLECTION_MISSED', context: Record<string, any>) {
    let severity: AlertSeverity = 'INFO'
    if (type === 'CITY_TAX_COLLECTION_MISSED')
      severity = 'CRITICAL'
    else if (type === 'CITY_TAX_COLLECTION_DUE')
      severity = 'WARNING'
    createAlert(type, severity, context)
  }
```

Add `createCityTaxAlert` to the object the composable returns.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/composables/useCityTaxAlerts.spec.ts`
Expected: PASS, 7 tests

- [ ] **Step 7: Guard against regressions elsewhere**

Run: `npx vitest run tests/composables/useNotifications.spec.ts tests/components/settings`
Expected: PASS. `alertDisplayLabels` and friends are `Record<AlertType, ...>`, so a missed
entry is a type error, not a silent gap.

- [ ] **Step 8: Commit**

```bash
git add app/components/notifications/data/alerts.ts app/components/notifications/data/notification-settings.ts app/composables/useNotifications.ts tests/composables/useCityTaxAlerts.spec.ts
git commit -m "feat(city-tax): three escalating alert types, wired into the finance category"
```

---

## Task 7: `useCityTax`, the settlement writer

**Files:**
- Create: `app/composables/useCityTax.ts`
- Test: `tests/composables/useCityTax.spec.ts`

⚠️ `useFeesTaxes` holds **module-level refs**, created once at import. The `useState` shim
in `tests/setup.ts` does not reset them, so every test here resets them by hand.

- [ ] **Step 1: Write the failing test**

Create `tests/composables/useCityTax.spec.ts`:

```ts
import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCityTax } from '~/composables/useCityTax'
import { useFeesTaxes } from '~/composables/useFeesTaxes'
import { useReservationsModule } from '~/composables/useReservationsModule'

const CITY_TAX: ListingFeeTaxItem = {
  id: 'ft-kurtaxe',
  title: 'Kurtaxe',
  type: 'city_tax',
  logic: 'per_person_per_night',
  rate: 3,
  currency: 'EUR',
  isInclusive: false,
  skipNights: null,
  maxNights: null,
  applicableDateRanges: [],
  cityTax: {
    channelPolicy: { 'Direct': 'host', 'Booking.com': 'host', 'Airbnb': 'channel' },
    chargeableGuests: { adults: true, children: false, infants: false },
    authorityName: 'Stadt Berlin',
  },
}

/** Dates relative to today: the alert stages are read against the current day. */
function isoDaysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function seedReservation(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  const { reservations } = useReservationsModule()
  const entry = {
    id: 'res-ct-1',
    guestId: 'guest-ct-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestPhone: '+49 170 1234567',
    guestLanguage: 'de',
    guestNotes: '',
    listingId: 'lst-1',
    listingName: 'Villa Merapi',
    channel: 'Direct',
    checkIn: isoDaysFromNow(3),
    checkOut: isoDaysFromNow(7),
    nights: 4,
    guestCount: 2,
    guestAdults: 2,
    guestChildren: 0,
    guestInfants: 0,
    totalPrice: 1000,
    currency: 'EUR',
    status: 'verified',
    activity: [],
    ...patch,
  } as ReservationEntry
  reservations.value = [entry, ...reservations.value.filter(r => r.id !== entry.id)]
  return entry
}

beforeEach(() => {
  // Module-level refs: the useState shim does not clear these.
  const fees = useFeesTaxes()
  fees.feeTaxItems.value = [structuredClone(CITY_TAX)]
  fees.taxSets.value = []
  fees.assignments.value = { 'lst-1': { feeTaxIds: ['ft-kurtaxe'], taxSetIds: [] } }
  useReservationsModule().reset()
})

describe('assessmentFor', () => {
  it('reads the listing assignment to price the stay', () => {
    seedReservation()
    const assessment = useCityTax().assessmentFor('res-ct-1')
    expect(assessment.status).toBe('due')
    expect(assessment.totals).toEqual([{ currency: 'EUR', amount: 24 }])
  })

  it('is not required for a listing with nothing assigned', () => {
    seedReservation({ id: 'res-ct-2', listingId: 'lst-9' })
    expect(useCityTax().assessmentFor('res-ct-2').status).toBe('not_required')
  })

  it('returns a not_required assessment for an unknown reservation', () => {
    expect(useCityTax().assessmentFor('res-nope').status).toBe('not_required')
  })
})

describe('markCollected', () => {
  it('freezes the totals and records who, when and how', () => {
    seedReservation()
    const cityTax = useCityTax()
    cityTax.markCollected('res-ct-1', { method: 'cash', note: 'Paid at the desk' })

    const settlement = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.cityTaxSettlement!
    expect(settlement.state).toBe('collected')
    expect(settlement.totals).toEqual([{ currency: 'EUR', amount: 24 }])
    expect(settlement.method).toBe('cash')
    expect(settlement.note).toBe('Paid at the desk')
    expect(settlement.settledBy).toBeTruthy()
    expect(cityTax.assessmentFor('res-ct-1').status).toBe('collected')
  })

  it('keeps the frozen total when the rate changes afterwards', () => {
    seedReservation()
    useCityTax().markCollected('res-ct-1', { method: 'cash' })

    const fees = useFeesTaxes()
    fees.feeTaxItems.value = [{ ...structuredClone(CITY_TAX), rate: 99 }]

    const assessment = useCityTax().assessmentFor('res-ct-1')
    expect(assessment.settlement?.totals).toEqual([{ currency: 'EUR', amount: 24 }])
    expect(assessment.status).toBe('collected')
  })

  it('appends one activity event in the same write as the settlement', () => {
    seedReservation()
    useCityTax().markCollected('res-ct-1', { method: 'card' })

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!
    expect(reservation.activity).toHaveLength(1)
    expect(reservation.activity[0]!.title).toBe('City tax collected')
    expect(reservation.cityTaxSettlement).toBeDefined()
  })

  it('does nothing when the channel collects', () => {
    seedReservation({ channel: 'Airbnb' })
    useCityTax().markCollected('res-ct-1', { method: 'cash' })
    expect(useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.cityTaxSettlement).toBeUndefined()
  })

  it('does nothing when it is already settled', () => {
    seedReservation()
    const cityTax = useCityTax()
    cityTax.markCollected('res-ct-1', { method: 'cash' })
    cityTax.markCollected('res-ct-1', { method: 'card' })

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!
    expect(reservation.cityTaxSettlement!.method).toBe('cash')
    expect(reservation.activity).toHaveLength(1)
  })

  it('never touches priceDetails, so an owner payout cannot absorb a municipal levy', () => {
    seedReservation({
      priceDetails: { subtotal: 1000, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1000, commission: 100, payout: 900 },
    })
    useCityTax().markCollected('res-ct-1', { method: 'cash' })

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!
    expect(reservation.priceDetails).toEqual({ subtotal: 1000, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1000, commission: 100, payout: 900 })
    expect(reservation.totalPrice).toBe(1000)
    expect(reservation.folioItems).toBeUndefined()
  })
})

describe('waive', () => {
  it('records the reason', () => {
    seedReservation()
    useCityTax().waive('res-ct-1', 'Business traveller, exempt')

    const settlement = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.cityTaxSettlement!
    expect(settlement.state).toBe('waived')
    expect(settlement.reason).toBe('Business traveller, exempt')
    expect(settlement.totals).toEqual([{ currency: 'EUR', amount: 24 }])
  })

  it('refuses an empty reason', () => {
    seedReservation()
    useCityTax().waive('res-ct-1', '   ')
    expect(useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.cityTaxSettlement).toBeUndefined()
  })
})

describe('undoSettlement', () => {
  it('puts the stay back to due and logs the reopen', () => {
    seedReservation()
    const cityTax = useCityTax()
    cityTax.markCollected('res-ct-1', { method: 'cash' })
    cityTax.undoSettlement('res-ct-1')

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!
    expect(reservation.cityTaxSettlement).toBeUndefined()
    expect(cityTax.assessmentFor('res-ct-1').status).toBe('due')
    expect(reservation.activity.at(-1)!.title).toBe('City tax reopened')
  })

  it('does nothing when there is no settlement to undo', () => {
    seedReservation()
    useCityTax().undoSettlement('res-ct-1')
    expect(useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.activity).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/composables/useCityTax.spec.ts`
Expected: FAIL, `Failed to resolve import "~/composables/useCityTax"`

- [ ] **Step 3: Implement**

Create `app/composables/useCityTax.ts`:

```ts
import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { CityTaxAssessment } from '~/components/reservations/data/city-tax'
import type { CityTaxPaymentMethod, CityTaxSettlement, ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import {
  cityTaxActivityEvent,
  formatCityTaxTotals,
  resolveCityTax,
} from '~/components/reservations/data/city-tax'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useFeesTaxes } from '~/composables/useFeesTaxes'
import { useReservationsModule } from '~/composables/useReservationsModule'

const EMPTY_ASSESSMENT: CityTaxAssessment = {
  status: 'not_required',
  collector: 'not_applicable',
  totals: [],
  lines: [],
  settlement: null,
}

/**
 * City tax on a stay. The ONLY writer of `ReservationEntry.cityTaxSettlement`.
 *
 * It never writes `priceDetails`, `guestPaid`, `payout`, `commission` or the
 * folio. A tourist levy is money held for a municipality, not owner revenue,
 * and `useReservationFolio.commit()` moves extras, guestPaid and payout in
 * lockstep, so routing a city tax through the folio would inflate every owner
 * payout by the tax.
 */
export function useCityTax() {
  const { reservations, updateReservation } = useReservationsModule()
  const { getFeesTaxesForListing } = useFeesTaxes()
  const { currentUser } = useCurrentDashboardUser()

  const actor = computed(() => currentUser.value?.name ?? 'Staff')

  function reservationById(id: string): ReservationEntry | null {
    return reservations.value.find(r => r.id === id) ?? null
  }

  function assess(reservation: ReservationEntry): CityTaxAssessment {
    return resolveCityTax(reservation, getFeesTaxesForListing(reservation.listingId))
  }

  function assessmentFor(reservationId: string): CityTaxAssessment {
    const reservation = reservationById(reservationId)
    return reservation ? assess(reservation) : EMPTY_ASSESSMENT
  }

  /**
   * One patch, so the settlement and its audit line can never land apart. The
   * same rule `useReservationFolio.commit()` follows.
   */
  function commit(reservation: ReservationEntry, settlement: CityTaxSettlement | undefined, event: ActivityEvent) {
    updateReservation(reservation.id, {
      cityTaxSettlement: settlement,
      // Oldest first, matching every seeded activity array and the timeline
      // that renders it.
      activity: [...reservation.activity, event],
    })
  }

  function settle(reservationId: string, build: (assessment: CityTaxAssessment) => CityTaxSettlement | null) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return
    const assessment = assess(reservation)
    if (assessment.status !== 'due')
      return
    const settlement = build(assessment)
    if (!settlement)
      return
    const kind = settlement.state === 'collected' ? 'collected' : 'waived'
    commit(reservation, settlement, cityTaxActivityEvent(kind, settlement, actor.value))
  }

  function markCollected(reservationId: string, options: { method: CityTaxPaymentMethod, note?: string }) {
    settle(reservationId, assessment => ({
      state: 'collected',
      totals: assessment.totals.map(total => ({ ...total })),
      settledAt: new Date().toISOString(),
      settledBy: actor.value,
      method: options.method,
      note: options.note?.trim() || undefined,
    }))

    const assessment = assessmentFor(reservationId)
    if (assessment.settlement?.state === 'collected')
      toast.success(`City tax collected: ${formatCityTaxTotals(assessment.settlement.totals)}`)
  }

  function waive(reservationId: string, reason: string) {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error('A waive needs a reason')
      return
    }
    settle(reservationId, assessment => ({
      state: 'waived',
      totals: assessment.totals.map(total => ({ ...total })),
      settledAt: new Date().toISOString(),
      settledBy: actor.value,
      reason: trimmed,
    }))
    toast.success('City tax waived')
  }

  function undoSettlement(reservationId: string) {
    const reservation = reservationById(reservationId)
    if (!reservation?.cityTaxSettlement)
      return
    commit(reservation, undefined, cityTaxActivityEvent('reopened', null, actor.value))
    toast.info('City tax marked outstanding again')
  }

  return {
    assessmentFor,
    markCollected,
    waive,
    undoSettlement,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/composables/useCityTax.spec.ts`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add app/composables/useCityTax.ts tests/composables/useCityTax.spec.ts
git commit -m "feat(city-tax): settlement actions, frozen totals, one write per action"
```

---

## Task 8: Worklist computeds and alert emission

**Files:**
- Modify: `app/composables/useCityTax.ts`
- Test: `tests/composables/useCityTax.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/composables/useCityTax.spec.ts`, adding
`import { useNotifications } from '~/composables/useNotifications'` at the top:

```ts
describe('worklist', () => {
  it('buckets stays by where they are against today', () => {
    seedReservation({ id: 'res-up', checkIn: isoDaysFromNow(5), checkOut: isoDaysFromNow(9) })
    seedReservation({ id: 'res-now', checkIn: isoDaysFromNow(-1), checkOut: isoDaysFromNow(2) })
    seedReservation({ id: 'res-gone', checkIn: isoDaysFromNow(-6), checkOut: isoDaysFromNow(-2) })

    const cityTax = useCityTax()
    expect(cityTax.upcoming.value.map(row => row.reservation.id)).toContain('res-up')
    expect(cityTax.dueToday.value.map(row => row.reservation.id)).toContain('res-now')
    expect(cityTax.overdue.value.map(row => row.reservation.id)).toContain('res-gone')
  })

  it('moves a stay out of the outstanding buckets once it is settled', () => {
    seedReservation({ id: 'res-gone', checkIn: isoDaysFromNow(-6), checkOut: isoDaysFromNow(-2) })
    const cityTax = useCityTax()
    expect(cityTax.overdue.value.map(row => row.reservation.id)).toContain('res-gone')

    cityTax.markCollected('res-gone', { method: 'cash' })
    expect(cityTax.overdue.value.map(row => row.reservation.id)).not.toContain('res-gone')
    expect(cityTax.settled.value.map(row => row.reservation.id)).toContain('res-gone')
  })

  it('totals what is outstanding per currency and never blends them', () => {
    const fees = useFeesTaxes()
    fees.feeTaxItems.value = [
      structuredClone(CITY_TAX),
      { ...structuredClone(CITY_TAX), id: 'ft-pajak', title: 'Pajak Hotel', currency: 'IDR', rate: 25000, logic: 'per_night' },
    ]
    fees.assignments.value = { 'lst-1': { feeTaxIds: ['ft-kurtaxe'], taxSetIds: [] }, 'lst-2': { feeTaxIds: ['ft-pajak'], taxSetIds: [] } }

    seedReservation({ id: 'res-eur', checkIn: isoDaysFromNow(-1), checkOut: isoDaysFromNow(2) })
    seedReservation({ id: 'res-idr', listingId: 'lst-2', currency: 'IDR', checkIn: isoDaysFromNow(-1), checkOut: isoDaysFromNow(2), nights: 4 })

    const totals = useCityTax().outstandingTotal.value
    expect(totals).toContainEqual({ currency: 'EUR', amount: 24 })
    expect(totals).toContainEqual({ currency: 'IDR', amount: 100000 })
  })

  it('leaves out stays where the channel collects', () => {
    seedReservation({ id: 'res-ota', channel: 'Airbnb', checkIn: isoDaysFromNow(-1), checkOut: isoDaysFromNow(2) })
    const ids = useCityTax().dueToday.value.map(row => row.reservation.id)
    expect(ids).not.toContain('res-ota')
  })
})

describe('emitCityTaxAlerts', () => {
  it('raises a warning for a stay due now and a critical for one already gone', () => {
    seedReservation({ id: 'res-now', checkIn: isoDaysFromNow(-1), checkOut: isoDaysFromNow(2) })
    seedReservation({ id: 'res-gone', checkIn: isoDaysFromNow(-6), checkOut: isoDaysFromNow(-2) })

    useCityTax().emitCityTaxAlerts()

    const { alerts } = useNotifications()
    const due = alerts.value.find(a => a.type === 'CITY_TAX_COLLECTION_DUE' && a.context.reservation_id === 'res-now')
    const missed = alerts.value.find(a => a.type === 'CITY_TAX_COLLECTION_MISSED' && a.context.reservation_id === 'res-gone')
    expect(due?.severity).toBe('WARNING')
    expect(missed?.severity).toBe('CRITICAL')
    expect(due?.context.amount_label).toBe('24.00 EUR')
  })

  it('stays quiet about a future booking unless the tenant asked to be told', () => {
    seedReservation({ id: 'res-up', checkIn: isoDaysFromNow(5), checkOut: isoDaysFromNow(9) })
    const cityTax = useCityTax()

    cityTax.emitCityTaxAlerts()
    expect(useNotifications().alerts.value.some(a => a.type === 'CITY_TAX_COLLECTION_UPCOMING')).toBe(false)

    cityTax.notifyOnBooking.value = true
    cityTax.emitCityTaxAlerts()
    expect(useNotifications().alerts.value.some(a => a.type === 'CITY_TAX_COLLECTION_UPCOMING')).toBe(true)
  })

  it('does not raise a second alert for the same stay and stage', () => {
    seedReservation({ id: 'res-now', checkIn: isoDaysFromNow(-1), checkOut: isoDaysFromNow(2) })
    const cityTax = useCityTax()
    cityTax.emitCityTaxAlerts()
    cityTax.emitCityTaxAlerts()

    const count = useNotifications().alerts.value.filter(a => a.type === 'CITY_TAX_COLLECTION_DUE' && a.context.reservation_id === 'res-now').length
    expect(count).toBe(1)
  })

  it('clears a live alert the moment the money is in, because an alert is a prompt not a log', () => {
    seedReservation({ id: 'res-now', checkIn: isoDaysFromNow(-1), checkOut: isoDaysFromNow(2) })
    const cityTax = useCityTax()
    cityTax.emitCityTaxAlerts()
    cityTax.markCollected('res-now', { method: 'cash' })

    const stillActive = useNotifications().alerts.value.some(a =>
      a.type === 'CITY_TAX_COLLECTION_DUE' && a.context.reservation_id === 'res-now' && a.status === 'ACTIVE')
    expect(stillActive).toBe(false)
  })

  it('clears a live alert on a waive too', () => {
    seedReservation({ id: 'res-now', checkIn: isoDaysFromNow(-1), checkOut: isoDaysFromNow(2) })
    const cityTax = useCityTax()
    cityTax.emitCityTaxAlerts()
    cityTax.waive('res-now', 'Exempt')

    const stillActive = useNotifications().alerts.value.some(a =>
      a.type === 'CITY_TAX_COLLECTION_DUE' && a.context.reservation_id === 'res-now' && a.status === 'ACTIVE')
    expect(stillActive).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/composables/useCityTax.spec.ts`
Expected: FAIL, `Cannot read properties of undefined (reading 'value')` on `cityTax.overdue`

- [ ] **Step 3: Implement**

In `app/composables/useCityTax.ts`, add to the imports:

```ts
import type { AlertType } from '~/components/notifications/data/alerts'
import type { CityTaxAlertStage } from '~/components/reservations/data/city-tax'
import type { CityTaxTotal } from '~/components/reservations/data/reservations'
import { cityTaxAlertStage, cityTaxTotals, formatCityTaxTotal } from '~/components/reservations/data/city-tax'
import { useNotifications } from '~/composables/useNotifications'
```

(merge the new names into the existing `city-tax` import rather than adding a second one),
then add above `export function useCityTax()`:

```ts
export interface CityTaxWorklistRow {
  reservation: ReservationEntry
  assessment: CityTaxAssessment
  stage: CityTaxAlertStage | null
}

const CITY_TAX_ALERT_TYPE: Record<CityTaxAlertStage, AlertType> = {
  upcoming: 'CITY_TAX_COLLECTION_UPCOMING',
  due_today: 'CITY_TAX_COLLECTION_DUE',
  overdue: 'CITY_TAX_COLLECTION_MISSED',
}

const CITY_TAX_ALERT_TYPES: AlertType[] = Object.values(CITY_TAX_ALERT_TYPE)

/** Local calendar day, matching how checkIn / checkOut are written. */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
```

Inside `useCityTax()`, after `assessmentFor`, add:

```ts
  const { alerts, createCityTaxAlert } = useNotifications()
  const notifyOnBooking = useState<boolean>('city-tax-notify-on-booking', () => false)

  const rows = computed<CityTaxWorklistRow[]>(() => {
    const today = todayIso()
    return reservations.value.map((reservation) => {
      const assessment = assess(reservation)
      return { reservation, assessment, stage: cityTaxAlertStage(assessment, reservation, today) }
    })
  })

  const overdue = computed(() => rows.value.filter(row => row.stage === 'overdue'))
  const dueToday = computed(() => rows.value.filter(row => row.stage === 'due_today'))
  const upcoming = computed(() => rows.value.filter(row => row.stage === 'upcoming'))
  const settled = computed(() => rows.value.filter(row => row.assessment.settlement !== null))

  /** Per currency, never blended: this app invents no exchange rates. */
  function sumRows(source: CityTaxWorklistRow[]): CityTaxTotal[] {
    return cityTaxTotals(source.flatMap(row => row.assessment.lines))
  }

  const outstandingTotal = computed(() => sumRows([...overdue.value, ...dueToday.value]))
  // Reads the FROZEN settlement totals, never the live rules: this is what was
  // actually taken, which is the whole point of freezing them.
  const collectedTotal = computed(() => cityTaxTotals(
    settled.value
      .filter(row => row.assessment.settlement?.state === 'collected')
      .flatMap(row => row.assessment.settlement!.totals),
  ))

  function hasActiveAlert(type: AlertType, reservationId: string): boolean {
    return alerts.value.some(alert =>
      alert.type === type
      && alert.status === 'ACTIVE'
      && alert.context?.reservation_id === reservationId)
  }

  /**
   * Raises what is missing and nothing else. There is no scheduler in this app,
   * so the worklist page calls this on mount and from its "Check for alerts"
   * button, the same way Smart Lock and Minut surface their mock events.
   */
  function emitCityTaxAlerts() {
    for (const row of rows.value) {
      if (!row.stage)
        continue
      if (row.stage === 'upcoming' && !notifyOnBooking.value)
        continue

      const type = CITY_TAX_ALERT_TYPE[row.stage]
      if (hasActiveAlert(type, row.reservation.id))
        continue

      createCityTaxAlert(type as 'CITY_TAX_COLLECTION_UPCOMING' | 'CITY_TAX_COLLECTION_DUE' | 'CITY_TAX_COLLECTION_MISSED', {
        reservation_id: row.reservation.id,
        guest_name: row.reservation.guestName,
        listing_name: row.reservation.listingName,
        listing_id: row.reservation.listingId,
        amount_label: row.assessment.totals.map(formatCityTaxTotal).join(' + '),
      })
    }
  }

  /**
   * Resolves the alert directly rather than through `dismiss()`, which only
   * acts on alerts visible to the current user. Whether this user can see the
   * alert must not decide whether a settled obligation keeps nagging everyone
   * else.
   */
  function dismissAlertsFor(reservationId: string) {
    const now = new Date().toISOString()
    alerts.value = alerts.value.map(alert =>
      CITY_TAX_ALERT_TYPES.includes(alert.type)
      && alert.status === 'ACTIVE'
      && alert.context?.reservation_id === reservationId
        ? { ...alert, status: 'RESOLVED' as const, resolved_at: now }
        : alert)
  }
```

Call `dismissAlertsFor(reservation.id)` at the end of `commit()`, but only when a
settlement was written:

```ts
    updateReservation(reservation.id, {
      cityTaxSettlement: settlement,
      activity: [...reservation.activity, event],
    })

    // An alert is a prompt, not a log. Once the money is in, it leaves the bell.
    if (settlement)
      dismissAlertsFor(reservation.id)
```

Extend the returned object:

```ts
  return {
    assessmentFor,
    markCollected,
    waive,
    undoSettlement,
    rows,
    overdue,
    dueToday,
    upcoming,
    settled,
    outstandingTotal,
    collectedTotal,
    notifyOnBooking,
    emitCityTaxAlerts,
  }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/composables/useCityTax.spec.ts`
Expected: PASS, 22 tests

- [ ] **Step 5: Run the whole suite, nothing else may move**

Run: `npx vitest run`
Expected: PASS, with the pre-existing suite count plus the new files.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useCityTax.ts tests/composables/useCityTax.spec.ts
git commit -m "feat(city-tax): worklist buckets, per-currency totals, alert emission and clearing"
```

---

## Task 9: Settings, the collection rule editor

**Files:**
- Modify: `app/components/settings/FeesTaxesSettingsPanel.vue`

No spec file: this is form wiring over already-tested rules. Verify in the browser.

- [ ] **Step 1: Extend the draft factory**

In `app/components/settings/FeesTaxesSettingsPanel.vue`, add to the imports on line 4:

```ts
import { BOOKING_CHANNELS, type BookingChannel, type CityTaxCollector } from '~/components/listings/data/listings'
```

Replace `emptyFeeTaxDraft()` (line 82) with:

```ts
function emptyFeeTaxDraft(): ListingFeeTaxItem {
  return {
    id: '',
    title: '',
    type: 'tax',
    logic: 'percent',
    rate: 0,
    currency: undefined,
    isInclusive: false,
    skipNights: null,
    maxNights: null,
    applicableDateRanges: [],
    cityTax: {
      channelPolicy: {},
      chargeableGuests: { adults: true, children: false, infants: false },
    },
  }
}
```

- [ ] **Step 2: Add the helpers the form binds to**

Add below `isPercent()` (line 99):

```ts
const { notifyOnBooking } = useCityTax()

const collectorOptions: { value: CityTaxCollector, label: string }[] = [
  { value: 'host', label: 'Host collects' },
  { value: 'channel', label: 'Channel collects' },
  { value: 'not_applicable', label: 'Not applicable' },
]

function isCityTax(): boolean {
  return feeTaxDraft.value.type === 'city_tax'
}

function collectorFordraftChannel(channel: BookingChannel): CityTaxCollector {
  return feeTaxDraft.value.cityTax?.channelPolicy?.[channel] ?? 'host'
}

function setChannelCollector(channel: BookingChannel, collector: CityTaxCollector) {
  const config = feeTaxDraft.value.cityTax ?? { channelPolicy: {}, chargeableGuests: { adults: true, children: false, infants: false } }
  feeTaxDraft.value = {
    ...feeTaxDraft.value,
    cityTax: { ...config, channelPolicy: { ...config.channelPolicy, [channel]: collector } },
  }
}

function setChargeableGuest(key: 'adults' | 'children' | 'infants', value: boolean) {
  const config = feeTaxDraft.value.cityTax ?? { channelPolicy: {}, chargeableGuests: { adults: true, children: false, infants: false } }
  feeTaxDraft.value = {
    ...feeTaxDraft.value,
    cityTax: { ...config, chargeableGuests: { ...config.chargeableGuests, [key]: value } },
  }
}
```

- [ ] **Step 3: Strip the config from a non-city-tax on save**

Replace the body of `saveFeeTax()` (line 119) with:

```ts
function saveFeeTax() {
  if (!feeTaxDraft.value.title.trim())
    return
  const item: ListingFeeTaxItem = {
    ...feeTaxDraft.value,
    id: editingFeeTaxId.value || `ft-${Date.now()}`,
    title: feeTaxDraft.value.title.trim(),
    // A collection policy on a cleaning fee would be read by nothing and would
    // confuse the next person to open the record.
    cityTax: feeTaxDraft.value.type === 'city_tax' ? feeTaxDraft.value.cityTax : undefined,
  }
  upsertFeeTaxItem(item)
  showFeeTaxSheet.value = false
  toast.success(editingFeeTaxId.value ? 'Fee or tax updated' : 'Fee or tax added')
}
```

Also check the `openEditFeeTax` path around line 112: when it hydrates `feeTaxDraft` from
an existing item, default the config so an item saved before this feature still edits:

```ts
    cityTax: item.cityTax ?? { channelPolicy: {}, chargeableGuests: { adults: true, children: false, infants: false } },
```

- [ ] **Step 4: Render the block**

In the fee/tax Sheet, insert directly **after** the "Include in room price" switch
(currently ends line 686):

```vue
          <div v-if="isCityTax()" class="flex flex-col gap-3 rounded-lg border p-3">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium">City Tax Collection</span>
              <span class="text-xs text-muted-foreground">
                Who takes the money on each channel. Channels you leave unset are treated as host collects.
              </span>
            </div>

            <div v-for="channel in BOOKING_CHANNELS" :key="channel" class="flex items-center justify-between gap-3">
              <span class="text-sm">{{ channel }}</span>
              <Select
                :model-value="collectorFordraftChannel(channel)"
                @update:model-value="(v) => setChannelCollector(channel, v as CityTaxCollector)"
              >
                <SelectTrigger class="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in collectorOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium">Chargeable guests</span>
              <div
                v-for="option in [
                  { key: 'adults' as const, label: 'Adults' },
                  { key: 'children' as const, label: 'Children' },
                  { key: 'infants' as const, label: 'Infants' },
                ]"
                :key="option.key"
                class="flex items-center justify-between"
              >
                <span class="text-sm text-muted-foreground">{{ option.label }}</span>
                <Switch
                  :model-value="feeTaxDraft.cityTax?.chargeableGuests[option.key] ?? false"
                  @update:model-value="(v) => setChargeableGuest(option.key, Boolean(v))"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Levied by</Label>
              <Input
                :model-value="feeTaxDraft.cityTax?.authorityName ?? ''"
                placeholder="e.g., Stadt Berlin"
                @update:model-value="(v) => feeTaxDraft = { ...feeTaxDraft, cityTax: { ...feeTaxDraft.cityTax!, authorityName: String(v) } }"
              />
              <span class="text-xs text-muted-foreground">Shown to staff at the desk so they can answer "what is this charge".</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Note for staff</Label>
              <Textarea
                :model-value="feeTaxDraft.cityTax?.note ?? ''"
                placeholder="e.g., Cash at the desk, receipt book behind reception."
                rows="2"
                @update:model-value="(v) => feeTaxDraft = { ...feeTaxDraft, cityTax: { ...feeTaxDraft.cityTax!, note: String(v) } }"
              />
            </div>
          </div>
```

⚠️ `Switch` binds `model-value` / `@update:model-value`. `:checked` does nothing in reka-ui.

- [ ] **Step 5: Add the notify switch at the top of the page**

Find the page header block above the `<Tabs>` and add:

```vue
      <div class="flex items-center justify-between rounded-lg border p-3">
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-medium">Notify when a collection is booked</span>
          <span class="text-xs text-muted-foreground">
            Off by default. Alerts for a collection due today and one that was missed are always on.
          </span>
        </div>
        <Switch :model-value="notifyOnBooking" @update:model-value="(v) => notifyOnBooking = Boolean(v)" />
      </div>
```

- [ ] **Step 6: Correct the now-wrong sheet description**

The sheet currently says "Applied to direct bookings only. OTAs manage their own charges."
That is exactly the assumption this feature replaces. Change `SheetDescription` to:

```vue
          <SheetDescription>Fees and taxes for direct bookings. A city tax can also name which channels collect it.</SheetDescription>
```

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`, open `/settings/fees-taxes`, add a fee/tax, switch Type to **City Tax**.
Expected: the collection block appears, each channel select saves, switching Type away to
Fee hides it, and reopening the saved city tax shows the policy you set.

- [ ] **Step 8: Commit**

```bash
git add app/components/settings/FeesTaxesSettingsPanel.vue
git commit -m "feat(city-tax): per-channel collection policy in the fees and taxes editor"
```

---

## Task 10: The reservation section

**Files:**
- Create: `app/components/reservations/CityTaxCollectDialog.vue`
- Create: `app/components/reservations/CityTaxWaiveDialog.vue`
- Create: `app/components/reservations/ReservationCityTaxSection.vue`
- Modify: `app/components/reservations/ReservationDetailSheet.vue`
- Test: `tests/components/reservations/ReservationCityTax.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/reservations/ReservationCityTax.spec.ts`:

```ts
import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import ReservationCityTaxSection from '~/components/reservations/ReservationCityTaxSection.vue'
import { useFeesTaxes } from '~/composables/useFeesTaxes'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'

const CITY_TAX: ListingFeeTaxItem = {
  id: 'ft-kurtaxe',
  title: 'Kurtaxe',
  type: 'city_tax',
  logic: 'per_person_per_night',
  rate: 3,
  currency: 'EUR',
  isInclusive: false,
  skipNights: null,
  maxNights: null,
  applicableDateRanges: [],
  cityTax: {
    channelPolicy: { 'Direct': 'host', 'Airbnb': 'channel' },
    chargeableGuests: { adults: true, children: false, infants: false },
    authorityName: 'Stadt Berlin',
  },
}

function reservation(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    id: 'res-ct-1',
    guestId: 'guest-ct-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestPhone: '+49 170 1234567',
    guestLanguage: 'de',
    guestNotes: '',
    listingId: 'lst-1',
    listingName: 'Villa Merapi',
    channel: 'Direct',
    checkIn: '2026-07-10',
    checkOut: '2026-07-14',
    nights: 4,
    guestCount: 2,
    guestAdults: 2,
    guestChildren: 0,
    guestInfants: 0,
    totalPrice: 1000,
    currency: 'EUR',
    status: 'verified',
    activity: [],
    ...patch,
  } as ReservationEntry
}

function mountSection(entry: ReservationEntry) {
  const { reservations } = useReservationsModule()
  reservations.value = [entry, ...reservations.value.filter(r => r.id !== entry.id)]
  return mount(ReservationCityTaxSection, {
    props: { reservation: entry },
    global: {
      // Nuxt auto-imports these. Without registering them they render as
      // unresolved stubs and every text assertion passes vacuously.
      components: { Badge, Button },
      stubs: {
        Icon: true,
        Accordion: { template: '<div><slot /></div>' },
        AccordionItem: { template: '<div><slot /></div>' },
        AccordionTrigger: { template: '<button><slot /></button>' },
        AccordionContent: { template: '<div><slot /></div>' },
        Separator: true,
        CityTaxCollectDialog: true,
        CityTaxWaiveDialog: true,
      },
    },
  })
}

beforeEach(() => {
  const fees = useFeesTaxes()
  fees.feeTaxItems.value = [structuredClone(CITY_TAX)]
  fees.taxSets.value = []
  fees.assignments.value = { 'lst-1': { feeTaxIds: ['ft-kurtaxe'], taxSetIds: [] } }
  useReservationsModule().reset()
})

describe('ReservationCityTaxSection', () => {
  it('renders nothing when no city tax applies', () => {
    useFeesTaxes().assignments.value = {}
    const wrapper = mountSection(reservation())
    expect(wrapper.find('[data-testid="city-tax-section"]').exists()).toBe(false)
  })

  it('shows the amount and the arithmetic when the host must collect', () => {
    const wrapper = mountSection(reservation())
    const text = wrapper.text()
    expect(text).toContain('24.00 EUR')
    expect(text).toContain('Kurtaxe')
    expect(text).toContain('2 guests')
    expect(text).toContain('4 nights')
    expect(text).toContain('Stadt Berlin')
  })

  it('offers collect and waive while it is due', () => {
    const wrapper = mountSection(reservation())
    expect(wrapper.find('[data-testid="city-tax-collect"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="city-tax-waive"]').exists()).toBe(true)
  })

  it('explains a channel-collected tax and offers no action, because there is none', () => {
    const wrapper = mountSection(reservation({ channel: 'Airbnb' }))
    expect(wrapper.text()).toContain('collects and remits')
    expect(wrapper.find('[data-testid="city-tax-collect"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="city-tax-waive"]').exists()).toBe(false)
  })

  it('shows the frozen settlement and an undo once collected', () => {
    const wrapper = mountSection(reservation({
      cityTaxSettlement: {
        state: 'collected',
        totals: [{ currency: 'EUR', amount: 18 }],
        settledAt: '2026-07-10T09:00:00.000Z',
        settledBy: 'Komang Juliantara',
        method: 'cash',
      },
    }))
    const text = wrapper.text()
    expect(text).toContain('18.00 EUR')
    expect(text).toContain('Komang Juliantara')
    expect(text).toContain('Cash')
    expect(wrapper.find('[data-testid="city-tax-undo"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="city-tax-collect"]').exists()).toBe(false)
  })

  it('shows the reason on a waived stay', () => {
    const wrapper = mountSection(reservation({
      cityTaxSettlement: {
        state: 'waived',
        totals: [{ currency: 'EUR', amount: 24 }],
        settledAt: '2026-07-10T09:00:00.000Z',
        settledBy: 'Komang Juliantara',
        reason: 'Business traveller',
      },
    }))
    expect(wrapper.text()).toContain('Business traveller')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/components/reservations/ReservationCityTax.spec.ts`
Expected: FAIL, cannot resolve `ReservationCityTaxSection.vue`

- [ ] **Step 3: Write the collect dialog**

Create `app/components/reservations/CityTaxCollectDialog.vue`:

```vue
<script setup lang="ts">
import type { CityTaxPaymentMethod } from '~/components/reservations/data/reservations'
import { CITY_TAX_METHOD_LABELS } from '~/components/reservations/data/city-tax'

const props = defineProps<{
  amountLabel: string
}>()

const emit = defineEmits<{
  confirm: [payload: { method: CityTaxPaymentMethod, note?: string }]
}>()

const open = defineModel<boolean>('open', { required: true })

const method = ref<CityTaxPaymentMethod>('cash')
const note = ref('')

const methods = Object.entries(CITY_TAX_METHOD_LABELS) as [CityTaxPaymentMethod, string][]

watch(open, (isOpen) => {
  if (isOpen) {
    method.value = 'cash'
    note.value = ''
  }
})

function confirm() {
  emit('confirm', { method: method.value, note: note.value.trim() || undefined })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Collect city tax</DialogTitle>
        <DialogDescription>Recording {{ props.amountLabel }} as taken from the guest.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <Label>Method</Label>
          <Select :model-value="method" @update:model-value="(v) => method = v as CityTaxPaymentMethod">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="[value, label] in methods" :key="value" :value="value">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Note</Label>
          <Textarea v-model="note" placeholder="Optional" rows="2" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button data-testid="city-tax-collect-confirm" @click="confirm">
          Mark collected
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 4: Write the waive dialog**

Create `app/components/reservations/CityTaxWaiveDialog.vue`:

```vue
<script setup lang="ts">
const emit = defineEmits<{
  confirm: [reason: string]
}>()

const open = defineModel<boolean>('open', { required: true })

const reason = ref('')
const touched = ref(false)

const invalid = computed(() => touched.value && reason.value.trim().length === 0)

watch(open, (isOpen) => {
  if (isOpen) {
    reason.value = ''
    touched.value = false
  }
})

function confirm() {
  touched.value = true
  if (reason.value.trim().length === 0)
    return
  emit('confirm', reason.value.trim())
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Waive city tax</DialogTitle>
        <DialogDescription>
          The stay still owes nothing after this. Say why, so the next person reading the booking knows.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-1.5">
        <Label>Reason</Label>
        <Textarea v-model="reason" placeholder="e.g., Business traveller, exempt under local rule" rows="3" />
        <p v-if="invalid" class="text-xs text-destructive">
          A waive needs a reason.
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button variant="destructive" data-testid="city-tax-waive-confirm" @click="confirm">
          Waive
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
```

- [ ] **Step 5: Write the section**

Create `app/components/reservations/ReservationCityTaxSection.vue`:

```vue
<script setup lang="ts">
import type { CityTaxBasisLine } from '~/components/reservations/data/city-tax'
import type { CityTaxPaymentMethod, ReservationEntry } from '~/components/reservations/data/reservations'
import {
  CITY_TAX_METHOD_LABELS,
  formatCityTaxTotals,
} from '~/components/reservations/data/city-tax'
import CityTaxCollectDialog from '~/components/reservations/CityTaxCollectDialog.vue'
import CityTaxWaiveDialog from '~/components/reservations/CityTaxWaiveDialog.vue'
import { useCityTax } from '~/composables/useCityTax'

const props = defineProps<{
  reservation: ReservationEntry
}>()

const cityTax = useCityTax()

const collectOpen = ref(false)
const waiveOpen = ref(false)

const assessment = computed(() => cityTax.assessmentFor(props.reservation.id))
const amountLabel = computed(() => formatCityTaxTotals(assessment.value.totals))
const settlementLabel = computed(() =>
  assessment.value.settlement ? formatCityTaxTotals(assessment.value.settlement.totals) : '')

const statusMeta = computed(() => {
  switch (assessment.value.status) {
    case 'due':
      return { label: 'Due', class: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' }
    case 'collected':
      return { label: 'Collected', class: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' }
    case 'waived':
      return { label: 'Waived', class: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
    default:
      return { label: 'Channel collects', class: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
  }
})

/** "2 guests × 4 nights × 3.00 EUR = 24.00 EUR", the working staff get asked for. */
function basisLabel(line: CityTaxBasisLine): string {
  const rate = `${line.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${line.currency}`
  const total = `${line.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${line.currency}`
  const factors: string[] = []
  if (line.logic === 'per_person' || line.logic === 'per_person_per_night')
    factors.push(`${line.chargeableGuests} guests`)
  if (line.logic === 'per_room' || line.logic === 'per_room_per_night')
    factors.push(`${line.rooms} rooms`)
  if (line.logic === 'per_night' || line.logic === 'per_person_per_night' || line.logic === 'per_room_per_night')
    factors.push(`${line.chargeableNights} nights`)
  if (line.logic === 'percent')
    return `${line.rate}% of the accommodation subtotal = ${total}`
  factors.push(rate)
  return `${factors.join(' × ')} = ${total}`
}

function methodLabel(method?: CityTaxPaymentMethod): string {
  return method ? CITY_TAX_METHOD_LABELS[method] : ''
}

function settledOn(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function collect(payload: { method: CityTaxPaymentMethod, note?: string }) {
  cityTax.markCollected(props.reservation.id, payload)
}

function waive(reason: string) {
  cityTax.waive(props.reservation.id, reason)
}
</script>

<template>
  <!-- Nothing to say when this property levies no city tax on this channel. -->
  <Accordion
    v-if="assessment.status !== 'not_required'"
    data-testid="city-tax-section"
    type="single"
    collapsible
    class="w-full border-b px-2"
  >
    <AccordionItem value="city-tax" class="border-b-0">
      <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
        <span class="flex flex-1 items-center gap-2">
          <Icon name="lucide:landmark" class="size-4" />
          City tax
          <Badge variant="outline" :class="statusMeta.class">{{ statusMeta.label }}</Badge>
        </span>
      </AccordionTrigger>

      <AccordionContent class="px-3 pb-4">
        <!-- The OTA already took it. There is no action, so offer none. -->
        <p v-if="assessment.status === 'channel_collects'" class="text-sm text-muted-foreground">
          {{ props.reservation.channel }} collects and remits this tax. Nothing to collect at the property.
        </p>

        <div v-else-if="assessment.status === 'due'" class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-2xl font-semibold tabular-nums">{{ amountLabel }}</span>
            <span class="text-xs text-muted-foreground">Collect from the guest</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <div v-for="line in assessment.lines" :key="line.taxItemId" class="rounded-md border bg-muted/40 px-3 py-2">
              <div class="flex items-center justify-between gap-2 text-sm">
                <span class="font-medium">{{ line.taxTitle }}</span>
                <span v-if="line.authorityName" class="text-xs text-muted-foreground">{{ line.authorityName }}</span>
              </div>
              <p class="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {{ basisLabel(line) }}
              </p>
              <p v-if="line.note" class="mt-1 text-xs text-muted-foreground">
                {{ line.note }}
              </p>
            </div>
          </div>

          <div class="flex gap-2">
            <Button size="sm" data-testid="city-tax-collect" @click="collectOpen = true">
              Mark collected
            </Button>
            <Button size="sm" variant="outline" data-testid="city-tax-waive" @click="waiveOpen = true">
              Waive
            </Button>
          </div>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-xl font-semibold tabular-nums">{{ settlementLabel }}</span>
            <span class="text-xs text-muted-foreground">
              {{ assessment.status === 'collected' ? 'Collected' : 'Waived' }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ assessment.settlement?.settledBy }} · {{ settledOn(assessment.settlement!.settledAt) }}
            <template v-if="assessment.settlement?.method"> · {{ methodLabel(assessment.settlement.method) }}</template>
          </p>
          <p v-if="assessment.settlement?.reason" class="text-xs text-muted-foreground">
            Reason: {{ assessment.settlement.reason }}
          </p>
          <p v-if="assessment.settlement?.note" class="text-xs text-muted-foreground">
            {{ assessment.settlement.note }}
          </p>
          <div>
            <Button size="sm" variant="ghost" data-testid="city-tax-undo" @click="cityTax.undoSettlement(props.reservation.id)">
              Undo
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>

    <CityTaxCollectDialog v-model:open="collectOpen" :amount-label="amountLabel" @confirm="collect" />
    <CityTaxWaiveDialog v-model:open="waiveOpen" @confirm="waive" />
  </Accordion>
</template>
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/components/reservations/ReservationCityTax.spec.ts`
Expected: PASS, 6 tests

- [ ] **Step 7: Mount it in the detail sheet**

In `app/components/reservations/ReservationDetailSheet.vue`, add to the imports next to
the existing `ReservationFolioSection` import (line 9):

```ts
import ReservationCityTaxSection from '~/components/reservations/ReservationCityTaxSection.vue'
```

Then directly **after** `<ReservationFolioSection :reservation="reservation" />` (line 564):

```vue
            <!-- City tax: what the municipality is owed on this stay -->
            <ReservationCityTaxSection :reservation="reservation" />
```

It goes after the folio so the desk reads one money story top to bottom: the booked price,
then the extras, then the levy.

- [ ] **Step 8: Verify in the browser**

Run: `npm run dev`, open `/reservations`, click a Direct booking on a listing that has the
seeded city tax (Task 13 seeds one on `lst-1`).
Expected: the City tax section shows Due with the arithmetic, Mark collected records it,
and the timeline gains a "City tax collected" entry.

- [ ] **Step 9: Commit**

```bash
git add app/components/reservations/CityTaxCollectDialog.vue app/components/reservations/CityTaxWaiveDialog.vue app/components/reservations/ReservationCityTaxSection.vue app/components/reservations/ReservationDetailSheet.vue tests/components/reservations/ReservationCityTax.spec.ts
git commit -m "feat(city-tax): reservation section with the arithmetic, collect and waive"
```

---

## Task 11: The status chip in the reservations table

**Files:**
- Create: `app/components/city-tax/CityTaxStatusChip.vue`
- Modify: `app/components/reservations/ReservationTable.vue:209`
- Test: `tests/components/reservations/ReservationCityTax.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/components/reservations/ReservationCityTax.spec.ts`, adding
`import CityTaxStatusChip from '~/components/city-tax/CityTaxStatusChip.vue'`:

```ts
describe('CityTaxStatusChip', () => {
  function mountChip(status: string, stage: string | null = null) {
    return mount(CityTaxStatusChip, {
      props: { status: status as never, stage: stage as never },
      global: { components: { Badge }, stubs: { Icon: true } },
    })
  }

  it('renders nothing when no city tax applies, so the column stays quiet', () => {
    expect(mountChip('not_required').text()).toBe('')
  })

  it('says the channel handles it', () => {
    expect(mountChip('channel_collects').text()).toContain('Channel')
  })

  it('says due while it is still collectable', () => {
    expect(mountChip('due', 'due_today').text()).toContain('Tax due')
  })

  it('says missed once the guest has gone', () => {
    expect(mountChip('due', 'overdue').text()).toContain('Tax missed')
  })

  it('says collected once settled', () => {
    expect(mountChip('collected').text()).toContain('Collected')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/components/reservations/ReservationCityTax.spec.ts`
Expected: FAIL, cannot resolve `CityTaxStatusChip.vue`

- [ ] **Step 3: Write the chip**

Create `app/components/city-tax/CityTaxStatusChip.vue`:

```vue
<script setup lang="ts">
import type { CityTaxAlertStage, CityTaxStatus } from '~/components/reservations/data/city-tax'

const props = defineProps<{
  status: CityTaxStatus
  stage?: CityTaxAlertStage | null
}>()

const meta = computed(() => {
  if (props.status === 'due') {
    return props.stage === 'overdue'
      ? { label: 'Tax missed', class: 'border-destructive/30 bg-destructive/10 text-destructive' }
      : { label: 'Tax due', class: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' }
  }
  if (props.status === 'collected')
    return { label: 'Collected', class: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' }
  if (props.status === 'waived')
    return { label: 'Waived', class: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
  if (props.status === 'channel_collects')
    return { label: 'Channel', class: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
  // not_required: a property that levies nothing should add nothing to the row.
  return null
})
</script>

<template>
  <Badge v-if="meta" variant="outline" :class="meta.class">
    {{ meta.label }}
  </Badge>
</template>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/components/reservations/ReservationCityTax.spec.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Use it in the table**

In `app/components/reservations/ReservationTable.vue`, add to the imports:

```ts
import CityTaxStatusChip from '~/components/city-tax/CityTaxStatusChip.vue'
import { useCityTax } from '~/composables/useCityTax'
```

In `<script setup>`, add:

```ts
const cityTax = useCityTax()

function cityTaxRow(reservationId: string) {
  return cityTax.rows.value.find(row => row.reservation.id === reservationId) ?? null
}
```

Replace the status cell (line 209) with:

```vue
            <td class="px-4 py-3">
              <div class="flex flex-wrap items-center gap-1.5">
                <ReservationStatusBadge :status="r.status" />
                <CityTaxStatusChip
                  v-if="cityTaxRow(r.id)"
                  :status="cityTaxRow(r.id)!.assessment.status"
                  :stage="cityTaxRow(r.id)!.stage"
                />
              </div>
            </td>
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`, open `/reservations`.
Expected: Direct bookings on the seeded listing carry an amber "Tax due" next to the status
badge, past ones carry a red "Tax missed", and Airbnb rows carry a grey "Channel".

- [ ] **Step 7: Commit**

```bash
git add app/components/city-tax/CityTaxStatusChip.vue app/components/reservations/ReservationTable.vue tests/components/reservations/ReservationCityTax.spec.ts
git commit -m "feat(city-tax): status chip on the reservations table"
```

---

## Task 12: The worklist page

**Files:**
- Create: `app/components/city-tax/CityTaxTable.vue`
- Create: `app/pages/city-tax/index.vue`
- Modify: `app/constants/menus.ts`

No spec file: the buckets and totals are already covered by
`tests/composables/useCityTax.spec.ts`, and this is presentation over them.

- [ ] **Step 1: Write the table**

Create `app/components/city-tax/CityTaxTable.vue`:

```vue
<script setup lang="ts">
import type { CityTaxWorklistRow } from '~/composables/useCityTax'
import CityTaxStatusChip from '~/components/city-tax/CityTaxStatusChip.vue'
import { formatCityTaxTotals } from '~/components/reservations/data/city-tax'

const props = defineProps<{
  rows: CityTaxWorklistRow[]
  selectable: boolean
  selected: string[]
  emptyLabel: string
}>()

const emit = defineEmits<{
  'openDetail': [row: CityTaxWorklistRow]
  'update:selected': [ids: string[]]
}>()

// reka-ui CheckboxRoot ignores external :checked changes after first render.
// Bumping this key on a clear forces a re-mount, the same pattern the finance
// tables use.
const clearKey = ref(0)

const allSelected = computed(() =>
  props.rows.length > 0 && props.rows.every(row => props.selected.includes(row.reservation.id)))

function toggleRow(id: string) {
  emit('update:selected', props.selected.includes(id)
    ? props.selected.filter(selectedId => selectedId !== id)
    : [...props.selected, id])
}

function toggleAll() {
  if (allSelected.value) {
    emit('update:selected', [])
    clearKey.value++
    return
  }
  emit('update:selected', props.rows.map(row => row.reservation.id))
}

function amount(row: CityTaxWorklistRow): string {
  return row.assessment.settlement
    ? formatCityTaxTotals(row.assessment.settlement.totals)
    : formatCityTaxTotals(row.assessment.totals)
}

function basisSummary(row: CityTaxWorklistRow): string {
  return row.assessment.lines.map(line => line.taxTitle).join(', ') || 'City tax'
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead v-if="props.selectable" class="w-10">
            <Checkbox :key="`all-${clearKey}`" :model-value="allSelected" @update:model-value="toggleAll" />
          </TableHead>
          <TableHead>Guest</TableHead>
          <TableHead>Property</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Check-in</TableHead>
          <TableHead>Check-out</TableHead>
          <TableHead>Tax</TableHead>
          <TableHead class="text-right">
            Amount
          </TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="props.rows.length === 0">
          <TableCell :colspan="props.selectable ? 9 : 8" class="py-10 text-center text-sm text-muted-foreground">
            {{ props.emptyLabel }}
          </TableCell>
        </TableRow>

        <TableRow
          v-for="row in props.rows"
          :key="row.reservation.id"
          class="cursor-pointer"
          @click="emit('openDetail', row)"
        >
          <TableCell v-if="props.selectable" @click.stop>
            <Checkbox
              :key="`${row.reservation.id}-${clearKey}`"
              :model-value="props.selected.includes(row.reservation.id)"
              @update:model-value="toggleRow(row.reservation.id)"
            />
          </TableCell>
          <TableCell class="font-medium">
            {{ row.reservation.guestName }}
          </TableCell>
          <TableCell>{{ row.reservation.listingName }}</TableCell>
          <TableCell>{{ row.reservation.channel }}</TableCell>
          <TableCell>{{ row.reservation.checkIn }}</TableCell>
          <TableCell>{{ row.reservation.checkOut }}</TableCell>
          <TableCell class="text-muted-foreground">
            {{ basisSummary(row) }}
          </TableCell>
          <TableCell class="text-right tabular-nums">
            {{ amount(row) }}
          </TableCell>
          <TableCell>
            <CityTaxStatusChip :status="row.assessment.status" :stage="row.stage" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
```

- [ ] **Step 2: Write the page**

Create `app/pages/city-tax/index.vue`:

```vue
<script setup lang="ts">
import type { CityTaxWorklistRow } from '~/composables/useCityTax'
import type { CityTaxPaymentMethod, ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import CityTaxTable from '~/components/city-tax/CityTaxTable.vue'
import CityTaxCollectDialog from '~/components/reservations/CityTaxCollectDialog.vue'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import { formatCityTaxTotals } from '~/components/reservations/data/city-tax'
import { useCityTax } from '~/composables/useCityTax'

const cityTax = useCityTax()

// There is no scheduler in this app, so catch up on mount, the same way the
// guest registration page calls checkOverdueRegistrations().
onMounted(() => cityTax.emitCityTaxAlerts())

const tab = ref<'overdue' | 'due_today' | 'upcoming' | 'settled'>('due_today')
const search = ref('')
const channelFilter = ref<'all' | 'Airbnb' | 'Booking.com' | 'Direct'>('all')
const listingFilter = ref<string>('all')
const selected = ref<string[]>([])
const bulkOpen = ref(false)
const detailTarget = ref<ReservationEntry | null>(null)

const detailOpen = computed({
  get: () => detailTarget.value !== null,
  set: (value: boolean) => {
    if (!value)
      detailTarget.value = null
  },
})

const bucket = computed<CityTaxWorklistRow[]>(() => {
  switch (tab.value) {
    case 'overdue': return cityTax.overdue.value
    case 'due_today': return cityTax.dueToday.value
    case 'upcoming': return cityTax.upcoming.value
    default: return cityTax.settled.value
  }
})

const listingOptions = computed(() => {
  const names = new Set(cityTax.rows.value.map(row => row.reservation.listingName))
  return ['all', ...[...names].sort()]
})

const visibleRows = computed(() => bucket.value.filter((row) => {
  const term = search.value.trim().toLowerCase()
  const matchesSearch = term.length === 0 || row.reservation.guestName.toLowerCase().includes(term)
  const matchesChannel = channelFilter.value === 'all' || row.reservation.channel === channelFilter.value
  const matchesListing = listingFilter.value === 'all' || row.reservation.listingName === listingFilter.value
  return matchesSearch && matchesChannel && matchesListing
}))

const selectedRows = computed(() => visibleRows.value.filter(row => selected.value.includes(row.reservation.id)))
const bulkAmountLabel = computed(() =>
  formatCityTaxTotals(selectedRows.value.flatMap(row => row.assessment.totals)))

watch(tab, () => {
  selected.value = []
})

function openDetail(row: CityTaxWorklistRow) {
  detailTarget.value = row.reservation
}

function bulkCollect(payload: { method: CityTaxPaymentMethod, note?: string }) {
  const count = selectedRows.value.length
  for (const row of selectedRows.value)
    cityTax.markCollected(row.reservation.id, payload)
  selected.value = []
  toast.success(`Marked ${count} stays collected`)
}

function checkForAlerts() {
  cityTax.emitCityTaxAlerts()
  toast.info('Checked every stay for an outstanding city tax')
}
</script>

<template>
  <div class="flex flex-col gap-4 p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-bold tracking-tight">
          City Tax
        </h2>
        <p class="text-sm text-muted-foreground">
          Every stay where the tourist levy is yours to collect, not the channel's.
        </p>
      </div>
      <Button variant="outline" @click="checkForAlerts">
        <Icon name="lucide:bell-ring" class="mr-2 size-4" />
        Check for alerts
      </Button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">
            Overdue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-bold text-destructive tabular-nums">
            {{ cityTax.overdue.value.length }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">
            Due today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-bold tabular-nums">
            {{ cityTax.dueToday.value.length }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">
            Outstanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <!-- One line per currency. Nothing here is converted. -->
          <p class="text-lg font-bold tabular-nums">
            {{ formatCityTaxTotals(cityTax.outstandingTotal.value) }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">
            Collected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-lg font-bold tabular-nums">
            {{ formatCityTaxTotals(cityTax.collectedTotal.value) }}
          </p>
        </CardContent>
      </Card>
    </div>

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger value="overdue">
          Overdue ({{ cityTax.overdue.value.length }})
        </TabsTrigger>
        <TabsTrigger value="due_today">
          Due today ({{ cityTax.dueToday.value.length }})
        </TabsTrigger>
        <TabsTrigger value="upcoming">
          Upcoming ({{ cityTax.upcoming.value.length }})
        </TabsTrigger>
        <TabsTrigger value="settled">
          Settled ({{ cityTax.settled.value.length }})
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="flex flex-wrap items-center gap-2">
      <Input v-model="search" placeholder="Search guest" class="h-9 w-56" />
      <Select v-model="channelFilter">
        <SelectTrigger class="h-9 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All channels
          </SelectItem>
          <SelectItem value="Airbnb">
            Airbnb
          </SelectItem>
          <SelectItem value="Booking.com">
            Booking.com
          </SelectItem>
          <SelectItem value="Direct">
            Direct
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="listingFilter">
        <SelectTrigger class="h-9 w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in listingOptions" :key="option" :value="option">
            {{ option === 'all' ? 'All properties' : option }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="selected.length > 0" class="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <span class="text-sm">{{ selected.length }} selected · {{ bulkAmountLabel }}</span>
      <Button size="sm" variant="ghost" @click="selected = []">
        Clear
      </Button>
      <Button size="sm" @click="bulkOpen = true">
        Mark collected
      </Button>
    </div>

    <CityTaxTable
      :rows="visibleRows"
      :selectable="tab !== 'settled'"
      :selected="selected"
      :empty-label="tab === 'settled' ? 'Nothing settled yet.' : 'Nothing outstanding here.'"
      @open-detail="openDetail"
      @update:selected="(ids) => selected = ids"
    />

    <CityTaxCollectDialog v-model:open="bulkOpen" :amount-label="bulkAmountLabel" @confirm="bulkCollect" />
    <ReservationDetailSheet v-model:open="detailOpen" :reservation="detailTarget" />
  </div>
</template>
```

> **Deviation from the spec, on purpose:** the spec listed four KPI counts including
> "Upcoming (7 days)". The tab labels already carry every bucket count, so the fourth tile
> is an outstanding **money** total per currency instead. A second count would have
> repeated a tab label; the money is the number a GM actually asks for.

- [ ] **Step 3: Add the sidebar entry**

In `app/constants/menus.ts`, directly after the `Guest Registration` entry (line 69-74):

```ts
      {
        title: 'City Tax',
        icon: 'i-lucide-landmark',
        link: '/city-tax',
        new: true,
      },
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open `/city-tax`.
Expected: the KPI row shows counts and a per-currency outstanding total, the tabs switch
buckets, filters narrow the table, selecting rows reveals the bulk bar, "Mark collected"
settles them all and they move to Settled, and the bell gains a city tax alert.

- [ ] **Step 5: Commit**

```bash
git add app/components/city-tax/CityTaxTable.vue app/pages/city-tax/index.vue app/constants/menus.ts
git commit -m "feat(city-tax): worklist page with buckets, filters and bulk collect"
```

---

## Task 13: Seed the demo so the feature is visible

Without this, every mock listing resolves to `not_required` and the whole feature is
invisible in the demo. The existing seed in `useFeesTaxes` has one `city_tax` item,
`ft-2` "Local Tax", with no policy and no assignment beyond `lst-1`.

**Files:**
- Modify: `app/composables/useFeesTaxes.ts:20-50`

- [ ] **Step 1: Give the existing city tax a policy**

In `app/composables/useFeesTaxes.ts`, replace the `ft-2` entry in `seedFeeTaxItems` with:

```ts
  {
    id: 'ft-2',
    title: 'Local Tax',
    type: 'city_tax',
    logic: 'percent',
    rate: 10,
    isInclusive: true,
    skipNights: null,
    maxNights: null,
    applicableDateRanges: [],
    cityTax: {
      // Airbnb collects and remits in this jurisdiction; the other two do not,
      // which is the split the whole feature exists to make visible.
      channelPolicy: { 'Airbnb': 'channel', 'Booking.com': 'host', 'Direct': 'host' },
      chargeableGuests: { adults: true, children: false, infants: false },
      authorityName: 'Badung Regency',
    },
  },
```

- [ ] **Step 2: Add a per-person city tax and assign both more widely**

Append to `seedFeeTaxItems`:

```ts
  {
    id: 'ft-3',
    title: 'Kurtaxe',
    type: 'city_tax',
    logic: 'per_person_per_night',
    rate: 3,
    currency: 'EUR',
    isInclusive: false,
    skipNights: null,
    maxNights: 21,
    applicableDateRanges: [],
    cityTax: {
      // Nobody collects this for the host, which is the common European case.
      channelPolicy: { 'Airbnb': 'host', 'Booking.com': 'host', 'Direct': 'host' },
      chargeableGuests: { adults: true, children: false, infants: false },
      authorityName: 'Kurverwaltung',
      note: 'Cash at the desk, receipt book behind reception.',
    },
  },
```

Replace `seedAssignments` with:

```ts
const seedAssignments: Record<string, ListingFeeTaxAssignment> = {
  'lst-1': { feeTaxIds: ['ft-1', 'ft-2'], taxSetIds: ['ts-1'] },
  'lst-2': { feeTaxIds: ['ft-2'], taxSetIds: [] },
  'lst-3': { feeTaxIds: ['ft-3'], taxSetIds: [] },
  'lst-4': { feeTaxIds: ['ft-3'], taxSetIds: [] },
}
```

- [ ] **Step 3: Confirm the seed actually produces work**

Run: `npx vitest run`
Expected: PASS. The specs reset these refs in `beforeEach`, so a seed change cannot move
a test result. If something fails, a spec is leaning on the seed and should be fixed to
set its own fixture instead.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open `/city-tax`.
Expected: non-empty buckets across `lst-1` to `lst-4`, Airbnb stays on `lst-1` and `lst-2`
showing "Channel", and a mix of EUR and the listing currency in the outstanding total,
listed separately.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useFeesTaxes.ts
git commit -m "feat(city-tax): seed two city taxes with contrasting channel policies"
```

---

## Task 14: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the module section**

In `CLAUDE.md`, after the "Reservation Folio Items" section, add:

````markdown
### City Tax Collection (`app/components/reservations/data/city-tax.ts` + `app/composables/useCityTax.ts`)

Who collects the tourist levy on a given stay, and making sure the host's share is never
missed. The rate already lived on `ListingFeeTaxItem`; what was missing was the collector.

- **The policy lives on the city tax item**, as `ListingFeeTaxItem.cityTax?: CityTaxConfig`,
  so one municipal tax is configured once and distributed by the existing listing
  assignment in `useFeesTaxes`.
- ⚠️ **An unset channel falls back to `'host'`, never `'not_applicable'`.** The feature
  exists to stop a collection going missing, so an unconfigured channel must over-alert.
- ⚠️ **Status is derived, only the settlement is stored.** `ReservationEntry` carries
  `cityTaxSettlement?: CityTaxSettlement` and nothing else. `resolveCityTax()` recomputes
  `not_required` / `channel_collects` / `due` on every read, so flipping a channel policy
  re-evaluates every existing booking instead of leaving a stale flag behind.
- ⚠️ **The settlement freezes `CityTaxTotal[]`**, so a later rate change cannot rewrite
  what a guest actually paid. Same snapshot rule as a folio catalog pick.
- ⚠️ **City tax never goes through the folio and never touches `priceDetails`.**
  `useReservationFolio.commit()` moves `extras`, `guestPaid` and `payout` in lockstep, so
  posting a municipal levy there would inflate every owner payout by the tax. It is money
  held for a city, not owner revenue.
- ⚠️ **No currency conversion.** `CityTaxAssessment` has `totals: CityTaxTotal[]`, one per
  currency, and deliberately **no single `amount` field**, so two currencies can never be
  blended. `cityTaxTotals()` is structural and sums both live basis lines and frozen
  settlement totals.
- **`percent` is charged on `priceDetails.subtotal`**, never the grand total: a levy is not
  charged on the cleaning fee. `skipNights` / `maxNights` only bite on a night-multiplying
  logic; a flat `per_booking` charge ignores them.

**Alerts:** `CITY_TAX_COLLECTION_UPCOMING` (INFO, **off by default** behind the
`notifyOnBooking` switch on `/settings/fees-taxes`), `CITY_TAX_COLLECTION_DUE` (WARNING,
arrival day through the stay) and `CITY_TAX_COLLECTION_MISSED` (CRITICAL, after check-out).
⚠️ All three must stay listed in `FINANCE_TYPES` in `notification-settings.ts`: roles build
`enabledAlertTypes` from those categories, and `isAlertVisibleToUser` drops anything
missing, so an uncategorised type is invisible in the bell. Settling resolves any live
alert directly rather than through `dismiss()`, because whether the current user can see
an alert must not decide whether a settled obligation keeps nagging everybody else.

**Surfaces:** the collection block in `FeesTaxesSettingsPanel.vue` (city tax type only),
`ReservationCityTaxSection.vue` in the detail sheet right after the folio,
`CityTaxStatusChip.vue` in `ReservationTable.vue`, and the `/city-tax` worklist
(Overdue / Due today / Upcoming / Settled, per-currency KPIs, bulk collect).

**Tests:** `tests/lib/city-tax.spec.ts` (56), `tests/composables/useCityTax.spec.ts` (22),
`tests/composables/useCityTaxAlerts.spec.ts` (7),
`tests/components/reservations/ReservationCityTax.spec.ts` (11).
⚠️ `useFeesTaxes` uses **module-level refs**, which the `useState` shim does not reset, so
every spec resets `feeTaxItems` / `taxSets` / `assignments` by hand. Composable fixtures
use dates **relative to today**, because the alert stages read the current day.

**NOT implemented (intentionally out of scope):** remittance reporting to the municipality;
guest-facing payment (no payment request link, no guide line, no invoice line); any
accounting push (`useIntegrationAccounts.cityTax` keeps its separate meaning); per-guest
exemptions beyond the adults / children / infants categories plus a manual waive; reading
from a real channel API; and any background job (alerts come from `emitCityTaxAlerts()`).
````

- [ ] **Step 2: Add the composable to the Composables Reference table**

In the `## 🔌 Composables Reference` table, add:

```markdown
| `useCityTax` | `app/composables/useCityTax.ts` | Who collects the tourist levy on a stay, and chasing the host's share | `assessmentFor(id)`, `markCollected()`, `waive()`, `undoSettlement()`, `rows`, `overdue`, `dueToday`, `upcoming`, `settled`, `outstandingTotal`, `collectedTotal`, `notifyOnBooking`, `emitCityTaxAlerts()`. The only writer of `cityTaxSettlement`; never touches `priceDetails` or the folio. |
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(city-tax): document the module, its invariants and its boundaries"
```

---

## Done criteria

- [ ] `npx vitest run` passes, with 96 new tests across four files
- [ ] `npx vue-tsc --noEmit` reports no error naming a city tax symbol
- [ ] `/settings/fees-taxes` can set a per-channel policy on a city tax and nothing else
- [ ] A Direct booking on a seeded listing shows Due with its arithmetic, collects, and logs
- [ ] An Airbnb booking on the same listing says the channel collects and offers no action
- [ ] `/city-tax` lists the outstanding work, bulk collects, and the bell fills and clears
- [ ] No reservation's `priceDetails`, `payout` or `folioItems` changed anywhere in the flow
