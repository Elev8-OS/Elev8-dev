import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCityTax } from '~/composables/useCityTax'
import { useFeesTaxes } from '~/composables/useFeesTaxes'
import { useReservationsModule } from '~/composables/useReservationsModule'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const CITY_TAX: ListingFeeTaxItem = {
  id: 'ft-kurtaxe',
  title: 'Kurtaxe',
  type: 'city_tax',
  logic: 'per_person_per_night',
  rate: 3,
  currency: 'EUR',
  isInclusive: false,
  skipNights: null,
  maxNights: null,
  applicableDateRanges: [],
  cityTax: {
    channelPolicy: { 'Direct': 'host', 'Booking.com': 'host', 'Airbnb': 'channel' },
    chargeableGuests: { adults: true, children: false, infants: false },
    authorityName: 'Stadt Berlin',
  },
}

/** Dates relative to today: the alert stages are read against the current day. */
function isoDaysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function seedReservation(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  const { reservations } = useReservationsModule()
  const entry = {
    id: 'res-ct-1',
    guestId: 'guest-ct-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestPhone: '+49 170 1234567',
    guestLanguage: 'de',
    guestNotes: '',
    listingId: 'lst-1',
    listingName: 'Villa Merapi',
    channel: 'Direct',
    checkIn: isoDaysFromNow(3),
    checkOut: isoDaysFromNow(7),
    nights: 4,
    guestCount: 2,
    guestAdults: 2,
    guestChildren: 0,
    guestInfants: 0,
    totalPrice: 1000,
    currency: 'EUR',
    status: 'verified',
    activity: [],
    ...patch,
  } as ReservationEntry
  reservations.value = [entry, ...reservations.value.filter(r => r.id !== entry.id)]
  return entry
}

beforeEach(() => {
  // Module-level refs: the useState shim does not clear these.
  const fees = useFeesTaxes()
  fees.feeTaxItems.value = [structuredClone(CITY_TAX)]
  fees.taxSets.value = []
  fees.assignments.value = { 'lst-1': { feeTaxIds: ['ft-kurtaxe'], taxSetIds: [] } }
  useReservationsModule().reset()
  vi.clearAllMocks()
})

describe('assessmentFor', () => {
  it('reads the listing assignment to price the stay', () => {
    seedReservation()
    const assessment = useCityTax().assessmentFor('res-ct-1')
    expect(assessment.status).toBe('due')
    expect(assessment.totals).toEqual([{ currency: 'EUR', amount: 24 }])
  })

  it('is not required for a listing with nothing assigned', () => {
    seedReservation({ id: 'res-ct-2', listingId: 'lst-9' })
    expect(useCityTax().assessmentFor('res-ct-2').status).toBe('not_required')
  })

  it('returns a not_required assessment for an unknown reservation', () => {
    expect(useCityTax().assessmentFor('res-nope').status).toBe('not_required')
  })
})

describe('markCollected', () => {
  it('freezes the totals and records who, when and how', () => {
    seedReservation()
    const cityTax = useCityTax()
    cityTax.markCollected('res-ct-1', { method: 'cash', note: 'Paid at the desk' })

    const settlement = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.cityTaxSettlement!
    expect(settlement.state).toBe('collected')
    expect(settlement.totals).toEqual([{ currency: 'EUR', amount: 24 }])
    expect(settlement.method).toBe('cash')
    expect(settlement.note).toBe('Paid at the desk')
    expect(settlement.settledBy).toBeTruthy()
    expect(cityTax.assessmentFor('res-ct-1').status).toBe('collected')
  })

  it('keeps the frozen total when the rate changes afterwards', () => {
    seedReservation()
    useCityTax().markCollected('res-ct-1', { method: 'cash' })

    const fees = useFeesTaxes()
    fees.feeTaxItems.value = [{ ...structuredClone(CITY_TAX), rate: 99 }]

    const assessment = useCityTax().assessmentFor('res-ct-1')
    expect(assessment.settlement?.totals).toEqual([{ currency: 'EUR', amount: 24 }])
    expect(assessment.status).toBe('collected')
  })

  it('appends one activity event in the same write as the settlement', () => {
    seedReservation()
    useCityTax().markCollected('res-ct-1', { method: 'card' })

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!
    expect(reservation.activity).toHaveLength(1)
    expect(reservation.activity[0]!.title).toBe('City tax collected')
    expect(reservation.cityTaxSettlement).toBeDefined()
  })

  it('does nothing when the channel collects', () => {
    seedReservation({ channel: 'Airbnb' })
    useCityTax().markCollected('res-ct-1', { method: 'cash' })
    expect(useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.cityTaxSettlement).toBeUndefined()
  })

  it('does nothing when it is already settled', () => {
    seedReservation()
    const cityTax = useCityTax()
    cityTax.markCollected('res-ct-1', { method: 'cash' })
    cityTax.markCollected('res-ct-1', { method: 'card' })

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!
    expect(reservation.cityTaxSettlement!.method).toBe('cash')
    expect(reservation.activity).toHaveLength(1)
  })

  it('never touches priceDetails, so an owner payout cannot absorb a municipal levy', () => {
    seedReservation({
      priceDetails: { subtotal: 1000, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1000, commission: 100, payout: 900 },
    })
    useCityTax().markCollected('res-ct-1', { method: 'cash' })

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!
    expect(reservation.priceDetails).toEqual({ subtotal: 1000, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1000, commission: 100, payout: 900 })
    expect(reservation.totalPrice).toBe(1000)
    expect(reservation.folioItems).toBeUndefined()
  })
})

describe('waive', () => {
  it('records the reason', () => {
    seedReservation()
    useCityTax().waive('res-ct-1', 'Business traveller, exempt')

    const settlement = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.cityTaxSettlement!
    expect(settlement.state).toBe('waived')
    expect(settlement.reason).toBe('Business traveller, exempt')
    expect(settlement.totals).toEqual([{ currency: 'EUR', amount: 24 }])
  })

  it('refuses an empty reason', () => {
    seedReservation()
    useCityTax().waive('res-ct-1', '   ')
    expect(useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.cityTaxSettlement).toBeUndefined()
  })
})

describe('toast feedback', () => {
  it('markCollected on a stay that is genuinely due toasts success exactly once, naming the amount', () => {
    seedReservation()
    useCityTax().markCollected('res-ct-1', { method: 'cash' })

    expect(toastMock.success).toHaveBeenCalledTimes(1)
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('24'))
  })

  it('a second markCollected on the same stay does not toast success again', () => {
    seedReservation()
    const cityTax = useCityTax()
    cityTax.markCollected('res-ct-1', { method: 'cash' })
    toastMock.success.mockClear()

    cityTax.markCollected('res-ct-1', { method: 'card' })

    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('markCollected on a channel-collected stay does not toast success', () => {
    seedReservation({ channel: 'Airbnb' })
    useCityTax().markCollected('res-ct-1', { method: 'cash' })

    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('waive with a real reason toasts success once', () => {
    seedReservation()
    useCityTax().waive('res-ct-1', 'Business traveller, exempt')

    expect(toastMock.success).toHaveBeenCalledTimes(1)
  })

  it('waive on a stay that is not due does not toast success', () => {
    seedReservation({ channel: 'Airbnb' })
    useCityTax().waive('res-ct-1', 'Business traveller, exempt')

    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('waive with a blank reason toasts an error and does not toast success', () => {
    seedReservation()
    useCityTax().waive('res-ct-1', '   ')

    expect(toastMock.error).toHaveBeenCalledTimes(1)
    expect(toastMock.success).not.toHaveBeenCalled()
  })
})

describe('undoSettlement', () => {
  it('puts the stay back to due and logs the reopen', () => {
    seedReservation()
    const cityTax = useCityTax()
    cityTax.markCollected('res-ct-1', { method: 'cash' })
    cityTax.undoSettlement('res-ct-1')

    const reservation = useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!
    expect(reservation.cityTaxSettlement).toBeUndefined()
    expect(cityTax.assessmentFor('res-ct-1').status).toBe('due')
    expect(reservation.activity.at(-1)!.title).toBe('City tax reopened')
  })

  it('does nothing when there is no settlement to undo', () => {
    seedReservation()
    useCityTax().undoSettlement('res-ct-1')
    expect(useReservationsModule().reservations.value.find(r => r.id === 'res-ct-1')!.activity).toHaveLength(0)
  })
})
