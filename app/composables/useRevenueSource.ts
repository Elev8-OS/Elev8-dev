/**
 * Picks the Listing Health data source.
 *
 * Swapping the prototype onto the real API is one line here. Keep it that way:
 * no screen and no other composable may import an adapter directly.
 */
import type { RevenueDataSource } from '~/components/revenue/data/contract'
import { createMockRevenueSource } from '~/components/revenue/data/mock-source'

let override: RevenueDataSource | null = null

/**
 * The production instance, memoized. Every caller must share the same
 * instance — the mock keeps in-flight applies in a `Map` keyed by applyId,
 * so a fresh instance per call would mean an apply started through one
 * caller can never be polled through another.
 */
let instance: RevenueDataSource | null = null

/**
 * Tests inject a source here. Production never calls this.
 *
 * The override is module-level, so it outlives the test that set it. A test
 * that injects must reset with `setRevenueSource(null)` in `afterEach`, or
 * set it unconditionally in `beforeEach` so nothing can inherit a stale one.
 * Either way clears the cached production instance too, so a test that clears
 * the override still gets a clean slate rather than the previous test's mock.
 */
export function setRevenueSource(source: RevenueDataSource | null) {
  override = source
  instance = null
}

export function useRevenueSource(): RevenueDataSource {
  if (override)
    return override

  // Swap for `createHttpRevenueSource()` when the endpoints in
  // REVENUE_ENDPOINTS exist.
  if (!instance)
    instance = createMockRevenueSource()
  return instance
}
