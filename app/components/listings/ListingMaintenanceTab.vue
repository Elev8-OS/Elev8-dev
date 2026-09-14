<script setup lang="ts">
import type { Listing, MaintenanceTask, Unit } from '~/components/listings/data/listings'
import type { CustomCleaningFrequency, DayOfWeek, ListingCleaningConfig, ReservationCleaningType } from '~/components/reservations/data/cleaning-schedule'
import { toast } from 'vue-sonner'
import CleaningJobForm from '~/components/cleaning/CleaningJobForm.vue'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { CLEANING_TYPE_OPTIONS, DAY_OF_WEEK_OPTIONS, formatListingCleaningSummary } from '~/components/reservations/data/cleaning-schedule'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { useCleaningJobs } from '~/composables/useCleaningJobs'

const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const showAddDialog = ref(false)
const showCleaningDialog = ref(false)
const showDefaultScheduleDialog = ref(false)
const newTask = ref({ title: '', assignedTo: '', type: 'cleaning' as MaintenanceTask['type'] })
const { createJob, jobsForListing, resolveCleanerNames } = useCleaningJobs()

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
  toast.success('Default reservation cleaning configuration saved')
}

const statusColors: Record<string, string> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'outline',
}

const frequencyLabels: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
}

const pendingTasks = computed(() => props.listing.maintenance.tasks.filter(t => t.status !== 'completed'))
const completedTasks = computed(() => props.listing.maintenance.tasks.filter(t => t.status === 'completed'))
const cleaningJobs = computed(() => jobsForListing(props.listing.id))

function addTask() {
  if (!newTask.value.title.trim())
    return
  const task: MaintenanceTask = {
    id: `mt-${Date.now()}`,
    title: newTask.value.title.trim(),
    date: new Date().toISOString().split('T')[0]!,
    assignedTo: newTask.value.assignedTo || 'Unassigned',
    status: 'pending',
    type: newTask.value.type,
  }
  emit('update', {
    ...props.listing,
    maintenance: { ...props.listing.maintenance, tasks: [...props.listing.maintenance.tasks, task] },
  })
  newTask.value = { title: '', assignedTo: '', type: 'cleaning' }
  showAddDialog.value = false
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function handleSaveCleaningJob(jobInput: Parameters<typeof createJob>[0]) {
  createJob({
    ...jobInput,
    listingId: props.listing.id,
    listingName: props.listing.name,
    cleanerNames: resolveCleanerNames(jobInput.cleanerIds ?? []),
  })
  showCleaningDialog.value = false
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card class="p-5">
      <h3 class="text-sm font-semibold mb-4">
        Cleaning Schedule
      </h3>
      <Table v-if="listing.maintenance.cleaningSchedule.length > 0">
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Frequency</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="item in listing.maintenance.cleaningSchedule" :key="item.task">
            <TableCell class="font-medium">
              {{ item.task }}
            </TableCell>
            <TableCell>
              <Badge variant="outline" class="text-xs">
                {{ frequencyLabels[item.frequency] }}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <p v-else class="text-sm text-muted-foreground">
        No cleaning schedule configured.
      </p>
    </Card>

    <!-- Default Reservation Housekeeping -->
    <Card class="p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold">
              Default Reservation Housekeeping
            </h3>
            <Badge
              v-if="listing.maintenance?.defaultCleaningSchedule"
              variant="secondary"
              class="h-5 px-2 text-[10px] font-medium capitalize"
            >
              {{ listing.maintenance.defaultCleaningSchedule.type }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">
            Default schedule automatically applied to guest reservations for this listing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="gap-1.5 text-xs"
          @click="openDefaultScheduleModal"
        >
          <Icon name="lucide:settings-2" class="size-3.5" />
          {{ listing.maintenance?.defaultCleaningSchedule ? 'Configure' : 'Set Default' }}
        </Button>
      </div>

      <div
        v-if="listing.maintenance?.defaultCleaningSchedule"
        class="rounded-lg border bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="space-y-1 min-w-0">
          <p class="text-xs font-semibold text-foreground">
            {{ formatListingCleaningSummary(listing.maintenance.defaultCleaningSchedule) }}
          </p>
          <p class="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Icon name="lucide:user" class="size-3" />
            Assigned cleaner(s):
            <span class="font-medium text-foreground">
              {{ listingCleanerNames.join(', ') || 'Unassigned' }}
            </span>
          </p>
        </div>
      </div>
      <p v-else class="text-xs text-muted-foreground italic">
        No default cleaning configured. New reservations will default to standard daily cleaning.
      </p>
    </Card>

    <Card class="p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">
            Cleaning Jobs
          </h3>
          <p class="text-xs text-muted-foreground">
            All cleaning work for this listing.
          </p>
        </div>
        <Dialog v-model:open="showCleaningDialog">
          <DialogTrigger as-child>
            <Button size="sm" variant="outline" class="h-7 gap-1 text-xs">
              <Icon name="lucide:plus" class="size-3" />
              New Cleaning
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Cleaning Job</DialogTitle>
              <DialogDescription>Create or update a cleaning assignment for this listing.</DialogDescription>
            </DialogHeader>
            <CleaningJobForm
              :default-listing-id="listing.id"
              :default-listing-name="listing.name"
              @cancel="showCleaningDialog = false"
              @save="handleSaveCleaningJob"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div v-if="cleaningJobs.length > 0" class="flex flex-col gap-3">
        <div v-for="job in cleaningJobs" :key="job.id" class="rounded-lg border bg-card p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <p class="text-sm font-medium">
                {{ job.scheduledAt.slice(0, 10) }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ job.cleanerNames?.length ? job.cleanerNames.join(', ') : 'Unassigned' }} · {{ job.teamName || 'Unassigned' }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ job.notes }}
              </p>
            </div>
            <div class="flex flex-col items-end gap-2">
              <Badge variant="secondary" class="text-xs">
                {{ job.status.replace('_', ' ') }}
              </Badge>
              <Badge variant="outline" class="text-xs">
                {{ job.priority }}
              </Badge>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="py-4 text-center text-sm text-muted-foreground">
        No cleaning jobs yet.
      </p>
    </Card>

    <Card class="p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold">
          Upcoming Tasks
        </h3>
        <Dialog v-model:open="showAddDialog">
          <DialogTrigger as-child>
            <Button size="sm" variant="outline" class="h-7 gap-1 text-xs">
              <Icon name="lucide:plus" class="size-3" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Maintenance Task</DialogTitle>
            </DialogHeader>
            <div class="flex flex-col gap-4 py-4">
              <div class="flex flex-col gap-1.5">
                <Label>Task Title</Label>
                <Input v-model="newTask.title" placeholder="e.g. Fix leaking faucet" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Assigned To</Label>
                <Input v-model="newTask.assignedTo" placeholder="e.g. Wayan Adi" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select v-model="newTask.type">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">
                      Cleaning
                    </SelectItem>
                    <SelectItem value="repair">
                      Repair
                    </SelectItem>
                    <SelectItem value="inspection">
                      Inspection
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button @click="addTask">
                Add Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div class="flex flex-col gap-3">
        <div v-for="task in pendingTasks" :key="task.id" class="flex items-center justify-between rounded-lg border p-3">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">{{ task.title }}</span>
            <span class="text-xs text-muted-foreground">{{ formatDate(task.date) }} · {{ task.assignedTo }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline" class="text-xs capitalize">
              {{ task.type }}
            </Badge>
            <Badge :variant="(statusColors[task.status] as any)" class="text-xs capitalize">
              {{ task.status.replace('_', ' ') }}
            </Badge>
          </div>
        </div>
        <p v-if="pendingTasks.length === 0" class="text-sm text-muted-foreground text-center py-4">
          No pending tasks.
        </p>
      </div>
    </Card>

    <Card class="p-5">
      <h3 class="text-sm font-semibold mb-4">
        Completed
      </h3>
      <div class="flex flex-col gap-3">
        <div v-for="task in completedTasks" :key="task.id" class="flex items-center justify-between rounded-lg border border-dashed p-3 opacity-60">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium line-through">{{ task.title }}</span>
            <span class="text-xs text-muted-foreground">{{ formatDate(task.date) }} · {{ task.assignedTo }}</span>
          </div>
          <Badge variant="outline" class="text-xs capitalize">
            {{ task.type }}
          </Badge>
        </div>
        <p v-if="completedTasks.length === 0" class="text-sm text-muted-foreground text-center py-4">
          No completed tasks.
        </p>
      </div>
    </Card>

    <!-- Default Housekeeping Dialog -->
    <Dialog v-model:open="showDefaultScheduleDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Default Reservation Cleaning</DialogTitle>
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
