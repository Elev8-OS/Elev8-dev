// AI Generate is a chat: suggestions start it, replies change the draft settings.

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import WebsiteAiChat from '~/components/website-builder/WebsiteAiChat.vue'

const passthrough = { template: '<div><slot /></div>' }
const PromptInputStub = defineComponent({
  name: 'PromptInput',
  emits: ['submit'],
  setup(_, { slots, emit }) {
    const onSubmit = (e: Event) => {
      e.preventDefault()
      emit('submit', { text: '', files: [] })
    }
    return () => h('form', { 'data-testid': 'prompt-form', onSubmit }, slots.default?.())
  },
})

let wrapperRef: ReturnType<typeof mount>

const global = {
  stubs: {
    Icon: true,
    Button: { template: '<button><slot /></button>' },
    Badge: passthrough,
    Popover: passthrough,
    PopoverTrigger: passthrough,
    PopoverContent: passthrough,
    Conversation: passthrough,
    ConversationContent: passthrough,
    ConversationScrollButton: true,
    Message: { props: ['from'], template: '<div :data-from="from"><slot /></div>' },
    MessageContent: passthrough,
    MessageResponse: { props: ['content'], template: '<div class="resp">{{ content }}</div>' },
    Shimmer: passthrough,
    PromptInput: PromptInputStub,
    PromptInputBody: passthrough,
    PromptInputTextarea: true,
    PromptInputFooter: passthrough,
    PromptInputSubmit: true,
  },
  config: { warnHandler: () => {} },
}

function mountChat(): ReturnType<typeof mount> {
  return mount(WebsiteAiChat, {
    props: {
      'baseline': { label: 'Published version', at: '2026-10-20T10:30:00Z' },
      'settings': { name: 'Villa Test', domain: 'villa.test', description: '', brandColor: '#1a1a2e', fontFamily: 'Inter', logoFile: null, faviconFile: null, useDefaultFavicon: false },
      'onUpdate:settings': (v: unknown) => wrapperRef.setProps({ settings: v as never }),
    },
    global,
  })
}
afterEach(() => vi.useRealTimers())

describe('websiteAiChat', () => {
  it('opens on a greeting with suggestions and no thread', () => {
    wrapperRef = mountChat()
    expect(wrapperRef.get('[data-testid="we-chat-empty"]').text()).toContain('Villa Test')
    expect(wrapperRef.findAll('[data-testid="we-chat-suggestion"]').length).toBeGreaterThan(0)
    expect(wrapperRef.find('[data-testid="we-chat-user"]').exists()).toBe(false)
  })

  it('a suggestion sends the message, shows thinking, then replies and updates the headline', async () => {
    vi.useFakeTimers()
    wrapperRef = mountChat()
    await wrapperRef.get('[data-testid="we-chat-suggestion"]').trigger('click')
    expect(wrapperRef.get('[data-testid="we-chat-user"]').text()).toContain('hero headline')
    expect(wrapperRef.find('[data-testid="we-chat-thinking"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapperRef.find('[data-testid="we-chat-thinking"]').exists()).toBe(false)
    expect(wrapperRef.get('[data-testid="we-chat-assistant"]').text()).toContain('rewrote the hero headline')
    const emitted = wrapperRef.emitted('update:settings')!
    expect((emitted.at(-1)![0] as { description: string }).description).not.toBe('')
  })

  it('new chat clears the thread', async () => {
    vi.useFakeTimers()
    wrapperRef = mountChat()
    await wrapperRef.get('[data-testid="we-chat-suggestion"]').trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    await wrapperRef.get('[data-testid="we-chat-new"]').trigger('click')
    expect(wrapperRef.find('[data-testid="we-chat-empty"]').exists()).toBe(true)
  })

  it('history starts at the current version and gains one entry per change, which can be restored', async () => {
    vi.useFakeTimers()
    wrapperRef = mountChat()
    let versions = wrapperRef.findAll('[data-testid="we-version"]')
    expect(versions).toHaveLength(1)
    expect(versions[0]!.text()).toContain('Published version')
    expect(versions[0]!.text()).toContain('Current')

    await wrapperRef.get('[data-testid="we-chat-suggestion"]').trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    versions = wrapperRef.findAll('[data-testid="we-version"]')
    expect(versions).toHaveLength(2)
    // Newest first, and it is the current one.
    expect(versions[0]!.text()).toContain('Rewrote the hero headline')
    expect(versions[0]!.text()).toContain('Current')

    await versions[1]!.get('[data-testid="we-version-restore"]').trigger('click')
    const emitted = wrapperRef.emitted('update:settings')!
    expect((emitted.at(-1)![0] as { description: string }).description).toBe('')
    expect(wrapperRef.findAll('[data-testid="we-version"]')[1]!.text()).toContain('Current')
  })
})
