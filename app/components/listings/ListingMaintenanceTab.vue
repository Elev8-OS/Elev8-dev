<script setup lang="ts">
import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import type { Listing, Unit } from '~/components/listings/data/listings'
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import type { CustomCleaningFrequency, DayOfWeek, ListingCleaningConfig, ReservationCleaningType } from '~/components/reservations/data/cleaning-schedule'
import type { Task } from '~/components/tasks/data/schema'
import { toast } from 'vue-sonner'
import { cleanerOptions, cleaningDisplayStatus, cleaningDisplayStatusClasses, cleaningDisplayStatusMeta } from '~/components/cleaning/data/cleaning-jobs'
import { CLEANING_STEPS_REQUIRED_MESSAGE, countCleaningSteps, hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import ListingCleaningStepsSheet from '~/components/listings/ListingCleaningStepsSheet.vue'
import CalendarEventDetailDialog from '~/components/operations-calendar/CalendarEventDetailDialog.vue'
import { buildCleaningEvents, cleaningTypeIcons, cleaningTypeLabels, formatLocalDateKey, normalizeCleaningType } from '~/components/operations-calendar/data/operations-calendar'
import OperationsCalendarCreateDialog from '~/components/operations-calendar/OperationsCalendarCreateDialog.vue'
import { CLEANING_TYPE_OPTIONS, DAY_OF_WEEK_OPTIONS, describeListingCleaning } from '~/components/reservations/data/cleaning-schedule'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { assigneeOptions } from '~/components/tasks/data/data'
import { isTaskCompleted, TASK_STATUS_LABELS } from '~/components/tasks/data/schema'
import TaskDetailSheet from '~/components/tasks/TaskDetailSheet.vue'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useTaskDetail } from '~/composables/useTaskDetail'
import { useTaskStore } from '~/composables/useTaskStore'

/**
 * Housekeeping and upkeep for one listing, read from the same stores as the
 * Operations Calendar and the Tasks page: cleaning jobs from `useCleaningJobs`,
 * tasks from `useTaskStore` (matched by listing name, which is what
 * `Task.listing` stores). `listing.maintenance.tasks` is legacy mock data and
 * is not read.
 */
const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const showCleaningDialog = ref(false)
const showDefaultScheduleDialog = ref(false)
const showNewTask = ref(false)
const showStepsSheet = ref(false)

// --- Cleaning steps ------------------------------------------------------------
// ⚠️ No steps, no cleaning: New cleaning and the default cleaning are locked
// until the listing has at least one step (`cleaning-steps.ts`).
const stepsReady = computed(() => hasCleaningSteps(props.listing))
const stepCount = computed(() => countCleaningSteps(props.listing.maintenance.cleaningSteps))

function saveCleaningSteps(steps: CleaningStepSection[]) {
  emit('update', { ...props.listing, maintenance: { ...props.listing.maintenance, cleaningSteps: steps } })
  toast.success('Cleaning steps saved')
}
const { jobsForListing } = useCleaningJobs()
const { tasks } = useTaskStore()
const { selectedTask, openTaskDetail, closeTaskDetail } = useTaskDetail()

const defaultForm = ref<{
  type: ReservationCleaningType
  customFrequency: CustomCleaningFrequency
  dayInterval: number
  weekDays: DayOfWeek[]
  startOffset: 'check_in' | 'day_after_check_in'
  time: string
  assigneeId: string
  assigneeIds: string[]
}>({
  type: 'daily',
  customFrequency: 'day',
  dayInterval: 2,
  weekDays: ['monday', 'thursday', 'friday'],
  startOffset: 'check_in',
  time: '11:00',
  assigneeId: 'unassigned',
  assigneeIds: [],
})

const listingCleanerNames = computed(() => {
  const sched = props.listing.maintenance?.defaultCleaningSchedule
  if (!sched)
    return []
  const ids = sched.assigneeIds && sched.assigneeIds.length
    ? sched.assigneeIds
    : (sched.assigneeId && sched.assigneeId !== 'unassigned' ? [sched.assigneeId] : [])
  return ids.map(id => cleanerOptions.find(c => c.id === id)?.name).filter(Boolean) as string[]
})

function openDefaultScheduleModal() {
  const current = props.listing.maintenance?.defaultCleaningSchedule
  if (current) {
    const ids = current.assigneeIds && current.assigneeIds.length
      ? [...current.assigneeIds]
      : (current.assigneeId && current.assigneeId !== 'unassigned' ? [current.assigneeId] : [])
    defaultForm.value = {
      type: current.type,
      customFrequency: current.custom?.frequency || 'day',
      dayInterval: current.custom?.dayInterval || 2,
      weekDays: current.custom?.weekDays?.length ? [...current.custom.weekDays] : ['monday', 'thursday', 'friday'],
      startOffset: current.startOffset || 'check_in',
      time: current.time || '11:00',
      assigneeId: ids[0] || 'unassigned',
      assigneeIds: ids,
    }
  }
  else {
    defaultForm.value = {
      type: 'daily',
      customFrequency: 'day',
      dayInterval: 2,
      weekDays: ['monday', 'thursday', 'friday'],
      startOffset: 'check_in',
      time: '11:00',
      assigneeId: 'unassigned',
      assigneeIds: [],
    }
  }
  showDefaultScheduleDialog.value = true
}

function toggleDefaultWeekDay(day: DayOfWeek) {
  if (defaultForm.value.weekDays.includes(day)) {
    defaultForm.value.weekDays = defaultForm.value.weekDays.filter(d => d !== day)
  }
  else {
    defaultForm.value.weekDays = [...defaultForm.value.weekDays, day]
  }
}

function saveDefaultSchedule() {
  const config: ListingCleaningConfig = {
    type: defaultForm.value.type,
    startOffset: defaultForm.value.startOffset,
    time: defaultForm.value.time || '11:00',
    assigneeId: defaultForm.value.assigneeIds[0] || undefined,
    assigneeIds: defaultForm.value.assigneeIds.length ? [...defaultForm.value.assigneeIds] : undefined,
    custom: defaultForm.value.type === 'custom'
      ? {
          frequency: defaultForm.value.customFrequency,
          dayInterval: defaultForm.value.customFrequency === 'day' ? defaultForm.value.dayInterval : undefined,
          weekDays: defaultForm.value.customFrequency === 'week' ? [...defaultForm.value.weekDays] : undefined,
        }
      : undefined,
  }

  emit('update', {
    ...props.listing,
    maintenance: {
      ...props.listing.maintenance,
      defaultCleaningSchedule: config,
    },
  })
  showDefaultScheduleDialog.value = false
  toast.success('Default cleaning saved')
}

// --- Cleanings ---------------------------------------------------------------

const todayKey = formatLocalDateKey(new Date())

const cleaningJobs = computed(() =>
  jobsForListing(props.listing.id).filter(job => !props.activeUnit || !job.unitId || job.unitId === props.activeUnit.id),
)

function jobDateKey(job: CleaningJob) {
  return formatLocalDateKey(new Date(job.scheduledAt))
}

function jobStatus(job: CleaningJob) {
  return cleaningDisplayStatus(job.status, job.scheduledAt)
}

const cleaningView = ref<'upcoming' | 'past'>('upcoming')

const upcomingCleanings = computed(() =>
  cleaningJobs.value.filter(job => jobDateKey(job) >= todayKey && jobStatus(job) !== 'completed' && jobStatus(job) !== 'cancelled'),
)
const pastCleanings = computed(() =>
  cleaningJobs.value
    .filter(job => !upcomingCleanings.value.includes(job))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
)

/** The visible cleanings grouped by day, in list order. */
const cleaningGroups = computed(() => {
  const list = cleaningView.value === 'upcoming' ? upcomingCleanings.value : pastCleanings.value
  const groups: Array<{ key: string, label: string, jobs: CleaningJob[] }> = []
  for (const job of list) {
    const key = jobDateKey(job)
    const last = groups[groups.length - 1]
    if (last?.key === key)
      last.jobs.push(job)
    else
      groups.push({ key, label: formatDayLabel(key), jobs: [job] })
  }
  return groups
})

const detailCleaningEvent = ref<CalendarEvent | null>(null)
const detailCleaningOpen = ref(false)

function openCleaning(job: CleaningJob) {
  detailCleaningEvent.value = buildCleaningEvents(undefined, [job])[0] ?? null
  detailCleaningOpen.value = true
}

// --- Tasks -------------------------------------------------------------------

const listingTasks = computed(() => tasks.value.filter(t => t.listing === props.listing.name))

const taskView = ref<'open' | 'completed'>('open')

const openTasks = computed(() =>
  listingTasks.value
    .filter(t => !isTaskCompleted(t))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
)
const completedTasks = computed(() =>
  listingTasks.value
    .filter(isTaskCompleted)
    .sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? '')),
)
const visibleTasks = computed(() => taskView.value === 'open' ? openTasks.value : completedTasks.value)

const taskSheetOpen = computed({
  get: () => selectedTask.value !== null,
  set: (open: boolean) => {
    if (!open)
      closeTaskDetail()
  },
})

const taskStatusClasses: Record<Task['status'], string> = {
  'not started': 'bg-muted text-muted-foreground',
  'in progress': 'bg-amber-100 text-amber-700',
  'completed': 'bg-emerald-100 text-emerald-700',
}

const priorityClasses: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-muted-foreground',
}

function assigneeLabel(task: Task) {
  if (!task.assignee)
    return 'Unassigned'
  return assigneeOptions.find(o => o.value === task.assignee)?.label ?? task.assignee
}

function isOverdue(task: Task) {
  return !!task.dueDate && !isTaskCompleted(task) && task.dueDate.slice(0, 10) < todayKey
}

// --- Summary -----------------------------------------------------------------

const weekAheadKey = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return formatLocalDateKey(d)
})

const summary = computed(() => [
  {
    label: 'Cleanings next 7 days',
    value: upcomingCleanings.value.filter(job => jobDateKey(job) <= weekAheadKey.value).length,
    icon: 'lucide:brush-cleaning',
    tone: '',
  },
  {
    label: 'Missed cleanings',
    value: cleaningJobs.value.filter(job => jobStatus(job) === 'missed').length,
    icon: 'lucide:circle-x',
    tone: 'text-red-600',
  },
  {
    label: 'Open tasks',
    value: openTasks.value.length,
    icon: 'lucide:list-todo',
    tone: '',
  },
  {
    label: 'Overdue tasks',
    value: openTasks.value.filter(isOverdue).length,
    icon: 'lucide:alarm-clock',
    tone: 'text-red-600',
  },
])

// --- Formatting --------------------------------------------------------------

function formatDayLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (key === todayKey)
    return 'Today'
  if (key === formatLocalDateKey(tomorrow))
    return 'Tomorrow'
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: y === new Date().getFullYear() ? undefined : 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDue(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card v-for="item in summary" :key="item.label" class="gap-1 p-4" data-testid="maintenance-stat">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          {{ item.label }}
          <Icon :name="item.icon" class="size-4" />
        </div>
        <span class="text-xl font-semibold" :class="item.value > 0 ? item.tone : ''">{{ item.value }}</span>
      </Card>
    </div>

    <!-- One 4-column grid: the side column lines up under the last summary card. -->
    <div class="grid gap-4 xl:grid-cols-4">
      <div class="flex min-w-0 flex-col gap-4 xl:col-span-3">
        <!-- Cleanings -->
        <Card class="gap-0 p-0">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h3 class="text-sm font-semibold">
                Cleanings
              </h3>
              <p class="text-xs text-muted-foreground">
                Every housekeeping job for this listing, as on the Operations Calendar.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Tabs v-model="cleaningView">
                <TabsList class="h-8">
                  <TabsTrigger value="upcoming" class="text-xs" data-testid="cleanings-upcoming">
                    Upcoming
                    <span class="ml-1 text-muted-foreground">{{ upcomingCleanings.length }}</span>
                  </TabsTrigger>
                  <TabsTrigger value="past" class="text-xs" data-testid="cleanings-past">
                    Past
                    <span class="ml-1 text-muted-foreground">{{ pastCleanings.length }}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button size="sm" class="h-8 gap-1.5" :disabled="!stepsReady" data-testid="new-cleaning" @click="showCleaningDialog = true">
                <Icon name="lucide:plus" class="size-3.5" />
                New cleaning
              </Button>
            </div>
          </div>

          <div
            v-if="!stepsReady"
            class="flex flex-wrap items-center justify-between gap-3 border-b bg-amber-50 px-5 py-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
            data-testid="cleaning-steps-required"
          >
            <span class="flex items-center gap-2">
              <Icon name="lucide:list-checks" class="size-4 shrink-0" />
              {{ CLEANING_STEPS_REQUIRED_MESSAGE }}
            </span>
            <Button size="sm" variant="outline" class="h-7 bg-background text-xs" @click="showStepsSheet = true">
              Set up steps
            </Button>
          </div>
          <div v-if="cleaningGroups.length" class="flex flex-col">
            <div v-for="group in cleaningGroups" :key="group.key" class="border-b last:border-b-0">
              <div class="bg-muted/30 px-5 py-1.5 text-xs font-medium text-muted-foreground">
                {{ group.label }}
              </div>
              <button
                v-for="job in group.jobs"
                :key="job.id"
                type="button"
                class="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40"
                data-testid="cleaning-row"
                @click="openCleaning(job)"
              >
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon :name="cleaningTypeIcons[normalizeCleaningType(job.source)]" class="size-4" />
                </div>
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="truncate text-sm font-medium">
                    {{ cleaningTypeLabels[normalizeCleaningType(job.source)] }}
                    <span v-if="job.unitName" class="font-normal text-muted-foreground">· {{ job.unitName }}</span>
                  </span>
                  <span class="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Icon name="lucide:clock" class="size-3" />
                    {{ formatTime(job.scheduledAt) }} · {{ job.durationMinutes }} min
                    <Icon name="lucide:user" class="ml-1.5 size-3" />
                    {{ job.cleanerNames?.length ? job.cleanerNames.join(', ') : 'Unassigned' }}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  class="shrink-0 gap-1 border-transparent text-[10px]"
                  :class="cleaningDisplayStatusClasses[jobStatus(job)]"
                >
                  <Icon :name="cleaningDisplayStatusMeta[jobStatus(job)].icon" class="size-3" />
                  {{ cleaningDisplayStatusMeta[jobStatus(job)].label }}
                </Badge>
                <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div v-else class="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <Icon name="lucide:brush-cleaning" class="size-8 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">
              {{ cleaningView === 'upcoming' ? 'No upcoming cleanings.' : 'No past cleanings.' }}
            </p>
          </div>
        </Card>

        <!-- Tasks -->
        <Card class="gap-0 p-0">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h3 class="text-sm font-semibold">
                Tasks
              </h3>
              <p class="text-xs text-muted-foreground">
                Repairs and upkeep for this listing, from the Tasks page.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Tabs v-model="taskView">
                <TabsList class="h-8">
                  <TabsTrigger value="open" class="text-xs" data-testid="tasks-open">
                    Open
                    <span class="ml-1 text-muted-foreground">{{ openTasks.length }}</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed" class="text-xs" data-testid="tasks-completed">
                    Completed
                    <span class="ml-1 text-muted-foreground">{{ completedTasks.length }}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button size="sm" class="h-8 gap-1.5" @click="showNewTask = true">
                <Icon name="lucide:plus" class="size-3.5" />
                New task
              </Button>
            </div>
          </div>

          <div v-if="visibleTasks.length" class="flex flex-col divide-y">
            <button
              v-for="task in visibleTasks"
              :key="task.id"
              type="button"
              class="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40"
              data-testid="task-row"
              @click="openTaskDetail(task)"
            >
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="truncate text-sm font-medium" :class="isTaskCompleted(task) && 'text-muted-foreground line-through'">
                  {{ task.title }}
                </span>
                <span class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <Icon :name="task.assigneeType === 'role' ? 'lucide:users' : 'lucide:user'" class="size-3" />
                    {{ assigneeLabel(task) }}
                  </span>
                  <span v-if="task.dueDate" class="flex items-center gap-1" :class="isOverdue(task) && 'font-medium text-red-600'">
                    <Icon name="lucide:calendar" class="size-3" />
                    {{ isOverdue(task) ? 'Overdue · ' : '' }}{{ formatDue(task.dueDate) }}
                  </span>
                  <span class="flex items-center gap-1 capitalize" :class="priorityClasses[task.priority]">
                    <Icon name="lucide:flag" class="size-3" />
                    {{ task.priority }}
                  </span>
                </span>
                <Progress
                  v-if="task.status === 'in progress' && task.progress !== undefined"
                  :model-value="task.progress"
                  class="mt-1 h-1 max-w-48"
                />
              </div>
              <Badge variant="outline" class="shrink-0 border-transparent text-[10px]" :class="taskStatusClasses[task.status]">
                {{ TASK_STATUS_LABELS[task.status] }}
              </Badge>
              <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
          <div v-else class="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <Icon name="lucide:list-todo" class="size-8 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">
              {{ taskView === 'open' ? 'No open tasks.' : 'No completed tasks.' }}
            </p>
          </div>
        </Card>
      </div>

      <!-- Side: housekeeping defaults -->
      <div class="flex min-w-0 flex-col gap-4">
        <Card class="gap-3 p-5" data-testid="cleaning-steps-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold">
                Cleaning steps
              </h3>
              <p class="mt-0.5 text-xs text-muted-foreground">
                What housekeeping checks off on every clean.
              </p>
            </div>
            <Button
              :variant="stepsReady ? 'outline' : 'default'"
              size="sm"
              class="h-7 gap-1.5 text-xs"
              data-testid="edit-cleaning-steps"
              @click="showStepsSheet = true"
            >
              <Icon :name="stepsReady ? 'lucide:pencil' : 'lucide:plus'" class="size-3.5" />
              {{ stepsReady ? 'Edit' : 'Set up' }}
            </Button>
          </div>
          <div v-if="stepsReady" class="flex flex-col divide-y rounded-lg border">
            <div
              v-for="section in listing.maintenance.cleaningSteps"
              :key="section.id"
              class="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span class="truncate text-xs">{{ section.title }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{{ section.steps.length }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 bg-muted/30 px-3 py-2 text-xs font-medium">
              Total
              <span>{{ stepCount }} {{ stepCount === 1 ? 'step' : 'steps' }}</span>
            </div>
          </div>
          <p v-else class="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <Icon name="lucide:lock" class="size-3.5 shrink-0" />
            Needed before any cleaning can be scheduled.
          </p>
        </Card>

        <Card class="gap-3 p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold">
                Default cleaning for new bookings
              </h3>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Creates the cleaning jobs when a booking is made. Each booking can still be changed.
              </p>
            </div>
            <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" :disabled="!stepsReady" data-testid="configure-default-cleaning" @click="openDefaultScheduleModal">
              <Icon name="lucide:settings-2" class="size-3.5" />
              {{ listing.maintenance?.defaultCleaningSchedule ? 'Configure' : 'Set default' }}
            </Button>
          </div>
          <template v-if="listing.maintenance?.defaultCleaningSchedule">
            <div class="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3" :class="!stepsReady && 'opacity-60'" data-testid="default-cleaning">
              <p class="text-sm">
                {{ describeListingCleaning(listing.maintenance.defaultCleaningSchedule) }}
              </p>
              <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon name="lucide:user" class="size-3" />
                <template v-if="listingCleanerNames.length">
                  {{ listingCleanerNames.length === 1 ? 'Cleaner' : 'Cleaners' }}: {{ listingCleanerNames.join(', ') }}
                </template>
                <template v-else>
                  No cleaner assigned
                </template>
              </p>
            </div>
          </template>
          <p v-else-if="stepsReady" class="text-xs text-muted-foreground">
            No default set. New bookings get a cleaning every day of the stay at 11:00.
          </p>
          <p v-if="!stepsReady" class="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="default-cleaning-locked">
            <Icon name="lucide:lock" class="size-3" />
            New bookings get no cleaning until the listing has cleaning steps.
          </p>
        </Card>
      </div>
    </div>

    <OperationsCalendarCreateDialog
      :open="showCleaningDialog"
      only="cleaning"
      :listing-id="listing.id"
      :day-key="todayKey"
      @update:open="showCleaningDialog = $event"
    />

    <ListingCleaningStepsSheet
      v-model:open="showStepsSheet"
      :steps="listing.maintenance.cleaningSteps"
      :listing-id="listing.id"
      :listing-name="listing.name"
      @save="saveCleaningSteps"
    />

    <!-- No day for a task: its due date starts empty. -->
    <OperationsCalendarCreateDialog
      :open="showNewTask"
      only="task"
      :listing-id="listing.id"
      @update:open="showNewTask = $event"
    />

    <TaskDetailSheet
      :task="selectedTask"
      :open="taskSheetOpen"
      @update:open="taskSheetOpen = $event"
    />

    <CalendarEventDetailDialog
      :open="detailCleaningOpen"
      :event="detailCleaningEvent"
      @update:open="detailCleaningOpen = $event"
      @deleted="detailCleaningOpen = false"
    />

    <!-- Default Housekeeping Dialog -->
    <Dialog v-model:open="showDefaultScheduleDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Default cleaning for new bookings</DialogTitle>
          <DialogDescription>
            Set the default cleaning schedule for guest stays at {{ listing.name }}.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-2 text-xs">
          <!-- Mode selection -->
          <div class="space-y-1.5">
            <Label class="text-xs font-medium">Cleaning Mode</Label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="opt in CLEANING_TYPE_OPTIONS"
                :key="opt.type"
                type="button"
                class="flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer"
                :class="defaultForm.type === opt.type ? 'border-primary bg-primary/5 text-foreground font-semibold' : 'border-border text-muted-foreground hover:text-foreground'"
                @click="defaultForm.type = opt.type"
              >
                <Icon :name="opt.icon" class="size-4 mb-1" />
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </div>

          <!-- Custom Frequency settings -->
          <div v-if="defaultForm.type === 'custom'" class="rounded-lg border bg-muted/20 p-3 space-y-3">
            <div class="flex items-center justify-between">
              <Label class="text-xs font-medium">Custom Frequency Type</Label>
              <div class="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  class="px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all"
                  :class="defaultForm.customFrequency === 'day' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'"
                  @click="defaultForm.customFrequency = 'day'"
                >
                  By Day
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all"
                  :class="defaultForm.customFrequency === 'week' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'"
                  @click="defaultForm.customFrequency = 'week'"
                >
                  By Week
                </button>
              </div>
            </div>

            <!-- Day interval -->
            <div v-if="defaultForm.customFrequency === 'day'" class="space-y-1.5">
              <Label class="text-muted-foreground">Repeat every:</Label>
              <div class="flex flex-wrap gap-1">
                <Button
                  v-for="d in [1, 2, 3, 4, 5, 7]"
                  :key="d"
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs px-2"
                  :class="defaultForm.dayInterval === d ? 'bg-primary text-primary-foreground border-primary' : ''"
                  @click="defaultForm.dayInterval = d"
                >
                  {{ d === 1 ? 'Everyday' : `${d} days` }}
                </Button>
              </div>
            </div>

            <!-- Week days -->
            <div v-else class="space-y-1.5">
              <Label class="text-muted-foreground">Clean on days:</Label>
              <div class="grid grid-cols-7 gap-1">
                <button
                  v-for="day in DAY_OF_WEEK_OPTIONS"
                  :key="day.id"
                  type="button"
                  class="h-8 rounded-md border text-xs font-medium transition-all cursor-pointer"
                  :class="defaultForm.weekDays.includes(day.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground hover:text-foreground'"
                  @click="toggleDefaultWeekDay(day.id)"
                >
                  {{ day.short }}
                </button>
              </div>
            </div>
          </div>

          <!-- Start Offset -->
          <div class="space-y-1.5">
            <Label class="text-xs font-medium">When should cleaning start?</Label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="p-2 rounded-lg border text-center transition-all cursor-pointer text-xs"
                :class="defaultForm.startOffset === 'check_in' ? 'border-primary bg-primary/5 text-foreground font-semibold' : 'border-border text-muted-foreground hover:text-foreground'"
                @click="defaultForm.startOffset = 'check_in'"
              >
                On check-in
              </button>
              <button
                type="button"
                class="p-2 rounded-lg border text-center transition-all cursor-pointer text-xs"
                :class="defaultForm.startOffset === 'day_after_check_in' ? 'border-primary bg-primary/5 text-foreground font-semibold' : 'border-border text-muted-foreground hover:text-foreground'"
                @click="defaultForm.startOffset = 'day_after_check_in'"
              >
                Day after check-in
              </button>
            </div>
          </div>

          <!-- Time & Cleaner -->
          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label class="text-xs font-medium">Default Time</Label>
              <Input v-model="defaultForm.time" type="time" class="h-8 text-xs max-w-[180px]" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs font-medium">Default Cleaner(s)</Label>
              <StaffMultiSelectDropdown
                v-model="defaultForm.assigneeIds"
                :options="cleanerOptions"
                placeholder="Search and select default cleaners..."
                title="Default Cleaners"
              />
              <p class="text-[11px] text-muted-foreground">
                {{ defaultForm.assigneeIds.length ? `${defaultForm.assigneeIds.length} cleaner(s) selected` : 'No cleaners assigned (unassigned)' }}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" @click="showDefaultScheduleDialog = false">
            Cancel
          </Button>
          <Button size="sm" @click="saveDefaultSchedule">
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
