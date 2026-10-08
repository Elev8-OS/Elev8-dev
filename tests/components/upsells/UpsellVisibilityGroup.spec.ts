import type { VisibilityConditions, VisibilityMatchMode } from '~/components/upsells/data/upsell-services'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { emptyVisibilityConditions } from '~/components/upsells/data/upsell-services'
import UpsellVisibilityGroup from '~/components/upsells/UpsellVisibilityGroup.vue'

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuItem: { emits: ['click'], template: '<button class="menu-item" @click="$emit(\'click\')"><slot /></button>' },
}

function mountGroup(mode: 'show' | 'hide', initial = emptyVisibilityConditions()) {
  const conditions = ref<VisibilityConditions>(initial)
  const match = ref<VisibilityMatchMode>('all')
  const wrapper = mount(UpsellVisibilityGroup, {
    props: {
      'mode': mode,
      'otherServices': [],
      'modelValue': conditions.value,
      'onUpdate:modelValue': (v: VisibilityConditions) => {
        conditions.value = v
        wrapper.setProps({ modelValue: v })
      },
      'match': match.value,
      'onUpdate:match': (v: VisibilityMatchMode) => {
        match.value = v
        wrapper.setProps({ match: v })
      },
    },
    global: { components: { Button, Input }, stubs: STUBS },
  })
  return { wrapper, conditions, match }
}

function menuItem(wrapper: ReturnType<typeof mountGroup>['wrapper'], label: string) {
  return wrapper.findAll('.menu-item').find(b => b.text().includes(label))!
}

describe('upsellVisibilityGroup', () => {
  it('labels the group by mode and shows the empty state', () => {
    expect(mountGroup('show').wrapper.text()).toContain('Show when')
    const hide = mountGroup('hide').wrapper
    expect(hide.text()).toContain('Hide when')
    expect(hide.text()).toContain('never hidden')
  })

  it('adds a rule with its defaults and removes it again', async () => {
    const { wrapper, conditions } = mountGroup('hide')
    await menuItem(wrapper, 'Time before check-in').trigger('click')
    expect(conditions.value.hoursBeforeCheckIn).toBe(24)
    // An added rule leaves the add menu
    await nextTick()
    expect(wrapper.findAll('.menu-item').some(b => b.text().includes('Time before check-in'))).toBe(false)

    await wrapper.find('[aria-label="Remove Time before check-in rule"]').trigger('click')
    expect(conditions.value.hoursBeforeCheckIn).toBeNull()
  })

  it('sets both ends of a range rule together', async () => {
    const { wrapper, conditions } = mountGroup('show')
    await menuItem(wrapper, 'Guest count').trigger('click')
    expect(conditions.value.guestCountMin).toBe(1)
    expect(conditions.value.guestCountMax).toBe(10)
  })

  it('shows the match toggle only with two or more rules', async () => {
    const { wrapper, match } = mountGroup('show', { ...emptyVisibilityConditions(), channels: ['airbnb'] })
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)

    await menuItem(wrapper, 'Booking status').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('and')

    await wrapper.findAll('[role="radio"]').find(b => b.text() === 'Any rule')!.trigger('click')
    expect(match.value).toBe('any')
  })
})
