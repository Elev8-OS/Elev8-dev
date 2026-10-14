import type { WebsiteRuleSet } from '~/components/channels/data/website-channel'
import type { WebsiteQuote } from '~/components/channels/data/website-quote'
import { websiteQuote } from '~/components/channels/data/website-quote'
import { getUnitTypeForUnit, getUnitTypes, listings } from '~/components/listings/data/listings'
import { parseIsoDate, previewPolicy, revenueRooms } from '~/components/revenue/data/revenue-policy'
import { useRevenuePolicy } from '~/composables/useRevenuePolicy'

const DAY_MS = 86_400_000

/**
 * Feeds `websiteQuote` from the stores: nightly prices from the room's
 * revenue policy (the policy-derived fallback, as the Revenue tab previews
 * it), the unit type's length of stay tiers and the policy's weekly / monthly %.
 * A listing with units is priced on its first room.
 */
export function useWebsiteQuote() {
  const { policyFor } = useRevenuePolicy()

  function quoteStay(args: { listingId: string, checkIn: string, checkOut: string, bookedOn: string, ruleSet: WebsiteRuleSet | null }): WebsiteQuote | null {
    const listing = listings.value.find(l => l.id === args.listingId)
    const room = listing ? revenueRooms([listing])[0] : undefined
    if (!listing || !room)
      return null
    const policy = policyFor(room)
    const lead = Math.max(0, Math.round((parseIsoDate(args.checkIn).getTime() - parseIsoDate(args.bookedOn).getTime()) / DAY_MS))
    const nights = Math.max(0, Math.round((parseIsoDate(args.checkOut).getTime() - parseIsoDate(args.checkIn).getTime()) / DAY_MS))
    // Previewed from the booking day, so last-minute policy rules see the real lead time.
    const nightly = previewPolicy(policy, parseIsoDate(args.bookedOn), lead + nights).slice(lead).map(n => n.price)
    const unitType = room.unitId ? getUnitTypeForUnit(listing, room.unitId) : getUnitTypes(listing)[0]
    return websiteQuote({
      currency: room.currency,
      nightly,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      bookedOn: args.bookedOn,
      ruleSet: args.ruleSet,
      listingTiers: unitType?.pricing.lengthOfStayDiscounts ?? [],
      policyLength: policy.lengthDiscounts,
    })
  }

  return { quoteStay }
}
