<script setup lang="ts">
import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import {
  cleaningJobPriorityLabels,
  cleaningJobSourceLabels,
  cleaningJobStatusLabels,
  formatDateKey,
  formatTime,
  formatWeekRange,
  getListingColorIndex,
  getListingName,
  getStatusTone,
  getWeekDays,
} from '~/components/cleaning/data/cleaning-jobs'

const props = withDefaults(defineProps<{
  jobs: CleaningJob[]
  weekAnchor: Date
  mode: 'week' | 'agenda' | 'day'
}>(), {
  mode: 'week',
})

const emit = defineEmits<{
  edit: [id: string]
  create: [listingId?: string, scheduledAt?: string]
  move: [payload: { id: string, listingId: string, scheduledAt: string }]
}>()

const draggedJob = ref<CleaningJob | null>(null)

const weekDays = computed(() => getWeekDays(props.weekAnchor))
const weekRangeLabel = computed(() => formatWeekRange(weekDays.value))

const listings = computed(() => {
  const ids = [...new Set(props.jobs.map(job => job.listingId))]
  return ids.map(listingId => ({
    listingId,
    listingName: getListingName(listingId),
    colorIndex: getListingColorIndex(listingId),
    jobs: props.jobs.filter(job => job.listingId === listingId),
  }))
})

const agendaJobs = computed(() => [...props.jobs].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()))

const jobsByListingAndDay = computed(() => {
  const map = new Map<string, Map<string, CleaningJob[]>>()
  for (const job of props.jobs) {
    const listingBucket = map.get(job.listingId) ?? new Map<string, CleaningJob[]>()
    const dayKey = formatDateKey(job.scheduledAt)
    const dayBucket = listingBucket.get(dayKey) ?? []
    dayBucket.push(job)
    listingBucket.set(dayKey, dayBucket)
    map.set(job.listingId, listingBucket)
  }
  return map
})

function jobsForCell(listingId: string, dayKey: string) {
  return jobsByListingAndDay.value.get(listingId)?.get(dayKey) ?? []
}

function dropJob(listingId: string, dayKey: string) {
  if (!draggedJob.value)
    return
  const [hours, minutes] = draggedJob.value.scheduledAt.slice(11, 16).split(':')
  emit('move', {
    id: draggedJob.value.id,
    listingId,
    scheduledAt: `${dayKey}T${hours ?? '11'}:${minutes ?? '00'}:00+08:00`,
  })
  draggedJob.value = null
}
</script>

<template>
  <div class="rounded-2xl border bg-background shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {{ mode === 'agenda' ? 'Agenda view' : mode === 'day' ? 'Day view' : 'Weekly listing scheduler' }}
        </p>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ weekRangeLabel }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span class="flex items-center gap-1.5 rounded-full border px-3 py-1.5"><span class="size-2 rounded-full bg-primary" />Scheduled</span>
        <span class="flex items-center gap-1.5 rounded-full border px-3 py-1.5"><span class="size-2 rounded-full bg-amber-500" />Checkout</span>
        <span class="flex items-center gap-1.5 rounded-full border px-3 py-1.5"><span class="size-2 rounded-full bg-muted-foreground" />Manual</span>
      </div>
    </div>

    <div v-if="mode === 'agenda'" class="divide-y">
      <div v-for="job in agendaJobs" :key="job.id" class="flex items-start justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold">
            {{ formatTime(job.scheduledAt) }} · {{ job.listingName }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ job.cleanerNames?.length ? job.cleanerNames.join(', ') : 'Unassigned' }} · {{ job.teamName || 'Housekeeping' }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <Badge :variant="getStatusTone(job.status)" class="text-[10px]">
            {{ cleaningJobStatusLabels[job.status] }}
          </Badge>
          <Badge variant="outline" class="text-[10px]">
            {{ cleaningJobPriorityLabels[job.priority] }}
          </Badge>
          <Button variant="ghost" size="icon" class="size-7 shrink-0" @click="emit('edit', job.id)">
            <Icon name="lucide:pen-line" class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <div v-else class="overflow-auto">
      <div class="grid min-w-[1280px] grid-cols-[220px_repeat(7,minmax(160px,1fr))]">
        <div class="sticky left-0 z-20 border-b bg-background px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Listing
        </div>
        <div v-for="day in weekDays" :key="day.key" class="border-b border-l bg-background px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {{ day.label.slice(0, 3) }}
          </p>
          <p class="mt-1 text-sm font-semibold">
            {{ day.key.slice(8, 10) }}
          </p>
        </div>

        <template v-for="listing in listings" :key="listing.listingId">
          <div class="sticky left-0 z-10 border-t border-r bg-muted/30 px-4 py-4">
            <div class="flex items-start gap-3">
              <span class="mt-1 size-2.5 rounded-full" :class="[['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-slate-500'][listing.colorIndex]]" />
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">
                  {{ listing.listingName }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ listing.jobs.length }} jobs
                </p>
              </div>
            </div>
          </div>

          <div
            v-for="day in weekDays"
            :key="`${listing.listingId}-${day.key}`"
            class="min-h-[132px] border-t border-l bg-background/70 p-2"
            @dragover.prevent
            @drop.prevent="dropJob(listing.listingId, day.key)"
          >
            <div class="flex h-full flex-col gap-2 rounded-xl border border-dashed border-transparent transition-colors hover:border-border hover:bg-muted/30">
              <button type="button" class="flex h-7 items-center justify-between rounded-lg px-2 text-left text-xs text-muted-foreground hover:bg-background" @click="emit('create', listing.listingId, day.key)">
                <span>{{ jobsForCell(listing.listingId, day.key).length }} jobs</span>
                <Icon name="lucide:plus" class="size-3.5" />
              </button>

              <div v-for="job in jobsForCell(listing.listingId, day.key)" :key="job.id" class="rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md" draggable="true" @dragstart="draggedJob = job">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 space-y-1">
                    <div class="flex items-center gap-1.5">
                      <span class="size-2 rounded-full" :class="[job.source === 'checkout' ? 'bg-amber-500' : 'bg-slate-500']" />
                      <p class="truncate text-sm font-semibold leading-tight">
                        {{ formatTime(job.scheduledAt) }}
                      </p>
                    </div>
                    <p class="truncate text-xs text-muted-foreground">
                      {{ job.cleanerNames?.length ? job.cleanerNames.join(', ') : 'Unassigned' }} · {{ job.teamName || 'Housekeeping' }}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" class="size-7 shrink-0" @click="emit('edit', job.id)">
                    <Icon name="lucide:pen-line" class="size-3.5" />
                  </Button>
                </div>

                <p class="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                  {{ job.notes }}
                </p>

                <div class="mt-2 flex flex-wrap gap-1.5">
                  <Badge :variant="getStatusTone(job.status)" class="text-[10px]">
                    {{ cleaningJobStatusLabels[job.status] }}
                  </Badge>
                  <Badge variant="outline" class="text-[10px]">
                    {{ cleaningJobPriorityLabels[job.priority] }}
                  </Badge>
                  <Badge v-if="job.source === 'checkout'" variant="secondary" class="text-[10px]">
                    {{ cleaningJobSourceLabels[job.source] }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
