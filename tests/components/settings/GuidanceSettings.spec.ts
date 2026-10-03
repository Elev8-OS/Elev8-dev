import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import GuidanceSettingsPanel from '~/components/settings/GuidanceSettingsPanel.vue'
import GuidanceSheet from '~/components/settings/GuidanceSheet.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { useCleaningGuidance } from '~/composables/useCleaningGuidance'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Label: passthrough,
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: passthrough,
  SheetDescription: passthrough,
  SheetFooter: passthrough,
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuSeparator: true,
  DropdownMenuItem: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  AlertDialogContent: passthrough,
  AlertDialogHeader: passthrough,
  AlertDialogTitle: passthrough,
  AlertDialogDescription: passthrough,
  AlertDialogFooter: passthrough,
  AlertDialogCancel: passthrough,
  AlertDialogAction: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  CleaningGuidanceDialog: true,
}
const COMPONENTS = { Badge, Button, Card, Input, Textarea }

beforeEach(() => localStorage.clear())

describe('guidanceSheet', () => {
  it('rejects a link that is not YouTube, and saves text with a video', async () => {
    const wrapper = mount(GuidanceSheet, { props: { guidance: null, open: true }, global: { components: COMPONENTS, stubs: STUBS } })
    await wrapper.get('[data-testid="guidance-title"]').setValue('Pool care')
    await wrapper.get('[data-testid="guidance-body"]').setValue('Skim the pool first.')
    await wrapper.get('[data-testid="guidance-link"]').setValue('https://vimeo.com/1')
    await wrapper.get('[data-testid="guidance-add-video"]').trigger('click')
    expect(wrapper.get('[data-testid="guidance-link-error"]').text()).toContain('not a YouTube')
    await wrapper.get('[data-testid="guidance-link"]').setValue('https://youtu.be/aBcDeFgHiJ1')
    await wrapper.get('[data-testid="guidance-add-video"]').trigger('click')
    expect(wrapper.findAll('[data-testid="guidance-video-row"]')).toHaveLength(1)
    await wrapper.get('[data-testid="guidance-save"]').trigger('click')
    const saved = useCleaningGuidance().guidance.value.find(g => g.title === 'Pool care')!
    expect(saved.videos.map(v => v.youtubeId)).toEqual(['aBcDeFgHiJ1'])
  })
})

describe('guidanceSettingsPanel', () => {
  it('lists guidance with how many steps use it, and deletes after confirming', async () => {
    const { templates, updateTemplate } = useCleaningStepTemplates()
    const t = templates.value[0]!
    updateTemplate(t.id, { sections: [{ id: 's', title: 'Beds', steps: [{ id: '1', label: 'Make beds', guidanceIds: ['gd-bed'] }] }] })
    const wrapper = mount(GuidanceSettingsPanel, { global: { components: COMPONENTS, stubs: { ...STUBS, GuidanceSheet: true } } })
    const card = wrapper.findAll('[data-testid="guidance-card"]').find(c => c.text().includes('Making a bed'))!
    expect(card.get('[data-testid="guidance-usage"]').text()).toMatch(/Used in [1-9]\d* steps?/)
    const before = wrapper.findAll('[data-testid="guidance-card"]').length
    await card.get('[data-testid="guidance-delete"]').trigger('click')
    await wrapper.get('[data-testid="guidance-delete-confirm"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="guidance-card"]')).toHaveLength(before - 1)
  })
})
