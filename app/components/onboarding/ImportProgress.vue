<script setup lang="ts">
import { IMPORT_JOB_LABELS, providerName } from '~/components/onboarding/data/onboarding'

defineEmits<{ (e: 'background'): void, (e: 'done'): void }>()

const { state, importJobs, isImporting, importFailedCount } = useOnboarding()

const source = computed(() => (state.value.connection ? providerName(state.value.connection.provider) : 'your system'))

/** Staged, never one anonymous spinner (PRD 10). */
function jobPercent(processed: number, total: number): number {
  return total === 0 ? 0 : Math.round((processed / total) * 100)
}

const statusLabel: Record<string, string> = {
  queued: 'Waiting',
  running: 'Importing',
  partial: 'Finished with issues',
  success: 'Done',
  failed: 'Failed',
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-base font-semibold tracking-tight text-foreground">
        Importing from {{ source }}
      </h3>
      <p class="text-xs text-muted-foreground mt-0.5">
        Listings come first because reservations need them. You do not have to wait here,
        the import keeps running if you leave.
      </p>
    </div>

    <ol class="flex flex-col gap-3">
      <li
        v-for="job in importJobs"
        :key="job.type"
        class="rounded-xl border border-border/80 bg-card p-4 shadow-xs"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <Icon
              v-if="job.status === 'running'"
              name="lucide:loader-2"
              class="size-4 shrink-0 animate-spin text-primary"
            />
            <Icon
              v-else-if="job.status === 'success'"
              name="lucide:circle-check"
              class="size-4 shrink-0 text-green-600"
            />
            <Icon
              v-else-if="job.status === 'partial'"
              name="lucide:triangle-alert"
              class="size-4 shrink-0 text-amber-600"
            />
            <Icon
              v-else-if="job.status === 'failed'"
              name="lucide:circle-x"
              class="size-4 shrink-0 text-destructive"
            />
            <Icon v-else name="lucide:clock" class="size-4 shrink-0 text-muted-foreground" />
            <p class="text-sm font-medium">
              {{ IMPORT_JOB_LABELS[job.type] }}
            </p>
          </div>
          <p class="text-xs tabular-nums text-muted-foreground">
            {{ job.processedCount }} of {{ job.totalCount }} · {{ statusLabel[job.status] }}
          </p>
        </div>
        <Progress :model-value="jobPercent(job.processedCount, job.totalCount)" class="mt-3 h-1.5" />
        <p v-if="job.failedItems.length > 0" class="mt-2 text-xs text-amber-700">
          {{ job.failedItems.length }} item{{ job.failedItems.length === 1 ? '' : 's' }} could not be imported.
          You can retry {{ job.failedItems.length === 1 ? 'it' : 'them' }} from Settings.
        </p>
      </li>
    </ol>

    <div class="border-t pt-4">
      <p v-if="importFailedCount > 0" class="text-xs text-amber-700">
        {{ importFailedCount }} item{{ importFailedCount === 1 ? '' : 's' }} need attention.
      </p>
      <p v-else class="text-xs text-muted-foreground">
        {{ isImporting ? 'This can take a while on a large account.' : 'Import finished.' }}
      </p>
    </div>
  </div>
</template>
