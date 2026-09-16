// Editing mirrors the create wizard: four steps with step progress,
// step-level validation, and review summary on the final step.

import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PromoCodeDraftSummary from '~/components/promo-code/PromoCodeDraftSummary.vue'
import PromoCodeEditDialog from '~/components/promo-code/PromoCodeEditDialog.vue'
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

function makeCode(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: 'promo-welcome10',
    code: 'WELCOME10',
    description: 'Welcome discount for new guests',
    discountType: '%',
    value: 10,
    currency: null,
    active: true,
    bookingWindows: [],
    stayWindows: [],
    minStay: null,
    usageLimit: null,
    redemptionCount: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    listingIds: [],
    channelRestriction: { channel: 'widget', websiteIds: [] },
    ...overrides,
  }
}

function open(promoCode: PromoCode) {
  return mount(PromoCodeEditDialog, { props: { open: true, promoCode }, global })
}

type Wrapper = ReturnType<typeof open>

function findButton(wrapper: Wrapper, label: string) {
  return wrapper.findAll('button').find(b => b.text().trim() === label)
}

/** Walks through all steps to the final Limits & Review step. */
async function reachLastStep(wrapper: Wrapper) {
  await findButton(wrapper, 'Next')!.trigger('click')
  await findButton(wrapper, 'Next')!.trigger('click')
  await findButton(wrapper, 'Next')!.trigger('click')
}

describe('promoCodeEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('steps through four screens matching the create wizard', async () => {
    const wrapper = open(makeCode())

    // Step 1: Code
    expect(wrapper.text()).toContain('Step 1 of 4 — Code')
    expect(findButton(wrapper, 'Cancel')).toBeDefined()
    expect(findButton(wrapper, 'Back')).toBeUndefined()
    expect(findButton(wrapper, 'Save changes')).toBeUndefined()

    // Advance to Step 2: Where it works
    await findButton(wrapper, 'Next')!.trigger('click')
    expect(wrapper.text()).toContain('Step 2 of 4 — Where it works')
    expect(findButton(wrapper, 'Back')).toBeDefined()

    // Advance to Step 3: Discount
    await findButton(wrapper, 'Next')!.trigger('click')
    expect(wrapper.text()).toContain('Step 3 of 4 — Discount')

    // Advance to Step 4: Limits
    await findButton(wrapper, 'Next')!.trigger('click')
    expect(wrapper.text()).toContain('Step 4 of 4 — Limits')
    expect(wrapper.text()).toContain('Validity windows')
    expect(wrapper.text()).toContain('Review')
    expect(findButton(wrapper, 'Save changes')).toBeDefined()
    expect(findButton(wrapper, 'Next')).toBeUndefined()
  })

  it('hydrates the form from the code being edited', () => {
    const wrapper = open(makeCode())

    expect((wrapper.find('input.font-mono').element as HTMLInputElement).value).toBe('WELCOME10')
    expect(wrapper.find('textarea').element.value).toBe('Welcome discount for new guests')
  })

  it('renders a stored ISO window as a date the input can show', async () => {
    const wrapper = open(makeCode({
      bookingWindows: [{ from: '2026-02-10T00:00:00Z', until: '2026-12-31T00:00:00Z' }],
    }))

    await reachLastStep(wrapper)

    const dates = wrapper.findAll('input[type="date"]').map(i => (i.element as HTMLInputElement).value)
    expect(dates).toEqual(['2026-02-10', '2026-12-31'])
  })

  it('lets a code keep its own value without tripping the uniqueness check', async () => {
    const { codes } = usePromoCodes()
    // The seeded WELCOME10 is the code under edit.
    const target = codes.value.find(c => c.code === 'WELCOME10')!
    const wrapper = open(makeCode({ id: target.id }))

    await reachLastStep(wrapper)
    await findButton(wrapper, 'Save changes')!.trigger('click')

    expect(wrapper.text()).not.toContain('already exists')
    expect(wrapper.emitted('updated')?.[0]).toEqual([target.id])
  })

  it('refuses to advance when the discount rules reject a value', async () => {
    const { codes } = usePromoCodes()
    const target = codes.value.find(c => c.code === 'WELCOME10')!
    const wrapper = open(makeCode({ id: target.id }))

    // Move to step 3 (Discount)
    await findButton(wrapper, 'Next')!.trigger('click')
    await findButton(wrapper, 'Next')!.trigger('click')
    expect(wrapper.text()).toContain('Step 3 of 4 — Discount')

    await wrapper.find('input[type="number"]').setValue('150')
    await findButton(wrapper, 'Next')!.trigger('click')

    expect(wrapper.text()).toContain('A percentage discount cannot exceed 100%')
    expect(wrapper.text()).toContain('Step 3 of 4 — Discount')
    expect(wrapper.emitted('updated')).toBeUndefined()
  })

  it('writes the edit back to the store', async () => {
    const { codes } = usePromoCodes()
    const target = codes.value.find(c => c.code === 'WELCOME10')!
    const wrapper = open(makeCode({ id: target.id }))

    // Advance to step 3 (Discount)
    await findButton(wrapper, 'Next')!.trigger('click')
    await findButton(wrapper, 'Next')!.trigger('click')
    await wrapper.find('input[type="number"]').setValue('20')

    // Advance to step 4 (Limits) and save
    await findButton(wrapper, 'Next')!.trigger('click')
    await findButton(wrapper, 'Save changes')!.trigger('click')

    expect(codes.value.find(c => c.id === target.id)!.value).toBe(20)
  })

  it('re-hydrates when a different code is passed in', async () => {
    const wrapper = open(makeCode())
    await wrapper.setProps({ promoCode: makeCode({ id: 'promo-freespa', code: 'FREESPA', description: 'Spa perk' }) })

    expect((wrapper.find('input.font-mono').element as HTMLInputElement).value).toBe('FREESPA')
  })

  it('updates length of stay and writes back to store', async () => {
    const { codes } = usePromoCodes()
    const target = codes.value.find(c => c.code === 'WELCOME10')!
    const wrapper = open(makeCode({ id: target.id }))

    await reachLastStep(wrapper)
    const minStayInput = wrapper.find('#promo-edit-rules-length-of-stay-min')
    const maxStayInput = wrapper.find('#promo-edit-rules-length-of-stay-max')
    expect(minStayInput.exists()).toBe(true)
    expect(maxStayInput.exists()).toBe(true)
    await minStayInput.setValue('5')
    await maxStayInput.setValue('14')
    await findButton(wrapper, 'Save changes')!.trigger('click')

    expect(codes.value.find(c => c.id === target.id)!.lengthOfStayMin).toBe(5)
    expect(codes.value.find(c => c.id === target.id)!.lengthOfStayMax).toBe(14)
  })

  it('navigates back and forth without losing edited values', async () => {
    const wrapper = open(makeCode())
    await wrapper.find('input.font-mono').setValue('EDITEDCODE')

    await findButton(wrapper, 'Next')!.trigger('click')
    expect(wrapper.text()).toContain('Step 2 of 4 — Where it works')

    await findButton(wrapper, 'Back')!.trigger('click')
    expect(wrapper.text()).toContain('Step 1 of 4 — Code')
    expect((wrapper.find('input.font-mono').element as HTMLInputElement).value).toBe('EDITEDCODE')
  })
})
