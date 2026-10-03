<script setup lang="ts">
import type { Booking } from '~/components/listings/data/listings'
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { NuxtLink } from '#components'
import { toast } from 'vue-sonner'
import DatePicker from '~/components/base/DatePicker.vue'
import TimePicker from '~/components/base/TimePicker.vue'
import CleaningJobChecklist from '~/components/cleaning/CleaningJobChecklist.vue'
import { cleanerOptions, cleaningDisplayStatus, cleaningDisplayStatusMeta, cleaningJobPriorityLabels } from '~/components/cleaning/data/cleaning-jobs'
import { bookingStatusMeta, listings } from '~/components/listings/data/listings'
import CleaningReportPanel from '~/components/operations-calendar/CleaningReportPanel.vue'
import { mergedBookingsFor } from '~/components/operations-calendar/data/calendar-stays'
import { cleaningTypeIcons, cleaningTypeVariants, getDefaultCheckOutTime } from '~/components/operations-calendar/data/operations-calendar'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { TASK_STATUS_LABELS } from '~/components/tasks/data/schema'
import { Label } from '~/components/ui/label'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTaskStore } from '~/composables/useTaskStore'

const props = defineProps<{
  open: boolean
  event: CalendarEvent | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'deleted': [event: CalendarEvent]
}>()

const { jobs: cleaningJobs, updateJob, deleteJob, resolveCleanerNames } = useCleaningJobs()
const { tasks: taskStore, deleteTask } = useTaskStore()
const { reservations } = useReservationsModule()

const cleaningJob = computed(() => {
  if (!props.event || props.event.type !== 'cleaning')
    return null
  return cleaningJobs.value.find(j => j.id === props.event!.id) ?? null
})

const task = computed(() => {
  if (!props.event || props.event.type !== 'task')
    return null
  const taskId = props.event.id.replace(/^task-/, '')
  return taskStore.value.find(t => t.id === taskId) ?? null
})

// Not started / Ongoing / Completed / Missed (see `cleaningDisplayStatus`).
const displayStatus = computed(() => {
  if (!cleaningJob.value)
    return null
  const key = cleaningDisplayStatus(cleaningJob.value.status, cleaningJob.value.scheduledAt)
  return { key, ...cleaningDisplayStatusMeta[key] }
})

const priorityLabel = computed(() => {
  if (!cleaningJob.value)
    return null
  return cleaningJobPriorityLabels[cleaningJob.value.priority]
})

const priorityVariant = computed<'outline' | 'secondary' | 'default' | 'destructive'>(() => {
  if (!cleaningJob.value)
    return 'outline'
  if (cleaningJob.value.priority === 'urgent')
    return 'destructive'
  if (cleaningJob.value.priority === 'high')
    return 'default'
  return 'secondary'
})

// Housekeeping + priority can only be edited while the cleaning is still `scheduled`
// AND the scheduled date is today or in the future. Once the date has passed
// (or the status moved to in_progress / done / missed), the job is locked.
const isEditable = computed(() => {
  if (!cleaningJob.value)
    return false
  if (cleaningJob.value.status !== 'scheduled')
    return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const scheduled = new Date(cleaningJob.value.scheduledAt)
  scheduled.setHours(0, 0, 0, 0)
  return scheduled.getTime() >= today.getTime()
})

// Specific reason the dialog is locked, shown on the lock banner. `tone` is the
// display status, or `locked` for a job that is not started but cannot be edited.
type LockTone = 'ongoing' | 'completed' | 'missed' | 'cancelled' | 'locked'
const lockDescriptions: Record<LockTone, string> = {
  ongoing: 'Cleaning is currently underway',
  completed: 'Cleaning has been completed',
  missed: 'Cleaning was not done',
  cancelled: 'Cleaning was cancelled',
  locked: 'No further changes',
}
const lockReason = computed<{ tone: LockTone, label: string, icon: string, description: string } | null>(() => {
  if (!cleaningJob.value || isEditable.value || !displayStatus.value)
    return null
  const tone: LockTone = displayStatus.value.key === 'not_started' ? 'locked' : displayStatus.value.key
  const label = tone === 'locked' ? 'Locked' : displayStatus.value.label
  const icon = tone === 'locked' ? 'lucide:lock' : displayStatus.value.icon
  return { tone, label, icon, description: lockDescriptions[tone] }
})

// --- Editable state ---
const editingCleanerIds = ref<string[]>([])
const editingPriority = ref<'low' | 'normal' | 'high' | 'urgent'>('normal')
const isSavingPriority = ref(false)

// --- Reschedule state ---
const isRescheduling = ref(false)
const rescheduleDate = ref<string>('')
const rescheduleTime = ref<string>('11:00')
const rescheduleEndTime = ref<string>('13:00')
const isSavingReschedule = ref(false)

// The latest end the time picker offers (its default `endHour`).
const LATEST_END_MINUTES = 22 * 60

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function jobStartTime(scheduledAt: string) {
  return scheduledAt.includes('T') && scheduledAt.length >= 16 ? scheduledAt.slice(11, 16) : '11:00'
}

// A job's end is its start plus `durationMinutes`; there is no stored end time.
function jobEndTime(job: { scheduledAt: string, durationMinutes: number }) {
  return minutesToTime(Math.min(timeToMinutes(jobStartTime(job.scheduledAt)) + job.durationMinutes, 24 * 60 - 1))
}

const todayKey = computed(() => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

function initRescheduleState() {
  if (!cleaningJob.value)
    return
  const dt = cleaningJob.value.scheduledAt
  rescheduleDate.value = dt.slice(0, 10)
  rescheduleTime.value = jobStartTime(dt)
  rescheduleEndTime.value = jobEndTime(cleaningJob.value)
}

// Moving the start keeps the cleaning's length, so the end moves with it.
function onRescheduleStartChange(time: string) {
  const duration = timeToMinutes(rescheduleEndTime.value) - timeToMinutes(rescheduleTime.value)
  rescheduleTime.value = time
  if (duration > 0)
    rescheduleEndTime.value = minutesToTime(Math.min(timeToMinutes(time) + duration, LATEST_END_MINUTES))
}

const rescheduleDurationMinutes = computed(() => timeToMinutes(rescheduleEndTime.value) - timeToMinutes(rescheduleTime.value))
const isRescheduleEndValid = computed(() => rescheduleDurationMinutes.value > 0)

function startReschedule() {
  initRescheduleState()
  isRescheduling.value = true
}

function cancelReschedule() {
  initRescheduleState()
  isRescheduling.value = false
}

const hasRescheduleChanges = computed(() => {
  if (!cleaningJob.value || !rescheduleDate.value)
    return false
  const origDt = cleaningJob.value.scheduledAt
  return rescheduleDate.value !== origDt.slice(0, 10)
    || rescheduleTime.value !== jobStartTime(origDt)
    || rescheduleEndTime.value !== jobEndTime(cleaningJob.value)
})

const canSaveReschedule = computed(() => {
  if (!rescheduleDate.value)
    return false
  if (rescheduleDate.value < todayKey.value)
    return false
  if (!isRescheduleEndValid.value)
    return false
  return hasRescheduleChanges.value
})

const reschedulePreviewText = computed(() => {
  if (!cleaningJob.value || !rescheduleDate.value)
    return ''
  const origDate = formatDate(cleaningJob.value.scheduledAt)
  const origTime = `${jobStartTime(cleaningJob.value.scheduledAt)} – ${jobEndTime(cleaningJob.value)}`
  const newStart = rescheduleTime.value || '11:00'
  const newTime = `${newStart} – ${rescheduleEndTime.value}`
  const newDate = new Date(`${rescheduleDate.value}T${newStart}:00+08:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return `Rescheduling from ${origDate} (${origTime}) → ${newDate} (${newTime})`
})

function saveReschedule() {
  if (!cleaningJob.value || !canSaveReschedule.value)
    return
  isSavingReschedule.value = true
  const time = rescheduleTime.value || '11:00'
  const newScheduledAt = `${rescheduleDate.value}T${time}:00+08:00`
  updateJob(cleaningJob.value.id, {
    scheduledAt: newScheduledAt,
    durationMinutes: rescheduleDurationMinutes.value,
  })
  const formattedDate = new Date(`${rescheduleDate.value}T${time}:00+08:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  toast.success(`Cleaning rescheduled to ${formattedDate}, ${time} – ${rescheduleEndTime.value}`)
  isRescheduling.value = false
  isSavingReschedule.value = false
}

watch(cleaningJob, (job) => {
  if (job) {
    editingCleanerIds.value = [...job.cleanerIds]
    editingPriority.value = job.priority
    initRescheduleState()
  }
}, { immediate: true })

watch(() => props.open, (open) => {
  if (!open) {
    isRescheduling.value = false
  }
})

const editingCleanerNames = computed(() => resolveCleanerNames(editingCleanerIds.value))

function onUpdateCleaners(ids: string[]) {
  editingCleanerIds.value = [...ids]
  if (!cleaningJob.value)
    return
  const names = resolveCleanerNames(ids)
  updateJob(cleaningJob.value.id, {
    cleanerIds: [...ids],
    cleanerNames: names,
  })
  toast.success(names.length
    ? `Assigned ${names.join(', ')}`
    : 'Housekeeping cleared')
}

const hasPriorityChanges = computed(() => {
  if (!cleaningJob.value)
    return false
  return cleaningJob.value.priority !== editingPriority.value
})

function savePriority() {
  if (!cleaningJob.value || !hasPriorityChanges.value)
    return
  isSavingPriority.value = true
  updateJob(cleaningJob.value.id, { priority: editingPriority.value })
  toast.success(`Priority set to ${cleaningJobPriorityLabels[editingPriority.value]}`)
  isSavingPriority.value = false
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function close() {
  emit('update:open', false)
}

function handleDelete() {
  if (!props.event)
    return
  if (props.event.type === 'cleaning' && cleaningJob.value) {
    deleteJob(cleaningJob.value.id)
    toast.success('Cleaning job deleted')
    emit('deleted', props.event)
    close()
    return
  }
  if (props.event.type === 'task' && task.value) {
    deleteTask(task.value.id)
    toast.success('Task deleted')
    emit('deleted', props.event)
    close()
  }
}

const _eventTypeLabel = computed(() => {
  if (!props.event)
    return ''
  switch (props.event.type) {
    case 'cleaning': return 'Cleaning job'
    case 'task': return 'Task'
    case 'guest_stay': return 'Guest stay'
    case 'owner_stay': return 'Owner stay'
    case 'upsell': return 'Upsell'
    default: return 'Event'
  }
})

const cleaningTypeMeta = computed(() => {
  if (!props.event || props.event.type !== 'cleaning' || !props.event.cleaningType)
    return null
  return {
    type: props.event.cleaningType,
    label: props.event.cleaningTypeLabel ?? '',
    icon: cleaningTypeIcons[props.event.cleaningType],
    variant: cleaningTypeVariants[props.event.cleaningType],
  }
})

const hasPet = computed(() => props.event?.type === 'cleaning' && Boolean(props.event.hasPet))

// The stay this cleaning belongs to, from both stay sources (see calendar-stays.ts).
// Only "real" bookings count: an inquiry is not a booking yet, and a block has no guest.
// On a turnover day a check-out cleaning belongs to the departing guest, any other
// cleaning to whoever is in the house that day, then to the guest arriving.
const overlappingBooking = computed<Booking | null>(() => {
  if (!props.event || props.event.type !== 'cleaning')
    return null
  const listing = listings.value.find(l => l.id === props.event!.listingId)
  const eventDay = (cleaningJob.value?.scheduledAt ?? props.event.start).slice(0, 10)
  const stays = mergedBookingsFor(props.event.listingId, listing?.bookings ?? [], reservations.value)
    .filter(b => b.type !== 'block' && b.status !== 'cancelled' && b.status !== 'inquiry')
  const departing = stays.find(b => b.checkOut === eventDay)
  const inHouse = stays.find(b => b.checkIn <= eventDay && b.checkOut > eventDay)
  const arriving = stays.find(b => b.checkIn === eventDay)
  if (props.event.cleaningType === 'check_out')
    return departing ?? inHouse ?? arriving ?? null
  return inHouse ?? departing ?? arriving ?? null
})

const stayStatusMeta = computed(() => {
  const b = overlappingBooking.value
  return b ? bookingStatusMeta[b.status] ?? null : null
})

// Only Reservations-module stays have a detail page to open.
const stayReservationLink = computed(() => {
  const id = overlappingBooking.value?.id
  return id && reservations.value.some(r => r.id === id) ? `/reservations?reservation=${id}` : null
})

function formatStayDay(value: string) {
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const stayInfoLabel = computed(() => {
  const b = overlappingBooking.value
  if (b) {
    return {
      guestName: b.guestName,
      initials: b.guestName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      dateRange: `${formatStayDay(b.checkIn)} → ${formatStayDay(b.checkOut)}`,
      nights: b.nights,
      adults: b.adults ?? 0,
      children: b.children ?? 0,
      infants: b.infants ?? 0,
      pets: b.pets ?? (b.hasPet ? 1 : 0),
      checkOutTime: getDefaultCheckOutTime(props.event!.listingId),
    }
  }
  if (props.event?.guestName) {
    return {
      guestName: props.event.guestName,
      initials: props.event.guestName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      dateRange: '',
      nights: 0,
      adults: 0,
      children: 0,
      infants: 0,
      pets: props.event.hasPet ? 1 : 0,
      checkOutTime: '',
    }
  }
  return null
})

// "Oct 11, 2026 · 10:00 – 15:00" under the sheet title.
const cleaningTimeRange = computed(() => {
  if (!props.event || props.event.type !== 'cleaning')
    return null
  const job = cleaningJob.value
  const start = job?.scheduledAt ?? props.event.start
  const day = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const times = job
    ? `${jobStartTime(job.scheduledAt)} – ${jobEndTime(job)}`
    : `${formatTime(start)} – ${formatTime(props.event.end)}`
  return `${day} · ${times}`
})
</script>

<template>
  <Sheet :open="open" @update:open="$event ? emit('update:open', true) : close()">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
      <SheetHeader class="shrink-0 gap-0 border-b px-5 py-3">
        <SheetTitle class="text-lg leading-tight">
          {{ event?.type === 'cleaning' && event?.cleaningTypeLabel
            ? event.cleaningTypeLabel
            : (event?.title || 'Event details') }}
        </SheetTitle>
        <SheetDescription v-if="event?.listingName" class="mt-0.5 text-sm">
          {{ event.listingName }}
        </SheetDescription>
        <p
          v-if="cleaningTimeRange"
          class="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground"
          data-testid="detail-time-range"
        >
          <Icon name="lucide:clock" class="h-4 w-4" />
          {{ cleaningTimeRange }}
        </p>
      </SheetHeader>

      <ScrollArea class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="event" class="flex flex-col gap-4 p-6">
          <!-- Guest in stay (cleaning only): the booking this cleaning belongs to -->
          <component
            :is="stayReservationLink ? NuxtLink : 'div'"
            v-if="event.type === 'cleaning' && stayInfoLabel"
            :to="stayReservationLink ?? undefined"
            class="flex items-center gap-3 rounded-xl border bg-muted/40 p-4"
            :class="stayReservationLink && 'transition-colors hover:bg-muted/70'"
            data-testid="guest-in-stay"
          >
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-semibold">
              {{ stayInfoLabel.initials }}
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="truncate text-base font-semibold">{{ stayInfoLabel.guestName }}</span>
                <Badge
                  v-if="stayStatusMeta"
                  variant="outline"
                  class="gap-1 rounded-full bg-background text-[11px] font-medium"
                  data-testid="guest-status-badge"
                  :data-booking-status="stayStatusMeta.status"
                >
                  <Icon :name="stayStatusMeta.icon" class="h-3 w-3" />
                  {{ stayStatusMeta.label }}
                </Badge>
              </div>
              <p v-if="stayInfoLabel.dateRange" class="text-sm text-muted-foreground">
                {{ stayInfoLabel.dateRange }} · {{ stayInfoLabel.nights }} {{ stayInfoLabel.nights === 1 ? 'night' : 'nights' }}
              </p>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span v-if="stayInfoLabel.adults" class="flex items-center gap-1.5">
                  <Icon name="lucide:user" class="h-3.5 w-3.5" />
                  <span class="font-semibold text-foreground">{{ stayInfoLabel.adults }}</span>
                  Adult{{ stayInfoLabel.adults === 1 ? '' : 's' }}
                </span>
                <span v-if="stayInfoLabel.children" class="flex items-center gap-1.5">
                  <Icon name="lucide:users-round" class="h-3.5 w-3.5" />
                  <span class="font-semibold text-foreground">{{ stayInfoLabel.children }}</span>
                  Child{{ stayInfoLabel.children === 1 ? '' : 'ren' }}
                </span>
                <span v-if="stayInfoLabel.infants" class="flex items-center gap-1.5">
                  <Icon name="lucide:baby" class="h-3.5 w-3.5" />
                  <span class="font-semibold text-foreground">{{ stayInfoLabel.infants }}</span>
                  Infant{{ stayInfoLabel.infants === 1 ? '' : 's' }}
                </span>
                <span v-if="stayInfoLabel.checkOutTime" class="flex items-center gap-1.5" data-testid="guest-checkout-time">
                  <Icon name="lucide:calendar" class="h-3.5 w-3.5" />
                  Checkout
                  <span class="font-semibold text-foreground">{{ stayInfoLabel.checkOutTime }}</span>
                </span>
              </div>
            </div>
            <div
              class="flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs"
              :class="stayInfoLabel.pets ? 'bg-amber-500/10 font-medium text-amber-700' : 'bg-muted text-muted-foreground'"
              :data-testid="stayInfoLabel.pets ? 'guest-has-pet' : 'guest-no-pet'"
            >
              <Icon name="lucide:paw-print" class="h-3.5 w-3.5" />
              <template v-if="stayInfoLabel.pets">
                {{ stayInfoLabel.pets }} Pet{{ stayInfoLabel.pets === 1 ? '' : 's' }}
              </template>
              <template v-else>
                No pet
              </template>
            </div>
            <Icon
              v-if="stayReservationLink"
              name="lucide:chevron-right"
              class="h-4 w-4 shrink-0 text-muted-foreground"
            />
          </component>

          <!-- Cleaning job details (skipped when done — the report panel below replaces it) -->
          <template v-if="event.type === 'cleaning' && cleaningJob && (cleaningJob.status !== 'done' || !cleaningJob.feedback)">
            <!-- Lock state banner (only when not editable) -->
            <div
              v-if="lockReason"
              class="flex items-start gap-3 rounded-lg border p-3 text-sm"
              :class="{
                'border-emerald-500/40 bg-emerald-500/10 text-emerald-700': lockReason.tone === 'completed',
                'border-amber-500/40 bg-amber-500/10 text-amber-700': lockReason.tone === 'ongoing',
                'border-destructive/40 bg-destructive/10 text-destructive': (lockReason.tone === 'missed' || lockReason.tone === 'cancelled'),
                'border-muted bg-muted/30 text-muted-foreground': lockReason.tone === 'locked',
              }"
              data-testid="detail-lock-banner"
              :data-lock-reason="lockReason.label"
            >
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                :class="{
                  'bg-emerald-500/20': lockReason.tone === 'completed',
                  'bg-amber-500/20': lockReason.tone === 'ongoing',
                  'bg-destructive/20': (lockReason.tone === 'missed' || lockReason.tone === 'cancelled'),
                  'bg-muted-foreground/20': lockReason.tone === 'locked',
                }"
              >
                <Icon
                  :name="lockReason.icon"
                  :class="lockReason.tone === 'ongoing' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'"
                />
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <p
                  class="text-sm font-semibold" :class="{
                    'text-emerald-700 dark:text-emerald-400': lockReason.tone === 'completed',
                    'text-amber-700 dark:text-amber-400': lockReason.tone === 'ongoing',
                    'text-destructive': (lockReason.tone === 'missed' || lockReason.tone === 'cancelled'),
                  }"
                >
                  {{ lockReason.label }}
                  <span v-if="lockReason.tone === 'missed' || lockReason.tone === 'completed'" class="text-xs font-normal text-muted-foreground">
                    · {{ formatDate(cleaningJob.scheduledAt) }}
                  </span>
                </p>
                <p
                  class="text-xs" :class="{
                    'text-emerald-700/80 dark:text-emerald-400/80': lockReason.tone === 'completed',
                    'text-amber-700/80 dark:text-amber-400/80': lockReason.tone === 'ongoing',
                    'text-destructive/80': (lockReason.tone === 'missed' || lockReason.tone === 'cancelled'),
                    'text-muted-foreground': lockReason.tone === 'locked',
                  }"
                >
                  {{ lockReason.description }}
                </p>
              </div>
            </div>

            <div
              class="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm"
              :class="cleaningJob.priority === 'high' ? 'border-destructive/40 bg-destructive/10 ring-1 ring-destructive/30' : 'bg-muted/30'"
            >
              <div class="col-span-2 flex flex-wrap items-center gap-1.5">
                <Badge
                  v-if="cleaningTypeMeta"
                  :variant="cleaningTypeMeta.variant"
                  class="gap-1 text-[10px] font-medium"
                  data-testid="detail-cleaning-type-badge"
                  :data-cleaning-type="cleaningTypeMeta.type"
                >
                  <Icon :name="cleaningTypeMeta.icon" class="h-3 w-3" />
                  {{ cleaningTypeMeta.label }}
                </Badge>
                <Badge
                  v-if="hasPet"
                  variant="outline"
                  class="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] font-medium text-amber-700"
                  data-testid="detail-pet-badge"
                >
                  <Icon name="lucide:paw-print" class="h-3 w-3" />
                  Pet in stay
                </Badge>
                <Badge
                  v-if="!isEditable && lockReason"
                  :variant="lockReason.tone === 'completed' ? 'default' : (lockReason.tone === 'missed' || lockReason.tone === 'cancelled') ? 'destructive' : 'outline'"
                  class="gap-1 text-[10px] font-medium"
                  :class="[
                    lockReason.tone === 'completed' ? 'bg-emerald-500/80 text-white' : '',
                    lockReason.tone === 'ongoing' ? 'bg-amber-500/80 text-white' : '',
                    (lockReason.tone === 'missed' || lockReason.tone === 'cancelled')
                      ? 'bg-destructive/90 text-white'
                      : 'text-muted-foreground',
                  ]"
                  data-testid="detail-locked-badge"
                  :data-lock-reason="lockReason.label"
                  :title="`${lockReason.label} · ${lockReason.description}`"
                >
                  <Icon
                    :name="lockReason.icon"
                    class="h-3 w-3"
                  />
                  {{ lockReason.label }}
                </Badge>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Status
                </p>
                <p
                  v-if="displayStatus"
                  class="flex items-center gap-1.5 font-medium"
                  data-testid="detail-status"
                  :data-display-status="displayStatus.key"
                >
                  <Icon :name="displayStatus.icon" class="h-3.5 w-3.5 text-muted-foreground" />
                  {{ displayStatus.label }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Priority
                </p>
                <!-- Editable priority -->
                <div v-if="isEditable" class="mt-0.5 flex items-center gap-2">
                  <Switch
                    :model-value="editingPriority === 'high'"
                    :disabled="isSavingPriority"
                    data-testid="detail-priority-switch"
                    @update:model-value="(v: boolean) => { editingPriority = v ? 'high' : 'normal'; savePriority() }"
                  />
                  <Badge
                    :variant="editingPriority === 'high' ? 'destructive' : 'secondary'"
                    class="gap-1 text-[10px] font-medium"
                    :class="editingPriority === 'high' ? 'bg-destructive/90 text-white' : ''"
                  >
                    <Icon v-if="editingPriority === 'high'" name="lucide:flag" class="h-3 w-3" />
                    {{ cleaningJobPriorityLabels[editingPriority] }}
                  </Badge>
                  <Icon
                    v-if="isSavingPriority"
                    name="lucide:loader-2"
                    class="h-3.5 w-3.5 animate-spin text-muted-foreground"
                  />
                </div>
                <!-- Read-only priority (locked) -->
                <Badge
                  v-else
                  :variant="priorityVariant"
                  class="mt-0.5 text-[10px]"
                  :class="cleaningJob.priority === 'high' ? 'gap-1 bg-destructive/90 text-white' : ''"
                >
                  <Icon v-if="cleaningJob.priority === 'high'" name="lucide:flag" class="h-3 w-3" />
                  {{ priorityLabel }}
                </Badge>
              </div>
              <div v-if="event.guestName && !stayInfoLabel" class="col-span-2">
                <p class="text-xs text-muted-foreground">
                  Guest in stay
                </p>
                <p class="font-medium">
                  {{ event.guestName }}
                </p>
              </div>
              <div class="col-span-2">
                <p class="text-xs text-muted-foreground">
                  Housekeeping
                </p>
                <!-- Editable housekeeping -->
                <div v-if="isEditable" class="mt-1">
                  <StaffMultiSelectDropdown
                    :model-value="editingCleanerIds"
                    :options="cleanerOptions"
                    :show-tags="false"
                    title="Assign Cleaners"
                    popover-width="w-72"
                    @update:model-value="onUpdateCleaners"
                  >
                    <template #trigger>
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-8 w-full justify-between gap-1.5 px-2.5 text-xs font-normal"
                        :class="!editingCleanerIds.length ? 'text-muted-foreground' : ''"
                        data-testid="detail-housekeeping-trigger"
                      >
                        <span class="flex items-center gap-1.5 truncate">
                          <Icon name="lucide:brush-cleaning" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span v-if="editingCleanerNames.length" class="truncate">
                            {{ editingCleanerNames.join(', ') }}
                          </span>
                          <span v-else>Assign housekeeping</span>
                        </span>
                        <Icon name="lucide:chevrons-up-down" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                    </template>
                  </StaffMultiSelectDropdown>
                </div>
                <!-- Read-only housekeeping (locked) -->
                <div v-else>
                  <p v-if="cleaningJob.cleanerNames.length" class="mt-1 flex flex-wrap gap-1">
                    <Badge v-for="name in cleaningJob.cleanerNames" :key="name" variant="secondary" class="text-[10px]">
                      {{ name }}
                    </Badge>
                  </p>
                  <p v-else class="font-medium text-muted-foreground">
                    Unassigned
                  </p>
                </div>
              </div>

              <!-- Schedule / Reschedule section -->
              <div class="col-span-2 border-t pt-3" data-testid="detail-schedule-section">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Scheduled date & time
                    </p>
                    <p class="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                      <Icon name="lucide:calendar-clock" class="h-4 w-4 text-muted-foreground" />
                      <span>{{ formatDate(cleaningJob.scheduledAt) }}</span>
                      <span class="text-xs text-muted-foreground">{{ jobStartTime(cleaningJob.scheduledAt) }} – {{ jobEndTime(cleaningJob) }}</span>
                    </p>
                  </div>
                  <Button
                    v-if="isEditable && !isRescheduling"
                    variant="outline"
                    size="sm"
                    class="h-8 gap-1.5 text-xs"
                    data-testid="detail-reschedule-btn"
                    @click="startReschedule"
                  >
                    <Icon name="lucide:calendar-clock" class="h-3.5 w-3.5" />
                    Reschedule
                  </Button>
                </div>

                <!-- Reschedule editor panel -->
                <div
                  v-if="isEditable && isRescheduling"
                  class="mt-3 flex flex-col gap-3 rounded-lg border bg-background p-3 shadow-xs"
                  data-testid="reschedule-panel"
                >
                  <div class="flex items-center justify-between border-b pb-2">
                    <p class="text-xs font-semibold flex items-center gap-1.5">
                      <Icon name="lucide:calendar-clock" class="h-3.5 w-3.5 text-primary" />
                      Reschedule cleaning
                    </p>
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-foreground text-xs"
                      @click="cancelReschedule"
                    >
                      <Icon name="lucide:x" class="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs text-muted-foreground">New Date</Label>
                    <DatePicker
                      v-model="rescheduleDate"
                      :min="todayKey"
                      placeholder="Select new date"
                      data-testid="reschedule-date-picker"
                    />
                  </div>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs text-muted-foreground">Start Time</Label>
                      <TimePicker
                        :model-value="rescheduleTime"
                        placeholder="Select time"
                        data-testid="reschedule-time-picker"
                        @update:model-value="onRescheduleStartChange"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs text-muted-foreground">End Time</Label>
                      <TimePicker
                        v-model="rescheduleEndTime"
                        placeholder="Select time"
                        data-testid="reschedule-end-time-picker"
                      />
                    </div>
                  </div>
                  <p
                    v-if="!isRescheduleEndValid"
                    class="text-xs text-destructive"
                    data-testid="reschedule-end-time-error"
                  >
                    End time must be after the start time.
                  </p>

                  <div v-if="reschedulePreviewText" class="text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-1.5">
                    {{ reschedulePreviewText }}
                  </div>

                  <div class="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-7 text-xs"
                      @click="cancelReschedule"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      class="h-7 text-xs"
                      :disabled="!canSaveReschedule || isSavingReschedule"
                      data-testid="reschedule-save-btn"
                      @click="saveReschedule"
                    >
                      <Icon v-if="isSavingReschedule" name="lucide:loader-2" class="mr-1.5 h-3 w-3 animate-spin" />
                      <Icon v-else name="lucide:check" class="mr-1.5 h-3 w-3" />
                      Save Schedule
                    </Button>
                  </div>
                </div>
              </div>
              <div v-if="cleaningJob.notes" class="col-span-2">
                <p class="text-xs text-muted-foreground">
                  Notes
                </p>
                <p class="mt-1 line-clamp-3 text-sm">
                  {{ cleaningJob.notes }}
                </p>
              </div>
            </div>
            <!-- The listing's steps as copied onto this job; the report replaces it once done. -->
            <CleaningJobChecklist :steps="cleaningJob.steps" />
          </template>

          <!-- Task details -->
          <template v-else-if="event.type === 'task' && task">
            <div class="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">
                  Status
                </p>
                <p class="font-medium">
                  {{ TASK_STATUS_LABELS[task.status] ?? task.status }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Priority
                </p>
                <p class="font-medium capitalize">
                  {{ task.priority }}
                </p>
              </div>
              <div v-if="task.dueDate" class="col-span-2">
                <p class="text-xs text-muted-foreground">
                  Due date
                </p>
                <p class="font-medium">
                  {{ formatDate(task.dueDate) }}
                </p>
              </div>
              <div v-if="task.images?.length" class="col-span-2">
                <p class="text-xs text-muted-foreground">
                  Images
                </p>
                <div class="mt-1 grid grid-cols-3 gap-1.5">
                  <img
                    v-for="(img, idx) in task.images"
                    :key="idx"
                    :src="img"
                    alt=""
                    class="h-16 w-full rounded-md border object-cover"
                  >
                </div>
              </div>
            </div>
          </template>

          <!-- Cleaning report (only when cleaning is done) -->
          <CleaningReportPanel
            v-if="event.type === 'cleaning' && cleaningJob?.status === 'done' && cleaningJob.feedback"
            :feedback="cleaningJob.feedback"
            :is-checkout-cleaning="event.cleaningType === 'check_out'"
          />

          <!-- Guest stay details -->
          <template v-else-if="event.type === 'guest_stay'">
            <div class="rounded-lg border bg-muted/30 p-3 text-sm">
              <p class="text-xs text-muted-foreground">
                Guest
              </p>
              <p class="font-medium">
                {{ event.guestName || event.title }}
              </p>
            </div>
          </template>
        </div>
      </ScrollArea>

      <SheetFooter class="shrink-0 border-t px-6 py-4 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="ghost" @click="close">
          Close
        </Button>
        <Button
          v-if="(event?.type === 'cleaning' && cleaningJob) || (event?.type === 'task' && task)"
          variant="destructive"
          @click="handleDelete"
        >
          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          Delete
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
