> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

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
- **Children and infants can be priced differently** via `CityTaxConfig.guestRates`
  (`{ children?, infants? }`). There is deliberately **no `adults` key**:
  `ListingFeeTaxItem.rate` IS the adult rate, and a second place saying what an adult pays is
  a second place for it to be wrong.
  - ⚠️ **An unset category inherits `item.rate`**, which is exactly what a tenant got before
    the field existed, so no seeded item migrates. ⚠️ **An explicit `0` is a real exemption
    and is NOT the same as unset** (`??`, never `||`): a municipality that exempts infants
    while still counting them is a real policy, and collapsing the two charges those infants
    the adult rate.
  - ⚠️ **Only the guest-multiplying logics read it** (`per_person`, `per_person_per_night`),
    the same rule `skipNights` / `maxNights` follow for nights. A child rate on a
    `per_booking` charge would promise a discount nothing applies, so the settings form hides
    the inputs there and `cityTaxGuestRateSummary` returns `''`.
  - `chargeableGuestBreakdown()` returns one row per chargeable category, adults first, and
    **omits** a category that is not charged or that nobody in the party belongs to. A zero
    row for a category nobody is charging reads as an exemption that was applied, when the
    category was never in scope.
  - `CityTaxBasisLine.guestBreakdown` carries the priced rows (empty on a non-guest logic);
    `line.rate` stays the **adult** rate and `line.chargeableGuests` the total head count, so
    nothing that read them before changed meaning. `hasMixedGuestRates(line)` is what decides
    whether a surface may print the flat "N guests × RATE" working: it is true for a lone
    non-adult category too, because a party of two children is not billed at the headline
    rate. `ReservationCityTaxSection` prints one working line per category when it is true.
  - Seed: `ft-3` Kurtaxe charges all three categories at EUR 3 / 1.50 / 0, and `lex-res-001`
    carries a 2+1+1 party so the mixed breakdown is reachable on load.
- **Where the categories begin and end** is `CityTaxConfig.ageBands?: CityTaxAgeBands`
  (`{ infantUnder, childUnder }`), falling back to `DEFAULT_CITY_TAX_AGE_BANDS` (2 / 12) so no
  seeded item migrates.
  - ⚠️ **Both are EXCLUSIVE upper bounds**, because that is how the rule is written ("children
    under 12"). A guest turning 12 is an adult. `infantUnder: 0` is a real setting meaning the
    tenant recognises no infant band, and `cityTaxAgeBandLabel` then reads the child row as
    "under 12" rather than "0-11", which would invite the question of where the infants went.
  - ⚠️ **The bands classify nobody today, and this is not an oversight.** `ReservationEntry`
    carries head COUNTS (`guestAdults` / `guestChildren` / `guestInfants`), never ages, and no
    channel here supplies one, so moving a band cannot move a guest between categories or move
    a total. A test asserts exactly that. They state the policy, label every surface, and
    `classifyGuestAge(age, bands)` makes the rule executable for the desk and for whenever ages
    do arrive. Do not wire it into `computeCityTaxLine`: there is nothing there to classify.
  - ⚠️ **`ageBandsError` blocks the save rather than reordering the numbers.** A `childUnder`
    at or below `infantUnder` leaves the child band unreachable, so the child rate beside it
    would price nobody; a tenant who typed the two the wrong way round meant something, and
    guessing which way would put a rate against a band they never chose.
  - `CityTaxBasisLine.ageBands` is **resolved and never optional**, copied off the item the same
    way `authorityName` and `note` are, so a surface prints the band without re-reading the
    config. `ReservationCityTaxSection` names it on each breakdown row ("1 child (2-11) × EUR
    1.50"), because the question the desk gets is "my daughter is 11, why is she on here".
  - Seed: `ft-3` draws its lines at **6 and 16**, not the 2 / 12 default, so the surfaces are
    demonstrably reading the configured bands rather than the fallback.

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

**Tests:** `tests/lib/city-tax.spec.ts` (91), `tests/composables/useCityTax.spec.ts` (28),
`tests/components/reservations/ReservationCityTax.spec.ts` (14).
⚠️ `FeesTaxesSettingsPanel.vue` has **no spec at all**, so the age-band inputs and the save gate
are covered only through `ageBandsError` in the pure module.
⚠️ `useFeesTaxes` uses **module-level refs**, which the `useState` shim does not reset, so
every spec resets `feeTaxItems` / `taxSets` / `assignments` by hand. Composable fixtures
use dates **relative to today**, because the alert stages read the current day.

**NOT implemented (intentionally out of scope):** remittance reporting to the municipality;
guest-facing payment (no payment request link, no guide line, no invoice line); any
accounting push (`useIntegrationAccounts.cityTax` keeps its separate meaning); a FOURTH age band
(a "12 to 17" tier would need its own guest counts on `ReservationEntry`, which no channel
supplies here — the three bands' boundaries are configurable, their number is not); classifying
a real guest by age (no age reaches a reservation, see the ⚠️ above); per-guest exemptions beyond
those three categories plus a manual waive; reading
from a real channel API; and any background job (alerts come from `emitCityTaxAlerts()`).
