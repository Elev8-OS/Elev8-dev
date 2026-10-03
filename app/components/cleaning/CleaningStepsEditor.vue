<script setup lang="ts">
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { VueDraggable } from 'vue-draggable-plus'
import CleaningStepGuidancePicker from '~/components/cleaning/CleaningStepGuidancePicker.vue'
import { newCleaningStepId } from '~/components/cleaning/data/cleaning-steps'

/**
 * Edits a list of cleaning step sections in place (`v-model`). One editor for
 * every place steps are written, a listing's steps and a tenant template, so
 * they behave the same: sections are an accordion, reorder by drag handle (or
 * the arrow keys on it), and any section that appears (added, imported, a
 * template applied) opens on its own.
 *
 * Slots: `toolbar` (left of Expand/Collapse all) and `empty` (actions shown
 * while there are no sections, beside Add section).
 */
const sections = defineModel<CleaningStepSection[]>({ required: true })

const openSections = ref<Set<string>>(new Set(sections.value.map(s => s.id)))
let knownIds = new Set(sections.value.map(s => s.id))

watch(() => sections.value.map(s => s.id), (ids) => {
  const fresh = ids.filter(id => !knownIds.has(id))
  knownIds = new Set(ids)
  if (fresh.length)
    openSections.value = new Set([...openSections.value, ...fresh])
})

const allOpen = computed(() => sections.value.length > 0 && sections.value.every(s => openSections.value.has(s.id)))

function toggleSection(id: string) {
  const next = new Set(openSections.value)
  if (next.has(id))
    next.delete(id)
  else next.add(id)
  openSections.value = next
}

function toggleAll() {
  openSections.value = allOpen.value ? new Set() : new Set(sections.value.map(s => s.id))
}

function namedSteps(section: CleaningStepSection) {
  return section.steps.filter(st => st.label.trim()).length
}

function addSection() {
  sections.value = [...sections.value, { id: newCleaningStepId('sec'), title: '', steps: [{ id: newCleaningStepId('step'), label: '' }] }]
}

function removeSection(sectionId: string) {
  sections.value = sections.value.filter(s => s.id !== sectionId)
}

function moveSection(index: number, delta: -1 | 1) {
  if (index + delta < 0 || index + delta >= sections.value.length)
    return
  const next = [...sections.value]
  const [moved] = next.splice(index, 1)
  next.splice(index + delta, 0, moved!)
  sections.value = next
}

function updateSection(sectionId: string, patch: Partial<CleaningStepSection>) {
  sections.value = sections.value.map(s => s.id === sectionId ? { ...s, ...patch } : s)
}

function addStep(section: CleaningStepSection) {
  updateSection(section.id, { steps: [...section.steps, { id: newCleaningStepId('step'), label: '' }] })
}

function updateStep(section: CleaningStepSection, stepId: string, label: string) {
  updateSection(section.id, { steps: section.steps.map(st => st.id === stepId ? { ...st, label } : st) })
}

function removeStep(section: CleaningStepSection, stepId: string) {
  updateSection(section.id, { steps: section.steps.filter(st => st.id !== stepId) })
}

function setStepGuidance(section: CleaningStepSection, stepId: string, guidanceIds: string[]) {
  updateSection(section.id, { steps: section.steps.map(st => st.id === stepId ? { ...st, guidanceIds } : st) })
}

function moveStep(section: CleaningStepSection, index: number, delta: -1 | 1) {
  const steps = [...section.steps]
  const [moved] = steps.splice(index, 1)
  steps.splice(index + delta, 0, moved!)
  updateSection(section.id, { steps })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="sections.length === 0"
      class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center"
      data-testid="steps-empty"
    >
      <Icon name="lucide:list-checks" class="size-8 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">
        No steps yet. Start from a template and adjust it, or build your own.
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <slot name="empty" />
        <Button size="sm" variant="outline" @click="addSection">
          <Icon name="lucide:plus" class="size-3.5" />
          Add section
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap gap-2">
        <slot name="toolbar" />
      </div>
      <Button v-if="sections.length" variant="ghost" size="sm" class="h-7 gap-1 px-2 text-xs" data-testid="steps-toggle-all" @click="toggleAll">
        <Icon :name="allOpen ? 'lucide:chevrons-down-up' : 'lucide:chevrons-up-down'" class="size-3.5" />
        {{ allOpen ? 'Collapse all' : 'Expand all' }}
      </Button>
    </div>

    <VueDraggable
      v-model="sections"
      handle=".section-drag-handle"
      :animation="150"
      ghost-class="opacity-40"
      class="flex flex-col gap-4"
    >
      <div
        v-for="(section, sIndex) in sections"
        :key="section.id"
        class="overflow-hidden rounded-lg border bg-muted/20"
        data-testid="steps-section"
        :data-open="openSections.has(section.id) || undefined"
      >
        <div class="flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            class="section-drag-handle flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
            :aria-label="`Reorder section ${sIndex + 1}: drag, or use the arrow keys`"
            data-testid="steps-section-handle"
            @keydown.up.prevent="moveSection(sIndex, -1)"
            @keydown.down.prevent="moveSection(sIndex, 1)"
          >
            <Icon name="lucide:grip-vertical" class="size-4" />
          </button>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            :aria-label="openSections.has(section.id) ? 'Collapse section' : 'Expand section'"
            :aria-expanded="openSections.has(section.id)"
            data-testid="steps-section-toggle"
            @click="toggleSection(section.id)"
          >
            <Icon :name="openSections.has(section.id) ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="size-4 text-muted-foreground" />
          </Button>
          <Input
            :model-value="section.title"
            placeholder="Section, e.g. Kitchen"
            class="h-8 flex-1 bg-background text-sm font-semibold"
            :aria-label="`Section ${sIndex + 1} title`"
            @update:model-value="updateSection(section.id, { title: String($event) })"
          />
          <span class="shrink-0 px-1 text-xs text-muted-foreground" data-testid="steps-section-count">
            {{ namedSteps(section) }} {{ namedSteps(section) === 1 ? 'step' : 'steps' }}
          </span>
          <Button variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive" aria-label="Delete section" @click="removeSection(section.id)">
            <Icon name="lucide:trash-2" class="size-3.5" />
          </Button>
        </div>

        <div v-if="openSections.has(section.id)" class="flex flex-col gap-1.5 border-t bg-background p-3" data-testid="steps-section-body">
          <div v-for="(step, i) in section.steps" :key="step.id" class="flex flex-col gap-1">
            <div class="flex items-center gap-1">
              <span class="w-5 shrink-0 text-right text-xs text-muted-foreground">{{ i + 1 }}.</span>
              <Input
                :model-value="step.label"
                placeholder="Describe the step"
                class="h-8 flex-1 text-xs"
                :aria-label="`Step ${i + 1}`"
                data-testid="steps-step-input"
                @update:model-value="updateStep(section, step.id, String($event))"
              />
              <CleaningStepGuidancePicker
                :model-value="step.guidanceIds ?? []"
                :step-label="step.label"
                @update:model-value="setStepGuidance(section, step.id, $event)"
              />
              <Button variant="ghost" size="icon" class="size-7" :disabled="i === 0" aria-label="Move step up" @click="moveStep(section, i, -1)">
                <Icon name="lucide:arrow-up" class="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" class="size-7" :disabled="i === section.steps.length - 1" aria-label="Move step down" @click="moveStep(section, i, 1)">
                <Icon name="lucide:arrow-down" class="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" aria-label="Delete step" @click="removeStep(section, step.id)">
                <Icon name="lucide:x" class="size-3.5" />
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="sm" class="h-7 w-fit gap-1 px-2 text-xs" @click="addStep(section)">
            <Icon name="lucide:plus" class="size-3" />
            Add step
          </Button>
        </div>
      </div>
    </VueDraggable>

    <Button v-if="sections.length" variant="outline" size="sm" class="w-fit gap-1.5" @click="addSection">
      <Icon name="lucide:plus" class="size-3.5" />
      Add section
    </Button>
  </div>
</template>
