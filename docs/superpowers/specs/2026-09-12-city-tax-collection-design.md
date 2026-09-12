# City Tax Collection Design

> Date: 2026-09-12
> Status: Approved, ready for implementation planning
> Module: Reservations (new `city-tax` surface), Settings (Fees & Taxes), Notification Center

## Problem

A tourist levy (Kurtaxe, city tax, pajak hotel) is collected by the channel on some
bookings and by the host on others, and the split differs per channel, per property
and per municipality. Airbnb collects and remits in many jurisdictions, Booking.com
does so in some, and a direct booking is always on the host.

Today the dashboard can define the rate but cannot answer the only question that
matters at the front desk: **on this booking, does somebody still have to take money
from this guest, and how much?** Uncollected tax is a liability the operator pays out
of pocket at the end of the period.

## Goal

**Never miss a collection.** Staff must know, per booking, whether city tax still has
to be collected, how much, and be able to record that it was collected. Alerts push,
a worklist pulls.

Explicit non-goals are listed at the end. Remittance reporting and guest-facing
payment are separate specs.

## What already exists

- `ListingFeeTaxItem` (`app/components/listings/data/listings.ts`) already carries
  `type: 'city_tax'`, `logic` (`percent | per_room | per_room_per_night | per_person |
  per_person_per_night | per_night | per_booking`), `rate`, `currency`, `isInclusive`,
  `skipNights`, `maxNights` and `applicableDateRanges`.
- `useFeesTaxes` holds the item library, the tax sets and the per-listing assignment.
  `FeesTaxesSettingsPanel.vue` (`/settings/fees-taxes`) edits them.
- `ReservationEntry.channel` is `'Airbnb' | 'Booking.com' | 'Direct'`.
- `useReservationFolio` and `data/folio.ts` establish the house pattern: a pure,
  framework-free rules module plus a composable that owns reactive state.
- `useNotifications.createAlert(type, severity, context)` is generic. The
  `GUEST_REGISTRATION_DUE / OVERDUE` family is the closest precedent.
- `useIntegrationAccounts.cityTax.collectionMode` exists but is an accounting posting
  rule per integration. It is **not** touched by this feature and keeps its meaning.

The gap is not the rate. It is who collects on this booking, and telling staff.

## Data model

### 1. The rule lives on the city tax item

One optional field on `ListingFeeTaxItem`, meaningful only when `type === 'city_tax'`.
Optional, so no seeded item migrates.

```ts
export type ReservationChannel = 'Airbnb' | 'Booking.com' | 'Direct'
export type CityTaxCollector = 'host' | 'channel' | 'not_applicable'

export interface CityTaxConfig {
  /** Who collects this tax, per channel. An unset channel falls back to 'host'. */
  channelPolicy: Partial<Record<ReservationChannel, CityTaxCollector>>
  /** Which guest categories count toward a per_person logic. */
  chargeableGuests: { adults: boolean, children: boolean, infants: boolean }
  /** Who levies it. Surfaced to staff at the desk. */
  authorityName?: string
  note?: string
}

// ListingFeeTaxItem.cityTax?: CityTaxConfig
```

`ReservationChannel` is extracted from the inline union on `ReservationEntry.channel`
so both sides name the same type.

> The unset-channel fallback is **`'host'`, never `'not_applicable'`**. The goal is to
> never miss a collection, so an unconfigured channel must over-alert rather than go
> silent. Do not "improve" this to a safer-looking default.

Assigning the item to listings through the existing `useFeesTaxes` assignment is what
distributes the rule. A municipal tax is one rule levied at many properties, so it is
configured once, not re-entered per property.

### 2. Status is derived, settlement is stored

`ReservationEntry` stores **only what staff did**:

```ts
export interface CityTaxSettlement {
  state: 'collected' | 'waived'
  /** Frozen at settlement time. */
  amount: number
  currency: string
  settledAt: string
  settledBy: string
  method?: 'cash' | 'card' | 'bank_transfer' | 'other'
  /** Required when state is 'waived'. */
  reason?: string
  note?: string
}

// ReservationEntry.cityTaxSettlement?: CityTaxSettlement
```

Everything else is computed live:

```ts
export type CityTaxStatus
  = 'not_required'      // no city_tax item applies to this listing
  | 'channel_collects'  // the OTA collects and remits, nothing to do
  | 'due'               // host collects, not settled yet
  | 'collected'
  | 'waived'

export interface CityTaxBasisLine {
  taxItemId: string
  taxTitle: string
  authorityName?: string
  logic: TaxLogic
  rate: number
  chargeableGuests: number
  chargeableNights: number
  amount: number
  currency: string
}

export interface CityTaxTotal {
  currency: string
  amount: number
}

export interface CityTaxAssessment {
  status: CityTaxStatus
  collector: CityTaxCollector
  /** One entry per currency present in `lines`. Almost always length 1. */
  totals: CityTaxTotal[]
  lines: CityTaxBasisLine[]
  settlement: CityTaxSettlement | null
}
```

> **Why derived.** A host flipping Booking.com from "channel collects" to "host
> collects" must re-evaluate every existing future booking on the spot. A status
> written at import time would sit there stale and the feature would quietly
> under-report, which is the exact failure it exists to prevent.

> **Why the settlement freezes its own amount.** Same principle as a folio catalog
> pick: a later rate change must never rewrite what a guest actually paid. The
> assessment's live `amount` and the settlement's frozen `amount` can legitimately
> differ, and the reservation detail shows the frozen one once settled.

Multiple city tax items on one listing are supported and summed (a per-person Kurtaxe
plus a percentage tourism levy is a real combination), which is why `lines` is a list.

## Pure module: `app/components/reservations/data/city-tax.ts`

Framework free, the same split as `folio.ts` and `lock-access.ts`. The composable owns
reactive state and calls in. Every function takes structural inputs, not stores, so the
rules are testable without `useFeesTaxes` or `useReservationsModule`.

| Function | Behaviour |
|---|---|
| `collectorFor(config, channel)` | Channel policy lookup, falling back to `'host'` |
| `chargeableGuestCount(reservation, config)` | Sums the enabled categories from `guestAdults` / `guestChildren` / `guestInfants`, falling back to `guestCount` treated as adults when the breakdown is absent |
| `chargeableNights(item, nights)` | Applies the existing `skipNights` and `maxNights` |
| `isWithinApplicableRange(item, checkIn)` | Gates on the existing `applicableDateRanges`, evaluated against check-in |
| `computeCityTaxLine(item, reservation)` | One `CityTaxBasisLine` per applicable item, covering every `TaxLogic` |
| `resolveCityTax(reservation, items)` | The full `CityTaxAssessment` |
| `cityTaxAlertStage(assessment, reservation, todayIso)` | `null \| 'upcoming' \| 'due_today' \| 'overdue'` |

Logic rules worth pinning:

- **`percent` is charged on `priceDetails.subtotal`** (accommodation only), never on the
  grand total. A tourist levy is not charged on the cleaning fee or on upsells.
- `per_room` and `per_room_per_night` multiply by `reservation.rooms?.length ?? 1`.
- `skipNights` subtracts the first N nights, `maxNights` caps the chargeable nights.
  Both clamp at zero, so a 2-night stay with `skipNights: 3` owes nothing rather than a
  negative amount.
- A listing with no city tax item assigned resolves to `not_required`, and nothing
  about the feature renders on that reservation.
- **No currency conversion, ever.** A line keeps the item's own currency, falling back
  to the reservation's currency when the item sets none. `totals` therefore carries one
  entry per distinct currency, and the UI renders every entry rather than picking one.
  In practice a listing's city tax items share its currency, so `totals` has length 1,
  but the type does not pretend that is guaranteed. There is no single `amount` field
  on the assessment for exactly this reason: it would force a blended number the moment
  two currencies appear.

## Composable: `app/composables/useCityTax.ts`

Reads `useFeesTaxes()` for the items and `useReservationsModule()` for the bookings. It
is the **only writer** of `cityTaxSettlement`.

```ts
assessmentFor(reservationId): CityTaxAssessment
markCollected(id, { method, note? }): void
waive(id, reason): void        // reason required, validated, rejects empty
undoSettlement(id): void
```

Each action patches `cityTaxSettlement` **and** appends its `ActivityEvent` in **one**
`updateReservation` call, so a collection and its audit line cannot land apart. Same
rule the folio follows.

Worklist computeds, pure filters over `reservations` through `resolveCityTax`:

- `overdue` : checked out, `status === 'due'`
- `dueToday` : check-in is today, `status === 'due'`
- `upcoming` : check-in in the future, `status === 'due'`
- `settled` : has a settlement, within the selected period
- `outstandingTotal` : `overdue` plus `dueToday`, as `CityTaxTotal[]`, **grouped per
  currency, never blended**

> Per-currency totals are not a nicety. A Bali property levies IDR and a German one
> EUR, and the codebase already forbids invented exchange rates on anything a guest or
> an authority sees.

It never writes to `priceDetails`, `guestPaid`, `payout`, `commission` or the folio.
City tax is a pass-through liability owed to the municipality, not owner revenue.
Posting it through `useReservationFolio` would inflate every owner payout by the tax,
because `commit()` moves `extras`, `guestPaid` and `payout` in lockstep.

## Alerts

Three new `AlertType` values, mirroring the `GUEST_REGISTRATION_*` precedent:

| Type | Severity | Fires when |
|---|---|---|
| `CITY_TAX_COLLECTION_UPCOMING` | INFO | A booking lands where the host collects |
| `CITY_TAX_COLLECTION_DUE` | WARNING | Check-in day, still unsettled |
| `CITY_TAX_COLLECTION_MISSED` | CRITICAL | Guest has checked out, still unsettled |

Wiring:

- `alertDisplayLabels`, `alertIcons` (`lucide:landmark`), `getDescription()` (guest,
  property, and the amount in its own currency), `alertRouteMap` pointing at `/city-tax` deep-linked
  to the reservation.
- `createCityTaxAlert(type, context)` picks severity, exactly like
  `createGuestRegistrationAlert`.
- **Settling dismisses any live city tax alert for that reservation.** The alert is a
  prompt, not a log. Once the money is in it leaves the bell without a second click.
- `CITY_TAX_COLLECTION_UPCOMING` is **off by default**, behind one tenant switch on the
  Fees & Taxes settings page, "Notify when a collection is booked". A tenant collecting
  on every direct booking would otherwise make it the loudest alert in the app. DUE and
  MISSED are always on.
- Emission is mock-driven like every other alert here: `emitCityTaxAlerts()` evaluates
  the worklist and raises what is missing, called on the worklist page and from its
  "Check for alerts" button. No cron, no server job.

## Surfaces

### Settings: the rule editor

In `FeesTaxesSettingsPanel.vue`, the fee/tax editor reveals a **City Tax Collection**
block only when `type === 'city_tax'`:

- Three rows, one per channel, each a segmented control: **Host collects · Channel
  collects · Not applicable**. A helper line states the fallback: "Channels you leave
  unset are treated as host collects."
- **Chargeable guests**: three checkboxes (adults, children, infants), default adults
  only.
- **Levied by** text input and an optional note, both surfaced to staff at the desk so
  whoever collects can answer "what is this charge".
- The "Notify when a collection is booked" switch sits at the top of the page, not per
  item, because it is a noise preference rather than a tax rule.

### Reservation detail

`ReservationCityTaxSection.vue`, an accordion item in `ReservationDetailSheet.vue`
placed **directly after the folio section**, so the desk reads one money story top to
bottom. It renders `assessmentFor(reservation.id)`:

- `not_required` : the section does not render at all.
- `channel_collects` : status chip plus one explanatory line ("Booking.com collects and
  remits this tax. Nothing to collect at the property."). No action buttons, because
  there is no action.
- `due` : the amount large, then the arithmetic spelled out per line, "Kurtaxe, 2
  guests x 4 nights x EUR 3.00 = EUR 24.00". Staff get challenged on this at the desk
  and need the working visible. Actions: **Mark collected** (method picker: cash, card,
  bank transfer, other, plus an optional note) and **Waive** (reason required, in a
  small dialog modelled on `FolioVoidDialog.vue`).
- `collected` / `waived` : who, when, how much, by what method or for what reason, plus
  **Undo**. Mis-clicks happen at a busy desk.

`ReservationTable.vue` gets a compact chip in the existing status area: amber "Tax
due", red "Tax missed", grey "Channel", a green tick when settled, nothing when not
required.

### The worklist: `/city-tax`

New page, sidebar entry directly under **Guest Registration** (`i-lucide-landmark`,
`new: true`). It is the same shape of job: a per-stay obligation somebody has to chase.

- Header KPIs: **Overdue**, **Due today**, **Upcoming (7 days)**, **Collected this
  month**, each broken out per currency.
- Tabs: Overdue · Due today · Upcoming · Settled.
- Table: guest, property, channel, check-in, check-out, basis summary, amount, status,
  actions. Row click opens the reservation detail sheet, so there is exactly one place
  the work gets done.
- Filters: property, channel, date range, search by guest.
- **Bulk mark collected** on row selection, using the `clearKey` checkbox pattern the
  finance tables use (reka-ui `CheckboxRoot` ignores external `:checked` changes after
  first render). One method picker applies to the whole selection.
- A **Check for alerts** button calling `emitCityTaxAlerts()`, matching how Smart Lock
  and Minut surface their mock events.

## Testing

- **`tests/lib/city-tax.spec.ts`** : every `TaxLogic`; percent based on `subtotal` and
  not the grand total; `skipNights` / `maxNights` clamping at zero; date-range gating;
  chargeable guest counting with and without the adults/children/infants breakdown; the
  unset-channel falls back to host; two city tax items on one listing summing into two
  lines; the alert stage boundaries on check-in day and after checkout.
- **`tests/composables/useCityTax.spec.ts`** : the settlement freezes its amount
  against a later config change; waive rejects an empty reason; undo restores `due`;
  exactly one `updateReservation` call per action and it carries the activity event;
  settling dismisses the alert; worklist bucketing; per-currency totals never blended;
  nothing writes to `priceDetails` or the folio.
- **`tests/components/reservations/ReservationCityTax.spec.ts`** : the four render
  states; the arithmetic line; `channel_collects` renders no action buttons;
  `not_required` renders nothing.

Harness notes that already cost time elsewhere in this repo and apply here:

- Fixtures use dates **relative to today**, never fixed 2026 dates, because the alert
  stages are evaluated against the current day (the lesson from
  `tests/composables/useUpsellLockAccess.spec.ts`).
- Nuxt auto-imported children and the shadcn primitives must be registered in
  `global.components` or assertions pass vacuously against unresolved stubs.
- `import.meta.client` is not substituted under Vitest. Guard any persistence on
  `typeof localStorage` instead.

## Not in scope, deliberately

- **Remittance reporting** to the municipality (period return: nights, persons,
  exemptions, owed vs collected). Its own spec. The model here is built so it can be
  added without migration.
- **Guest-facing collection**: no payment request link, no guest guide line, no invoice
  line. Staff record what they collected.
- **Accounting push**: nothing writes to Jurnal, Bexio, Lexware or DATEV.
  `useIntegrationAccounts.cityTax` keeps its current meaning and is untouched.
- **Per-guest exemptions**: category level only. A business traveller or a local
  resident is a manual waive with a reason.
- **Real channel data**: whether Booking.com actually collected on a given booking is
  host configuration, not something read from an API.
- **Owner payout impact**: city tax never touches `priceDetails`, `guestPaid`,
  `payout` or `commission`.
- **Background jobs**: alerts are raised by an in-app `emitCityTaxAlerts()` call, not
  by a scheduler.
