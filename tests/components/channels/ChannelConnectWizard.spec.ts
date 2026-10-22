import type { Listing } from '~/components/listings/data/listings'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChannelConnectWizard from '~/components/channels/ChannelConnectWizard.vue'
import { getChannel } from '~/components/channels/data/channels'
import { listings } from '~/components/listings/data/listings'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { CHANNEL_CONNECT_DELAY_MS, CHANNEL_SYNC_DELAY_MS, useChannels } from '~/composables/useChannels'
import { useChannelSetup } from '~/composables/useChannelSetup'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const replace = vi.fn()
let query: Record<string, string> = {}

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Label: passthrough,
  Switch: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  BaseSearchInput: true,
  Select: passthrough,
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectItem: passthrough,
  ToggleGroup: passthrough,
  ToggleGroupItem: passthrough,
}
const COMPONENTS = { Badge, Button, Card, Input }

let snapshot: Listing[]

beforeEach(() => {
  snapshot = listings.value
  query = {}
  replace.mockClear()
  vi.stubGlobal('useRoute', () => ({ query }))
  vi.stubGlobal('useRouter', () => ({ replace }))
})

afterEach(() => {
  listings.value = snapshot
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function mountWizard(name: string) {
  return mount(ChannelConnectWizard, { props: { channel: getChannel(name)! }, global: { components: COMPONENTS, stubs: STUBS } })
}

const button = (wrapper: ReturnType<typeof mountWizard>, text: string) => wrapper.findAll('button').find(b => b.text().trim().startsWith(text))!

describe('channelConnectWizard', () => {
  it('opens a new channel at Account, keeps later steps shut and says what is missing', () => {
    const wrapper = mountWizard('Expedia')
    expect(wrapper.text()).toContain('Connect Expedia')
    expect(wrapper.find('[aria-current="step"]').text()).toContain('Account')
    expect(button(wrapper, 'Continue').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Still needed: Pricing model')
    const steps = wrapper.findAll('nav button')
    expect(steps[2]!.attributes('disabled')).toBeDefined()
    expect(replace).toHaveBeenCalledWith({ query: { step: 'account' } })
  })

  it('takes an Airbnb sign-in link and unlocks Readiness', async () => {
    useChannelSetup('Airbnb').clearAuthorisation()
    const wrapper = mountWizard('Airbnb')
    await wrapper.find('#authorisation-link').setValue('http://nope')
    await button(wrapper, 'Save link').trigger('click')
    expect(wrapper.text()).toContain('The link must start with https://')

    await wrapper.find('#authorisation-link').setValue('https://airbnb.com/oauth/x')
    await button(wrapper, 'Save link').trigger('click')
    expect(wrapper.text()).toContain('Sign in with Airbnb')
    await button(wrapper, 'Continue').trigger('click')
    expect(wrapper.find('[aria-current="step"]').text()).toContain('Readiness')
  })

  it('walks readiness, listings and connect, then shows each listing\'s status', async () => {
    vi.useFakeTimers()
    const setup = useChannelSetup('Expedia')
    setup.setSetting('pricing_model', 'Per night')
    const wrapper = mountWizard('Expedia')
    expect(wrapper.find('[aria-current="step"]').text()).toContain('Readiness')

    await wrapper.findAll('[role="radio"]').find(r => r.text().includes('Strict'))!.trigger('click')
    await button(wrapper, 'Continue').trigger('click')
    expect(wrapper.find('[aria-current="step"]').text()).toContain('Listings')

    await wrapper.findAll('button').filter(b => b.text().trim() === 'Skip')[0]!.trigger('click')
    expect(button(wrapper, 'Continue').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Pick at least one listing')

    await wrapper.findAll('button').filter(b => b.text().trim() === 'New')[0]!.trigger('click')
    await button(wrapper, 'Continue').trigger('click')
    const count = listings.value.length
    expect(wrapper.text()).toContain(`${count} new`)

    await button(wrapper, `Connect ${count} listings`).trigger('click')
    await vi.advanceTimersByTimeAsync(CHANNEL_CONNECT_DELAY_MS + CHANNEL_SYNC_DELAY_MS)
    await flushPromises()
    expect(wrapper.text()).toContain(`${count} listings sent to Expedia`)
    expect(useChannels().mappingsForChannel('Expedia')).toHaveLength(count)
    expect(wrapper.text()).toContain('Go to Expedia')
  })

  it('opens the step asked for in the URL only when the steps before it are done', () => {
    query = { step: 'connect' }
    expect(mountWizard('Trip.com').find('[aria-current="step"]').text()).toContain('Account')
    query = { step: 'account' }
    expect(mountWizard('Booking.com').find('[aria-current="step"]').text()).toContain('Account')
  })
})
