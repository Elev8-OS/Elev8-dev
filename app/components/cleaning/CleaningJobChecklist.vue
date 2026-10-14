<script setup lang="ts">
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import CleaningChecklistGroups from '~/components/cleaning/CleaningChecklistGroups.vue'
import { countCleaningSteps } from '~/components/cleaning/data/cleaning-steps'

/**
 * The checklist a cleaning job carries: the steps its type resolved to on the
 * listing, as copied when the job was created (`CleaningJob.steps`), named by
 * `checklistName` so housekeeping sees "Deep clean" vs "Daily refresh". Read-only here;
 * housekeeping answers it in their app, and the answers come back as the
 * report (`feedback.checklist`, shown by `CleaningReportPanel`).
 */
const props = defineProps<{
  steps: CleaningStepSection[] | undefined
  /** Which checklist the steps came from (`CleaningJob.checklistName`), e.g. "Deep clean". */
  name?: string
}>()

const total = computed(() => countCleaningSteps(props.steps))

/** The steps in the report's shape, unanswered, so both lists look alike. */
const groups = computed(() =>
  (props.steps ?? []).map(section => ({ id: section.id, title: section.title, items: section.steps.map(step => ({ id: step.id, label: step.label, guidanceIds: step.guidanceIds })) })),
)
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="job-checklist">
    <div class="flex items-center justify-between">
      <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon name="lucide:list-checks" class="size-3.5" />
        Checklist
        <Badge v-if="name && total" variant="secondary" class="h-5 text-[10px] font-medium" data-testid="job-checklist-name">
          {{ name }}
        </Badge>
      </p>
      <span v-if="total" class="text-xs text-muted-foreground">{{ total }} {{ total === 1 ? 'step' : 'steps' }}</span>
    </div>
    <CleaningChecklistGroups v-if="total" :groups="groups" />
    <p v-else class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground" data-testid="job-checklist-empty">
      No checklist. This cleaning was created before the listing had cleaning steps.
    </p>
  </div>
</template>
