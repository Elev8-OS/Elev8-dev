<script setup lang="ts">
import type { CleaningJobPriority, CleaningJobStatus } from '~/components/cleaning/data/cleaning-jobs'
import { toast } from 'vue-sonner'
import CleaningCalendarBoard from '~/components/cleaning/CleaningCalendarBoard.vue'
import CleaningFilters from '~/components/cleaning/CleaningFilters.vue'
import CleaningJobForm from '~/components/cleaning/CleaningJobForm.vue'
import { useCleaningJobs } from '~/composables/useCleaningJobs'

const { jobs, jobsForFilters, createJob, updateJob, resolveCleanerNames, resolveListingName } = useCleaningJobs()

const view = ref<'week' | 'agenda'>('week')
const weekAnchor = ref(new Date())
const createOpen = ref(false)
const editOpen = ref(false)
const editingId = ref<string | null>(null)
const selectedListingIds = ref<string[]>([])
const selectedCleanerIds = ref<string[]>([])
const selectedStatuses = ref<CleaningJobStatus[]>([])
const selectedPriorities = ref<CleaningJobPriority[]>([])

const filteredJobs = computed(() => jobsForFilters({
  listingIds: selectedListingIds.value,
  cleanerIds: selectedCleanerIds.value,
  statuses: selectedStatuses.value,
  priorities: selectedPriorities.value,
}))

const editingJob = computed(() => jobs.value.find(job => job.id === editingId.value) ?? null)

function handleCreate(input: Parameters<typeof createJob>[0]) {
  createJob({
    ...input,
    cleanerNames: resolveCleanerNames(input.cleanerIds ?? []),
    listingName: input.listingId ? resolveListingName(input.listingId) : input.listingName,
  })
  createOpen.value = false
  toast.success('Cleaning job created')
}

function handleUpdate(input: Parameters<typeof createJob>[0]) {
  if (!editingJob.value)
    return
  updateJob(editingJob.value.id, {
    ...input,
    cleanerNames: resolveCleanerNames(input.cleanerIds ?? []),
    listingName: input.listingId ? resolveListingName(input.listingId) : input.listingName,
  })
  editOpen.value = false
  editingId.value = null
  toast.success('Cleaning job updated')
}

function handleMove(payload: { id: string, listingId: string, scheduledAt: string }) {
  const job = jobs.value.find(item => item.id === payload.id)
  if (!job)
    return
  updateJob(job.id, {
    listingId: payload.listingId,
    listingName: resolveListingName(payload.listingId),
    scheduledAt: payload.scheduledAt,
  })
  toast.success('Cleaning job moved')
}

function clearFilters() {
  selectedListingIds.value = []
  selectedCleanerIds.value = []
  selectedStatuses.value = []
  selectedPriorities.value = []
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Cleaning Calendar
        </h2>
        <p class="text-muted-foreground">
          Dedicated multi-listing scheduler for housekeeping operations.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Tabs v-model="view">
          <TabsList>
            <TabsTrigger value="week">
              Week
            </TabsTrigger>
            <TabsTrigger value="agenda">
              Agenda
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button @click="createOpen = true">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          New Cleaning
        </Button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <CleaningFilters
        :listing-ids="selectedListingIds"
        :cleaner-ids="selectedCleanerIds"
        :statuses="selectedStatuses"
        :priorities="selectedPriorities"
        @update:listing-ids="selectedListingIds = $event"
        @update:cleaner-ids="selectedCleanerIds = $event"
        @update:statuses="selectedStatuses = $event"
        @update:priorities="selectedPriorities = $event"
        @clear="clearFilters"
      />
    </div>

    <CleaningCalendarBoard
      :jobs="filteredJobs"
      :week-anchor="weekAnchor"
      :mode="view"
      @edit="id => { editingId = id; editOpen = true }"
      @create="createOpen = true"
      @move="handleMove"
    />

    <Dialog v-model:open="createOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Cleaning Job</DialogTitle>
          <DialogDescription>Create or schedule a manual cleaning job.</DialogDescription>
        </DialogHeader>
        <CleaningJobForm @cancel="createOpen = false" @save="handleCreate" />
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="editOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Cleaning Job</DialogTitle>
          <DialogDescription>Update schedule, assignment, and priority.</DialogDescription>
        </DialogHeader>
        <CleaningJobForm v-if="editingJob" :model-value="editingJob" @cancel="editOpen = false; editingId = null" @save="handleUpdate" />
      </DialogContent>
    </Dialog>
  </div>
</template>
