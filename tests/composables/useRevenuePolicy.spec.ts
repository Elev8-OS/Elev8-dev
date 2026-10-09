import { beforeEach, describe, expect, it } from 'vitest'
import { listings } from '~/components/listings/data/listings'
import { revenueRooms } from '~/components/revenue/data/revenue-policy'
import { derivedCosts, useRevenuePolicy } from '~/composables/useRevenuePolicy'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

const rooms = revenueRooms(listings.value)
const room = rooms[0]!
const other = rooms[1]!

beforeEach(() => {
  localStorage.clear()
})

describe('useRevenuePolicy', () => {
  it('reads a seeded default until the first save, then versions every save', () => {
    const store = useRevenuePolicy()
    expect(store.currentVersion(room.key)).toBeNull()

    const policy = store.policyFor(room)
    policy.base.price += 10
    const v1 = store.savePolicy(room.key, policy)
    expect(v1).toMatchObject({ version: 1, savedBy: 'Komang Juliantara', note: 'Saved' })

    policy.base.price += 10
    store.savePolicy(room.key, policy)
    expect(store.versionsFor(room.key).map(v => v.version)).toEqual([1, 2])
    expect(store.policyFor(room).base.price).toBe(policy.base.price)
  })

  it('never edits a saved version: changing the returned policy leaves the store alone', () => {
    const store = useRevenuePolicy()
    store.savePolicy(room.key, store.policyFor(room))
    const copy = store.policyFor(room)
    copy.base.price = 1
    expect(store.policyFor(room).base.price).not.toBe(1)
  })

  it('restores an old version as a new one', () => {
    const store = useRevenuePolicy()
    const p = store.policyFor(room)
    const firstPrice = p.base.price
    store.savePolicy(room.key, p)
    store.savePolicy(room.key, { ...p, base: { ...p.base, price: firstPrice + 5 } })
    const restored = store.restoreVersion(room.key, 1)
    expect(restored).toMatchObject({ version: 3, note: 'Restored version 1' })
    expect(store.policyFor(room).base.price).toBe(firstPrice)
  })

  it('copies seasons onto other rooms as a new version each, keeping their own prices', () => {
    const store = useRevenuePolicy()
    const p = store.policyFor(room)
    p.seasons = [{ id: 's', label: 'Peak', from: '2027-12-20', to: '2028-01-05', adjustPct: 30, minStay: 5, minPrice: null }]
    store.savePolicy(room.key, p)
    const otherBase = store.policyFor(other).base.price

    store.copySeasons(room, store.policyFor(room), [other])
    expect(store.policyFor(other).seasons.map(s => s.label)).toEqual(['Peak'])
    expect(store.policyFor(other).base.price).toBe(otherBase)
    expect(store.currentVersion(other.key)?.note).toBe(`Seasons copied from ${room.name}`)
  })

  it('marks a typed-in cost as confirmed and a reset one as derived again', () => {
    const store = useRevenuePolicy()
    store.setCostOverride(room.key, 'cleaningPerTurnover', 25)
    expect(store.costFor(room.key).fields.cleaningPerTurnover).toEqual({ override: 25, confirmed: true })
    store.setCostOverride(room.key, 'cleaningPerTurnover', null)
    expect(store.costFor(room.key).fields.cleaningPerTurnover).toEqual({ override: null, confirmed: false })
    store.confirmCommission(room.key, 'Airbnb')
    expect(store.costFor(room.key).commission.Airbnb).toEqual({ override: null, confirmed: true })
  })

  it('persists and hydrates from localStorage', () => {
    const store = useRevenuePolicy()
    store.savePolicy(room.key, store.policyFor(room))
    const raw = localStorage.getItem('elev8-revenue-policies')
    expect(raw).toContain(room.key)
  })
})

describe('derivedCosts', () => {
  it('derives cleaning from the housekeeping rate and the cleaning time, in the room currency only', () => {
    const { settings } = useRevenueSettings()
    const costs = { ...settings.value.costs, defaultCleaningMinutes: 90 }
    const usd = derivedCosts({ ...room, listingId: 'no-cleanings' }, 'USD', costs)
    expect(usd.cleaningPerTurnover.value).toBe(costs.byCurrency.USD!.housekeepingRatePerHour * 1.5)
    expect(usd.cleaningPerTurnover.source).toContain('default')

    const chf = derivedCosts(room, 'CHF', costs)
    expect(chf.cleaningPerTurnover.value).toBeNull()
    expect(chf.consumablesPerStay.value).toBeNull()
    expect(chf.paymentPct.value).toBe(costs.paymentPct)
  })
})

describe('useRevenueSettings', () => {
  it('saves changes and reads them back on hydrate', () => {
    const store = useRevenueSettings()
    store.setDefaultBasis('margin')
    store.saveBlackout({ id: 'b2', label: 'Nyepi', from: '2027-03-08', to: '2027-03-09', tags: [] })
    expect(JSON.parse(localStorage.getItem('elev8-revenue-settings')!).defaultBasis).toBe('margin')
    expect(store.settings.value.blackouts.map(b => b.id)).toContain('b2')
  })

  it('never removes an Elev8-curated event, only hides it', () => {
    const store = useRevenueSettings()
    const curated = store.settings.value.events.find(e => e.source === 'elev8')!
    store.removeEvent(curated.id)
    expect(store.settings.value.events.some(e => e.id === curated.id)).toBe(true)
    store.setEventHidden(curated.id, true)
    expect(store.settings.value.events.find(e => e.id === curated.id)?.hidden).toBe(true)
  })

  it('moves a room between groups and back', () => {
    const store = useRevenueSettings()
    store.moveRoom(room.key, 'none')
    expect(store.settings.value.substitution.moves[room.key]).toBe('none')
    store.moveRoom(room.key, null)
    expect(room.key in store.settings.value.substitution.moves).toBe(false)
  })
})
