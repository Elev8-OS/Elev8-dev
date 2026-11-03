import type { ListingFeeTaxItem } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import ReservationTable from '~/components/reservations/ReservationTable.vue'
import { useFeesTaxes } from '~/composables/useFeesTaxes'
import { useReservationsModule } from '~/composables/useReservationsModule'

vi.stubGlobal('useDamageProtection', () => ({ bucketFor: () => 'not_offered' }))

const passthrough = { template: '<div><slot /></div>' }

// A native input stands in for the reka-ui checkbox: the table binds model-value and
// listens to update:model-value, which is all it relies on.
const Checkbox = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', !modelValue)">',
}

const global = {
  components: { Checkbox },
  stubs: {
    Icon: true,
    Badge: { template: '<span><slot /></span>' },
    NuxtLink: { template: '<a><slot /></a>' },
    Button: { template: '<button type="button"><slot /></button>' },
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuItem: passthrough,
    DropdownMenuSeparator: true,
    ReservationGuestCell: true,
    ReservationStatusBadge: true,
    CityTaxStatusChip: true,
    DamageProtectionStatusChip: true,
  },
}

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
    channelPolicy: { Direct: 'host', Airbnb: 'channel' },
    chargeableGuests: { adults: true, children: false, infants: false },
  },
}

function isoDaysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function stay(over: Partial<ReservationEntry>): ReservationEntry {
  return {
    ...initialReservations[0]!,
    listingId: 'lst-ct',
    channel: 'Direct',
    status: 'verified',
    checkIn: isoDaysFromNow(-10),
    checkOut: isoDaysFromNow(-6),
    nights: 4,
    guestAdults: 2,
    guestChildren: 0,
    guestInfants: 0,
    extensions: undefined,
    extensionOf: undefined,
    cityTaxSettlement: undefined,
    activity: [],
    ...over,
  }
}

function mountTable(rows: ReservationEntry[], props: Record<string, unknown> = {}) {
  useReservationsModule().reservations.value = rows
  return mount(ReservationTable, { props: { reservations: rows, ...props }, global })
}

beforeEach(() => {
  // Module-level refs that the useState shim does not clear.
  const fees = useFeesTaxes()
  fees.feeTaxItems.value = [structuredClone(CITY_TAX)]
  fees.taxSets.value = []
  fees.assignments.value = { 'lst-ct': { feeTaxIds: ['ft-kurtaxe'], taxSetIds: [] } }
})

describe('reservation list city tax selection', () => {
  const due = stay({ id: 'res-due', guestName: 'Due Guest' })
  const channel = stay({ id: 'res-channel', guestName: 'Channel Guest', channel: 'Airbnb' })
  const settled = stay({
    id: 'res-settled',
    guestName: 'Settled Guest',
    cityTaxSettlement: { state: 'collected', totals: [{ currency: 'EUR', amount: 24 }], settledAt: '2026-01-01T10:00:00Z', settledBy: 'Staff', method: 'cash' },
  })

  it('shows no checkbox unless the list is selectable', () => {
    const wrapper = mountTable([due])
    expect(wrapper.find('[data-testid="cell-city-tax"] input[type="checkbox"]').exists()).toBe(false)
  })

  it('offers a checkbox only on a stay whose levy is still due', () => {
    const wrapper = mountTable([due, channel, settled], { selectable: true, selected: [] })
    const cells = wrapper.findAll('[data-testid="cell-city-tax"]')
    const boxes = cells.map(cell => cell.find('input[type="checkbox"]').exists())
    const ids = wrapper.findAll('tbody tr[data-row-id]').map(tr => tr.attributes('data-row-id'))

    expect(ids).toEqual(expect.arrayContaining(['res-due', 'res-channel', 'res-settled']))
    // Only the stay the host still has to collect for.
    expect(boxes.filter(Boolean)).toHaveLength(1)
    expect(wrapper.find('[data-row-id="res-due"] input[type="checkbox"]').exists()).toBe(true)
  })

  it('adds and removes a stay from the selection, and ticks what is selected', async () => {
    const wrapper = mountTable([due], { selectable: true, selected: [] })
    await wrapper.find('[data-row-id="res-due"] input[type="checkbox"]').trigger('change')
    expect(wrapper.emitted('update:selected')?.[0]).toEqual([['res-due']])

    await wrapper.setProps({ selected: ['res-due'] })
    expect((wrapper.find('[data-row-id="res-due"] input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)

    await wrapper.find('[data-row-id="res-due"] input[type="checkbox"]').trigger('change')
    expect(wrapper.emitted('update:selected')?.[1]).toEqual([[]])
  })

  it('does not open the reservation when the checkbox is clicked', async () => {
    const wrapper = mountTable([due], { selectable: true, selected: [] })
    await wrapper.find('[data-row-id="res-due"] input[type="checkbox"]').trigger('click')
    expect(wrapper.emitted('openDetail')).toBeUndefined()
  })
})
