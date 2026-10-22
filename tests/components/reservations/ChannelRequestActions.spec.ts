import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChannelRequestActions from '~/components/reservations/ChannelRequestActions.vue'
import { Button } from '~/components/ui/button'
import { CHANNEL_ANSWER_DELAY_MS } from '~/composables/useChannelRequests'
import { useReservationsModule } from '~/composables/useReservationsModule'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: passthrough,
  DialogHeader: passthrough,
  DialogTitle: passthrough,
  DialogDescription: passthrough,
  DialogFooter: passthrough,
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function mountFor(id: string) {
  const reservation = useReservationsModule().reservations.value.find(r => r.id === id)!
  return mount(ChannelRequestActions, { props: { reservation }, global: { components: { Button }, stubs: STUBS } })
}

describe('channelRequestActions', () => {
  it('asks for one of the channel\'s reasons before declining a request', async () => {
    const w = mountFor('res-req-1')
    await w.find('[data-testid="request-decline"]').trigger('click')
    const confirm = w.find('[data-testid="request-decline-confirm"]')
    expect(confirm.attributes('disabled')).toBeDefined()
    const reasons = w.findAll('[role="radio"]').map(r => r.text())
    expect(reasons).toContain('Waiting for a better reservation')
    expect(reasons).not.toContain('Arrival is outside check-in hours')

    await w.findAll('[role="radio"]')[0]!.trigger('click')
    await confirm.trigger('click')
    await vi.advanceTimersByTimeAsync(CHANNEL_ANSWER_DELAY_MS)
    expect(useReservationsModule().reservations.value.find(r => r.id === 'res-req-1')!.status).toBe('cancelled')
    expect(toast.success).toHaveBeenCalledWith('Request declined', expect.anything())
  })

  it('declines a change without asking for a reason', async () => {
    const w = mountFor('res-1')
    await w.find('[data-testid="request-decline"]').trigger('click')
    expect(w.find('[data-testid="request-decline-confirm"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(CHANNEL_ANSWER_DELAY_MS)
    expect(useReservationsModule().reservations.value.find(r => r.id === 'res-1')!.alteration).toBeUndefined()
  })
})
