// The create wizard. A promo code asks eight unrelated questions, so they are
// asked one step at a time; nothing reaches the store until the last step, and
// each step gates on its own fields rather than the whole draft.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import PromoCodeCreateDialog from '~/components/promo-code/PromoCodeCreateDialog.vue'
import PromoCodeDraftSummary from '~/components/promo-code/PromoCodeDraftSummary.vue'
import PromoCodeFieldsBasics from '~/components/promo-code/PromoCodeFieldsBasics.vue'
import PromoCodeFieldsDiscount from '~/components/promo-code/PromoCodeFieldsDiscount.vue'
import PromoCodeFieldsRules from '~/components/promo-code/PromoCodeFieldsRules.vue'
import PromoCodeFieldsScope from '~/components/promo-code/PromoCodeFieldsScope.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { usePromoCodes } from '~/composables/usePromoCodes'

// The field groups are Nuxt auto-imports in the app; the shadcn primitives have
// to be real here too — an unresolved `Input` falls back to a bare `<input>`
// that never binds `model-value`, so every value assertion would be vacuous.
const global = {
  components: {
    PromoCodeFieldsBasics,
    PromoCodeFieldsDiscount,
    PromoCodeFieldsScope,
    PromoCodeFieldsRules,
    PromoCodeDraftSummary,
    Badge,
    Button,
    Input,
    Label,
    RadioGroup,
    RadioGroupItem,
    Switch,
    Textarea,
  },
  config: { warnHandler: () => {} },
}

function open(options: Record<string, unknown> = {}) {
  return mount(PromoCodeCreateDialog, { props: { open: true }, global, ...options })
}

type Wrapper = ReturnType<typeof open>

function findButton(wrapper: Wrapper, label: string) {
  return wrapper.findAll('button').find(b => b.text().trim() === label)
}

async function setCode(wrapper: Wrapper, value: string) {
  await wrapper.find('input.font-mono').setValue(value)
}

/** Walks from step 1 to the last step with a valid percentage code. */
async function reachLastStep(wrapper: Wrapper, code = 'SUMMER25') {
  await setCode(wrapper, code)
  await findButton(wrapper, 'Next')!.trigger('click')
  await findButton(wrapper, 'Next')!.trigger('click')
  await findButton(wrapper, 'Next')!.trigger('click')
}

describe('promoCodeCreateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens on step 1 with Cancel rather than Back', () => {
    const wrapper = open()

    expect(wrapper.text()).toContain('Step 1 of 4 — Code')
    expect(findButton(wrapper, 'Back')).toBeUndefined()
    expect(findButton(wrapper, 'Cancel')).toBeDefined()
    expect(findButton(wrapper, 'Create code')).toBeUndefined()
  })

  it('refuses to advance without a code', async () => {
    const wrapper = open()
    await findButton(wrapper, 'Next')!.trigger('click')

    expect(wrapper.text()).toContain('Step 1 of 4')
    expect(wrapper.text()).toContain('Code is required')
  })

  it('puts the caret back on the field that failed', async () => {
    const wrapper = open({ attachTo: document.body })
    await findButton(wrapper, 'Next')!.trigger('click')
    await nextTick()

    expect(document.activeElement).toBe(wrapper.find('input.font-mono').element)
    wrapper.unmount()
  })

  it('focuses the upsell search when a free-upsell code has no items', async () => {
    const wrapper = open({ attachTo: document.body })
    await setCode(wrapper, 'FREEBIE')
    // Basics -> scope -> discount.
    await findButton(wrapper, 'Next')!.trigger('click')
    await findButton(wrapper, 'Next')!.trigger('click')
    await wrapper.find('#promo-create-discount-type-free_upsell').trigger('click')
    await findButton(wrapper, 'Next')!.trigger('click')
    await nextTick()

    expect((document.activeElement as HTMLElement)?.id).toBe('promo-create-discount-upsell-search')
    wrapper.unmount()
  })

  it('rejects a code that already exists', async () => {
    const wrapper = open()
    // WELCOME10 is seeded in the store.
    await setCode(wrapper, 'WELCOME10')
    await findButton(wrapper, 'Next')!.trigger('click')

    expect(wrapper.text()).toContain('A code with this value already exists')
    expect(wrapper.text()).toContain('Step 1 of 4')
  })

  it('uppercases the code and strips spaces as it is typed', async () => {
    const wrapper = open()
    await setCode(wrapper, 'summer 25')

    expect((wrapper.find('input.font-mono').element as HTMLInputElement).value).toBe('SUMMER25')
  })

  it('walks all four steps and only then offers Create', async () => {
    const wrapper = open()

    await setCode(wrapper, 'SUMMER25')
    await findButton(wrapper, 'Next')!.trigger('click')
    expect(wrapper.text()).toContain('Step 2 of 4 — Where it works')

    await findButton(wrapper, 'Next')!.trigger('click')
    expect(wrapper.text()).toContain('Step 3 of 4 — Discount')

    await findButton(wrapper, 'Next')!.trigger('click')
    expect(wrapper.text()).toContain('Step 4 of 4 — Limits')
    expect(findButton(wrapper, 'Next')).toBeUndefined()
    expect(findButton(wrapper, 'Create code')).toBeDefined()
  })

  it('does not touch the store until the last step', async () => {
    const { codes } = usePromoCodes()
    const before = codes.value.length
    const wrapper = open()

    await setCode(wrapper, 'SUMMER25')
    await findButton(wrapper, 'Next')!.trigger('click')
    await findButton(wrapper, 'Next')!.trigger('click')

    expect(codes.value.length).toBe(before)
  })

  it('holds a free-upsell code on the discount step until an item is picked', async () => {
    const wrapper = open()
    await setCode(wrapper, 'FREEBIE')
    await findButton(wrapper, 'Next')!.trigger('click')
    await findButton(wrapper, 'Next')!.trigger('click')

    await wrapper.find('#promo-create-discount-type-free_upsell').trigger('click')
    await findButton(wrapper, 'Next')!.trigger('click')

    expect(wrapper.text()).toContain('Select at least one upsell item')
    expect(wrapper.text()).toContain('Step 3 of 4')
  })

  it('reads the draft back on the last step', async () => {
    const wrapper = open()
    await reachLastStep(wrapper, 'SUMMER25')

    expect(wrapper.text()).toContain('Review')
    expect(wrapper.text()).toContain('SUMMER25')
    expect(wrapper.text()).toContain('10% off')
    expect(wrapper.text()).toContain('Booking widgets only')
    expect(wrapper.text()).toContain('All listings')
    expect(wrapper.text()).toContain('Always valid')
    expect(wrapper.text()).toContain('Unlimited redemptions')
  })

  it('goes back without losing what was already entered', async () => {
    const wrapper = open()
    await setCode(wrapper, 'SUMMER25')
    await findButton(wrapper, 'Next')!.trigger('click')
    await findButton(wrapper, 'Back')!.trigger('click')

    expect(wrapper.text()).toContain('Step 1 of 4')
    expect((wrapper.find('input.font-mono').element as HTMLInputElement).value).toBe('SUMMER25')
  })

  it('creates the code and emits its id', async () => {
    const { codes } = usePromoCodes()
    const before = codes.value.length
    const wrapper = open()

    await reachLastStep(wrapper, 'SUMMER25')
    await findButton(wrapper, 'Create code')!.trigger('click')

    expect(codes.value.length).toBe(before + 1)
    const created = codes.value[0]!
    expect(created.code).toBe('SUMMER25')
    expect(created.discountType).toBe('%')
    expect(created.value).toBe(10)
    expect(created.channelRestriction).toEqual({ channel: 'widget', websiteIds: [] })
    expect(wrapper.emitted('created')?.[0]).toEqual([created.id])
  })

  it('jumps back to the failing step when a late edit breaks an earlier one', async () => {
    const wrapper = open()
    await reachLastStep(wrapper, 'SUMMER25')

    // A usage limit of 0 fails the last step itself.
    const usageInput = wrapper.findAll('input[type="number"]').at(-1)!
    await usageInput.setValue('0')
    await findButton(wrapper, 'Create code')!.trigger('click')

    expect(wrapper.text()).toContain('Usage limit must be at least 1')
    expect(wrapper.text()).toContain('Step 4 of 4')
  })

  it('starts from a clean draft each time it is opened', async () => {
    const first = open()
    await setCode(first, 'SUMMER25')
    await first.setProps({ open: false })
    await first.setProps({ open: true })

    expect(first.text()).toContain('Step 1 of 4')
    expect((first.find('input.font-mono').element as HTMLInputElement).value).toBe('')
  })
})
