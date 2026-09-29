import type { PartnerClaim } from '~/components/reservations/data/reservations'
import type { TernClaim } from '~/lib/tern/types'
import { describe, expect, it } from 'vitest'
import { applyPartnerEvent } from '~/components/reservations/data/partner-claims'
import { partnerEventsFromTern, TERN_STATUS_MAP, ternBookingChanged, ternClaimCorrections, ternNetApproved, toTernBooking, toTernClaim } from '~/lib/tern/mappers'

function bookingInput(patch: Record<string, unknown> = {}) {
  return {
    organizationId: 10421,
    reservation: { id: 'res-1', guestName: 'Anna Maria Schmidt', guestEmail: 'anna@example.com', guestCountry: 'Germany', checkIn: '2026-10-01', checkOut: '2026-10-06', totalPrice: 1300, currency: 'USD', status: 'verified' as const },
    protection: { state: 'waiver_active' as const, tier: 'silver' as const, elev8Fee: 30, currency: 'USD', paidBy: 'guest' as const, packages: 2, acceptedAt: '2026-09-20T08:00:00.000Z' },
    listing: { id: 'lst-1', name: 'Villa Luwa', location: 'Canggu, Bali' },
    manager: { name: 'PT Elev8 Bali', email: 'ops@example.com', addressLines: ['Jl. Pantai 1'] },
    ...patch,
  }
}

function partnerClaim(patch: Partial<PartnerClaim> = {}): PartnerClaim {
  return { partnerId: 'p', partnerName: 'Elev8 Cover', policyNumber: 'MP', currency: 'USD', claimedAmount: 220, deductible: 100, status: 'submitted', payoutAccountId: 'a', payoutAccountName: 'A', events: [], ...patch }
}

function ternClaim(patch: Partial<TernClaim> = {}): TernClaim {
  return { active: true, claimId: 7, claimDate: '2026-10-07', claimantName: 'PT Elev8 Bali', description: 'x', status: 'Submitted', claimAmount: 320, claimCurrency: 'USD', deductibleApplied: 100, modStamp: '2026-10-08T10:00:00.000Z', ...patch }
}

/** Apply the mapped events the way polling does: refused ones are skipped. */
function applyAll(current: PartnerClaim, tern: TernClaim, note?: string): PartnerClaim {
  let claim = current
  for (const event of partnerEventsFromTern(tern, claim, note ? { content: note } : undefined)) {
    const result = applyPartnerEvent(claim, event)
    if (result.ok)
      claim = result.claim
  }
  return claim
}

describe('toTernBooking', () => {
  it('maps a covered stay onto Tern\'s booking fields', () => {
    expect(toTernBooking(bookingInput())).toMatchObject({
      active: true,
      bookingNumber: 'res-1',
      bookingDate: '2026-09-20',
      clientFirstName: 'Anna Maria',
      clientLastName: 'Schmidt',
      clientEmail: 'anna@example.com',
      clientCountry: 'Germany',
      startDate: '2026-10-01',
      endDate: '2026-10-06',
      bookingTotal: 1300,
      bookingCurrency: 'USD',
      insuranceCost: 30,
      insuranceCostCurrency: 'USD',
      locationName: 'Villa Luwa',
      locationCity: 'Canggu',
      locationStateProvince: 'Bali',
      managerName: 'PT Elev8 Bali',
      managerContact: 'ops@example.com',
      organizationId: 10421,
      productId: 102,
    })
  })

  it('marks a cancelled stay inactive with its cancellation date', () => {
    const booking = toTernBooking(bookingInput({ cancelledDate: '2026-09-25', protection: { ...bookingInput().protection, state: 'cancelled' } }))
    expect(booking).toMatchObject({ active: false, cancelledDate: '2026-09-25' })
  })

  it('needs a PUT only when a field we own changed', () => {
    const a = toTernBooking(bookingInput())
    expect(ternBookingChanged(a, { ...a, modStamp: 'later' })).toBe(false)
    expect(ternBookingChanged(a, { ...a, endDate: '2026-10-09' })).toBe(true)
  })
})

describe('toTernClaim', () => {
  it('files the gross covered amount with our ids, for Tern to apply its own deductible', () => {
    const claim = toTernClaim({
      bookingId: 55,
      claim: { id: 'clm-1', label: 'Scorched worktop', reason: 'Found at the cleaning', coveredAmount: 320, recordedAt: '2026-10-07T09:00:00.000Z' },
      currency: 'USD',
      claimant: { name: 'PT Elev8 Bali', email: 'ops@example.com' },
    })
    expect(claim).toMatchObject({ bookingId: 55, claimAmount: 320, claimCurrency: 'USD', claimDate: '2026-10-07', claimantName: 'PT Elev8 Bali', externalClaimSystem: 'Elev8', externalClaimId: 'clm-1', status: 'Submitted' })
    expect(claim.deductibleApplied).toBeUndefined()
  })
})

describe('tern statuses onto ours', () => {
  it('maps every one of Tern\'s 14 statuses', () => {
    expect(Object.keys(TERN_STATUS_MAP)).toHaveLength(14)
  })

  it('reads a partial approval off the net amount, and follows the payment', () => {
    const approved = ternClaim({ status: 'Approved', ternApprovedAmount: 300, totalApprovedAmount: 300, totalNetApprovedAmount: 200, paymentStatus: 'PaymentSent', paymentReference: 'TRF-9', paymentSentDate: '2026-10-20' })
    expect(ternNetApproved(approved)).toBe(200)
    expect(applyAll(partnerClaim(), approved)).toMatchObject({ status: 'paid', approvedAmount: 200, paidAmount: 200, payoutReference: 'TRF-9' })
    expect(applyAll(partnerClaim(), { ...approved, paymentStatus: 'PaymentPending', followUpDate: '2026-10-25' })).toMatchObject({ status: 'payout_scheduled', payoutScheduledFor: '2026-10-25' })
  })

  it('takes an information request and a denial reason from Tern\'s latest public note', () => {
    expect(applyAll(partnerClaim(), ternClaim({ status: 'FollowUpRequested' }), 'Send the invoice')).toMatchObject({ status: 'info_requested', infoRequest: 'Send the invoice' })
    expect(applyAll(partnerClaim(), ternClaim({ status: 'Denied' }), 'Wear and tear')).toMatchObject({ status: 'rejected', rejectionReason: 'Wear and tear' })
    expect(applyAll(partnerClaim(), ternClaim({ status: 'Expired' }))).toMatchObject({ status: 'rejected', rejectionReason: 'The partner closed the claim as Expired' })
  })

  it('closes a claim answered on Tern\'s side before returning it to review', () => {
    const asked = partnerClaim({ status: 'info_requested', infoRequest: 'Send the invoice' })
    expect(applyAll(asked, ternClaim({ status: 'FollowUpReceived' })).status).toBe('under_review')
  })

  it('reads Closed off the amounts, and FiledExternally as withdrawn', () => {
    expect(applyAll(partnerClaim(), ternClaim({ status: 'Closed', totalNetApprovedAmount: 220 })).status).toBe('approved')
    expect(applyAll(partnerClaim(), ternClaim({ status: 'Closed' })).status).toBe('rejected')
    expect(applyAll(partnerClaim(), ternClaim({ status: 'FiledExternally' })).status).toBe('withdrawn')
  })

  it('yields the same event ids for the same snapshot, so a second poll is refused as a duplicate', () => {
    const snapshot = ternClaim({ status: 'InReview' })
    const once = applyAll(partnerClaim(), snapshot)
    expect(applyAll(once, snapshot)).toEqual(once)
  })

  it('takes Tern\'s deductible as authoritative and recomputes the net asked for', () => {
    expect(ternClaimCorrections(ternClaim({ deductibleApplied: 50 }), partnerClaim())).toMatchObject({ deductible: 50, claimedAmount: 270, partnerStatus: 'Submitted', partnerClaimId: 7 })
    expect(ternClaimCorrections(ternClaim(), partnerClaim())).not.toHaveProperty('claimedAmount')
  })
})
