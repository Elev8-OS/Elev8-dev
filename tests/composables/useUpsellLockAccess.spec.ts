import type { UpsellOrder } from '~/components/upsells/data/upsell-orders'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listings } from '~/components/listings/data/listings'
import { useNotifications } from '~/composables/useNotifications'
import { useSmartLock } from '~/composables/useSmartLock'
import { useUpsellLockAccess } from '~/composables/useUpsellLockAccess'
import { useUpsellServices } from '~/composables/useUpsellServices'

const LISTING_NAME = 'The R Villa Merapi'

/** `generateAccessCode` is a 700ms mock; fake the clock BEFORE the call or every test pays it. */
async function settle<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  const pending = run()
  await vi.runAllTimersAsync()
  const result = await pending
  vi.useRealTimers()
  return result
}

function connect() {
  const { connection } = useSmartLock()
  connection.value = {
    id: 'conn-test',
    apiKey: 'seam_test',
    workspaceName: 'Test workspace',
    status: 'connected',
    webhookToken: 'whsec_test',
    webhookUrl: 'https://example.test/hook',
    deviceCount: 10,
    connectedAt: new Date().toISOString(),
    lastSyncAt: null,
  }
}

function listingId() {
  const found = listings.value.find(l => l.name === LISTING_NAME)
  if (!found)
    throw new Error(`Test fixture drifted: no listing named "${LISTING_NAME}"`)
  return found.id
}

/** dev-003 is the Yale "Pool Gate"; dev-008 the Yale "Office Door"; dev-001 the August "Front Door". */
function pair(deviceId: string, name: string) {
  const { pairLock } = useSmartLock()
  const result = pairLock({ providerDeviceId: deviceId, name, assignment: 'property', listingId: listingId() })
  if (!result.success)
    throw new Error(result.error)
  return result.lock!
}

/** Give a service a lock-access config without touching the seeded catalog's meaning. */
function grantAccess(serviceId: string, lockNames: string[], instructions?: string) {
  const { services } = useUpsellServices()
  services.value = services.value.map(s =>
    s.id === serviceId ? { ...s, lockAccess: { enabled: true, lockNames, instructions } } : s,
  )
}

/** Local YYYY-MM-DD. `buildAccessWindow` parses check-out as a local date, so UTC would drift. */
function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isoDay(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return localDay(d)
}

/** Dates are relative to today so the fixture cannot rot into a stay that already ended. */
function makeOrder(overrides: Partial<UpsellOrder> = {}): UpsellOrder {
  const now = new Date().toISOString()
  return {
    id: 'ord-test',
    reservationId: 'res-test',
    guestName: 'Thomas Wikes',
    serviceId: 'svc-011',
    serviceName: 'Pool & Wellness Area Access',
    serviceCategory: 'Activity',
    items: [],
    subtotal: 350000,
    taxAmount: 0,
    serviceAmount: 0,
    grandTotal: 350000,
    currency: 'IDR',
    approvalStatus: 'approved',
    paymentStatus: 'paid',
    fulfillmentStatus: 'in_progress',
    orderDate: isoDay(0),
    serviceDate: isoDay(1),
    checkInDate: isoDay(0),
    checkOutDate: isoDay(4),
    listing: LISTING_NAME,
    channel: 'Direct',
    notes: '',
    source: 'manual',
    createdByStaffId: 'staff-2',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useRealTimers()
})

describe('useUpsellLockAccess: issuing', () => {
  it('issues a code on the lock the purchased service names', async () => {
    connect()
    const lock = pair('dev-003', 'Pool Gate')
    grantAccess('svc-011', ['Pool Gate'])

    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder()))

    expect(result.skipped).toBeUndefined()
    expect(result.issued).toHaveLength(1)
    expect(result.issued[0]!.lockId).toBe(lock.id)
    expect(result.issued[0]!.code).toMatch(/^\d{6}$/)
    expect(result.issued[0]!.reservationId).toBe('res-test')
    expect(result.issued[0]!.purpose).toBe('Upsell · Pool & Wellness Area Access')
    expect(result.codeIds).toEqual([result.issued[0]!.id])
  })

  it('ends the code at check-out, not at the service date', async () => {
    connect()
    pair('dev-003', 'Pool Gate')
    grantAccess('svc-011', ['Pool Gate'])

    const order = makeOrder()
    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(order))

    const end = new Date(result.issued[0]!.endsAt)
    expect(localDay(end)).toBe(order.checkOutDate)
    expect(end.getHours()).toBe(12)
    expect(result.issued[0]!.scheduleType).toBe('range')
  })

  it('issues one code per named lock', async () => {
    connect()
    pair('dev-003', 'Pool Gate')
    pair('dev-008', 'Office Door')
    grantAccess('svc-011', ['Pool Gate', 'Office Door'])

    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder()))

    expect(result.issued).toHaveLength(2)
  })

  it('reuses the guest existing code value across locks of the same brand', async () => {
    connect()
    // dev-003 (Pool Gate) and dev-008 (Office Door) are both Yale.
    pair('dev-003', 'Pool Gate')
    pair('dev-008', 'Office Door')
    grantAccess('svc-011', ['Pool Gate', 'Office Door'])

    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder()))

    expect(new Set(result.issued.map(c => c.code)).size).toBe(1)
  })

  it('gives different brands different codes', async () => {
    connect()
    pair('dev-003', 'Pool Gate') // yale
    pair('dev-001', 'Front Door') // august
    grantAccess('svc-011', ['Pool Gate', 'Front Door'])

    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder()))

    expect(new Set(result.issued.map(c => c.code)).size).toBe(2)
  })

  it('raises a staff notification naming the locks it opened', async () => {
    connect()
    pair('dev-003', 'Pool Gate')
    grantAccess('svc-011', ['Pool Gate'])

    await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder()))

    const alert = useNotifications().alerts.value.find(a => a.type === 'UPSELL_LOCK_ACCESS_ISSUED')
    expect(alert).toBeDefined()
    expect(alert!.context.lockNames).toBe('Pool Gate')
    expect(alert!.context.guestName).toBe('Thomas Wikes')
  })
})

describe('useUpsellLockAccess: refusals', () => {
  it('does nothing for a service that grants no access', async () => {
    connect()
    pair('dev-003', 'Pool Gate')

    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder({ serviceId: 'svc-001' })))

    expect(result.skipped).toBe('no_access_configured')
    expect(result.issued).toEqual([])
  })

  it('refuses when the smart lock integration is not connected', async () => {
    grantAccess('svc-011', ['Pool Gate'])

    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder()))

    expect(result.skipped).toBe('not_connected')
    expect(useNotifications().alerts.value.some(a => a.type === 'UPSELL_LOCK_ACCESS_FAILED')).toBe(true)
  })

  it('refuses when the order names a listing that does not exist', async () => {
    connect()
    grantAccess('svc-011', ['Pool Gate'])

    const result = await settle(() =>
      useUpsellLockAccess().issueAccessForOrder(makeOrder({ listing: 'A villa that was delisted' })),
    )

    expect(result.skipped).toBe('listing_not_found')
  })

  it('warns staff rather than failing silently when no lock at the property carries the name', async () => {
    connect()
    pair('dev-001', 'Front Door')
    grantAccess('svc-011', ['Pool Gate'])

    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder()))

    expect(result.skipped).toBe('no_lock_matched')
    expect(result.unmatchedNames).toEqual(['Pool Gate'])
    const alert = useNotifications().alerts.value.find(a => a.type === 'UPSELL_LOCK_ACCESS_FAILED')
    expect(alert!.context.reason).toContain('Pool Gate')
  })

  it('issues what it can and still flags the lock it could not find', async () => {
    connect()
    pair('dev-003', 'Pool Gate')
    grantAccess('svc-011', ['Pool Gate', 'Wine Cellar'])

    const result = await settle(() => useUpsellLockAccess().issueAccessForOrder(makeOrder()))

    expect(result.issued).toHaveLength(1)
    expect(result.unmatchedNames).toEqual(['Wine Cellar'])
    expect(useNotifications().alerts.value.some(a => a.type === 'UPSELL_LOCK_ACCESS_FAILED')).toBe(true)
  })

  it('does not issue twice for the same order', async () => {
    connect()
    pair('dev-003', 'Pool Gate')
    grantAccess('svc-011', ['Pool Gate'])
    const access = useUpsellLockAccess()

    const first = await settle(() => access.issueAccessForOrder(makeOrder()))
    const order = makeOrder({ issuedAccessCodeIds: first.codeIds })
    const second = await settle(() => access.issueAccessForOrder(order))

    expect(second.skipped).toBe('already_issued')
    expect(useSmartLock().codes.value).toHaveLength(1)
  })
})

describe('useUpsellLockAccess: revoking and reading back', () => {
  it('revokes every code the order handed out', async () => {
    connect()
    pair('dev-003', 'Pool Gate')
    grantAccess('svc-011', ['Pool Gate'])
    const access = useUpsellLockAccess()

    const issued = await settle(() => access.issueAccessForOrder(makeOrder()))
    const order = makeOrder({ issuedAccessCodeIds: issued.codeIds })

    expect(access.revokeAccessForOrder(order)).toBe(1)
    expect(useSmartLock().codes.value[0]!.status).toBe('revoked')
    expect(access.hasLiveAccess(order)).toBe(false)
  })

  it('reads the codes back live, so a revoke elsewhere is reflected', async () => {
    connect()
    pair('dev-003', 'Pool Gate')
    grantAccess('svc-011', ['Pool Gate'])
    const access = useUpsellLockAccess()

    const issued = await settle(() => access.issueAccessForOrder(makeOrder()))
    const order = makeOrder({ issuedAccessCodeIds: issued.codeIds })
    expect(access.issuedCodesFor(order)).toHaveLength(1)

    useSmartLock().revokeAccessCode(issued.codeIds[0]!)
    expect(access.issuedCodesFor(order)).toHaveLength(1)
    expect(access.hasLiveAccess(order)).toBe(false)
  })

  it('resolves the targets a not-yet-paid order would get, so the drawer can say so upfront', () => {
    connect()
    const lock = pair('dev-003', 'Pool Gate')
    grantAccess('svc-011', ['Pool Gate', 'Wine Cellar'])

    const targets = useUpsellLockAccess().resolveTargetsForOrder(makeOrder({ paymentStatus: 'unpaid' }))

    expect(targets.matched.map(l => l.id)).toEqual([lock.id])
    expect(targets.unmatchedNames).toEqual(['Wine Cellar'])
  })
})

describe('catalog filter: grants lock access', () => {
  it('defaults to showing every service', () => {
    const { services, filteredServices, filterLockAccess } = useUpsellServices()
    expect(filterLockAccess.value).toBe('all')
    expect(filteredServices.value).toHaveLength(services.value.length)
  })

  it('narrows to the services that hand out a code', () => {
    const { filteredServices, filterLockAccess } = useUpsellServices()
    filterLockAccess.value = 'lock'

    const names = filteredServices.value.map(s => s.name)
    expect(names).toContain('Pool & Wellness Area Access')
    expect(names).toContain('Private Workspace Access')
    expect(names).not.toContain('Airport Transfer (Ngurah Rai)')
  })

  it('excludes them the other way round', () => {
    const { filteredServices, filterLockAccess } = useUpsellServices()
    filterLockAccess.value = 'no_lock'

    const names = filteredServices.value.map(s => s.name)
    expect(names).not.toContain('Pool & Wellness Area Access')
    expect(names).toContain('Airport Transfer (Ngurah Rai)')
  })

  it('treats an enabled config with no lock named as granting nothing', () => {
    const { services, filteredServices, filterLockAccess } = useUpsellServices()
    services.value = services.value.map(s =>
      s.id === 'svc-011' ? { ...s, lockAccess: { enabled: true, lockNames: [] } } : s,
    )
    filterLockAccess.value = 'lock'

    expect(filteredServices.value.map(s => s.name)).not.toContain('Pool & Wellness Area Access')
  })

  it('clearFilters resets it', () => {
    const { services, filteredServices, filterLockAccess, clearFilters } = useUpsellServices()
    filterLockAccess.value = 'lock'
    clearFilters()

    expect(filterLockAccess.value).toBe('all')
    expect(filteredServices.value).toHaveLength(services.value.length)
  })
})
