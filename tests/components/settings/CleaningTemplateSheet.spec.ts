import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CleaningTemplateSheet from '~/components/settings/CleaningTemplateSheet.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: passthrough,
  SheetDescription: passthrough,
  SheetFooter: passthrough,
  CleaningStepsEditor: { props: ['modelValue'], template: '<div data-testid="editor"><slot name="toolbar" /></div>' },
}

function mountSheet(template = useCleaningStepTemplates().getTemplate('cst-villa')!) {
  return mount(CleaningTemplateSheet, {
    props: { open: true, template },
    global: { components: { Button, Input, Label }, stubs: STUBS },
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('cleaningTemplateSheet', () => {
  it('ticks the template\'s cleaning types', () => {
    const wrapper = mountSheet()
    expect(wrapper.get('[data-testid="template-type-check_out"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="template-type-daily"]').attributes('aria-checked')).toBe('false')
  })

  it('saves the picked cleaning types', async () => {
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="template-type-daily"]').trigger('click')
    await wrapper.get('[data-testid="template-save"]').trigger('click')
    expect(useCleaningStepTemplates().getTemplate('cst-villa')!.cleaningTypes).toEqual(['check_out', 'daily'])
  })

  it('cannot save without a cleaning type', async () => {
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="template-type-check_out"]').trigger('click')
    expect(wrapper.get('[data-testid="template-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Pick at least one cleaning type.')
  })
})
