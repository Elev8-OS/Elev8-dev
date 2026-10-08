import type { DamageProtection, ReservationEntry, SavedCard } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { seedProtectionSettings } from '~/components/reservations/data/damage-protection-seed'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTernActivation } from '~/composables/useTernActivation'
import { useUpsellServices } from '~/composables/useUpsellServices'

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
  it('returns null for a listing paid out in another currency, and the listing\'s own policy otherwise', () => {
    const dp = useDamageProtection()
    expect(dp.policyFor('lst-3', 5)).toBeNull()
    expect(dp.policyFor('lst-1', 5)?.id).toBe('lp-lst-1')
  })

  it('uses one policy for every stay length: there is no separate long-stay setup', () => {
    const dp = useDamageProtection()
    expect(dp.policyFor('lst-1', 60)?.id).toBe('lp-lst-1')
    expect(dp.policyFor('lst-1', 400)?.offers).toEqual(['waiver', 'deposit'])
  })

  it('takes the tier and the guest price from the tenant\'s package, the same on every listing', () => {
    const dp = useDamageProtection()
    expect(dp.policyFor('lst-1', 5)?.waiver).toEqual({ tier: 'bronze', guestPrice: 39 })
    expect(dp.policyFor('lst-18', 5)?.waiver).toEqual({ tier: 'bronze', guestPrice: 39 })
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
    // The deposit on its own is asked on Direct only.
    useDamageProtection().setProtectionSettings({ waiver: false })
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
      // With the waiver off, the deposit was all there was.
      dp.setProtectionSettings({ waiver: false })
      seedReservation({ id: 'res-dp-2', listingId: 'lst-2' })
      expect(dp.isOfferedFor('res-dp-2')).toBe(false)
    }
    finally {
      payoutAccounts.value = saved
    }
  })
})

describe('one setting for every listing', () => {
  it('protects every listing at once with the one package, whatever upsell lists it', () => {
    const dp = useDamageProtection()
    // lst-17 has no payout account and is in no upsell: the waiver still runs, in the package's currency.
    expect(dp.listingMode('lst-17')).toBe('guest_paid')
    expect(dp.policyFor('lst-17', 5)).toMatchObject({ offers: ['waiver', 'deposit'], waiver: { tier: 'bronze', guestPrice: 39 } })
  })

  it('brings the deposit with the waiver, and keeps it on beside it', () => {
    const dp = useDamageProtection()
    expect(dp.setProtectionSettings({ waiver: false, deposit: false })).toEqual({ ok: true })
    expect(dp.listingMode('lst-1')).toBe('off')
    expect(dp.listingProtection('lst-1').block).toBe('nothing_offered')
    expect(dp.setProtectionSettings({ waiver: true })).toEqual({ ok: true })
    expect(dp.settings.value.deposit).toBe(true)
    dp.setProtectionSettings({ deposit: false })
    expect(dp.settings.value.deposit).toBe(true)
    expect(dp.policyFor('lst-1', 5)?.offers).toEqual(['waiver', 'deposit'])
  })

  it('changes the package for every listing, and offers no waiver without one', () => {
    const dp = useDamageProtection()
    expect(dp.setProtectionSettings({ packageServiceId: 'svc-dp-silver' })).toEqual({ ok: true })
    expect(dp.policyFor('lst-1', 5)?.waiver).toEqual({ tier: 'silver', guestPrice: 59 })
    expect(dp.policyFor('lst-18', 5)?.waiver).toEqual({ tier: 'silver', guestPrice: 59 })
    expect(dp.setProtectionSettings({ packageServiceId: null })).toEqual({ ok: false, reason: 'package_missing' })
    // Pausing the package's upsell takes the waiver off everywhere.
    useUpsellServices().toggleStatus('svc-dp-silver')
    expect(dp.policyFor('lst-1', 5)).toBeNull()
    expect(dp.listingProtection('lst-1').block).toBe('no_package')
  })

  it('takes a deposit on its own with the waiver off', () => {
    const dp = useDamageProtection()
    dp.setProtectionSettings({ waiver: false })
    expect(dp.policyFor('lst-1', 5)).toMatchObject({ offers: ['deposit'], name: 'Deposit', currency: 'USD', channelPolicy: { Direct: 'offer' } })
    // There is no waiver for the host to pay for.
    expect(dp.setProtectionPayer('host')).toEqual({ ok: false, reason: 'host_needs_waiver' })
    // Without a payout account there is no currency to take it in.
    expect(dp.listingProtection('lst-17').block).toBe('no_payout_currency')
  })

  it('never protects a listing paid out in another currency than the package: nothing is converted', () => {
    const dp = useDamageProtection()
    // lst-3 settles IDR; the package is USD.
    expect(dp.listingMode('lst-3')).toBe('off')
    expect(dp.listingProtection('lst-3').block).toBe('currency_mismatch')
  })

  it('is not an upsell anyone can order: the folio and inbox lists leave it out', async () => {
    const { sellableServices } = await import('~/components/upsells/data/upsell-services')
    expect(sellableServices(useUpsellServices().services.value).some(s => s.id === 'svc-dp-bronze')).toBe(false)
  })

  it('sets the deposit limit and refuses a deposit without one', () => {
    const dp = useDamageProtection()
    expect(dp.setProtectionSettings({ depositLimit: 800, settleWithinDays: 10 })).toEqual({ ok: true })
    expect(dp.policyFor('lst-1', 5)?.deposit).toEqual({ pricing: 'flat', rate: 800, settleWithinDays: 10 })
    expect(dp.setProtectionSettings({ depositLimit: 0 })).toEqual({ ok: false, reason: 'deposit_limit_missing' })
    expect(dp.setProtectionSettings({ settleWithinDays: 0 })).toEqual({ ok: false, reason: 'settle_days_missing' })
    expect(dp.policyFor('lst-1', 5)?.deposit.rate).toBe(800)
  })

  it('turns everything off in one go, keeping the package picked', () => {
    const dp = useDamageProtection()
    expect(dp.turnOffProtection()).toEqual({ ok: true })
    expect(dp.policies.value).toEqual([])
    expect(dp.settings.value.packageServiceId).toBe('svc-dp-bronze')
  })

  it('survives a reload', () => {
    const dp = useDamageProtection()
    dp.setProtectionSettings({ packageServiceId: 'svc-dp-silver' })
    useState('damage-protection-settings').value = { ...seedProtectionSettings }
    dp.hydrate()
    expect(dp.settings.value.packageServiceId).toBe('svc-dp-silver')
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

    // A later change to the package must not reach the accepted stay.
    dp.setProtectionSettings({ packageServiceId: 'svc-dp-silver' })

    const frozen = protectionOf()
    expect(frozen.amount).toBe(39)
    expect(frozen.coverageCap).toBe(2000)
    expect(frozen.tier).toBe('bronze')
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
    seedReservation({ listingId: 'lst-3' })
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

  it('adds the package at the frozen price, without asking again: every stay length is on one policy', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    const before = { ...protectionOf() }
    useReservationsModule().updateReservation('res-dp-1', { nights: 40 })
    dp.reassessOnExtension('res-dp-1', 5)

    expect(useNotifications().alerts.value.some(a => a.type === 'PROTECTION_CHOICE_MISSING')).toBe(false)
    // The stay keeps the USD 39 it agreed to, now for two 30-night packages.
    expect(protectionOf()).toMatchObject({ packages: 2, amount: before.amount * 2, elev8Fee: before.elev8Fee! * 2, coverageCap: before.coverageCap })
    expect(protectionOf().termsText).toBe(before.termsText)
  })

  it('adds no package while the stay stays within 30 nights', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    useReservationsModule().updateReservation('res-dp-1', { nights: 30 })
    dp.reassessOnExtension('res-dp-1', 5)
    expect(protectionOf()).toMatchObject({ packages: 1, amount: 39 })
  })

  it('says what the guest still owes in the activity line', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    useReservationsModule().updateReservation('res-dp-1', { nights: 35 })
    dp.reassessOnExtension('res-dp-1', 5)
    const line = reservationOf().activity.at(-1)!
    expect(line.title).toBe('Cover packages added')
    expect(line.description).toContain('2 packages of up to 30 nights')
    expect(line.description).toContain('USD 39.00 more to collect')
  })

  it('runs when a stay is extended from the Modify menu', async () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_WAIVER)
    expect(useReservationsModule().extendReservation('res-dp-1', { checkOut: isoDaysFromNow(40) }).success).toBe(true)
    await vi.waitFor(() => expect(protectionOf().packages).toBe(2))
  })
})

describe('long stays take one package per started 30 nights', () => {
  it('freezes the packages, the multiplied guest price and the multiplied Elev8 fee', () => {
    seedReservation({ nights: 45, checkOut: isoDaysFromNow(50) })
    const dp = useDamageProtection()
    const policy = dp.policyFor('lst-1', 45)!
    expect(dp.recordChoice('res-dp-1', ACCEPT_WAIVER).ok).toBe(true)
    // Bronze: USD 39 to the guest, USD 9 Elev8 fee, each times two packages.
    expect(protectionOf()).toMatchObject({ packages: 2, amount: policy.waiver.guestPrice * 2, elev8Fee: 18 })
  })
})

describe('the worklist', () => {
  it('produces no row for an unprotected listing, a block or an owner stay', () => {
    seedReservation({ id: 'res-a', listingId: 'lst-3' })
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

describe('host pays', () => {
  it('never asks the guest and covers the stay at no cost to them', () => {
    seedReservation()
    const dp = useDamageProtection()
    expect(dp.setProtectionPayer('host')).toEqual({ ok: true })
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
    useDamageProtection().setProtectionPayer('host')
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
    dp.setProtectionPayer('host')
    expect(reservationOf('res-asked').damageProtection?.paidBy).toBe('host')
    expect(protectionOf()).toMatchObject({ paidBy: 'guest', amount: 39 })
  })

  it('writes the cover once, however often it is synced', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.setProtectionPayer('host')
    dp.syncHostCover()
    dp.hydrate()
    expect(reservationOf().activity).toHaveLength(1)
  })

  it('removes the cover from a stay that has not started when the listing goes back to guest-paid', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.setProtectionPayer('host')
    dp.setProtectionPayer('guest')
    expect(reservationOf().damageProtection).toBeUndefined()
    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
    expect(reservationOf().activity.map(a => a.title)).toEqual(['Covered by the host', 'Host cover removed'])
  })

  it('closes a cancelled stay\'s cover with nothing to refund', () => {
    seedReservation()
    const dp = useDamageProtection()
    dp.setProtectionPayer('host')
    useReservationsModule().updateReservation('res-dp-1', { status: 'cancelled' })
    dp.syncHostCover()
    expect(protectionOf().state).toBe('cancelled')
    expect(protectionOf().refundedAmount).toBeUndefined()
    expect(dp.bucketFor('res-dp-1')).toBe('settled')
  })

  it('needs the waiver where the host pays: the deposit is not theirs to buy', () => {
    const dp = useDamageProtection()
    dp.setProtectionSettings({ waiver: false })
    expect(dp.setProtectionPayer('host')).toEqual({ ok: false, reason: 'host_needs_waiver' })
    dp.setProtectionSettings({ waiver: true })
    expect(dp.setProtectionPayer('host')).toEqual({ ok: true })
    expect(dp.setProtectionSettings({ waiver: false })).toEqual({ ok: false, reason: 'host_needs_waiver' })
    expect(dp.listingMode('lst-2')).toBe('host_paid')
  })

  it('counts what Elev8 charges per covered stay, split by who pays, and needs no guide section', () => {
    seedReservation({ id: 'res-guest' })
    seedReservation({ id: 'res-host', listingId: 'lst-18', nights: 30, checkOut: isoDaysFromNow(35) })
    const dp = useDamageProtection()
    dp.recordChoice('res-guest', ACCEPT_WAIVER)
    dp.setProtectionPayer('host')
    expect(dp.elev8FeeTotals.value.guestPaid).toEqual([{ currency: 'USD', amount: 9 }])
    expect(dp.elev8FeeTotals.value.hostPaid).toEqual([{ currency: 'USD', amount: 9 }])
    expect(dp.listingsMissingGuideSection()).not.toContain('lst-18')
  })
})

describe('host cover when the guest does not buy', () => {
  it('covers a guest stay with no choice once the cut-off comes, and stops asking the guest', () => {
    // Check-in tomorrow: inside a 1-day cut-off.
    seedReservation({ checkIn: isoDaysFromNow(1), checkOut: isoDaysFromNow(5), nights: 4 })
    const dp = useDamageProtection()
    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
    expect(dp.setProtectionSettings({ hostFallback: true, hostFallbackDays: 1 })).toEqual({ ok: true })
    expect(protectionOf()).toMatchObject({ paidBy: 'host', amount: 0, autoHostCover: true, tier: 'bronze', elev8Fee: 9 })
    expect(reservationOf().activity.at(-1)!.description).toContain('had not bought the damage waiver')
    expect(dp.isOfferedFor('res-dp-1')).toBe(false)
    // Still guest-paid: only this stay is covered by the host.
    expect(dp.listingMode('lst-1')).toBe('guest_paid')
  })

  it('waits until the cut-off, and never overrides a guest\'s own choice', () => {
    seedReservation({ id: 'res-later', checkIn: isoDaysFromNow(5), checkOut: isoDaysFromNow(8), nights: 3 })
    seedReservation({ checkIn: isoDaysFromNow(1), checkOut: isoDaysFromNow(5), nights: 4 })
    const dp = useDamageProtection()
    dp.recordChoice('res-dp-1', ACCEPT_DEPOSIT)
    dp.setProtectionSettings({ hostFallback: true, hostFallbackDays: 2 })
    expect(reservationOf('res-later').damageProtection).toBeUndefined()
    expect(protectionOf()).toMatchObject({ option: 'deposit', state: 'card_on_file' })
    expect(protectionOf().paidBy).not.toBe('host')
    // Moving the cut-off out to a week takes the later stay too.
    dp.setProtectionSettings({ hostFallbackDays: 7 })
    expect(reservationOf('res-later').damageProtection).toMatchObject({ paidBy: 'host', autoHostCover: true })
  })

  it('removes the cover from a stay not started yet when the setting goes off', () => {
    seedReservation({ checkIn: isoDaysFromNow(1), checkOut: isoDaysFromNow(5), nights: 4 })
    const dp = useDamageProtection()
    dp.setProtectionSettings({ hostFallback: true })
    dp.setProtectionSettings({ hostFallback: false })
    expect(reservationOf().damageProtection).toBeUndefined()
    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
  })

  it('writes nothing without the waiver on or before activation', () => {
    seedReservation({ listingId: 'lst-2', checkIn: isoDaysFromNow(1), checkOut: isoDaysFromNow(5), nights: 4 })
    const dp = useDamageProtection()
    // A deposit on its own: there is no cover for the host to buy.
    dp.setProtectionSettings({ waiver: false, hostFallback: true })
    expect(reservationOf().damageProtection).toBeUndefined()
    dp.setProtectionSettings({ waiver: true, hostFallback: false })
    useTernActivation().replayActivation()
    seedReservation({ id: 'res-x', checkIn: isoDaysFromNow(1), checkOut: isoDaysFromNow(5), nights: 4 })
    dp.setProtectionSettings({ hostFallback: true })
    expect(reservationOf('res-x').damageProtection).toBeUndefined()
  })
})

describe('before the damage waiver is activated', () => {
  it('pauses a policy that offers the waiver, deposit included, and keeps deposit-only running', () => {
    useTernActivation().replayActivation()
    const dp = useDamageProtection()
    seedReservation()
    expect(dp.isOfferedFor('res-dp-1')).toBe(false)
    expect(dp.recordChoice('res-dp-1', ACCEPT_WAIVER)).toEqual({ ok: false, reason: 'not_offered' })
    expect(dp.pausedUntilActivation(dp.policyFor('lst-1', 5))).toBe(true)
    dp.setProtectionSettings({ waiver: false })
    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
    expect(dp.pausedUntilActivation(dp.policyFor('lst-1', 5))).toBe(false)
  })

  it('keeps the waiver paused, not refused, when the package changes before activation', () => {
    useTernActivation().replayActivation()
    const dp = useDamageProtection()
    expect(dp.setProtectionSettings({ packageServiceId: 'svc-dp-silver' })).toEqual({ ok: true })
    expect(dp.pausedUntilActivation(dp.policyFor('lst-18', 5))).toBe(true)
  })

  it('refuses host-paid and writes no cover until activation, then covers on the next sync', async () => {
    const tern = useTernActivation()
    tern.replayActivation()
    const dp = useDamageProtection()
    seedReservation()
    expect(dp.setProtectionPayer('host')).toEqual({ ok: false, reason: 'waiver_not_activated' })
    expect(reservationOf().damageProtection).toBeUndefined()

    vi.useFakeTimers()
    const pending = tern.activate({
      termsAccepted: true,
      packageServiceId: 'svc-dp-bronze',
      bank: { accountHolder: 'PT Elev8 Bali Mandiri', bankName: 'BCA', country: 'ID', iban: '', accountNumber: '7890123456', bicSwift: 'CENAIDJA' },
    }, 'PT Elev8 Bali Mandiri')
    await vi.runAllTimersAsync()
    await pending
    vi.useRealTimers()

    expect(dp.isOfferedFor('res-dp-1')).toBe(true)
    expect(dp.setProtectionPayer('host')).toEqual({ ok: true })
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
