<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'

const props = defineProps<{ listing: Listing, open: boolean }>()
const emit = defineEmits<{ 'update:open': [val: boolean] }>()

interface Message { role: 'guest' | 'ai', text: string }

const messages = ref<Message[]>([
  { role: 'ai', text: `Hi! I'm the AI assistant for ${props.listing.name}. How can I help you today?` },
])
const input = ref('')
const isTyping = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

const starters = [
  'What time is check-in?',
  'Is there parking available?',
  'What\'s the WiFi password?',
]

function getMockResponse(question: string): string {
  const q = question.toLowerCase()
  if (q.includes('check-in') || q.includes('checkin')) {
    const time = props.listing.resources.basics.checkInTime ?? '14:00'
    return `Check-in is at ${time}. Early check-in may be available upon request.`
  }
  if (q.includes('check-out') || q.includes('checkout')) {
    const time = props.listing.resources.basics.checkOutTime ?? '11:00'
    return `Check-out is at ${time}. Late check-out can be arranged for an additional fee.`
  }
  if (q.includes('parking')) {
    const hasParking = props.listing.amenities.includes('Parking')
    return hasParking
      ? 'Yes, free private parking is available on the property.'
      : 'Unfortunately there is no dedicated parking on-site. Street parking is available nearby.'
  }
  if (q.includes('wifi') || q.includes('wi-fi') || q.includes('internet')) {
    return 'WiFi details will be provided in your check-in instructions. The connection is high-speed and available throughout the property.'
  }
  if (q.includes('pool')) {
    const hasPool = props.listing.amenities.some(a => a.toLowerCase().includes('pool'))
    return hasPool
      ? 'Yes! The property has a private pool available for guests. Pool hours are 07:00–22:00.'
      : 'This property does not have a pool, but there are nearby facilities available.'
  }
  return 'That\'s a great question! I\'ll check with the host and get back to you shortly. Is there anything else I can help with?'
}

async function send(text?: string) {
  const msg = (text ?? input.value).trim()
  if (!msg)
    return
  input.value = ''
  messages.value.push({ role: 'guest', text: msg })
  isTyping.value = true
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
  await new Promise(r => setTimeout(r, 900))
  messages.value.push({ role: 'ai', text: getMockResponse(msg) })
  isTyping.value = false
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-lg flex flex-col gap-0 p-0 h-[600px]">
      <DialogHeader class="px-5 py-4 border-b flex-shrink-0">
        <div class="flex items-center gap-2">
          <DialogTitle>Test AI</DialogTitle>
          <Badge variant="secondary" class="text-xs">
            Simulating guest view
          </Badge>
        </div>
        <DialogDescription>{{ listing.name }}</DialogDescription>
      </DialogHeader>

      <div ref="scrollEl" class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <div
          v-for="(msg, i) in messages" :key="i"
          class="flex"
          :class="msg.role === 'guest' ? 'justify-end' : 'justify-start'"
        >
          <div v-if="msg.role === 'ai'" class="flex items-end gap-2 max-w-[80%]">
            <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#C8A84B]/20">
              <Icon name="lucide:bot" class="size-4 text-[#C8A84B]" />
            </div>
            <div class="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
              {{ msg.text }}
            </div>
          </div>
          <div v-else class="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
            {{ msg.text }}
          </div>
        </div>

        <div v-if="isTyping" class="flex items-end gap-2">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#C8A84B]/20">
            <Icon name="lucide:bot" class="size-4 text-[#C8A84B]" />
          </div>
          <div class="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
            <span class="animate-pulse">···</span>
          </div>
        </div>
      </div>

      <div v-if="messages.length <= 1" class="flex flex-wrap gap-2 px-4 pb-2">
        <button
          v-for="s in starters" :key="s"
          class="rounded-full border px-3 py-1 text-xs hover:bg-accent transition-colors"
          @click="send(s)"
        >
          {{ s }}
        </button>
      </div>

      <div class="flex gap-2 border-t px-4 py-3 flex-shrink-0">
        <Input
          v-model="input" placeholder="Ask as a guest..." class="flex-1"
          @keydown.enter="send()"
        />
        <Button size="sm" :disabled="!input.trim() || isTyping" @click="send()">
          <Icon name="lucide:send" class="size-4" />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
