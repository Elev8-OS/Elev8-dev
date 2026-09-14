import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import CityTaxStatusChip from '~/components/city-tax/CityTaxStatusChip.vue'
import ReservationCityTaxSection from '~/components/reservations/ReservationCityTaxSection.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { useFeesTaxes } from '~/composables/useFeesTaxes'
import { useReservationsModule } from '~/composables/useReservationsModule'

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
    channelPolicy: { 'Direct': 'host', 'Airbnb': 'channel' },
    chargeableGuests: { adults: true, children: false, infants: false },
    authorityName: 'Stadt Berlin',
  },
}

function reservation(patch: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
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
    checkIn: '2026-07-10',
    checkOut: '2026-07-14',
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
}

function mountSection(entry: ReservationEntry) {
  const { reservations } = useReservationsModule()
  reservations.value = [entry, ...reservations.value.filter(r => r.id !== entry.id)]
  return mount(ReservationCityTaxSection, {
    props: { reservation: entry },
    global: {
      // Nuxt auto-imports these. Without registering them they render as
      // unresolved stubs and every text assertion passes vacuously.
      components: {
        Badge,
        Button,
        Accordion: { template: '<div><slot /></div>' },
        AccordionItem: { template: '<div><slot /></div>' },
        AccordionTrigger: { template: '<button><slot /></button>' },
        AccordionContent: { template: '<div><slot /></div>' },
      },
      stubs: {
        Icon: true,
        Separator: true,
        CityTaxCollectDialog: { template: '<div />' },
        CityTaxWaiveDialog: { template: '<div />' },
        'city-tax-collect-dialog': { template: '<div />' },
        'city-tax-waive-dialog': { template: '<div />' },
      },
    },
  })
}

beforeEach(() => {
  const fees = useFeesTaxes()
  fees.feeTaxItems.value = [structuredClone(CITY_TAX)]
  fees.taxSets.value = []
  fees.assignments.value = { 'lst-1': { feeTaxIds: ['ft-kurtaxe'], taxSetIds: [] } }
  useReservationsModule().reset()
})

describe('ReservationCityTaxSection', () => {
  it('renders nothing when no city tax applies', () => {
    useFeesTaxes().assignments.value = {}
    const wrapper = mountSection(reservation())
    expect(wrapper.find('[data-testid="city-tax-section"]').exists()).toBe(false)
  })

  it('shows the amount and the arithmetic when the host must collect', () => {
    const wrapper = mountSection(reservation())
    const text = wrapper.text()
    expect(text).toContain('EUR 24.00')
    expect(text).toContain('Kurtaxe')
    expect(text).toContain('2 guests')
    expect(text).toContain('4 nights')
    expect(text).toContain('Stadt Berlin')
  })

  it('offers collect and waive while it is due', () => {
    const wrapper = mountSection(reservation())
    expect(wrapper.find('[data-testid="city-tax-collect"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="city-tax-waive"]').exists()).toBe(true)
  })

  it('explains a channel-collected tax and offers no action, because there is none', () => {
    const wrapper = mountSection(reservation({ channel: 'Airbnb' }))
    expect(wrapper.text()).toContain('collects and remits')
    expect(wrapper.find('[data-testid="city-tax-collect"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="city-tax-waive"]').exists()).toBe(false)
  })

  it('shows the frozen settlement and an undo once collected', () => {
    const wrapper = mountSection(reservation({
      cityTaxSettlement: {
        state: 'collected',
        totals: [{ currency: 'EUR', amount: 18 }],
        settledAt: '2026-07-10T09:00:00.000Z',
        settledBy: 'Komang Juliantara',
        method: 'cash',
      },
    }))
    const text = wrapper.text()
    expect(text).toContain('EUR 18.00')
    expect(text).toContain('Komang Juliantara')
    expect(text).toContain('Cash')
    expect(wrapper.find('[data-testid="city-tax-undo"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="city-tax-collect"]').exists()).toBe(false)
  })

  it('shows the reason on a waived stay', () => {
    const wrapper = mountSection(reservation({
      cityTaxSettlement: {
        state: 'waived',
        totals: [{ currency: 'EUR', amount: 24 }],
        settledAt: '2026-07-10T09:00:00.000Z',
        settledBy: 'Komang Juliantara',
        reason: 'Business traveller',
      },
    }))
    expect(wrapper.text()).toContain('Business traveller')
  })
})

describe('CityTaxStatusChip', () => {
  function mountChip(status: string, stage: string | null = null) {
    return mount(CityTaxStatusChip, {
      props: { status: status as never, stage: stage as never },
      global: { components: { Badge }, stubs: { Icon: true } },
    })
  }

  it('renders nothing when no city tax applies, so the column stays quiet', () => {
    expect(mountChip('not_required').text()).toBe('')
  })

  it('says the channel handles it', () => {
    expect(mountChip('channel_collects').text()).toContain('Channel')
  })

  it('says due while it is still collectable', () => {
    expect(mountChip('due', 'due_today').text()).toContain('Tax due')
  })

  it('says missed once the guest has gone', () => {
    expect(mountChip('due', 'overdue').text()).toContain('Tax missed')
  })

  it('says collected once settled', () => {
    expect(mountChip('collected').text()).toContain('Collected')
  })
})
