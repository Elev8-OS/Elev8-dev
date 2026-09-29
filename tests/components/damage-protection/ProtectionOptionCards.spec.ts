import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProtectionOptionCards from '~/components/damage-protection/ProtectionOptionCards.vue'
import { buildOptions, formatProtectionAmount, policyFromTemplate } from '~/components/reservations/data/damage-protection'

const policy = { ...policyFromTemplate('standard_short', 'USD'), id: 'dp-test' }

function cards(nights: number) {
  return mount(ProtectionOptionCards, {
    props: { options: buildOptions(policy, { nights, priceDetails: { subtotal: 1000 } }, 'card'), selectable: false },
    global: { stubs: { Icon: true, Badge: { template: '<span><slot /></span>' } } },
  })
}

describe('protection option cards: 30-night packages', () => {
  it('shows the multiplied price and one line naming the packages on a long stay', () => {
    const wrapper = cards(45)
    expect(wrapper.text()).toContain('USD 78.00')
    expect(wrapper.find('[data-testid="waiver-packages"]').text()).toContain('2 × USD 39.00, one for every 30 nights of your stay')
    expect(wrapper.text()).toContain(formatProtectionAmount(2000, 'USD'))
  })

  it('says nothing about packages on a stay of 30 nights or less', () => {
    const wrapper = cards(30)
    expect(wrapper.text()).toContain('USD 39.00')
    expect(wrapper.find('[data-testid="waiver-packages"]').exists()).toBe(false)
  })
})
