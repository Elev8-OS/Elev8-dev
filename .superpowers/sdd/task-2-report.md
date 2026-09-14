# Task 2 Report: Rules Module Part 1 (Collector, Guests, Nights, Date Ranges)

## What Was Implemented

Created a framework-free pure rules module `app/components/reservations/data/city-tax.ts` that provides core business logic for city tax collection management:

1. **`collectorFor(config, channel)`** - Determines who collects city tax for a given booking channel. Returns the configured collector or defaults to `’host’` to ensure unconfigured channels never silently skip collection.

2. **`chargeableGuestCount(guests, config)`** - Counts guests eligible for city tax based on configured rules (adults/children/infants). Handles cases where guest breakdown is missing by treating total as adults.

3. **`chargeableNights(item, nights)`** - Calculates chargeable nights by applying skip rules before caps, then clamping at zero to prevent negative values.

4. **`isWithinApplicableRange(item, checkIn)`** - Evaluates whether a given check-in date falls within configured seasonal date ranges, supporting multiple ranges with inclusive endpoints.

Also exported:
- `DEFAULT_CHARGEABLE_GUESTS` constant (adults: true, children: false, infants: false)
- `CityTaxGuestCounts` interface for structural typing
- `CityTaxNightRules` and `CityTaxDateRules` type aliases for specific concerns

## What Was Tested

16 tests covering all four functions:

### `collectorFor` (3 tests)
- Reads configured collector for a channel
- Falls back to ‘host’ for unset channels (critical safety rule)
- Falls back to ‘host’ when config is undefined

### `chargeableGuestCount` (4 tests)
- Counts only enabled guest categories
- Treats total guestCount as adults when breakdown missing
- Charges nobody when breakdown absent and adults exempt
- Defaults to adults-only when no config given

### `chargeableNights` (5 tests)
- Returns all nights when nothing configured
- Drops skipped nights
- Caps at maxNights
- Applies skip before the cap
- Clamps at zero (prevents negative)

### `isWithinApplicableRange` (4 tests)
- Applies always when no range configured
- Applies inside range, inclusive at both ends
- Does not apply outside the range
- Applies when any one of several ranges matches

## TDD Evidence

### RED: Failed Test (Before Implementation)

```bash
$ npx vitest run tests/lib/city-tax.spec.ts

FAIL  tests/lib/city-tax.spec.ts [ tests/lib/city-tax.spec.ts ]
Error: Failed to resolve import "~/components/reservations/data/city-tax" from "tests/lib/city-tax.spec.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /Users/juli/Documents/ELEV8-DASHBOARD/Dashboard/tests/lib/city-tax.spec.ts:8:7

Test Files  1 failed (1)
     Tests  no tests
```

Expected failure reason: Module file does not exist yet. Test file imports the four functions but the module is not yet created.

### GREEN: Passing Tests (After Implementation)

```bash
$ npx vitest run tests/lib/city-tax.spec.ts

 RUN  v4.1.8 /Users/juli/Documents/ELEV8-DASHBOARD/Dashboard

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  23:56:23
   Duration  581ms (transform 66ms, setup 103ms, import 5ms, tests 3ms, environment 408ms)
```

All 16 tests pass with no warnings or errors.

## Files Changed

- **Created:** `app/components/reservations/data/city-tax.ts` (71 lines)
  - Pure TypeScript module with no Vue/framework imports
  - Imports only types from `~/components/listings/data/listings`
  - Exports 4 functions, 1 constant, 2 interfaces, 2 type aliases
  - Well-documented with JSDoc comments explaining the rules

- **Created:** `tests/lib/city-tax.spec.ts` (136 lines)
  - 16 test cases across 4 describe blocks
  - Helper function `taxItem()` for consistent test fixtures
  - Uses Vitest’s `describe`, `it`, `expect`

## Self-Review Findings

1. **Completeness:** All functions and exports from the brief are present with correct signatures.

2. **Documentation:** Each function has a JSDoc comment explaining its purpose and edge cases:
   - `collectorFor`: Explains the ‘host’ fallback safety rule
   - `chargeableGuestCount`: Documents the breakdown detection logic
   - `chargeableNights`: Clarifies the order of operations (skip → cap → clamp)
   - `isWithinApplicableRange`: Notes inclusive endpoints and check-in evaluation

3. **Framework-free:** Module contains no Vue imports, no composables, no stores. Pure functions only.

4. **Code style:** Follows repo conventions:
   - No semicolons
   - Single quotes for strings
   - 2-space indent
   - camelCase function names
   - Type imports marked as `import type`

5. **Discipline:** Module exports exactly what the brief specifies, no extras.

6. **Test accuracy:** All 16 tests from the brief transcribed verbatim. Test count matches expected (16 tests).

7. **Type safety:** Proper use of TypeScript:
   - `Pick<>` utility types for `CityTaxNightRules` and `CityTaxDateRules`
   - Optional chaining (`?.`) for safe config access
   - Nullish coalescing (`??`) for defaults
   - `Math.min()` and `Math.max()` for bounds checking

## Issues and Concerns

None. The implementation is complete, tested, committed, and ready for the next task.

The fallback-to-’host’ rule in `collectorFor` is the load-bearing constraint that prevents silent collection gaps, and it is correctly implemented and tested.

## Commit Details

```
a56063d feat(city-tax): collector lookup, guest counting, night and season rules
```

Branch: `feat/city-tax-collection`
2 files changed, 199 insertions(+)
