import type { DamageProtection, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useNotifications } from '~/composables/useNotifications'
import { usePartnerClaims } from '~/composables/usePartnerClaims'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTernActivation } from '~/composables/useTernActivation'
import { resetTernMock, useTernApi } from '~/composables/useTernApi'

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
  resetTernMock()
})

describe('submitToPartner', () => {
  it('files the part above the deductible, frozen, and gets the partner\'s reference back', async () => {
    seed()
    const pc = usePartnerClaims()
    await expect(settle(() => pc.submitToPartner('res-w-1', 'clm-1'))).resolves.toEqual({ ok: true })
    const filed = partnerClaim()!
    expect(filed).toMatchObject({ status: 'submitted', claimedAmount: 220, deductible: 100, policyNumber: 'MP-2026-0001' })
    // Tern pays by bank transfer into the account registered at activation.
    expect(filed).toMatchObject({ payoutAccountId: 'cover-org-10421', payoutAccountName: 'Bank Central Asia (BCA) •••• 3456' })
    // Tern's own ids come back: the display id as the reference, the numeric id for later calls.
    expect(filed.partnerClaimRef).toMatch(/^C-\d{6}$/)
    expect(filed.partnerClaimId).toEqual(expect.any(Number))
    expect(filed.partnerStatus).toBe('Submitted')
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

  it('refuses while the damage waiver is not activated: there is no bank account to pay into', async () => {
    useTernActivation().replayActivation()
    seed()
    await expect(usePartnerClaims().submitToPartner('res-w-1', 'clm-1')).resolves.toEqual({ ok: false, reason: 'waiver_not_activated' })
    expect(partnerClaim()).toBeUndefined()
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

  it('keeps paying the account frozen at filing, even if the tenant changes its bank account', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1', true))
    // The tenant changes its bank account between the failed filing and the retry.
    useTernActivation().updatePayoutBank({
      accountHolder: 'Elevate Schweiz GmbH',
      bankName: 'Aargauische Kantonalbank',
      country: 'CH',
      iban: 'CH93 0076 2011 6238 5295 7',
      accountNumber: '',
      bicSwift: '',
    })
    // The retry reuses the filing, account included.
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    expect(partnerClaim()).toMatchObject({ status: 'submitted', payoutAccountName: 'Bank Central Asia (BCA) •••• 3456' })
  })
})

describe('the partner process, end to end', () => {
  it('follows a claim from review to the money in the account', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    await expect(pc.simulatePartner('res-w-1', 'clm-1', { kind: 'under_review' })).resolves.toEqual({ ok: true })
    await expect(pc.simulatePartner('res-w-1', 'clm-1', { kind: 'approved', approvedAmount: 200 })).resolves.toEqual({ ok: true })
    expect(partnerClaim()!.status).toBe('partially_approved')
    await pc.simulatePartner('res-w-1', 'clm-1', { kind: 'payout_scheduled', payoutScheduledFor: '2026-10-05' })
    await pc.simulatePartner('res-w-1', 'clm-1', { kind: 'paid' })
    expect(partnerClaim()).toMatchObject({ status: 'paid', paidAmount: 200 })
    expect(pc.confirmReceived('res-w-1', 'clm-1', 195)).toEqual({ ok: true })
    expect(partnerClaim()).toMatchObject({ status: 'received', receivedAmount: 195 })
  })

  it('asks us for information, alerts, and returns to review once we answer', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    await pc.simulatePartner('res-w-1', 'clm-1', { kind: 'info_requested', infoRequest: 'Send the invoice' })
    const alert = () => useNotifications().alerts.value.find(a => a.type === 'PARTNER_CLAIM_INFO_REQUESTED')!
    expect(alert().status).toBe('ACTIVE')
    // The request text arrives as Tern's Public claim note.
    expect(partnerClaim()!.infoRequest).toBe('Send the invoice')

    await expect(pc.respondToInfoRequest('res-w-1', 'clm-1', '  ')).resolves.toEqual({ ok: false, reason: 'empty_response' })
    await expect(pc.respondToInfoRequest('res-w-1', 'clm-1', 'Invoice attached')).resolves.toEqual({ ok: true })
    // Our answer goes to Tern as a Public note, with the claim marked FollowUpReceived.
    expect(useTernApi().controls.claims()[0]!.status).toBe('FollowUpReceived')
    expect(partnerClaim()!.status).toBe('under_review')
    expect(alert().status).toBe('RESOLVED')
  })

  it('alerts on a rejection', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    await pc.simulatePartner('res-w-1', 'clm-1', { kind: 'rejected', rejectionReason: 'Wear and tear' })
    expect(partnerClaim()).toMatchObject({ status: 'rejected', rejectionReason: 'Wear and tear', partnerStatus: 'Denied' })
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
    await expect(pc.withdraw('res-w-1', 'clm-1', '')).resolves.toEqual({ ok: false, reason: 'missing_reason' })
    await expect(pc.withdraw('res-w-1', 'clm-1', 'Guest paid for it directly')).resolves.toEqual({ ok: true })
    expect(partnerClaim()!.status).toBe('withdrawn')
    expect(useTernApi().controls.claims()[0]!.status).toBe('Withdrawn')
  })

  it('stops the damage claim being removed while it is filed with the partner', async () => {
    seed({}, [claim({ guestNotifiedAt: undefined })])
    await settle(() => usePartnerClaims().submitToPartner('res-w-1', 'clm-1'))
    expect(useDamageProtection().removeClaim('res-w-1', 'clm-1')).toEqual({ ok: false, reason: 'filed_with_partner' })
  })
})

describe('the Tern API, as the flow uses it', () => {
  it('registers the stay as a Tern booking, files the claim against it gross, and uploads the evidence', async () => {
    seed()
    await settle(() => usePartnerClaims().submitToPartner('res-w-1', 'clm-1'))
    const { controls, bookingIds } = useTernApi()
    const [booking] = controls.bookings()
    const [filed] = controls.claims()
    expect(booking).toMatchObject({ bookingNumber: 'res-w-1', clientFirstName: 'Hannah', clientLastName: 'Brecht', organizationId: 10421, active: true })
    expect(bookingIds.value['res-w-1']).toBe(booking!.bookingId)
    // Gross: Tern applies its own deductible.
    expect(filed).toMatchObject({ bookingId: booking!.bookingId, claimAmount: 320, claimCurrency: 'USD', externalClaimSystem: 'Elev8', externalClaimId: 'clm-1', deductibleApplied: 100, status: 'Submitted' })
    expect(controls.documents().map(d => [d.entityType, d.entityId, d.fileName])).toEqual([['Claim', filed!.claimId, 'worktop.jpg']])
  })

  it('picks up a change made at Tern by polling, and a second poll changes nothing', async () => {
    seed()
    const pc = usePartnerClaims()
    await settle(() => pc.submitToPartner('res-w-1', 'clm-1'))
    const { controls } = useTernApi()
    controls.approve(partnerClaim()!.partnerClaimId!)
    controls.sendPayment(partnerClaim()!.partnerClaimId!, 'TRF-1')
    await expect(pc.pollPartnerUpdates()).resolves.toMatchObject({ changed: 1 })
    expect(partnerClaim()).toMatchObject({ status: 'paid', approvedAmount: 220, paidAmount: 220, payoutReference: 'TRF-1', partnerStatus: 'Approved' })
    const events = partnerClaim()!.events.length
    await expect(pc.pollPartnerUpdates()).resolves.toMatchObject({ changed: 0 })
    expect(partnerClaim()!.events).toHaveLength(events)
  })

  it('carries a demo claim filed before the client existed into the mock, then on', async () => {
    seed({}, [claim({ partnerClaim: { partnerId: 'partner-tern', partnerName: 'Elev8 Cover', policyNumber: 'MP-2026-0001', currency: 'USD', claimedAmount: 220, deductible: 100, status: 'under_review', partnerClaimRef: 'PC-240117', payoutAccountId: 'cover-org-10421', payoutAccountName: 'BCA', events: [] } })])
    const pc = usePartnerClaims()
    await expect(pc.simulatePartner('res-w-1', 'clm-1', { kind: 'approved' })).resolves.toEqual({ ok: true })
    expect(partnerClaim()).toMatchObject({ status: 'approved', approvedAmount: 220, partnerClaimRef: 'PC-240117' })
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
    await pc.simulatePartner('res-w-1', 'clm-2', { kind: 'approved' })
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
    await pc.simulatePartner('res-w-1', 'clm-1', { kind: 'approved' })
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
    expect(pc.partner.value).toMatchObject({ name: 'Elev8 Cover', deductiblePerClaim: 100, paymentTermsDays: 14 })
    expect(pc).not.toHaveProperty('savePartner')
    expect(pc).not.toHaveProperty('connectPartner')
    expect(pc.partner.value).not.toHaveProperty('payoutAccount')
  })
})
