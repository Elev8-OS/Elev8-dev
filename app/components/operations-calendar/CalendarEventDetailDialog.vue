<script setup lang="ts">
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { cleanerOptions, cleaningJobStatusLabels, cleaningJobPriorityLabels } from '~/components/cleaning/data/cleaning-jobs'
import { cleaningTypeIcons, cleaningTypeVariants } from '~/components/operations-calendar/data/operations-calendar'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useTaskStore } from '~/composables/useTaskStore'
import { toast } from 'vue-sonner'
import CleaningReportPanel from '~/components/operations-calendar/CleaningReportPanel.vue'

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
const cleanerPickerOpen = ref(false)
const cleanerSearch = ref('')
const isSavingHousekeeping = ref(false)
const isSavingPriority = ref(false)

watch(cleaningJob, (job) => {
  if (job) {
    editingCleanerIds.value = [...job.cleanerIds]
    editingPriority.value = job.priority
  }
}, { immediate: true })

const filteredCleanerOptions = computed(() => {
  const q = cleanerSearch.value.trim().toLowerCase()
  if (!q)
    return cleanerOptions
  return cleanerOptions.filter(c =>
    c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q),
  )
})

const editingCleanerNames = computed(() => resolveCleanerNames(editingCleanerIds.value))

const hasHousekeepingChanges = computed(() => {
  if (!cleaningJob.value)
    return false
  const original = [...cleaningJob.value.cleanerIds].sort()
  const edited = [...editingCleanerIds.value].sort()
  if (original.length !== edited.length)
    return true
  return original.some((id, idx) => id !== edited[idx])
})

const hasPriorityChanges = computed(() => {
  if (!cleaningJob.value)
    return false
  return cleaningJob.value.priority !== editingPriority.value
})

function toggleCleaner(cleanerId: string) {
  editingCleanerIds.value = editingCleanerIds.value.includes(cleanerId)
    ? editingCleanerIds.value.filter(id => id !== cleanerId)
    : [...editingCleanerIds.value, cleanerId]
}

function saveHousekeeping() {
  if (!cleaningJob.value || !hasHousekeepingChanges.value)
    return
  isSavingHousekeeping.value = true
  const names = resolveCleanerNames(editingCleanerIds.value)
  updateJob(cleaningJob.value.id, {
    cleanerIds: [...editingCleanerIds.value],
    cleanerNames: names,
  })
  toast.success(names.length
    ? `Assigned ${names.join(', ')}`
    : 'Housekeeping cleared')
  isSavingHousekeeping.value = false
  cleanerPickerOpen.value = false
}

function savePriority() {
  if (!cleaningJob.value || !hasPriorityChanges.value)
    return
  isSavingPriority.value = true
  updateJob(cleaningJob.value.id, { priority: editingPriority.value })
  toast.success(`Priority set to ${cleaningJobPriorityLabels[editingPriority.value]}`)
  isSavingPriority.value = false
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
    return
  }
}

function toggleCleaningStatus() {
  if (!cleaningJob.value)
    return
  const nextStatus = cleaningJob.value.status === 'done' ? 'scheduled' : 'done'
  updateJob(cleaningJob.value.id, { status: nextStatus })
  toast.success(`Marked as ${nextStatus === 'done' ? 'done' : 'scheduled'}`)
}

const eventTypeLabel = computed(() => {
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
</script>

<template>
  <Sheet :open="open" @update:open="$event ? emit('update:open', true) : close()">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
      <SheetHeader class="shrink-0 border-b px-6 py-4">
        <div class="flex items-center gap-2">
          <Badge variant="secondary" class="text-[10px] uppercase tracking-wider">
            {{ eventTypeLabel }}
          </Badge>
        </div>
        <SheetTitle class="leading-tight">
          {{ event?.title || 'Event details' }}
        </SheetTitle>
        <SheetDescription v-if="event?.listingName">
          {{ event.listingName }}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="event" class="flex flex-col gap-4 p-6">
          <!-- Time range -->
          <div class="flex items-center gap-2 text-sm">
          <Icon name="lucide:clock" class="h-4 w-4 text-muted-foreground" />
          <span>
            {{ formatDate(event.start) }} · {{ formatTime(event.start) }} – {{ formatTime(event.end) }}
          </span>
        </div>

        <!-- Cleaning job details (skipped when done — the report panel below replaces it) -->
        <template v-if="event.type === 'cleaning' && cleaningJob && cleaningJob.status !== 'done'">
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
              <p class="text-sm font-semibold" :class="{
                'text-emerald-700 dark:text-emerald-400': lockReason.label === 'Done',
                'text-amber-700 dark:text-amber-400': lockReason.label === 'In progress',
                'text-destructive': lockReason.label === 'Missed' || lockReason.label === 'Was missed' || lockReason.label === 'Cancelled',
              }">
                {{ lockReason.label }}
                <span v-if="lockReason.label === 'Was missed'" class="text-xs font-normal text-muted-foreground">
                  · {{ formatDate(cleaningJob.scheduledAt) }}
                </span>
                <span v-else-if="lockReason.label === 'Done'" class="text-xs font-normal text-muted-foreground">
                  · {{ formatDate(cleaningJob.scheduledAt) }}
                </span>
              </p>
              <p class="text-xs" :class="{
                'text-emerald-700/80 dark:text-emerald-400/80': lockReason.label === 'Done',
                'text-amber-700/80 dark:text-amber-400/80': lockReason.label === 'In progress',
                'text-destructive/80': lockReason.label === 'Missed' || lockReason.label === 'Was missed' || lockReason.label === 'Cancelled',
                'text-muted-foreground': lockReason.label === 'Locked',
              }">
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
              <p class="text-xs text-muted-foreground">Status</p>
              <p class="font-medium">{{ statusLabel }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Priority</p>
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
              <p class="text-xs text-muted-foreground">Guest in stay</p>
              <p class="font-medium">{{ event.guestName }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-muted-foreground">Housekeeping</p>
              <!-- Editable housekeeping -->
              <div v-if="isEditable" class="mt-1">
                <Popover v-model:open="cleanerPickerOpen">
                  <PopoverTrigger as-child>
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
                  </PopoverTrigger>
                  <PopoverContent class="w-72 p-0" align="start" :side-offset="4">
                    <div class="flex items-center gap-2 border-b px-3 py-2">
                      <Icon name="lucide:search" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <input
                        v-model="cleanerSearch"
                        class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search staff…"
                      >
                      <button v-if="cleanerSearch" class="shrink-0 text-muted-foreground hover:text-foreground" @click="cleanerSearch = ''">
                        <Icon name="lucide:x" class="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <ScrollArea class="h-56">
                      <div class="p-1">
                        <template v-if="filteredCleanerOptions.length > 0">
                          <button
                            v-for="cleaner in filteredCleanerOptions"
                            :key="cleaner.id"
                            type="button"
                            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                            :class="editingCleanerIds.includes(cleaner.id) ? 'bg-accent' : ''"
                            @click="toggleCleaner(cleaner.id)"
                          >
                            <div
                              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                                editingCleanerIds.includes(cleaner.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                              ]"
                            >
                              <Icon v-if="editingCleanerIds.includes(cleaner.id)" name="lucide:check" class="h-3 w-3" />
                            </div>
                            <div class="flex min-w-0 flex-col text-left">
                              <span class="truncate text-sm leading-tight">{{ cleaner.name }}</span>
                              <span class="text-xs text-muted-foreground">{{ cleaner.role }}</span>
                            </div>
                          </button>
                        </template>
                        <p v-else class="py-6 text-center text-sm text-muted-foreground">
                          No staff found
                        </p>
                      </div>
                    </ScrollArea>
                    <div class="flex items-center justify-end gap-2 border-t px-3 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        :disabled="isSavingHousekeeping || !hasHousekeepingChanges"
                        class="h-7 text-xs"
                        @click="cleanerPickerOpen = false"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        :disabled="isSavingHousekeeping || !hasHousekeepingChanges"
                        class="h-7 text-xs"
                        data-testid="detail-housekeeping-save"
                        @click="saveHousekeeping"
                      >
                        <Icon
                          v-if="isSavingHousekeeping"
                          name="lucide:loader-2"
                          class="mr-1 h-3 w-3 animate-spin"
                        />
                        Save
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <!-- Read-only housekeeping (locked) -->
              <div v-else>
                <p v-if="cleaningJob.cleanerNames.length" class="mt-1 flex flex-wrap gap-1">
                  <Badge v-for="name in cleaningJob.cleanerNames" :key="name" variant="secondary" class="text-[10px]">
                    {{ name }}
                  </Badge>
                </p>
                <p v-else class="font-medium text-muted-foreground">Unassigned</p>
              </div>
            </div>
            <div v-if="cleaningJob.notes" class="col-span-2">
              <p class="text-xs text-muted-foreground">Notes</p>
              <p class="mt-1 line-clamp-3 text-sm">{{ cleaningJob.notes }}</p>
            </div>
          </div>
        </template>

        <!-- Task details -->
        <template v-else-if="event.type === 'task' && task">
          <div class="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">Status</p>
              <p class="font-medium">{{ task.status }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Priority</p>
              <p class="font-medium capitalize">{{ task.priority }}</p>
            </div>
            <div v-if="task.dueDate" class="col-span-2">
              <p class="text-xs text-muted-foreground">Due date</p>
              <p class="font-medium">{{ formatDate(task.dueDate) }}</p>
            </div>
            <div v-if="task.images?.length" class="col-span-2">
              <p class="text-xs text-muted-foreground">Images</p>
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
            <p class="text-xs text-muted-foreground">Guest</p>
            <p class="font-medium">{{ event.guestName || event.title }}</p>
          </div>
        </template>

        <!-- Read-only events (owner stay, upsell) -->
        <template v-else>
          <div class="rounded-lg border bg-muted/30 p-3 text-sm">
            <p class="text-xs text-muted-foreground">Source</p>
            <p class="font-medium">{{ event.source || '—' }}</p>
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
