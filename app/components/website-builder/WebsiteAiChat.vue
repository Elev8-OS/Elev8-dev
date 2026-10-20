<script setup lang="ts">
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const props = defineProps<{
  /** The version the site has now: what History starts from. */
  baseline: { label: string, at: string }
}>()

const settings = defineModel<WebsiteSettings>('settings', { required: true })

interface Version {
  id: string
  label: string
  at: string
  settings: WebsiteSettings
}

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
function respond(text: string): { reply: string, label: string | null } {
  const t = text.toLowerCase()
  if (/headline|hero|punchy|emotional|subtext|shorter/.test(t)) {
    const headline = HEADLINES[headlineIndex++ % HEADLINES.length]!
    settings.value = { ...settings.value, description: headline }
    return { label: 'Rewrote the hero headline', reply: `I rewrote the hero headline:\n\n**${headline}**\n\nIt is in the preview. Save changes to put it live.` }
  }
  if (/colou?r|bold|brand/.test(t)) {
    settings.value = { ...settings.value, brandColor: '#b45309' }
    return { label: 'Changed the brand color', reply: 'I switched the brand color to a warmer amber. It shows on the Book now button in the preview.' }
  }
  if (/font|typograph|serif|elegant/.test(t)) {
    settings.value = { ...settings.value, fontFamily: 'Playfair Display' }
    return { label: 'Changed the font', reply: 'I changed the font to Playfair Display for headings and the menu.' }
  }
  return { label: null, reply: 'In this demo I can change the hero headline, the brand color and the font. Try one of those.' }
}

// History: the version the site has now, then one version per change ElevAI made in this session.
const versions = ref<Version[]>([{ id: 'base', label: props.baseline.label, at: props.baseline.at, settings: { ...settings.value } }])
const currentId = ref('base')

function time(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

function restore(v: Version) {
  settings.value = { ...v.settings }
  currentId.value = v.id
  toast.success('Version restored', { description: `${v.label}. Save changes to put it live.` })
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
    const { reply, label } = respond(content)
    messages.value = [...messages.value, { id: `m-${Date.now()}-a`, role: 'assistant', content: reply }]
    if (label) {
      const version = { id: `v-${Date.now()}`, label, at: new Date().toISOString(), settings: { ...settings.value } }
      versions.value = [...versions.value, version]
      currentId.value = version.id
    }
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
    <div class="flex items-center justify-between gap-2 border-b px-4 py-2">
      <span class="text-sm font-medium">Edit with ElevAI</span>
      <div class="flex items-center gap-1">
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="ghost" size="sm" data-testid="we-history-trigger">
              <Icon name="lucide:history" class="mr-1.5 size-4" aria-hidden="true" />
              History
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-80 p-0" data-testid="we-history">
            <p class="border-b px-3 py-2 text-sm font-medium">
              Version history
            </p>
            <ul class="max-h-72 divide-y overflow-y-auto">
              <li v-for="v in [...versions].reverse()" :key="v.id" class="flex items-center justify-between gap-3 px-3 py-2.5" data-testid="we-version">
                <div class="min-w-0">
                  <p class="truncate text-sm">
                    {{ v.label }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ time(v.at) }}
                  </p>
                </div>
                <Badge v-if="v.id === currentId" variant="secondary" class="shrink-0">
                  Current
                </Badge>
                <Button v-else variant="outline" size="sm" class="shrink-0" data-testid="we-version-restore" @click="restore(v)">
                  Restore
                </Button>
              </li>
            </ul>
          </PopoverContent>
        </Popover>
        <Button v-if="messages.length > 0" variant="ghost" size="sm" data-testid="we-chat-new" @click="newChat">
          <Icon name="lucide:square-pen" class="mr-1.5 size-4" aria-hidden="true" />
          New chat
        </Button>
      </div>
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
