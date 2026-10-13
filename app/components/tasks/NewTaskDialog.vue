<script setup lang="ts">
import type { ScheduleEnd, ScheduleFrequency, TaskSchedule, TaskScheduleInput } from '@/components/tasks/data/schedule'
import type { NewTaskPrefill, Task } from '@/components/tasks/data/schema'
import { toast } from 'vue-sonner'
import { listings } from '@/components/listings/data/listings'
import { assigneeOptions, priorities } from '@/components/tasks/data/data'
import { addDays, describeRecurrence, formatDay, FREQUENCY_UNIT, parseDay, todayKey, WEEKDAY_ORDER, WEEKDAY_SHORT } from '@/components/tasks/data/schedule'
import { TASK_TITLE_MAX, taskTitleFromInstructions } from '@/components/tasks/data/task-title'
import { useTaskOwnerApproval } from '@/composables/useTaskOwnerApproval'
import { useTaskSchedules } from '@/composables/useTaskSchedules'
import { useTaskStore } from '@/composables/useTaskStore'

/**
 * The one "New Task" form. The Tasks page opens it empty; the inbox opens it
 * prefilled from the messages a task is raised from, so both create a task
 * the same way (owner approval, images) instead of the
 * inbox keeping a thinner form of its own.
 *
 * Two text fields: **Title** (required, what the table, cards and rooms show)
 * and **Instructions** (optional, stored in `Task.description`). A prefill
 * with instructions but no title (a task raised from inbox messages) suggests
 * their first line as the title (`taskTitleFromInstructions`).
 *
 * **Repeat** turns the task into a schedule (`useTaskSchedules`): the due date
 * becomes the first due date, the listing picker takes several listings (one
 * task each), and owner approval is hidden (a quote is per job, not per
 * schedule). Passing `schedule` opens the form on that schedule to edit it.
 *
 * Passing `task` opens it as **Edit Task** (`useTaskStore().editTask`, which
 * logs "changed the …" in the timeline). Edit has no Repeat, no owner
 * approval and no Assignee: who does the task changes through Reassign in the
 * detail sheet, which asks for a reason. The listing is locked once an owner
 * was asked to approve a quote, since the owner comes from the listing.
 */
const props = defineProps<{
  prefill?: NewTaskPrefill | null
  /** Edit this schedule instead of creating a task. */
  schedule?: TaskSchedule | null
  /** Edit this task instead of creating one. */
  task?: Task | null
  /** An extra line under the dialog description, e.g. where the task came from. */
  context?: string
}>()

const emit = defineEmits<{
  /** Fired before the dialog closes, so the caller can still read its own state. */
  created: [task: Task]
  /** A schedule was created or saved. */
  scheduled: [schedule: TaskSchedule]
  /** An edited task was saved. */
  saved: [task: Task]
}>()

const open = defineModel<boolean>('open', { default: false })

const { addTask, editTask } = useTaskStore()
const { ownerForTask, notifyApprovalRequested } = useTaskOwnerApproval()
const { addSchedule, updateSchedule } = useTaskSchedules()

const isEditingSchedule = computed(() => !!props.schedule)
const isEditingTask = computed(() => !!props.task)
/** The owner was asked about a quote for this listing, so it stays put. */
const listingLocked = computed(() => !!props.task?.ownerApprovalRequired)

/** Several listings when repeating (one task each), at most one otherwise. */
const selectedListings = ref<string[]>([])
const newListing = computed({
  get: () => selectedListings.value[0] ?? '',
  set: (name: string) => { selectedListings.value = name ? [name] : [] },
})

const assignee = ref('')
const assigneeType = ref<'role' | 'person'>('role')
const dueDate = ref('')
const newPriority = ref('medium')

const priorityFlagClass: Record<string, string> = {
  high: 'text-red-500',
  medium: 'text-blue-500',
  low: 'text-green-500',
}
const newTitle = ref('')
const newInstructions = ref('')
const newImages = ref<string[]>([])
const imageInputRef = ref<HTMLInputElement | null>(null)

// --- Owner cost approval -----------------------------------------------------
// Ticking this holds the task until the owner approves the quoted cost.
const needsOwnerApproval = ref(false)
const newEstimatedCost = ref<number>(0)

/** The owner who would be asked, derived from the selected listing. */
const approvalOwner = computed(() => ownerForTask({ listing: newListing.value }))

// --- Repeat -------------------------------------------------------------------
const repeat = ref<'none' | ScheduleFrequency>('none')
const isRepeating = computed(() => repeat.value !== 'none')
const repeatInterval = ref(1)
const repeatWeekdays = ref<number[]>([])
const endType = ref<ScheduleEnd['type']>('never')
const endDate = ref('')
const endCount = ref(10)
const leadDays = ref(2)

watch(repeat, (value, previous) => {
  if (value === 'none') {
    selectedListings.value = selectedListings.value.slice(0, 1)
    return
  }
  if (previous === 'none')
    needsOwnerApproval.value = false
  defaultWeekday()
})

// Weekly starts on the weekday of the first due date, whichever is set first.
function defaultWeekday() {
  if (repeat.value === 'weekly' && !repeatWeekdays.value.length && dueDate.value)
    repeatWeekdays.value = [parseDay(dueDate.value).getDay()]
}
watch(() => dueDate.value, defaultWeekday)

function toggleWeekday(day: number) {
  repeatWeekdays.value = repeatWeekdays.value.includes(day)
    ? repeatWeekdays.value.filter(d => d !== day)
    : [...repeatWeekdays.value, day]
}

const scheduleEnd = computed<ScheduleEnd>(() => {
  if (endType.value === 'on' && endDate.value)
    return { type: 'on', date: endDate.value }
  if (endType.value === 'after')
    return { type: 'after', count: Math.max(1, Math.floor(endCount.value || 1)) }
  return { type: 'never' }
})

const scheduleRule = computed(() => ({
  frequency: (isRepeating.value ? repeat.value : 'weekly') as ScheduleFrequency,
  interval: Math.max(1, Math.floor(repeatInterval.value || 1)),
  weekdays: repeat.value === 'weekly' ? repeatWeekdays.value : [],
  startDate: dueDate.value,
  end: scheduleEnd.value,
}))

const repeatSummary = computed(() => {
  if (!isRepeating.value || !dueDate.value)
    return ''
  return describeRecurrence(scheduleRule.value)
})

/** When the first task appears: lead time before the first due date, never before today. */
const firstCreatedOn = computed(() => {
  if (!dueDate.value)
    return ''
  const day = addDays(dueDate.value, -Math.max(0, leadDays.value || 0))
  return day <= todayKey() ? 'today' : formatDay(day)
})

const intervalUnit = computed(() => {
  if (!isRepeating.value)
    return ''
  const [one, many] = FREQUENCY_UNIT[repeat.value as ScheduleFrequency]
  return repeatInterval.value === 1 ? one : many
})

const listingButtonLabel = computed(() => {
  if (selectedListings.value.length > 1)
    return `${selectedListings.value.length} listings`
  return newListing.value || (isRepeating.value ? 'Select listings' : 'Select a listing')
})

/** What the edit would save, compared field by field by `editTask`. */
function taskEdit() {
  return {
    title: newTitle.value.trim(),
    description: newInstructions.value.trim() || undefined,
    listing: newListing.value || undefined,
    priority: newPriority.value,
    dueDate: dueDate.value || undefined,
    images: newImages.value.length ? [...newImages.value] : undefined,
  }
}

const hasTaskChanges = computed(() => {
  const task = props.task
  if (!task)
    return false
  const edit = taskEdit()
  return edit.title !== task.title
    || (edit.description ?? '') !== (task.description ?? '')
    || (edit.listing ?? '') !== (task.listing ?? '')
    || edit.priority !== task.priority
    || (edit.dueDate ?? '') !== (task.dueDate ?? '')
    || JSON.stringify(edit.images ?? []) !== JSON.stringify(task.images ?? [])
})

const canSubmit = computed(() => {
  if (!newTitle.value.trim())
    return false
  if (isEditingTask.value)
    return hasTaskChanges.value
  if (!isRepeating.value)
    return true
  if (!dueDate.value)
    return false
  if (repeat.value === 'weekly' && !repeatWeekdays.value.length)
    return false
  if (endType.value === 'on' && (!endDate.value || endDate.value < dueDate.value))
    return false
  return true
})

// Listing picker state
const listingPopoverOpen = ref(false)
const listingSearch = ref('')
const listingTagPopoverOpen = ref(false)
const listingTagSearch = ref('')
const selectedListingTags = ref<string[]>([])

// Assignee picker state
const assigneePopoverOpen = ref(false)
const assigneeSearch = ref('')
const assigneeTab = ref<'role' | 'person'>('role')

// Open on the tab of whoever is already picked.
watch(assigneePopoverOpen, (isOpen) => {
  if (isOpen)
    assigneeTab.value = assignee.value ? assigneeType.value : 'role'
})

const filteredListings = computed(() => {
  const query = listingSearch.value.trim().toLowerCase()
  return listings.value.filter((l) => {
    const haystack = `${l.name} ${l.location} ${l.tags.join(' ')}`.toLowerCase()
    if (query && !haystack.includes(query))
      return false
    if (selectedListingTags.value.length > 0 && !selectedListingTags.value.every(tag => l.tags.includes(tag)))
      return false
    return true
  })
})

const allListingTags = computed(() => {
  const tags = new Set<string>()
  for (const l of listings.value)
    l.tags.forEach(t => tags.add(t))
  return Array.from(tags).sort()
})

const filteredAssigneeOptions = computed(() => {
  const query = assigneeSearch.value.trim().toLowerCase()
  return assigneeOptions.filter(a => a.type === assigneeTab.value && (!query || a.label.toLowerCase().includes(query)))
})

function toggleListingTag(tag: string) {
  if (selectedListingTags.value.includes(tag))
    selectedListingTags.value = selectedListingTags.value.filter(t => t !== tag)
  else
    selectedListingTags.value = [...selectedListingTags.value, tag]
}

function selectListing(listingId: string) {
  const listing = listings.value.find(l => l.id === listingId)
  if (!listing)
    return
  // Repeating: toggle and keep the picker open to pick more.
  if (isRepeating.value) {
    selectedListings.value = selectedListings.value.includes(listing.name)
      ? selectedListings.value.filter(n => n !== listing.name)
      : [...selectedListings.value, listing.name]
    return
  }
  newListing.value = listing.name
  listingPopoverOpen.value = false
  listingSearch.value = ''
}

function selectAssignee(opt: typeof assigneeOptions[number]) {
  assignee.value = opt.value
  assigneeType.value = opt.type
  assigneePopoverOpen.value = false
  assigneeSearch.value = ''
}

function handleCreateImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files)
    return
  Array.from(files).forEach((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      newImages.value = [...newImages.value, dataUrl]
    }
    reader.readAsDataURL(file)
  })
  input.value = ''
}

function removeNewImage(index: number) {
  newImages.value = newImages.value.filter((_, i) => i !== index)
}

function resetForm() {
  selectedListings.value = []
  repeat.value = 'none'
  repeatInterval.value = 1
  repeatWeekdays.value = []
  endType.value = 'never'
  endDate.value = ''
  endCount.value = 10
  leadDays.value = 2
  needsOwnerApproval.value = false
  newEstimatedCost.value = 0
  assignee.value = ''
  assigneeType.value = 'role'
  dueDate.value = ''
  newPriority.value = 'medium'
  newTitle.value = ''
  newInstructions.value = ''
  newImages.value = []
  listingSearch.value = ''
  listingTagSearch.value = ''
  selectedListingTags.value = []
  assigneeSearch.value = ''
}

function applyPrefill(prefill: NewTaskPrefill) {
  newListing.value = prefill.listing ?? ''
  const option = assigneeOptions.find(o => o.value === prefill.assignee)
  assignee.value = option?.value ?? ''
  assigneeType.value = option?.type ?? 'role'
  newInstructions.value = prefill.instructions ?? ''
  newTitle.value = prefill.title ?? taskTitleFromInstructions(newInstructions.value)
  newImages.value = [...(prefill.images ?? [])]
}

function applySchedule(schedule: TaskSchedule) {
  newTitle.value = schedule.title
  newInstructions.value = schedule.instructions
  selectedListings.value = [...schedule.listings]
  const option = assigneeOptions.find(o => o.value === schedule.assignee)
  assignee.value = option?.value ?? ''
  assigneeType.value = option?.type ?? 'role'
  newPriority.value = schedule.priority
  newImages.value = [...(schedule.images ?? [])]
  dueDate.value = schedule.startDate
  repeatInterval.value = schedule.interval
  repeatWeekdays.value = [...schedule.weekdays]
  endType.value = schedule.end.type
  endDate.value = schedule.end.type === 'on' ? schedule.end.date : ''
  endCount.value = schedule.end.type === 'after' ? schedule.end.count : 10
  leadDays.value = schedule.leadDays
  repeat.value = schedule.frequency
}

function applyTask(task: Task) {
  newTitle.value = task.title
  newInstructions.value = task.description ?? ''
  newListing.value = task.listing ?? ''
  newPriority.value = task.priority
  dueDate.value = task.dueDate ?? ''
  newImages.value = [...(task.images ?? [])]
}

// Opening fills the form from the task, the schedule or the prefill; closing,
// however it happens (Cancel, Escape, a click outside, or after Create),
// clears it.
watch(open, (isOpen) => {
  if (isOpen && props.task)
    applyTask(props.task)
  else if (isOpen && props.schedule)
    applySchedule(props.schedule)
  else if (isOpen && props.prefill)
    applyPrefill(props.prefill)
  else if (!isOpen)
    resetForm()
})

function scheduleInput(): TaskScheduleInput {
  return {
    ...scheduleRule.value,
    title: newTitle.value.trim(),
    instructions: newInstructions.value.trim(),
    listings: [...selectedListings.value],
    assignee: assignee.value || undefined,
    assigneeType: assignee.value ? assigneeType.value : undefined,
    priority: newPriority.value,
    images: newImages.value.length ? [...newImages.value] : undefined,
    leadDays: Math.max(0, Math.floor(leadDays.value || 0)),
  }
}

function createdCount(count: number): string {
  return count === 1 ? '1 task created for the first date' : `${count} tasks created for the first date`
}

function handleSaveSchedule() {
  if (props.schedule) {
    const created = updateSchedule(props.schedule.id, scheduleInput())
    toast.success(created.length ? `Schedule saved, ${createdCount(created.length)}.` : 'Schedule saved. Changes apply to the next tasks.')
    emit('scheduled', props.schedule)
  }
  else {
    const { schedule, created } = addSchedule(scheduleInput())
    toast.success(created.length
      ? `Schedule created, ${createdCount(created.length)}.`
      : `Schedule created. The first task appears ${firstCreatedOn.value === 'today' ? 'today' : `on ${firstCreatedOn.value}`}.`)
    emit('scheduled', schedule)
  }
  open.value = false
}

function handleSaveTask() {
  const task = props.task!
  const changes = editTask(task.id, taskEdit())
  if (changes.length)
    toast.success('Task updated')
  emit('saved', task)
  open.value = false
}

function handleSubmit() {
  if (!canSubmit.value)
    return
  if (isEditingTask.value)
    handleSaveTask()
  else if (isRepeating.value || isEditingSchedule.value)
    handleSaveSchedule()
  else
    handleCreateTask()
}

function handleCreateTask() {
  if (!newTitle.value.trim())
    return
  const created = addTask({
    title: newTitle.value.trim(),
    status: 'not started',
    assignee: assignee.value || undefined,
    assigneeType: assignee.value ? assigneeType.value : undefined,
    priority: newPriority.value,
    listing: newListing.value || undefined,
    description: newInstructions.value.trim() || undefined,
    dueDate: dueDate.value || undefined,
    images: newImages.value.length ? newImages.value : undefined,
    // Owner cost approval — the task is held until the owner decides.
    ownerApprovalRequired: needsOwnerApproval.value ? true : undefined,
    ownerApprovalStatus: needsOwnerApproval.value ? 'pending' : undefined,
    estimatedCost: needsOwnerApproval.value ? newEstimatedCost.value : undefined,
    ownerId: needsOwnerApproval.value ? approvalOwner.value?.id : undefined,
    ownerVisible: needsOwnerApproval.value ? true : undefined,
    // The approval state lives in the timeline, so the wait starts there too.
    statusUpdates: needsOwnerApproval.value
      ? [{
          date: new Date().toISOString(),
          actor: { name: 'Komang Juliantara', kind: 'staff' as const },
          icon: 'lucide:clock',
          note: `sent the IDR ${newEstimatedCost.value.toLocaleString('en-US')} quote to ${approvalOwner.value?.name ?? 'the owner'} for approval`,
          progress: 0,
        }]
      : undefined,
  })
  if (needsOwnerApproval.value) {
    notifyApprovalRequested(created)
    toast.success(`Task created — waiting on ${approvalOwner.value?.name ?? 'the owner'} to approve the cost.`)
  }
  else {
    toast.success('Task created')
  }
  emit('created', created)
  open.value = false
}

// Local date: `toISOString()` reads a Bali morning as yesterday.
const todayDate = todayKey()

const dialogTitle = computed(() => {
  if (isEditingTask.value)
    return 'Edit Task'
  return isEditingSchedule.value ? 'Edit Schedule' : 'New Task'
})

const submitLabel = computed(() => {
  if (isEditingTask.value)
    return 'Save Changes'
  if (isEditingSchedule.value)
    return 'Save Schedule'
  return isRepeating.value ? 'Create Schedule' : 'Create Task'
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription v-if="isEditingTask">
          Changes show in the task's timeline.
        </DialogDescription>
        <DialogDescription v-else :class="{ 'sr-only': !context }">
          {{ context || 'Describe the task for your team.' }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-4 py-2">
        <div class="flex flex-col gap-1.5">
          <Label for="new-task-title">Title <span class="text-destructive">*</span></Label>
          <Input
            id="new-task-title"
            v-model="newTitle"
            :maxlength="TASK_TITLE_MAX"
            placeholder="e.g. AC not cooling in the master bedroom"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="new-task-instructions">Instructions</Label>
          <Textarea
            id="new-task-instructions"
            v-model="newInstructions"
            placeholder="e.g. Check the filter and the outdoor unit. Turn the breaker off before opening the housing."
            rows="4"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Listing</Label>
          <Popover v-model:open="listingPopoverOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-between" :disabled="listingLocked">
                <span class="truncate">{{ listingButtonLabel }}</span>
                <Icon name="lucide:chevrons-up-down" class="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[380px] p-0" align="start">
              <Command>
                <div class="flex w-full items-center">
                  <div class="flex-1 min-w-0">
                    <CommandInput v-model="listingSearch" placeholder="Search listing or location..." class="border-0 focus:ring-0" />
                  </div>
                  <div class="pr-2">
                    <Popover v-model:open="listingTagPopoverOpen">
                      <PopoverTrigger as-child>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-7 gap-1 px-2 text-xs"
                          :class="selectedListingTags.length ? 'bg-primary/10 text-foreground hover:bg-primary/20' : 'text-muted-foreground'"
                        >
                          <Icon name="lucide:tags" class="size-3.5" />
                          Tags
                          <Badge v-if="selectedListingTags.length" variant="default" class="ml-0.5 h-4 px-1 text-[10px]">
                            {{ selectedListingTags.length }}
                          </Badge>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-56 p-0" align="end">
                        <div class="space-y-2 p-2">
                          <Input v-model="listingTagSearch" placeholder="Search tags..." class="h-8 text-xs" />
                          <div class="max-h-40 space-y-1 overflow-auto">
                            <button
                              v-for="tag in allListingTags.filter(t => t.toLowerCase().includes(listingTagSearch.trim().toLowerCase()))"
                              :key="tag"
                              type="button"
                              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                              @click="toggleListingTag(tag)"
                            >
                              <Checkbox :model-value="selectedListingTags.includes(tag)" class="size-3.5" />
                              <span>{{ tag }}</span>
                            </button>
                            <p v-if="!allListingTags.filter(t => t.toLowerCase().includes(listingTagSearch.trim().toLowerCase())).length" class="px-2 py-3 text-sm text-muted-foreground">
                              No tags found.
                            </p>
                          </div>
                          <Button v-if="selectedListingTags.length" variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="selectedListingTags = []">
                            Clear all
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <CommandList>
                  <CommandEmpty>
                    <div v-if="listingSearch.trim() || selectedListingTags.length" class="py-3 text-center">
                      <p class="text-sm text-muted-foreground">
                        No listing found.
                      </p>
                    </div>
                    <div v-else class="py-3 text-center text-sm text-muted-foreground">
                      Type to search...
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      v-for="listing in filteredListings"
                      :key="listing.id"
                      :value="listing.name"
                      class="cursor-pointer"
                      @select="selectListing(listing.id)"
                    >
                      <div class="flex items-start gap-2 w-full">
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-medium">
                            {{ listing.name }}
                          </p>
                          <p class="text-xs text-muted-foreground">
                            {{ listing.location }}
                          </p>
                          <div class="mt-1 flex flex-wrap gap-1">
                            <Badge v-for="tag in listing.tags" :key="tag" variant="outline" class="text-[10px]">
                              {{ tag }}
                            </Badge>
                          </div>
                        </div>
                        <Icon v-if="selectedListings.includes(listing.name)" name="lucide:check" class="size-4 text-primary mt-1" />
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p v-if="isRepeating" class="text-xs text-muted-foreground">
            Each listing gets its own task every time.
          </p>
          <p v-else-if="listingLocked" class="text-xs text-muted-foreground">
            The owner of this listing was asked to approve the quote, so the listing cannot change.
          </p>
        </div>

        <!-- Owner cost approval — holds the task until the owner decides. Not
             offered on a schedule: a quote is for one job. -->
        <div v-if="!isRepeating && !isEditingTask" class="rounded-md border p-3 space-y-3">
          <div
            class="flex items-start gap-2.5 cursor-pointer"
            role="checkbox"
            :aria-checked="needsOwnerApproval"
            tabindex="0"
            @click="needsOwnerApproval = !needsOwnerApproval"
            @keydown.space.prevent="needsOwnerApproval = !needsOwnerApproval"
          >
            <div
              class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
              :class="needsOwnerApproval ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
            >
              <Icon v-if="needsOwnerApproval" name="lucide:check" class="size-3" />
            </div>
            <div class="space-y-0.5">
              <p class="text-sm font-medium leading-none">
                Needs owner approval before work starts
              </p>
              <p class="text-xs text-muted-foreground">
                The owner is charged for this. They see the quote in their portal and must approve it first.
              </p>
            </div>
          </div>

          <div v-if="needsOwnerApproval" class="space-y-3 border-t pt-3">
            <div class="space-y-1.5">
              <Label for="task-estimated-cost">Estimated cost (IDR)</Label>
              <Input id="task-estimated-cost" v-model.number="newEstimatedCost" type="number" min="0" step="50000" />
            </div>
            <p v-if="!newListing" class="text-xs text-destructive">
              Pick a listing so we know which owner to ask.
            </p>
            <p v-else-if="!approvalOwner" class="text-xs text-destructive">
              No owner is mapped to that listing — nobody can approve it.
            </p>
            <p v-else class="text-xs text-muted-foreground">
              <Icon name="lucide:user-round-check" class="mr-1 inline size-3" />
              {{ approvalOwner.name }} will be asked to approve.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <!-- Editing: who does it changes through Reassign, with a reason. -->
          <div v-if="!isEditingTask" class="flex flex-col gap-1.5">
            <Label>Assignee</Label>
            <Popover v-model:open="assigneePopoverOpen">
              <PopoverTrigger as-child>
                <Button variant="outline" class="w-full justify-between h-10">
                  {{ assigneeOptions.find(a => a.value === assignee)?.label || 'Unassigned' }}
                  <Icon name="lucide:chevrons-up-down" class="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[280px] p-0" align="start">
                <Tabs v-model="assigneeTab" class="gap-0">
                  <div class="border-b p-1.5">
                    <TabsList class="grid w-full grid-cols-2">
                      <TabsTrigger value="role">
                        Roles
                      </TabsTrigger>
                      <TabsTrigger value="person">
                        Users
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </Tabs>
                <Command>
                  <CommandInput v-model="assigneeSearch" :placeholder="assigneeTab === 'role' ? 'Search roles...' : 'Search users...'" />
                  <CommandList>
                    <CommandEmpty>No match found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        v-for="opt in filteredAssigneeOptions"
                        :key="opt.value"
                        :value="opt.label"
                        class="cursor-pointer"
                        @select="selectAssignee(opt)"
                      >
                        <div class="flex items-center gap-2 w-full">
                          <Icon :name="opt.type === 'role' ? 'lucide:badge' : 'lucide:user'" class="size-4 text-muted-foreground" />
                          <span>{{ opt.label }}</span>
                          <Icon v-if="assignee === opt.value" name="lucide:check" class="size-4 text-primary ml-auto" />
                        </div>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select v-model="newPriority">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in priorities" :key="p.value" :value="p.value">
                  <Icon name="lucide:flag" class="size-4" :class="priorityFlagClass[p.value]" />
                  {{ p.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <Label for="new-task-due-date">
              {{ isRepeating ? 'First due date' : 'Due Date' }}
              <span v-if="isRepeating" class="text-destructive">*</span>
            </Label>
            <Input id="new-task-due-date" v-model="dueDate" type="date" :min="todayDate" />
          </div>
          <div v-if="!isEditingTask" class="flex flex-col gap-1.5">
            <Label>Repeat</Label>
            <Select v-model="repeat">
              <SelectTrigger data-testid="new-task-repeat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <!-- A schedule being edited cannot be turned back into one task. -->
                <SelectItem v-if="!isEditingSchedule" value="none">
                  Does not repeat
                </SelectItem>
                <SelectItem value="daily">
                  Daily
                </SelectItem>
                <SelectItem value="weekly">
                  Weekly
                </SelectItem>
                <SelectItem value="monthly">
                  Monthly
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Repeat rule: only when the task repeats. -->
        <div v-if="isRepeating" class="space-y-4 rounded-md border p-3" data-testid="new-task-repeat-rule">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <Label for="new-task-interval" class="font-normal">Every</Label>
            <Input id="new-task-interval" v-model.number="repeatInterval" type="number" min="1" step="1" class="h-8 w-16" />
            <span>{{ intervalUnit }}</span>
          </div>

          <div v-if="repeat === 'weekly'" class="flex flex-col gap-1.5">
            <Label>On</Label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="day in WEEKDAY_ORDER"
                :key="day"
                type="button"
                class="h-8 w-11 rounded-md border text-xs font-medium transition-colors"
                :class="repeatWeekdays.includes(day) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
                :aria-pressed="repeatWeekdays.includes(day)"
                @click="toggleWeekday(day)"
              >
                {{ WEEKDAY_SHORT[day] }}
              </button>
            </div>
            <p v-if="!repeatWeekdays.length" class="text-xs text-destructive">
              Pick at least one day.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Ends</Label>
              <Select v-model="endType">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">
                    Never
                  </SelectItem>
                  <SelectItem value="on">
                    On a date
                  </SelectItem>
                  <SelectItem value="after">
                    After a number of times
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="endType === 'on'" class="flex flex-col gap-1.5">
              <Label for="new-task-end-date">Last date</Label>
              <Input id="new-task-end-date" v-model="endDate" type="date" :min="dueDate || todayDate" />
            </div>
            <div v-else-if="endType === 'after'" class="flex flex-col gap-1.5">
              <Label for="new-task-end-count">Times</Label>
              <Input id="new-task-end-count" v-model.number="endCount" type="number" min="1" step="1" />
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span>Create each task</span>
            <Input id="new-task-lead-days" v-model.number="leadDays" type="number" min="0" step="1" class="h-8 w-16" aria-label="Days before the due date" />
            <span>{{ leadDays === 1 ? 'day' : 'days' }} before it is due</span>
          </div>

          <p v-if="repeatSummary" class="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="new-task-repeat-summary">
            <Icon name="lucide:repeat" class="mt-0.5 size-3.5 shrink-0" />
            <span>{{ repeatSummary }}. The first task appears {{ firstCreatedOn === 'today' ? 'today' : `on ${firstCreatedOn}` }}.</span>
          </p>
          <p v-else class="text-xs text-muted-foreground">
            Pick the first due date to start the schedule.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Images</Label>
          <div class="flex flex-wrap gap-2">
            <div v-for="(img, idx) in newImages" :key="idx" class="relative group">
              <img :src="img" alt="" class="h-16 w-16 rounded-md border object-cover">
              <button
                class="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                @click="removeNewImage(idx)"
              >
                <Icon name="lucide:x" class="h-3 w-3" />
              </button>
            </div>
            <button
              class="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/50 transition-colors"
              @click="imageInputRef?.click()"
            >
              <Icon name="lucide:plus" class="h-4 w-4" />
            </button>
          </div>
          <input
            ref="imageInputRef"
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="handleCreateImageUpload"
          >
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!canSubmit" @click="handleSubmit">
          {{ submitLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
