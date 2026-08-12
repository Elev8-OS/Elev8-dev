<script lang="ts" setup>
import type { ScheduledTemplate, StayStatus } from '~/components/inbox/data/conversations'
import { toast } from 'vue-sonner'
import { useInbox } from '@/composables/useInbox'

interface ReplyBoxProps {
  channel: string
  conversationId: string
  stayStatus?: StayStatus
}

const props = defineProps<ReplyBoxProps>()
const { isElevaiEnabled, pendingSuggestion, clearSuggestion, selectedReservation, sendMessage, selectedConversation, autoTranslate } = useInbox()
const showOrderCreator = ref(false)

const replyText = ref('')
const isRewriting = ref(false)
const attachedImage = ref<string | null>(null)
const attachedImageDims = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const elevaiOn = computed(() => isElevaiEnabled(props.conversationId))
const showRewrite = computed(() => replyText.value.trim().length > 0)
const canSend = computed(() => replyText.value.trim().length > 0 || attachedImage.value)

const sendChannel = ref('ota')

const isNotInquiry = computed(() => props.stayStatus !== 'inquiry')

const channelOptions = computed(() => {
  const opts = [
    { value: 'ota', label: props.channel, icon: props.channel === 'Airbnb' ? 'logos:airbnb' : props.channel === 'WhatsApp' ? 'logos:whatsapp-icon' : 'simple-icons:bookingdotcom' },
    { value: 'email', label: 'Email', icon: 'lucide:mail' },
  ]
  if (isNotInquiry.value) {
    opts.push({ value: 'guide', label: 'Guest Guide', icon: 'lucide:book-open' })
  }
  return opts
})

const channelIcon = computed(() => {
  const selected = channelOptions.value.find(o => o.value === sendChannel.value)
  return selected?.icon ?? 'lucide:send'
})

const channelLabel = computed(() => {
  const selected = channelOptions.value.find(o => o.value === sendChannel.value)
  return selected?.label ?? ''
})

const guestLanguage = computed(() => selectedConversation.value?.guestLanguage)
const showTranslateIndicator = computed(() => autoTranslate.value && !!guestLanguage.value)

const rewrites = [
  'Thanks for reaching out! I\'d be happy to help with that. Let me look into it and get back to you shortly.',
  'Thank you for your message! We appreciate you letting us know. I\'ll take care of this right away.',
  'Great question! Here\'s what I can tell you — check-in is from 3 PM, and we\'ll have everything ready for your arrival.',
  'We\'re so glad you\'re staying with us! I\'ve noted your request and our team will make sure everything is taken care of.',
  'Thanks for letting us know! We want to make sure your stay is perfect. I\'ll have our team address this immediately.',
]

function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  const url = URL.createObjectURL(file)
  attachedImage.value = url
  const img = new Image()
  img.onload = () => {
    attachedImageDims.value = `${img.naturalWidth} × ${img.naturalHeight}`
  }
  img.src = url
  if (fileInputRef.value)
    fileInputRef.value.value = ''
}

function removeAttachedImage() {
  if (attachedImage.value)
    URL.revokeObjectURL(attachedImage.value)
  attachedImage.value = null
  attachedImageDims.value = null
}

function send() {
  if (!replyText.value.trim() && !attachedImage.value)
    return
  const channel = sendChannel.value === 'ota' ? props.channel : sendChannel.value
  // Email replies are sent from the tenant's connected sending address.
  const fromAddress = channel === 'email' ? getActiveEmailAddress() ?? undefined : undefined
  sendMessage(
    props.conversationId,
    replyText.value,
    channel,
    undefined,
    attachedImage.value ?? undefined,
    attachedImageDims.value ?? undefined,
    fromAddress,
  )
  replyText.value = ''
  removeAttachedImage()
  toast.success('Message sent')
}

async function rewriteWithAI() {
  isRewriting.value = true
  await new Promise(resolve => setTimeout(resolve, 800))
  const randomRewrite = rewrites[Math.floor(Math.random() * rewrites.length)]!
  replyText.value = randomRewrite
  isRewriting.value = false
}

watch(pendingSuggestion, (val) => {
  if (val) {
    replyText.value = val
    clearSuggestion()
  }
})

const dynamicTemplates = [
  {
    id: 'tpl-checkin',
    label: 'Check-in Instructions',
    icon: 'lucide:key',
    content: `Hi {{guestName}}! Welcome to {{propertyName}}. Check-in is at 3 PM. Our team will greet you at the villa. Here's what you need to know:\n\n• Address: {{propertyAddress}}\n• WiFi: {{wifiName}} / {{wifiPassword}}\n• Parking: Available on-site\n\nLet us know if you need anything!`,
  },
  {
    id: 'tpl-welcome',
    label: 'Welcome Message',
    icon: 'lucide:message-circle',
    content: `Hi {{guestName}}! Welcome to Bali! We hope you have a wonderful stay at {{propertyName}}. If you need any recommendations or assistance, don't hesitate to reach out. Enjoy your trip!`,
  },
  {
    id: 'tpl-checkout',
    label: 'Check-out Reminder',
    icon: 'lucide:log-out',
    content: `Hi {{guestName}}, just a friendly reminder that check-out is at 11 AM tomorrow. Please leave keys on the counter and let us know if you need help with luggage. Safe travels!`,
  },
  {
    id: 'tpl-maintenance',
    label: 'Maintenance Update',
    icon: 'lucide:wrench',
    content: `Hi {{guestName}}, our maintenance team has been dispatched and should arrive within 30 minutes. We apologize for the inconvenience and appreciate your patience.`,
  },
]

const scheduledTemplates = computed<ScheduledTemplate[]>(() => selectedReservation.value?.scheduledTemplates ?? [])

function useTemplate(template: typeof dynamicTemplates[number]) {
  replyText.value = template.content
  toast.info(`Template "${template.label}" loaded`)
}

function handleSendNow(template: ScheduledTemplate) {
  replyText.value = template.content
  toast.info(`"${template.label}" loaded`)
}

function templateStatusBadge(status: ScheduledTemplate['status']) {
  const map = {
    pending: { label: 'Scheduled', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    sent: { label: 'Sent', class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    cancelled: { label: 'Cancelled', class: 'bg-muted text-muted-foreground' },
  }
  return map[status]
}
</script>

<template>
  <div class="border-t p-3 space-y-2">
    <div v-if="attachedImage" class="relative inline-block">
      <img :src="attachedImage" alt="Attached image" class="max-h-32 rounded-lg border object-cover">
      <button
        type="button"
        class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm hover:bg-foreground/80"
        @click="removeAttachedImage"
      >
        <Icon name="lucide:x" class="size-3" />
      </button>
    </div>
    <div class="relative">
      <Textarea
        v-model="replyText"
        placeholder="Type your reply..."
        class="min-h-[80px] max-h-[200px] resize-none pr-10"
        @keydown.enter.meta="send"
      />
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <button
          v-if="showRewrite && elevaiOn && !isRewriting"
          class="absolute right-2 bottom-2 flex items-center justify-center size-7 rounded-md text-[#FBC800] hover:bg-[#FBC800]/10 transition-colors"
          title="Rewrite with ElevAI"
          @click="rewriteWithAI"
        >
          <Icon name="lucide:sparkles" class="size-4" />
        </button>
      </Transition>
      <div
        v-if="isRewriting"
        class="absolute right-2 bottom-2 flex items-center gap-1 text-[10px] text-muted-foreground"
      >
        <Icon name="lucide:loader-2" class="size-3.5 animate-spin text-[#FBC800]" />
        Rewriting
      </div>
    </div>
    <div v-if="showTranslateIndicator" class="flex items-center gap-1.5 px-1">
      <Icon name="lucide:languages" class="size-3.5 text-muted-foreground" />
      <span class="text-[11px] text-muted-foreground">Messages will be auto-translated to {{ guestLanguage }}</span>
    </div>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileSelect"
        >
        <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs text-muted-foreground" @click="fileInputRef?.click()">
          <Icon name="lucide:paperclip" class="size-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs">
              <Icon :name="channelIcon" class="size-3.5" />
              {{ channelLabel }}
              <Icon name="lucide:chevron-down" class="size-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-48">
            <DropdownMenuItem
              v-for="opt of channelOptions"
              :key="opt.value"
              :class="{ 'bg-accent': sendChannel === opt.value }"
              @click="sendChannel = opt.value"
            >
              <Icon :name="opt.icon" class="mr-2 size-4" />
              {{ opt.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          class="h-7 gap-1.5"
          @click="showOrderCreator = true"
        >
          <Icon name="lucide:shopping-cart" class="h-4 w-4" />
          <span class="hidden sm:inline">Upsell</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs text-muted-foreground">
              <Icon name="lucide:file-text" class="size-3.5" />
              Templates
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-64 p-0">
            <div class="p-2">
              <div class="text-[10px] font-medium text-muted-foreground mb-1 px-1">
                Quick Templates
              </div>
              <button
                v-for="tpl of dynamicTemplates"
                :key="tpl.id"
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                @click="useTemplate(tpl)"
              >
                <Icon :name="tpl.icon" class="size-3.5 text-muted-foreground" />
                <span class="flex-1 text-left truncate">{{ tpl.label }}</span>
                <Icon name="lucide:arrow-down-to-line" class="size-3 text-muted-foreground" />
              </button>
            </div>
            <Separator v-if="scheduledTemplates.length > 0" />
            <div v-if="scheduledTemplates.length > 0" class="p-2">
              <div class="text-[10px] font-medium text-muted-foreground mb-1 px-1">
                Scheduled
              </div>
              <div
                v-for="tpl of scheduledTemplates"
                :key="tpl.id"
                class="flex items-center gap-2 rounded-md px-2 py-1.5"
              >
                <Icon :name="tpl.icon" class="size-3.5 text-muted-foreground" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs truncate">{{ tpl.label }}</span>
                    <span class="inline-flex items-center rounded-full px-1 py-0 text-[9px] font-medium" :class="[templateStatusBadge(tpl.status).class]">
                      {{ templateStatusBadge(tpl.status).label }}
                    </span>
                  </div>
                </div>
                <Button v-if="tpl.status === 'pending'" variant="ghost" size="sm" class="h-5 px-1.5 text-[10px] gap-1 shrink-0" @click="handleSendNow(tpl)">
                  <Icon name="lucide:send" class="size-2.5" />
                  Send
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button
        variant="default"
        size="sm"
        :disabled="!canSend"
        @click="send"
      >
        <Icon name="lucide:send" class="size-4" />
        Send
      </Button>
    </div>
  </div>
  <InboxUpsellOrderCreator
    :conversation="selectedConversation ?? null"
    :open="showOrderCreator"
    @update:open="showOrderCreator = $event"
  />
</template>
