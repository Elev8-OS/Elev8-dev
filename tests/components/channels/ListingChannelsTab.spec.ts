import type { Listing } from '~/components/listings/data/listings'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChannelStatusBadge from '~/components/channels/ChannelStatusBadge.vue'
import ListingChannelsTab from '~/components/channels/ListingChannelsTab.vue'
import { listings } from '~/components/listings/data/listings'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { CHANNEL_SYNC_DELAY_MS, useChannels } from '~/composables/useChannels'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  Tooltip: passthrough,
  TooltipTrigger: passthrough,
  TooltipContent: passthrough,
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuSeparator: true,
  DropdownMenuItem: { emits: ['select'], template: '<button @click="$emit(\'select\')"><slot /></button>' },
  AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  AlertDialogContent: passthrough,
  AlertDialogHeader: passthrough,
  AlertDialogTitle: passthrough,
  AlertDialogDescription: passthrough,
  AlertDialogFooter: passthrough,
  AlertDialogCancel: passthrough,
  AlertDialogAction: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
}
const COMPONENTS = { Badge, Button, ChannelStatusBadge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow }

let snapshot: Listing[]

beforeEach(() => {
  snapshot = listings.value
  vi.useFakeTimers()
})

afterEach(() => {
  listings.value = snapshot
  vi.useRealTimers()
})

function mountTab(listing: Listing) {
  return mount(ListingChannelsTab, { props: { listing }, global: { components: COMPONENTS, stubs: STUBS } })
}

describe('listingChannelsTab', () => {
  it('lists every connected channel: status where it sells, Add where it does not', () => {
    const listing = listings.value.find(l => l.otaConnected.includes('Airbnb') && !l.otaConnected.includes('Vrbo'))!
    const wrapper = mountTab(listing)
    const airbnb = wrapper.findAll('tbody tr').find(r => r.text().includes('Airbnb'))!
    expect(airbnb.text()).toMatch(/Live|Syncing|Needs attention|Error/)
    const vrbo = wrapper.findAll('tbody tr').find(r => r.text().includes('Vrbo'))!
    expect(vrbo.text()).toContain('Not connected')
    expect(vrbo.find('a[href*="/channels/vrbo/connect"]').attributes('href')).toBe(`/channels/vrbo/connect?step=listings&listing=${listing.id}`)
    expect(wrapper.text()).toContain('Not connected yet: Expedia')
  })

  it('links a failed content check to its Listing Setup section', () => {
    const listing = { ...listings.value.find(l => l.otaConnected.length > 0)!, name: 'N'.repeat(120) }
    const wrapper = mountTab(listing)
    const nameRow = wrapper.findAll('tbody tr').find(r => r.text().startsWith('Listing name'))!
    expect(nameRow.find('a').attributes('href')).toBe(`/listings/${listing.id}/setup?section=basics`)
  })

  it('asks before sending content, then pushes it to every channel the listing is on', async () => {
    const listing = listings.value.find(l => l.otaConnected.length > 1)!
    const { getMapping } = useChannels()
    const wrapper = mountTab(listing)
    await wrapper.findAll('button').find(b => b.text().includes('Send content to channels'))!.trigger('click')
    expect(wrapper.text()).toContain('are replaced with the ones in Elev8')
    await wrapper.findAll('button').filter(b => b.text().trim() === 'Send content').at(-1)!.trigger('click')
    for (const channel of listing.otaConnected)
      expect(getMapping(listing.id, channel)?.status).toBe('syncing')
    await vi.advanceTimersByTimeAsync(CHANNEL_SYNC_DELAY_MS)
    expect(toast.success).toHaveBeenCalledWith('Content sent', expect.anything())
  })
})
