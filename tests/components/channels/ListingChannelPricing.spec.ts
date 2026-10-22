import type { Listing } from '~/components/listings/data/listings'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ListingChannelPricing from '~/components/channels/ListingChannelPricing.vue'
import { listings } from '~/components/listings/data/listings'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Label: passthrough,
  Switch: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button role="switch" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />' },
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: passthrough,
  SheetDescription: passthrough,
  SheetFooter: passthrough,
  Select: passthrough,
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectItem: passthrough,
  BaseDatePicker: true,
  ChannelCopyToListingsDialog: { props: ['open', 'what'], emits: ['copy'], template: '<div v-if="open" data-testid="copy-dialog">{{ what }}<button data-testid="copy-confirm" @click="$emit(\'copy\', [\'lst-2\'])" /></div>' },
}
const COMPONENTS = { Badge, Button, Card, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow }

let snapshot: Listing[]
beforeEach(() => {
  snapshot = listings.value
})
afterEach(() => {
  listings.value = snapshot
})

function mountCards(listing: Listing) {
  return mount(ListingChannelPricing, { props: { listing }, global: { components: COMPONENTS, stubs: STUBS } })
}
const byText = (w: ReturnType<typeof mountCards>, text: string) => w.findAll('button').find(b => b.text().trim() === text)!

describe('listingChannelPricing', () => {
  it('adds a promotion only once it has a name', async () => {
    const listing = { ...listings.value[0]!, channelPromotions: [] }
    const w = mountCards(listing)
    await byText(w, 'Add promotion').trigger('click')
    const save = w.find('[data-testid="promo-save"]')
    expect(save.attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Give it a name')
    await w.find('#promo-name').setValue('Book early')
    await save.trigger('click')
    const updated = w.emitted('update')!.at(-1)![0] as Listing
    expect(updated.channelPromotions).toEqual([expect.objectContaining({ name: 'Book early', type: 'early_bird', amount: 10, active: true })])
  })

  it('pauses a promotion from its switch', async () => {
    const promo = { id: 'p1', name: 'Deal', type: 'basic' as const, discountType: 'percent' as const, amount: 5, target: 'rent' as const, channels: ['Airbnb'], daysBeforeArrival: null, stayFrom: null, stayUntil: null, minNights: null, maxNights: null, active: true }
    const w = mountCards({ ...listings.value[0]!, channelPromotions: [promo] })
    await w.find('[role="switch"]').trigger('click')
    expect((w.emitted('update')![0]![0] as Listing).channelPromotions![0]!.active).toBe(false)
  })

  it('sets a channel adjustment and shows the price the channel gets', async () => {
    const listing = listings.value.find(l => l.otaConnected.includes('Airbnb'))!
    const w = mountCards(listing)
    const input = w.find('[aria-label="Airbnb nightly rate adjustment in percent"]')
    // setValue fires `change` too, which is what the field saves on.
    await input.setValue('15')
    expect((w.emitted('update')!.at(-1)![0] as Listing).channelAdjustments!.Airbnb).toEqual({ rate: 15, fee: 0 })

    const before = w.emitted('update')!.length
    await input.setValue('-150')
    expect(toast.error).toHaveBeenCalled()
    expect(w.emitted('update')).toHaveLength(before)
  })

  it('copies promotions to other listings with fresh ids', async () => {
    const promo = { id: 'p1', name: 'Deal', type: 'basic' as const, discountType: 'percent' as const, amount: 5, target: 'rent' as const, channels: ['Airbnb'], daysBeforeArrival: null, stayFrom: null, stayUntil: null, minNights: null, maxNights: null, active: true }
    const source = { ...listings.value[0]!, channelPromotions: [promo] }
    const w = mountCards(source)
    await w.findAll('button').filter(b => b.text().trim() === 'Copy to listings')[0]!.trigger('click')
    await w.find('[data-testid="copy-confirm"]').trigger('click')
    const target = listings.value.find(l => l.id === 'lst-2')!
    expect(target.channelPromotions).toEqual([expect.objectContaining({ name: 'Deal' })])
    expect(target.channelPromotions![0]!.id).not.toBe('p1')
  })
})
