<script setup lang="ts">
import type { SopAiMode, SopConversationMatch } from '~/components/listings/data/listing-sop-ai'
import type { Listing } from '~/components/listings/data/listings'
import { usePreferredReducedMotion } from '@vueuse/core'
import { draftFromBrief, draftFromConversations, findSopConversations, SOP_AI_MODES, SOP_TONES, sopAiTopic, TYPICAL_GUESTS } from '~/components/listings/data/listing-sop-ai'

/**
 * Create with AI for one SOP. Source: past conversations, or a short guided
 * brief (typical guest, tone, what it should cover, AI mode). ElevAI then
 * "generates" (staged animation, then the draft types itself out), the host
 * edits the draft, and "Use this SOP" writes it. Nothing is written before.
 */
const props = defineProps<{
  open: boolean
  listing: Listing
  /** Default question key (`sop:<key>` / `sops`), or null for a custom SOP. */
  fieldKey: string | null
  /** The question, or the custom SOP's title. */
  title: string
  /** The current text, so the host knows applying replaces it. */
  currentText: string
}>()
const emit = defineEmits<{ 'update:open': [open: boolean], 'apply': [text: string] }>()

type Step = 'source' | 'brief' | 'generating' | 'none' | 'review'
const step = ref<Step>('source')
const draft = ref('')

// Guided brief: 1 typical guest, 2 tone (both optional), 3 what to cover, 4 AI mode.
const BRIEF_STEPS = 4
const briefStep = ref(1)
const guest = ref<string>()
const guestOther = ref('')
const tone = ref<string>()
const toneOther = ref('')
const cover = ref('')
const mode = ref<SopAiMode>()

const topic = computed(() => sopAiTopic(props.fieldKey, props.title || 'Custom SOP'))
const matches = computed<SopConversationMatch[]>(() => findSopConversations(props.listing, topic.value))

watch(() => props.open, (isOpen) => {
  if (!isOpen)
    return
  step.value = 'source'
  draft.value = ''
  briefStep.value = 1
  guest.value = undefined
  guestOther.value = ''
  tone.value = undefined
  toneOther.value = ''
  cover.value = ''
  mode.value = undefined
}, { immediate: true })

/** Steps 1 and 2 share one option list: the typical guest, then the tone. */
const optionValue = computed(() => briefStep.value === 1 ? guest.value : tone.value)
/** Clicking the chosen option again clears it (both are optional). */
function pickOption(value: string) {
  const next = optionValue.value === value ? undefined : value
  if (briefStep.value === 1)
    guest.value = next
  else
    tone.value = next
}
const chosenGuest = computed(() => guest.value === 'Other' ? guestOther.value.trim() || undefined : guest.value)
const chosenTone = computed(() => tone.value === 'Other' ? toneOther.value.trim() || undefined : tone.value)

const canContinueBrief = computed(() => {
  if (briefStep.value === 3)
    return !!cover.value.trim()
  if (briefStep.value === 4)
    return !!mode.value
  return true
})

// --- Generating animation -------------------------------------------------
const reducedMotion = usePreferredReducedMotion()
const stages = ref<string[]>([])
const stageDone = ref(0)
const typing = ref(false)
const STAGE_MS = 550

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Past conversations: ElevAI searches this listing's conversations itself (no
 * picking). If the search finds none, the animation stops on "none" and offers
 * the guided brief instead.
 */
async function generate(from: 'conversations' | 'brief') {
  const found = matches.value
  stages.value = from === 'conversations'
    ? ['Searching this listing\'s conversations', 'Finding what guests asked', 'Writing the steps']
    : [
        chosenGuest.value ? `Thinking about ${chosenGuest.value.toLowerCase()}` : 'Reading your brief',
        chosenTone.value ? `Matching a ${chosenTone.value.toLowerCase()} tone` : 'Choosing a clear tone',
        mode.value === 'creative' ? 'Adding scenarios and best practices' : 'Sticking to your instructions',
        'Writing the steps',
      ]
  stageDone.value = 0
  step.value = 'generating'
  const fast = reducedMotion.value === 'reduce'
  for (let i = 0; i < stages.value.length; i++) {
    await wait(fast ? 0 : STAGE_MS)
    if (step.value !== 'generating')
      return // closed or restarted meanwhile
    if (from === 'conversations' && i === 0 && !found.length) {
      step.value = 'none'
      return
    }
    stageDone.value = i + 1
    if (from === 'conversations' && i === 0)
      stages.value = [`Found ${found.length} ${found.length === 1 ? 'conversation' : 'conversations'}`, ...stages.value.slice(1)]
  }
  const text = from === 'conversations'
    ? draftFromConversations(topic.value, found)
    : draftFromBrief(topic.value, { guest: chosenGuest.value, tone: chosenTone.value, cover: cover.value, mode: mode.value ?? 'strict' })
  await typeOut(text, fast)
}

/** The draft types itself out (about a second), then becomes editable. */
async function typeOut(text: string, fast: boolean) {
  step.value = 'review'
  if (fast) {
    draft.value = text
    return
  }
  typing.value = true
  draft.value = ''
  const chunk = Math.max(3, Math.ceil(text.length / 60))
  for (let i = 0; i < text.length; i += chunk) {
    if (step.value !== 'review')
      break
    draft.value = text.slice(0, i + chunk)
    await wait(16)
  }
  draft.value = text
  typing.value = false
}

const sourceCards = [
  {
    key: 'conversations',
    testid: 'sop-ai-from-conversations',
    icon: 'lucide:messages-square',
    title: 'Past conversations',
    description: 'ElevAI looks through this listing\'s guest conversations and writes the SOP from what guests asked.',
    cta: 'Generate now',
    go: () => generate('conversations'),
  },
  {
    key: 'brief',
    testid: 'sop-ai-from-brief',
    icon: 'lucide:list-checks',
    title: 'Answer a few questions',
    description: 'Typical guest, tone, what it should cover, and how creative ElevAI may be. Four short steps.',
    cta: 'Start',
    go: () => { step.value = 'brief'; briefStep.value = 1 },
  },
]

function apply() {
  emit('apply', draft.value.trim())
  emit('update:open', false)
}

function startOver() {
  step.value = 'source'
  briefStep.value = 1
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <SharedAiIcon custom-class="size-4" />
          Create SOP with AI
        </DialogTitle>
        <DialogDescription class="line-clamp-2">
          {{ title || 'Custom SOP' }}
        </DialogDescription>
      </DialogHeader>

      <!-- 1. Source: two cards -->
      <div v-if="step === 'source'" class="flex flex-col gap-3" data-testid="sop-ai-source">
        <p class="text-sm text-muted-foreground">
          What should ElevAI write it from?
        </p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            v-for="card in sourceCards"
            :key="card.key"
            type="button"
            class="group flex flex-col gap-3 rounded-xl border p-4 text-left transition-all hover:border-foreground/30 hover:bg-muted/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :data-testid="card.testid"
            @click="card.go()"
          >
            <span class="flex size-11 items-center justify-center rounded-lg border bg-muted/60 transition-colors group-hover:bg-background">
              <Icon :name="card.icon" class="size-5 text-foreground" />
            </span>
            <span class="flex flex-col gap-1">
              <span class="text-sm font-semibold">{{ card.title }}</span>
              <span class="text-xs leading-relaxed text-muted-foreground">{{ card.description }}</span>
            </span>
            <span class="mt-auto flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              {{ card.cta }}
              <Icon name="lucide:arrow-right" class="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      </div>

      <!-- 2b. Guided brief, one question per step -->
      <div v-else-if="step === 'brief'" class="flex flex-col gap-3" :data-testid="`sop-ai-brief-${briefStep}`">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-muted-foreground">Step {{ briefStep }} of {{ BRIEF_STEPS }}</span>
          <div class="flex flex-1 gap-1" aria-hidden="true">
            <span v-for="n in BRIEF_STEPS" :key="n" class="h-1 flex-1 rounded-full transition-colors" :class="n <= briefStep ? 'bg-foreground' : 'bg-muted'" />
          </div>
        </div>

        <!-- Step 1: typical guest / Step 2: tone (same option list, both optional) -->
        <template v-if="briefStep === 1 || briefStep === 2">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-sm font-medium">{{ briefStep === 1 ? 'Typical guest' : 'Tone' }}</span>
            <span class="text-xs text-muted-foreground">Optional</span>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" :aria-label="briefStep === 1 ? 'Typical guest' : 'Tone'">
            <div
              v-for="option in (briefStep === 1 ? TYPICAL_GUESTS : SOP_TONES)"
              :key="option"
              role="radio"
              tabindex="0"
              :aria-checked="optionValue === option"
              class="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
              :class="optionValue === option ? 'border-foreground/40 bg-muted/40 font-medium' : ''"
              @click="pickOption(option)"
              @keydown.space.prevent="pickOption(option)"
              @keydown.enter.prevent="pickOption(option)"
            >
              <span class="flex size-4 shrink-0 items-center justify-center rounded-full border" :class="optionValue === option ? 'border-foreground' : 'border-input'">
                <span v-if="optionValue === option" class="size-2 rounded-full bg-foreground" />
              </span>
              {{ option }}
            </div>
          </div>
          <Input
            v-if="briefStep === 1 && guest === 'Other'"
            v-model="guestOther"
            placeholder="Describe your typical guest"
            aria-label="Describe your typical guest"
          />
          <Input
            v-if="briefStep === 2 && tone === 'Other'"
            v-model="toneOther"
            placeholder="Describe the tone, e.g. playful and relaxed"
            aria-label="Describe the tone"
          />
        </template>

        <!-- Step 3: what it should cover -->
        <template v-else-if="briefStep === 3">
          <Label for="sop-ai-cover" class="text-sm font-medium">What should it cover?</Label>
          <Textarea id="sop-ai-cover" v-model="cover" rows="7" :placeholder="topic.questions[0]?.placeholder ?? 'Describe what the team should do'" />
          <div class="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2">
            <span class="text-xs font-medium text-muted-foreground">You might cover</span>
            <span v-for="q in topic.questions" :key="q.id" class="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Icon name="lucide:dot" class="size-4 shrink-0" />
              {{ q.label }}
            </span>
          </div>
        </template>

        <!-- Step 4: AI mode -->
        <template v-else>
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">AI mode</span>
            <span class="text-xs text-muted-foreground">Choose how creative the AI should be when writing your SOP</span>
          </div>
          <div class="flex flex-col gap-2" role="radiogroup" aria-label="AI mode">
            <div
              v-for="m in SOP_AI_MODES"
              :key="m.value"
              role="radio"
              tabindex="0"
              :aria-checked="mode === m.value"
              class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 transition-colors hover:bg-muted/50"
              :class="mode === m.value ? 'border-foreground/40 bg-muted/40' : ''"
              @click="mode = m.value"
              @keydown.space.prevent="mode = m.value"
              @keydown.enter.prevent="mode = m.value"
            >
              <span class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border" :class="mode === m.value ? 'border-foreground' : 'border-input'">
                <span v-if="mode === m.value" class="size-2 rounded-full bg-foreground" />
              </span>
              <span class="flex flex-col gap-0.5">
                <span class="text-sm font-medium">{{ m.label }}</span>
                <span class="text-xs text-muted-foreground">{{ m.description }}</span>
              </span>
            </div>
          </div>
        </template>
      </div>

      <!-- 3. Generating: staged progress -->
      <div v-else-if="step === 'generating'" class="flex flex-col items-center gap-5 py-6" aria-live="polite" data-testid="sop-ai-generating">
        <div class="relative flex size-14 items-center justify-center">
          <span class="absolute inset-0 animate-ping rounded-full bg-muted motion-reduce:animate-none" />
          <span class="relative flex size-14 items-center justify-center rounded-full border bg-background">
            <SharedAiIcon custom-class="size-7 animate-pulse motion-reduce:animate-none" />
          </span>
        </div>
        <Shimmer class="text-sm font-medium">
          ElevAI is writing your SOP
        </Shimmer>
        <ul class="flex w-full max-w-xs flex-col gap-2">
          <li
            v-for="(stage, i) in stages"
            :key="stage"
            class="flex items-center gap-2 text-sm transition-opacity"
            :class="i <= stageDone ? 'opacity-100' : 'opacity-40'"
          >
            <Icon v-if="i < stageDone" name="lucide:circle-check" class="size-4 shrink-0 text-green-600 dark:text-green-400" />
            <Icon v-else-if="i === stageDone" name="lucide:loader-circle" class="size-4 shrink-0 animate-spin text-muted-foreground" />
            <Icon v-else name="lucide:circle" class="size-4 shrink-0 text-muted-foreground" />
            {{ stage }}
          </li>
        </ul>
      </div>

      <!-- Past conversations found nothing -->
      <div v-else-if="step === 'none'" class="flex flex-col items-center gap-3 py-8 text-center" data-testid="sop-ai-none">
        <Icon name="lucide:message-circle-question" class="size-8 text-muted-foreground" />
        <div class="flex flex-col gap-1">
          <p class="text-sm font-medium">
            No past conversations found
          </p>
          <p class="max-w-sm text-xs text-muted-foreground">
            No guest on this listing has asked about this yet. Answer a few questions and ElevAI writes it from those instead.
          </p>
        </div>
        <Button size="sm" data-testid="sop-ai-none-brief" @click="step = 'brief'; briefStep = 1">
          Answer questions instead
        </Button>
      </div>

      <!-- 4. Review: the draft types itself out, then is editable -->
      <div v-else class="flex flex-col gap-2" data-testid="sop-ai-review">
        <Label for="sop-ai-draft">{{ typing ? 'Writing...' : 'Draft (edit before using it)' }}</Label>
        <Textarea id="sop-ai-draft" v-model="draft" rows="16" :readonly="typing" class="max-h-[55vh]" />
        <p v-if="currentText.trim() && !typing" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="lucide:info" class="size-3.5" />
          Using it replaces the current text.
        </p>
      </div>

      <DialogFooter class="gap-2">
        <!-- Brief -->
        <template v-if="step === 'brief'">
          <Button variant="ghost" @click="briefStep > 1 ? briefStep-- : (step = 'source')">
            <Icon name="lucide:arrow-left" class="size-4" />
            Back
          </Button>
          <Button v-if="briefStep < BRIEF_STEPS" :disabled="!canContinueBrief" data-testid="sop-ai-next" @click="briefStep++">
            {{ briefStep <= 2 && !optionValue ? 'Skip' : 'Next' }}
            <Icon name="lucide:arrow-right" class="size-4" />
          </Button>
          <Button v-else :disabled="!canContinueBrief" data-testid="sop-ai-generate" @click="generate('brief')">
            <SharedAiIcon custom-class="size-4" />
            Create SOP
          </Button>
        </template>
        <template v-else-if="step === 'none'">
          <Button variant="ghost" @click="startOver">
            <Icon name="lucide:arrow-left" class="size-4" />
            Back
          </Button>
        </template>
        <!-- Review -->
        <template v-else-if="step === 'review'">
          <Button variant="ghost" :disabled="typing" @click="startOver">
            Start over
          </Button>
          <Button :disabled="typing || !draft.trim()" data-testid="sop-ai-apply" @click="apply">
            Use this SOP
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
