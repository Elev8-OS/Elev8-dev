import type { DamageProtection, ReservationEntry, SavedCard } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listingSlots, policyFromTemplate } from '~/components/reservations/data/damage-protection'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTernActivation } from '~/composables/useTernActivation'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const sendMessageMock = vi.hoisted(() => vi.fn())
const conversationsRef = vi.hoisted(() => ({ value: [] as any[] }))
// The real `ensureConversationForReservation` is covered in its own spec; this
// stand-in keeps its contract: the reservation's thread, else a new email one,
// else null when the guest has no email address.
vi.mock('~/composables/useInbox', () => ({
  useInbox: () => ({
    conversations: conversationsRef,
    sendMessage: sendMessageMock,
    ensureConversationForReservation: (stay: { id: string, guestEmail?: string }) => {
      const found = conversationsRef.value.find(c => c.reservationId === stay.id)
      if (found)
        return found.id
      if (!stay.guestEmail)
        return null
      const created = { id: `conv-res-${stay.id}`, reservationId: stay.id, otaSource: 'Email' }
      conversationsRef.value = [...conversationsRef.value, created]
      return created.id
    },
  }),
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

/** Relative to today: the decision deadline reads the current day. */
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

const CARD: SavedCard = {
  provider: 'stripe',
  paymentMethodId: 'pm_mock_4242',
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: 2028,
  savedAt: '2026-09-01T00:00:00.000Z',
}

const ACCEPT_WAIVER = { option: 'waiver' as const, termsAccepted: true }
const ACCEPT_DEPOSIT = { option: 'deposit' as const, termsAccepted: true, card: CARD, chargeConsent: true }

const CARD_INPUT = {
  number: '4242 4242 4242 4242',
  expiry: `12/${String((new Date().getFullYear() + 2) % 100).padStart(2, '0')}`,
  cvc: '123',
}

function reservationOf(id = 'res-dp-1'): ReservationEntry {
  return useReservationsModule().reservations.value.find(r => r.id === id)!
}

function withConversation() {
  conversationsRef.value = [{ id: 'conv-dp', reservationId: 'res-dp-1', otaSource: 'Direct' }]
}

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

describe('isOfferedFor and optionsFor', () => {
  it('offers a Direct guest stay on an assigned listing, waiver first', () => {
    seedReservation()
    const dp = useDamageProtection()
    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
    expect(dp.optionsFor('res-dp-1').map(o => [o.option, o.isDefault])).toEqual([['waiver', true], ['deposit', false]])
  })

  it('never offers an owner stay, a block or a cancellation', () => {
    const dp = useDamageProtection()
    for (const status of ['owner_request', 'blocked', 'cancelled'] as const) {
      seedReservation({ status })
      expect(dp.isOfferedFor('res-dp-1')).toBe(false)
    }
  })

  it('asks an OTA guest too once the waiver is on: the cover cannot skip a channel', () => {
    seedReservation({ channel: 'Airbnb' })
    const dp = useDamageProtection()
    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
    // The deposit rides along on every channel beside the waiver.
    expect(dp.optionsFor('res-dp-1').map(o => o.option)).toEqual(['waiver', 'deposit'])
  })

  it('keeps a deposit-only policy silent on a channel it did not pick', () => {
    // lst-2's short stays are deposit-only, Direct only.
    seedReservation({ listingId: 'lst-2', channel: 'Airbnb' })
    expect(useDamageProtection().isOfferedFor('res-dp-1')).toBe(false)
    seedReservation({ listingId: 'lst-2', channel: 'Direct' })
    expect(useDamageProtection().isOfferedFor('res-dp-1')).toBe(true)
  })

  it('never protects an owner stay: owners pay nothing', () => {
    seedReservation({ status: 'owner_request' })
    expect(useDamageProtection().isOfferedFor('res-dp-1')).toBe(false)
  })

  it('offers the waiver only where a card cannot be saved, and nothing when the deposit was all there was', () => {
    const saved = payoutAccounts.value
    // Take lst-1 and lst-2 off Stripe: no card can be saved there any more.
    payoutAccounts.value = saved.map(a => ({ ...a, listingIds: a.listingIds.filter(id => id !== 'lst-1' && id !== 'lst-2') }))
    try {
      const dp = useDamageProtection()
      seedReservation()
      expect(dp.railForListing('lst-1')).toBe('non_card')
      expect(dp.optionsFor('res-dp-1').map(o => o.option)).toEqual(['waiver'])
      seedReservation({ id: 'res-dp-2', listingId: 'lst-2' })
      expect(dp.isOfferedFor('res-dp-2')).toBe(false)
    }
    finally {
      payoutAccounts.value = saved
    }
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

function listingSlotsOf(dp: ReturnType<typeof useDamageProtection>, listingId: string) {
  return listingSlots(dp.assignments.value, listingId)
}

describe('setListingSlot', () => {
  it('sets, changes and clears one slot without touching the other', () => {
    const dp = useDamageProtection()
    expect(dp.setListingSlot('lst-2', 'short', 'dp-standard')).toEqual({ ok: true })
    const bands = () => dp.assignments.value.filter(a => a.listingId === 'lst-2').map(a => [a.policyId, a.minNights, a.maxNights])
    expect(bands()).toEqual([['dp-long-stay', 28, null], ['dp-standard', 1, 27]])
    dp.setListingSlot('lst-2', 'short', null)
    expect(bands()).toEqual([['dp-long-stay', 28, null]])
  })

  it('uses one policy for both slots without one removal taking both', () => {
    const dp = useDamageProtection()
    dp.setListingSlot('lst-2', 'short', 'dp-long-stay')
    dp.setListingSlot('lst-2', 'short', null)
    expect(dp.assignments.value.filter(a => a.listingId === 'lst-2').map(a => a.minNights)).toEqual([28])
  })

  it('refuses a policy in another currency and leaves the listing as it was', () => {
    const dp = useDamageProtection()
    const before = [...dp.assignments.value]
    // lst-3 settles IDR; every seeded policy is USD.
    expect(dp.setListingSlot('lst-3', 'short', 'dp-standard')).toEqual({ ok: false, reason: 'currency_mismatch' })
    expect(dp.assignments.value).toEqual(before)
  })

  it('sets many listings at once and reports the ones it skipped, and why', () => {
    const dp = useDamageProtection()
    dp.assignBand('lst-6', 'dp-standard', 1, 7)
    const { applied, skipped } = dp.setSlotsForListings(['lst-2', 'lst-3', 'lst-6', 'lst-18'], { short: 'dp-standard' })
    expect(applied).toEqual(['lst-2', 'lst-18'])
    expect(skipped).toEqual([
      { listingId: 'lst-3', reason: 'currency_mismatch' },
      { listingId: 'lst-6', reason: 'custom_ranges' },
    ])
    expect(listingSlotsOf(dp, 'lst-18')).toEqual({ short: 'dp-standard', long: 'dp-long-stay', custom: false })
  })

  it('leaves a slot marked undefined untouched and clears one marked null', () => {
    const dp = useDamageProtection()
    dp.setSlotsForListings(['lst-1'], { long: null })
    expect(listingSlotsOf(dp, 'lst-1')).toEqual({ short: 'dp-standard', long: null, custom: false })
  })

  it('never leaves a listing half-changed when one of its two slots is refused', () => {
    const dp = useDamageProtection()
    const before = [...dp.assignments.value]
    // Clearing short would succeed, the USD long-stay policy on an IDR listing cannot.
    const { applied, skipped } = dp.setSlotsForListings(['lst-3'], { short: null, long: 'dp-long-stay' })
    expect(applied).toEqual([])
    expect(skipped).toEqual([{ listingId: 'lst-3', reason: 'currency_mismatch' }])
    expect(dp.assignments.value).toEqual(before)
  })

  it('clears custom night ranges on request', () => {
    const dp = useDamageProtection()
    dp.resetListingBands('lst-1')
    expect(dp.assignments.value.some(a => a.listingId === 'lst-1')).toBe(false)
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

describe('saveCard', () => {
  it('keeps a reference and the last four digits, never the number or the code', async () => {
    const result = await settle(() => useDamageProtection().saveCard(CARD_INPUT))
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.card).toMatchObject({ provider: 'stripe', brand: 'visa', last4: '4242' })
    expect(result.card.paymentMethodId).toMatch(/^pm_/)
    expect(JSON.stringify(result.card)).not.toContain('42424242')
    expect(JSON.stringify(result.card)).not.toContain('"123"')
  })

  it('refuses a card that fails its own checks, without calling the gateway', async () => {
    const result = await useDamageProtection().saveCard({ ...CARD_INPUT, number: '4242 4242 4242 4241' })
    expect(result).toEqual({ ok: false, reason: 'Check the card number.' })
  })

  it('reports a decline from the gateway', async () => {
    const result = await settle(() => useDamageProtection().saveCard(CARD_INPUT, true))
    expect(result.ok).toBe(false)
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

  it('lands a waiver active, with no card and no deadline', () => {
    seedReservation()
    useDamageProtection().recordChoice('res-dp-1', ACCEPT_WAIVER)
    const p = protectionOf()
    expect(p.state).toBe('waiver_active')
    expect(p.card).toBeUndefined()
    expect(p.settleDueAt).toBeUndefined()
  })

  it('keeps a deposit\'s card on file, charges nothing, and freezes the consent the guest gave', () => {
    seedReservation()
    useDamageProtection().recordChoice('res-dp-1', ACCEPT_DEPOSIT)
    const p = protectionOf()
    expect(p.state).toBe('card_on_file')
    expect(p.amount).toBe(500)
    expect(p.card).toEqual(CARD)
    expect(p.chargeMandate).toContain('up to USD 500.00')
    expect(p.payoutAccountId).toBe('pay-1')
    expect(p.chargedAt).toBeUndefined()
    // Seven days after check-out.
    expect(new Date(p.settleDueAt!).getDate()).toBe(new Date(`${isoDaysFromNow(17)}T00:00:00`).getDate())
  })

  it('refuses a deposit without a saved card or without consent to a later charge', () => {
    seedReservation()
    const dp = useDamageProtection()
    expect(dp.recordChoice('res-dp-1', { ...ACCEPT_DEPOSIT, card: undefined })).toEqual({ ok: false, reason: 'invalid_choice' })
    expect(dp.recordChoice('res-dp-1', { ...ACCEPT_DEPOSIT, chargeConsent: false })).toEqual({ ok: false, reason: 'invalid_choice' })
  })

  it('stores a copy of the card, not the caller\'s object', () => {
    seedReservation()
    const card = { ...CARD }
    useDamageProtection().recordChoice('res-dp-1', { ...ACCEPT_DEPOSIT, card })
    card.last4 = '0000'
    expect(protectionOf().card!.last4).toBe('4242')
  })

  it('refuses when not offered and when terms are unaccepted', () => {
    seedReservation({ listingId: 'lst-2', channel: 'Airbnb' })
    expect(useDamageProtection().recordChoice('res-dp-1', ACCEPT_WAIVER)).toEqual({ ok: false, reason: 'not_offered' })
    seedReservation()
    expect(useDamageProtection().recordChoice('res-dp-1', { option: 'waiver', termsAccepted: false }))
      .toEqual({ ok: false, reason: 'invalid_choice' })
  })

  it('writes exactly one activity event', () => {
    seedReservation()
    useDamageProtection().recordChoice('res-dp-1', ACCEPT_WAIVER)
    const reservation = reservationOf()
    expect(reservation.activity).toHaveLength(1)
    expect(reservation.activity[0]!.title).toBe('Damage protection chosen')
  })
})

function cardOnFile() {
  seedReservation()
  const dp = useDamageProtection()
  dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
  return dp
}

const CLAIM = { label: 'Broken lamp', amount: 80, reason: 'Found at checkout', evidenceUrls: ['/mock/lamp.jpg'] }

async function notifiedClaim(dp: ReturnType<typeof useDamageProtection>, draft = CLAIM) {
  withConversation()
  dp.recordClaim('res-dp-1', draft)
  const claims = protectionOf().claims!
  await dp.notifyGuestOfClaim('res-dp-1', claims[claims.length - 1]!.id)
}

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

  it('splits a claim beyond what the card may be charged, and posts nothing to the folio', () => {
    const dp = cardOnFile()
    dp.recordClaim('res-dp-1', { ...CLAIM, amount: 800 })
    const claim = protectionOf().claims![0]!
    expect(claim.coveredAmount).toBe(500)
    expect(claim.excessAmount).toBe(300)
    expect(reservationOf().folioItems ?? []).toHaveLength(0)
  })

  it('refuses an invalid claim and a cancelled stay', () => {
    const dp = cardOnFile()
    expect(dp.recordClaim('res-dp-1', { ...CLAIM, evidenceUrls: [] })).toEqual({ ok: false, reason: 'invalid_claim' })
    useReservationsModule().updateReservation('res-dp-1', { status: 'cancelled' })
    expect(dp.recordClaim('res-dp-1', CLAIM)).toEqual({ ok: false, reason: 'stay_cancelled' })
  })
})

const CLEANING_REPORT = {
  cleaningJobId: 'cln-x',
  findingId: 'cln-x:problem:b-1',
  finding: 'Cracked shower screen',
  checklistItem: 'Clean shower',
  photoUrls: ['/p/screen.jpg'],
  cleaningLabel: 'Check-out cleaning',
  reportedBy: 'Made Surya',
  reportedAt: '2026-09-20T05:30:00.000Z',
}

describe('recordClaim from a cleaning report', () => {
  it('accepts the cleaning report as the only evidence', () => {
    const dp = cardOnFile()
    expect(dp.recordClaim('res-dp-1', { ...CLAIM, evidenceUrls: [], cleaningReport: CLEANING_REPORT })).toEqual({ ok: true })
    expect(protectionOf().claims![0]!.cleaningReport).toEqual(CLEANING_REPORT)
  })

  it('stores a copy, so a later edit to the caller object cannot rewrite the claim', () => {
    const dp = cardOnFile()
    const report = { ...CLEANING_REPORT }
    dp.recordClaim('res-dp-1', { ...CLAIM, cleaningReport: report })
    report.finding = 'Edited afterwards'
    expect(protectionOf().claims![0]!.cleaningReport!.finding).toBe('Cracked shower screen')
  })

  it('refuses a second claim on the same finding, but not on a different one', () => {
    const dp = cardOnFile()
    dp.recordClaim('res-dp-1', { ...CLAIM, cleaningReport: CLEANING_REPORT })
    expect(dp.recordClaim('res-dp-1', { ...CLAIM, cleaningReport: CLEANING_REPORT }))
      .toEqual({ ok: false, reason: 'finding_already_claimed' })
    expect(dp.recordClaim('res-dp-1', { ...CLAIM, cleaningReport: { ...CLEANING_REPORT, findingId: 'cln-x:problem:b-2' } }))
      .toEqual({ ok: true })
    // A manual claim never collides with a cleaning finding.
    expect(dp.recordClaim('res-dp-1', CLAIM)).toEqual({ ok: true })
    expect(protectionOf().claims).toHaveLength(3)
  })

  it('names the cleaning report as evidence in the guest notice', async () => {
    const dp = cardOnFile()
    withConversation()
    dp.recordClaim('res-dp-1', { ...CLAIM, cleaningReport: CLEANING_REPORT })
    await dp.notifyGuestOfClaim('res-dp-1', protectionOf().claims![0]!.id)
    const body = sendMessageMock.mock.calls[0]![1] as string
    expect(body).toMatch(/Evidence: check-out cleaning report of \d{1,2} Sept? 2026 with 1 photo, 1 file\./)
  })
})

describe('notifyGuestOfClaim and the settle gate', () => {
  it('tells the guest which saved card will be charged, and how much', async () => {
    const dp = cardOnFile()
    await notifiedClaim(dp)
    const body = sendMessageMock.mock.calls[0]![1] as string
    expect(body).toContain('USD 80.00 will be charged to the card you saved (Visa •••• 4242, expires 12/28).')
  })

  it('refuses to charge while a claim is unnotified', async () => {
    const dp = cardOnFile()
    dp.recordClaim('res-dp-1', CLAIM)
    await expect(dp.settleDeposit('res-dp-1')).resolves.toEqual({ ok: false, reason: 'claim_not_notified' })
    expect(protectionOf().state).toBe('card_on_file')
  })

  it('reaches a guest with no conversation by email, rather than leaving them untold', async () => {
    const dp = cardOnFile()
    dp.recordClaim('res-dp-1', CLAIM)
    const claimId = protectionOf().claims![0]!.id
    await expect(dp.notifyGuestOfClaim('res-dp-1', claimId)).resolves.toEqual({ ok: true })
    expect(sendMessageMock).toHaveBeenCalledWith('conv-res-res-dp-1', expect.stringContaining('Broken lamp'), 'Email')
    expect(protectionOf().claims![0]!.guestNotifiedAt).toBeTruthy()
  })

  it('leaves the stamp unset when the guest has no conversation and no email address', async () => {
    seedReservation({ guestEmail: '' })
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
    dp.recordClaim('res-dp-1', CLAIM)
    const claimId = protectionOf().claims![0]!.id
    await expect(dp.notifyGuestOfClaim('res-dp-1', claimId)).resolves.toEqual({ ok: false, reason: 'no_contact' })
    expect(protectionOf().claims![0]!.guestNotifiedAt).toBeUndefined()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('uses the reservation\'s own thread when it has one', async () => {
    const dp = cardOnFile()
    await notifiedClaim(dp)
    expect(sendMessageMock).toHaveBeenCalledWith('conv-dp', expect.any(String), 'Direct')
  })
})

describe('removeClaim', () => {
  it('succeeds before notification and refuses after it', async () => {
    const dp = cardOnFile()
    withConversation()
    dp.recordClaim('res-dp-1', CLAIM)
    const first = protectionOf().claims![0]!.id
    expect(dp.removeClaim('res-dp-1', first)).toEqual({ ok: true })

    dp.recordClaim('res-dp-1', CLAIM)
    const second = protectionOf().claims![0]!.id
    await dp.notifyGuestOfClaim('res-dp-1', second)
    expect(dp.removeClaim('res-dp-1', second)).toEqual({ ok: false, reason: 'already_notified' })
  })
})

describe('settleDeposit', () => {
  it('closes a deposit with no claims without charging anything', async () => {
    const dp = cardOnFile()
    await expect(dp.settleDeposit('res-dp-1')).resolves.toEqual({ ok: true })
    const p = protectionOf()
    expect(p.state).toBe('deposit_released')
    expect(p.releasedAt).toBeTruthy()
    expect(p.chargedAt).toBeUndefined()
    expect(reservationOf().activity.some(e => e.title === 'Saved card charged')).toBe(false)
  })

  it('charges the covered claims to the saved card, once, for the total', async () => {
    const dp = cardOnFile()
    await notifiedClaim(dp)
    await notifiedClaim(dp, { ...CLAIM, label: 'Scratched table', amount: 120 })
    await expect(settle(() => dp.settleDeposit('res-dp-1'))).resolves.toEqual({ ok: true })
    const p = protectionOf()
    expect(p.state).toBe('deposit_charged')
    expect(p.chargedAmount).toBe(200)
    expect(p.chargedAt).toBeTruthy()
    expect(reservationOf().activity.filter(e => e.title === 'Saved card charged')).toHaveLength(1)
  })

  it('never charges more than the guest agreed to, and leaves the excess to the folio', async () => {
    const dp = cardOnFile()
    await notifiedClaim(dp, { ...CLAIM, amount: 800 })
    await settle(() => dp.settleDeposit('res-dp-1'))
    expect(protectionOf().chargedAmount).toBe(500)
    expect(reservationOf().folioItems ?? []).toHaveLength(0)
  })

  it('records a declined charge, raises the alert, and charges on retry', async () => {
    const dp = cardOnFile()
    await notifiedClaim(dp)
    await expect(settle(() => dp.settleDeposit('res-dp-1', true))).resolves.toEqual({ ok: false, reason: 'charge_declined' })
    expect(protectionOf().state).toBe('charge_failed')
    expect(protectionOf().chargeAttempts).toBe(1)
    expect(useNotifications().alerts.value.some(a => a.type === 'DEPOSIT_CHARGE_FAILED')).toBe(true)

    await settle(() => dp.retryCharge('res-dp-1'))
    expect(protectionOf().state).toBe('deposit_charged')
    expect(protectionOf().chargeFailureReason).toBeUndefined()
    expect(protectionOf().chargeAttempts).toBe(2)
    expect(useNotifications().alerts.value.find(a => a.type === 'DEPOSIT_CHARGE_FAILED')!.status).toBe('RESOLVED')
  })

  it('charges once when called twice concurrently', async () => {
    const dp = cardOnFile()
    await notifiedClaim(dp)
    await settle(async () => {
      await Promise.all([dp.settleDeposit('res-dp-1'), dp.settleDeposit('res-dp-1')])
    })
    expect(reservationOf().activity.filter(e => e.title === 'Saved card charged')).toHaveLength(1)
  })

  it('resolves the live decision alerts directly', async () => {
    const dp = cardOnFile()
    useNotifications().createProtectionAlert('DEPOSIT_DECISION_OVERDUE', { reservation_id: 'res-dp-1' })
    await dp.settleDeposit('res-dp-1')
    expect(useNotifications().alerts.value.find(a => a.type === 'DEPOSIT_DECISION_OVERDUE')!.status).toBe('RESOLVED')
  })
})

describe('undoSettlement', () => {
  it('reopens a deposit closed without a charge and keeps the claims', async () => {
    const dp = cardOnFile()
    await dp.settleDeposit('res-dp-1')
    expect(dp.undoSettlement('res-dp-1')).toEqual({ ok: true })
    expect(protectionOf().state).toBe('card_on_file')
    expect(protectionOf().releasedAt).toBeUndefined()
  })

  it('refuses to undo a charge: money moved, and returning it is a refund', async () => {
    const dp = cardOnFile()
    await notifiedClaim(dp)
    await settle(() => dp.settleDeposit('res-dp-1'))
    expect(dp.undoSettlement('res-dp-1')).toEqual({ ok: false, reason: 'charge_cannot_be_undone' })
    expect(protectionOf().state).toBe('deposit_charged')
  })
})

describe('cancelProtection', () => {
  it('releases a saved card and charges nothing', () => {
    const dp = cardOnFile()
    expect(dp.cancelProtection('res-dp-1')).toEqual({ ok: true })
    const p = protectionOf()
    expect(p.state).toBe('cancelled')
    expect(p.releasedAt).toBeTruthy()
    expect(p.refundedAmount).toBeUndefined()
    expect(p.chargedAt).toBeUndefined()
  })

  it('returns a waiver fee in full', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    dp.cancelProtection('res-dp-1')
    expect(protectionOf().refundedAmount).toBe(39)
  })

  it('refuses while a claim exists', () => {
    const dp = cardOnFile()
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

  it('leaves a saved card on file until check-out, then asks for a decision', () => {
    const dp = cardOnFile()
    expect(dp.onFile.value.map(r => r.reservation.id)).toEqual(['res-dp-1'])
    useReservationsModule().updateReservation('res-dp-1', { checkIn: isoDaysFromNow(-5), checkOut: isoDaysFromNow(-1), status: 'checked_out' })
    expect(dp.decisionDue.value.map(r => r.reservation.id)).toEqual(['res-dp-1'])
  })

  it('flags a decision overdue past the promised date', () => {
    const dp = cardOnFile()
    useReservationsModule().updateReservation('res-dp-1', {
      checkIn: isoDaysFromNow(-20),
      checkOut: isoDaysFromNow(-14),
      status: 'checked_out',
      damageProtection: { ...protectionOf(), settleDueAt: new Date(Date.now() - 86400000).toISOString() },
    })
    expect(dp.decisionOverdue.value.map(r => r.reservation.id)).toEqual(['res-dp-1'])
  })

  it('asks for a cancelled stay\'s card to be released straight away', () => {
    const dp = cardOnFile()
    useReservationsModule().updateReservation('res-dp-1', { status: 'cancelled' })
    expect(dp.decisionDue.value.map(r => r.reservation.id)).toContain('res-dp-1')
  })

  it('sums the cover on saved cards and the claims to charge, per currency', () => {
    const dp = cardOnFile()
    dp.recordClaim('res-dp-1', CLAIM)
    useReservationsModule().updateReservation('res-dp-1', { checkIn: isoDaysFromNow(-5), checkOut: isoDaysFromNow(-1), status: 'checked_out' })
    expect(dp.coverOnFileTotals.value).toEqual([{ currency: 'USD', amount: 420 }])
    expect(dp.chargeableTotals.value).toEqual([{ currency: 'USD', amount: 80 }])
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

  it('asks for a decision after check-out, once, and escalates when it is overdue', () => {
    const dp = cardOnFile()
    useReservationsModule().updateReservation('res-dp-1', { checkIn: isoDaysFromNow(-5), checkOut: isoDaysFromNow(-1), status: 'checked_out' })
    dp.emitProtectionAlerts()
    dp.emitProtectionAlerts()
    expect(useNotifications().alerts.value.filter(a => a.type === 'DEPOSIT_DECISION_DUE')).toHaveLength(1)

    useReservationsModule().updateReservation('res-dp-1', {
      damageProtection: { ...protectionOf(), settleDueAt: new Date(Date.now() - 86400000).toISOString() },
    })
    dp.emitProtectionAlerts()
    const overdue = useNotifications().alerts.value.find(a => a.type === 'DEPOSIT_DECISION_OVERDUE')!
    expect(overdue.severity).toBe('CRITICAL')
  })

  it('never chases a cancelled stay for a missing choice', () => {
    seedReservation({ checkIn: isoDaysFromNow(0), status: 'cancelled' })
    useDamageProtection().emitProtectionAlerts()
    expect(useNotifications().alerts.value.some(a => a.type === 'PROTECTION_CHOICE_MISSING')).toBe(false)
  })
})

describe('host-paid listings', () => {
  it('never asks the guest and covers the stay at no cost to them', () => {
    seedReservation()
    const dp = useDamageProtection()
    expect(dp.setListingMode('lst-1', 'host_paid')).toEqual({ ok: true })
    expect(dp.listingMode('lst-1')).toBe('host_paid')
    expect(dp.isOfferedFor('res-dp-1')).toBe(false)
    expect(dp.optionsFor('res-dp-1')).toEqual([])
    expect(protectionOf()).toMatchObject({
      option: 'waiver',
      state: 'waiver_active',
      amount: 0,
      paidBy: 'host',
      tier: 'bronze',
      elev8Fee: 9,
      coverageCap: 2000,
      acceptedVia: 'host_cover',
    })
    expect(reservationOf().activity.map(a => a.title)).toEqual(['Covered by the host'])
  })

  it('covers OTA bookings too, but never an owner stay or a stay already over', () => {
    seedReservation({ id: 'res-ota', channel: 'Booking.com' })
    seedReservation({ id: 'res-owner', status: 'owner_request' })
    seedReservation({ id: 'res-past', status: 'checked_out', checkIn: isoDaysFromNow(-10), checkOut: isoDaysFromNow(-5) })
    useDamageProtection().setListingMode('lst-1', 'host_paid')
    expect(reservationOf('res-ota').damageProtection?.paidBy).toBe('host')
    expect(reservationOf('res-owner').damageProtection).toBeUndefined()
    expect(reservationOf('res-past').damageProtection).toBeUndefined()
  })

  it('replaces an unanswered choice but leaves a guest\'s accepted choice alone', () => {
    seedReservation({ id: 'res-asked', damageProtection: {
      policyId: 'dp-standard',
      option: 'waiver',
      state: 'awaiting_choice',
      amount: 0,
      currency: 'USD',
      termsVersion: 'v1',
      termsText: 'Terms',
      acceptedAt: new Date().toISOString(),
      acceptedVia: 'staff',
    } })
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    dp.setListingMode('lst-1', 'host_paid')
    expect(reservationOf('res-asked').damageProtection?.paidBy).toBe('host')
    expect(protectionOf()).toMatchObject({ paidBy: 'guest', amount: 39 })
  })

  it('writes the cover once, however often it is synced', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.setListingMode('lst-1', 'host_paid')
    dp.syncHostCover()
    dp.hydrate()
    expect(reservationOf().activity).toHaveLength(1)
  })

  it('removes the cover from a stay that has not started when the listing goes back to guest-paid', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.setListingMode('lst-1', 'host_paid')
    dp.setListingMode('lst-1', 'guest_paid')
    expect(reservationOf().damageProtection).toBeUndefined()
    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
    expect(reservationOf().activity.map(a => a.title)).toEqual(['Covered by the host', 'Host cover removed'])
  })

  it('closes a cancelled stay\'s cover with nothing to refund', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.setListingMode('lst-1', 'host_paid')
    useReservationsModule().updateReservation('res-dp-1', { status: 'cancelled' })
    dp.syncHostCover()
    expect(protectionOf().state).toBe('cancelled')
    expect(protectionOf().refundedAmount).toBeUndefined()
    expect(dp.bucketFor('res-dp-1')).toBe('settled')
  })

  it('refuses a deposit-only policy where the host pays, and drops it when switching', () => {
    const dp = useDamageProtection()
    // lst-2: deposit-only short stays, waiver long stays.
    expect(dp.setListingMode('lst-2', 'host_paid')).toEqual({ ok: true })
    expect(listingSlots(dp.assignments.value, 'lst-2')).toMatchObject({ short: null, long: 'dp-long-stay' })
    expect(dp.setListingSlot('lst-2', 'short', 'dp-deposit-only')).toEqual({ ok: false, reason: 'host_needs_waiver' })
    expect(dp.setListingSlot('lst-2', 'short', 'dp-standard')).toEqual({ ok: true })
  })

  it('turns a listing off, and on again with the standard templates in its currency', () => {
    const dp = useDamageProtection()
    expect(dp.setListingMode('lst-18', 'off')).toEqual({ ok: true })
    expect(dp.listingMode('lst-18')).toBe('off')
    expect(dp.setListingMode('lst-18', 'guest_paid')).toEqual({ ok: true })
    expect(listingSlots(dp.assignments.value, 'lst-18')).toMatchObject({ short: 'dp-standard', long: 'dp-long-stay' })
    // lst-3 is paid out in IDR, and no policy exists in IDR: never a USD one instead.
    expect(dp.setListingMode('lst-3', 'guest_paid')).toEqual({ ok: false, reason: 'no_policy_in_currency' })
    expect(dp.listingMode('lst-3')).toBe('off')
    // An IDR deposit-only policy is usable where the guest pays, never where the host does.
    dp.savePolicy({ ...policyFromTemplate('deposit_only', 'IDR'), id: 'dp-idr' })
    expect(dp.setListingMode('lst-3', 'host_paid')).toEqual({ ok: false, reason: 'no_policy_in_currency' })
    expect(dp.setListingMode('lst-3', 'guest_paid')).toEqual({ ok: true })
    expect(listingSlots(dp.assignments.value, 'lst-3').short).toBe('dp-idr')
  })

  it('counts what Elev8 charges per covered stay, split by who pays, and needs no guide section', () => {
    seedReservation({ id: 'res-guest' })
    seedReservation({ id: 'res-host', listingId: 'lst-18', nights: 30, checkOut: isoDaysFromNow(35) })
    const dp = useDamageProtection()
    dp.recordChoice('res-guest', ACCEPT_WAIVER)
    dp.setListingMode('lst-18', 'host_paid')
    expect(dp.elev8FeeTotals.value.guestPaid).toEqual([{ currency: 'USD', amount: 9 }])
    expect(dp.elev8FeeTotals.value.hostPaid).toEqual([{ currency: 'USD', amount: 15 }])
    expect(dp.listingsMissingGuideSection()).not.toContain('lst-18')
  })
})

describe('before the damage waiver is activated', () => {
  it('pauses a policy that offers the waiver, deposit included, and keeps deposit-only running', () => {
    useTernActivation().replayActivation()
    const dp = useDamageProtection()
    seedReservation()
    seedReservation({ id: 'res-deposit', listingId: 'lst-2' })
    expect(dp.isOfferedFor('res-dp-1')).toBe(false)
    expect(dp.recordChoice('res-dp-1', ACCEPT_WAIVER)).toEqual({ ok: false, reason: 'not_offered' })
    expect(dp.isOfferedFor('res-deposit')).toBe(true)
    expect(dp.pausedUntilActivation(dp.policyFor('lst-1', 5))).toBe(true)
    expect(dp.pausedUntilActivation(dp.policyFor('lst-2', 5))).toBe(false)
  })

  it('refuses to turn the waiver on in a policy, but still saves deposit-only and edits to a paused one', () => {
    useTernActivation().replayActivation()
    const dp = useDamageProtection()
    const count = dp.policies.value.length
    expect(dp.savePolicy({ ...policyFromTemplate('standard_short', 'USD'), id: 'dp-new' })).toEqual({ ok: false, reason: 'waiver_not_activated' })
    const depositOnly = policyFromTemplate('deposit_only', 'USD')
    expect(dp.savePolicy({ ...depositOnly, id: 'dp-dep' })).toEqual({ ok: true })
    // Adding the waiver to that deposit-only policy is turning it on too.
    expect(dp.savePolicy({ ...depositOnly, id: 'dp-dep', offers: ['waiver', 'deposit'] })).toEqual({ ok: false, reason: 'waiver_not_activated' })
    // A policy that already offered the waiver can still be edited while it is paused.
    const standard = dp.policies.value.find(p => p.id === 'dp-standard')!
    expect(dp.savePolicy({ ...standard, name: 'Renamed' })).toEqual({ ok: true })
    expect(dp.policies.value).toHaveLength(count + 1)
  })

  it('refuses host-paid and writes no cover until activation, then covers on the next sync', async () => {
    const tern = useTernActivation()
    tern.replayActivation()
    const dp = useDamageProtection()
    seedReservation()
    expect(dp.setListingMode('lst-1', 'host_paid')).toEqual({ ok: false, reason: 'waiver_not_activated' })
    expect(reservationOf().damageProtection).toBeUndefined()

    vi.useFakeTimers()
    const pending = tern.activate({
      termsAccepted: true,
      bank: { accountHolder: 'PT Elev8 Bali Mandiri', bankName: 'BCA', country: 'ID', iban: '', accountNumber: '7890123456', bicSwift: 'CENAIDJA' },
    }, 'PT Elev8 Bali Mandiri')
    await vi.runAllTimersAsync()
    await pending
    vi.useRealTimers()

    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
    expect(dp.setListingMode('lst-1', 'host_paid')).toEqual({ ok: true })
    expect(protectionOf().paidBy).toBe('host')
  })
})

describe('what it must never touch', () => {
  it('leaves priceDetails and folioItems alone across a full cycle, charge included', async () => {
    const before = seedReservation().priceDetails
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
    await notifiedClaim(dp)
    await settle(() => dp.settleDeposit('res-dp-1'))

    const reservation = reservationOf()
    expect(reservation.priceDetails).toEqual(before)
    expect(reservation.folioItems ?? []).toHaveLength(0)
  })
})
