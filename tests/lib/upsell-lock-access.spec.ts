import { describe, expect, it } from 'vitest'
import {
  ACCESS_END_HOUR,
  accessPurposeLabel,
  buildAccessWindow,
  createDefaultLockAccessConfig,
  formatGuestAccessMessage,
  MIN_ACCESS_WINDOW_MS,
  resolveLockTargets,
  serviceGrantsLockAccess,
} from '~/components/upsells/data/lock-access'

const poolGate = { id: 'lock-1', name: 'Pool Gate' }
const frontDoor = { id: 'lock-2', name: 'Front Door' }

function config(lockNames: string[], enabled = true) {
  return { ...createDefaultLockAccessConfig(), enabled, lockNames }
}

describe('resolveLockTargets', () => {
  it('grants nothing when the service is not configured for access', () => {
    expect(resolveLockTargets(undefined, [poolGate])).toEqual({ matched: [], unmatchedNames: [] })
    expect(resolveLockTargets(config(['Pool Gate'], false), [poolGate])).toEqual({ matched: [], unmatchedNames: [] })
  })

  it('matches by name, ignoring case and surrounding space', () => {
    const { matched, unmatchedNames } = resolveLockTargets(config(['  pool GATE ']), [poolGate, frontDoor])
    expect(matched).toEqual([poolGate])
    expect(unmatchedNames).toEqual([])
  })

  it('reports a configured name that no lock at this property answers to', () => {
    const { matched, unmatchedNames } = resolveLockTargets(config(['Pool Gate', 'Wine Cellar']), [poolGate])
    expect(matched).toEqual([poolGate])
    expect(unmatchedNames).toEqual(['Wine Cellar'])
  })

  it('matches every lock sharing the name, and never returns one twice', () => {
    const second = { id: 'lock-3', name: 'pool gate' }
    const { matched } = resolveLockTargets(config(['Pool Gate', 'POOL GATE']), [poolGate, second, frontDoor])
    expect(matched.map(l => l.id)).toEqual(['lock-1', 'lock-3'])
  })

  it('skips blank configured names rather than reporting them as unmatched', () => {
    const { matched, unmatchedNames } = resolveLockTargets(config(['', '   ', 'Pool Gate']), [poolGate])
    expect(matched).toEqual([poolGate])
    expect(unmatchedNames).toEqual([])
  })
})

describe('buildAccessWindow', () => {
  it('runs from payment until noon on the check-out day', () => {
    const now = new Date('2026-06-20T09:00:00')
    const window = buildAccessWindow({ checkOutDate: '2026-06-24' }, now)

    expect(window.startsAt).toBe(now.toISOString())
    expect(window.scheduleType).toBe('range')
    const end = new Date(window.endsAt)
    expect(end.getHours()).toBe(ACCESS_END_HOUR)
    expect(end.getDate()).toBe(24)
  })

  it('outlasts the stay by the minimum window when bought after check-out noon', () => {
    const now = new Date('2026-06-24T15:00:00')
    const window = buildAccessWindow({ checkOutDate: '2026-06-24' }, now)

    expect(new Date(window.endsAt).getTime()).toBe(now.getTime() + MIN_ACCESS_WINDOW_MS)
  })

  it('falls back to 24 hours when the order carries no check-out date', () => {
    const now = new Date('2026-06-20T09:00:00')
    const window = buildAccessWindow({}, now)

    expect(new Date(window.endsAt).getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000)
  })

  it('never ends before it starts', () => {
    const now = new Date('2026-06-24T23:59:00')
    const window = buildAccessWindow({ checkOutDate: '2026-06-01' }, now)

    expect(new Date(window.endsAt).getTime()).toBeGreaterThan(new Date(window.startsAt).getTime())
  })
})

describe('serviceGrantsLockAccess', () => {
  it('is false without a config, when disabled, or with no lock named', () => {
    expect(serviceGrantsLockAccess(undefined)).toBe(false)
    expect(serviceGrantsLockAccess({})).toBe(false)
    expect(serviceGrantsLockAccess({ lockAccess: config(['Pool Gate'], false) })).toBe(false)
    expect(serviceGrantsLockAccess({ lockAccess: config([]) })).toBe(false)
  })

  it('is true once it is enabled and names a lock', () => {
    expect(serviceGrantsLockAccess({ lockAccess: config(['Pool Gate']) })).toBe(true)
  })
})

describe('labels and guest message', () => {
  it('labels the code with the service that bought it', () => {
    expect(accessPurposeLabel({ serviceName: 'Pool & Wellness Area Access' }))
      .toBe('Upsell · Pool & Wellness Area Access')
  })

  it('lists one line per lock and appends the host instructions', () => {
    const message = formatGuestAccessMessage(
      'Thomas Wikes',
      [{ lockName: 'Pool Gate', code: '482915' }, { lockName: 'Office Door', code: '716234' }],
      '2026-06-24T12:00:00.000Z',
      'The gate is left of the pool deck.',
    )

    expect(message).toContain('Hi Thomas Wikes')
    expect(message).toContain('Pool Gate: 482915')
    expect(message).toContain('Office Door: 716234')
    expect(message).toContain('The gate is left of the pool deck.')
  })

  it('omits the instructions block when the host left it blank', () => {
    const message = formatGuestAccessMessage('Thomas', [{ lockName: 'Pool Gate', code: '482915' }], '2026-06-24T12:00:00.000Z', '   ')
    expect(message.trimEnd().endsWith('.')).toBe(true)
    expect(message).not.toContain('  \n')
  })
})
