// Editing stays one flat form rather than the create wizard: the host usually
// came to change a single field. It renders the same field groups the wizard
// does, so the two surfaces cannot drift apart.

import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('promoCodeEditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows every field group at once instead of stepping', () => {
    const wrapper = open(makeCode())

    expect(wrapper.text()).toContain('Discount type')
    expect(wrapper.text()).toContain('Redemption channel')
    expect(wrapper.text()).toContain('Validity windows')
    expect(wrapper.text()).not.toContain('Step 1 of')
  })

  it('hydrates the form from the code being edited', () => {
    const wrapper = open(makeCode())

    expect((wrapper.find('input.font-mono').element as HTMLInputElement).value).toBe('WELCOME10')
    expect(wrapper.find('textarea').element.value).toBe('Welcome discount for new guests')
  })

  it('renders a stored ISO window as a date the input can show', () => {
    const wrapper = open(makeCode({
      bookingWindows: [{ from: '2026-02-10T00:00:00Z', until: '2026-12-31T00:00:00Z' }],
    }))

    const dates = wrapper.findAll('input[type="date"]').map(i => (i.element as HTMLInputElement).value)
    expect(dates).toEqual(['2026-02-10', '2026-12-31'])
  })

  it('lets a code keep its own value without tripping the uniqueness check', async () => {
    const { codes } = usePromoCodes()
    // The seeded WELCOME10 is the code under edit.
    const target = codes.value.find(c => c.code === 'WELCOME10')!
    const wrapper = open(makeCode({ id: target.id }))

    await findButton(wrapper, 'Save changes')!.trigger('click')

    expect(wrapper.text()).not.toContain('already exists')
    expect(wrapper.emitted('updated')?.[0]).toEqual([target.id])
  })

  it('refuses to save a value the discount rules reject', async () => {
    const { codes } = usePromoCodes()
    const target = codes.value.find(c => c.code === 'WELCOME10')!
    const wrapper = open(makeCode({ id: target.id }))

    await wrapper.findAll('input[type="number"]')[0]!.setValue('150')
    await findButton(wrapper, 'Save changes')!.trigger('click')

    expect(wrapper.text()).toContain('A percentage discount cannot exceed 100%')
    expect(wrapper.emitted('updated')).toBeUndefined()
  })

  it('writes the edit back to the store', async () => {
    const { codes } = usePromoCodes()
    const target = codes.value.find(c => c.code === 'WELCOME10')!
    const wrapper = open(makeCode({ id: target.id }))

    await wrapper.findAll('input[type="number"]')[0]!.setValue('20')
    await findButton(wrapper, 'Save changes')!.trigger('click')

    expect(codes.value.find(c => c.id === target.id)!.value).toBe(20)
  })

  it('re-hydrates when a different code is passed in', async () => {
    const wrapper = open(makeCode())
    await wrapper.setProps({ promoCode: makeCode({ id: 'promo-freespa', code: 'FREESPA', description: 'Spa perk' }) })

    expect((wrapper.find('input.font-mono').element as HTMLInputElement).value).toBe('FREESPA')
  })
})
