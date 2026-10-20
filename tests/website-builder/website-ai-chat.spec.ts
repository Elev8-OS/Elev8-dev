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
})
