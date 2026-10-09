import type { ReservationEntry, StayExtension } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import ReservationTable from '~/components/reservations/ReservationTable.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'

// The table auto-imports this; its chip is stubbed, so only the call shape matters.
const buckets: Record<string, string> = {}
vi.stubGlobal('useDamageProtection', () => ({ bucketFor: (id: string) => buckets[id] ?? 'not_offered' }))

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
  return { ...initialReservations[0]!, id: 'res-ota', channel: 'Airbnb', checkIn: '2030-03-01', checkOut: '2030-03-04', extensions: undefined, extensionOf: undefined, activity: [], ...over }
}

function extension(over: Partial<StayExtension> = {}): StayExtension {
  return { id: 'ext-1', previousCheckOut: '2030-03-04', newCheckOut: '2030-03-06', extraNights: 2, nightlyRate: 100, amount: 200, currency: 'USD', paymentMethod: 'at_property', paymentStatus: 'pending', linkedReservationId: 'res-direct', createdAt: '', createdBy: '', ...over }
}

describe('reservation list extension indicators', () => {
  it('draws the extension booking as a child row under its stay', () => {
    const parent = stay({ extensions: [extension()] })
    const linked = stay({ id: 'res-direct', channel: 'Direct', checkIn: '2030-03-04', checkOut: '2030-03-06', extensionOf: 'res-ota' })
    const other = stay({ id: 'res-other', guestName: 'Zed', channel: 'Direct', checkIn: '2030-03-02', checkOut: '2030-03-03' })
    useReservationsModule().reservations.value = [linked, other, parent]
    const wrapper = mount(ReservationTable, { props: { reservations: [linked, other, parent] }, global })

    const ids = wrapper.findAll('tbody tr').map(tr => tr.text())
    const parentIndex = wrapper.findAll('tbody tr').findIndex(tr => tr.find('[data-testid="row-extended"]').exists())
    expect(ids[parentIndex + 1]).toContain('res-direct')
    expect(wrapper.findAll('[data-testid="row-child"]')).toHaveLength(1)
    // Nested, so the stand-alone link badge is not needed.
    expect(wrapper.find('[data-testid="row-extension-of"]').exists()).toBe(false)
    // Pages count stays, not rows.
    expect(wrapper.text()).toContain('Showing 1–2 of 2')

    const chip = wrapper.find('[data-testid="row-extended"]')
    expect(chip.attributes('title')).toBe('Extended +2 nights, stays until 06 Mar 2030. Payment pending')
    expect(chip.classes()).toContain('text-amber-600')
  })

  it('shows a filtered-out stay\'s extension on its own, linking back to it', async () => {
    const parent = stay({ extensions: [extension()] })
    const linked = stay({ id: 'res-direct', channel: 'Direct', checkIn: '2030-03-04', checkOut: '2030-03-06', extensionOf: 'res-ota' })
    useReservationsModule().reservations.value = [parent, linked]
    const wrapper = mount(ReservationTable, { props: { reservations: [linked] }, global })
    expect(wrapper.find('[data-testid="row-child"]').exists()).toBe(false)
    await wrapper.find('[data-testid="row-extension-of"]').trigger('click')
    expect((wrapper.emitted('openDetail')?.at(-1)?.[0] as ReservationEntry).id).toBe('res-ota')
  })

  it('gives a direct stay extended in place a child row per extension, in date order', async () => {
    const parent = stay({
      id: 'res-dir',
      channel: 'Direct',
      checkIn: '2030-02-27',
      checkOut: '2030-03-06',
      extensions: [
        extension({ linkedReservationId: undefined, paymentStatus: 'paid' }),
        extension({ id: 'ext-early', direction: 'before', previousCheckOut: undefined, newCheckOut: undefined, previousCheckIn: '2030-03-01', newCheckIn: '2030-02-27', amount: 150, linkedReservationId: undefined }),
        extension({ id: 'ext-gone', linkedReservationId: undefined, cancelledAt: '2030-01-01T00:00:00Z' }),
      ],
    })
    useReservationsModule().reservations.value = [parent]
    const wrapper = mount(ReservationTable, { props: { reservations: [parent] }, global })

    const rows = wrapper.findAll('[data-testid="row-child-in-place"]')
    // The cancelled extension draws nothing; the early arrival comes first.
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Early arrival')
    expect(rows[0]!.text()).toContain('27 Feb 2030')
    expect(rows[0]!.text()).toContain('Payment pending')
    expect(rows[1]!.text()).toContain('Extension')
    expect(rows[1]!.text()).toContain('06 Mar 2030')
    // Paid: only the stay's status, no payment badge.
    expect(rows[1]!.find('[data-testid="row-in-place-payment"]').exists()).toBe(false)
    // Still one stay for paging, and a click opens it.
    expect(wrapper.text()).toContain('Showing 1–1 of 1')
    await rows[1]!.trigger('click')
    expect((wrapper.emitted('openDetail')?.at(-1)?.[0] as ReservationEntry).id).toBe('res-dir')
  })

  it('reads Extended +nights once paid', () => {
    const parent = stay({ extensions: [extension({ paymentStatus: 'paid' }), extension({ id: 'ext-2', extraNights: 1, paymentStatus: 'paid' })] })
    useReservationsModule().reservations.value = [parent]
    const wrapper = mount(ReservationTable, { props: { reservations: [parent] }, global })
    const icon = wrapper.find('[data-testid="row-extended"]')
    expect(icon.attributes('title')).toContain('Extended +3 nights')
    expect(icon.classes()).toContain('text-sky-600')
  })

  it('shows nothing for a stay that was never extended', () => {
    const plain = stay()
    useReservationsModule().reservations.value = [plain]
    const wrapper = mount(ReservationTable, { props: { reservations: [plain] }, global })
    expect(wrapper.find('[data-testid="row-extended"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="row-extension-of"]').exists()).toBe(false)
  })

  it('gives city tax and protection their own columns', () => {
    const plain = stay()
    useReservationsModule().reservations.value = [plain]
    const wrapper = mount(ReservationTable, { props: { reservations: [plain] }, global })
    const headers = wrapper.findAll('thead th').map(th => th.text())
    expect(headers).toContain('City tax')
    expect(headers).toContain('Protection')
    expect(wrapper.find('[data-testid="cell-protection"] damage-protection-status-chip-stub').exists()).toBe(true)
  })

  it('sorts protection by urgency and keeps empty cells last both ways', async () => {
    Object.assign(buckets, { 'res-settled': 'settled', 'res-overdue': 'decision_overdue' })
    const rows = [stay({ id: 'res-none' }), stay({ id: 'res-settled' }), stay({ id: 'res-overdue' })]
    useReservationsModule().reservations.value = rows
    const wrapper = mount(ReservationTable, { props: { reservations: rows }, global })
    const sortBy = () => wrapper.findAll('thead button').find(b => b.text() === 'Protection')!.trigger('click')
    const order = () => wrapper.findAll('tbody tr').map(tr => tr.attributes('data-row-id'))

    await sortBy()
    expect(order()).toEqual(['res-overdue', 'res-settled', 'res-none'])
    await sortBy()
    expect(order()).toEqual(['res-settled', 'res-overdue', 'res-none'])
  })
})
