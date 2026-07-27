<script setup lang="ts">
import type { Journey, MarketplaceTemplate } from '~/components/journeys/data/journeys'
import { toast } from 'vue-sonner'
import { buildModifiedJourney } from '~/components/journeys/data/journeys'

definePageMeta({ layout: 'default' })

type ViewState = 'list' | 'marketplace' | 'builder-prompt' | 'builder-generating' | 'builder-review' | 'editor'

const { saveJourney } = useJourneys()

const currentView = ref<ViewState>('list')
const builderPrompt = ref('')
const generatedJourney = ref<Journey | null>(null)
const editingJourney = ref<Journey | null>(null)
const builderSourceJourney = ref<Journey | null>(null)

function goTo(view: ViewState) {
  currentView.value = view
}

function handleGenerate(prompt: string) {
  builderPrompt.value = prompt
  goTo('builder-generating')
}

function handleGeneratedDone(journey: Journey) {
  generatedJourney.value = journey
  goTo('builder-review')
}

function handleUseJourney(journey: Journey & { aiReasoning?: string, stats?: { messages: number, contextChecks: number, estimatedTime: string } }) {
  if (builderSourceJourney.value) {
    // Modify mode: keep id/name/status/properties/requirements/trigger as-is.
    // The helper attached aiReasoning/stats for the Review panel only; strip them
    // before assigning to the strictly-typed `editingJourney` ref.
    const { aiReasoning: _aiReasoning, stats: _stats, ...rest } = journey
    editingJourney.value = rest
  }
  else {
    // New mode (unchanged).
    editingJourney.value = { ...journey, id: `j-${Date.now()}`, status: 'draft' } as unknown as Journey
  }
  builderSourceJourney.value = null
  goTo('editor')
}

function handleInstallTemplate(template: MarketplaceTemplate) {
  const trigStep = template.steps[0]?.type === 'trigger' ? (template.steps[0] as any) : null
  editingJourney.value = {
    id: `j-${Date.now()}`,
    name: template.name,
    status: 'draft',
    triggerType: trigStep?.triggers?.[0]?.type ?? 'new_booking',
    lastModified: new Date().toISOString().split('T')[0],
    properties: ['All Properties'],
    steps: template.steps.map(s => ({ ...s, id: `s-${Date.now()}-${Math.random().toString(36).slice(2)}` })),
  }
  goTo('editor')
}

function handleNewJourneyScratch() {
  editingJourney.value = null
  goTo('editor')
}

function handleEditJourney(journey: Journey) {
  editingJourney.value = journey
  goTo('editor')
}

function handleSaveJourney(journey: Journey) {
  saveJourney(journey)
  toast.success('Journey saved')
  editingJourney.value = null
  goTo('list')
}

function handleEditorBuildAI(prompt: string, journey: Journey) {
  builderPrompt.value = prompt
  builderSourceJourney.value = JSON.parse(JSON.stringify(journey))
  generatedJourney.value = null
  goTo('builder-generating')
}

function handleSaveTemplate(journey: Journey) {
  toast.success(`"${journey.name}" saved as template`)
}

function handleEditorBack() {
  editingJourney.value = null
  builderSourceJourney.value = null
  goTo('list')
}

function handleReviewBack() {
  if (builderSourceJourney.value) {
    // Modify mode: revert to the unmodified snapshot, return to editor.
    editingJourney.value = JSON.parse(JSON.stringify(builderSourceJourney.value))
    builderSourceJourney.value = null
    goTo('editor')
  }
  else {
    goTo('builder-prompt')
  }
}

function handleRefine(prompt: string) {
  // Refine the journey currently on screen — anchored to what's displayed, not
  // the original source. (Regenerate stays anchored to the source journey.)
  if (!generatedJourney.value)
    return
  const before = generatedJourney.value.steps.length
  const refined = buildModifiedJourney(generatedJourney.value as Journey, prompt)
  generatedJourney.value = refined as unknown as Journey
  const added = refined.steps.length - before
  if (added > 0) {
    toast.success(`Added ${added} new step${added === 1 ? '' : 's'} — review the changes`)
  }
  else {
    toast.info('No matching pattern in that prompt — try "upsell", "review", or "mid-stay"')
  }
}

function handlePromptBack() {
  // In modify mode, Regenerate → Back lands on the prompt screen.
  // Route the Back to the editor (reverting the snapshot) instead of the list.
  if (builderSourceJourney.value) {
    handleReviewBack()
  }
  else {
    goTo('list')
  }
}

function handleRegenerate() {
  goTo('builder-prompt')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Tabs shown when browsing lists -->
    <div
      v-if="currentView === 'list'"
      class="flex items-center gap-1 border-b bg-background px-6 pt-4"
    >
      <button
        class="relative px-3 py-2 text-sm font-medium transition-colors"
        :class="currentView === 'list' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="goTo('list')"
      >
        Journeys
        <span
          v-if="currentView === 'list'"
          class="absolute inset-x-3 -bottom-px h-0.5 bg-primary"
        />
      </button>
    </div>

    <Transition name="fade" mode="out-in">
      <JourneysJourneyList
        v-if="currentView === 'list'"
        @new-journey="goTo('builder-prompt')"
        @new-journey-scratch="handleNewJourneyScratch"
        @open-marketplace="goTo('marketplace')"
        @edit-journey="handleEditJourney"
      />
      <JourneysJourneyMarketplace
        v-else-if="currentView === 'marketplace'"
        @install="handleInstallTemplate"
        @back="goTo('list')"
      />
      <JourneysJourneyBuilderPrompt
        v-else-if="currentView === 'builder-prompt'"
        @generate="handleGenerate"
        @use-template="handleInstallTemplate"
        @back="handlePromptBack"
      />
      <JourneysJourneyBuilderGenerating
        v-else-if="currentView === 'builder-generating'"
        :prompt="builderPrompt"
        :existing-journey="builderSourceJourney"
        @done="handleGeneratedDone"
      />
      <JourneysJourneyBuilderReview
        v-else-if="currentView === 'builder-review'"
        :journey="(generatedJourney as any)"
        :mode="builderSourceJourney ? 'modify' : 'new'"
        :source-journey-name="builderSourceJourney?.name"
        @use-journey="handleUseJourney"
        @regenerate="handleRegenerate"
        @back="handleReviewBack"
        @refine="handleRefine"
      />
      <JourneysJourneyEditor
        v-else-if="currentView === 'editor'"
        :initial-journey="editingJourney"
        @save="handleSaveJourney"
        @back="handleEditorBack"
        @build-with-ai="handleEditorBuildAI"
        @save-template="handleSaveTemplate"
      />
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
