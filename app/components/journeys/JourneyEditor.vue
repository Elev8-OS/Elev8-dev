<script setup lang="ts">
import type { ConditionCombinator, ConditionRule, ConditionType, Journey, JourneyStep, StepType } from './data/journeys'
import { toast } from 'vue-sonner'
import draggable from 'vuedraggable'
import { listings } from '~/components/listings/data/listings'
import { useWhatsApp } from '~/composables/useWhatsApp'

const props = defineProps<{
  initialJourney: Journey | null
}>()

const emit = defineEmits<{
  'save': [journey: Journey]
  'back': []
  'build-with-ai': [prompt: string, journey: Journey]
  'save-template': [journey: Journey]
}>()

function makeDefaultJourney(): Journey {
  return {
    id: `j-${Date.now()}`,
    name: 'New Journey',
    status: 'inactive',
    triggerType: 'new_booking',
    lastModified: new Date().toISOString().split('T')[0],
    properties: ['All Properties'],
    requirements: [],
    requirementCombinator: 'and',
    steps: [
      {
        id: `s-${Date.now()}`,
        type: 'trigger',
        name: 'New Booking',
        triggers: [{ type: 'new_booking', settings: {} }],
        properties: ['All Properties'],
      },
    ],
  }
}

const localJourney = ref<Journey>(
  props.initialJourney ? JSON.parse(JSON.stringify(props.initialJourney)) : makeDefaultJourney(),
)

const { whatsappAccounts } = useWhatsApp()

function deriveRegion(location: string, tags: string[]): 'Bali' | 'Switzerland' | 'Germany' {
  if (tags.includes('EUR'))
    return 'Germany'
  const bali = ['Bali', 'Canggu', 'Seminyak', 'Ubud', 'Pererenan', 'Umalas', 'Jimbaran', 'Uluwatu', 'Kintamani']
  if (bali.some(k => location.includes(k)))
    return 'Bali'
  return 'Switzerland'
}

const propertyOptions = computed(() =>
  listings.value.map(l => ({
    id: l.id,
    name: l.name,
    city: l.location,
    region: deriveRegion(l.location, l.tags),
  })),
)

const hasWhatsAppStep = computed(() =>
  localJourney.value.steps.some(s => s.type === 'message' && (s as any).channel === 'whatsapp'),
)

const journeyScopeListingIds = computed<string[]>(() => {
  const scope = localJourney.value.properties
  if (scope.length === 0 || scope.includes('All Properties'))
    return propertyOptions.value.map(l => l.id!)
  return scope.filter(id => propertyOptions.value.some(l => l.id === id))
})

const whatsappCoverage = computed(() => {
  const covered = new Set<string>()
  whatsappAccounts.value
    .filter(a => a.status === 'connected')
    .forEach(a => a.listingIds.forEach(id => covered.add(id)))
  const inScope = journeyScopeListingIds.value
  const coveredCount = inScope.filter(id => covered.has(id)).length
  const total = inScope.length
  return { coveredCount, total, uncovered: inScope.filter(id => !covered.has(id)) }
})

const showWhatsAppCoverageWarning = computed(() =>
  hasWhatsAppStep.value
  && whatsappCoverage.value.total > 0
  && whatsappCoverage.value.coveredCount < whatsappCoverage.value.total,
)

// Journey-wide requirements
const requirements = computed<ConditionRule[]>(() => localJourney.value.requirements ?? [])
const requirementCombinator = computed<ConditionCombinator>(() => localJourney.value.requirementCombinator ?? 'and')

function handleSaveRequirements(rules: ConditionRule[], combinator: ConditionCombinator) {
  localJourney.value = { ...localJourney.value, requirements: rules, requirementCombinator: combinator }
  toast.success('Journey-wide requirements updated')
}

// Modal open states
const requirementsModalOpen = ref(false)
const saveTemplateOpen = ref(false)
const buildAIOpen = ref(false)

function handleBuildAI(prompt: string) {
  emit('build-with-ai', prompt, JSON.parse(JSON.stringify(localJourney.value)))
}

function handleSaveTemplate() {
  emit('save-template', localJourney.value)
}

const selectedStepId = ref<string | null>(localJourney.value.steps[0]?.id ?? null)
const isEditingName = ref(false)
const nameInputRef = ref<HTMLInputElement | null>(null)

// When entering the editor with AI-modified steps (isNew === true), focus the
// first new step in the right sidebar so the user immediately sees what changed.
onMounted(() => {
  const firstNew = localJourney.value.steps.find(s => (s as any).isNew)
  if (firstNew)
    selectedStepId.value = firstNew.id
})

const isActive = computed({
  get: () => localJourney.value.status === 'active',
  set: (val) => {
    const status = val ? 'active' : 'inactive'
    localJourney.value = { ...localJourney.value, status }
    toast.success(`"${localJourney.value.name}" set to ${status}`)
  },
})

function setProperties(val: string[]) {
  localJourney.value = { ...localJourney.value, properties: val }
}

const selectedStep = computed(
  () => localJourney.value.steps.find(s => s.id === selectedStepId.value) ?? null,
)

function startEditName() {
  isEditingName.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function commitName(e: Event) {
  const val = (e.target as HTMLInputElement).value.trim()
  if (val && val !== localJourney.value.name) {
    localJourney.value = { ...localJourney.value, name: val }
    toast.success(`Journey renamed to "${val}"`)
  }
  isEditingName.value = false
}

function handleStepUpdate(updated: JourneyStep) {
  const index = localJourney.value.steps.findIndex(s => s.id === updated.id)
  if (index !== -1)
    localJourney.value.steps.splice(index, 1, updated)
}

function deleteStep(id: string) {
  const step = localJourney.value.steps.find(s => s.id === id)
  if (!step || step.type === 'trigger')
    return
  const remaining = localJourney.value.steps.filter(s => s.id !== id)
  localJourney.value = { ...localJourney.value, steps: remaining }
  if (selectedStepId.value === id) {
    selectedStepId.value = remaining[0]?.id ?? null
  }
}

function makeStep(type: StepType, id: string, enable?: boolean): JourneyStep {
  if (type === 'wait')
    return { id, type: 'wait', name: 'Wait', waitMode: 'time_delay', durationDays: 0, durationHours: 0, durationMinutes: 0 }
  if (type === 'message')
    return { id, type: 'message', name: 'Send Message', messageMode: 'directive', channel: 'ota', templateText: '', directive: '', contextCheckEnabled: false, contextCheckInstruction: '', fallback: 'skip', fallbackText: '', whatsappTemplateId: '' }
  if (type === 'context_check')
    return { id, type: 'context_check', name: 'Context Check', condition: '', onFail: 'skip' }
  if (type === 'if_else')
    return { id, type: 'if_else', name: 'If/Else Branch', conditionType: 'guest_sentiment' as ConditionType, conditionDetails: '', rules: [], combinator: 'and' as ConditionCombinator, trueBranchLabel: 'Condition met', falseBranchLabel: 'Condition not met' }
  if (type === 'hard_requirement')
    return { id, type: 'hard_requirement', name: 'Hard Requirement', conditionType: 'reservation_status' as ConditionType, conditionDetails: '', rules: [], combinator: 'and' as ConditionCombinator }
  if (type === 'create_note')
    return { id, type: 'create_note', name: 'Create Note', noteContent: '', visibleToAI: true }
  if (type === 'toggle_ai')
    return { id, type: 'toggle_ai', name: enable === false ? 'Pause Auto-responses' : 'Start Auto-responses', enable: enable !== false, duration: 'indefinite', days: 0, hours: 0, minutes: 0 }
  if (type === 'integration')
    return { id, type: 'integration', name: 'Integration Action', integrationName: '', payload: '' }
  if (type === 'end_journey')
    return { id, type: 'end_journey', name: 'End Journey' }
  return { id, type: 'action', name: 'Action', actionType: 'raise_action_item', details: '' }
}

function addStep(type: StepType, insertAfterIndex?: number, enable?: boolean) {
  const id = `s-${Date.now()}`
  const newStep = makeStep(type, id, enable)
  const steps = [...localJourney.value.steps]
  if (insertAfterIndex !== undefined) {
    steps.splice(insertAfterIndex + 1, 0, newStep)
  }
  else {
    steps.push(newStep)
  }
  localJourney.value = { ...localJourney.value, steps }
  selectedStepId.value = id
}

function onDragMove(evt: any) {
  // Prevent the trigger step from being moved at all
  if (evt.draggedContext.element.type === 'trigger')
    return false
  // Prevent any step from being moved before the trigger (index 0)
  if (evt.relatedContext.index === 0)
    return false
  return true
}

function onDragEnd() {
  localJourney.value = { ...localJourney.value, steps: [...localJourney.value.steps] }
}

function handleSave() {
  const trigStep = localJourney.value.steps.find(s => s.type === 'trigger') as any
  // Strip the transient `isNew` marker set by buildModifiedJourney. Persisting it
  // would mean every future re-open shows the "New" badge, which is wrong.
  const steps = localJourney.value.steps.map((s) => {
    const { isNew: _isNew, ...rest } = s as any
    return rest
  })
  const journey = {
    ...localJourney.value,
    triggerType: trigStep?.triggers?.[0]?.type ?? localJourney.value.triggerType,
    steps: steps as any,
  }
  emit('save', journey)
  toast.success(`"${journey.name}" saved`)
}

const addStepMenuOpen = ref(false)

const addStepOptions: { type: StepType, icon: string, label: string, group: string, enable?: boolean }[] = [
  { type: 'wait', icon: 'i-lucide-clock', label: 'Wait', group: 'Flow' },
  { type: 'message', icon: 'i-lucide-message-square', label: 'Send a Message', group: 'Flow' },
  { type: 'if_else', icon: 'i-lucide-git-fork', label: 'If/Else', group: 'Logic' },
  { type: 'hard_requirement', icon: 'i-lucide-shield', label: 'Hard Requirement', group: 'Logic' },
  { type: 'action', icon: 'i-lucide-bolt', label: 'Create Action Item', group: 'Actions' },
  { type: 'create_note', icon: 'i-lucide-file-pen-line', label: 'Create Reservation Note', group: 'Actions' },
  { type: 'toggle_ai', icon: 'i-lucide-pause', label: 'Pause Auto-responses', group: 'Actions', enable: false },
  { type: 'toggle_ai', icon: 'i-lucide-play', label: 'Start Auto-responses', group: 'Actions', enable: true },
]

const addStepGroups = computed(() => {
  const groups: Record<string, typeof addStepOptions> = {}
  for (const opt of addStepOptions) {
    if (!groups[opt.group])
      groups[opt.group] = []
    groups[opt.group].push(opt)
  }
  return groups
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header class="flex shrink-0 items-center gap-3 border-b bg-background px-4 py-3">
      <Button variant="ghost" size="icon" aria-label="Back" @click="emit('back')">
        <Icon name="i-lucide-arrow-left" class="h-4 w-4" />
      </Button>

      <div class="flex-1 min-w-0 group/title flex items-center gap-1.5">
        <input
          v-if="isEditingName"
          ref="nameInputRef"
          :value="localJourney.name"
          class="text-lg font-semibold bg-transparent border-b border-primary outline-none flex-1 min-w-0"
          @blur="commitName"
          @keydown.enter="commitName"
        >
        <template v-else>
          <h1
            class="cursor-pointer text-lg font-semibold truncate hover:text-primary transition-colors"
            @click="startEditName"
          >
            {{ localJourney.name }}
          </h1>
          <button
            class="shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            aria-label="Rename journey"
            @click="startEditName"
          >
            <Icon name="i-lucide-pencil" class="h-3.5 w-3.5" />
          </button>
        </template>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <SharedPropertyPicker
          :model-value="localJourney.properties"
          :options="propertyOptions"
          @update:model-value="setProperties"
        />
        <Button
          variant="outline"
          size="sm"
          class="h-8"
          @click="requirementsModalOpen = true"
        >
          <Icon name="i-lucide-list-filter" class="mr-1.5 h-3.5 w-3.5" />
          Requirements
          <Badge v-if="requirements.length > 0" variant="secondary" class="ml-1.5 h-4 px-1 text-[10px]">
            {{ requirements.length }}
          </Badge>
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-8 border-purple-300 text-purple-700 hover:bg-purple-50 hover:text-purple-800 dark:border-purple-700 dark:text-purple-300"
          :disabled="!localJourney.name.trim()"
          @click="buildAIOpen = true"
        >
          <Icon name="i-lucide-sparkles" class="mr-1.5 h-3.5 w-3.5" />
          Build with AI
        </Button>
        <Button variant="outline" size="sm" class="h-8" @click="saveTemplateOpen = true">
          <Icon name="i-lucide-layout-template" class="mr-1.5 h-3.5 w-3.5" />
          Save as Template
        </Button>
        <div class="mx-1 flex items-center gap-2">
          <Switch :model-value="isActive" @update:model-value="isActive = $event" />
          <span class="hidden text-sm text-muted-foreground sm:inline">{{ isActive ? 'Active' : 'Inactive' }}</span>
        </div>
        <Button size="sm" class="h-8" @click="handleSave">
          Save Journey
        </Button>
      </div>
    </header>

    <div v-if="showWhatsAppCoverageWarning" class="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
      <Icon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div class="flex-1 text-sm">
        <p class="font-medium text-amber-800 dark:text-amber-300">
          WhatsApp messages will only send to {{ whatsappCoverage.coveredCount }} of {{ whatsappCoverage.total }} selected listings.
        </p>
        <p class="text-xs text-amber-700/80 dark:text-amber-300/80">
          {{ whatsappCoverage.uncovered.length }} listing{{ whatsappCoverage.uncovered.length === 1 ? '' : 's' }} don't have a WhatsApp account assigned and will be skipped at runtime.
        </p>
      </div>
      <Button as-child variant="outline" size="sm" class="h-7 shrink-0">
        <NuxtLink to="/settings/integrations">
          Review listing assignment
        </NuxtLink>
      </Button>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <div class="flex flex-1 flex-col overflow-y-auto p-4">
        <div class="mx-auto w-full max-w-xl">
          <draggable
            :list="localJourney.steps"
            item-key="id"
            handle=".drag-handle"
            ghost-class="opacity-40"
            animation="150"
            :move="onDragMove"
            @end="onDragEnd"
          >
            <template #item="{ element: step, index }">
              <div>
                <JourneysJourneyStepCard
                  :step="step"
                  :active="selectedStepId === step.id"
                  @select="selectedStepId = step.id"
                  @delete="deleteStep(step.id)"
                />

                <!-- insert zone between steps -->
                <div v-if="index < localJourney.steps.length - 1" class="group/insert relative flex h-7 justify-center">
                  <div class="relative flex w-8 items-center justify-center">
                    <div class="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-border/60" />
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <button
                          class="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background opacity-0 shadow-sm transition-all group-hover/insert:opacity-100 hover:!border-primary hover:!bg-primary hover:!text-primary-foreground"
                          aria-label="Insert step here"
                        >
                          <Icon name="i-lucide-plus" class="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" class="w-52">
                        <template v-for="(opts, group) in addStepGroups" :key="group">
                          <DropdownMenuLabel class="text-xs text-muted-foreground">
                            {{ group }}
                          </DropdownMenuLabel>
                          <DropdownMenuItem v-for="opt in opts" :key="opt.label" @click="addStep(opt.type, index, opt.enable)">
                            <Icon :name="opt.icon" class="mr-2 h-4 w-4" />
                            {{ opt.label }}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </template>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </template>
          </draggable>

          <!-- connecting line before Add Step button -->
          <div class="flex h-6 justify-center">
            <div class="w-[2px] rounded-full bg-border/60" />
          </div>

          <DropdownMenu v-model:open="addStepMenuOpen">
            <DropdownMenuTrigger as-child>
              <Button variant="outline" class="w-full border-dashed text-muted-foreground">
                <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
                Add Step
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-52">
              <template v-for="(opts, group) in addStepGroups" :key="group">
                <DropdownMenuLabel class="text-xs text-muted-foreground">
                  {{ group }}
                </DropdownMenuLabel>
                <DropdownMenuItem v-for="opt in opts" :key="opt.label" @click="addStep(opt.type, undefined, opt.enable)">
                  <Icon :name="opt.icon" class="mr-2 h-4 w-4" />
                  {{ opt.label }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div class="w-80 shrink-0 border-l overflow-y-auto p-4">
        <JourneysJourneyStepSidebar
          :step="selectedStep"
          :journey-name="localJourney.name"
          @update="handleStepUpdate"
        />
      </div>
    </div>

    <JourneysJourneyConditionsModal
      v-model:open="requirementsModalOpen"
      :model-value="requirements"
      :combinator="requirementCombinator"
      title="Journey-Wide Requirements"
      description="Guests must meet ALL of these conditions for the journey to run at all."
      save-label="Save Requirements"
      @save="handleSaveRequirements"
    />

    <JourneysJourneyBuildAIModal
      v-model:open="buildAIOpen"
      @build="handleBuildAI"
    />

    <JourneysJourneySaveTemplateModal
      v-model:open="saveTemplateOpen"
      :default-name="localJourney.name"
      @save="handleSaveTemplate"
    />
  </div>
</template>
