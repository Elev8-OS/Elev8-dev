/**
 * The rooms under revenue management in the demo, as real listing rooms.
 *
 * Listing Health, the PriceLabs mock and the Revenue tab all key rooms by the
 * `revenueRooms` key (`<listingId>` or `<listingId>:<unitId>`). This file
 * names which rooms the health fixtures talk about, and the pricing policy
 * each one was set up with, so the numbers a finding quotes are the numbers
 * the room's Revenue tab shows.
 */
import type { PricingPolicy } from '~/components/revenue/data/revenue-policy'
import { listings } from '~/components/listings/data/listings'
import { defaultPolicy, revenueRooms } from '~/components/revenue/data/revenue-policy'

/** The rooms the health findings are about. */
export const MANAGED_ROOM = {
  canggu: 'lst-14',
  uluwatu: 'lst-8',
  seminyak: 'lst-10',
  pererenan: 'lst-3',
  ubud: 'lst-5',
  seminyakApartment: 'lst-2',
} as const

/** Rooms the engine cannot assess yet, and why. */
export const NOT_ASSESSABLE_ROOM = {
  kintamani: 'lst-13',
  ubudBamboo: 'lst-16',
  jimbaran: 'lst-11',
  ubudJungle: 'lst-9',
} as const

/** The room's display name and location, from the listings. */
export function managedRoomLabel(key: string): { name: string, location: string } {
  const room = revenueRooms(listings.value).find(r => r.key === key)
  return room
    ? { name: room.name, location: room.location }
    : { name: key, location: '' }
}

type PolicyAnchors = Pick<PricingPolicy['base'], 'price' | 'minPrice' | 'maxPrice'> & { minStay: number }

/** What each managed room was set up with. Findings quote these values. */
const MANAGED_POLICY: Record<string, PolicyAnchors> = {
  [MANAGED_ROOM.canggu]: { price: 182, minPrice: 150, maxPrice: 340, minStay: 2 },
  [MANAGED_ROOM.uluwatu]: { price: 340, minPrice: 240, maxPrice: 420, minStay: 3 },
  [MANAGED_ROOM.seminyak]: { price: 148, minPrice: 110, maxPrice: 300, minStay: 2 },
  [MANAGED_ROOM.pererenan]: { price: 96, minPrice: 70, maxPrice: 210, minStay: 2 },
  [MANAGED_ROOM.ubud]: { price: 132, minPrice: 100, maxPrice: 410, minStay: 2 },
  [MANAGED_ROOM.seminyakApartment]: { price: 118, minPrice: 90, maxPrice: 260, minStay: 2 },
}

/** The set-up policy of every managed room, keyed by room. */
export function managedRoomPolicies(): Record<string, PricingPolicy> {
  const rooms = revenueRooms(listings.value)
  const out: Record<string, PricingPolicy> = {}
  for (const [key, anchors] of Object.entries(MANAGED_POLICY)) {
    const room = rooms.find(r => r.key === key)
    if (!room)
      continue
    const policy = defaultPolicy({ currency: room.currency, seedRate: anchors.price })
    out[key] = {
      ...policy,
      base: { price: anchors.price, minPrice: anchors.minPrice, maxPrice: anchors.maxPrice },
      minStay: { ...policy.minStay, default: anchors.minStay },
    }
  }
  return out
}
