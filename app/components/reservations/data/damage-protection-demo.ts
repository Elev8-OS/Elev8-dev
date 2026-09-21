import type { DamageProtection, ReservationEntry } from '~/components/reservations/data/reservations'

/**
 * Demo stays that make every damage-protection bucket reachable on first load.
 *
 * Dates are RELATIVE TO TODAY, computed at module load, never fixed ISO dates:
 * every charge and refund boundary is evaluated against the current day, so a
 * fixed 2026 fixture rots into a stay that already ended.
 *
 * lst-1 and lst-2 are the two USD listings on the Stripe payout account, which
 * is what the seeded USD policies are assigned to.
 */
function day(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function iso(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString()
}

const TERMS = 'The damage waiver is a non-refundable fee. It waives your liability for accidental damage up to the stated cover. It is not insurance.'

function stay(
  patch: Partial<ReservationEntry> & Pick<ReservationEntry, 'id' | 'guestName' | 'listingId' | 'listingName'>,
): ReservationEntry {
  const nights = patch.nights ?? 5
  const subtotal = patch.priceDetails?.subtotal ?? 1000
  return {
    guestId: `guest-${patch.id}`,
    guestEmail: `${patch.guestName.split(' ')[0]?.toLowerCase()}@example.com`,
    guestPhone: '+62 812 0000 0000',
    guestLanguage: 'en',
    guestNotes: '',
    channel: 'Direct',
    checkIn: day(-nights),
    checkOut: day(0),
    nights,
    guestCount: 2,
    guestAdults: 2,
    guestChildren: 0,
    guestInfants: 0,
    totalPrice: subtotal + 300,
    currency: 'USD',
    status: 'checked_out',
    activity: [],
    priceDetails: {
      subtotal,
      cleaningFee: 300,
      serviceFee: 0,
      tax: 0,
      extras: 0,
      guestPaid: subtotal + 300,
      commission: 0,
      payout: subtotal + 300,
    },
    ...patch,
  } as ReservationEntry
}

function protection(patch: Partial<DamageProtection> & Pick<DamageProtection, 'policyId' | 'option' | 'state' | 'amount'>): DamageProtection {
  return {
    currency: 'USD',
    termsVersion: 'v1',
    termsText: TERMS,
    acceptedAt: iso(-10),
    acceptedVia: 'guest_guide',
    claims: [],
    ...patch,
  }
}

export const damageProtectionDemoReservations: ReservationEntry[] = [
  // Awaiting choice, checking in tomorrow, so the 24h alert fires.
  stay({
    id: 'res-dp-awaiting',
    guestName: 'Nadia Farrell',
    listingId: 'lst-1',
    listingName: 'The R Villa Merapi',
    checkIn: day(1),
    checkOut: day(6),
    nights: 5,
    status: 'verified',
    damageProtection: protection({
      policyId: 'dp-standard',
      option: 'waiver',
      state: 'awaiting_choice',
      amount: 0,
      acceptedAt: iso(-2),
      acceptedVia: 'staff',
    }),
  }),

  // Chosen but never charged, and the lead date has passed: Charge due.
  stay({
    id: 'res-dp-charge-due',
    guestName: 'Tobias Lang',
    listingId: 'lst-2',
    listingName: 'Villa Sanur Retreat',
    checkIn: day(1),
    checkOut: day(5),
    nights: 4,
    status: 'verified',
    damageProtection: protection({
      policyId: 'dp-deposit-only',
      option: 'deposit',
      state: 'deposit_pending',
      amount: 750,
      chargeDueAt: iso(-1),
      refundDueAt: iso(12),
      refundDestination: { method: 'original_payment_method' },
    }),
  }),

  // A held deposit carrying an UNNOTIFIED claim, so Release is visibly blocked.
  stay({
    id: 'res-dp-unnotified',
    guestName: 'Priya Raman',
    listingId: 'lst-1',
    listingName: 'The R Villa Merapi',
    status: 'checked_out',
    damageProtection: protection({
      policyId: 'dp-standard',
      option: 'deposit',
      state: 'deposit_held',
      amount: 500,
      chargedAt: iso(-8),
      payoutAccountId: 'pay-1',
      refundDueAt: iso(7),
      refundDestination: { method: 'original_payment_method' },
      claims: [{
        id: 'clm-demo-1',
        label: 'Cracked shower screen',
        amount: 180,
        coveredAmount: 180,
        excessAmount: 0,
        reason: 'Found during the check-out inspection.',
        evidenceUrls: ['/mock/evidence/shower-screen.jpg'],
        recordedBy: 'Komang Juliantara',
        recordedAt: iso(0),
        // Deliberately unnotified: this is what closes the release gate.
      }],
    }),
  }),

  // Past its refund SLA: Refund overdue.
  stay({
    id: 'res-dp-refund-overdue',
    guestName: 'Marek Nowak',
    listingId: 'lst-2',
    listingName: 'Villa Sanur Retreat',
    checkIn: day(-20),
    checkOut: day(-14),
    nights: 6,
    damageProtection: protection({
      policyId: 'dp-deposit-only',
      option: 'deposit',
      state: 'deposit_held',
      amount: 750,
      chargedAt: iso(-23),
      payoutAccountId: 'pay-1',
      refundDueAt: iso(-7),
      refundDestination: { method: 'original_payment_method' },
    }),
  }),

  // The refund itself was rejected, so the retry path is reachable.
  stay({
    id: 'res-dp-refund-failed',
    guestName: 'Ines Duarte',
    listingId: 'lst-1',
    listingName: 'The R Villa Merapi',
    checkIn: day(-18),
    checkOut: day(-12),
    nights: 6,
    damageProtection: protection({
      policyId: 'dp-standard',
      option: 'deposit',
      state: 'refund_failed',
      amount: 500,
      chargedAt: iso(-21),
      payoutAccountId: 'pay-1',
      refundDueAt: iso(-5),
      refundFailureReason: 'Refund rejected by the payment provider',
      refundDestination: { method: 'bank_transfer', accountName: 'Ines Duarte', accountNumber: '8801234567', bankName: 'BCA' },
    }),
  }),

  // A cancelled stay still holding money: Refund due IMMEDIATELY, even though
  // its check-out is months away.
  stay({
    id: 'res-dp-cancelled',
    guestName: 'Owen Whitfield',
    listingId: 'lst-1',
    listingName: 'The R Villa Merapi',
    checkIn: day(60),
    checkOut: day(65),
    nights: 5,
    status: 'cancelled',
    damageProtection: protection({
      policyId: 'dp-standard',
      option: 'deposit',
      state: 'deposit_held',
      amount: 500,
      chargedAt: iso(-1),
      payoutAccountId: 'pay-1',
      refundDueAt: iso(72),
      refundDestination: { method: 'original_payment_method' },
    }),
  }),

  // A 60-night stay: resolves to the long-stay band, waiver only, with one
  // claim so the waiver pot read-out has something in it.
  stay({
    id: 'res-dp-long-stay',
    guestName: 'Hannah Brecht',
    listingId: 'lst-1',
    listingName: 'The R Villa Merapi',
    checkIn: day(-30),
    checkOut: day(30),
    nights: 60,
    status: 'checked_in',
    priceDetails: {
      subtotal: 9000,
      cleaningFee: 300,
      serviceFee: 0,
      tax: 0,
      extras: 0,
      guestPaid: 9300,
      commission: 0,
      payout: 9300,
    },
    damageProtection: protection({
      policyId: 'dp-long-stay',
      option: 'waiver',
      state: 'waiver_active',
      amount: 249,
      coverageCap: 5000,
      termsVersion: 'v1-long',
      acceptedAt: iso(-32),
      claims: [{
        id: 'clm-demo-2',
        label: 'Scorched worktop',
        amount: 320,
        coveredAmount: 320,
        excessAmount: 0,
        reason: 'Reported at the mid-stay cleaning.',
        evidenceUrls: ['/mock/evidence/worktop.jpg'],
        recordedBy: 'Komang Juliantara',
        recordedAt: iso(-6),
        guestNotifiedAt: iso(-6),
      }],
    }),
  }),

  // An owner stay and a block on a policy-assigned Direct listing. Neither is
  // offered protection: the status gate runs before the channel policy.
  stay({
    id: 'res-dp-owner',
    guestName: 'Property Owner',
    listingId: 'lst-1',
    listingName: 'The R Villa Merapi',
    checkIn: day(20),
    checkOut: day(24),
    nights: 4,
    status: 'owner_request',
  }),
  stay({
    id: 'res-dp-block',
    guestName: 'Maintenance block',
    listingId: 'lst-2',
    listingName: 'Villa Sanur Retreat',
    checkIn: day(15),
    checkOut: day(17),
    nights: 2,
    status: 'blocked',
  }),
]
