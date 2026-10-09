import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listings } from '~/components/listings/data/listings'
import { notAssessableRooms } from '~/components/revenue/data/diagnosis'
import { healthFindings, healthRooms } from '~/components/revenue/data/health'
import { MANAGED_ROOM } from '~/components/revenue/data/managed-rooms'
import { createMockRevenueSource } from '~/components/revenue/data/mock-source'
import { revenueRooms } from '~/components/revenue/data/revenue-policy'
import { usePriceLabs } from '~/composables/usePriceLabs'
import { useRevenueHealth } from '~/composables/useRevenueHealth'
import { useRevenuePolicy } from '~/composables/useRevenuePolicy'
import { setRevenueSource } from '~/composables/useRevenueSource'

/**
 * Listing Health, the pricing engine mock and the listing's Revenue tab talk
 * about the same rooms and the same numbers.
 */
const rooms = revenueRooms(listings.value)
const roomByKey = new Map(rooms.map(r => [r.key, r]))

beforeEach(() => {
  localStorage.clear()
})

describe('health fixtures use real listing rooms', () => {
  it('every health room, finding and not-assessable room is a room from the listings', () => {
    for (const room of healthRooms) {
      expect(roomByKey.has(room.id)).toBe(true)
      expect(room.name).toBe(roomByKey.get(room.id)!.name)
    }
    for (const finding of healthFindings)
      expect(roomByKey.has(finding.roomId)).toBe(true)
    for (const entry of notAssessableRooms)
      expect(entry.name).toBe(roomByKey.get(entry.roomId)!.name)
  })

  it('a finding quotes the base price the room policy holds', () => {
    const store = useRevenuePolicy()
    const room = roomByKey.get(MANAGED_ROOM.canggu)!
    const finding = healthFindings.find(f => f.id === 'finding-1')!
    const base = finding.changes.find(c => c.label === 'Base price')!
    expect(base.from).toBe(`USD ${store.policyFor(room).base.price}`)
    expect(store.currentVersion(room.key)?.version).toBe(1)
  })
})

describe('apply and revert write the room policy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setRevenueSource(createMockRevenueSource({ speed: 0 }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applying a pricing finding saves a new policy version; reverting restores the old values', async () => {
    const store = useRevenuePolicy()
    const room = roomByKey.get(MANAGED_ROOM.canggu)!
    const health = useRevenueHealth()
    const loading = health.load()
    await vi.runAllTimersAsync()
    await loading

    const applying = health.applyFinding('finding-1')
    await vi.runAllTimersAsync()
    await applying

    expect(health.applyStateFor('finding-1')).toBe('live')
    expect(store.policyFor(room).base.price).toBe(205)
    expect(store.currentVersion(room.key)).toMatchObject({ version: 2, note: expect.stringContaining('Applied from Listing Health') })

    const reverting = health.revertFinding('finding-1')
    await vi.runAllTimersAsync()
    await reverting

    expect(store.policyFor(room).base.price).toBe(182)
    expect(store.currentVersion(room.key)).toMatchObject({ version: 3, note: expect.stringContaining('Reverted') })
  })

  it('a stale apply writes nothing', async () => {
    setRevenueSource(createMockRevenueSource({ speed: 0, scenario: 'stale' }))
    const store = useRevenuePolicy()
    const health = useRevenueHealth()
    const loading = health.load()
    await vi.runAllTimersAsync()
    await loading

    const applying = health.applyFinding('finding-4', 'stale' as never)
    await vi.runAllTimersAsync()
    await applying

    expect(health.applyStateFor('finding-4')).toBe('stale')
    expect(store.currentVersion(MANAGED_ROOM.uluwatu)?.version).toBe(1)
  })
})

describe('the pricing engine reads the room policy', () => {
  it('drift is the gap between the provider and the room policy, and follows a save', async () => {
    const pl = usePriceLabs()
    await pl.connect('Test portfolio', 'pl_live_abc123')
    pl.mapUnit('plu-88214', MANAGED_ROOM.canggu)
    pl.setSyncEnabled('plu-88214', true)
    expect(pl.drift.value).toEqual([expect.objectContaining({ field: 'base', elev8Value: 182, providerValue: 165 })])

    const store = useRevenuePolicy()
    const room = roomByKey.get(MANAGED_ROOM.canggu)!
    const policy = store.policyFor(room)
    store.savePolicy(room.key, { ...policy, base: { ...policy.base, price: 190 } })
    expect(pl.drift.value).toEqual([expect.objectContaining({ field: 'base', elev8Value: 190 })])

    await pl.reconcileUnit('plu-88214')
    expect(pl.drift.value).toHaveLength(0)
    expect(pl.units.value.find(u => u.providerUnitId === 'plu-88214')!.provider.base).toBe(190)
  })

  it('maps provider units to the rooms of the listings', async () => {
    const pl = usePriceLabs()
    expect(pl.rooms.value.map(r => r.id)).toEqual(rooms.map(r => r.key))
  })
})
