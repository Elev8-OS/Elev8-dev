import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import RichTextEditor from '~/components/shared/RichTextEditor.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

const passthrough = { template: '<div><slot /></div>' }

// jsdom does not measure layout, which ProseMirror asks for when it focuses and scrolls.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect
}
if (!document.elementFromPoint)
  document.elementFromPoint = () => null

function mountEditor(modelValue: string) {
  const wrapper = mount(RichTextEditor, {
    props: { 'modelValue': modelValue, 'ariaLabel': 'Step 1 details', 'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }) },
    global: { components: { Button, Input }, stubs: { Icon: true, Popover: passthrough, PopoverTrigger: passthrough, PopoverContent: passthrough } },
    attachTo: document.body,
  })
  return wrapper
}

describe('richTextEditor', () => {
  it('opens old plain text as paragraphs', async () => {
    const wrapper = mountEditor('Pool\n\nRubbish')
    await flushPromises()
    const html = wrapper.get('[role="textbox"]').html()
    expect(html).toContain('<p>Pool</p>')
    expect(html).toContain('<p>Rubbish</p>')
    wrapper.unmount()
  })

  it('formats the selection and emits HTML', async () => {
    const wrapper = mountEditor('<p>Pool</p>')
    await flushPromises()
    const editor = (wrapper.vm as unknown as { editor: { commands: { selectAll: () => void } } }).editor
    editor.commands.selectAll()
    await wrapper.get('[data-testid="rte-bold"]').trigger('click')
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('<p><strong>Pool</strong></p>')
    wrapper.unmount()
  })

  it('takes new content from outside, e.g. an import', async () => {
    const wrapper = mountEditor('<p>Old</p>')
    await flushPromises()
    await wrapper.setProps({ modelValue: '<p>New text</p>' })
    await nextTick()
    expect(wrapper.get('[role="textbox"]').text()).toBe('New text')
    wrapper.unmount()
  })

  it('has a labelled toolbar', async () => {
    const wrapper = mountEditor('')
    await flushPromises()
    expect(wrapper.get('[role="toolbar"]').attributes('aria-label')).toBe('Step 1 details formatting')
    for (const b of ['bold', 'italic', 'underline', 'bulleted-list', 'numbered-list', 'link'])
      expect(wrapper.find(`[data-testid="rte-${b}"]`).exists(), b).toBe(true)
    wrapper.unmount()
  })
})
