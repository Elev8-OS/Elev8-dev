import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { customTabHost, customTabValue, listingCustomTabs, moveCustomTab, normalizeTabUrl, removeCustomTab, saveCustomTab } from '~/components/listings/data/listing-custom-tabs'
import ListingCustomTabDialog from '~/components/listings/ListingCustomTabDialog.vue'

const a = { id: 'a', name: 'Sheet', url: 'https://docs.google.com/a' }
const b = { id: 'b', name: 'Notion', url: 'https://notion.so/b' }
const c = { id: 'c', name: 'Owner', url: 'https://owner.example.com/' }

describe('listing custom tabs', () => {
  it('normalizes a typed address and rejects anything that is not http(s)', () => {
    expect(normalizeTabUrl('docs.google.com/sheet')).toBe('https://docs.google.com/sheet')
    expect(normalizeTabUrl('  http://example.com  ')).toBe('http://example.com/')
    expect(normalizeTabUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeTabUrl('example.com:8080/x')).toBe('https://example.com:8080/x')
    expect(normalizeTabUrl('ftp://example.com')).toBeNull()
    expect(normalizeTabUrl('not a url')).toBeNull()
    expect(normalizeTabUrl('')).toBeNull()
  })

  it('reads, saves, removes and moves tabs without touching the input list', () => {
    expect(listingCustomTabs(undefined)).toEqual([])
    const tabs = [a, b]
    expect(saveCustomTab(tabs, c)).toEqual([a, b, c])
    expect(saveCustomTab(tabs, { ...a, name: 'Renamed' })[0]!.name).toBe('Renamed')
    expect(removeCustomTab(tabs, 'a')).toEqual([b])
    expect(moveCustomTab([a, b, c], 'b', -1).map(t => t.id)).toEqual(['b', 'a', 'c'])
    expect(moveCustomTab([a, b, c], 'c', 1).map(t => t.id)).toEqual(['a', 'b', 'c'])
    expect(tabs).toEqual([a, b])
    expect(customTabValue(a)).toBe('custom:a')
    expect(customTabHost('https://www.notion.so/x')).toBe('notion.so')
  })
})

const passthrough = { template: '<div><slot /></div>' }
function mountDialog() {
  return mount(ListingCustomTabDialog, {
    props: { open: true, tab: null },
    global: {
      stubs: {
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogDescription: passthrough,
        DialogFooter: passthrough,
        Label: { template: '<label><slot /></label>' },
        Input: { props: ['modelValue'], emits: ['update:modelValue', 'blur'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />' },
        Button: { props: ['disabled', 'type'], template: '<button :type="type" :disabled="disabled"><slot /></button>' },
      },
    },
  })
}

describe('listingCustomTabDialog', () => {
  it('saves a name and a normalised link', async () => {
    const w = mountDialog()
    const save = w.find('[data-testid="custom-tab-save"]')
    expect(save.attributes('disabled')).toBeDefined()
    await w.find('#custom-tab-name').setValue('Inventory')
    await w.find('#custom-tab-url').setValue('docs.google.com/sheet')
    expect(save.attributes('disabled')).toBeUndefined()
    await w.find('form').trigger('submit')
    const [tab] = w.emitted('save')![0] as [{ name: string, url: string }]
    expect(tab).toMatchObject({ name: 'Inventory', url: 'https://docs.google.com/sheet' })
  })

  it('flags a link that is not a web address', async () => {
    const w = mountDialog()
    await w.find('#custom-tab-name').setValue('Bad')
    await w.find('#custom-tab-url').setValue('javascript:alert(1)')
    await w.find('#custom-tab-url').trigger('blur')
    expect(w.find('[data-testid="custom-tab-url-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="custom-tab-save"]').attributes('disabled')).toBeDefined()
  })
})
