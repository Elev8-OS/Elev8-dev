/**
 * Picks the Listing Health data source.
 *
 * Swapping the prototype onto the real API is one line here. Keep it that way:
 * no screen and no other composable may import an adapter directly.
 */
import type { RevenueDataSource } from '~/components/revenue/data/contract'
import { createMockRevenueSource } from '~/components/revenue/data/mock-source'

let override: RevenueDataSource | null = null

/** Tests inject a source here. Production never calls this. */
export function setRevenueSource(source: RevenueDataSource | null) {
  override = source
}

export function useRevenueSource(): RevenueDataSource {
  if (override)
    return override

  // Swap for `createHttpRevenueSource()` when the endpoints in
  // REVENUE_ENDPOINTS exist.
  return createMockRevenueSource()
}
