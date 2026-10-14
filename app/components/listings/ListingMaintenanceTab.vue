<script setup lang="ts">
import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { CleaningTemplateType } from '~/components/cleaning/data/cleaning-step-templates'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import type { Listing, Unit } from '~/components/listings/data/listings'
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import type { CustomCleaningFrequency, DayOfWeek, ListingCleaningConfig, ReservationCleaningType, VacantCleaningSettings } from '~/components/reservations/data/cleaning-schedule'
import type { Task } from '~/components/tasks/data/schema'
import { toast } from 'vue-sonner'
import { cleanerOptions, CLEANING_SOURCE_ICONS, CLEANING_SOURCE_LABELS, cleaningDisplayStatus, cleaningDisplayStatusClasses, cleaningDisplayStatusMeta } from '~/components/cleaning/data/cleaning-jobs'
import { CLEANING_TEMPLATE_TYPES, LISTING_CUSTOM_STEPS, listingCanBeCleaned, resolveListingChecklist, withListingOverride } from '~/components/cleaning/data/cleaning-step-templates'
import { CLEANING_STEPS_REQUIRED_MESSAGE, countCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import VacantCleaningPicker from '~/components/cleaning/VacantCleaningPicker.vue'
import ListingCleaningStepsSheet from '~/components/listings/ListingCleaningStepsSheet.vue'
import ListingTypeChecklistSheet from '~/components/listings/ListingTypeChecklistSheet.vue'
import CalendarEventDetailDialog from '~/components/operations-calendar/CalendarEventDetailDialog.vue'
import { buildCleaningEvents, cleaningTypeIcons, cleaningTypeLabels, formatLocalDateKey, normalizeCleaningType } from '~/components/operations-calendar/data/operations-calendar'
import OperationsCalendarCreateDialog from '~/components/operations-calendar/OperationsCalendarCreateDialog.vue'
import { CLEANING_TYPE_OPTIONS, DAY_OF_WEEK_OPTIONS, describeListingCleaning } from '~/components/reservations/data/cleaning-schedule'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { assigneeOptions } from '~/components/tasks/data/data'
import { isTaskCompleted, TASK_STATUS_LABELS } from '~/components/tasks/data/schema'
import TaskDetailSheet from '~/components/tasks/TaskDetailSheet.vue'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useCleaningScheduleDefault } from '~/composables/useCleaningScheduleDefault'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'
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

// --- Checklists ----------------------------------------------------------------
// Each cleaning type follows the company default (Settings), or this listing
// overrides it with another template or its own custom steps
// (`cleaning-step-templates.ts`). ⚠️ No checklist, no cleaning: New cleaning and
// the default cleaning lock only when no type resolves to one.
const { library, templates: cleaningTemplates } = useCleaningStepTemplates()
const stepsReady = computed(() => listingCanBeCleaned(props.listing.maintenance, library.value))

/**
 * The job types a schedule creates: a booking schedule one type
 * (`generateCleaningJobsForReservation`); the daily routine three
 * (`syncRoutineCleanings`).
 */
const SCHEDULE_JOB_TYPES: Record<ReservationCleaningType, CleaningTemplateType[]> = { daily: ['daily', 'check_out', 'vacant'], checkout: ['check_out'], custom: ['custom'] }

const typeChecklists = computed(() => CLEANING_TEMPLATE_TYPES.map((type) => {
  const resolved = resolveListingChecklist(props.listing.maintenance, type, library.value)
  return {
    type,
    label: CLEANING_SOURCE_LABELS[type],
    icon: CLEANING_SOURCE_ICONS[type],
    resolved,
    stepCount: resolved ? countCleaningSteps(resolved.sections) : 0,
  }
}))
const overrideCount = computed(() => typeChecklists.value.filter(r => r.resolved && r.resolved.origin !== 'default').length)

const checklistSheetType = ref<CleaningTemplateType | null>(null)
const showChecklistSheet = ref(false)
function openChecklist(type: CleaningTemplateType) {
  checklistSheetType.value = type
  showChecklistSheet.value = true
}

function writeOverride(types: CleaningTemplateType[], value: string | null, extra: Partial<Listing['maintenance']> = {}) {
  const overrides = withListingOverride(props.listing.maintenance, cleaningTemplates.value, types, value)
  emit('update', { ...props.listing, maintenance: { ...props.listing.maintenance, ...extra, cleaningTemplates: overrides } })
}

function saveTypeChecklist(type: CleaningTemplateType, value: string | null) {
  writeOverride([type], value)
  const name = value === null
    ? 'the company default'
    : value === LISTING_CUSTOM_STEPS ? 'custom steps' : cleaningTemplates.value.find(t => t.id === value)?.name
  toast.success(`${CLEANING_SOURCE_LABELS[type]} now uses ${name}`)
}

// Custom steps are edited in the steps sheet; the type that asked for them
// switches to custom once they are saved.
const pendingCustomType = ref<CleaningTemplateType | null>(null)
function editCustomSteps(type: CleaningTemplateType | null) {
  pendingCustomType.value = type
  showStepsSheet.value = true
}
/** Types on custom steps: what "Copy to listings" carries over with the steps. */
const customTypes = computed(() => typeChecklists.value.filter(r => r.resolved?.origin === 'custom').map(r => r.type))

function saveCleaningSteps(steps: CleaningStepSection[]) {
  const type = pendingCustomType.value
  pendingCustomType.value = null
  if (type) {
    writeOverride([type], LISTING_CUSTOM_STEPS, { cleaningSteps: steps })
    toast.success(`${CLEANING_SOURCE_LABELS[type]} now uses custom steps`)
    return
  }
  emit('update', { ...props.listing, maintenance: { ...props.listing.maintenance, cleaningSteps: steps } })
  toast.success('Custom steps saved')
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
  vacant?: VacantCleaningSettings
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

// --- Cleaning for new bookings: the listing's own schedule, else the company default ---
const { companyDefault, scheduleFor } = useCleaningScheduleDefault()
const effectiveSchedule = computed(() => scheduleFor(props.listing))
const scheduleIsOverride = computed(() => Boolean(props.listing.maintenance?.defaultCleaningSchedule))
/** The schedule's cleaning types this listing has no checklist for: those cleanings are not created. */
const scheduleTypeWithoutChecklist = computed(() => {
  const missing = SCHEDULE_JOB_TYPES[effectiveSchedule.value.type]
    .filter(type => !resolveListingChecklist(props.listing.maintenance, type, library.value))
  return missing.length ? missing.map(type => CLEANING_SOURCE_LABELS[type]).join(', ') : null
})

function resetScheduleToCompanyDefault() {
  const { defaultCleaningSchedule: _dropped, ...maintenance } = props.listing.maintenance
  emit('update', { ...props.listing, maintenance })
  toast.success('Now follows the company default')
}

const listingCleanerNames = computed(() => {
  const sched = effectiveSchedule.value
  if (!sched)
    return []
  const ids = sched.assigneeIds && sched.assigneeIds.length
    ? sched.assigneeIds
    : (sched.assigneeId && sched.assigneeId !== 'unassigned' ? [sched.assigneeId] : [])
  return ids.map(id => cleanerOptions.find(c => c.id === id)?.name).filter(Boolean) as string[]
})

function openDefaultScheduleModal() {
  const current = props.listing.maintenance?.defaultCleaningSchedule ?? companyDefault.value
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
      vacant: current.vacant ? JSON.parse(JSON.stringify(current.vacant)) : undefined,
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
    vacant: defaultForm.value.type === 'daily' && defaultForm.value.vacant ? defaultForm.value.vacant : undefined,
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
            <Button size="sm" variant="outline" class="h-7 bg-background text-xs" @click="openChecklist('check_out')">
              Set up checklists
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
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-foreground">
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
        <Card class="gap-3 p-5" data-testid="checklists-card">
          <div>
            <h3 class="text-sm font-semibold">
              Checklists
            </h3>
            <p class="mt-0.5 text-xs text-muted-foreground">
              What housekeeping checks off, per cleaning type. New cleanings copy it when they are created.
            </p>
          </div>
          <div class="flex flex-col divide-y rounded-lg border">
            <button
              v-for="row in typeChecklists"
              :key="row.type"
              type="button"
              class="flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
              :data-testid="`type-checklist-${row.type}`"
              @click="openChecklist(row.type)"
            >
              <Icon :name="row.icon" class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-xs font-medium">{{ row.label }}</span>
                <span v-if="row.resolved" class="block truncate text-xs text-muted-foreground">
                  {{ row.resolved.name }} · {{ row.stepCount }} {{ row.stepCount === 1 ? 'step' : 'steps' }}
                </span>
                <span v-else class="block text-xs text-amber-700 dark:text-amber-300">No checklist, cannot be scheduled</span>
              </span>
              <Badge
                v-if="row.resolved"
                :variant="row.resolved.origin === 'default' ? 'secondary' : 'outline'"
                class="h-5 shrink-0 text-[10px]"
                :data-testid="`type-checklist-origin-${row.type}`"
              >
                {{ row.resolved.origin === 'default' ? 'Default' : 'Override' }}
              </Badge>
              <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
          <p class="text-xs text-muted-foreground">
            <template v-if="overrideCount">
              {{ overrideCount }} {{ overrideCount === 1 ? 'type differs' : 'types differ' }} from the company default.
            </template>
            <template v-else>
              Following the company defaults.
            </template>
            <NuxtLink to="/settings/cleaning-templates" class="font-medium underline-offset-4 hover:underline">
              Manage templates
            </NuxtLink>
          </p>
        </Card>

        <Card class="gap-3 p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold">
                Cleaning schedule
              </h3>
              <p class="mt-0.5 text-xs text-muted-foreground" data-testid="default-cleaning-hint">
                <template v-if="effectiveSchedule.type === 'daily'">
                  Cleans this listing every day, planned two weeks ahead. You can still change a single day or a reservation.
                </template>
                <template v-else>
                  New bookings get these cleanings automatically. You can still change them on each reservation.
                </template>
              </p>
            </div>
            <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" :disabled="!stepsReady" data-testid="configure-default-cleaning" @click="openDefaultScheduleModal">
              <Icon name="lucide:settings-2" class="size-3.5" />
              {{ scheduleIsOverride ? 'Configure' : 'Override' }}
            </Button>
          </div>
          <div class="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3" :class="!stepsReady && 'opacity-60'" data-testid="default-cleaning">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm">
                {{ describeListingCleaning(effectiveSchedule) }}
              </p>
              <Badge :variant="scheduleIsOverride ? 'outline' : 'secondary'" class="h-5 shrink-0 text-[10px]" data-testid="default-cleaning-origin">
                {{ scheduleIsOverride ? 'Override' : 'Default' }}
              </Badge>
            </div>
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
          <p v-if="stepsReady && scheduleTypeWithoutChecklist" class="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200" data-testid="default-cleaning-no-checklist">
            <Icon name="lucide:triangle-alert" class="mt-0.5 size-3 shrink-0" />
            {{ scheduleTypeWithoutChecklist }}: no checklist here, so these cleanings are not created.
          </p>
          <button
            v-if="scheduleIsOverride"
            type="button"
            class="self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            data-testid="default-cleaning-reset"
            @click="resetScheduleToCompanyDefault"
          >
            Reset to company default
          </button>
          <p v-if="!stepsReady" class="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="default-cleaning-locked">
            <Icon name="lucide:lock" class="size-3" />
            New bookings get no cleaning until the listing has a checklist.
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
      :custom-types="customTypes"
      @save="saveCleaningSteps"
    />

    <ListingTypeChecklistSheet
      v-model:open="showChecklistSheet"
      :listing="listing"
      :type="checklistSheetType"
      @save="saveTypeChecklist"
      @edit-custom="editCustomSteps"
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
          <DialogTitle>Cleaning schedule</DialogTitle>
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
            <p v-if="defaultForm.type === 'daily'" class="text-xs text-muted-foreground" data-testid="default-cleaning-daily-hint">
              Daily cleaning with guests in, check-out cleaning when they leave.
            </p>
          </div>

          <div v-if="defaultForm.type === 'daily'" class="space-y-2" data-testid="default-cleaning-when-empty">
            <Label class="text-xs font-medium">When empty</Label>
            <VacantCleaningPicker v-model="defaultForm.vacant" />
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
