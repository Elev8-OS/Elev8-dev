import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExpandableText from '~/components/shared/ExpandableText.vue'

describe('expandableText', () => {
  it('shows short rich text in full, with its paragraphs, and no toggle', () => {
    const wrapper = mount(ExpandableText, { props: { html: '<p>Pool</p><p>Open 08:00</p>' } })
    expect(wrapper.get('[data-testid="expandable-text"]').html()).toContain('<p>Pool</p>')
    expect(wrapper.get('[data-testid="expandable-text"]').classes()).not.toContain('line-clamp-3')
    expect(wrapper.find('[data-testid="expandable-toggle"]').exists()).toBe(false)
  })

  it('folds long text and unfolds it on Show more', async () => {
    const wrapper = mount(ExpandableText, { props: { html: `<p>${'Cafés and restaurants in the village. '.repeat(10)}</p>` } })
    const text = () => wrapper.get('[data-testid="expandable-text"]')
    expect(text().classes()).toContain('line-clamp-3')
    const toggle = wrapper.get('[data-testid="expandable-toggle"]')
    expect(toggle.text()).toBe('Show more')
    await toggle.trigger('click')
    expect(text().classes()).not.toContain('line-clamp-3')
    expect(toggle.text()).toBe('Show less')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('folds text with more paragraphs than allowed lines, even when short', () => {
    const wrapper = mount(ExpandableText, { props: { html: '<p>a</p><p>b</p><p>c</p><p>d</p>', lines: 3 } })
    expect(wrapper.find('[data-testid="expandable-toggle"]').exists()).toBe(true)
  })

  it('uses the labels it is given, e.g. translated on the guest guide', () => {
    const wrapper = mount(ExpandableText, { props: { html: `<p>${'x'.repeat(300)}</p>`, moreLabel: 'Mehr anzeigen' } })
    expect(wrapper.get('[data-testid="expandable-toggle"]').text()).toBe('Mehr anzeigen')
  })
})
