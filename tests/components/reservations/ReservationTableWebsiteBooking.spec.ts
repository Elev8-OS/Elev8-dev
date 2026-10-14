import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import ReservationTable from '~/components/reservations/ReservationTable.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'

vi.stubGlobal('useDamageProtection', () => ({ bucketFor: () => 'not_offered' }))

const passthrough = { template: '<div><slot /></div>' }

const global = {
  stubs: {
    Icon: true,
    Badge: { template: '<span v-bind="$attrs"><slot /></span>' },
    NuxtLink: { template: '<a><slot /></a>' },
    Button: { template: '<button type="button"><slot /></button>' },
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuItem: passthrough,
    DropdownMenuSeparator: true,
    ReservationGuestCell: { template: '<div><slot name="after-name" /></div>' },
    ReservationStatusBadge: true,
    CityTaxStatusChip: true,
    DamageProtectionStatusChip: true,
  },
}

function stay(over: Partial<ReservationEntry> = {}): ReservationEntry {
  return { ...initialReservations[0]!, id: 'res-web', channel: 'Direct', checkIn: '2030-03-01', checkOut: '2030-03-04', extensions: undefined, extensionOf: undefined, activity: [], ...over }
}

describe('reservation list website booking source', () => {
  it('names the website under Direct in the channel cell', () => {
    const r = stay({
      websiteBooking: { websiteId: '1', websiteName: 'Villa Sunset Bali', websiteUrl: 'villa-sunset-bali.com', ruleSetId: null, ruleSetName: null, discounts: [] },
    })
    useReservationsModule().reservations.value = [r]
    const wrapper = mount(ReservationTable, { props: { reservations: [r] }, global })
    const row = wrapper.find('tbody tr')
    expect(row.text()).toContain('Direct')
    expect(row.text()).toContain('Villa Sunset Bali')
  })

  it('shows no website for a Direct stay without one', () => {
    const r = stay()
    useReservationsModule().reservations.value = [r]
    const wrapper = mount(ReservationTable, { props: { reservations: [r] }, global })
    expect(wrapper.find('tbody tr').text()).not.toContain('Villa Sunset Bali')
  })
})
