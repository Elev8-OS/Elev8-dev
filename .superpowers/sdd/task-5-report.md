# Task 5: Rules Module Part 4 (Alert Staging & Activity Events) - Report

## Summary
Successfully implemented two new functions and supporting types in the city tax rules module:
1. `cityTaxAlertStage` - determines the alert lifecycle stage (upcoming, due_today, overdue, or silent)
2. `cityTaxActivityEvent` - builds reservation timeline activity events

## Implementation Details

### What was implemented
**In `app/components/reservations/data/city-tax.ts`:**

1. **New imports:**
   - Added `ActivityEvent, ActivityEventColor` from inbox conversations module
   - Added `CityTaxPaymentMethod` to reservations type import

2. **New type exports:**
   - `CityTaxAlertStage = 'upcoming' | 'due_today' | 'overdue'`
   - `CityTaxActivityKind = 'collected' | 'waived' | 'reopened'`

3. **New function exports:**
   - `cityTaxAlertStage(assessment, stay, todayIso)` - determines alert stage with key logic:
     - Returns `null` if assessment status is not 'due' (silent for settled/channel-collected)
     - Returns `'overdue'` when `checkOut <= today` (guest can walk out)
     - Returns `'due_today'` when `checkIn <= today < checkOut` (guest still in house, collectable)
     - Returns `'upcoming'` before arrival
   
   - `cityTaxActivityEvent(kind, settlement, actor, now)` - builds timeline events with:
     - Timestamp-based unique ids (`act-citytax-{kind}-{timestamp}`)
     - Proper color coding: green (collected), gray (waived), gold (reopened)
     - Amount formatting with currency and method/reason description
     - Multi-currency support (lists all currencies without blending)

4. **Supporting functions:**
   - `formatCityTaxTotal(total)` - formats single currency amount
   - `formatCityTaxTotals(totals)` - formats multi-currency list or '0.00' for empty
   - `CITY_TAX_METHOD_LABELS` - constant mapping payment methods to display labels

### Key design decisions (all per brief requirements)

1. **Alert timing rules:**
   - `due_today` covers entire stay, not just arrival date (host can ask at desk until checkout)
   - `overdue` starts on checkout date itself (first day guest can leave unpaid)
   - This prevents false "overdue" alerts for in-house guests still collectable

2. **Activity event ids:**
   - Include timestamp in id (`act-citytax-{kind}-{timestamp}`) to ensure uniqueness
   - Without timestamp, collect.undo.recollect would produce 3 events sharing 1 id
   - Timeline would then render only one, losing the history

3. **Amount formatting:**
   - Lists every currency explicitly rather than blending/converting
   - No exchange rates invented (as per app philosophy)
   - Multi-currency settlements display as "24.00 EUR + 50,000.00 IDR"

## Testing

### TDD Process

**Step 1: RED - Confirmed tests fail with expected error**
```bash
npx vitest run tests/lib/city-tax.spec.ts
```
Result: 11 tests failed with expected errors:
- `TypeError: cityTaxAlertStage is not a function` (6 tests)
- `TypeError: cityTaxActivityEvent is not a function` (5 tests)

**Step 2: GREEN - All tests pass after implementation**
```bash
npx vitest run tests/lib/city-tax.spec.ts
```
Result:
```
 Test Files  1 passed (1)
      Tests  56 passed (56)
   Start at  10:14:27
   Duration  608ms
```

### Test Coverage
Total 56 tests (45 existing + 11 new):

**`cityTaxAlertStage` tests (6 new):**
- Upcoming before arrival
- Due on arrival day itself
- Stays due while guest in house
- Overdue on departure day (checkpoint date)
- Overdue after departure
- Silent for non-due (collected, channel-collected)

**`cityTaxActivityEvent` tests (5 new):**
- States amount and method on collected
- States reason on waived
- Lists every currency on multi-currency settlement
- Describes reopen without settlement data
- Ensures different timestamps create different ids (for undo/recollect history)

## Commit

**Commit SHA:** `8a52db7`
**Message:** `feat(city-tax): alert staging and activity events`
**Files changed:** 2
- `app/components/reservations/data/city-tax.ts` (+129 lines)
- `tests/lib/city-tax.spec.ts` (+11 tests, +94 lines)

## Self-Review Checklist

✓ **Completeness** - All functions, types, and labels from brief implemented
✓ **Quality** - Names exactly match brief specification
✓ **Framework-free** - No Vue, composables, or reactive patterns added
✓ **Code style** - No semicolons, single quotes, 2-space indent
✓ **Discipline** - Nothing added beyond brief requirements (YAGNI)
✓ **Documentation** - All public functions have load-bearing doc comments
✓ **No refactoring** - Kept `folioActivityEvent` as deliberately separate
✓ **Testing** - Real RED before GREEN, tests pass with expected count (56 = 45 + 11)

## Issues & Concerns

None. Implementation is complete, tested, and follows all specifications.

---

**Status:** DONE
