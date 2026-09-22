<script setup lang="ts">
import type { Booking } from '~/components/listings/data/listings'
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { toast } from 'vue-sonner'
import DatePicker from '~/components/base/DatePicker.vue'
import TimePicker from '~/components/base/TimePicker.vue'
import { cleanerOptions, cleaningJobPriorityLabels, cleaningJobStatusLabels } from '~/components/cleaning/data/cleaning-jobs'
import { listings } from '~/components/listings/data/listings'
import CleaningReportPanel from '~/components/operations-calendar/CleaningReportPanel.vue'
import { cleaningTypeIcons, cleaningTypeVariants } from '~/components/operations-calendar/data/operations-calendar'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { Label } from '~/components/ui/label'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
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

const statusLabel = computed(() => {
  if (!cleaningJob.value)
    return null
  return cleaningJobStatusLabels[cleaningJob.value.status]
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

// Specific reason the dialog is locked — shown on the lock banner
const lockReason = computed<{ label: string, description: string } | null>(() => {
  if (!cleaningJob.value || isEditable.value)
    return null
  const job = cleaningJob.value
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const scheduled = new Date(job.scheduledAt)
  scheduled.setHours(0, 0, 0, 0)
  const isPast = scheduled.getTime() < today.getTime()

  if (job.status === 'in_progress')
    return { label: 'In progress', description: 'Cleaning is currently underway' }
  if (job.status === 'done')
    return { label: 'Done', description: 'Cleaning has been completed' }
  if (job.status === 'missed')
    return { label: 'Missed', description: 'Cleaning was not done' }
  if (job.status === 'cancelled')
    return { label: 'Cancelled', description: 'Cleaning was cancelled' }
  if (job.status === 'scheduled' && isPast)
    return { label: 'Was missed', description: 'Scheduled date has passed without being marked done' }
  return { label: 'Locked', description: 'No further changes' }
})

// --- Editable state ---
const editingCleanerIds = ref<string[]>([])
const editingPriority = ref<'low' | 'normal' | 'high' | 'urgent'>('normal')
const isSavingPriority = ref(false)

// --- Reschedule state ---
const isRescheduling = ref(false)
const rescheduleDate = ref<string>('')
const rescheduleTime = ref<string>('11:00')
const isSavingReschedule = ref(false)

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
  rescheduleTime.value = dt.includes('T') && dt.length >= 16 ? dt.slice(11, 16) : '11:00'
}

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
  const origDate = origDt.slice(0, 10)
  const origTime = origDt.includes('T') && origDt.length >= 16 ? origDt.slice(11, 16) : '11:00'
  return rescheduleDate.value !== origDate || rescheduleTime.value !== origTime
})

const canSaveReschedule = computed(() => {
  if (!rescheduleDate.value)
    return false
  if (rescheduleDate.value < todayKey.value)
    return false
  return hasRescheduleChanges.value
})

const reschedulePreviewText = computed(() => {
  if (!cleaningJob.value || !rescheduleDate.value)
    return ''
  const origDate = formatDate(cleaningJob.value.scheduledAt)
  const origTime = formatTime(cleaningJob.value.scheduledAt)
  const newTime = rescheduleTime.value || '11:00'
  const newDate = new Date(`${rescheduleDate.value}T${newTime}:00+08:00`).toLocaleDateString('en-GB', {
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
  })
  const formattedDate = new Date(`${rescheduleDate.value}T${time}:00+08:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  toast.success(`Cleaning rescheduled to ${formattedDate} at ${time}`)
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

function toggleCleaningStatus() {
  if (!cleaningJob.value)
    return
  const nextStatus = cleaningJob.value.status === 'done' ? 'scheduled' : 'done'
  updateJob(cleaningJob.value.id, { status: nextStatus })
  toast.success(`Marked as ${nextStatus === 'done' ? 'done' : 'scheduled'}`)
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

// Find the booking that overlaps the cleaning date for the same listing
// Only "real" bookings count (checked_in / checked_out / verified) —
// `inquiry` is not yet a booking, so no cleaning should be associated.
const overlappingBooking = computed<Booking | null>(() => {
  if (!props.event || props.event.type !== 'cleaning')
    return null
  const listing = listings.value.find(l => l.id === props.event.listingId)
  if (!listing?.bookings?.length)
    return null
  const eventDay = (cleaningJob.value?.scheduledAt ?? props.event.start).slice(0, 10)
  return listing.bookings.find(b =>
    b.status !== 'cancelled'
    && b.status !== 'inquiry'
    && b.checkIn <= eventDay
    && b.checkOut >= eventDay,
  ) ?? null
})

const stayInfoLabel = computed(() => {
  const b = overlappingBooking.value
  if (b) {
    const checkIn = new Date(`${b.checkIn}T00:00:00+08:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const checkOut = new Date(`${b.checkOut}T00:00:00+08:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return {
      guestName: b.guestName,
      dateRange: `${checkIn} → ${checkOut}`,
      nights: b.nights,
      adults: b.adults ?? 0,
      children: b.children ?? 0,
      infants: b.infants ?? 0,
      pets: b.pets ?? (b.hasPet ? 1 : 0),
      hasPet: b.hasPet,
    }
  }
  if (props.event?.guestName) {
    return {
      guestName: props.event.guestName,
      dateRange: '',
      nights: 0,
      adults: 1,
      children: 0,
      infants: 0,
      pets: props.event.hasPet ? 1 : 0,
      hasPet: props.event.hasPet,
    }
  }
  return null
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
      </SheetHeader>

      <ScrollArea class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="event" class="flex flex-col gap-4 p-6">
          <!-- Guest in stay (cleaning only — shows overlapping booking info) -->
          <div
            v-if="event.type === 'cleaning' && stayInfoLabel"
            class="flex flex-col gap-1.5"
            data-testid="guest-in-stay"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="text-lg font-bold tracking-tight">
                {{ stayInfoLabel.guestName }}
              </p>
              <div
                v-if="overlappingBooking"
                class="flex shrink-0 items-center gap-1"
              >
                <Icon
                  name="lucide:star"
                  class="h-6 w-6 fill-amber-400 text-amber-500"
                />
                <span class="text-2xl font-bold tracking-tight">4</span>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div class="flex items-center gap-1.5">
                <Icon name="lucide:user" class="h-3.5 w-3.5" />
                <span class="font-semibold text-foreground">{{ stayInfoLabel.adults }}</span>
                <span>Adults</span>
              </div>
              <div v-if="stayInfoLabel.children" class="flex items-center gap-1.5">
                <Icon name="lucide:users-round" class="h-3.5 w-3.5" />
                <span class="font-semibold text-foreground">{{ stayInfoLabel.children }}</span>
                <span>Children</span>
              </div>
              <div v-if="stayInfoLabel.infants" class="flex items-center gap-1.5">
                <Icon name="lucide:baby" class="h-3.5 w-3.5" />
                <span class="font-semibold text-foreground">{{ stayInfoLabel.infants }}</span>
                <span>Infant{{ stayInfoLabel.infants === 1 ? '' : 's' }}</span>
              </div>
              <div v-if="stayInfoLabel.pets" class="flex items-center gap-1.5">
                <Icon name="lucide:paw-print" class="h-3.5 w-3.5" />
                <span class="font-semibold text-foreground">{{ stayInfoLabel.pets }}</span>
                <span>Pet{{ stayInfoLabel.pets === 1 ? '' : 's' }}</span>
              </div>
            </div>
            <div v-if="overlappingBooking" class="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon name="lucide:calendar" class="h-3.5 w-3.5" />
              <span>Checkout :</span>
              <span class="font-semibold text-foreground">
                {{ new Date(`${overlappingBooking.checkOut}T11:00:00+08:00`).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') }}
              </span>
            </div>
          </div>

          <!-- Cleaning job details (skipped when done — the report panel below replaces it) -->
          <template v-if="event.type === 'cleaning' && cleaningJob && (cleaningJob.status !== 'done' || !cleaningJob.feedback)">
            <!-- Lock state banner (only when not editable) -->
            <div
              v-if="lockReason"
              class="flex items-start gap-3 rounded-lg border p-3 text-sm"
              :class="{
                'border-emerald-500/40 bg-emerald-500/10 text-emerald-700': lockReason.label === 'Done',
                'border-amber-500/40 bg-amber-500/10 text-amber-700': lockReason.label === 'In progress',
                'border-destructive/40 bg-destructive/10 text-destructive': lockReason.label === 'Missed' || lockReason.label === 'Was missed' || lockReason.label === 'Cancelled',
                'border-muted bg-muted/30 text-muted-foreground': lockReason.label === 'Locked',
              }"
              data-testid="detail-lock-banner"
              :data-lock-reason="lockReason.label"
            >
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                :class="{
                  'bg-emerald-500/20': lockReason.label === 'Done',
                  'bg-amber-500/20': lockReason.label === 'In progress',
                  'bg-destructive/20': lockReason.label === 'Missed' || lockReason.label === 'Was missed' || lockReason.label === 'Cancelled',
                  'bg-muted-foreground/20': lockReason.label === 'Locked',
                }"
              >
                <Icon
                  :name="
                    lockReason.label === 'Done' ? 'lucide:check-circle-2'
                    : lockReason.label === 'In progress' ? 'lucide:loader'
                      : lockReason.label === 'Missed' || lockReason.label === 'Was missed' ? 'lucide:circle-x'
                        : lockReason.label === 'Cancelled' ? 'lucide:ban'
                          : 'lucide:lock'
                  "
                  :class="lockReason.label === 'In progress' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'"
                />
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <p
                  class="text-sm font-semibold" :class="{
                    'text-emerald-700 dark:text-emerald-400': lockReason.label === 'Done',
                    'text-amber-700 dark:text-amber-400': lockReason.label === 'In progress',
                    'text-destructive': lockReason.label === 'Missed' || lockReason.label === 'Was missed' || lockReason.label === 'Cancelled',
                  }"
                >
                  {{ lockReason.label }}
                  <span v-if="lockReason.label === 'Was missed'" class="text-xs font-normal text-muted-foreground">
                    · {{ formatDate(cleaningJob.scheduledAt) }}
                  </span>
                  <span v-else-if="lockReason.label === 'Done'" class="text-xs font-normal text-muted-foreground">
                    · {{ formatDate(cleaningJob.scheduledAt) }}
                  </span>
                </p>
                <p
                  class="text-xs" :class="{
                    'text-emerald-700/80 dark:text-emerald-400/80': lockReason.label === 'Done',
                    'text-amber-700/80 dark:text-amber-400/80': lockReason.label === 'In progress',
                    'text-destructive/80': lockReason.label === 'Missed' || lockReason.label === 'Was missed' || lockReason.label === 'Cancelled',
                    'text-muted-foreground': lockReason.label === 'Locked',
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
                  :variant="lockReason.label === 'Done' ? 'default' : lockReason.label === 'Missed' || lockReason.label === 'Was missed' || lockReason.label === 'Cancelled' ? 'destructive' : 'outline'"
                  class="gap-1 text-[10px] font-medium"
                  :class="[
                    lockReason.label === 'Done' ? 'bg-emerald-500/80 text-white' : '',
                    lockReason.label === 'In progress' ? 'bg-amber-500/80 text-white' : '',
                    (lockReason.label === 'Missed' || lockReason.label === 'Was missed' || lockReason.label === 'Cancelled')
                      ? 'bg-destructive/90 text-white'
                      : 'text-muted-foreground',
                  ]"
                  data-testid="detail-locked-badge"
                  :data-lock-reason="lockReason.label"
                  :title="`${lockReason.label} · ${lockReason.description}`"
                >
                  <Icon
                    :name="
                      lockReason.label === 'Done' ? 'lucide:check-circle-2'
                      : lockReason.label === 'In progress' ? 'lucide:loader'
                        : lockReason.label === 'Missed' || lockReason.label === 'Was missed' ? 'lucide:circle-x'
                          : lockReason.label === 'Cancelled' ? 'lucide:ban'
                            : 'lucide:lock'
                    "
                    class="h-3 w-3"
                  />
                  {{ lockReason.label }}
                </Badge>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Status
                </p>
                <p class="font-medium">
                  {{ statusLabel }}
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
              <div v-if="event.guestName" class="col-span-2">
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
                      <span class="text-xs text-muted-foreground">at {{ formatTime(cleaningJob.scheduledAt) }}</span>
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

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs text-muted-foreground">New Date</Label>
                      <DatePicker
                        v-model="rescheduleDate"
                        :min="todayKey"
                        placeholder="Select new date"
                        data-testid="reschedule-date-picker"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs text-muted-foreground">Start Time</Label>
                      <TimePicker
                        v-model="rescheduleTime"
                        placeholder="Select time"
                        data-testid="reschedule-time-picker"
                      />
                    </div>
                  </div>

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
          </template>

          <!-- Task details -->
          <template v-else-if="event.type === 'task' && task">
            <div class="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">
                  Status
                </p>
                <p class="font-medium">
                  {{ task.status }}
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

          <!-- Read-only events (owner stay, upsell) -->
          <template v-else>
            <div class="rounded-lg border bg-muted/30 p-3 text-sm">
              <p class="text-xs text-muted-foreground">
                Source
              </p>
              <p class="font-medium">
                {{ event.source || '—' }}
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
          v-if="event?.type === 'cleaning' && cleaningJob"
          variant="outline"
          @click="toggleCleaningStatus"
        >
          <Icon name="lucide:check-circle" class="mr-2 h-4 w-4" />
          Mark as {{ cleaningJob.status === 'done' ? 'scheduled' : 'done' }}
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
