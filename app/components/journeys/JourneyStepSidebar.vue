<script setup lang="ts">
import type {
  ActionStep,
  ConditionCombinator,
  ConditionRule,
  ConditionType,
  ContextCheckStep,
  CreateNoteStep,
  HardRequirementStep,
  IfElseStep,
  IntegrationStep,
  JourneyStep,
  MessageStep,
  ToggleAIStep,
  TriggerEntry,
  TriggerSettings,
  TriggerStep,
  TriggerType,
  WaitStep,
} from './data/journeys'
import SendEmailAction from './actions/SendEmailAction.vue'
import SendGuestGuideAction from './actions/SendGuestGuideAction.vue'
import { conditionMeta, defaultTriggerSettings, primaryConditionTypes, triggerMeta } from './data/journeys'

const props = defineProps<{
  step: JourneyStep | null
  journeyName: string
}>()

const emit = defineEmits<{
  update: [step: JourneyStep]
}>()

function patch(fields: Partial<JourneyStep>) {
  if (!props.step)
    return
  emit('update', { ...props.step, ...fields } as JourneyStep)
}

// Modal state for condition configuration
const conditionModalOpen = ref(false)
const conditionModalTitle = ref('Configure Condition')
const conditionModalRules = ref<ConditionRule[]>([])
const conditionModalCombinator = ref<ConditionCombinator>('and')
const conditionModalTarget = ref<'hardReq' | 'ifElse' | 'wait' | 'branchTrue' | 'branchFalse' | null>(null)

function openConditionModal(target: 'hardReq' | 'ifElse') {
  conditionModalTarget.value = target
  if (target === 'hardReq' && hardReqStep.value) {
    conditionModalTitle.value = 'Hard Requirement'
    conditionModalRules.value = hardReqStep.value.rules?.length ? JSON.parse(JSON.stringify(hardReqStep.value.rules)) : []
    conditionModalCombinator.value = hardReqStep.value.combinator ?? 'and'
  }
  else if (target === 'ifElse' && ifElseStep.value) {
    conditionModalTitle.value = 'If/Else Condition'
    conditionModalRules.value = ifElseStep.value.rules?.length ? JSON.parse(JSON.stringify(ifElseStep.value.rules)) : []
    conditionModalCombinator.value = ifElseStep.value.combinator ?? 'and'
  }
  conditionModalOpen.value = true
}

function openWaitConditionModal() {
  conditionModalTarget.value = 'wait'
  conditionModalTitle.value = 'Wait Condition'
  conditionModalRules.value = waitStep.value?.rules?.length ? JSON.parse(JSON.stringify(waitStep.value.rules)) : []
  conditionModalCombinator.value = waitStep.value?.combinator ?? 'and'
  conditionModalOpen.value = true
}

function openBranchConditionModal(branch: 'true' | 'false') {
  conditionModalTarget.value = branch === 'true' ? 'branchTrue' : 'branchFalse'
  conditionModalTitle.value = 'Branch Requirement'
  const configKey = branch === 'true' ? 'trueBranchStep' : 'falseBranchStep'
  const step = (ifElseStep.value as any)?.[configKey]
  conditionModalRules.value = step?.rules?.length ? JSON.parse(JSON.stringify(step.rules)) : []
  conditionModalCombinator.value = step?.combinator ?? 'and'
  conditionModalOpen.value = true
}

function handleConditionSave(rules: ConditionRule[], combinator: ConditionCombinator) {
  if (conditionModalTarget.value === 'hardReq' && hardReqStep.value) {
    patch({ rules, combinator } as Partial<HardRequirementStep>)
  }
  else if (conditionModalTarget.value === 'ifElse' && ifElseStep.value) {
    patch({ rules, combinator } as Partial<IfElseStep>)
  }
  else if (conditionModalTarget.value === 'wait' && waitStep.value) {
    patch({ rules, combinator } as Partial<WaitStep>)
  }
  else if (conditionModalTarget.value === 'branchTrue' || conditionModalTarget.value === 'branchFalse') {
    const branch = conditionModalTarget.value === 'branchTrue' ? 'true' : 'false'
    patchBranchConfig(branch, { rules, combinator })
  }
  conditionModalOpen.value = false
}

const triggerStep = computed(() => props.step?.type === 'trigger' ? props.step as TriggerStep : null)
const waitStep = computed(() => props.step?.type === 'wait' ? props.step as WaitStep : null)
const messageStep = computed(() => props.step?.type === 'message' ? props.step as MessageStep : null)

const { approvedTemplates, getTemplateById } = useWhatsAppTemplates()
const selectedWhatsAppTemplate = computed(() => {
  if (!messageStep.value?.whatsappTemplateId)
    return null
  return getTemplateById(messageStep.value.whatsappTemplateId)
})

// WhatsApp only supports Template mode — lock the mode and clear
// AI Personalization (irrelevant for approved template messages).
watch(
  () => (messageStep.value as any)?.channel,
  (channel) => {
    if (channel === 'whatsapp' && messageStep.value && messageStep.value.messageMode !== 'template') {
      patch({ messageMode: 'template', aiPersonalization: false } as any)
    }
  },
)

const contextStep = computed(() => props.step?.type === 'context_check' ? props.step as ContextCheckStep : null)
const actionStep = computed(() => props.step?.type === 'action' ? props.step as ActionStep : null)
const ifElseStep = computed(() => props.step?.type === 'if_else' ? props.step as IfElseStep : null)
const hardReqStep = computed(() => props.step?.type === 'hard_requirement' ? props.step as HardRequirementStep : null)
const noteStep = computed(() => props.step?.type === 'create_note' ? props.step as CreateNoteStep : null)
const toggleAIStep = computed(() => props.step?.type === 'toggle_ai' ? props.step as ToggleAIStep : null)
const integrationStep = computed(() => props.step?.type === 'integration' ? props.step as IntegrationStep : null)
const isEndJourney = computed(() => props.step?.type === 'end_journey')

const conditionTypes = primaryConditionTypes.map(value => ({ value, label: conditionMeta[value] }))

const allTriggerOptions = Object.entries(triggerMeta).map(([value, meta]) => ({ value: value as TriggerType, label: meta.label, category: meta.category }))
const conversationTriggers = computed(() => allTriggerOptions.filter(t => t.category === 'conversation'))
const reservationTriggers = computed(() => allTriggerOptions.filter(t => t.category === 'reservation'))
const calendarTriggers = computed(() => allTriggerOptions.filter(t => t.category === 'calendar'))
const { isConnected: minutConnected } = useMinut()
const { isConnected: emailConnected } = useEmailIntegration()

const triggerEntries = computed(() => (triggerStep.value?.triggers ?? []) as TriggerEntry[])

const branchActionOptions: { value: string, icon: string, label: string, group: string }[] = [
  { value: 'wait', icon: 'i-lucide-clock', label: 'Wait', group: 'Flow' },
  { value: 'message', icon: 'i-lucide-message-square', label: 'Send a Message', group: 'Flow' },
  { value: 'hard_requirement', icon: 'i-lucide-shield', label: 'Hard Requirement', group: 'Logic' },
  { value: 'action', icon: 'i-lucide-bolt', label: 'Create Action Item', group: 'Actions' },
  { value: 'create_note', icon: 'i-lucide-file-pen-line', label: 'Create Reservation Note', group: 'Actions' },
  { value: 'toggle_ai_pause', icon: 'i-lucide-pause', label: 'Pause Auto-responses', group: 'Actions' },
  { value: 'toggle_ai_start', icon: 'i-lucide-play', label: 'Start Auto-responses', group: 'Actions' },
]

const branchActionGroups = computed(() => {
  const groups: Record<string, typeof branchActionOptions> = {}
  for (const opt of branchActionOptions) {
    if (!groups[opt.group])
      groups[opt.group] = []
    groups[opt.group].push(opt)
  }
  return groups
})

const branchActionLabels: Record<string, string> = {}
branchActionOptions.forEach(o => branchActionLabels[o.value] = o.label)

function defaultBranchConfig(action: string): Record<string, any> {
  if (action === 'wait')
    return { type: 'wait', waitMode: 'time_delay' as const, durationDays: 0, durationHours: 0, durationMinutes: 0 }
  if (action === 'message')
    return { type: 'message', messageMode: 'directive' as const, channel: 'ota' as const, templateText: '', directive: '', contextCheckEnabled: false, contextCheckInstruction: '', fallback: 'skip' as const, fallbackText: '', whatsappTemplateId: '' }
  if (action === 'action')
    return { type: 'action', actionType: 'raise_action_item' as const, details: '' }
  if (action === 'create_note')
    return { type: 'create_note', noteContent: '', visibleToAI: true }
  if (action === 'toggle_ai_pause')
    return { type: 'toggle_ai', enable: false, duration: 'indefinite' as const, days: 0, hours: 0, minutes: 0 }
  if (action === 'toggle_ai_start')
    return { type: 'toggle_ai', enable: true, duration: 'indefinite' as const, days: 0, hours: 0, minutes: 0 }
  if (action === 'integration')
    return { type: 'integration', integrationName: '', payload: '' }
  if (action === 'hard_requirement')
    return { type: 'hard_requirement', rules: [], combinator: 'and' as const }
  return {}
}

function selectBranchAction(branch: 'true' | 'false', action: string | undefined) {
  const configKey = branch === 'true' ? 'trueBranchStep' : 'falseBranchStep'
  if (!action) {
    patch({ [configKey]: undefined } as any)
    return
  }
  const config = defaultBranchConfig(action)
  patch({ [configKey]: config } as any)
  branchDialogTarget.value = branch
  branchDialogOpen.value = true
}

function patchBranchConfig(branch: 'true' | 'false', fields: Record<string, any>) {
  const configKey = branch === 'true' ? 'trueBranchStep' : 'falseBranchStep'
  const current = (ifElseStep.value as any)?.[configKey] ?? {}
  patch({ [configKey]: { ...current, ...fields } } as any)
}

function branchStepType(config: Record<string, any> | undefined): string | null {
  if (!config)
    return null
  if (config.type === 'toggle_ai')
    return config.enable === false ? 'toggle_ai_pause' : 'toggle_ai_start'
  return config.type ?? null
}

const trueBranchType = computed(() => branchStepType((ifElseStep.value as any)?.trueBranchStep))
const falseBranchType = computed(() => branchStepType((ifElseStep.value as any)?.falseBranchStep))

const trueBranchActionLabel = computed(() => {
  const t = trueBranchType.value
  return t ? (branchActionLabels[t] ?? 'None') : 'None'
})
const falseBranchActionLabel = computed(() => {
  const t = falseBranchType.value
  return t ? (branchActionLabels[t] ?? 'None') : 'None'
})

function branchStepSummary(step: Record<string, any> | undefined): string | null {
  if (!step || !step.type)
    return null
  const t = step.type === 'toggle_ai' ? (step.enable === false ? 'toggle_ai_pause' : 'toggle_ai_start') : step.type
  const label = branchActionLabels[t] ?? t
  if (step.type === 'wait') {
    const parts = []
    if (step.durationDays)
      parts.push(`${step.durationDays}d`)
    if (step.durationHours)
      parts.push(`${step.durationHours}h`)
    if (step.durationMinutes)
      parts.push(`${step.durationMinutes}m`)
    return `${label}: ${parts.length ? parts.join(' ') : 'no duration'}`
  }
  if (step.type === 'message') {
    const ch: Record<string, string> = { ota: 'OTA', whatsapp: 'WhatsApp', email: 'Email' }
    const base = `${label}: ${step.messageMode === 'template' ? 'Template' : 'AI Directive'} · ${ch[step.channel] ?? step.channel}`
    if (step.channel === 'whatsapp' && step.whatsappTemplateId) {
      const tmpl = getTemplateById(step.whatsappTemplateId)
      return `${base} · ${tmpl?.name ?? 'unknown'}`
    }
    return base
  }
  if (step.type === 'action') {
    const at: Record<string, string> = { raise_action_item: 'Raise Action Item', create_task: 'Create Task', flag_reservation: 'Flag Reservation', staff_alert: 'Staff Alert' }
    return `${label}: ${at[step.actionType] ?? step.actionType}`
  }
  if (step.type === 'create_note') {
    const txt = step.noteContent ?? ''
    return `${label}: ${txt.length > 40 ? `${txt.slice(0, 40)}…` : txt || 'empty'}`
  }
  if (step.type === 'toggle_ai') {
    return `${label}: ${step.duration === 'indefinite' ? 'Indefinite' : `${step.days ?? 0}d ${step.hours ?? 0}h ${step.minutes ?? 0}m`}`
  }
  if (step.type === 'integration') {
    return `${label}: ${step.integrationName || 'not set'}`
  }
  if (step.type === 'hard_requirement') {
    const count = step.rules?.length ?? 0
    return `${label}: ${count} rule${count !== 1 ? 's' : ''}`
  }
  return label
}

const trueBranchSummary = computed(() => branchStepSummary((ifElseStep.value as any)?.trueBranchStep))
const falseBranchSummary = computed(() => branchStepSummary((ifElseStep.value as any)?.falseBranchStep))

const branchDialogOpen = ref(false)
const branchDialogTarget = ref<'true' | 'false' | null>(null)
const branchDialogType = computed(() => branchDialogTarget.value === 'true' ? trueBranchType.value : falseBranchType.value)
const branchDialogLabel = computed(() => {
  const t = branchDialogType.value
  return t ? (branchActionLabels[t] ?? t) : ''
})

function openBranchDialog(branch: 'true' | 'false') {
  branchDialogTarget.value = branch
  branchDialogOpen.value = true
}

function deleteBranchAction() {
  if (!branchDialogTarget.value)
    return
  selectBranchAction(branchDialogTarget.value, undefined)
  branchDialogOpen.value = false
}

const activeBranchStep = computed(() => {
  if (!branchDialogTarget.value)
    return {}
  const key = branchDialogTarget.value === 'true' ? 'trueBranchStep' : 'falseBranchStep'
  return (ifElseStep.value as any)?.[key] ?? {}
})

function patchActiveBranch(fields: Record<string, any>) {
  if (!branchDialogTarget.value)
    return
  patchBranchConfig(branchDialogTarget.value, fields)
}

const usedTriggerTypes = computed(() => new Set(triggerEntries.value.map(e => e.type)))
const availableTriggers = computed(() => allTriggerOptions.filter(t => !usedTriggerTypes.value.has(t.value)))

function patchTriggers(entries: TriggerEntry[]) {
  patch({ triggers: entries } as any)
}

function setTriggerType(index: number, type: TriggerType) {
  const entries = [...triggerEntries.value]
  entries[index] = { type, settings: defaultTriggerSettings(type) }
  patchTriggers(entries)
}

function patchTriggerSettings(index: number, settings: Partial<TriggerSettings>) {
  const entries = [...triggerEntries.value]
  const target = entries[index]
  if (!target)
    return
  entries[index] = { ...target, settings: { ...target.settings, ...settings } }
  patchTriggers(entries)
}

function addTrigger(type: TriggerType) {
  patchTriggers([...triggerEntries.value, { type, settings: defaultTriggerSettings(type) }])
  showAltTriggerPicker.value = false
}

function removeTrigger(index: number) {
  patchTriggers(triggerEntries.value.filter((_, i) => i !== index))
}

function toggleSentiment(index: number, s: 'positive' | 'neutral' | 'negative') {
  const current = [...(triggerEntries.value[index]?.settings.targetSentiments ?? [])]
  const idx = current.indexOf(s)
  if (idx === -1)
    current.push(s)
  else current.splice(idx, 1)
  patchTriggerSettings(index, { targetSentiments: current })
}

function triggerSettingsType(type: TriggerType) {
  // Conversation-Based
  if (type === 'conversation_content')
    return 'keywords'
  if (type === 'sentiment_change')
    return 'sentiment'
  // Reservation Events with immediate checkbox + delay
  if (['inquiry_received', 'new_message_received', 'new_booking', 'guest_checkout', 'booking_cancelled', 'minut_event', 'email_received'].includes(type))
    return 'immediate_delay'
  // Check-in / Check-out: before/on/after toggle + delay + optional time
  if (type === 'checkin' || type === 'checkout')
    return 'before_after'
  // Calendar-Based
  if (type === 'send_once')
    return 'send_once'
  if (type === 'gap_nights')
    return 'gap_nights'
  if (type === 'daily')
    return 'daily'
  if (type === 'weekly')
    return 'weekly'
  if (type === 'monthly')
    return 'monthly'
  if (type === 'yearly')
    return 'yearly'
  return 'none'
}

const showAltTriggerPicker = ref(false)
</script>

<template>
  <div class="flex flex-col h-full">
    <div v-if="!step" class="flex flex-1 items-center justify-center">
      <div class="text-center text-muted-foreground">
        <Icon name="i-lucide-mouse-pointer-click" class="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p class="text-sm">
          Select a step to configure it
        </p>
      </div>
    </div>

    <template v-else>
      <div class="mb-4 border-b pb-4">
        <p class="text-sm font-semibold">
          {{ step.name }}
        </p>
      </div>

      <!-- Trigger -->
      <div v-if="triggerStep" class="flex flex-col gap-3">
        <div>
          <Label>Triggers</Label>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Journey fires when ANY of these events occur.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <template v-for="(entry, i) in triggerEntries" :key="i">
            <!-- OR divider (not before first) -->
            <div v-if="i > 0" class="flex items-center gap-2 px-1">
              <div class="h-px flex-1 bg-border" />
              <span class="text-[10px] font-semibold text-muted-foreground">OR</span>
              <div class="h-px flex-1 bg-border" />
            </div>

            <!-- Trigger entry card -->
            <div class="rounded-md border bg-card p-3">
              <!-- Header: type select + badge/remove -->
              <div class="flex items-center gap-2">
                <Icon name="i-lucide-zap" class="h-3.5 w-3.5 shrink-0 text-purple-500" />
                <Select :model-value="entry.type" @update:model-value="setTriggerType(i, $event as TriggerType)">
                  <SelectTrigger class="h-auto flex-1 border-0 p-0 shadow-none focus:ring-0 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Conversation-Based</SelectLabel>
                      <SelectItem v-for="t in conversationTriggers" :key="t.value" :value="t.value">
                        {{ t.label }}
                      </SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Reservation Events</SelectLabel>
                      <SelectItem v-for="t in reservationTriggers" :key="t.value" :value="t.value">
                        {{ t.label }}
                      </SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Calendar-Based</SelectLabel>
                      <SelectItem v-for="t in calendarTriggers" :key="t.value" :value="t.value">
                        {{ t.label }}
                      </SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Integration Events</SelectLabel>
                      <!-- Minut (direct trigger) -->
                      <SelectItem
                        value="minut_event"
                        :disabled="!minutConnected"
                      >
                        <div class="flex w-full items-center justify-between">
                          <span class="flex items-center gap-2">
                            <Icon name="i-lucide-audio-waveform" class="h-3.5 w-3.5" />
                            Minut Sensor Event
                          </span>
                          <span
                            class="inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[9px] font-medium"
                            :class="minutConnected ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'"
                          >
                            <span class="h-1 w-1 rounded-full" :class="minutConnected ? 'bg-green-500' : 'bg-muted-foreground/50'" />
                            {{ minutConnected ? 'Connected' : 'Not connected' }}
                          </span>
                        </div>
                      </SelectItem>
                      <!-- Email Received (direct trigger, gated by email connection) -->
                      <SelectItem
                        value="email_received"
                        :disabled="!emailConnected"
                      >
                        <div class="flex w-full items-center justify-between">
                          <span class="flex items-center gap-2">
                            <Icon name="i-lucide-mail" class="h-3.5 w-3.5" />
                            Email Received
                          </span>
                          <span
                            class="inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[9px] font-medium"
                            :class="emailConnected ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'"
                          >
                            <span class="h-1 w-1 rounded-full" :class="emailConnected ? 'bg-green-500' : 'bg-muted-foreground/50'" />
                            {{ emailConnected ? 'Connected' : 'Not connected' }}
                          </span>
                        </div>
                      </SelectItem>
                      <!-- Turno (placeholder, not connected) -->
                      <SelectItem value="__placeholder_turno__" :disabled="true">
                        <div class="flex w-full items-center justify-between">
                          <span class="flex items-center gap-2 text-muted-foreground">
                            <Icon name="i-lucide-calendar-clock" class="h-3.5 w-3.5" />
                            Turno
                          </span>
                          <span class="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0 text-[9px] font-medium text-muted-foreground">
                            <span class="h-1 w-1 rounded-full bg-muted-foreground/50" />
                            Not connected
                          </span>
                        </div>
                      </SelectItem>
                      <!-- Tidy (placeholder, not connected) -->
                      <SelectItem value="__placeholder_tidy__" :disabled="true">
                        <div class="flex w-full items-center justify-between">
                          <span class="flex items-center gap-2 text-muted-foreground">
                            <Icon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
                            Tidy
                          </span>
                          <span class="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0 text-[9px] font-medium text-muted-foreground">
                            <span class="h-1 w-1 rounded-full bg-muted-foreground/50" />
                            Not connected
                          </span>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Badge v-if="i === 0" variant="secondary" class="text-[10px] shrink-0">
                  Primary
                </Badge>
                <Button
                  v-else
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove trigger"
                  @click="removeTrigger(i)"
                >
                  <Icon name="i-lucide-x" class="h-3.5 w-3.5" />
                </Button>
              </div>

              <!-- Settings: conversational trigger -->
              <div v-if="triggerSettingsType(entry.type) === 'keywords'" class="mt-3 flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">Conversational Trigger</Label>
                <Textarea
                  :model-value="entry.settings.keywords ?? ''"
                  class="mt-1 min-h-[80px] text-xs"
                  placeholder="e.g. I'm interested in early check-in, Tell me about parking…"
                  @update:model-value="patchTriggerSettings(i, { keywords: $event as string })"
                />
                <p class="text-xs text-muted-foreground">
                  AI will analyze guest messages to detect matching intent
                </p>
              </div>

              <!-- Settings: sentiment trigger -->
              <div v-else-if="triggerSettingsType(entry.type) === 'sentiment'" class="mt-3 flex flex-col gap-3">
                <div>
                  <Label class="text-xs text-muted-foreground mb-2 block">Sentiment Trigger</Label>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      v-for="s in (['positive', 'neutral', 'negative'] as const)"
                      :key="s"
                      class="rounded-lg border py-2.5 text-sm font-medium transition-colors" :class="[
                        entry.settings.targetSentiments?.includes(s)
                          ? s === 'positive' ? 'bg-green-500 border-green-500 text-white'
                            : s === 'neutral' ? 'bg-amber-500 border-amber-500 text-white'
                              : 'bg-red-500 border-red-500 text-white'
                          : 'border-input text-muted-foreground hover:bg-muted',
                      ]"
                      @click="toggleSentiment(i, s)"
                    >
                      {{ s.charAt(0).toUpperCase() + s.slice(1) }}
                    </button>
                  </div>
                </div>

                <Separator />

                <div
                  class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/40"
                  @click="patchTriggerSettings(i, { triggerImmediately: !entry.settings.triggerImmediately })"
                >
                  <div
                    class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border" :class="[
                      entry.settings.triggerImmediately ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    ]"
                  >
                    <Icon v-if="entry.settings.triggerImmediately" name="i-lucide-check" class="h-3 w-3" />
                  </div>
                  <div>
                    <p class="text-sm font-medium leading-none">
                      Trigger immediately
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      Start journey as soon as sentiment is detected
                    </p>
                  </div>
                </div>

                <template v-if="!entry.settings.triggerImmediately">
                  <div>
                    <Label class="text-xs text-muted-foreground">Delay after sentiment detected</Label>
                    <div class="mt-2 grid grid-cols-3 gap-2">
                      <div v-for="unit in [{ key: 'delayDays', label: 'Days' }, { key: 'delayHours', label: 'Hours' }, { key: 'delayMinutes', label: 'Minutes' }]" :key="unit.key">
                        <p class="mb-1 text-center text-xs text-muted-foreground">
                          {{ unit.label }}
                        </p>
                        <Input type="number" :model-value="(entry.settings as any)[unit.key] ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patchTriggerSettings(i, { [unit.key]: Number($event) })" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label class="text-xs text-muted-foreground">Trigger at specific time</Label>
                    <Input type="time" :model-value="entry.settings.specificTime ?? ''" class="h-9 text-sm" @update:model-value="patchTriggerSettings(i, { specificTime: $event as string })" />
                  </div>
                </template>
              </div>

              <!-- Settings: send once -->
              <div v-else-if="triggerSettingsType(entry.type) === 'send_once'" class="mt-3 flex flex-col gap-3">
                <label
                  class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/40"
                  @click="patchTriggerSettings(i, { sendImmediately: !entry.settings.sendImmediately })"
                >
                  <div
                    class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                    :class="entry.settings.sendImmediately ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  >
                    <Icon v-if="entry.settings.sendImmediately" name="i-lucide-check" class="h-3 w-3" />
                  </div>
                  <div>
                    <p class="text-sm font-medium leading-none">Send Immediately</p>
                    <p class="mt-1 text-xs text-muted-foreground">Send right away without scheduling</p>
                  </div>
                </label>
                <template v-if="!entry.settings.sendImmediately">
                  <Input
                    type="date"
                    :model-value="entry.settings.scheduleDate ?? ''"
                    class="h-8 text-sm"
                    @update:model-value="patchTriggerSettings(i, { scheduleDate: $event as string })"
                  />
                  <div class="flex items-center gap-2">
                    <Label class="text-xs text-muted-foreground shrink-0">at</Label>
                    <Input
                      type="time"
                      :model-value="entry.settings.scheduleTime ?? '09:00'"
                      class="h-8 flex-1 text-sm"
                      @update:model-value="patchTriggerSettings(i, { scheduleTime: $event as string })"
                    />
                  </div>
                </template>
              </div>

              <!-- Settings: gap nights -->
              <div v-else-if="triggerSettingsType(entry.type) === 'gap_nights'" class="mt-3 flex flex-col gap-3">
                <Label class="text-xs text-muted-foreground">Number of Nights to Consider</Label>
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground shrink-0">Min</Label>
                  <Input type="number" :model-value="entry.settings.gapMinNights ?? 1" min="1" class="h-8 w-16 text-sm" @update:model-value="patchTriggerSettings(i, { gapMinNights: Number($event) })" />
                  <Label class="text-xs text-muted-foreground shrink-0">Max</Label>
                  <Input type="number" :model-value="entry.settings.gapMaxNights ?? undefined" min="1" class="h-8 w-16 text-sm" placeholder="∞" @update:model-value="patchTriggerSettings(i, { gapMaxNights: Number($event) || undefined })" />
                </div>
                <Label class="text-xs text-muted-foreground">Gap Location</Label>
                <div class="flex items-center gap-2">
                  <button
                    class="h-8 flex-1 rounded-md border text-sm font-medium transition-colors"
                    :class="entry.settings.gapLocation === 'before_reservation' ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-muted'"
                    @click="patchTriggerSettings(i, { gapLocation: 'before_reservation' })"
                  >
                    Before Reservation
                  </button>
                  <button
                    class="h-8 flex-1 rounded-md border text-sm font-medium transition-colors"
                    :class="entry.settings.gapLocation === 'after_reservation' ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-muted'"
                    @click="patchTriggerSettings(i, { gapLocation: 'after_reservation' })"
                  >
                    After Reservation
                  </button>
                </div>
                <div>
                  <Label class="text-xs text-muted-foreground">Trigger After Gap Night Opens</Label>
                  <div class="mt-2 grid grid-cols-3 gap-2">
                    <div v-for="unit in [{ key: 'delayDays', label: 'Days' }, { key: 'delayHours', label: 'Hours' }, { key: 'delayMinutes', label: 'Minutes' }]" :key="unit.key">
                      <p class="mb-1 text-center text-xs text-muted-foreground">
                        {{ unit.label }}
                      </p>
                      <Input type="number" :model-value="(entry.settings as any)[unit.key] ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patchTriggerSettings(i, { [unit.key]: Number($event) })" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label class="text-xs text-muted-foreground">At specific time (optional)</Label>
                  <Input type="time" :model-value="entry.settings.specificTime ?? ''" class="h-9 text-sm" @update:model-value="patchTriggerSettings(i, { specificTime: $event as string })" />
                </div>
              </div>

              <!-- Settings: immediate_delay (inquiry, host_message, new_booking, guest_checkout, cancellation, minut_event) -->
              <div v-else-if="triggerSettingsType(entry.type) === 'immediate_delay'" class="mt-3 flex flex-col gap-3">
                <label class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/40" @click="patchTriggerSettings(i, { triggerImmediately: !entry.settings.triggerImmediately })">
                  <div class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border" :class="entry.settings.triggerImmediately ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                    <Icon v-if="entry.settings.triggerImmediately" name="i-lucide-check" class="h-3 w-3" />
                  </div>
                  <div>
                    <p class="text-sm font-medium leading-none">
                      {{ entry.type === 'inquiry_received' ? 'Trigger at inquiry'
                        : entry.type === 'new_message_received' ? 'Trigger when host sends message'
                          : entry.type === 'new_booking' ? 'Trigger at booking'
                            : entry.type === 'guest_checkout' ? 'Trigger at guest check-out'
                              : entry.type === 'minut_event' ? 'Trigger on Minut sensor event'
                                : entry.type === 'email_received' ? 'Trigger on email received'
                                  : 'Trigger at cancellation' }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ entry.type === 'inquiry_received' ? 'Trigger as soon as the inquiry is received, with no delay'
                        : entry.type === 'new_message_received' ? 'Trigger as soon as the host sends a message, with no delay'
                          : entry.type === 'new_booking' ? 'Trigger as soon as the booking is confirmed, with no delay'
                            : entry.type === 'guest_checkout' ? 'Trigger as soon as the guest marks themselves as checked-out, with no delay'
                              : entry.type === 'minut_event' ? 'Trigger as soon as a Minut sensor event is detected, with no delay'
                                : entry.type === 'email_received' ? 'Trigger as soon as a guest email is received, with no delay'
                                  : 'Trigger as soon as the cancellation occurs, with no delay' }}
                    </p>
                  </div>
                </label>
                <template v-if="!entry.settings.triggerImmediately">
                  <div>
                    <Label class="text-xs text-muted-foreground">
                      {{ entry.type === 'inquiry_received' ? 'Trigger after inquiry'
                        : entry.type === 'new_message_received' ? 'Trigger after host sends message'
                          : entry.type === 'new_booking' ? 'Trigger after booking'
                            : entry.type === 'guest_checkout' ? 'Trigger after guest check-out'
                              : entry.type === 'minut_event' ? 'Trigger after Minut sensor event'
                                : entry.type === 'email_received' ? 'Trigger after email received'
                                  : 'Trigger after cancellation' }}
                    </Label>
                    <div class="mt-2 grid grid-cols-3 gap-2">
                      <div v-for="unit in [{ key: 'delayDays', label: 'Days' }, { key: 'delayHours', label: 'Hours' }, { key: 'delayMinutes', label: 'Minutes' }]" :key="unit.key">
                        <p class="mb-1 text-center text-xs text-muted-foreground">
                          {{ unit.label }}
                        </p>
                        <Input type="number" :model-value="(entry.settings as any)[unit.key] ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patchTriggerSettings(i, { [unit.key]: Number($event) })" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label class="text-xs text-muted-foreground">Trigger at specific time</Label>
                    <Input type="time" :model-value="entry.settings.specificTime ?? ''" class="h-9 text-sm" @update:model-value="patchTriggerSettings(i, { specificTime: $event as string })" />
                  </div>
                </template>
              </div>

              <!-- Settings: before_after (check-in day / check-out day) -->
              <div v-else-if="triggerSettingsType(entry.type) === 'before_after'" class="mt-3 flex flex-col gap-3">
                <Label class="text-xs text-muted-foreground">Timing Configuration</Label>
                <div class="flex items-center gap-2">
                  <button
                    class="h-8 flex-1 rounded-md border text-sm font-medium transition-colors"
                    :class="entry.settings.offsetDirection === 'before' ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-muted'"
                    @click="patchTriggerSettings(i, { offsetDirection: 'before' })"
                  >
                    Before
                  </button>
                  <button
                    class="h-8 flex-1 rounded-md border text-sm font-medium transition-colors"
                    :class="entry.settings.offsetDirection === 'at' ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-muted'"
                    @click="patchTriggerSettings(i, { offsetDirection: 'at' })"
                  >
                    On
                  </button>
                  <button
                    class="h-8 flex-1 rounded-md border text-sm font-medium transition-colors"
                    :class="entry.settings.offsetDirection === 'after' ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-muted'"
                    @click="patchTriggerSettings(i, { offsetDirection: 'after' })"
                  >
                    After
                  </button>
                </div>
                <template v-if="entry.settings.offsetDirection !== 'at'">
                  <div>
                    <Label class="text-xs text-muted-foreground">Days/Hours Before or After</Label>
                    <div class="mt-2 grid grid-cols-3 gap-2">
                      <div v-for="unit in [{ key: 'days', label: 'Days' }, { key: 'hours', label: 'Hours' }, { key: 'minutes', label: 'Minutes' }]" :key="unit.key">
                        <p class="mb-1 text-center text-xs text-muted-foreground">
                          {{ unit.label }}
                        </p>
                        <Input
                          type="number"
                          :model-value="entry.settings.offsetUnit === unit.key ? entry.settings.offsetAmount ?? 0 : 0"
                          min="0"
                          class="h-10 text-center text-sm"
                          @update:model-value="patchTriggerSettings(i, { offsetAmount: Number($event), offsetUnit: unit.key })"
                        />
                      </div>
                    </div>
                  </div>
                </template>
                <div>
                  <Label class="text-xs text-muted-foreground">At specific time (optional)</Label>
                  <Input type="time" :model-value="entry.settings.specificTime ?? ''" class="h-9 text-sm" @update:model-value="patchTriggerSettings(i, { specificTime: $event as string })" />
                </div>
              </div>

              <!-- Settings: daily -->
              <div v-else-if="triggerSettingsType(entry.type) === 'daily'" class="mt-3 flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground shrink-0">at</Label>
                  <Input type="time" :model-value="entry.settings.scheduleTime ?? '09:00'" class="h-8 flex-1 text-sm" @update:model-value="patchTriggerSettings(i, { scheduleTime: $event as string })" />
                </div>
              </div>

              <!-- Settings: weekly -->
              <div v-else-if="triggerSettingsType(entry.type) === 'weekly'" class="mt-3 flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground shrink-0">on</Label>
                  <Select :model-value="entry.settings.weekDay ?? 1" @update:model-value="patchTriggerSettings(i, { weekDay: Number($event) })">
                    <SelectTrigger class="h-8 flex-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="(label, idx) in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']" :key="idx" :value="idx + 1">
                        {{ label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground shrink-0">at</Label>
                  <Input type="time" :model-value="entry.settings.scheduleTime ?? '09:00'" class="h-8 flex-1 text-sm" @update:model-value="patchTriggerSettings(i, { scheduleTime: $event as string })" />
                </div>
              </div>

              <!-- Settings: monthly -->
              <div v-else-if="triggerSettingsType(entry.type) === 'monthly'" class="mt-3 flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground shrink-0">day</Label>
                  <Input type="number" :model-value="entry.settings.monthDay ?? 1" min="1" max="31" class="h-8 w-20 text-sm" @update:model-value="patchTriggerSettings(i, { monthDay: Number($event) })" />
                </div>
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground shrink-0">at</Label>
                  <Input type="time" :model-value="entry.settings.scheduleTime ?? '09:00'" class="h-8 flex-1 text-sm" @update:model-value="patchTriggerSettings(i, { scheduleTime: $event as string })" />
                </div>
              </div>

              <!-- Settings: yearly -->
              <div v-else-if="triggerSettingsType(entry.type) === 'yearly'" class="mt-3 flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <Select :model-value="entry.settings.month ?? 0" @update:model-value="patchTriggerSettings(i, { month: Number($event) })">
                    <SelectTrigger class="h-8 flex-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="(label, idx) in ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']" :key="idx" :value="idx">
                        {{ label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" :model-value="entry.settings.monthDay ?? 1" min="1" max="31" class="h-8 w-20 text-sm" @update:model-value="patchTriggerSettings(i, { monthDay: Number($event) })" />
                </div>
                <div class="flex items-center gap-2">
                  <Label class="text-xs text-muted-foreground shrink-0">at</Label>
                  <Input type="time" :model-value="entry.settings.scheduleTime ?? '09:00'" class="h-8 flex-1 text-sm" @update:model-value="patchTriggerSettings(i, { scheduleTime: $event as string })" />
                </div>
              </div>
            </div>
          </template>

          <!-- Add trigger button -->
          <DropdownMenu v-model:open="showAltTriggerPicker">
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                class="w-full justify-start gap-2 border-dashed text-xs text-muted-foreground h-8"
                :disabled="availableTriggers.length === 0"
              >
                <Icon name="i-lucide-plus" class="h-3.5 w-3.5" />
                Add alternative trigger
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56">
              <DropdownMenuLabel class="text-xs text-muted-foreground">
                Conversation-Based
              </DropdownMenuLabel>
              <DropdownMenuItem v-for="t in availableTriggers.filter(x => x.category === 'conversation')" :key="t.value" @click="addTrigger(t.value)">
                {{ t.label }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel class="text-xs text-muted-foreground">
                Reservation Events
              </DropdownMenuLabel>
              <DropdownMenuItem v-for="t in availableTriggers.filter(x => x.category === 'reservation')" :key="t.value" @click="addTrigger(t.value)">
                {{ t.label }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel class="text-xs text-muted-foreground">
                Calendar-Based
              </DropdownMenuLabel>
              <DropdownMenuItem v-for="t in availableTriggers.filter(x => x.category === 'calendar')" :key="t.value" @click="addTrigger(t.value)">
                {{ t.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <!-- Wait -->
      <div v-else-if="waitStep" class="flex flex-col gap-4">
        <div>
          <Label>Wait Mode</Label>
          <div class="mt-1 flex rounded-md border overflow-hidden">
            <button
              class="flex-1 px-3 py-1.5 text-sm transition-colors" :class="[waitStep.waitMode === 'time_delay' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted']"
              @click="patch({ waitMode: 'time_delay' } as any)"
            >
              Time Delay
            </button>
            <button
              class="flex-1 px-3 py-1.5 text-sm transition-colors border-l" :class="[waitStep.waitMode === 'until_condition' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted']"
              @click="patch({ waitMode: 'until_condition' } as any)"
            >
              Until Condition Met
            </button>
          </div>
        </div>
        <template v-if="waitStep.waitMode === 'time_delay'">
          <div class="flex flex-col gap-3">
            <Label>Wait Duration</Label>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <p class="mb-1 text-center text-xs text-muted-foreground">
                  Days
                </p>
                <Input type="number" :model-value="waitStep.durationDays ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patch({ durationDays: Number($event) } as any)" />
              </div>
              <div>
                <p class="mb-1 text-center text-xs text-muted-foreground">
                  Hours
                </p>
                <Input type="number" :model-value="waitStep.durationHours ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patch({ durationHours: Number($event) } as any)" />
              </div>
              <div>
                <p class="mb-1 text-center text-xs text-muted-foreground">
                  Minutes
                </p>
                <Input type="number" :model-value="waitStep.durationMinutes ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patch({ durationMinutes: Number($event) } as any)" />
              </div>
            </div>
            <p v-if="!waitStep.durationDays && !waitStep.durationHours && !waitStep.durationMinutes" class="text-xs text-muted-foreground">
              No wait time configured
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <label
              class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/40"
              @click="patch({ waitUntilSpecificTime: !waitStep.waitUntilSpecificTime } as any)"
            >
              <div
                class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border" :class="[
                  waitStep.waitUntilSpecificTime ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                ]"
              >
                <Icon v-if="waitStep.waitUntilSpecificTime" name="i-lucide-check" class="h-3 w-3" />
              </div>
              <div>
                <p class="text-sm font-medium leading-none">Wait until specific time</p>
                <p class="mt-1 text-xs text-muted-foreground">Journey will continue at the specified time</p>
              </div>
            </label>

            <template v-if="waitStep.waitUntilSpecificTime">
              <div>
                <Label class="text-xs text-muted-foreground">Continue at</Label>
                <Input type="time" :model-value="waitStep.waitUntilTime ?? ''" class="h-9 text-sm" @update:model-value="patch({ waitUntilTime: $event as string } as any)" />
              </div>
            </template>
          </div>
        </template>
        <template v-else>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <Label>Wait Until Condition</Label>
              <Badge v-if="waitStep.rules && waitStep.rules.length > 0" variant="secondary" class="ml-auto h-4 px-1 text-[10px]">
                {{ waitStep.rules.length }} rule{{ waitStep.rules.length > 1 ? 's' : '' }}
              </Badge>
            </div>
            <div v-if="waitStep.rules && waitStep.rules.length > 0" class="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
              <div v-for="(rule, i) in waitStep.rules" :key="rule.id" class="flex items-center gap-1">
                <span>{{ conditionMeta[rule.type] ?? rule.type }}</span>
                <span v-if="i < (waitStep.rules.length - 1)" class="text-[10px]">{{ waitStep.combinator ?? 'and' }}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="text-xs"
              @click="openWaitConditionModal"
            >
              <Icon name="i-lucide-sliders-horizontal" class="h-3.5 w-3.5 mr-1.5" />
              {{ (waitStep.rules && waitStep.rules.length > 0) ? 'Edit Conditions' : 'Configure Conditions' }}
            </Button>
          </div>
        </template>
      </div>

      <!-- Message -->
      <div v-else-if="messageStep" class="flex flex-col gap-4">
        <div>
          <Label>Channel</Label>
          <Select :model-value="messageStep.channel" @update:model-value="patch($event === 'whatsapp' ? { channel: $event, messageMode: 'template', aiPersonalization: false } as any : { channel: $event } as any)">
            <SelectTrigger class="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ota">
                OTA Inbox
              </SelectItem>
              <SelectItem value="whatsapp">
                WhatsApp
              </SelectItem>
              <SelectItem value="email">
                Email
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="messageStep.channel === 'whatsapp'" class="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
            <Icon name="i-lucide-triangle-alert" class="h-3 w-3" />
            Requires WhatsApp Business API. WhatsApp messages must use an approved template.
          </p>
        </div>
        <div>
          <Label>Message Mode</Label>
          <div class="mt-1 flex rounded-md border overflow-hidden">
            <button
              class="flex-1 px-3 py-1.5 text-sm transition-colors" :class="[
                messageStep.messageMode === 'directive' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                messageStep.channel === 'whatsapp' && 'opacity-40 cursor-not-allowed pointer-events-none',
              ]"
              @click="patch({ messageMode: 'directive' } as any)"
            >
              AI Directive
            </button>
            <button
              class="flex-1 px-3 py-1.5 text-sm transition-colors border-l" :class="[messageStep.messageMode === 'template' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted']"
              @click="patch({ messageMode: 'template' } as any)"
            >
              Template
            </button>
          </div>
          <p v-if="messageStep.channel === 'whatsapp'" class="mt-1.5 text-xs text-muted-foreground">
            WhatsApp only supports Template mode.
          </p>
        </div>

        <!-- WhatsApp Template selector -->
        <div v-if="messageStep.channel === 'whatsapp' && messageStep.messageMode === 'template'" class="space-y-2">
          <Label>WhatsApp Template</Label>
          <Select
            :model-value="messageStep.whatsappTemplateId"
            @update:model-value="patch({ whatsappTemplateId: $event as string } as any)"
          >
            <SelectTrigger class="mt-1">
              <SelectValue placeholder="Select an approved template…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="template in approvedTemplates"
                :key="template.id"
                :value="template.id"
              >
                {{ template.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div v-if="selectedWhatsAppTemplate" class="flex flex-wrap gap-1">
            <Badge variant="secondary" class="capitalize">
              {{ selectedWhatsAppTemplate.category }}
            </Badge>
            <Badge variant="outline">
              {{ selectedWhatsAppTemplate.language.toUpperCase() }}
            </Badge>
          </div>
          <p v-else-if="approvedTemplates.length === 0" class="text-xs text-muted-foreground">
            No approved templates yet. Create one from Smart Flow → Journeys → WhatsApp Templates.
          </p>
        </div>

        <div v-if="messageStep.messageMode === 'directive'">
          <div class="flex items-center gap-2 mb-1">
            <Label>Smart Directive</Label>
            <span class="text-xs font-medium px-1.5 py-0.5 rounded" :style="{ backgroundColor: '#C8A84B22', color: '#C8A84B' }">ElevAI</span>
          </div>
          <Textarea
            :model-value="messageStep.directive"
            class="min-h-24 text-sm"
            placeholder="Describe what ElevAI should say…"
            @update:model-value="patch({ directive: $event as string } as any)"
          />
        </div>
        <div v-else-if="messageStep.channel !== 'whatsapp'">
          <Label>Message Template</Label>
          <Textarea
            :model-value="messageStep.templateText"
            class="mt-1 min-h-24 text-sm"
            placeholder="Write the static message text…"
            @update:model-value="patch({ templateText: $event as string } as any)"
          />
          <div class="mt-2 flex flex-wrap gap-1">
            <button
              v-for="v in [
                { key: 'guestName', label: 'Guest name' },
                { key: 'propertyName', label: 'Property Name' },
                { key: 'city', label: 'City' },
                { key: 'resStart', label: 'Reservation Start Date' },
                { key: 'resEnd', label: 'Reservation End Date' },
              ]"
              :key="v.key"
              class="rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              @click="patch({ templateText: `${messageStep.templateText}{{${v.key}}}` } as any)"
            >
              {{ v.label }}
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
          <div class="flex items-center justify-between">
            <Label class="cursor-pointer text-sm" for="ctx-check-toggle">AI Context Check</Label>
            <Switch
              id="ctx-check-toggle"
              :key="`ctx-${step.id}-${messageStep.contextCheckEnabled}`"
              :checked="messageStep.contextCheckEnabled"
              @update:checked="patch({ contextCheckEnabled: $event } as any)"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            AI reads conversation history before sending to decide if the message is still relevant.
          </p>
          <Textarea
            v-if="messageStep.contextCheckEnabled"
            :model-value="messageStep.contextCheckInstruction"
            class="text-xs min-h-16"
            placeholder="e.g. Do not send if the guest has already been welcomed."
            @update:model-value="patch({ contextCheckInstruction: $event as string } as any)"
          />
        </div>
        <div v-if="messageStep.channel !== 'whatsapp'" class="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
          <div class="flex items-center justify-between">
            <Label class="cursor-pointer text-sm" for="ai-personalize-toggle">AI Personalization</Label>
            <Switch
              id="ai-personalize-toggle"
              :key="`ai-pers-${step.id}-${messageStep.aiPersonalization}`"
              :checked="messageStep.aiPersonalization"
              @update:checked="patch({ aiPersonalization: $event } as any)"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            Tailor messages using guest's reservation details and preferences.
          </p>
        </div>
      </div>

      <!-- Context Check (legacy) -->
      <div v-else-if="contextStep" class="flex flex-col gap-4">
        <div class="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Context Check is now built into Message steps. This step type is kept for compatibility.
        </div>
        <div>
          <Label>Condition</Label>
          <Textarea
            :model-value="contextStep.condition"
            class="mt-1 min-h-24 text-sm"
            placeholder="Describe the condition to check…"
            @update:model-value="patch({ condition: $event as string } as any)"
          />
        </div>
        <div>
          <Label>If Check Fails</Label>
          <Select :model-value="contextStep.onFail" @update:model-value="patch({ onFail: $event } as any)">
            <SelectTrigger class="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">
                Skip step
              </SelectItem>
              <SelectItem value="stop">
                Stop Journey
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- Action -->
      <div v-else-if="actionStep" class="flex flex-col gap-4">
        <div>
          <Label>Action Type</Label>
          <Select :model-value="actionStep.actionType" @update:model-value="patch({ actionType: $event } as any)">
            <SelectTrigger class="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="raise_action_item">
                Raise Action Item
              </SelectItem>
              <SelectItem value="create_task">
                Create Task
              </SelectItem>
              <SelectItem value="flag_reservation">
                Flag Reservation
              </SelectItem>
              <SelectItem value="staff_alert">
                Staff Alert
              </SelectItem>
              <SelectItem value="send_guest_guide">
                Send Guest Guide
              </SelectItem>
              <SelectItem value="send_email">
                Send Email
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SendGuestGuideAction
          v-if="actionStep.actionType === 'send_guest_guide'"
          :model-value="(actionStep as any).data ?? {}"
          @update:model-value="patch({ data: $event } as any)"
        />
        <SendEmailAction
          v-if="actionStep.actionType === 'send_email'"
          :model-value="(actionStep as any).data ?? {}"
          @update:model-value="patch({ data: $event } as any)"
        />
        <div v-else>
          <Label>Details</Label>
          <Textarea
            :model-value="actionStep.details"
            class="mt-1 min-h-20 text-sm"
            placeholder="Describe the action details…"
            @update:model-value="patch({ details: $event as string } as any)"
          />
        </div>
      </div>

      <!-- If/Else -->
      <div v-else-if="ifElseStep" class="flex flex-col gap-4">
        <p class="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          Split the automation based on conditions.
        </p>
        <div class="flex flex-col gap-2">
          <Button variant="outline" class="justify-start gap-2" @click="openConditionModal('ifElse')">
            <Icon name="i-lucide-list-filter" class="h-4 w-4" />
            <span>Configure Condition</span>
            <Badge v-if="ifElseStep.rules && ifElseStep.rules.length > 0" variant="secondary" class="ml-auto h-4 px-1 text-[10px]">
              {{ ifElseStep.rules.length }}
            </Badge>
          </Button>
          <div v-if="ifElseStep.rules && ifElseStep.rules.length > 0" class="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
            <div v-for="(r, i) in ifElseStep.rules" :key="r.id" class="flex items-center gap-2 py-0.5">
              <span class="font-medium">{{ conditionMeta[r.type] }}</span>
              <span v-if="i < (ifElseStep.rules.length - 1)" class="text-[10px]">{{ ifElseStep.combinator ?? 'and' }}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-3">
          <!-- True Branch -->
          <div class="flex flex-col gap-2 rounded-md border p-3">
            <Label class="text-xs text-green-600">True Branch</Label>
            <Button
              v-if="trueBranchType"
              variant="outline"
              class="w-full justify-start gap-2 text-xs"
              @click="openBranchDialog('true')"
            >
              <Icon :name="branchActionOptions.find(o => o.value === trueBranchType)?.icon ?? 'i-lucide-settings'" class="h-3.5 w-3.5" />
              {{ trueBranchActionLabel }}
            </Button>
            <DropdownMenu v-else>
              <DropdownMenuTrigger as-child>
                <Button variant="outline" class="w-full justify-start gap-2 text-xs">
                  <Icon name="i-lucide-plus" class="h-3.5 w-3.5" />
                  None
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" class="w-48">
                <template v-for="(opts, group) in branchActionGroups" :key="group">
                  <DropdownMenuLabel class="text-xs text-muted-foreground">
                    {{ group }}
                  </DropdownMenuLabel>
                  <DropdownMenuItem v-for="opt in opts" :key="opt.value" @click="selectBranchAction('true', opt.value)">
                    <Icon :name="opt.icon" class="mr-2 h-4 w-4" />
                    {{ opt.label }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
            <p v-if="trueBranchSummary" class="text-xs text-muted-foreground">
              {{ trueBranchSummary }}
            </p>
          </div>

          <!-- False Branch -->
          <div class="flex flex-col gap-2 rounded-md border p-3">
            <Label class="text-xs text-red-500">False Branch</Label>
            <Button
              v-if="falseBranchType"
              variant="outline"
              class="w-full justify-start gap-2 text-xs"
              @click="openBranchDialog('false')"
            >
              <Icon :name="branchActionOptions.find(o => o.value === falseBranchType)?.icon ?? 'i-lucide-settings'" class="h-3.5 w-3.5" />
              {{ falseBranchActionLabel }}
            </Button>
            <DropdownMenu v-else>
              <DropdownMenuTrigger as-child>
                <Button variant="outline" class="w-full justify-start gap-2 text-xs">
                  <Icon name="i-lucide-plus" class="h-3.5 w-3.5" />
                  None
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" class="w-48">
                <template v-for="(opts, group) in branchActionGroups" :key="group">
                  <DropdownMenuLabel class="text-xs text-muted-foreground">
                    {{ group }}
                  </DropdownMenuLabel>
                  <DropdownMenuItem v-for="opt in opts" :key="opt.value" @click="selectBranchAction('false', opt.value)">
                    <Icon :name="opt.icon" class="mr-2 h-4 w-4" />
                    {{ opt.label }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
            <p v-if="falseBranchSummary" class="text-xs text-muted-foreground">
              {{ falseBranchSummary }}
            </p>
          </div>
        </div>
      </div>

      <!-- Hard Requirement -->
      <div v-else-if="hardReqStep" class="flex flex-col gap-4">
        <p class="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          A gate that stops the Journey for guests who do not meet the condition.
        </p>
        <div class="flex flex-col gap-2">
          <Button variant="outline" class="justify-start gap-2" @click="openConditionModal('hardReq')">
            <Icon name="i-lucide-list-filter" class="h-4 w-4" />
            <span>Configure Condition</span>
            <Badge v-if="hardReqStep.rules && hardReqStep.rules.length > 0" variant="secondary" class="ml-auto h-4 px-1 text-[10px]">
              {{ hardReqStep.rules.length }}
            </Badge>
          </Button>
          <div v-if="hardReqStep.rules && hardReqStep.rules.length > 0" class="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
            <div v-for="(r, i) in hardReqStep.rules" :key="r.id" class="flex items-center gap-2 py-0.5">
              <span class="font-medium">{{ conditionMeta[r.type] }}</span>
              <span v-if="i < (hardReqStep.rules.length - 1)" class="text-[10px]">{{ hardReqStep.combinator ?? 'and' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Note -->
      <div v-else-if="noteStep" class="flex flex-col gap-4">
        <div>
          <Label>Note Content</Label>
          <Textarea
            :model-value="noteStep.noteContent"
            class="mt-1 min-h-24 text-sm"
            placeholder="Internal note to add to the reservation…"
            @update:model-value="patch({ noteContent: $event as string } as any)"
          />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <Label class="cursor-pointer" for="ai-visible-toggle">Visible to AI</Label>
            <p class="text-xs text-muted-foreground mt-0.5">
              Allow ElevAI to read this note for future context.
            </p>
          </div>
          <Switch
            id="ai-visible-toggle"
            :key="`note-${step.id}-${noteStep.visibleToAI}`"
            :checked="noteStep.visibleToAI"
            @update:checked="patch({ visibleToAI: $event } as any)"
          />
        </div>
      </div>

      <!-- Toggle AI -->
      <div v-else-if="toggleAIStep" class="flex flex-col gap-4">
        <p class="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          {{ toggleAIStep.enable ? 'Start automatic responses for this guest.' : 'Temporarily disable automatic responses for this guest.' }}
        </p>
        <div class="flex items-center justify-between">
          <Label class="cursor-pointer" for="toggle-ai-enable">{{ toggleAIStep.enable ? 'Enable AI Responses' : 'Pause AI Responses' }}</Label>
          <Switch
            id="toggle-ai-enable"
            :key="`toggleai-${step.id}-${toggleAIStep.enable}`"
            :checked="toggleAIStep.enable"
            @update:checked="patch({ enable: $event } as any)"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label class="text-xs text-muted-foreground">Duration</Label>
          <div class="flex flex-col gap-2">
            <label
              class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/40"
              @click="patch({ duration: 'indefinite' } as any)"
            >
              <div class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border" :class="toggleAIStep.duration !== 'specific' ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                <div v-if="toggleAIStep.duration !== 'specific'" class="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
              <div>
                <p class="text-sm font-medium leading-none">Indefinitely</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ toggleAIStep.enable ? 'Until manually paused' : 'Until manually resumed' }}</p>
              </div>
            </label>
            <label
              class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/40"
              @click="patch({ duration: 'specific' } as any)"
            >
              <div class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border" :class="toggleAIStep.duration === 'specific' ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                <div v-if="toggleAIStep.duration === 'specific'" class="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium leading-none">Specific duration</p>
                <div v-if="toggleAIStep.duration === 'specific'" class="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <p class="mb-1 text-center text-xs text-muted-foreground">Days</p>
                    <Input type="number" :model-value="toggleAIStep.days ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patch({ days: Number($event) } as any)" />
                  </div>
                  <div>
                    <p class="mb-1 text-center text-xs text-muted-foreground">Hours</p>
                    <Input type="number" :model-value="toggleAIStep.hours ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patch({ hours: Number($event) } as any)" />
                  </div>
                  <div>
                    <p class="mb-1 text-center text-xs text-muted-foreground">Minutes</p>
                    <Input type="number" :model-value="toggleAIStep.minutes ?? 0" min="0" class="h-10 text-center text-sm" @update:model-value="patch({ minutes: Number($event) } as any)" />
                  </div>
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Integration -->
      <div v-else-if="integrationStep" class="flex flex-col gap-4">
        <div>
          <Label>Integration</Label>
          <Input
            :model-value="integrationStep.integrationName"
            class="mt-1"
            placeholder="e.g. Turno, Minut, Custom API…"
            @update:model-value="patch({ integrationName: $event as string } as any)"
          />
        </div>
        <div>
          <Label>Payload / Action</Label>
          <Textarea
            :model-value="integrationStep.payload"
            class="mt-1 min-h-20 text-sm"
            placeholder="Describe the outbound action or payload…"
            @update:model-value="patch({ payload: $event as string } as any)"
          />
        </div>
      </div>

      <!-- End Journey -->
      <div v-else-if="isEndJourney" class="flex flex-col gap-3">
        <div class="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-3">
          <Icon name="i-lucide-flag" class="h-5 w-5 shrink-0 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            This step formally terminates the Journey for the current guest. No further steps will execute after this point.
          </p>
        </div>
      </div>
    </template>

    <Dialog v-model:open="branchDialogOpen">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon v-if="branchDialogType" :name="branchActionOptions.find(o => o.value === branchDialogType)?.icon ?? 'i-lucide-settings'" class="h-4 w-4" />
            {{ branchDialogLabel }}
            <Badge variant="secondary" class="ml-1 text-xs">
              {{ branchDialogTarget === 'true' ? 'True Branch' : 'False Branch' }}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <!-- Wait -->
          <!-- Wait -->
          <div v-if="branchDialogType === 'wait'" class="flex flex-col gap-4">
            <div>
              <Label>Wait Mode</Label>
              <div class="mt-1 flex rounded-md border overflow-hidden">
                <button
                  class="flex-1 px-3 py-1.5 text-sm transition-colors"
                  :class="[(activeBranchStep as any)?.waitMode !== 'until_condition' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted']"
                  @click="patchActiveBranch({ waitMode: 'time_delay' })"
                >
                  Time Delay
                </button>
                <button
                  class="flex-1 px-3 py-1.5 text-sm transition-colors border-l"
                  :class="[(activeBranchStep as any)?.waitMode === 'until_condition' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted']"
                  @click="patchActiveBranch({ waitMode: 'until_condition' })"
                >
                  Until Condition Met
                </button>
              </div>
            </div>

            <template v-if="(activeBranchStep as any)?.waitMode !== 'until_condition'">
              <div class="flex flex-col gap-2">
                <Label>Wait Duration</Label>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <p class="mb-1 text-center text-xs text-muted-foreground">
                      Days
                    </p>
                    <Input type="number" :model-value="(activeBranchStep as any)?.durationDays ?? 0" min="0" class="h-10 text-center" @update:model-value="patchActiveBranch({ durationDays: Number($event) })" />
                  </div>
                  <div>
                    <p class="mb-1 text-center text-xs text-muted-foreground">
                      Hours
                    </p>
                    <Input type="number" :model-value="(activeBranchStep as any)?.durationHours ?? 0" min="0" class="h-10 text-center" @update:model-value="patchActiveBranch({ durationHours: Number($event) })" />
                  </div>
                  <div>
                    <p class="mb-1 text-center text-xs text-muted-foreground">
                      Minutes
                    </p>
                    <Input type="number" :model-value="(activeBranchStep as any)?.durationMinutes ?? 0" min="0" class="h-10 text-center" @update:model-value="patchActiveBranch({ durationMinutes: Number($event) })" />
                  </div>
                </div>
                <p v-if="!(activeBranchStep as any)?.durationDays && !(activeBranchStep as any)?.durationHours && !(activeBranchStep as any)?.durationMinutes" class="text-xs text-muted-foreground">
                  No wait time configured
                </p>
              </div>

              <div class="flex flex-col gap-2">
                <label
                  class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/40"
                  @click="patchActiveBranch({ waitUntilSpecificTime: !(activeBranchStep as any)?.waitUntilSpecificTime })"
                >
                  <div
                    class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                    :class="[(activeBranchStep as any)?.waitUntilSpecificTime ? 'border-primary bg-primary text-primary-foreground' : 'border-input']"
                  >
                    <Icon v-if="(activeBranchStep as any)?.waitUntilSpecificTime" name="i-lucide-check" class="h-3 w-3" />
                  </div>
                  <div>
                    <p class="text-sm font-medium leading-none">Wait until specific time</p>
                    <p class="mt-1 text-xs text-muted-foreground">Journey will continue at the specified time</p>
                  </div>
                </label>
                <template v-if="(activeBranchStep as any)?.waitUntilSpecificTime">
                  <div>
                    <Label class="text-xs text-muted-foreground">Continue at</Label>
                    <Input type="time" :model-value="(activeBranchStep as any)?.waitUntilTime ?? ''" class="h-9 text-sm" @update:model-value="patchActiveBranch({ waitUntilTime: $event as string })" />
                  </div>
                </template>
              </div>
            </template>

            <template v-else>
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <Label>Wait Until Condition</Label>
                  <Badge v-if="(activeBranchStep as any)?.rules?.length" variant="secondary" class="ml-auto h-4 px-1 text-[10px]">
                    {{ (activeBranchStep as any).rules.length }} rule{{ (activeBranchStep as any).rules.length > 1 ? 's' : '' }}
                  </Badge>
                </div>
                <div v-if="(activeBranchStep as any)?.rules?.length" class="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                  <div v-for="(rule, i) in (activeBranchStep as any).rules" :key="rule.id" class="flex items-center gap-2 py-0.5">
                    <span class="font-medium">{{ conditionMeta[rule.type as ConditionType] ?? rule.type }}</span>
                    <span v-if="i < ((activeBranchStep as any).rules.length - 1)" class="text-[10px]">{{ (activeBranchStep as any).combinator ?? 'and' }}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="text-xs"
                  @click="branchDialogTarget === 'true' ? openBranchConditionModal('true') : openBranchConditionModal('false')"
                >
                  <Icon name="i-lucide-sliders-horizontal" class="h-3.5 w-3.5 mr-1.5" />
                  {{ (activeBranchStep as any)?.rules?.length ? 'Edit Conditions' : 'Configure Conditions' }}
                </Button>
              </div>
            </template>
          </div>

          <!-- Message -->
          <div v-else-if="branchDialogType === 'message'" class="flex flex-col gap-3">
            <div>
              <Label>Message Mode</Label>
              <div class="mt-1 flex rounded-md border overflow-hidden">
                <button
                  class="flex-1 px-3 py-1.5 text-sm" :class="[
                    (activeBranchStep as any)?.messageMode === 'directive' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                    (activeBranchStep as any)?.channel === 'whatsapp' && 'opacity-40 cursor-not-allowed pointer-events-none',
                  ]"
                  @click="patchActiveBranch({ messageMode: 'directive' })"
                >
                  AI Directive
                </button>
                <button class="flex-1 px-3 py-1.5 text-sm border-l" :class="[(activeBranchStep as any)?.messageMode === 'template' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground']" @click="patchActiveBranch({ messageMode: 'template' })">
                  Template
                </button>
              </div>
              <p v-if="(activeBranchStep as any)?.channel === 'whatsapp'" class="mt-1.5 text-xs text-muted-foreground">
                WhatsApp only supports Template mode.
              </p>
            </div>
            <div>
              <Label>Channel</Label>
              <Select :model-value="(activeBranchStep as any)?.channel ?? 'ota'" @update:model-value="patchActiveBranch($event === 'whatsapp' ? { channel: $event, messageMode: 'template' } : { channel: $event })">
                <SelectTrigger class="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ota">
                    OTA Inbox
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    WhatsApp
                  </SelectItem>
                  <SelectItem value="email">
                    Email
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Branch WhatsApp Template selector -->
            <div
              v-if="(activeBranchStep as any)?.channel === 'whatsapp' && (activeBranchStep as any)?.messageMode === 'template'"
              class="space-y-2"
            >
              <Label>WhatsApp Template</Label>
              <Select
                :model-value="(activeBranchStep as any)?.whatsappTemplateId ?? ''"
                @update:model-value="patchActiveBranch({ whatsappTemplateId: $event as string })"
              >
                <SelectTrigger class="mt-1">
                  <SelectValue placeholder="Select an approved template…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="template in approvedTemplates"
                    :key="template.id"
                    :value="template.id"
                  >
                    {{ template.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <div
                v-if="approvedTemplates.find(t => t.id === (activeBranchStep as any)?.whatsappTemplateId)"
                class="flex flex-wrap gap-1"
              >
                <Badge variant="secondary" class="capitalize">
                  {{ approvedTemplates.find(t => t.id === (activeBranchStep as any)?.whatsappTemplateId)?.category }}
                </Badge>
                <Badge variant="outline">
                  {{ approvedTemplates.find(t => t.id === (activeBranchStep as any)?.whatsappTemplateId)?.language.toUpperCase() }}
                </Badge>
              </div>
            </div>

            <div v-if="(activeBranchStep as any)?.channel !== 'whatsapp'">
              <Label>{{ (activeBranchStep as any)?.messageMode === 'template' ? 'Template Text' : 'AI Directive' }}</Label>
              <Textarea
                :model-value="(activeBranchStep as any)?.messageMode === 'template' ? (activeBranchStep as any)?.templateText : (activeBranchStep as any)?.directive"
                class="mt-1 min-h-24 text-sm"
                :placeholder="(activeBranchStep as any)?.messageMode === 'template' ? 'Template text…' : 'AI directive…'"
                @update:model-value="patchActiveBranch((activeBranchStep as any)?.messageMode === 'template' ? { templateText: $event as string } : { directive: $event as string })"
              />
            </div>
          </div>

          <!-- Action -->
          <div v-else-if="branchDialogType === 'action'" class="flex flex-col gap-3">
            <div>
              <Label>Action Type</Label>
              <Select :model-value="(activeBranchStep as any)?.actionType ?? 'raise_action_item'" @update:model-value="patchActiveBranch({ actionType: $event })">
                <SelectTrigger class="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raise_action_item">
                    Raise Action Item
                  </SelectItem>
                  <SelectItem value="create_task">
                    Create Task
                  </SelectItem>
                  <SelectItem value="flag_reservation">
                    Flag Reservation
                  </SelectItem>
                  <SelectItem value="staff_alert">
                    Staff Alert
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Details</Label>
              <Textarea :model-value="(activeBranchStep as any)?.details ?? ''" class="mt-1 min-h-24 text-sm" placeholder="Describe the action details…" @update:model-value="patchActiveBranch({ details: $event as string })" />
            </div>
          </div>

          <!-- Create Note -->
          <div v-else-if="branchDialogType === 'create_note'" class="flex flex-col gap-3">
            <div>
              <Label>Note Content</Label>
              <Textarea :model-value="(activeBranchStep as any)?.noteContent ?? ''" class="mt-1 min-h-24 text-sm" placeholder="Note content…" @update:model-value="patchActiveBranch({ noteContent: $event as string })" />
            </div>
            <label class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5" @click="patchActiveBranch({ visibleToAI: !(activeBranchStep as any)?.visibleToAI })">
              <div class="flex h-4 w-4 items-center justify-center rounded border" :class="[(activeBranchStep as any)?.visibleToAI ? 'border-primary bg-primary text-primary-foreground' : 'border-input']">
                <Icon v-if="(activeBranchStep as any)?.visibleToAI" name="i-lucide-check" class="h-3 w-3" />
              </div>
              <span class="text-sm">Visible to AI</span>
            </label>
          </div>

          <!-- Toggle AI -->
          <div v-else-if="branchDialogType === 'toggle_ai_pause' || branchDialogType === 'toggle_ai_start'" class="flex flex-col gap-3">
            <div>
              <Label>Duration</Label>
              <Select :model-value="(activeBranchStep as any)?.duration ?? 'indefinite'" @update:model-value="patchActiveBranch({ duration: $event })">
                <SelectTrigger class="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinite">
                    Indefinite
                  </SelectItem>
                  <SelectItem value="specific">
                    Specific Duration
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="(activeBranchStep as any)?.duration === 'specific'" class="grid grid-cols-3 gap-2">
              <div>
                <p class="mb-1 text-center text-xs text-muted-foreground">
                  Days
                </p>
                <Input type="number" :model-value="(activeBranchStep as any)?.days ?? 0" min="0" class="h-10 text-center" @update:model-value="patchActiveBranch({ days: Number($event) })" />
              </div>
              <div>
                <p class="mb-1 text-center text-xs text-muted-foreground">
                  Hours
                </p>
                <Input type="number" :model-value="(activeBranchStep as any)?.hours ?? 0" min="0" class="h-10 text-center" @update:model-value="patchActiveBranch({ hours: Number($event) })" />
              </div>
              <div>
                <p class="mb-1 text-center text-xs text-muted-foreground">
                  Minutes
                </p>
                <Input type="number" :model-value="(activeBranchStep as any)?.minutes ?? 0" min="0" class="h-10 text-center" @update:model-value="patchActiveBranch({ minutes: Number($event) })" />
              </div>
            </div>
          </div>

          <!-- Integration -->
          <div v-else-if="branchDialogType === 'integration'" class="flex flex-col gap-3">
            <div>
              <Label>Integration Name</Label>
              <Input :model-value="(activeBranchStep as any)?.integrationName ?? ''" class="mt-1" placeholder="Integration name…" @update:model-value="patchActiveBranch({ integrationName: $event as string })" />
            </div>
            <div>
              <Label>Payload</Label>
              <Textarea :model-value="(activeBranchStep as any)?.payload ?? ''" class="mt-1 min-h-24 text-sm" placeholder="Payload…" @update:model-value="patchActiveBranch({ payload: $event as string })" />
            </div>
          </div>

          <!-- Hard Requirement -->
          <div v-else-if="branchDialogType === 'hard_requirement'" class="flex flex-col gap-3">
            <p class="text-xs text-muted-foreground">
              The branch action only runs if these conditions are met.
            </p>
            <Button variant="outline" class="justify-start gap-2 w-full" @click="branchDialogTarget === 'true' ? openBranchConditionModal('true') : openBranchConditionModal('false')">
              <Icon name="i-lucide-list-filter" class="h-4 w-4" />
              <span>Configure Condition</span>
              <Badge v-if="(activeBranchStep as any)?.rules?.length" variant="secondary" class="ml-auto h-4 px-1 text-[10px]">
                {{ (activeBranchStep as any).rules.length }}
              </Badge>
            </Button>
            <div v-if="(activeBranchStep as any)?.rules?.length" class="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
              <div v-for="(r, i) in (activeBranchStep as any).rules" :key="r.id" class="flex items-center gap-2 py-0.5">
                <span class="font-medium">{{ conditionMeta[r.type as ConditionType] ?? r.type }}</span>
                <span v-if="i < ((activeBranchStep as any).rules.length - 1)" class="text-[10px]">{{ (activeBranchStep as any).combinator ?? 'and' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-between">
          <Button variant="destructive" size="sm" @click="deleteBranchAction">
            <Icon name="i-lucide-trash-2" class="mr-2 h-3.5 w-3.5" />
            Delete Action
          </Button>
          <Button size="sm" @click="branchDialogOpen = false">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <JourneysJourneyConditionsModal
      v-model:open="conditionModalOpen"
      :model-value="conditionModalRules"
      :combinator="conditionModalCombinator"
      :title="conditionModalTitle"
      :description="conditionModalTarget === 'hardReq' ? 'Guests must meet ALL of these conditions for the journey to continue.' : conditionModalTarget === 'wait' ? 'The journey will wait until these conditions are met.' : 'Define the condition to branch the journey.'"
      @save="handleConditionSave"
    />
  </div>
</template>
