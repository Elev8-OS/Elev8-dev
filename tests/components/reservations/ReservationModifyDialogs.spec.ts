import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import ReservationExtendDialog from '~/components/reservations/ReservationExtendDialog.vue'
import ReservationTimesDialog from '~/components/reservations/ReservationTimesDialog.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useReservationsModule } from '~/composables/useReservationsModule'
// Extending fires a background import() of this; loaded up front so it never
// resolves after the environment is torn down.
import '~/composables/useDamageProtection'

const passthrough = { template: '<div><slot /></div>' }

const global = {
  components: { Button, Input, Label },
  stubs: {
    Icon: true,
    Calendar: true,
    Dialog: { props: ['open'], template: '<div v-if="open !== false"><slot /></div>' },
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
    DialogFooter: passthrough,
    Popover: passthrough,
    PopoverTrigger: passthrough,
    PopoverContent: passthrough,
    Alert: { template: '<div data-testid="alert"><slot /></div>' },
    AlertTitle: passthrough,
    AlertDescription: passthrough,
    Separator: true,
    Badge: passthrough,
    Switch: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button type="button" data-testid="switch" @click="$emit(\'update:modelValue\', !modelValue)" />' },
    Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  },
}

function stay(over: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    ...initialReservations[0]!,
    id: 'res-test-1',
    channel: 'Direct',
    listingId: 'lst-1',
    checkIn: '2030-03-01',
    checkOut: '2030-03-04',
    nights: 3,
    totalPrice: 600,
    currency: 'USD',
    status: 'verified',
    rooms: undefined,
    priceDetails: undefined,
    checkInTime: undefined,
    checkOutTime: undefined,
    activity: [],
    ...over,
  }
}

function live() {
  return useReservationsModule().reservations.value.find(r => r.id === 'res-test-1')!
}

async function open<T>(component: T, reservation: ReservationEntry) {
  const wrapper = mount(component as any, { props: { open: false, reservation }, global })
  await wrapper.setProps({ open: true })
  return wrapper
}

function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find(b => b.text().includes(text))!
}

describe('extend reservation dialog', () => {
  beforeEach(() => {
    useReservationsModule().reservations.value = [stay()]
  })

  async function next(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('[data-testid="extend-next"]').trigger('click')
  }

  it('starts one night out and quotes the added amount', async () => {
    const wrapper = await open(ReservationExtendDialog, live())
    expect(wrapper.text()).toContain('USD 200.00')
    expect(wrapper.text()).toContain('USD 800.00')
    expect(wrapper.find('[data-testid="extend-ota-notice"]').exists()).toBe(false)
  })

  it('walks dates, payment and review, then extends with the payment pending', async () => {
    const wrapper = await open(ReservationExtendDialog, live())
    await button(wrapper, '+2 nights').trigger('click')
    await next(wrapper)
    await wrapper.find('[data-testid="extend-pay-at_property"]').trigger('click')
    await next(wrapper)
    expect((wrapper.find('[data-testid="extend-message"]').element as HTMLTextAreaElement).value).toContain('payable at the property')
    await wrapper.find('[data-testid="extend-confirm"]').trigger('click')
    await flushPromises()
    expect(live().checkOut).toBe('2030-03-06')
    expect(live().totalPrice).toBe(1000)
    expect(live().extensions?.[0]).toMatchObject({ extraNights: 2, paymentMethod: 'at_property', paymentStatus: 'pending' })
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('cannot leave the dates step when the nights are taken', async () => {
    useReservationsModule().reservations.value = [stay(), stay({ id: 'res-next', guestName: 'Next Guest', checkIn: '2030-03-04', checkOut: '2030-03-07' })]
    const wrapper = await open(ReservationExtendDialog, live())
    expect(wrapper.find('[data-testid="alert"]').text()).toContain('Next Guest')
    expect(wrapper.find('[data-testid="extend-next"]').attributes('disabled')).toBeDefined()
  })

  it('offers the saved card only when the stay has one', async () => {
    const wrapper = await open(ReservationExtendDialog, live())
    await next(wrapper)
    expect(wrapper.find('[data-testid="extend-pay-saved_card"]').attributes('disabled')).toBeDefined()
  })

  it('extends an OTA stay through a linked direct booking', async () => {
    useReservationsModule().reservations.value = [stay({ channel: 'Airbnb' })]
    const wrapper = await open(ReservationExtendDialog, live())
    expect(wrapper.find('[data-testid="extend-ota-notice"]').text()).toContain('Airbnb')
    await next(wrapper)
    await wrapper.find('[data-testid="extend-pay-already_paid"]').trigger('click')
    await next(wrapper)
    await wrapper.find('[data-testid="switch"]').trigger('click')
    await wrapper.find('[data-testid="extend-confirm"]').trigger('click')
    await flushPromises()
    expect(live().checkOut).toBe('2030-03-04')
    const linked = useReservationsModule().reservations.value.find(r => r.extensionOf === 'res-test-1')!
    expect(linked).toMatchObject({ channel: 'Direct', checkIn: '2030-03-04', checkOut: '2030-03-05', totalPrice: 200 })
    expect(live().extensions?.[0]?.linkedReservationId).toBe(linked.id)
  })
})

describe('reservation time dialog', () => {
  beforeEach(() => {
    useReservationsModule().reservations.value = [stay()]
  })

  it('saves an early check-in and a late check-out from the presets', async () => {
    const wrapper = await open(ReservationTimesDialog, live())
    await wrapper.findAll('[data-testid="checkin-preset"]').find(b => b.text() === '12:00')!.trigger('click')
    await wrapper.findAll('[data-testid="checkout-preset"]').find(b => b.text() === '14:00')!.trigger('click')
    expect(wrapper.text()).toContain('Early check-in')
    expect(wrapper.text()).toContain('Late check-out')
    await wrapper.find('[data-testid="stay-times-save"]').trigger('click')
    expect(live().checkInTime).toBe('12:00')
    expect(live().checkOutTime).toBe('14:00')
  })

  it('keeps check-in fixed for a guest who is already in', async () => {
    useReservationsModule().reservations.value = [stay({ status: 'checked_in' })]
    const wrapper = await open(ReservationTimesDialog, live())
    expect(wrapper.find('#stay-checkin-time').attributes('disabled')).toBeDefined()
    await wrapper.findAll('[data-testid="checkout-preset"]').find(b => b.text() === '16:00')!.trigger('click')
    await wrapper.find('[data-testid="stay-times-save"]').trigger('click')
    expect(live().checkOutTime).toBe('16:00')
    expect(live().checkInTime).toBeUndefined()
  })
})
