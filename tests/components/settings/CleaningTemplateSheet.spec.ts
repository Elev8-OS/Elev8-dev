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
  it('has no cleaning type field: which type uses a template is set elsewhere', () => {
    const wrapper = mountSheet()
    expect(wrapper.find('[data-testid^="template-type-"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Cleaning type')
  })

  it('saves name and steps without a cleaning type', async () => {
    const wrapper = mountSheet()
    await wrapper.get('#cst-name').setValue('Villa turnover')
    await wrapper.get('[data-testid="template-save"]').trigger('click')
    expect(useCleaningStepTemplates().getTemplate('cst-villa')!.name).toBe('Villa turnover')
  })
})
