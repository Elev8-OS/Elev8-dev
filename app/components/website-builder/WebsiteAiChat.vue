<script setup lang="ts">
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { ref } from 'vue'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const settings = defineModel<WebsiteSettings>('settings', { required: true })

const SUGGESTIONS = [
  { label: 'Rewrite the hero headline', prompt: 'Rewrite the hero headline to be more emotional' },
  { label: 'Use bolder colors', prompt: 'Use a bolder brand color' },
  { label: 'Try a serif font', prompt: 'Switch to a more elegant font' },
  { label: 'Shorter subtext', prompt: 'Make the subtext shorter' },
]

const HEADLINES = [
  'Wake up to rice fields and the sound of Bali',
  'Your own slice of paradise, steps from the sea',
  'Slow mornings, warm evenings, a villa that feels like home',
]

// Mock engine: it only changes what the preview can show (headline, brand color, font).
let headlineIndex = 0
function respond(text: string): string {
  const t = text.toLowerCase()
  if (/headline|hero|punchy|emotional|subtext|shorter/.test(t)) {
    const headline = HEADLINES[headlineIndex++ % HEADLINES.length]!
    settings.value = { ...settings.value, description: headline }
    return `I rewrote the hero headline:\n\n**${headline}**\n\nIt is in the preview. Save changes to put it live.`
  }
  if (/colou?r|bold|brand/.test(t)) {
    settings.value = { ...settings.value, brandColor: '#b45309' }
    return 'I switched the brand color to a warmer amber. It shows on the Book now button in the preview.'
  }
  if (/font|typograph|serif|elegant/.test(t)) {
    settings.value = { ...settings.value, fontFamily: 'Playfair Display' }
    return 'I changed the font to Playfair Display for headings and the menu.'
  }
  return 'In this demo I can change the hero headline, the brand color and the font. Try one of those.'
}

const messages = ref<ChatMessage[]>([])
const thinking = ref(false)

function send(text: string) {
  const content = text.trim()
  if (!content || thinking.value)
    return
  messages.value = [...messages.value, { id: `m-${Date.now()}`, role: 'user', content }]
  thinking.value = true
  setTimeout(() => {
    messages.value = [...messages.value, { id: `m-${Date.now()}-a`, role: 'assistant', content: respond(content) }]
    thinking.value = false
  }, 900)
}

function onSubmit(payload: { text: string }) {
  return send(payload.text)
}

function newChat() {
  messages.value = []
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col" data-testid="we-chat">
    <div v-if="messages.length > 0" class="flex items-center justify-between border-b px-4 py-2">
      <span class="text-sm font-medium">Edit with ElevAI</span>
      <Button variant="ghost" size="sm" data-testid="we-chat-new" @click="newChat">
        <Icon name="lucide:square-pen" class="mr-1.5 size-4" aria-hidden="true" />
        New chat
      </Button>
    </div>

    <!-- Empty state -->
    <div v-if="messages.length === 0" class="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-8 text-center" data-testid="we-chat-empty">
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Icon name="elev8:elevai" class="size-6" aria-hidden="true" />
      </div>
      <div class="space-y-1">
        <h3 class="text-xl font-semibold">
          What should we change on {{ settings.name || 'your site' }}?
        </h3>
        <p class="text-sm text-muted-foreground">
          Describe a change and watch it happen in the preview.
        </p>
      </div>
      <div class="flex max-w-md flex-wrap justify-center gap-2">
        <button
          v-for="s in SUGGESTIONS"
          :key="s.label"
          type="button"
          class="rounded-full border bg-background px-3.5 py-1.5 text-sm transition-colors hover:bg-muted"
          data-testid="we-chat-suggestion"
          @click="send(s.prompt)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- Thread -->
    <Conversation v-else class="min-h-0 flex-1">
      <ConversationContent class="flex flex-col gap-5 p-4">
        <Message v-for="m in messages" :key="m.id" :from="m.role" class="max-w-full" :data-testid="`we-chat-${m.role}`">
          <div v-if="m.role === 'assistant'" class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon name="elev8:elevai" class="size-4" aria-hidden="true" />
          </div>
          <MessageContent :class="m.role === 'user' ? 'max-w-[85%] rounded-2xl' : 'px-0'">
            <MessageResponse v-if="m.role === 'assistant'" :content="m.content" />
            <div v-else class="whitespace-pre-wrap">
              {{ m.content }}
            </div>
          </MessageContent>
        </Message>
        <Message v-if="thinking" from="assistant" class="max-w-full" data-testid="we-chat-thinking">
          <div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon name="elev8:elevai" class="size-4" aria-hidden="true" />
          </div>
          <MessageContent class="px-0">
            <Shimmer class="text-sm">
              Thinking...
            </Shimmer>
          </MessageContent>
        </Message>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>

    <!-- Composer -->
    <div class="p-3">
      <PromptInput class="w-full rounded-2xl bg-background" @submit="onSubmit">
        <PromptInputBody>
          <PromptInputTextarea placeholder="Ask ElevAI to change something..." :maxlength="2000" data-testid="we-chat-input" />
        </PromptInputBody>
        <PromptInputFooter class="flex justify-end gap-1">
          <PromptInputSubmit :status="thinking ? 'streaming' : 'ready'" data-testid="we-chat-send" />
        </PromptInputFooter>
      </PromptInput>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        ElevAI changes the draft only. Save changes to publish.
      </p>
    </div>
  </div>
</template>
