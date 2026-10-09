import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { listings } from '~/components/listings/data/listings'
import ListingRevenueTab from '~/components/listings/ListingRevenueTab.vue'
import { MANAGED_ROOM } from '~/components/revenue/data/managed-rooms'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useRevenuePolicy } from '~/composables/useRevenuePolicy'

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  Tooltip: passthrough,
  TooltipTrigger: passthrough,
  TooltipContent: passthrough,
  Popover: passthrough,
  PopoverTrigger: passthrough,
  PopoverContent: passthrough,
  Collapsible: passthrough,
  CollapsibleTrigger: passthrough,
  CollapsibleContent: passthrough,
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: passthrough,
  DialogHeader: passthrough,
  DialogTitle: passthrough,
  DialogDescription: passthrough,
  DialogFooter: passthrough,
  ScrollArea: passthrough,
  Switch: true,
  Select: { props: ['modelValue'], template: '<div><slot /></div>' },
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectItem: { props: ['value'], template: '<div><slot /></div>' },
}
const COMPONENTS = { Badge, Button, Card, Input, Label }

/**
 * A listing with no rooms set up counts as one room, keyed by its id. Picked
 * outside the rooms under revenue management, which start with a version.
 */
const listing = listings.value.find(l => !l.unitTypes?.length && !Object.values(MANAGED_ROOM).includes(l.id as never))!

function mountTab() {
  return mount(ListingRevenueTab, { props: { listing, activeUnit: null }, global: { components: COMPONENTS, stubs: STUBS } })
}

async function setField(wrapper: ReturnType<typeof mountTab>, id: string, value: number) {
  await wrapper.find(`#${id}`).setValue(String(value))
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
})

describe('listingRevenueTab', () => {
  it('opens on a default policy that is not saved yet, with Save off', () => {
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="version-trigger"]').text()).toContain('Not saved yet')
    expect(wrapper.find('[data-testid="save-policy"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="policy-preview"]').exists()).toBe(true)
  })

  it('blocks Save while the base sits below the minimum price', async () => {
    const wrapper = mountTab()
    await setField(wrapper, 'rev-min', 500)
    await setField(wrapper, 'rev-base', 100)
    expect(wrapper.find('[data-testid="unsaved-badge"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Base price must sit between the minimum and maximum price.')
    expect(wrapper.find('[data-testid="save-policy"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="policy-preview"]').text()).toContain('Fix the highlighted settings')
  })

  it('opens a managed room on the policy it was set up with', () => {
    const managed = listings.value.find(l => l.id === MANAGED_ROOM.canggu)!
    const wrapper = mount(ListingRevenueTab, { props: { listing: managed, activeUnit: null }, global: { components: COMPONENTS, stubs: STUBS } })
    expect(wrapper.find('[data-testid="version-trigger"]').text()).toContain('Version 1')
    expect((wrapper.find('#rev-base').element as HTMLInputElement).value).toBe('182')
  })

  it('saves a valid change as version 1 and clears the unsaved state', async () => {
    const wrapper = mountTab()
    const store = useRevenuePolicy()
    const before = Number((wrapper.find('#rev-base').element as HTMLInputElement).value)
    await setField(wrapper, 'rev-base', before + 1)
    await wrapper.find('[data-testid="save-policy"]').trigger('click')
    await nextTick()

    expect(store.currentVersion(listing.id)).toMatchObject({ version: 1 })
    expect(store.currentVersion(listing.id)!.policy.base.price).toBe(before + 1)
    expect(wrapper.find('[data-testid="unsaved-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="version-trigger"]').text()).toContain('Version 1')
  })
})
