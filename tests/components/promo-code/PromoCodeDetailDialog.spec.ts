// The detail dialog answers "what does a guest at this villa get?" for a free-upsell
// code, and names the listings where the code is rejected.

import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { promoCodes } from '~/components/promo-code/data/promo-codes'
import PromoCodeDetailDialog from '~/components/promo-code/PromoCodeDetailDialog.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { useUpsellServices } from '~/composables/useUpsellServices'

const passthrough = (name: string) => defineComponent({ name, setup: (_, { slots }) => () => h('div', slots.default?.()) })

// reka's Select does not open in jsdom; a native select exercises the same v-model.
const Select = defineComponent({
  name: 'Select',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup: (props, { slots, emit }) => () => h('select', {
    'value': props.modelValue,
    'aria-label': 'Preview listing',
    'onChange': (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value),
  }, [h('option', { value: '' }, 'Pick a listing'), slots.default?.()]),
})
const SelectItem = defineComponent({
  name: 'SelectItem',
  props: { value: { type: String, required: true } },
  setup: (props, { slots }) => () => h('option', { value: props.value }, slots.default?.()),
})
const Fragment = (name: string) => defineComponent({ name, setup: (_, { slots }) => () => slots.default?.() })

const global = {
  components: {
    Badge,
    Button,
    Dialog: passthrough('Dialog'),
    DialogContent: passthrough('DialogContent'),
    DialogHeader: passthrough('DialogHeader'),
    DialogTitle: passthrough('DialogTitle'),
    DialogDescription: passthrough('DialogDescription'),
    DialogFooter: passthrough('DialogFooter'),
    Select,
    SelectTrigger: Fragment('SelectTrigger'),
    SelectValue: Fragment('SelectValue'),
    SelectContent: Fragment('SelectContent'),
    SelectItem,
  },
  config: { warnHandler: () => {} },
}

function merry(overrides: Partial<PromoCode> = {}): PromoCode {
  return { ...promoCodes.value.find(c => c.code === 'MERRYCHRISTMAS')!, ...overrides }
}

function open(promoCode: PromoCode) {
  return mount(PromoCodeDetailDialog, { props: { open: true, promoCode }, global })
}

async function preview(wrapper: ReturnType<typeof open>, listingId: string) {
  await wrapper.find('[data-testid="promo-listing-preview"] select').setValue(listingId)
}

describe('promoCodeDetailDialog: preview for listing', () => {
  it('shows a Canggu villa only the West Coast breakfast', async () => {
    const wrapper = open(merry())
    await preview(wrapper, 'lst-1')
    const panel = wrapper.find('[data-testid="promo-listing-preview"]').text()

    expect(panel).toContain('Floating Breakfast (West Coast)')
    expect(panel).not.toContain('Floating Breakfast (Central & South)')
    expect(panel).toContain('IDR 450,000 value')
    expect(panel).toContain('Team confirms the date')
  })

  it('shows an Ubud villa only the Central breakfast', async () => {
    const wrapper = open(merry())
    await preview(wrapper, 'lst-5')
    const panel = wrapper.find('[data-testid="promo-listing-preview"]').text()

    expect(panel).toContain('Floating Breakfast (Central & South)')
    expect(panel).not.toContain('Floating Breakfast (West Coast)')
  })

  it('says the code is rejected at a listing no breakfast reaches', async () => {
    const wrapper = open(merry({ listingIds: [] }))
    await preview(wrapper, 'lst-20')

    expect(wrapper.find('[data-testid="promo-listing-preview"]').text()).toContain('Rejected at this listing')
  })

  it('names the listings the code is rejected at', () => {
    const { services } = useUpsellServices()
    services.value = services.value.map(s => s.id === 'svc-014' ? { ...s, status: 'inactive' as const } : s)
    const wrapper = open(merry())

    expect(wrapper.text()).toContain('Rejected at 7 listings')
    expect(wrapper.text()).toContain('and 4 more')
  })

  it('shows no rejection warning when the two breakfasts cover the scope', () => {
    expect(open(merry()).text()).not.toContain('Rejected at')
  })

  it('does not treat a future stay window as a closed code', () => {
    // Booking window open today; the Christmas stay window is still ahead.
    const wrapper = open(merry({
      bookingWindows: [{ from: '2026-01-01T00:00:00Z', until: '2099-12-31T00:00:00Z' }],
      stayWindows: [{ from: '2099-12-20T00:00:00Z', until: '2099-12-31T00:00:00Z' }],
    }))

    expect(wrapper.text()).not.toContain('Right now every guest is rejected')
  })
})
