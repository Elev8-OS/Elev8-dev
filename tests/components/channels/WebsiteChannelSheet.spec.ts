import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { defaultWebsiteState, newRuleSet, ruleSetForWebsite, websiteChannel } from '~/components/channels/data/website-channel'
import WebsiteChannelSheet from '~/components/channels/WebsiteChannelSheet.vue'
import WebsiteRuleSetForm from '~/components/channels/WebsiteRuleSetForm.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Separator } from '~/components/ui/separator'
import { websites } from '~/components/website-builder/data/websites'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  Label: passthrough,
  Switch: true,
  NuxtLink: passthrough,
  PromoCodePicker: true,
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: passthrough,
  SheetDescription: passthrough,
  SheetFooter: passthrough,
  AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  AlertDialogContent: passthrough,
  AlertDialogHeader: passthrough,
  AlertDialogTitle: passthrough,
  AlertDialogDescription: passthrough,
  AlertDialogFooter: passthrough,
  AlertDialogCancel: passthrough,
  AlertDialogAction: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
}
const COMPONENTS = { Badge, Button, Input, Separator, WebsiteRuleSetForm }

afterEach(() => {
  websiteChannel.value = defaultWebsiteState()
  localStorage.removeItem('elev8-website-channel')
})

async function openSheet(start: 'list' | 'new' = 'list') {
  const wrapper = mount(WebsiteChannelSheet, { props: { open: false, start }, global: { components: COMPONENTS, stubs: STUBS } })
  await wrapper.setProps({ open: true })
  await nextTick()
  return wrapper
}

async function pickWebsite(wrapper: Awaited<ReturnType<typeof openSheet>>, name: string) {
  const row = wrapper.findAll('[data-testid="wrs-website"]').find(r => r.text().includes(name))!
  await row.trigger('click')
}

describe('websiteChannelSheet', () => {
  it('adds the channel only when the first rule set is saved with its websites', async () => {
    const wrapper = await openSheet('new')
    expect(wrapper.findAll('[data-testid="wrs-website"]')).toHaveLength(websites.value.length)

    await wrapper.get('[data-testid="wrs-save"]').trigger('click')
    expect(toast.error).toHaveBeenCalled()
    expect(websiteChannel.value.enabled).toBe(false)

    await wrapper.get('[data-testid="wrs-name"]').setValue('Bali sites')
    const first = websites.value[0]!
    await pickWebsite(wrapper, first.name)
    await wrapper.get('[data-testid="wrs-save"]').trigger('click')

    expect(websiteChannel.value.enabled).toBe(true)
    expect(ruleSetForWebsite(websiteChannel.value, first.id)?.name).toBe('Bali sites')
    expect(wrapper.findAll('[data-testid="wrs-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Not in a rule set')
  })

  it('moves a website into a new rule set', async () => {
    const { saveRuleSet, ruleSets } = useWebsiteChannel()
    const first = websites.value[0]!
    saveRuleSet({ ...newRuleSet('Bali'), id: 'wrs-bali', websiteIds: [first.id] })
    const wrapper = await openSheet()
    await wrapper.get('[data-testid="wrs-add"]').trigger('click')
    await wrapper.get('[data-testid="wrs-name"]').setValue('Long stay')
    await pickWebsite(wrapper, first.name)
    expect(wrapper.text()).toContain('Moves here from "Bali"')
    await wrapper.get('[data-testid="wrs-save"]').trigger('click')
    expect(ruleSets.value.map(r => [r.name, r.websiteIds])).toEqual([['Bali', []], ['Long stay', [first.id]]])
  })

  it('deletes a rule set after confirming', async () => {
    const { saveRuleSet, ruleSets } = useWebsiteChannel()
    saveRuleSet({ ...newRuleSet('Bali'), id: 'wrs-bali', websiteIds: ['1'] })
    saveRuleSet({ ...newRuleSet('Beach'), id: 'wrs-beach', websiteIds: ['2'] })
    const wrapper = await openSheet()
    await wrapper.findAll('[data-testid="wrs-row"]')[1]!.trigger('click')
    await wrapper.get('[data-testid="wrs-delete"]').trigger('click')
    await wrapper.get('[data-testid="wrs-delete-confirm"]').trigger('click')
    expect(ruleSets.value.map(r => r.id)).toEqual(['wrs-bali'])
    expect(ruleSetForWebsite(websiteChannel.value, '2')).toBeUndefined()
  })
})
