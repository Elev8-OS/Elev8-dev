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
  Select: { name: 'Select', props: ['modelValue'], emits: ['update:modelValue'], template: '<div :data-value="modelValue"><slot /></div>' },
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectItem: { props: ['value'], template: '<div data-testid="option" :data-value="value"><slot /></div>' },
  Label: passthrough,
  CompanyCleaningScheduleCard: { template: '<div data-testid="company-cleaning-schedule" />' },
  CleaningTemplateAssignDialog: { props: ['open', 'template'], template: '<div v-if="open" data-testid="assign-dialog">{{ template?.name }}</div>' },
  CleaningTemplateSheet: { props: ['open', 'template'], template: '<div v-if="open" data-testid="template-sheet">{{ template ? template.name : \'new\' }}</div>' },
}

function mountPanel() {
  return mount(CleaningTemplatesSettingsPanel, { global: { components: { Badge, Button, Card }, stubs: STUBS } })
}

beforeEach(() => {
  localStorage.clear()
})

describe('cleaningTemplatesSettingsPanel', () => {
  it('lists every template and the company default per cleaning type', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="company-cleaning-schedule"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="template-card"]')).toHaveLength(useCleaningStepTemplates().templates.value.length)
    const select = (type: string) => wrapper.findAllComponents({ name: 'Select' }).find(s => s.attributes('data-testid') === `type-default-select-${type}`)!
    expect(select('check_out').props('modelValue')).toBe('cst-villa')
    expect(select('daily').props('modelValue')).toBe('cst-daily')
    const villa = wrapper.findAll('[data-testid="template-card"]').find(c => c.get('h3').text() === 'Villa standard')!
    expect(villa.get('[data-testid="template-usage"]').text()).toContain('Default for check-out cleaning')
  })

  it('changes a type\'s default', async () => {
    const wrapper = mountPanel()
    const select = wrapper.findAllComponents({ name: 'Select' }).find(s => s.attributes('data-testid') === 'type-default-select-check_out')!
    select.vm.$emit('update:modelValue', 'cst-studio')
    await nextTick()
    expect(useCleaningStepTemplates().defaultFor('check_out')!.id).toBe('cst-studio')
  })

  it('opens Assign to listings for a template', async () => {
    const wrapper = mountPanel()
    const studio = wrapper.findAll('[data-testid="template-card"]').find(c => c.get('h3').text() === 'Studio / apartment')!
    await studio.get('[data-testid="template-assign"]').trigger('click')
    expect(wrapper.get('[data-testid="assign-dialog"]').text()).toBe('Studio / apartment')
  })

  it('opens the editor for a new template and for an existing one', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="template-create"]').trigger('click')
    expect(wrapper.get('[data-testid="template-sheet"]').text()).toBe('new')
    const card = wrapper.findAll('[data-testid="template-card"]')[1]!
    await card.get('[data-testid="template-edit"]').trigger('click')
    expect(wrapper.get('[data-testid="template-sheet"]').text()).toBe(card.get('h3').text())
  })

  it('deletes an unused template after confirming', async () => {
    const wrapper = mountPanel()
    const before = wrapper.findAll('[data-testid="template-card"]').length
    const studio = wrapper.findAll('[data-testid="template-card"]').find(c => c.get('h3').text() === 'Studio / apartment')!
    await studio.get('[data-testid="template-delete"]').trigger('click')
    expect(wrapper.find('[data-testid="template-delete-replacement"]').exists()).toBe(false)
    await wrapper.get('[data-testid="template-delete-confirm"]').trigger('click')
    expect(wrapper.findAll('[data-testid="template-card"]')).toHaveLength(before - 1)
  })

  it('asks for a replacement before deleting a template in use', async () => {
    const wrapper = mountPanel()
    const before = wrapper.findAll('[data-testid="template-card"]').length
    const daily = wrapper.findAll('[data-testid="template-card"]').find(c => c.get('h3').text() === 'Daily refresh')!
    await daily.get('[data-testid="template-delete"]').trigger('click')
    const replacement = wrapper.findAllComponents({ name: 'Select' }).find(s => s.attributes('data-testid') === 'template-delete-replacement')!
    await wrapper.get('[data-testid="template-delete-confirm"]').trigger('click')
    expect(wrapper.findAll('[data-testid="template-card"]')).toHaveLength(before)
    replacement.vm.$emit('update:modelValue', 'cst-villa')
    await nextTick()
    await wrapper.get('[data-testid="template-delete-confirm"]').trigger('click')
    expect(wrapper.findAll('[data-testid="template-card"]')).toHaveLength(before - 1)
    expect(useCleaningStepTemplates().defaultFor('daily')!.id).toBe('cst-villa')
  })
})
