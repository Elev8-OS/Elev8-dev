<script setup lang="ts">
import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import type { ReservationCleaningSchedule } from '~/components/reservations/data/cleaning-schedule'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { cleaningJobStatusLabels } from '~/components/cleaning/data/cleaning-jobs'
import { listings } from '~/components/listings/data/listings'
import CalendarEventDetailDialog from '~/components/operations-calendar/CalendarEventDetailDialog.vue'
import { cleaningTypeLabels, normalizeCleaningType } from '~/components/operations-calendar/data/operations-calendar'
import {
  formatCleaningScheduleSummary,
  generateCleaningJobsForReservation,
  resolveDefaultCleaningSchedule,
} from '~/components/reservations/data/cleaning-schedule'
import ReservationCleaningJobDialog from '~/components/reservations/ReservationCleaningJobDialog.vue'
import ReservationCleaningScheduleDialog from '~/components/reservations/ReservationCleaningScheduleDialog.vue'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = withDefaults(defineProps<{
  reservation: ReservationEntry
  cleanerOptions: { id: string, name: string }[]
  bare?: boolean
}>(), {
  bare: false,
})

const {
  applyReservationSchedule,
  clearReservationSchedule,
  deleteJob,
  jobs: cleaningJobs,
  updateJob,
} = useCleaningJobs()

const housekeepingJobs = computed(() =>
  cleaningJobs.value
    .filter(j => j.listingId === props.reservation.listingId)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
)

const nextCleaning = computed(() =>
  housekeepingJobs.value.find(j => j.status === 'scheduled')
  ?? housekeepingJobs.value[0]
  ?? null,
)

const listingForReservation = computed(() => {
  return listings.value.find(l => l.id === props.reservation.listingId) ?? null
})

const effectiveCleaningSchedule = computed<ReservationCleaningSchedule | null>(() => {
  if (props.reservation.cleaningSchedule)
    return props.reservation.cleaningSchedule
  const listing = listingForReservation.value
  if (!listing)
    return null
  return resolveDefaultCleaningSchedule(listing.cleaningSchedule, listing.cleaningFeeMode)
})

const isCustomSchedule = computed(() => Boolean(props.reservation.cleaningSchedule))

const activeCleaningScheduleSummary = computed(() => {
  if (!effectiveCleaningSchedule.value)
    return 'No schedule set'
  return formatCleaningScheduleSummary(effectiveCleaningSchedule.value)
})

// Auto-provision cleaning jobs for this reservation if none exist yet
watch(
  () => props.reservation.id,
  () => {
    const r = props.reservation
    if (!r || r.status === 'cancelled' || r.status === 'blocked' || r.status === 'owner_request')
      return
    const hasJobs = cleaningJobs.value.some(j => j.reservationId === r.id)
    if (!hasJobs && effectiveCleaningSchedule.value) {
      const jobInputs = generateCleaningJobsForReservation({
        cleaners: props.cleanerOptions,
        reservation: r,
        schedule: effectiveCleaningSchedule.value,
      })
      applyReservationSchedule(r.id, jobInputs)
    }
  },
  { immediate: true },
)

const cleaningScheduleOpen = ref(false)
const cleaningJobDialogOpen = ref(false)
const selectedJobForEdit = ref<CleaningJob | null>(null)
const detailCleaningOpen = ref(false)
const detailCleaningEvent = ref<CalendarEvent | null>(null)

const { updateReservation } = useReservationsModule()

function clearCleaningSchedule() {
  const r = props.reservation
  clearReservationSchedule(r.id)
  updateReservation(r.id, { cleaningSchedule: undefined })
  if (effectiveCleaningSchedule.value) {
    const jobInputs = generateCleaningJobsForReservation({
      cleaners: props.cleanerOptions,
      reservation: r,
      schedule: effectiveCleaningSchedule.value,
    })
    applyReservationSchedule(r.id, jobInputs)
  }
  toast.success('Reset cleaning schedule to listing default')
}

function removeCleaning(jobId: string) {
  deleteJob(jobId)
  toast.info('Cleaning removed')
}

function updateJobCleaners(jobId: string, cleanerIds: string[]) {
  const newNames = cleanerIds
    .map(id => props.cleanerOptions.find(c => c.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  updateJob(jobId, {
    cleanerIds: [...cleanerIds],
    cleanerNames: newNames,
  })
}

function fmtCleaningDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function cleaningStatusLabel(job: CleaningJob): string {
  return cleaningJobStatusLabels[job.status] ?? job.status
}

function toCleaningCalendarEvent(job: CleaningJob): CalendarEvent {
  const fullListing = listings.value.find(l => l.id === job.listingId)
  const scheduledDate = job.scheduledAt.slice(0, 10)
  const overlappingBooking = fullListing?.bookings.find(b =>
    b.status !== 'cancelled'
    && b.status !== 'inquiry'
    && b.checkIn <= scheduledDate
    && b.checkOut >= scheduledDate,
  )
  const cleaningType = normalizeCleaningType(job.source)
  const guestSuffix = (job.source === 'checkout' || job.source === 'check_out') && overlappingBooking
    ? ` · ${overlappingBooking.guestName}`
    : ''

  return {
    assignedTo: job.cleanerNames ?? [],
    cleaningType,
    cleaningTypeLabel: cleaningTypeLabels[cleaningType],
    end: new Date(new Date(job.scheduledAt).getTime() + (job.durationMinutes || 120) * 60000).toISOString(),
    guestName: overlappingBooking?.guestName ?? props.reservation.guestName,
    hasPet: overlappingBooking?.hasPet ?? props.reservation.hasPet ?? false,
    id: job.id,
    listingId: job.listingId,
    listingName: job.listingName || fullListing?.name || props.reservation.listingName || 'Listing',
    notes: job.notes,
    priority: job.priority,
    source: job.source,
    start: job.scheduledAt,
    status: job.status,
    title: `Cleaning${guestSuffix}`,
    type: 'cleaning',
  }
}

function viewCleaningDetail(job: CleaningJob) {
  detailCleaningEvent.value = toCleaningCalendarEvent(job)
  detailCleaningOpen.value = true
}

function handleCleaningAction(job: CleaningJob) {
  if (job.status === 'done') {
    viewCleaningDetail(job)
  }
  else {
    selectedJobForEdit.value = job
    cleaningJobDialogOpen.value = true
  }
}

function openAddCleaning() {
  selectedJobForEdit.value = null
  cleaningJobDialogOpen.value = true
}
</script>

<template>
  <div class="w-full">
    <Accordion
      type="single"
      collapsible
      :default-value="bare ? 'housekeeping' : undefined"
      class="w-full"
      :class="bare ? 'border-none p-0' : 'border-b px-2'"
    >
      <AccordionItem value="housekeeping" class="border-b-0">
        <AccordionTrigger v-if="!bare" class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
          <span class="flex items-center gap-2">
            <Icon name="lucide:sparkles" class="size-4" />
            Housekeeping
            <Badge v-if="housekeepingJobs.length" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
              {{ housekeepingJobs.length }}
            </Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent :class="bare ? 'p-0 pt-1 space-y-3' : 'px-3 pb-3 space-y-3'">
          <!-- Cleaning schedule configuration card -->
          <div v-if="effectiveCleaningSchedule" class="rounded-lg border bg-muted/20 p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cleaning Schedule
                  </span>
                  <Badge
                    v-if="isCustomSchedule"
                    variant="outline"
                    class="h-4 px-1.5 text-[9px] border-amber-500/30 text-amber-700 bg-amber-500/10 font-normal"
                  >
                    Customized
                  </Badge>
                  <Badge
                    v-else
                    variant="secondary"
                    class="h-4 px-1.5 text-[9px] font-normal"
                  >
                    Listing Default
                  </Badge>
                </div>
                <p class="text-xs font-medium text-foreground">
                  {{ activeCleaningScheduleSummary }}
                </p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  @click.stop="cleaningScheduleOpen = true"
                >
                  <Icon name="lucide:pencil" class="size-3" />
                  {{ isCustomSchedule ? 'Edit' : 'Customize' }}
                </Button>
                <Button
                  v-if="isCustomSchedule"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  title="Reset to listing default"
                  @click.stop="clearCleaningSchedule"
                >
                  <Icon name="lucide:rotate-ccw" class="size-3" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Next cleaning card -->
          <div v-if="!nextCleaning" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
            No upcoming cleaning scheduled.
          </div>

          <div v-else class="rounded-lg border bg-card p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Next cleaning
                </p>
                <p class="mt-0.5 text-sm font-semibold">
                  {{ fmtCleaningDate(nextCleaning.scheduledAt) }}
                </p>
              </div>
              <div class="flex items-center gap-1.5">
                <Badge variant="outline" class="shrink-0 text-[10px]">
                  {{ cleaningStatusLabel(nextCleaning) }}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  :title="nextCleaning.status === 'done' ? 'View cleaning' : 'Edit cleaning'"
                  @click="handleCleaningAction(nextCleaning)"
                >
                  <Icon :name="nextCleaning.status === 'done' ? 'lucide:eye' : 'lucide:pencil'" class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  title="Delete cleaning"
                  @click="removeCleaning(nextCleaning.id)"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" />
                </Button>
              </div>
            </div>
            <div class="mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
              <span class="text-xs text-muted-foreground flex items-center gap-1.5">
                <Icon name="lucide:user" class="size-3.5 text-muted-foreground" />
                Assignees:
              </span>
              <StaffMultiSelectDropdown
                v-if="nextCleaning.status !== 'done'"
                :model-value="nextCleaning.cleanerIds"
                :options="cleanerOptions"
                :show-tags="false"
                title="Assign Cleaners"
                popover-width="w-64"
                @update:model-value="(ids) => updateJobCleaners(nextCleaning!.id, ids)"
              >
                <template #trigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-xs gap-1.5 font-normal border hover:bg-muted max-w-[220px]"
                    :class="nextCleaning.cleanerNames.length ? 'text-foreground bg-muted/40' : 'text-muted-foreground border-dashed'"
                  >
                    <span class="truncate">{{ nextCleaning.cleanerNames.join(', ') || 'Unassigned' }}</span>
                    <Icon name="lucide:chevron-down" class="size-3 shrink-0 text-muted-foreground opacity-70" />
                  </Button>
                </template>
              </StaffMultiSelectDropdown>
              <span
                v-else
                class="h-7 px-2 text-xs inline-flex items-center gap-1.5 font-normal border rounded-md bg-muted/30 text-foreground max-w-[220px]"
              >
                <span class="truncate">{{ nextCleaning.cleanerNames.join(', ') || 'Unassigned' }}</span>
              </span>
            </div>
          </div>

          <!-- All scheduled cleanings -->
          <div v-if="housekeepingJobs.length" class="mt-3 space-y-1.5">
            <div
              v-for="job in housekeepingJobs"
              :key="job.id"
              class="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-2"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">
                  {{ fmtCleaningDate(job.scheduledAt) }}
                </p>
                <div class="mt-1 flex items-center gap-1.5">
                  <StaffMultiSelectDropdown
                    v-if="job.status !== 'done'"
                    :model-value="job.cleanerIds"
                    :options="cleanerOptions"
                    :show-tags="false"
                    title="Assign Cleaners"
                    popover-width="w-64"
                    @update:model-value="(ids) => updateJobCleaners(job.id, ids)"
                  >
                    <template #trigger>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors border hover:bg-muted cursor-pointer max-w-[200px]"
                        :class="job.cleanerNames.length ? 'bg-background text-foreground font-medium' : 'text-muted-foreground border-dashed hover:text-foreground'"
                        title="Change cleaners"
                      >
                        <Icon name="lucide:user" class="size-2.5 shrink-0 text-muted-foreground" />
                        <span class="truncate">{{ job.cleanerNames.join(', ') || 'Unassigned' }}</span>
                        <Icon name="lucide:chevron-down" class="size-2 shrink-0 text-muted-foreground opacity-60" />
                      </button>
                    </template>
                  </StaffMultiSelectDropdown>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border bg-muted/30 text-foreground max-w-[200px]"
                  >
                    <Icon name="lucide:user" class="size-2.5 shrink-0 text-muted-foreground" />
                    <span class="truncate">{{ job.cleanerNames.join(', ') || 'Unassigned' }}</span>
                  </span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <Badge variant="outline" class="text-[9px]">
                  {{ cleaningStatusLabel(job) }}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  :title="job.status === 'done' ? 'View cleaning' : 'Edit cleaning'"
                  @click="handleCleaningAction(job)"
                >
                  <Icon :name="job.status === 'done' ? 'lucide:eye' : 'lucide:pencil'" class="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-6 w-6 p-0 hover:text-destructive"
                  title="Delete cleaning"
                  @click="removeCleaning(job.id)"
                >
                  <Icon name="lucide:trash-2" class="size-3" />
                </Button>
              </div>
            </div>
          </div>

          <div class="mt-3">
            <Button
              variant="outline"
              size="sm"
              class="w-full gap-1.5 text-xs"
              @click="openAddCleaning"
            >
              <Icon name="lucide:plus" class="size-3.5" />
              Add cleaning
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <!-- Dialogs -->
    <ReservationCleaningScheduleDialog
      :open="cleaningScheduleOpen"
      :reservation="reservation"
      :cleaner-options="cleanerOptions"
      @update:open="cleaningScheduleOpen = $event"
    />

    <ReservationCleaningJobDialog
      :open="cleaningJobDialogOpen"
      :reservation="reservation"
      :job="selectedJobForEdit"
      :cleaner-options="cleanerOptions"
      @update:open="cleaningJobDialogOpen = $event"
    />

    <CalendarEventDetailDialog
      :open="detailCleaningOpen"
      :event="detailCleaningEvent"
      @update:open="detailCleaningOpen = $event"
      @deleted="detailCleaningOpen = false"
    />
  </div>
</template>
