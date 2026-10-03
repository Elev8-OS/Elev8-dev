import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import GuideContentTemplatesSettingsPanel from '~/components/settings/GuideContentTemplatesSettingsPanel.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useGuideContentTemplates } from '~/composables/useGuideContentTemplates'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuSeparator: true,
  DropdownMenuItem: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  AlertDialog: true,
  GuideContentTemplateSheet: true,
}

beforeEach(() => localStorage.clear())

describe('guideContentTemplatesSettingsPanel', () => {
  it('lists one kind at a time, default first, and sets a default within the kind', async () => {
    const wrapper = mount(GuideContentTemplatesSettingsPanel, { global: { components: { Badge, Button, Card, Tabs, TabsList, TabsTrigger }, stubs: STUBS } })
    const cards = () => wrapper.findAll('[data-testid="guide-template-card"]')
    expect(cards()).toHaveLength(useGuideContentTemplates().templatesOf('checkin').length)
    expect(cards()[0]!.attributes('data-default')).toBeDefined()
    const second = cards()[1]!
    const name = second.get('h3').text()
    await second.get('[data-testid="guide-template-set-default"]').trigger('click')
    await nextTick()
    expect(cards()[0]!.get('h3').text()).toBe(name)
    expect(useGuideContentTemplates().defaultTemplateOf('checkout')!.isDefault).toBe(true)
  })
})
