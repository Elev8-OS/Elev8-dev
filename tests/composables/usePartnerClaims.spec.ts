import type { DamageProtection, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useNotifications } from '~/composables/useNotifications'
import { usePartnerClaims } from '~/composables/usePartnerClaims'
import { useReservationsModule } from '~/composables/useReservationsModule'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

/** The mock partner API costs real seconds otherwise. Fake timers BEFORE the call. */
async function settle<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  const pending = run()
  await vi.runAllTimersAsync()
  const result = await pending
  vi.useRealTimers()
  return result
}

function claim(patch: Partial<ProtectionClaim> = {}): ProtectionClaim {
  return {
    id: 'clm-1',
    label: 'Scorched worktop',
    amount: 320,
    coveredAmount: 320,
    excessAmount: 0,
    reason: 'Found at the cleaning',
    evidenceUrls: ['/mock/evidence/worktop.jpg'],
    recordedBy: 'Komang Juliantara',
    recordedAt: new Date().toISOString(),
    guestNotifiedAt: new Date().toISOString(),
    ...patch,
  }
}

function seed(protectionPatch: Partial<DamageProtection> = {}, claims = [claim()]) {
  const entry = {
    id: 'res-w-1',
    guestId: 'g-1',
    guestName: 'Hannah Brecht',
    guestEmail: 'hannah@example.com',
    listingId: 'lst-1',
    listingName: 'Villa',
    channel: 'Direct',
    checkIn: '2026-08-01',
    checkOut: '2026-08-06',
    nights: 5,
    status: 'checked_out',
    activity: [],
    damageProtection: {
      policyId: 'dp-standard',
      option: 'waiver',
      state: 'waiver_active',
      amount: 39,
      coverageCap: 2000,
      currency: 'USD',
      termsVersion: 'v1',
      termsText: 'Terms',
      acceptedAt: new Date().toISOString(),
      acceptedVia: 'guest_guide',
      claims,
      ...protectionPatch,
    },
  } as unknown as ReservationEntry
  useReservationsModule().reservations.value = [entry]
}

function partnerClaim() {
  return useReservationsModule().reservations.value[0]!.damageProtection!.claims![0]!.partnerClaim
}

beforeEach(() => {
  useReservationsModule().reset()
  useReservationsModule().reservations.value = []
  localStorage.clear()
})

describe('submitToPartner', () => {
  it('files the part above the deductible, frozen, and gets the partner\'s reference back', async () => {
    seed()
    const pc = usePartnerClaims()
    await expect(settle(() => pc.submitToPartner('res-w-1', 'clm-1'))).resolves.toEqual({ ok: true })
    const filed = partnerClaim()!
    expect(filed).toMatchObject({ status: 'submitted', claimedAmount: 220, deductible: 100, policyNumber: 'MP-2026-0001' })
    // lst-1 settles into the tenant's Stripe account pay-1: that is where the partner pays.
    expect(filed).toMatchObject({ payoutAccountId: 'pay-1', payoutAccountName: 'Stripe Bali Main' })
    expect(filed.partnerClaimRef).toMatch(/^PC-/)
    expect(filed.events.map(e => [e.status, e.source])).toEqual([['submitting', 'staff'], ['submitted', 'api']])
  })

  it('writes an activity line on the reservation for each step', async () => {
    seed()
    await settle(() => usePartnerClaims().submitToPartner('res-w-1', 'clm-1'))
    const titles = useReservationsModule().reservations.value[0]!.activity.map(e => e.title)
    expect(titles.filter(t => t === 'Insurance claim update')).toHaveLength(2)
  })

  it('refuses a claim below the deductible and a deposit claim', async () => {
    seed({}, [claim({ coveredAmount: 60, amount: 60 })])
    const pc = usePartnerClaims()
    await expect(pc.submitToPartner('res-w-1', 'clm-1')).resolves.toEqual({ ok: false, reason: 'below_deductible' })

    seed({ option: 'deposit', state: 'card_on_file' })
    await expect(pc.submitToPartner('res-w-1', 'clm-1')).resolves.toEqual({ ok: false, reason: 'not_a_waiver' })
  })

  it('refuses when the tenant has no Stripe payout account for the partner to pay into', async () => {
    const saved = payoutAccounts.value
    payoutAccounts.value = saved.filter(a => a.provider !== 'stripe')
    try {
      seed()
      await expect(usePartnerClaims().submitToPartner('res-w-1', 'clm-1')).resolves.toEqual({ ok: false, reason: 'no_stripe_payout_account' })
      expect(partnerClaim()).toBeUndefined()
    }
    finally {
      payoutAccounts.value = saved
    }
  })

  it('refuses to file the same claim twice', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    await expect(pc.submitToPartner('res-w-1', 'clm-1')).resolves.toEqual({ ok: false, reason: 'already_submitted' })
  })

  it('records a rejected submission with an alert, and retries on the same record', async () => {
    seed()
    const pc = usePartnerClaims()
    await expect(settle(() => pc.submitToPartner('res-w-1', 'clm-1', true))).resolves.toEqual({ ok: false, reason: 'submission_failed' })
    expect(partnerClaim()!.status).toBe('submission_failed')
    expect(useNotifications().alerts.value.some(a => a.type === 'PARTNER_CLAIM_SUBMISSION_FAILED')).toBe(true)

    await expect(settle(() => pc.submitToPartner('res-w-1', 'clm-1'))).resolves.toEqual({ ok: true })
    expect(partnerClaim()!.status).toBe('submitted')
    expect(partnerClaim()!.events.map(e => e.status)).toEqual(['submitting', 'submission_failed', 'submitting', 'submitted'])
  })

  it('keeps paying the account frozen at filing, even if the listing moves to another one', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1', true))
    const saved = payoutAccounts.value
    payoutAccounts.value = saved.map(a => ({ ...a, listingIds: a.listingIds.filter(id => id !== 'lst-1') }))
    try {
      // The retry reuses the filing, account included.
      await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
      expect(partnerClaim()).toMatchObject({ status: 'submitted', payoutAccountId: 'pay-1' })
    }
    finally {
      payoutAccounts.value = saved
    }
  })
})

describe('the partner process, end to end', () => {
  it('follows a claim from review to the money in the account', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    expect(pc.simulatePartner('res-w-1', 'clm-1', { kind: 'under_review' })).toEqual({ ok: true })
    expect(pc.simulatePartner('res-w-1', 'clm-1', { kind: 'approved', approvedAmount: 200 })).toEqual({ ok: true })
    expect(partnerClaim()!.status).toBe('partially_approved')
    pc.simulatePartner('res-w-1', 'clm-1', { kind: 'payout_scheduled', payoutScheduledFor: new Date().toISOString() })
    pc.simulatePartner('res-w-1', 'clm-1', { kind: 'paid' })
    expect(partnerClaim()).toMatchObject({ status: 'paid', paidAmount: 200 })
    expect(pc.confirmReceived('res-w-1', 'clm-1', 195)).toEqual({ ok: true })
    expect(partnerClaim()).toMatchObject({ status: 'received', receivedAmount: 195 })
  })

  it('asks us for information, alerts, and returns to review once we answer', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    pc.simulatePartner('res-w-1', 'clm-1', { kind: 'info_requested', infoRequest: 'Send the invoice' })
    const alert = () => useNotifications().alerts.value.find(a => a.type === 'PARTNER_CLAIM_INFO_REQUESTED')!
    expect(alert().status).toBe('ACTIVE')

    expect(pc.respondToInfoRequest('res-w-1', 'clm-1', '  ')).toEqual({ ok: false, reason: 'empty_response' })
    expect(pc.respondToInfoRequest('res-w-1', 'clm-1', 'Invoice attached')).toEqual({ ok: true })
    expect(partnerClaim()!.status).toBe('under_review')
    expect(alert().status).toBe('RESOLVED')
  })

  it('alerts on a rejection', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    pc.simulatePartner('res-w-1', 'clm-1', { kind: 'rejected', rejectionReason: 'Wear and tear' })
    expect(partnerClaim()).toMatchObject({ status: 'rejected', rejectionReason: 'Wear and tear' })
    expect(useNotifications().alerts.value.some(a => a.type === 'PARTNER_CLAIM_REJECTED')).toBe(true)
  })

  it('refuses a replayed webhook and one that arrives out of order', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    const event = { id: 'wh-1', status: 'under_review' as const, source: 'webhook' as const }
    expect(pc.receivePartnerEvent('res-w-1', 'clm-1', event)).toEqual({ ok: true })
    expect(pc.receivePartnerEvent('res-w-1', 'clm-1', event)).toEqual({ ok: false, reason: 'duplicate_event' })
    expect(pc.receivePartnerEvent('res-w-1', 'clm-1', { id: 'wh-2', status: 'received', source: 'webhook', receivedAmount: 10 }))
      .toEqual({ ok: false, reason: 'illegal_transition' })
  })

  it('withdraws only with a reason', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    expect(pc.withdraw('res-w-1', 'clm-1', '')).toEqual({ ok: false, reason: 'missing_reason' })
    expect(pc.withdraw('res-w-1', 'clm-1', 'Guest paid for it directly')).toEqual({ ok: true })
    expect(partnerClaim()!.status).toBe('withdrawn')
  })

  it('stops the damage claim being removed while it is filed with the partner', async () => {
    seed({}, [claim({ guestNotifiedAt: undefined })])
    await settle(() => usePartnerClaims().submitToPartner('res-w-1', 'clm-1'))
    expect(useDamageProtection().removeClaim('res-w-1', 'clm-1')).toEqual({ ok: false, reason: 'filed_with_partner' })
  })
})

describe('the worklist', () => {
  it('lists eligible and filed claims by queue, and leaves out claims below the deductible', async () => {
    seed({}, [claim(), claim({ id: 'clm-2', coveredAmount: 50, amount: 50 }), claim({ id: 'clm-3', coveredAmount: 500, amount: 500 })])
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-3'))
    expect(pc.rows.value.map(r => r.claim.id).sort()).toEqual(['clm-1', 'clm-3'])
    expect(pc.toSubmit.value.map(r => r.claim.id)).toEqual(['clm-1'])
    expect(pc.withPartner.value.map(r => r.claim.id)).toEqual(['clm-3'])
  })

  it('reports claimable, with the partner, approved not received and received as separate figures', async () => {
    seed({}, [claim(), claim({ id: 'clm-2', coveredAmount: 700, amount: 700 })])
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-2'))
    pc.simulatePartner('res-w-1', 'clm-2', { kind: 'approved' })
    expect(pc.moneyTotals.value).toEqual({
      claimable: [{ currency: 'USD', amount: 220 }],
      withPartner: [],
      approvedNotReceived: [{ currency: 'USD', amount: 600 }],
      received: [],
    })
  })

  it('raises one payout-overdue alert once the payment terms have passed', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    pc.simulatePartner('res-w-1', 'clm-1', { kind: 'approved' })
    const later = new Date(Date.now() + 15 * 86400000)
    pc.emitPartnerAlerts(later)
    pc.emitPartnerAlerts(later)
    const overdue = useNotifications().alerts.value.filter(a => a.type === 'PARTNER_CLAIM_PAYOUT_OVERDUE')
    expect(overdue).toHaveLength(1)
    expect(overdue[0]!.severity).toBe('CRITICAL')
    pc.emitPartnerAlerts(new Date())
    expect(useNotifications().alerts.value.filter(a => a.type === 'PARTNER_CLAIM_PAYOUT_OVERDUE')).toHaveLength(1)
  })
})

describe('the partner contract', () => {
  it('is Elev8\'s single integration: read-only, with nothing for a tenant to configure', () => {
    const pc = usePartnerClaims()
    expect(pc.partner.value).toMatchObject({ name: 'Demo Cover Partner', deductiblePerClaim: 100, paymentTermsDays: 14 })
    expect(pc).not.toHaveProperty('savePartner')
    expect(pc).not.toHaveProperty('connectPartner')
    expect(pc.partner.value).not.toHaveProperty('payoutAccount')
  })
})
