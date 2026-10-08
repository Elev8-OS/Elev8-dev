import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { GuestProfile, ReservationEntry, ReservationStatus, StayExtension } from '~/components/reservations/data/reservations'

/**
 * Demo stays with extensions, so the extension icon, the linked child rows,
 * the "Extended" / "Unpaid extension" filters and the export's period split
 * all have something to show on first load. Shaped exactly like what
 * `extendReservation` (Direct, in place) and `extendViaLinkedBooking` (OTA,
 * linked Direct booking) write. See docs/claude/stay-extension.md.
 *
 * Dates are RELATIVE TO TODAY, computed at module load (same rule as
 * damage-protection-demo.ts). The month-crossing stay is anchored to the end
 * of the current month, so it always runs from about the 29th to the 3rd.
 *
 * Includes an Airbnb stay with an early arrival (nights before the Airbnb
 * check-in on a linked Direct booking).
 *
 * Single-unit listings only (lst-8, lst-11, lst-13), clear of every other
 * seed stay, so no unit conflict is possible.
 */

const ACTOR = 'Komang Juliantara'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function day(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return ymd(d)
}

/** `offset` days from the last day of the current month. */
function fromMonthEnd(offset: number): string {
  const now = new Date()
  return ymd(new Date(now.getFullYear(), now.getMonth() + 1, offset))
}

function iso(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString()
}

/** One status for the whole guest stay (the stay and its linked bookings). */
function statusFor(checkIn: string, checkOut: string): ReservationStatus {
  const today = day(0)
  if (today < checkIn)
    return 'verified'
  return today >= checkOut ? 'checked_out' : 'checked_in'
}

function event(id: string, title: string, description: string, at: string): ActivityEvent {
  return { id, type: 'reservation', title, description, actor: ACTOR, timestamp: at, colorDot: 'blue' }
}

function extension(patch: Omit<StayExtension, 'createdBy'>): StayExtension {
  return { createdBy: ACTOR, ...patch }
}

const base = {
  guestLanguage: 'en',
  guestNotes: '',
  guestCount: 2,
  guestAdults: 2,
  guestChildren: 0,
  guestInfants: 0,
}

// --- 1. Direct, in place, paid, crossing the month end -----------------------
// Booked 29th to the 1st (3 nights), extended to the 3rd: the two added nights
// fall in next month. The case the export's "in period" columns exist for.

const crossIn = fromMonthEnd(-2)
const crossOut0 = fromMonthEnd(1)
const crossOut = fromMonthEnd(3)

const directCrossing: ReservationEntry = {
  ...base,
  id: 'res-ext-direct-paid',
  guestId: 'guest-ext-1',
  guestName: 'Hannah Becker',
  guestEmail: 'hannah.becker@example.com',
  guestPhone: '+49 151 2345 6789',
  guestCountry: 'DE',
  listingId: 'lst-13',
  listingName: 'Volcano View Villa Kintamani',
  channel: 'Direct',
  checkIn: crossIn,
  checkOut: crossOut,
  nights: 5,
  totalPrice: 800,
  currency: 'USD',
  priceDetails: { subtotal: 750, cleaningFee: 50, serviceFee: 0, tax: 0, extras: 0, guestPaid: 800, commission: 0, payout: 800 },
  status: statusFor(crossIn, crossOut),
  extensions: [
    extension({
      id: 'ext-demo-direct-paid',
      previousCheckOut: crossOut0,
      newCheckOut: crossOut,
      extraNights: 2,
      nightlyRate: 150,
      amount: 300,
      currency: 'USD',
      paymentMethod: 'already_paid',
      paymentStatus: 'paid',
      paidAt: iso(-1),
      createdAt: iso(-1),
    }),
  ],
  activity: [
    event('act-ext-1-created', 'Reservation created', `Direct booking, ${crossIn} to ${crossOut0}`, iso(-20)),
    event('act-ext-1-extend', 'Stay extended', `2 nights added, check-out moved from ${crossOut0} to ${crossOut} · USD 300.00`, iso(-1)),
  ],
}

// --- 2. Direct, in place, in house, payment pending -------------------------
// The amber icon and the "Unpaid extension" filter. guestPaid has not moved:
// it waits for "Mark paid".

const pendingIn = day(-3)
const pendingOut0 = day(1)
const pendingOut = day(3)

const directPending: ReservationEntry = {
  ...base,
  id: 'res-ext-direct-pending',
  guestId: 'guest-ext-2',
  guestName: 'Wayan Prasetyo',
  guestEmail: 'wayan.prasetyo@example.com',
  guestPhone: '+62 812 3456 7890',
  guestCountry: 'ID',
  listingId: 'lst-11',
  listingName: 'Villa Rice Terrace Jimbaran',
  channel: 'Direct',
  checkIn: pendingIn,
  checkOut: pendingOut,
  nights: 6,
  totalPrice: 11_150_000,
  currency: 'IDR',
  priceDetails: { subtotal: 10_800_000, cleaningFee: 350_000, serviceFee: 0, tax: 0, extras: 0, guestPaid: 7_550_000, commission: 0, payout: 11_150_000 },
  status: statusFor(pendingIn, pendingOut),
  extensions: [
    extension({
      id: 'ext-demo-direct-pending',
      previousCheckOut: pendingOut0,
      newCheckOut: pendingOut,
      extraNights: 2,
      nightlyRate: 1_800_000,
      amount: 3_600_000,
      currency: 'IDR',
      paymentMethod: 'payment_link',
      paymentStatus: 'pending',
      createdAt: iso(0),
    }),
  ],
  activity: [
    event('act-ext-2-created', 'Reservation created', `Direct booking, ${pendingIn} to ${pendingOut0}`, iso(-14)),
    event('act-ext-2-extend', 'Stay extended', `2 nights added, check-out moved from ${pendingOut0} to ${pendingOut} · IDR 3,600,000 (payment pending)`, iso(0)),
  ],
}

// --- 3. Airbnb, linked Direct booking, paid, past ---------------------------
// The Airbnb booking is never rewritten; the added nights are their own
// Direct booking, drawn as a child row.

const airIn = day(-12)
const airOut = day(-7)
const airExtOut = day(-5)
const airStatus = statusFor(airIn, airExtOut)

const airbnbStay: ReservationEntry = {
  ...base,
  id: 'res-ext-airbnb',
  guestId: 'guest-ext-3',
  guestName: 'Liam O\'Connor',
  guestEmail: 'liam.oconnor@example.com',
  guestPhone: '+353 87 123 4567',
  guestCountry: 'IE',
  listingId: 'lst-8',
  listingName: 'Villa Sunset Cliff',
  channel: 'Airbnb',
  checkIn: airIn,
  checkOut: airOut,
  nights: 5,
  totalPrice: 690,
  currency: 'USD',
  priceDetails: { subtotal: 650, cleaningFee: 40, serviceFee: 0, tax: 0, extras: 0, guestPaid: 690, commission: 103.5, payout: 586.5 },
  status: airStatus,
  extensions: [
    extension({
      id: 'ext-demo-airbnb',
      previousCheckOut: airOut,
      newCheckOut: airExtOut,
      extraNights: 2,
      nightlyRate: 130,
      amount: 260,
      currency: 'USD',
      paymentMethod: 'payment_link',
      paymentStatus: 'paid',
      paidAt: iso(-8),
      linkedReservationId: 'res-ext-airbnb-x1',
      createdAt: iso(-9),
    }),
  ],
  activity: [
    event('act-ext-3-created', 'Reservation created', `Airbnb booking, ${airIn} to ${airOut}`, iso(-40)),
    event('act-ext-3-extend', 'Stay extended', `2 nights added from ${airOut} to ${airExtOut} as direct booking res-ext-airbnb-x1, the Airbnb reservation is unchanged · USD 260.00`, iso(-9)),
    event('act-ext-3-paid', 'Extension paid', 'USD 260.00 for 2 added nights', iso(-8)),
  ],
}

const airbnbLinked: ReservationEntry = {
  ...base,
  id: 'res-ext-airbnb-x1',
  guestId: airbnbStay.guestId,
  guestName: airbnbStay.guestName,
  guestEmail: airbnbStay.guestEmail,
  guestPhone: airbnbStay.guestPhone,
  guestCountry: airbnbStay.guestCountry,
  listingId: airbnbStay.listingId,
  listingName: airbnbStay.listingName,
  channel: 'Direct',
  checkIn: airOut,
  checkOut: airExtOut,
  nights: 2,
  totalPrice: 260,
  currency: 'USD',
  priceDetails: { subtotal: 260, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 260, commission: 0, payout: 260 },
  status: airStatus,
  bookingNote: 'Extension of Airbnb reservation res-ext-airbnb.',
  extensionOf: 'res-ext-airbnb',
  activity: [
    event('act-ext-3x-created', 'Created as an extension', '2 nights added to Airbnb reservation res-ext-airbnb', iso(-9)),
  ],
}

// --- 4. Booking.com, extended twice (chained), second still unpaid ----------
// Each extension starts where the previous linked booking ends.

const bdcIn = day(5)
const bdcOut = day(9)
const bdcExt1Out = day(11)
const bdcExt2Out = day(12)
const bdcStatus = statusFor(bdcIn, bdcExt2Out)

const bookingStay: ReservationEntry = {
  ...base,
  id: 'res-ext-bdc',
  guestId: 'guest-ext-4',
  guestName: 'Sophie Laurent',
  guestEmail: 'sophie.laurent@example.com',
  guestPhone: '+33 6 12 34 56 78',
  guestCountry: 'FR',
  listingId: 'lst-11',
  listingName: 'Villa Rice Terrace Jimbaran',
  channel: 'Booking.com',
  checkIn: bdcIn,
  checkOut: bdcOut,
  nights: 4,
  totalPrice: 595,
  currency: 'EUR',
  priceDetails: { subtotal: 560, cleaningFee: 35, serviceFee: 0, tax: 0, extras: 0, guestPaid: 595, commission: 89.25, payout: 505.75 },
  status: bdcStatus,
  extensions: [
    extension({
      id: 'ext-demo-bdc-1',
      previousCheckOut: bdcOut,
      newCheckOut: bdcExt1Out,
      extraNights: 2,
      nightlyRate: 140,
      amount: 280,
      currency: 'EUR',
      paymentMethod: 'already_paid',
      paymentStatus: 'paid',
      paidAt: iso(-3),
      linkedReservationId: 'res-ext-bdc-x1',
      createdAt: iso(-3),
    }),
    extension({
      id: 'ext-demo-bdc-2',
      previousCheckOut: bdcExt1Out,
      newCheckOut: bdcExt2Out,
      extraNights: 1,
      nightlyRate: 140,
      amount: 140,
      currency: 'EUR',
      paymentMethod: 'at_property',
      paymentStatus: 'pending',
      linkedReservationId: 'res-ext-bdc-x2',
      createdAt: iso(-1),
    }),
  ],
  activity: [
    event('act-ext-4-created', 'Reservation created', `Booking.com booking, ${bdcIn} to ${bdcOut}`, iso(-30)),
    event('act-ext-4-extend-1', 'Stay extended', `2 nights added from ${bdcOut} to ${bdcExt1Out} as direct booking res-ext-bdc-x1, the Booking.com reservation is unchanged · EUR 280.00`, iso(-3)),
    event('act-ext-4-extend-2', 'Stay extended', `1 night added from ${bdcExt1Out} to ${bdcExt2Out} as direct booking res-ext-bdc-x2, the Booking.com reservation is unchanged · EUR 140.00 (payment pending)`, iso(-1)),
  ],
}

function bookingLinked(id: string, checkIn: string, checkOut: string, nights: number, paid: boolean, at: string): ReservationEntry {
  const amount = 140 * nights
  return {
    ...base,
    id,
    guestId: bookingStay.guestId,
    guestName: bookingStay.guestName,
    guestEmail: bookingStay.guestEmail,
    guestPhone: bookingStay.guestPhone,
    guestCountry: bookingStay.guestCountry,
    listingId: bookingStay.listingId,
    listingName: bookingStay.listingName,
    channel: 'Direct',
    checkIn,
    checkOut,
    nights,
    totalPrice: amount,
    currency: 'EUR',
    priceDetails: { subtotal: amount, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: paid ? amount : 0, commission: 0, payout: amount },
    status: bdcStatus,
    bookingNote: 'Extension of Booking.com reservation res-ext-bdc.',
    extensionOf: 'res-ext-bdc',
    activity: [
      event(`act-${id}-created`, 'Created as an extension', `${nights} night${nights === 1 ? '' : 's'} added to Booking.com reservation res-ext-bdc`, at),
    ],
  }
}

// --- 5. Airbnb, early arrival, linked Direct booking, unpaid, upcoming -------
// The guest booked on Airbnb from the 5th and asked to come on the 3rd: the
// nights before the Airbnb check-in are a Direct booking ending on it.

const earlyIn = day(16)
const earlyAirIn = day(18)
const earlyAirOut = day(23)
const earlyStatus = statusFor(earlyIn, earlyAirOut)

const earlyArrivalStay: ReservationEntry = {
  ...base,
  id: 'res-ext-early',
  guestId: 'guest-ext-5',
  guestName: 'Mia Hoffmann',
  guestEmail: 'mia.hoffmann@example.com',
  guestPhone: '+49 151 2345 6789',
  guestCountry: 'DE',
  listingId: 'lst-11',
  listingName: 'Villa Rice Terrace Jimbaran',
  channel: 'Airbnb',
  checkIn: earlyAirIn,
  checkOut: earlyAirOut,
  nights: 5,
  totalPrice: 760,
  currency: 'USD',
  priceDetails: { subtotal: 720, cleaningFee: 40, serviceFee: 0, tax: 0, extras: 0, guestPaid: 760, commission: 114, payout: 646 },
  status: earlyStatus,
  extensions: [
    extension({
      id: 'ext-demo-early',
      direction: 'before',
      previousCheckIn: earlyAirIn,
      newCheckIn: earlyIn,
      extraNights: 2,
      nightlyRate: 144,
      amount: 288,
      currency: 'USD',
      paymentMethod: 'at_property',
      paymentStatus: 'pending',
      linkedReservationId: 'res-ext-early-x1',
      createdAt: iso(-2),
    }),
  ],
  activity: [
    event('act-ext-5-created', 'Reservation created', `Airbnb booking, ${earlyAirIn} to ${earlyAirOut}`, iso(-30)),
    event('act-ext-5-early', 'Early arrival', `2 nights added from ${earlyIn} to ${earlyAirIn} as direct booking res-ext-early-x1, the Airbnb reservation is unchanged · USD 288.00 (payment pending)`, iso(-2)),
  ],
}

const earlyArrivalLinked: ReservationEntry = {
  ...base,
  id: 'res-ext-early-x1',
  guestId: earlyArrivalStay.guestId,
  guestName: earlyArrivalStay.guestName,
  guestEmail: earlyArrivalStay.guestEmail,
  guestPhone: earlyArrivalStay.guestPhone,
  guestCountry: earlyArrivalStay.guestCountry,
  listingId: earlyArrivalStay.listingId,
  listingName: earlyArrivalStay.listingName,
  channel: 'Direct',
  checkIn: earlyIn,
  checkOut: earlyAirIn,
  nights: 2,
  totalPrice: 288,
  currency: 'USD',
  priceDetails: { subtotal: 288, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 0, commission: 0, payout: 288 },
  status: earlyStatus,
  bookingNote: 'Early arrival for Airbnb reservation res-ext-early.',
  extensionOf: 'res-ext-early',
  activity: [
    event('act-ext-5x-created', 'Created as an early arrival', '2 nights before Airbnb reservation res-ext-early', iso(-2)),
  ],
}

export const stayExtensionDemoReservations: ReservationEntry[] = [
  directCrossing,
  directPending,
  airbnbStay,
  airbnbLinked,
  bookingStay,
  bookingLinked('res-ext-bdc-x1', bdcOut, bdcExt1Out, 2, true, iso(-3)),
  bookingLinked('res-ext-bdc-x2', bdcExt1Out, bdcExt2Out, 1, false, iso(-1)),
  earlyArrivalStay,
  earlyArrivalLinked,
]

/** Profiles for the demo guests, so their names open the guest page. */
export const stayExtensionDemoGuests: GuestProfile[] = [directCrossing, directPending, airbnbStay, bookingStay, earlyArrivalStay].map(r => ({
  id: r.guestId,
  name: r.guestName,
  email: r.guestEmail,
  phone: r.guestPhone,
  language: r.guestLanguage,
  notes: '',
  previousStays: 0,
  tags: ['Extended stay'],
  createdAt: (r.activity[0]?.timestamp ?? iso(0)).slice(0, 10),
}))
