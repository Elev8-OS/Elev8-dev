import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CleaningTemplatesSettingsPanel from '~/components/settings/CleaningTemplatesSettingsPanel.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuSeparator: true,
  DropdownMenuItem: { props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' },
  AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  AlertDialogContent: passthrough,
  AlertDialogHeader: passthrough,
  AlertDialogTitle: passthrough,
  AlertDialogDescription: passthrough,
  AlertDialogFooter: passthrough,
  AlertDialogCancel: passthrough,
  AlertDialogAction: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  CleaningTemplateSheet: { props: ['open', 'template'], template: '<div v-if="open" data-testid="template-sheet">{{ template ? template.name : \'new\' }}</div>' },
}

function mountPanel() {
  return mount(CleaningTemplatesSettingsPanel, { global: { components: { Badge, Button, Card }, stubs: STUBS } })
}

beforeEach(() => {
  localStorage.clear()
})

describe('cleaningTemplatesSettingsPanel', () => {
  it('lists every template, default first', () => {
    const cards = mountPanel().findAll('[data-testid="template-card"]')
    expect(cards).toHaveLength(useCleaningStepTemplates().templates.value.length)
    expect(cards[0]!.attributes('data-default')).toBeDefined()
    expect(cards[0]!.text()).toContain('Default')
  })

  it('sets another template as default', async () => {
    const wrapper = mountPanel()
    const second = wrapper.findAll('[data-testid="template-card"]')[1]!
    const name = second.get('h3').text()
    await second.get('[data-testid="template-set-default"]').trigger('click')
    await nextTick()
    const first = wrapper.findAll('[data-testid="template-card"]')[0]!
    expect(first.get('h3').text()).toBe(name)
    expect(wrapper.findAll('[data-testid="template-card"][data-default]')).toHaveLength(1)
  })

  it('opens the editor for a new template and for an existing one', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="template-create"]').trigger('click')
    expect(wrapper.get('[data-testid="template-sheet"]').text()).toBe('new')
    const card = wrapper.findAll('[data-testid="template-card"]')[1]!
    await card.get('[data-testid="template-edit"]').trigger('click')
    expect(wrapper.get('[data-testid="template-sheet"]').text()).toBe(card.get('h3').text())
  })

  it('deletes after confirming', async () => {
    const wrapper = mountPanel()
    const before = wrapper.findAll('[data-testid="template-card"]').length
    await wrapper.findAll('[data-testid="template-card"]')[1]!.get('[data-testid="template-delete"]').trigger('click')
    await wrapper.get('[data-testid="template-delete-confirm"]').trigger('click')
    expect(wrapper.findAll('[data-testid="template-card"]')).toHaveLength(before - 1)
  })
})
