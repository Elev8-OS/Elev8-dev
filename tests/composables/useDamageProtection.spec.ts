import type { DamageProtection, ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const sendMessageMock = vi.hoisted(() => vi.fn())
const conversationsRef = vi.hoisted(() => ({ value: [] as any[] }))
vi.mock('~/composables/useInbox', () => ({
  useInbox: () => ({ conversations: conversationsRef, sendMessage: sendMessageMock }),
}))

/** The 1.5s gateway mock costs real seconds otherwise. Fake timers BEFORE the call. */
async function settle<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  const pending = run()
  await vi.runAllTimersAsync()
  const result = await pending
  vi.useRealTimers()
  return result
}

/** Relative to today: every charge and refund stage reads the current day. */
function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function seedReservation(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  const { reservations } = useReservationsModule()
  const entry = {
    id: 'res-dp-1',
    guestId: 'guest-dp-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestPhone: '+49 170 1234567',
    guestLanguage: 'en',
    guestNotes: '',
    listingId: 'lst-1',
    listingName: 'Villa Merapi',
    channel: 'Direct',
    checkIn: isoDaysFromNow(5),
    checkOut: isoDaysFromNow(10),
    nights: 5,
    guestCount: 2,
    totalPrice: 1300,
    currency: 'USD',
    status: 'verified',
    activity: [],
    priceDetails: { subtotal: 1000, cleaningFee: 300, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1300, commission: 0, payout: 1300 },
    ...patch,
  } as ReservationEntry
  reservations.value = [entry, ...reservations.value.filter(r => r.id !== entry.id)]
  return entry
}

function protectionOf(id = 'res-dp-1'): DamageProtection {
  const found = useReservationsModule().reservations.value.find(r => r.id === id)?.damageProtection
  if (!found)
    throw new Error('no protection on the reservation')
  return found
}

const ACCEPT_WAIVER = { option: 'waiver' as const, termsAccepted: true }
const ACCEPT_DEPOSIT = { option: 'deposit' as const, termsAccepted: true }

beforeEach(() => {
  const module = useReservationsModule()
  module.reset()
  // The seeded demo stays exist to make every bucket reachable in the UI, so
  // they would otherwise land in portfolio-wide totals here. Each case builds
  // its own world instead.
  module.reservations.value = []
  conversationsRef.value = []
  localStorage.clear()
  vi.clearAllMocks()
})

describe('policy lookup', () => {
  it('returns null for an unassigned listing and the banded policy for an assigned one', () => {
    const dp = useDamageProtection()
    expect(dp.policyFor('lst-9', 5)).toBeNull()
    expect(dp.policyFor('lst-1', 5)?.id).toBe('dp-standard')
  })

  it('picks a different policy per stay-length band on the same listing', () => {
    const dp = useDamageProtection()
    expect(dp.policyFor('lst-1', 7)?.id).toBe('dp-standard')
    expect(dp.policyFor('lst-1', 60)?.id).toBe('dp-long-stay')
    expect(dp.policyFor('lst-1', 400)?.id).toBe('dp-long-stay')
  })

  it('offers the long-stay band the waiver only', () => {
    expect(useDamageProtection().policyFor('lst-1', 60)?.offers).toEqual(['waiver'])
  })
})

describe('isOfferedFor', () => {
  it('offers a Direct guest stay on an assigned listing', () => {
    seedReservation()
    expect(useDamageProtection().isOfferedFor('res-dp-1')).toBe(true)
  })

  it('never offers an owner stay, a block or a cancellation', () => {
    const dp = useDamageProtection()
    for (const status of ['owner_request', 'blocked', 'cancelled'] as const) {
      seedReservation({ status })
      expect(dp.isOfferedFor('res-dp-1')).toBe(false)
    }
  })

  it('stays silent on an unset channel', () => {
    seedReservation({ channel: 'Airbnb' })
    expect(useDamageProtection().isOfferedFor('res-dp-1')).toBe(false)
  })
})

describe('assignBand', () => {
  it('refuses an overlapping band', () => {
    const dp = useDamageProtection()
    expect(dp.assignBand('lst-1', 'dp-standard', 20, null)).toEqual({ ok: false, reason: 'overlapping_band' })
  })

  it('refuses a policy whose currency differs from the payout account', () => {
    const dp = useDamageProtection()
    // lst-3 settles IDR through Doku; dp-standard is USD.
    expect(dp.assignBand('lst-3', 'dp-standard', 1, 27)).toEqual({ ok: false, reason: 'currency_mismatch' })
  })

  it('accepts a non-overlapping band on a currency-matched listing', () => {
    const dp = useDamageProtection()
    dp.removeBand('lst-2', 'dp-deposit-only')
    expect(dp.assignBand('lst-2', 'dp-standard', 1, 27)).toEqual({ ok: true })
  })
})

describe('deletePolicy', () => {
  it('refuses while assigned and succeeds once unassigned', () => {
    const dp = useDamageProtection()
    expect(dp.deletePolicy('dp-standard')).toEqual({ ok: false, reason: 'policy_assigned' })
    dp.removeBand('lst-1', 'dp-standard')
    expect(dp.deletePolicy('dp-standard')).toEqual({ ok: true })
  })
})

describe('recordChoice', () => {
  it('freezes the amount, cap and terms against a later policy edit', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER, 'guest_guide')

    const policy = dp.policies.value.find(p => p.id === 'dp-standard')!
    dp.savePolicy({ ...policy, waiver: { ...policy.waiver, rate: 99, coverageCap: 10 }, termsText: 'Rewritten' })

    const frozen = protectionOf()
    expect(frozen.amount).toBe(39)
    expect(frozen.coverageCap).toBe(2000)
    expect(frozen.termsText).not.toBe('Rewritten')
  })

  it('lands a waiver active with no charge or refund dates', () => {
    seedReservation()
    useDamageProtection().recordChoice('res-dp-1', ACCEPT_WAIVER)
    const p = protectionOf()
    expect(p.state).toBe('waiver_active')
    expect(p.chargeDueAt).toBeUndefined()
    expect(p.refundDueAt).toBeUndefined()
  })

  it('refuses when not offered and when terms are unaccepted', () => {
    seedReservation({ channel: 'Airbnb' })
    expect(useDamageProtection().recordChoice('res-dp-1', ACCEPT_WAIVER)).toEqual({ ok: false, reason: 'not_offered' })
    seedReservation()
    expect(useDamageProtection().recordChoice('res-dp-1', { option: 'waiver', termsAccepted: false }))
      .toEqual({ ok: false, reason: 'invalid_choice' })
  })

  it('writes exactly one activity event', () => {
    seedReservation()
    useDamageProtection().recordChoice('res-dp-1', ACCEPT_WAIVER)
    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-dp-1')!
    expect(reservation.activity).toHaveLength(1)
    expect(reservation.activity[0]!.title).toBe('Damage protection chosen')
  })
})

describe('chargeDeposit', () => {
  it('moves a pending deposit to held and stamps chargedAt', async () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
    await settle(() => dp.chargeDeposit('res-dp-1'))
    const p = protectionOf()
    expect(p.state).toBe('deposit_held')
    expect(p.chargedAt).toBeTruthy()
    expect(p.payoutAccountId).toBe('pay-1')
  })

  it('records a decline, raises the alert, and clears the reason on retry', async () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
    await settle(() => dp.chargeDeposit('res-dp-1', true))

    expect(protectionOf().state).toBe('deposit_failed')
    expect(protectionOf().failedAttempts).toBe(1)
    expect(useNotifications().alerts.value.some(a => a.type === 'DEPOSIT_FAILED_AT_CHECKIN')).toBe(true)

    await settle(() => dp.retryCharge('res-dp-1'))
    expect(protectionOf().state).toBe('deposit_held')
    expect(protectionOf().failureReason).toBeUndefined()
  })

  it('charges once when called twice concurrently', async () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
    await settle(async () => {
      await Promise.all([dp.chargeDeposit('res-dp-1'), dp.chargeDeposit('res-dp-1')])
    })
    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-dp-1')!
    expect(reservation.activity.filter(e => e.title === 'Deposit charged')).toHaveLength(1)
  })

  it('never charges a cancelled stay', async () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
    useReservationsModule().updateReservation('res-dp-1', { status: 'cancelled' })
    await settle(() => dp.chargeDeposit('res-dp-1'))
    expect(protectionOf().state).toBe('deposit_pending')
  })
})

async function heldDeposit() {
  seedReservation()
  const dp = useDamageProtection()
  dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
  await settle(() => dp.chargeDeposit('res-dp-1'))
  return dp
}

const CLAIM = { label: 'Broken lamp', amount: 80, reason: 'Found at checkout', evidenceUrls: ['/mock/lamp.jpg'] }

describe('recordClaim', () => {
  it('records a claim on the waiver path, moves no money, and grows the pot', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    expect(dp.recordClaim('res-dp-1', { ...CLAIM, amount: 300 })).toEqual({ ok: true })

    const p = protectionOf()
    expect(p.state).toBe('waiver_active')
    expect(p.claims).toHaveLength(1)
    expect(p.claims![0]!.coveredAmount).toBe(300)
    expect(dp.waiverPotTotals.value.paidOut).toEqual([{ currency: 'USD', amount: 300 }])
  })

  it('splits a claim beyond the cover and posts nothing to the folio', async () => {
    const dp = await heldDeposit()
    dp.recordClaim('res-dp-1', { ...CLAIM, amount: 800 })
    const claim = protectionOf().claims![0]!
    expect(claim.coveredAmount).toBe(500)
    expect(claim.excessAmount).toBe(300)
    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-dp-1')!
    expect(reservation.folioItems ?? []).toHaveLength(0)
  })

  it('refuses an invalid claim and a cancelled stay', async () => {
    const dp = await heldDeposit()
    expect(dp.recordClaim('res-dp-1', { ...CLAIM, evidenceUrls: [] })).toEqual({ ok: false, reason: 'invalid_claim' })
    useReservationsModule().updateReservation('res-dp-1', { status: 'cancelled' })
    expect(dp.recordClaim('res-dp-1', CLAIM)).toEqual({ ok: false, reason: 'stay_cancelled' })
  })
})

describe('notifyGuestOfClaim and the release gate', () => {
  it('refuses release while a claim is unnotified', async () => {
    const dp = await heldDeposit()
    dp.recordClaim('res-dp-1', CLAIM)
    await expect(dp.releaseDeposit('res-dp-1')).resolves.toEqual({ ok: false, reason: 'claim_not_notified' })
  })

  it('leaves the stamp unset when the reservation has no conversation', async () => {
    const dp = await heldDeposit()
    dp.recordClaim('res-dp-1', CLAIM)
    const claimId = protectionOf().claims![0]!.id
    await expect(dp.notifyGuestOfClaim('res-dp-1', claimId)).resolves.toEqual({ ok: false, reason: 'no_conversation' })
    expect(protectionOf().claims![0]!.guestNotifiedAt).toBeUndefined()
  })

  it('stamps the claim once the guest is messaged, then allows release', async () => {
    const dp = await heldDeposit()
    conversationsRef.value = [{ id: 'conv-dp', reservationId: 'res-dp-1', otaSource: 'Direct' }]
    dp.recordClaim('res-dp-1', CLAIM)
    const claimId = protectionOf().claims![0]!.id

    await expect(dp.notifyGuestOfClaim('res-dp-1', claimId)).resolves.toEqual({ ok: true })
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(protectionOf().claims![0]!.guestNotifiedAt).toBeTruthy()
    await expect(dp.releaseDeposit('res-dp-1')).resolves.toEqual({ ok: true })
  })
})

describe('removeClaim', () => {
  it('succeeds before notification and refuses after it', async () => {
    const dp = await heldDeposit()
    conversationsRef.value = [{ id: 'conv-dp', reservationId: 'res-dp-1', otaSource: 'Direct' }]
    dp.recordClaim('res-dp-1', CLAIM)
    const first = protectionOf().claims![0]!.id
    expect(dp.removeClaim('res-dp-1', first)).toEqual({ ok: true })

    dp.recordClaim('res-dp-1', CLAIM)
    const second = protectionOf().claims![0]!.id
    await dp.notifyGuestOfClaim('res-dp-1', second)
    expect(dp.removeClaim('res-dp-1', second)).toEqual({ ok: false, reason: 'already_notified' })
  })
})

describe('releaseDeposit', () => {
  it('picks the settled state off the arithmetic', async () => {
    const dp = await heldDeposit()
    await dp.releaseDeposit('res-dp-1')
    expect(protectionOf().state).toBe('deposit_released')
    expect(protectionOf().refundedAmount).toBe(500)
  })

  it('lands partial and forfeited from the claim totals', async () => {
    conversationsRef.value = [{ id: 'conv-dp', reservationId: 'res-dp-1', otaSource: 'Direct' }]
    let dp = await heldDeposit()
    dp.recordClaim('res-dp-1', CLAIM)
    await dp.notifyGuestOfClaim('res-dp-1', protectionOf().claims![0]!.id)
    await dp.releaseDeposit('res-dp-1')
    expect(protectionOf().state).toBe('deposit_partial')
    expect(protectionOf().refundedAmount).toBe(420)

    useReservationsModule().reservations.value = []
    dp = await heldDeposit()
    dp.recordClaim('res-dp-1', { ...CLAIM, amount: 500 })
    await dp.notifyGuestOfClaim('res-dp-1', protectionOf().claims![0]!.id)
    await dp.releaseDeposit('res-dp-1')
    expect(protectionOf().state).toBe('deposit_forfeited')
    expect(protectionOf().refundedAmount).toBe(0)
  })

  it('records a failed refund without marking it settled', async () => {
    const dp = await heldDeposit()
    await expect(dp.releaseDeposit('res-dp-1', true)).resolves.toEqual({ ok: false, reason: 'refund_failed' })
    const p = protectionOf()
    expect(p.state).toBe('refund_failed')
    expect(p.refundFailureReason).toBeTruthy()
    expect(p.refundedAt).toBeUndefined()
    expect(useNotifications().alerts.value.some(a => a.type === 'DEPOSIT_REFUND_FAILED')).toBe(true)

    await expect(dp.retryRefund('res-dp-1')).resolves.toEqual({ ok: true })
    expect(protectionOf().state).toBe('deposit_released')
  })

  it('resolves a live refund alert directly', async () => {
    const dp = await heldDeposit()
    useNotifications().createProtectionAlert('DEPOSIT_REFUND_OVERDUE', { reservation_id: 'res-dp-1' })
    await dp.releaseDeposit('res-dp-1')
    const alert = useNotifications().alerts.value.find(a => a.type === 'DEPOSIT_REFUND_OVERDUE')!
    expect(alert.status).toBe('RESOLVED')
  })
})

describe('undoSettlement', () => {
  it('restores deposit_held and keeps the claims', async () => {
    conversationsRef.value = [{ id: 'conv-dp', reservationId: 'res-dp-1', otaSource: 'Direct' }]
    const dp = await heldDeposit()
    dp.recordClaim('res-dp-1', CLAIM)
    await dp.notifyGuestOfClaim('res-dp-1', protectionOf().claims![0]!.id)
    await dp.releaseDeposit('res-dp-1')

    dp.undoSettlement('res-dp-1')
    expect(protectionOf().state).toBe('deposit_held')
    expect(protectionOf().refundedAt).toBeUndefined()
    expect(protectionOf().claims).toHaveLength(1)
  })
})

describe('cancelProtection', () => {
  it('returns a held deposit in full', async () => {
    const dp = await heldDeposit()
    expect(dp.cancelProtection('res-dp-1')).toEqual({ ok: true })
    expect(protectionOf().state).toBe('cancelled_refunded')
    expect(protectionOf().refundedAmount).toBe(500)
  })

  it('returns a waiver fee in full', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    dp.cancelProtection('res-dp-1')
    expect(protectionOf().refundedAmount).toBe(39)
  })

  it('refuses while a claim exists', async () => {
    const dp = await heldDeposit()
    dp.recordClaim('res-dp-1', CLAIM)
    expect(dp.cancelProtection('res-dp-1')).toEqual({ ok: false, reason: 'claims_recorded' })
  })
})

describe('reassessOnExtension', () => {
  it('is a no-op inside one band', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    useReservationsModule().updateReservation('res-dp-1', { nights: 12 })
    dp.reassessOnExtension('res-dp-1', 5)
    expect(useNotifications().alerts.value.some(a => a.type === 'PROTECTION_CHOICE_MISSING')).toBe(false)
  })

  it('re-opens the choice across a band boundary without re-pricing the original', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    const before = { ...protectionOf() }
    useReservationsModule().updateReservation('res-dp-1', { nights: 40 })
    dp.reassessOnExtension('res-dp-1', 5)

    expect(useNotifications().alerts.value.some(a => a.type === 'PROTECTION_CHOICE_MISSING')).toBe(true)
    expect(protectionOf().amount).toBe(before.amount)
    expect(protectionOf().termsText).toBe(before.termsText)
  })
})

describe('the worklist', () => {
  it('produces no row for an unassigned listing, a block or an owner stay', () => {
    seedReservation({ id: 'res-a', listingId: 'lst-9' })
    seedReservation({ id: 'res-b', status: 'blocked' })
    seedReservation({ id: 'res-c', status: 'owner_request' })
    const ids = useDamageProtection().rows.value.map(r => r.reservation.id)
    expect(ids).not.toContain('res-a')
    expect(ids).not.toContain('res-b')
    expect(ids).not.toContain('res-c')
  })

  it('puts a cancelled stay holding money into refund due immediately', async () => {
    const dp = await heldDeposit()
    useReservationsModule().updateReservation('res-dp-1', { status: 'cancelled' })
    expect(dp.refundDue.value.map(r => r.reservation.id)).toContain('res-dp-1')
  })

  it('reports waiver fees collected and claims paid as two figures, never netted', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    dp.recordClaim('res-dp-1', { ...CLAIM, amount: 120 })
    expect(dp.waiverPotTotals.value.collected).toEqual([{ currency: 'USD', amount: 39 }])
    expect(dp.waiverPotTotals.value.paidOut).toEqual([{ currency: 'USD', amount: 120 }])
  })
})

describe('emitProtectionAlerts', () => {
  it('chases a missing choice within 24h of check-in, once', () => {
    seedReservation({ checkIn: isoDaysFromNow(0), checkOut: isoDaysFromNow(4) })
    const dp = useDamageProtection()
    useReservationsModule().updateReservation('res-dp-1', {
      damageProtection: {
        policyId: 'dp-standard',
        option: 'waiver',
        state: 'awaiting_choice',
        amount: 0,
        currency: 'USD',
        termsVersion: 'v1',
        termsText: '',
        acceptedAt: new Date().toISOString(),
        acceptedVia: 'staff',
        claims: [],
      },
    })
    dp.emitProtectionAlerts()
    dp.emitProtectionAlerts()
    const fired = useNotifications().alerts.value.filter(a => a.type === 'PROTECTION_CHOICE_MISSING')
    expect(fired).toHaveLength(1)
  })

  it('never chases a cancelled stay for a missing choice', () => {
    seedReservation({ checkIn: isoDaysFromNow(0), status: 'cancelled' })
    useDamageProtection().emitProtectionAlerts()
    expect(useNotifications().alerts.value.some(a => a.type === 'PROTECTION_CHOICE_MISSING')).toBe(false)
  })
})

describe('what it must never touch', () => {
  it('leaves priceDetails and folioItems alone across a full cycle', async () => {
    conversationsRef.value = [{ id: 'conv-dp', reservationId: 'res-dp-1', otaSource: 'Direct' }]
    const before = seedReservation().priceDetails
    const dp = await heldDeposit()
    dp.recordClaim('res-dp-1', CLAIM)
    await dp.notifyGuestOfClaim('res-dp-1', protectionOf().claims![0]!.id)
    await dp.releaseDeposit('res-dp-1')

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-dp-1')!
    expect(reservation.priceDetails).toEqual(before)
    expect(reservation.folioItems ?? []).toHaveLength(0)
  })
})
