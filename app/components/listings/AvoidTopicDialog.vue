<script setup lang="ts">
import type { AvoidTopic, AvoidTopicAction } from '~/components/listings/data/listing-avoid-topics'
import type { ReservationStage } from '~/components/listings/data/listings'
import { nextTick } from 'vue'
import { ALL_RESERVATION_STAGES, AVOID_TOPIC_ACTIONS, AVOID_TOPIC_TEMPLATES, avoidTopicActionReady, avoidTopicStages } from '~/components/listings/data/listing-avoid-topics'
import { RESERVATION_STAGES } from '~/components/listings/data/listings'

/**
 * Add or edit a topic to avoid in two steps: the topic (a template fills in
 * the name and description), then what ElevAI does when a guest raises it.
 */
const props = defineProps<{ open: boolean, topic?: AvoidTopic | null }>()
const emit = defineEmits<{ 'update:open': [open: boolean], 'save': [topic: AvoidTopic] }>()

const step = ref<1 | 2>(1)
const template = ref<string>()
const topicName = ref('')
const description = ref('')
const action = ref<AvoidTopicAction>()
const deferTo = ref('')
const contact = ref('')
const stages = ref<ReservationStage[]>([...ALL_RESERVATION_STAGES])

watch(() => props.open, (open) => {
  if (!open)
    return
  step.value = 1
  template.value = undefined
  topicName.value = props.topic?.topic ?? ''
  description.value = props.topic?.description ?? ''
  action.value = props.topic?.action
  deferTo.value = props.topic?.deferTo ?? ''
  contact.value = props.topic?.contact ?? ''
  stages.value = props.topic ? [...avoidTopicStages(props.topic)] : [...ALL_RESERVATION_STAGES]
}, { immediate: true })

const CUSTOM = '__custom__'
const topicInput = ref<{ $el?: HTMLElement } | null>(null)

function applyTemplate(name: unknown) {
  if (name === CUSTOM) {
    // A topic the host writes: start empty and put the cursor in the name.
    template.value = CUSTOM
    topicName.value = ''
    description.value = ''
    nextTick(() => {
      const el = topicInput.value?.$el
      ;(el instanceof HTMLInputElement ? el : el?.querySelector?.('input'))?.focus()
    })
    return
  }
  const picked = AVOID_TOPIC_TEMPLATES.find(t => t.topic === name)
  if (!picked)
    return
  template.value = picked.topic
  topicName.value = picked.topic
  description.value = picked.description
}

const canContinue = computed(() => !!topicName.value.trim())
function toggleStage(stage: ReservationStage) {
  stages.value = stages.value.includes(stage) ? stages.value.filter(s => s !== stage) : [...stages.value, stage]
}

const canSave = computed(() => avoidTopicActionReady(action.value, deferTo.value, contact.value) && stages.value.length > 0)

function save() {
  if (!canContinue.value || !canSave.value || !action.value)
    return
  emit('save', {
    id: props.topic?.id ?? `topic-${Date.now()}`,
    topic: topicName.value.trim(),
    description: description.value.trim(),
    action: action.value,
    stages: ALL_RESERVATION_STAGES.filter(s => stages.value.includes(s)),
    ...(action.value === 'defer_to' ? { deferTo: deferTo.value.trim() } : {}),
    ...(action.value === 'share_contact' ? { contact: contact.value.trim() } : {}),
  })
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ topic ? 'Edit topic to avoid' : 'Add topic to avoid' }}</DialogTitle>
        <DialogDescription>
          Step {{ step }} of 2: {{ step === 1 ? 'choose the topic' : 'choose what ElevAI does' }}
        </DialogDescription>
      </DialogHeader>

      <!-- Step 1: the topic -->
      <div v-if="step === 1" class="flex flex-col gap-4" data-testid="avoid-topic-step-1">
        <div class="flex flex-col gap-1.5">
          <Label for="avoid-topic-template">Topic type</Label>
          <Select :model-value="template" @update:model-value="applyTemplate">
            <SelectTrigger id="avoid-topic-template" class="w-full">
              <SelectValue placeholder="Choose a template or a custom topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in AVOID_TOPIC_TEMPLATES" :key="t.topic" :value="t.topic">
                {{ t.topic }}
              </SelectItem>
              <SelectSeparator />
              <SelectItem :value="CUSTOM">
                <Icon name="lucide:plus" class="size-4" />
                Custom topic
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            A template fills in the topic and description. Pick Custom topic to write your own.
          </p>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="avoid-topic-name">Topic</Label>
          <Input id="avoid-topic-name" ref="topicInput" v-model="topicName" placeholder="e.g. Competitor pricing" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="avoid-topic-description">Description</Label>
          <Textarea id="avoid-topic-description" v-model="description" rows="3" placeholder="When does this topic come up?" />
        </div>
      </div>

      <!-- Step 2: what ElevAI does -->
      <div v-else class="flex flex-col gap-2" data-testid="avoid-topic-step-2">
        <p class="text-sm">
          When a guest asks about <span class="font-medium">{{ topicName }}</span>:
        </p>
        <div class="flex flex-col gap-2" role="radiogroup" aria-label="What ElevAI does">
          <div
            v-for="a in AVOID_TOPIC_ACTIONS"
            :key="a.value"
            role="radio"
            tabindex="0"
            :aria-checked="action === a.value"
            class="flex cursor-pointer flex-col gap-2 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50"
            :class="action === a.value ? 'border-foreground/40 bg-muted/40' : ''"
            @click="action = a.value"
            @keydown.space.prevent="action = a.value"
            @keydown.enter.prevent="action = a.value"
          >
            <div class="flex items-start gap-3">
              <!-- Neutral radio, not the tenant primary: yellow on white is unreadable. -->
              <span
                class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border"
                :class="action === a.value ? 'border-foreground' : 'border-input'"
              >
                <span v-if="action === a.value" class="size-2 rounded-full bg-foreground" />
              </span>
              <Icon :name="a.icon" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="flex items-center gap-2 text-sm font-medium">
                  {{ a.label }}
                  <Badge v-if="a.badge" variant="secondary" class="text-[10px] font-normal">{{ a.badge }}</Badge>
                </span>
                <span class="text-xs text-muted-foreground">{{ a.description }}</span>
              </div>
            </div>
            <div v-if="action === a.value && a.value === 'defer_to'" class="pl-14" @click.stop>
              <Input v-model="deferTo" placeholder="e.g. Wayan, the villa manager" aria-label="Who ElevAI checks with" class="h-8" />
            </div>
            <div v-if="action === a.value && a.value === 'share_contact'" class="pl-14" @click.stop>
              <Input v-model="contact" placeholder="Phone, email or WhatsApp to share" aria-label="Contact details to share" class="h-8" />
            </div>
          </div>
        </div>

        <div class="mt-3 flex flex-col gap-2 border-t pt-4" data-testid="avoid-topic-stages">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">Reservation stages</span>
            <span class="text-xs text-muted-foreground">Which guests ElevAI handles this way. Other stages get a normal answer.</span>
          </div>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Reservation stages">
            <div
              v-for="stage in RESERVATION_STAGES"
              :key="stage.value"
              role="checkbox"
              tabindex="0"
              :aria-checked="stages.includes(stage.value)"
              class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted/50"
              :class="stages.includes(stage.value) ? 'border-foreground/40 bg-muted/40' : 'text-muted-foreground'"
              @click="toggleStage(stage.value)"
              @keydown.space.prevent="toggleStage(stage.value)"
              @keydown.enter.prevent="toggleStage(stage.value)"
            >
              <span
                class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="stages.includes(stage.value) ? 'border-foreground bg-foreground text-background' : 'border-input'"
              >
                <Icon v-if="stages.includes(stage.value)" name="lucide:check" class="size-3" />
              </span>
              {{ stage.label }}
            </div>
          </div>
          <p v-if="!stages.length" class="text-xs text-destructive">
            Pick at least one stage.
          </p>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <template v-if="step === 1">
          <Button variant="ghost" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button :disabled="!canContinue" @click="step = 2">
            Next
            <Icon name="lucide:arrow-right" class="size-4" />
          </Button>
        </template>
        <template v-else>
          <Button variant="ghost" @click="step = 1">
            <Icon name="lucide:arrow-left" class="size-4" />
            Back
          </Button>
          <Button :disabled="!canSave" @click="save">
            Save topic
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
