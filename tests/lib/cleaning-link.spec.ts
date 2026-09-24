import type { StayLike } from '~/components/cleaning/data/cleaning-link'
import { describe, expect, it } from 'vitest'
import { cleaningDateKey, cleaningFollowsStay, resolveStayForCleaning } from '~/components/cleaning/data/cleaning-link'

function stay(patch: Partial<StayLike> & Pick<StayLike, 'id'>): StayLike {
  return { listingId: 'lst-1', checkIn: '2026-09-10', checkOut: '2026-09-15', status: 'verified', ...patch }
}

function at(day: string, time = '11:00') {
  return { listingId: 'lst-1', scheduledAt: `${day}T${time}:00+08:00` }
}

describe('cleaningDateKey', () => {
  it('reads the property-local day, not the UTC day', () => {
    expect(cleaningDateKey('2026-09-15T07:00:00+08:00')).toBe('2026-09-15')
    // 07:00 in Bali is still the previous day in UTC.
    expect(cleaningDateKey('2026-09-14T23:00:00.000Z')).toBe('2026-09-15')
  })
})

describe('resolveStayForCleaning', () => {
  it('links a cleaning to the guest in the house that day', () => {
    const a = stay({ id: 'a' })
    expect(resolveStayForCleaning(at('2026-09-12'), [a])?.id).toBe('a')
  })

  it('links a turnover day to the guest leaving, not the one arriving', () => {
    const leaving = stay({ id: 'leaving' })
    const arriving = stay({ id: 'arriving', checkIn: '2026-09-15', checkOut: '2026-09-20' })
    expect(resolveStayForCleaning(at('2026-09-15'), [arriving, leaving])?.id).toBe('leaving')
  })

  it('links an arrival day with nobody leaving to the arriving guest', () => {
    const arriving = stay({ id: 'arriving', checkIn: '2026-09-15', checkOut: '2026-09-20' })
    expect(resolveStayForCleaning(at('2026-09-15'), [arriving])?.id).toBe('arriving')
  })

  it('lets one stay own several cleanings', () => {
    const a = stay({ id: 'a' })
    const days = ['2026-09-10', '2026-09-12', '2026-09-13', '2026-09-15']
    expect(days.map(d => resolveStayForCleaning(at(d), [a])?.id)).toEqual(['a', 'a', 'a', 'a'])
  })

  it('leaves a cleaning on a date with no stay unlinked', () => {
    const a = stay({ id: 'a' })
    expect(resolveStayForCleaning(at('2026-09-18'), [a])).toBeNull()
    expect(resolveStayForCleaning(at('2026-09-12'), [])).toBeNull()
  })

  it('only looks at the cleaning\'s own listing', () => {
    const elsewhere = stay({ id: 'x', listingId: 'lst-2' })
    expect(resolveStayForCleaning(at('2026-09-12'), [elsewhere])).toBeNull()
  })

  it('ignores cancellations, maintenance blocks and inquiries, but not an owner stay', () => {
    const day = at('2026-09-12')
    for (const status of ['cancelled', 'blocked', 'inquiry'])
      expect(resolveStayForCleaning(day, [stay({ id: 'x', status })])).toBeNull()
    expect(resolveStayForCleaning(day, [stay({ id: 'owner', status: 'owner_request' })])?.id).toBe('owner')
  })

  it('matches the room when both the cleaning and the stay name one', () => {
    const suite = stay({ id: 'suite', rooms: [{ unitId: 'un-1' }] })
    const pool = stay({ id: 'pool', rooms: [{ unitId: 'un-3' }] })
    expect(resolveStayForCleaning({ ...at('2026-09-12'), unitId: 'un-3' }, [suite, pool])?.id).toBe('pool')
  })

  it('refuses to guess between two stays that fit equally well', () => {
    const suite = stay({ id: 'suite', rooms: [{ unitId: 'un-1' }] })
    const pool = stay({ id: 'pool', rooms: [{ unitId: 'un-3' }] })
    // No room on the cleaning: either guest could be the one.
    expect(resolveStayForCleaning(at('2026-09-12'), [suite, pool])).toBeNull()
  })
})

describe('cleaningFollowsStay', () => {
  it('is false on and before check-in day, true after it', () => {
    const s = { checkIn: '2026-09-10' }
    expect(cleaningFollowsStay(at('2026-09-09'), s)).toBe(false)
    expect(cleaningFollowsStay(at('2026-09-10'), s)).toBe(false)
    expect(cleaningFollowsStay(at('2026-09-11'), s)).toBe(true)
  })
})
