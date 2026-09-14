# Task 3: Rules Module Part 2 (`computeCityTaxLine`) - Report

## Implementation Summary

Implemented the `computeCityTaxLine` function with full support for pricing city tax lines across all 7 tax logics, plus supporting types and utilities.

## What Was Implemented

### Added to `app/components/reservations/data/city-tax.ts`:

1. **Type imports:** Added `TaxLogic` from listings and `ReservationEntry` from reservations to support the implementation.

2. **`CityTaxBasisLine` interface:** Represents one priced tax line with:
   - `taxItemId`, `taxTitle`, `authorityName`, `note` — item metadata
   - `logic`, `rate` — pricing configuration
   - `chargeableGuests`, `chargeableNights`, `rooms` — computed counts
   - `amount`, `currency` — the final priced line

3. **`roundCityTaxAmount(value: number)` function:** Rounds amounts to the currency's minor unit (cents), following the 2-decimal rounding rule: `Math.round(value * 100) / 100`.

4. **`computeCityTaxLine(item, reservation)` function:** Prices a tax line or returns `null` if:
   - Item is not a city tax (`type !== 'city_tax'`)
   - Stay falls outside the item's applicable date range

   The function correctly handles all 7 tax logics:
   - `'percent'`: percentage of accommodation subtotal only (ignoring fees/extras)
   - `'per_booking'`: flat amount per stay
   - `'per_night'`: amount × chargeable nights
   - `'per_room'`: amount × number of rooms
   - `'per_room_per_night'`: amount × rooms × chargeable nights
   - `'per_person'`: amount × chargeable guests
   - `'per_person_per_night'`: amount × guests × chargeable nights

   Currency rules implemented:
   - Percent charges are priced in the **reservation's** currency (slice of existing price)
   - Fixed amounts use the **item's currency**, falling back to **reservation's currency** if not set

   Special cases handled:
   - `skipNights` and `maxNights` only affect night-multiplying logics (not per_booking)
   - Percent on reservations without price details charges 0
   - Amounts clamped to ≥0 before rounding

### Added to `tests/lib/city-tax.spec.ts`:

1. Updated imports to add `computeCityTaxLine` and `import type { ReservationEntry }`
2. Added `reservation()` helper function to create test fixtures
3. Added 16 new test cases covering all logics, edge cases, and currency/rounding rules

## Testing Evidence

### RED (Before Implementation)

```
$ npx vitest run tests/lib/city-tax.spec.ts
Test Files  1 failed (1)
     Tests  16 failed | 16 passed (32)
Error: TypeError: computeCityTaxLine is not a function
```

Expected failure for the right reason: function did not exist.

### GREEN (After Implementation)

```
$ npx vitest run tests/lib/city-tax.spec.ts
Test Files  1 passed (1)
     Tests  32 passed (32)
Duration  581ms
```

All 32 tests passing:
- 16 existing tests (from Task 2, unchanged)
- 16 new tests (Task 3 tests, all passing)

## Files Changed

1. `/Users/juli/Documents/ELEV8-DASHBOARD/Dashboard/app/components/reservations/data/city-tax.ts`
   - Added type imports (TaxLogic, ReservationEntry)
   - Added CityTaxBasisLine interface
   - Added roundCityTaxAmount function
   - Added computeCityTaxLine function

2. `/Users/juli/Documents/ELEV8-DASHBOARD/Dashboard/tests/lib/city-tax.spec.ts`
   - Updated imports (added computeCityTaxLine, ReservationEntry)
   - Added reservation() helper
   - Added 16 new test cases in describe('computeCityTaxLine', ...)

## Self-Review Findings

### Completeness ✓
- All 7 TaxLogic branches implemented
- Every field on CityTaxBasisLine populated correctly
- All doc comments from brief present
- No fields missing from interface

### Quality ✓
- Names match brief exactly (CityTaxBasisLine, computeCityTaxLine, roundCityTaxAmount)
- Still framework-free: no Vue, no composables, no stores
- Proper separation of concerns (currency handling, rounding, type checking)
- Readable with clear comments on critical rules

### Discipline ✓
- Only what the brief asked for (no resolveCityTax, alerts, activity events)
- YAGNI principle respected
- No speculative generalization

### Testing ✓
- Real RED before GREEN (tests properly failed before implementation)
- No stray warnings or failures
- Test output clean
- Correct count: 16 new tests (not 15, not 17)

## Issues or Concerns

None. Implementation is complete and correct.

## Commit

```
commit cb744bf
Author: Dev <dev@example.com>
Date:   2026-09-13

    feat(city-tax): price a tax line for every tax logic

    - Add CityTaxBasisLine interface (all fields required for pricing)
    - Add roundCityTaxAmount() function (minor unit rounding)
    - Add computeCityTaxLine() function (7-logic pricing engine)
    - Percent charges subtotal only, fixed amounts use item/reservation currency
    - skipNights/maxNights only affect night-multiplying logics
    - All 32 tests passing (16 existing + 16 new)
```

## Next Steps

Task 4 will extend this by implementing the full pricing pipeline (`buildCityTaxBasis`), integration with reservation folio, and host-owed vs. paid tracking.
