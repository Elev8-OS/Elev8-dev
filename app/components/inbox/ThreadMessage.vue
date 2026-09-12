<script lang="ts" setup>
import type { Message } from '~/components/inbox/data/conversations'
import { differenceInDays, format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { cn } from '~/lib/utils'

interface ThreadMessageProps {
  message: Message
}

const props = defineProps<ThreadMessageProps>()

const senderTypeLabel: Record<string, string> = {
  guest: 'Guest',
  host: 'Staff',
  system: 'System',
  ai: 'ElevAI',
}

const { retryMessage, autoTranslate, selectedConversation } = useInbox()

const mockTranslations: Record<string, string> = {
  'Hi! We\'re arriving tomorrow and wanted to confirm the check-in process.': 'Halo! Kami tiba besok dan ingin mengonfirmasi proses check-in.',
  'What time is check-in? We arrive at 3 PM.': 'Jam berapa check-in? Kami tiba jam 3 sore.',
  'Thanks for the info! I\'ll confirm soon.': 'Terima kasih infonya! Saya akan konfirmasi segera.',
  'Is there parking available at the property?': 'Apakah ada parkir di properti?',
  'Thank you so much! Really looking forward to our stay.': 'Terima kasih banyak! Sangat menantikan masa tinggal kami.',
  'Could you recommend any good restaurants nearby?': 'Bisa rekomendasikan restoran bagus di sekitar sini?',
  'Hello! We had a great time at your place. Thank you!': 'Halo! Kami senang sekali di tempat Anda. Terima kasih!',
  'We had an issue with the AC. Can someone come fix it?': 'Kami ada masalah dengan AC. Bisa kirim orang untuk memperbaiki?',
  'What\'s the WiFi password?': 'Password WiFi-nya apa?',
  'Thanks for the wonderful stay! We\'ll definitely be back.': 'Terima kasih untuk masa tinggal yang menyenangkan! Kami pasti akan kembali.',
  'Is early check-in possible? Our flight arrives at 10 AM.': 'Apakah early check-in memungkinkan? Penerbangan kami tiba jam 10 pagi.',
  'Can we extend our stay by one night?': 'Bisa memperpanjang masa tinggal kami satu malam?',
  'The hot water isn\'t working properly.': 'Air panas tidak berfungsi dengan baik.',
  'Do you provide airport transfer service?': 'Apakah Anda menyediakan layanan transfer bandara?',
  'Everything was great, thank you!': 'Semuanya bagus, terima kasih!',
  'Hi, is your place available for a 2-night stay next weekend?': 'Halo, apakah tempat Anda tersedia untuk menginap 2 malam akhir pekan depan?',
  'Thanks! We\'d love to book it.': 'Terima kasih! Kami ingin sekali memesannya.',
  'What\'s the earliest we can check in?': 'Jam berapa paling awal kami bisa check-in?',
  'That sounds perfect, thank you!': 'Kedengarannya sempurna, terima kasih!',
  'We\'d also like to arrange airport pickup if possible.': 'Kami juga ingin mengatur penjemputan bandara jika memungkinkan.',
  'How far is the villa from the beach?': 'Seberapa jauh vila dari pantai?',
  'We have a late flight on checkout day, can we stay until 6 PM?': 'Kami ada penerbangan malam saat checkout, bisa tinggal sampai jam 6 sore?',
  'Is the pool heated?': 'Apakah kolam renangnya dipanaskan?',
  'Can you help us book a scooter?': 'Bisa bantu kami pesan scooter?',
  'We\'re celebrating our anniversary, any special arrangements?': 'Kami merayakan anniversary, ada pengaturan khusus?',
  'The bathroom drain seems to be clogged.': 'Saluran kamar mandi sepertinya tersumbat.',
  'Is there a washing machine we can use?': 'Apakah ada mesin cuci yang bisa kami pakai?',
}

const mockHostTranslations: Record<string, Record<string, string>> = {
  English: {
    'Check-in is at 3 PM. Our team will meet you at the villa.': 'Check-in is at 3 PM. Our team will meet you at the villa.',
    'Welcome to the villa! Let me know if you need anything.': 'Welcome to the villa! Let me know if you need anything.',
    'Thank you for reaching out! Here are the directions to our property.': 'Thank you for reaching out! Here are the directions to our property.',
    'Sure, I\'ll send someone to fix the AC right away.': 'Sure, I\'ll send someone to fix the AC right away.',
    'The WiFi password is: VillaBali2024': 'The WiFi password is: VillaBali2024',
    'Thank you for staying with us! We hope to see you again.': 'Thank you for staying with us! We hope to see you again.',
    'Yes, early check-in is available. Please let us know your arrival time.': 'Yes, early check-in is available. Please let us know your arrival time.',
    'Of course! You can extend for one more night at the same rate.': 'Of course! You can extend for one more night at the same rate.',
    'Our maintenance team will look into the hot water issue immediately.': 'Our maintenance team will look into the hot water issue immediately.',
    'Yes, we provide airport transfer for an additional fee. Would you like to arrange one?': 'Yes, we provide airport transfer for an additional fee. Would you like to arrange one?',
  },
  Japanese: {
    'Check-in is at 3 PM. Our team will meet you at the villa.': 'チェックインは午後3時です。スタッフがヴィラでお待ちしております。',
    'Welcome to the villa! Let me know if you need anything.': 'ヴィラへようこそ！何か必要なことがあればお知らせください。',
    'Thank you for reaching out! Here are the directions to our property.': 'お問い合わせありがとうございます！プロパティへの道順をお送りします。',
    'Sure, I\'ll send someone to fix the AC right away.': 'すぐにエアコンの修理にスタッフを送ります。',
    'The WiFi password is: VillaBali2024': 'WiFiパスワード：VillaBali2024',
    'Thank you for staying with us! We hope to see you again.': 'ご滞在ありがとうございました！またお会いできることを願っております。',
  },
}

const translation = ref<string | null>(null)
const isTranslating = ref(false)
const isRetrying = ref(false)

const targetLang = computed(() => {
  if (!autoTranslate.value)
    return null
  return selectedConversation.value?.guestLanguage ?? 'English'
})

const translationLabel = computed(() => {
  if (props.message.sender === 'guest')
    return 'Translated from English'
  return `Translated to ${targetLang.value ?? 'English'}`
})

watch([() => props.message.content, autoTranslate], async ([content, enabled]) => {
  if (!enabled || props.message.sender === 'system' || props.message.sender === 'ai') {
    translation.value = null
    return
  }

  if (!content)
    return

  isTranslating.value = true
  translation.value = null

  await new Promise(resolve => setTimeout(resolve, 600))

  if (props.message.sender === 'guest') {
    translation.value = mockTranslations[content] ?? `[Diterjemahkan] ${content}`
  }
  else {
    const lang = targetLang.value ?? 'English'
    const langMap = mockHostTranslations[lang] ?? mockHostTranslations.English
    translation.value = langMap[content] ?? `[Translated to ${lang}] ${content}`
  }

  isTranslating.value = false
}, { immediate: true })

function handleRetry() {
  if (props.message.conversationId && props.message.sendStatus === 'failed') {
    isRetrying.value = true
    retryMessage(props.message.conversationId, props.message.id)
  }
}

watch(() => props.message.sendStatus, (status) => {
  if (status !== 'sending') {
    isRetrying.value = false
  }
})

const isFromMe = computed(() => props.message.sender === 'host' && props.message.senderName === 'You')

const isAiWritten = computed(() => props.message.aiWritten === true)

const reasoning = computed(() => props.message.aiReasoning ?? null)
const reasoningOpen = ref(false)

const displayName = computed(() => {
  if (isAiWritten.value)
    return 'ElevAI'
  return props.message.senderName
})

const displayLabel = computed(() => {
  if (isAiWritten.value)
    return null
  if (isFromMe.value)
    return 'You'
  if (props.message.senderRole)
    return props.message.senderRole
  return senderTypeLabel[props.message.sender]
})

const bubbleClass = computed(() => {
  if (props.message.sender === 'guest') {
    return 'bg-muted'
  }
  if (props.message.sender === 'host') {
    return 'bg-warning text-warning-foreground'
  }
  return ''
})

const alignClass = computed(() => {
  if (props.message.sender === 'system' || props.message.sender === 'ai')
    return 'justify-center'
  if (props.message.sender === 'host')
    return 'justify-end'
  return 'justify-start'
})

const isSystemMessage = computed(() => props.message.sender === 'system' || props.message.sender === 'ai')

const timeLabel = computed(() => {
  const date = new Date(props.message.timestamp)
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true })
  }
  return format(date, 'h:mm a')
})

const dateLabel = computed(() => {
  const date = new Date(props.message.timestamp)
  if (isToday(date))
    return ''
  if (isYesterday(date))
    return 'Yesterday'
  const daysAgo = differenceInDays(new Date(), date)
  if (daysAgo <= 3)
    return `${daysAgo} days ago`
  return format(date, 'EEEE, d MMM yyyy')
})
</script>

<template>
  <div :class="cn('flex gap-2.5', alignClass)">
    <template v-if="!isSystemMessage">
      <Avatar v-if="message.sender === 'guest'" class="size-8 shrink-0 mt-1">
        <AvatarFallback class="text-xs">
          {{ message.senderName.split(' ').map(n => n[0]).join('') }}
        </AvatarFallback>
      </Avatar>
      <div v-if="isAiWritten" class="flex size-8 shrink-0 mt-1 items-center justify-center rounded-full bg-[#FBC800]/10">
        <Icon name="lucide:sparkles" class="size-4 text-[#FBC800]" />
      </div>

      <div class="group/msg flex flex-col gap-1 max-w-[75%]">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium">{{ displayName }}</span>
          <span v-if="displayLabel" class="text-[10px] text-muted-foreground">{{ displayLabel }}</span>
          <span v-if="isAiWritten" class="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Icon name="lucide:sparkles" class="size-3" />
            AI
          </span>
          <span v-if="message.channel" class="text-[10px] text-muted-foreground">via {{ message.channel }}</span>
          <span v-if="dateLabel" class="text-[10px] text-muted-foreground">· {{ dateLabel }}</span>
          <span class="text-[10px] text-muted-foreground">{{ timeLabel }}</span>
        </div>
        <div :class="cn('rounded-2xl px-3 py-2 text-sm', bubbleClass)">
          <div v-if="message.mediaUrl" class="mb-1.5 overflow-hidden rounded-lg">
            <img :src="message.mediaUrl" :alt="message.content" class="max-h-56 w-full object-cover">
            <div v-if="message.mediaDims" class="flex items-center gap-1 pt-1 text-[10px] opacity-70">
              <Icon name="lucide:camera" class="size-3" />
              {{ message.mediaDims }}
            </div>
          </div>
          <template v-if="autoTranslate && (message.sender === 'guest' || message.sender === 'host')">
            <div v-if="isTranslating" class="flex items-center gap-1.5">
              <Icon name="lucide:loader-2" class="size-3 animate-spin text-muted-foreground" />
              <span class="text-xs text-muted-foreground">Translating...</span>
            </div>
            <template v-else-if="translation">
              <p>{{ translation }}</p>
              <span class="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Icon name="lucide:languages" class="size-2.5" />
                {{ translationLabel }}
              </span>
            </template>
            <p v-else>
              {{ message.content }}
            </p>
          </template>
          <p v-else>
            {{ message.content }}
          </p>
        </div>
        <template v-if="reasoning">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover/msg:opacity-100"
            :class="[reasoningOpen && 'opacity-100', message.sender === 'guest' ? 'self-start' : 'self-end']"
            @click="reasoningOpen = true"
          >
            <Icon name="lucide:sparkles" class="size-2.5 text-[#C8A84B]" />
            Why this answer?
          </button>
          <InboxAiReasoningDialog v-model:open="reasoningOpen" :reasoning="reasoning" />
        </template>

        <InboxUpsellOfferCard
          v-if="message.upsellOffer"
          :offer="message.upsellOffer"
          :conversation-id="message.conversationId"
        />
        <div v-if="message.sendStatus === 'sending'" class="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Icon name="lucide:loader-2" class="size-2.5 animate-spin" />
          {{ isRetrying ? 'Retrying...' : 'Sending...' }}
        </div>
        <div v-else-if="message.sendStatus === 'failed'" class="flex items-center gap-1 text-[10px] text-destructive">
          <Icon name="lucide:alert-circle" class="size-2.5" />
          Failed to send
          <button :disabled="isRetrying" class="underline ml-1 hover:text-destructive/80 disabled:opacity-50 disabled:no-underline" @click="handleRetry">
            {{ isRetrying ? 'Retrying...' : 'Retry' }}
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="text-xs italic text-center max-w-[75%] bg-muted/50 text-muted-foreground rounded-lg px-3 py-2">
        {{ message.content }}
      </div>
    </template>
  </div>
</template>
