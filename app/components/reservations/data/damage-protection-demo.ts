import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { DamageProtection, PartnerClaim, PartnerClaimEvent, ProtectionClaim, ReservationEntry, SavedCard } from '~/components/reservations/data/reservations'
import { chargeMandateText } from '~/components/reservations/data/damage-protection'
import { elev8CoverPartner, seedProtectionPolicies } from '~/components/reservations/data/damage-protection-seed'

/**
 * Demo stays that make every damage-protection bucket reachable on first load.
 *
 * Dates are RELATIVE TO TODAY, computed at module load, never fixed ISO dates:
 * every decision deadline is evaluated against the current day, so a
 * fixed 2026 fixture rots into a stay that already ended.
 *
 * lst-1 and lst-2 are the two USD listings on the Stripe payout account, which
 * is what the seeded USD policies are assigned to. lst-1 is a multi-unit villa,
 * so its stays overlapping one another is normal, not a double booking.
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

/**
 * A Bali wall-clock time `offset` days from today, written with its `+08:00`
 * offset like every other cleaning seed. Never `toISOString()`: the calendar
 * chip reads the time straight off the string, so a `Z` time printed 11:00 as
 * 03:00.
 */
function at(offset: number, hours: number, minutes = 0): string {
  return `${day(offset)}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`
}

/**
 * The listings' own names for lst-1 and lst-2 (`listings/data/listings.ts`).
 * These stays used to say "The R Villa Merapi" and "Villa Sanur Retreat", which
 * are not the names of those ids (Merapi is lst-4), so the Reservations page and
 * the Operations Calendar named the same stay's property differently. They stay
 * on lst-1 and lst-2 because that is where the USD policies and the Stripe
 * payout account are assigned.
 */
const LST_1 = '5BR Pool the R Villa Luwa – Serene near Canggu'
const LST_2 = 'Apartments Pool'
/**
 * Where the 60-night stay lives. It used to share lst-1, where it overlapped
 * every other demo stay for two months. Room 3 is free across the whole
 * window, sits in the same Seminyak Suites property as lst-2, and is on the
 * same USD payout account, so the USD long-stay policy applies to it.
 */
const LST_18 = 'Apartments Pool - Room 3'

// The check-out cleaning of res-dp-unnotified. Its shower-screen problem is
// already on a claim and the sofa problem is still open, so the claim dialog
// shows a claimed finding next to a pickable one.
const UNNOTIFIED_CLEANING_ID = 'cln-dp-unnotified'
const UNNOTIFIED_CLEANING_DONE = at(0, 13, 30)

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

/** A card saved with Stripe: a reference and the last four digits, never the number. */
function card(last4: string, brand = 'visa'): SavedCard {
  return { provider: 'stripe', paymentMethodId: `pm_mock_${last4}`, brand, last4, expMonth: 12, expYear: 2028, savedAt: iso(-10) }
}

/**
 * The deposit fields every card-on-file demo stay shares, including the terms
 * text of the policy it was accepted under: the evidence PDF prints it, so a
 * deposit must not carry the waiver's wording.
 */
function deposit(amount: number, settleOffset: number, last4: string, policyId = 'dp-standard'): Pick<DamageProtection, 'option' | 'amount'> & Partial<DamageProtection> {
  return {
    termsText: seedProtectionPolicies.find(p => p.id === policyId)?.termsText ?? TERMS,
    option: 'deposit',
    amount,
    card: card(last4),
    chargeMandate: chargeMandateText(amount, 'USD', 7),
    payoutAccountId: 'pay-1',
    settleDueAt: iso(settleOffset),
  }
}

/**
 * An insurance claim with the demo partner, frozen the way `newPartnerClaim`
 * freezes one: the deductible and policy number as they stood at submission.
 */
function filed(claimedAmount: number, events: [number, PartnerClaimEvent['status'], PartnerClaimEvent['source'], string?][], patch: Partial<PartnerClaim>): PartnerClaim {
  return {
    partnerId: elev8CoverPartner.id,
    partnerName: elev8CoverPartner.name,
    policyNumber: elev8CoverPartner.policyNumber,
    currency: 'USD',
    claimedAmount,
    deductible: elev8CoverPartner.deductiblePerClaim,
    // The bank account the demo tenant registered at activation (`seedTernActivation`).
    payoutAccountId: 'tern_org_demo_0001',
    payoutAccountName: 'Bank Central Asia (BCA) •••• 3456',
    status: 'submitted',
    events: events.map(([offset, status, source, note], i) => ({
      id: `evt-demo-${claimedAmount}-${i}`,
      at: iso(offset),
      status,
      source,
      ...(note ? { note } : {}),
    })),
    ...patch,
  }
}

/** A notified waiver claim: the waiver covers it, the guest pays nothing. */
function waiverClaim(id: string, label: string, amount: number, offset: number, partnerClaim?: PartnerClaim): ProtectionClaim {
  return {
    id,
    label,
    amount,
    coveredAmount: amount,
    excessAmount: 0,
    reason: 'Found at the check-out inspection.',
    evidenceUrls: [`/mock/evidence/${id}.jpg`],
    recordedBy: 'Komang Juliantara',
    recordedAt: iso(offset),
    guestNotifiedAt: iso(offset),
    ...(partnerClaim ? { partnerClaim } : {}),
  }
}

/** A waiver stay on lst-1: fee paid, cover 2000, under the standard policy. */
function waiverStay(id: string, guestName: string, checkIn: number, checkOut: number, claims: ProtectionClaim[]): ReservationEntry {
  return stay({
    id,
    guestName,
    listingId: 'lst-1',
    listingName: LST_1,
    checkIn: day(checkIn),
    checkOut: day(checkOut),
    nights: checkOut - checkIn,
    damageProtection: protection({
      policyId: 'dp-standard',
      option: 'waiver',
      state: 'waiver_active',
      amount: 39,
      coverageCap: 2000,
      paidBy: 'guest',
      tier: 'bronze',
      elev8Fee: 9,
      termsText: seedProtectionPolicies.find(p => p.id === 'dp-standard')!.termsText,
      acceptedAt: iso(checkIn - 5),
      claims,
    }),
  })
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
    listingName: LST_1,
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

  // Card saved, arriving tomorrow: On file, nothing to do yet.
  stay({
    id: 'res-dp-card-on-file',
    guestName: 'Tobias Lang',
    listingId: 'lst-2',
    listingName: LST_2,
    checkIn: day(1),
    checkOut: day(5),
    nights: 4,
    status: 'verified',
    damageProtection: protection({
      policyId: 'dp-deposit-only',
      state: 'card_on_file',
      ...deposit(750, 12, '4242', 'dp-deposit-only'),
    }),
  }),

  // Checked out today with an UNNOTIFIED claim, so the charge is visibly blocked.
  stay({
    id: 'res-dp-unnotified',
    guestName: 'Priya Raman',
    listingId: 'lst-1',
    listingName: LST_1,
    status: 'checked_out',
    damageProtection: protection({
      policyId: 'dp-standard',
      state: 'card_on_file',
      ...deposit(500, 7, '5556'),
      card: card('5556', 'mastercard'),
      claims: [{
        id: 'clm-demo-1',
        label: 'Cracked shower screen',
        amount: 180,
        coveredAmount: 180,
        excessAmount: 0,
        reason: 'Reported by Made Surya in the check-out cleaning: Cracked shower screen, glass split from the bottom corner.',
        // Both kinds of evidence at once: the cleaning report and an upload.
        evidenceUrls: ['/mock/evidence/shower-screen.jpg'],
        cleaningReport: {
          cleaningJobId: UNNOTIFIED_CLEANING_ID,
          findingId: `${UNNOTIFIED_CLEANING_ID}:problem:b-1`,
          finding: 'Cracked shower screen, glass split from the bottom corner',
          checklistItem: 'Clean shower, bath and basin',
          photoUrls: ['https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800'],
          cleaningLabel: 'Check-out cleaning',
          reportedBy: 'Made Surya',
          reportedAt: UNNOTIFIED_CLEANING_DONE,
        },
        recordedBy: 'Komang Juliantara',
        recordedAt: iso(0),
        // Deliberately unnotified: this is what closes the settle gate.
      }],
    }),
  }),

  // Past the promised decision date with nothing recorded: Decision overdue,
  // and the fix is one click (close without charging).
  stay({
    id: 'res-dp-decision-overdue',
    guestName: 'Marek Nowak',
    listingId: 'lst-2',
    listingName: LST_2,
    checkIn: day(-20),
    checkOut: day(-14),
    nights: 6,
    damageProtection: protection({
      policyId: 'dp-deposit-only',
      state: 'card_on_file',
      ...deposit(750, -7, '1881', 'dp-deposit-only'),
    }),
  }),

  // The charge to the saved card was declined, so the retry path is reachable.
  // Its claim was notified, which is what let the charge be attempted at all.
  stay({
    id: 'res-dp-charge-failed',
    guestName: 'Ines Duarte',
    listingId: 'lst-1',
    listingName: LST_1,
    checkIn: day(-18),
    checkOut: day(-12),
    nights: 6,
    damageProtection: protection({
      policyId: 'dp-standard',
      state: 'charge_failed',
      ...deposit(500, -5, '0341'),
      chargeFailureReason: 'Card declined by issuer',
      chargeAttempts: 1,
      claims: [{
        id: 'clm-demo-3',
        label: 'Stained sofa cushion',
        amount: 95,
        coveredAmount: 95,
        excessAmount: 0,
        reason: 'Red wine stain found at the check-out inspection.',
        evidenceUrls: ['/mock/evidence/sofa-stain.jpg'],
        recordedBy: 'Komang Juliantara',
        recordedAt: iso(-12),
        guestNotifiedAt: iso(-11),
      }],
    }),
  }),

  // A cancelled stay with a card still on file: release it now, not at a
  // check-out months away that is never going to happen.
  stay({
    id: 'res-dp-cancelled',
    guestName: 'Owen Whitfield',
    listingId: 'lst-1',
    listingName: LST_1,
    checkIn: day(60),
    checkOut: day(65),
    nights: 5,
    status: 'cancelled',
    damageProtection: protection({
      policyId: 'dp-standard',
      state: 'card_on_file',
      ...deposit(500, 72, '7007'),
    }),
  }),

  // A 60-night stay: resolves to the long-stay band, waiver only, with one
  // claim so the waiver pot read-out has something in it.
  stay({
    id: 'res-dp-long-stay',
    guestName: 'Hannah Brecht',
    listingId: 'lst-18',
    listingName: LST_18,
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
      paidBy: 'guest',
      tier: 'silver',
      elev8Fee: 15,
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
        // With the insurance partner, who wants more before deciding: the
        // "action needed" state.
        partnerClaim: filed(220, [
          [-5, 'submitting', 'staff'],
          [-5, 'submitted', 'api'],
          [-3, 'under_review', 'webhook'],
          [-1, 'info_requested', 'webhook', 'Please send the repair invoice'],
        ], {
          status: 'info_requested',
          partnerClaimRef: 'PC-240117',
          submittedAt: iso(-5),
          infoRequest: 'Please send the repair invoice and a photo of the worktop before repair.',
        }),
      }],
    }),
  }),

  // --- Waiver claims and the insurance partner ----------------------------
  // Every partner status reachable on load. All past stays on lst-1 (a
  // multi-unit villa), all waivers with a notified claim.

  // Eligible and never filed: To submit. USD 280 covered, 180 above the deductible.
  waiverStay('res-dp-ins-to-submit', 'Amara Okafor', -10, -6, [
    waiverClaim('clm-ins-1', 'Burnt kitchen worktop', 280, -6),
  ]),

  // Approved 20 days ago on 14-day terms and still not paid: payout overdue.
  waiverStay('res-dp-ins-overdue', 'Mei Tanaka', -45, -41, [
    waiverClaim('clm-ins-2', 'Cracked bathroom mirror', 300, -41, filed(200, [
      [-40, 'submitting', 'staff'],
      [-40, 'submitted', 'api'],
      [-30, 'under_review', 'webhook'],
      [-20, 'approved', 'webhook'],
    ], { status: 'approved', partnerClaimRef: 'PC-238802', submittedAt: iso(-40), approvedAmount: 200 })),
  ]),

  // The partner says it paid; nobody has confirmed it landed: Confirm receipt.
  waiverStay('res-dp-ins-paid', 'Lucas Moreau', -40, -35, [
    waiverClaim('clm-ins-3', 'Broken glass table', 450, -35, filed(350, [
      [-34, 'submitting', 'staff'],
      [-34, 'submitted', 'api'],
      [-25, 'approved', 'webhook'],
      [-18, 'payout_scheduled', 'webhook'],
      [-2, 'paid', 'webhook'],
    ], {
      status: 'paid',
      partnerClaimRef: 'PC-239011',
      submittedAt: iso(-34),
      approvedAmount: 350,
      payoutScheduledFor: iso(-2),
      paidAmount: 350,
      paidAt: iso(-2),
      payoutReference: 'TRF-88120431',
    })),
  ]),

  // Partly approved, paid, and USD 15 short on arrival (a bank fee): Closed,
  // with the shortfall flagged.
  waiverStay('res-dp-ins-received', 'Sofia Rossi', -70, -65, [
    waiverClaim('clm-ins-4', 'Water damage to parquet', 900, -65, filed(800, [
      [-64, 'submitting', 'staff'],
      [-64, 'submitted', 'api'],
      [-50, 'partially_approved', 'webhook', 'Approved 600 of 800: sanding covered, full replacement not'],
      [-38, 'paid', 'webhook'],
      [-36, 'received', 'staff', 'USD 585.00'],
    ], {
      status: 'received',
      partnerClaimRef: 'PC-236540',
      submittedAt: iso(-64),
      approvedAmount: 600,
      paidAmount: 600,
      paidAt: iso(-38),
      payoutReference: 'TRF-87310094',
      receivedAmount: 585,
      receivedAt: iso(-36),
    })),
  ]),

  // Rejected: the pot carries it.
  waiverStay('res-dp-ins-rejected', 'Daniel Kim', -55, -50, [
    waiverClaim('clm-ins-5', 'Worn sofa fabric', 250, -50, filed(150, [
      [-49, 'submitting', 'staff'],
      [-49, 'submitted', 'api'],
      [-44, 'rejected', 'webhook', 'Wear and tear is excluded'],
    ], {
      status: 'rejected',
      partnerClaimRef: 'PC-237712',
      submittedAt: iso(-49),
      rejectionReason: 'Wear and tear is excluded under the policy.',
    })),
  ]),

  // Below the USD 100 deductible: never the partner's, so it is not on their list.
  waiverStay('res-dp-ins-below', 'Jonas Berg', -25, -21, [
    waiverClaim('clm-ins-6', 'Chipped mug set', 60, -21),
  ]),

  // An owner stay and a block on a policy-assigned Direct listing. Neither is
  // offered protection: the status gate runs before the channel policy.
  stay({
    id: 'res-dp-owner',
    guestName: 'Property Owner',
    listingId: 'lst-1',
    listingName: LST_1,
    checkIn: day(20),
    checkOut: day(24),
    nights: 4,
    status: 'owner_request',
  }),
  stay({
    id: 'res-dp-block',
    guestName: 'Maintenance block',
    listingId: 'lst-2',
    listingName: LST_2,
    checkIn: day(15),
    checkOut: day(17),
    nights: 2,
    status: 'blocked',
  }),
]

/**
 * Cleaning reports linked to the demo stays by `reservationId`, which is the
 * only link the claim dialog trusts. Appended to the cleaning seed.
 */
export const damageProtectionDemoCleaningJobs: CleaningJob[] = [
  {
    id: UNNOTIFIED_CLEANING_ID,
    listingId: 'lst-1',
    listingName: LST_1,
    scheduledAt: at(0, 11),
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'high',
    durationMinutes: 150,
    notes: 'Check-out cleaning, Priya Raman',
    source: 'check_out',
    reservationId: 'res-dp-unnotified',
    recurrence: null,
    feedback: {
      supervisorName: 'Made Surya',
      supervisorRole: 'Housekeeping',
      startedAt: at(0, 11),
      confirmedAt: UNNOTIFIED_CLEANING_DONE,
      checklist: [
        {
          id: 'living',
          title: 'Living room',
          items: [
            { id: 'l-1', label: 'Vacuum and mop floors', status: 'ok', completedBy: 'Made Surya', completedAt: at(0, 11, 40) },
            { id: 'l-2', label: 'Check furniture and soft furnishings', status: 'problem', notes: 'Sofa cushion cover torn along the seam', photoUrls: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800'], completedBy: 'Made Surya', completedAt: at(0, 12) },
          ],
        },
        {
          id: 'bath',
          title: 'Bathroom',
          items: [
            { id: 'b-1', label: 'Clean shower, bath and basin', status: 'problem', notes: 'Cracked shower screen, glass split from the bottom corner', photoUrls: ['https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800'], completedBy: 'Made Surya', completedAt: at(0, 12, 30) },
            { id: 'b-2', label: 'Replace towels and bath mat', status: 'ok', completedBy: 'Made Surya', completedAt: at(0, 12, 40) },
          ],
        },
      ],
      cleanlinessRating: 3,
      conditionNotes: 'Generally tidy, two items damaged.',
      damages: [
        'Cracked shower screen, glass split from the bottom corner',
        'Red wine stain on the living room rug',
      ],
      itemsLeft: [],
      cleaningDurationMinutes: 150,
      housekeeperNotes: 'Rug needs a professional clean. Shower unusable until the screen is replaced.',
    },
  },
]
