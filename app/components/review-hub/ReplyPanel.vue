<script setup lang="ts">
import type { ReviewRecord, StayOperationalRecord } from '~/components/review-hub/data/types'
import { format } from 'date-fns'
import { toast } from 'vue-sonner'
import { hostLanguageOptions } from '~/components/airbnb-reviews/data/reviews'

const props = defineProps<{
  review: ReviewRecord
  sor: StayOperationalRecord | null
}>()

const emit = defineEmits<{
  replyPosted: []
}>()

const { generateReplyDraft, approveReply, translateText, rephraseText, resolveTargetLang } = useReviewHub()

const draftText = ref('')
const isGenerating = ref(false)
const isGenerated = ref(false)
const showTranslation = ref(false)
const isTranslating = ref(false)
const isRephrasing = ref(false)
const originalText = ref('')

const targetLangLabel = computed(() => {
  const opt = hostLanguageOptions.find(o => o.value === resolveTargetLang())
  return opt ? opt.label : (resolveTargetLang() ?? 'English')
})

const canTranslate = computed(() => isGenerated.value && draftText.value.trim().length > 0)

// Check if already replied
const isReplied = computed(() => props.review.reply_status === 'replied')

// Channel-specific constraints
const maxChars = computed(() => {
  if (props.review.source === 'airbnb') return 500
  if (props.review.source === 'booking_com') return 1000
  return 5000
})

const channelNote = computed(() => {
  if (props.review.source === 'airbnb') return 'Airbnb: ~500 character limit'
  if (props.review.source === 'booking_com') return 'Booking.com: Management response format'
  return 'Direct: No character limit'
})

// Grounding indicator
const groundingInfo = computed(() => {
  if (!props.sor) return 'Limited data - draft is general'
  const parts: string[] = []
  if (props.sor.cleaning_score !== null) parts.push(`cleaning score ${props.sor.cleaning_score}/5`)
  parts.push(`${props.sor.house_rule_flags.length} house rule flags`)
  if (props.sor.communication_score !== null) parts.push(`communication score ${props.sor.communication_score}/5`)
  return `Referenced: ${parts.join(', ')}`
})

function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

async function handleGenerate() {
  isGenerating.value = true
  draftText.value = await generateReplyDraft(props.review.id)
  originalText.value = draftText.value
  showTranslation.value = false
  isGenerated.value = true
  isGenerating.value = false
}

async function handleTranslate() {
  if (!canTranslate.value)
    return
  if (showTranslation.value) {
    // Toggle back to the original draft
    draftText.value = originalText.value
    showTranslation.value = false
    return
  }
  isTranslating.value = true
  try {
    draftText.value = await translateText(originalText.value)
    showTranslation.value = true
  }
  finally {
    isTranslating.value = false
  }
}

async function handleRephrase() {
  if (!canTranslate.value) return
  isRephrasing.value = true
  try {
    // Rephrase whatever is currently shown (original or translated draft)
    draftText.value = await rephraseText(draftText.value)
    originalText.value = draftText.value
    showTranslation.value = false
  }
  finally {
    isRephrasing.value = false
  }
}

function handleApprove() {
  if (!draftText.value.trim()) return
  approveReply(props.review.id, draftText.value)
  emit('replyPosted')
}

function handleCopy() {
  navigator.clipboard.writeText(draftText.value)
  toast.success('Reply copied to clipboard.')
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <SharedAiIcon custom-class="size-4 text-primary" />
        <span class="text-sm font-medium">AI Reply to Guest Review</span>
      </div>
      <span class="text-xs text-muted-foreground">{{ channelNote }}</span>
    </div>

    <!-- Already Replied -->
    <template v-if="isReplied">
      <div class="rounded-lg border bg-green-50 p-4">
        <div class="flex items-center gap-2 text-green-700">
          <Icon name="lucide:check-circle-2" class="size-4" />
          <span class="text-sm font-medium">Reply Posted</span>
        </div>
        <p class="mt-2 text-sm leading-relaxed">
          {{ review.reply_text }}
        </p>
        <p v-if="review.reply_posted_at" class="mt-2 text-xs text-muted-foreground">
          Posted {{ formatDate(review.reply_posted_at) }}
        </p>
      </div>
    </template>

    <!-- Generate Form -->
    <template v-else-if="!isGenerated">
      <div class="rounded-lg border border-dashed p-6 text-center">
        <SharedAiIcon custom-class="mx-auto size-6 text-muted-foreground" />
        <p class="mt-2 text-sm text-muted-foreground">
          Generate an AI-powered reply grounded in the stay's operational data.
        </p>
        <Button class="mt-4 gap-2" :disabled="isGenerating" @click="handleGenerate">
          <Icon v-if="isGenerating" name="lucide:loader-circle" class="size-4 animate-spin" />
          <SharedAiIcon v-else custom-class="size-4" />
          {{ isGenerating ? 'Generating...' : 'Generate Reply Draft' }}
        </Button>
      </div>
    </template>

    <!-- Edit Generated Draft -->
    <template v-else>
      <!-- Grounding Indicator -->
      <div class="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
        <Icon name="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
        <span>{{ groundingInfo }}</span>
      </div>

      <!-- Draft Editor -->
      <div class="space-y-2">
        <Textarea
          v-model="draftText"
          :rows="6"
          :maxlength="maxChars"
          placeholder="Edit the reply..."
          class="text-sm"
        />
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">{{ draftText.length }}/{{ maxChars }}</span>
            <Button
              v-if="canTranslate"
              variant="ghost"
              size="sm"
              class="gap-1.5"
              :disabled="isGenerating || isTranslating"
              @click="handleTranslate"
            >
              <Icon :name="showTranslation ? 'lucide:undo-2' : 'lucide:languages'" class="size-3.5" />
              {{ showTranslation ? 'Show original' : 'Translate' }}
            </Button>
            <span v-if="isTranslating" class="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Icon name="lucide:loader-2" class="size-3 animate-spin" />
              Translating...
            </span>
            <span
              v-else-if="showTranslation"
              class="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <Icon name="lucide:languages" class="size-2.5" />
              Translated to {{ targetLangLabel }}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <Button
              v-if="canTranslate"
              variant="ghost"
              size="sm"
              class="gap-1.5"
              :disabled="isGenerating || isRephrasing || isTranslating"
              @click="handleRephrase"
            >
              <Icon name="lucide:refresh-cw" class="size-3.5" :class="isRephrasing && 'animate-spin'" />
              {{ isRephrasing ? 'Rephrasing...' : 'Rephrase' }}
            </Button>
            <Button variant="ghost" size="sm" class="gap-1.5" :disabled="isGenerating" @click="handleGenerate">
              <Icon name="lucide:refresh-cw" class="size-3.5" :class="isGenerating && 'animate-spin'" />
              Regenerate
            </Button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <template v-if="review.source === 'direct'">
          <Button variant="outline" class="gap-1.5" @click="handleCopy">
            <Icon name="lucide:copy" class="size-3.5" />
            Copy to Clipboard
          </Button>
        </template>
        <template v-else>
          <Button variant="outline" class="gap-1.5" @click="handleCopy">
            <Icon name="lucide:copy" class="size-3.5" />
            Copy
          </Button>
          <Button class="gap-1.5" @click="handleApprove">
            <Icon name="lucide:send" class="size-3.5" />
            Approve & Post
          </Button>
        </template>
      </div>
    </template>
  </div>
</template>
