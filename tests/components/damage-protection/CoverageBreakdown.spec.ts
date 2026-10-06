import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CoverageBreakdown from '~/components/damage-protection/CoverageBreakdown.vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { ternPriceFor } from '~/components/reservations/data/tern-products'

function mountBreakdown(tier: 'bronze' | 'gold_plus', currency = 'USD') {
  return mount(CoverageBreakdown, { props: { tier, currency }, global: { stubs: { Icon: true } } })
}

describe('coverageBreakdown', () => {
  it('lists every covered area of the tier, its unit limit being the tier\'s cap', () => {
    const wrapper = mountBreakdown('bronze')
    expect(wrapper.text()).toContain('What Elev8 Cover Bronze covers')
    expect(wrapper.text()).toContain(ternPriceFor('bronze', 'USD')!.coverage.productCode)
    for (const key of ['unit', 'personal', 'realProperty', 'liability', 'bedBug', 'smoking', 'pets'])
      expect(wrapper.find(`[data-testid="coverage-${key}"]`).exists(), key).toBe(true)
    expect(wrapper.find('[data-testid="coverage-unit"]').text()).toContain(formatProtectionAmount(2000, 'USD'))
    expect(wrapper.find('[data-testid="coverage-pets"]').text()).toContain('Not covered')
  })

  it('says so where the tier is not priced in the currency, rather than converting', () => {
    const wrapper = mountBreakdown('gold_plus', 'IDR')
    expect(wrapper.text()).toContain('Not available in IDR yet')
    expect(wrapper.find('[data-testid="coverage-unit"]').exists()).toBe(false)
  })
})
