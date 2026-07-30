<script setup lang="ts">
import type { CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'
import { toast } from 'vue-sonner'
import { useTaskStore } from '@/composables/useTaskStore'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { assigneeOptions, assigneeRoles, staffMembers } from '~/components/tasks/data/data'
import ListingPicker from '~/components/operations-calendar/ListingPicker.vue'
import GuestInfoCard from '~/components/operations-calendar/GuestInfoCard.vue'

const props = defineProps<{
  open: boolean
  listingId?: string
  dayKey?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { addTask } = useTaskStore()
const { createJob, resolveCleanerNames, resolveListingName } = useCleaningJobs()

const activeTab = ref<'cleaning' | 'task'>('cleaning')

const taskInstructions = ref('')
const taskPriority = ref('medium')
const taskDueDate = ref(props.dayKey)
const taskListingId = ref<string>(props.listingId ?? '')
const taskListingName = ref<string>(props.listingId ? resolveListingName(props.listingId) : '')
const taskImages = ref<string[]>([])
const taskImageInputRef = ref<HTMLInputElement | null>(null)

const taskAssignee = ref<string | null>(null)
const taskAssigneeType = ref<'role' | 'person' | null>(null)

const assigneePickerOpen = ref(false)
const assigneeTab = ref<'roles' | 'users'>('roles')
const assigneeSearch = ref('')

watch(() => props.dayKey, (key) => {
  taskDueDate.value = key
})

watch(() => props.listingId, (id) => {
  if (id) {
    taskListingId.value = id
    taskListingName.value = resolveListingName(id)
  }
})

const priorities = [
  { value: 'low', label: 'Low', color: '#16a34a' },
  { value: 'medium', label: 'Medium', color: '#2563eb' },
  { value: 'high', label: 'High', color: '#dc2626' },
]

const canCreateTask = computed(() =>
  Boolean(taskInstructions.value.trim())
  && Boolean(taskListingId.value),
)

const priorityPickerOpen = ref(false)
const selectedPriority = computed(() => priorities.find(p => p.value === taskPriority.value) ?? priorities[1])

const filteredRoles = computed(() => {
  const q = assigneeSearch.value.trim().toLowerCase()
  if (!q)
    return assigneeRoles
  return assigneeRoles.filter(r => r.label.toLowerCase().includes(q) || r.value.toLowerCase().includes(q))
})

const filteredStaff = computed(() => {
  const q = assigneeSearch.value.trim().toLowerCase()
  if (!q)
    return staffMembers
  return staffMembers.filter(s => s.label.toLowerCase().includes(q) || s.role.toLowerCase().includes(q))
})

const selectedAssignee = computed(() => {
  if (!taskAssignee.value)
    return null
  return assigneeOptions.find(o => o.value === taskAssignee.value) ?? null
})

const assigneeRoleLabel = computed(() => {
  if (!taskAssignee.value)
    return ''
  if (taskAssigneeType.value === 'person') {
    const staff = staffMembers.find(s => s.value === taskAssignee.value)
    if (!staff)
      return ''
    const role = assigneeRoles.find(r => r.value === staff.role)
    return role?.label ?? staff.role
  }
  return ''
})

function pickAssignee(value: string, type: 'role' | 'person') {
  // Toggle off if same value already selected; otherwise replace
  if (taskAssignee.value === value && taskAssigneeType.value === type) {
    taskAssignee.value = null
    taskAssigneeType.value = null
  }
  else {
    taskAssignee.value = value
    taskAssigneeType.value = type
  }
  assigneePickerOpen.value = false
  assigneeSearch.value = ''
}

function clearAssignee() {
  taskAssignee.value = null
  taskAssigneeType.value = null
}

function resetTaskForm() {
  taskInstructions.value = ''
  taskPriority.value = 'medium'
  taskDueDate.value = props.dayKey
  taskListingId.value = props.listingId ?? ''
  taskListingName.value = props.listingId ? resolveListingName(props.listingId) : ''
  taskImages.value = []
  taskAssignee.value = null
  taskAssigneeType.value = null
  assigneeSearch.value = ''
  assigneeTab.value = 'roles'
  if (taskImageInputRef.value)
    taskImageInputRef.value.value = ''
}

function close() {
  emit('update:open', false)
  resetTaskForm()
}

function toBaliDateTime(localValue: string) {
  if (localValue.includes('+') || localValue.endsWith('Z'))
    return localValue
  if (localValue.length === 16)
    return `${localValue}:00+08:00`
  if (localValue.length === 19)
    return `${localValue}+08:00`
  return localValue
}

function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files)
    return
  Array.from(files).forEach((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      taskImages.value = [...taskImages.value, dataUrl]
    }
    reader.readAsDataURL(file)
  })
  input.value = ''
}

function removeImage(index: number) {
  taskImages.value = taskImages.value.filter((_, i) => i !== index)
}

function handleCleaningSave(input: CleaningJobInput) {
  createJob({
    ...input,
    scheduledAt: toBaliDateTime(input.scheduledAt),
    cleanerNames: resolveCleanerNames(input.cleanerIds ?? []),
    listingName: input.listingId ? resolveListingName(input.listingId) : input.listingName,
  })
  toast.success('Cleaning job created')
  close()
}

function handleCreateTask() {
  if (!taskInstructions.value.trim())
    return
  addTask({
    title: taskInstructions.value.trim(),
    status: 'todo',
    priority: taskPriority.value,
    listing: taskListingName.value || (taskListingId.value ? resolveListingName(taskListingId.value) : undefined),
    dueDate: taskDueDate.value,
    images: taskImages.value.length ? taskImages.value : undefined,
    assignee: taskAssignee.value ?? undefined,
    assigneeType: taskAssigneeType.value ?? undefined,
  })
  toast.success('Task created')
  close()
}
</script>

<template>
  <Dialog :open="open" @update:open="$event ? emit('update:open', true) : close()">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Create operation</DialogTitle>
        <DialogDescription>
          Add a new cleaning job or task for {{ listingId ? resolveListingName(listingId) : 'selected listing' }} on {{ dayKey }}.
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="mt-2">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="cleaning">
            Cleaning
          </TabsTrigger>
          <TabsTrigger value="task">
            Task
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cleaning" class="mt-4">
          <CleaningJobForm
            mode="create"
            :default-listing-id="listingId"
            :default-scheduled-at="dayKey ? `${dayKey}T11:00` : undefined"
            @cancel="close"
            @save="handleCleaningSave"
          />
        </TabsContent>

        <TabsContent value="task" class="mt-4">
          <div class="flex flex-col gap-4">
            <p class="text-xs text-muted-foreground">
              Fields marked with <span class="text-destructive">*</span> are required.
            </p>

            <div class="flex flex-col gap-1.5">
              <Label>Instructions <span class="text-destructive">*</span></Label>
              <Input v-model="taskInstructions" placeholder="e.g. Check AC filter and replace if needed" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Listing <span class="text-destructive">*</span></Label>
              <ListingPicker
                v-model="taskListingId"
                v-model:listing-name="taskListingName"
                placeholder="Choose a listing"
              />
              <GuestInfoCard v-if="taskListingId" :listing-id="taskListingId" :target-date="taskDueDate" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <Label>Due date</Label>
                <Input v-model="taskDueDate" type="date" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Priority</Label>
                <Popover v-model:open="priorityPickerOpen">
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      class="h-9 w-full justify-start gap-2 px-3 text-sm font-normal"
                    >
                      <Icon name="lucide:flag" class="h-4 w-4" :style="{ color: selectedPriority.color }" />
                      <span class="flex-1 truncate text-left">{{ selectedPriority.label }}</span>
                      <Icon name="lucide:chevrons-up-down" class="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-56 p-1" align="start" :side-offset="4">
                    <button
                      v-for="p in priorities"
                      :key="p.value"
                      type="button"
                      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                      :class="taskPriority === p.value ? 'bg-accent' : ''"
                      @click="taskPriority = p.value; priorityPickerOpen = false"
                    >
                      <Icon name="lucide:flag" class="h-4 w-4 shrink-0" :style="{ color: p.color }" />
                      <span class="flex-1 truncate text-left">{{ p.label }}</span>
                      <Icon v-if="taskPriority === p.value" name="lucide:check" class="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Assign task to</Label>
              <Popover v-model:open="assigneePickerOpen">
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    :class="[
                      'h-9 w-full justify-start gap-2 px-3 text-sm font-normal',
                      !taskAssignee ? 'text-muted-foreground' : '',
                    ]"
                  >
                    <Icon
                      :name="taskAssigneeType === 'person' ? 'lucide:user' : (taskAssigneeType === 'role' ? 'lucide:users-round' : 'lucide:user-plus')"
                      class="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                    <span class="flex-1 truncate text-left">
                      <template v-if="selectedAssignee">
                        {{ selectedAssignee.label }}
                        <span v-if="assigneeRoleLabel" class="text-muted-foreground">· {{ assigneeRoleLabel }}</span>
                      </template>
                      <template v-else>
                        Unassigned
                      </template>
                    </span>
                    <Icon name="lucide:chevrons-up-down" class="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-72 p-0" align="start" :side-offset="4">
                  <div class="flex items-center gap-2 border-b px-3 py-2">
                    <Icon name="lucide:search" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      v-model="assigneeSearch"
                      class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      :placeholder="assigneeTab === 'roles' ? 'Search roles…' : 'Search users…'"
                    >
                    <button v-if="assigneeSearch" class="shrink-0 text-muted-foreground hover:text-foreground" @click="assigneeSearch = ''">
                      <Icon name="lucide:x" class="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Tabs v-model="assigneeTab" class="w-full">
                    <TabsList class="grid w-full grid-cols-2 rounded-none border-b bg-transparent px-2 py-1.5 h-auto">
                      <TabsTrigger value="roles" class="gap-1.5 text-xs data-[state=active]:bg-muted">
                        <Icon name="lucide:users-round" class="h-3.5 w-3.5" />
                        Roles
                      </TabsTrigger>
                      <TabsTrigger value="users" class="gap-1.5 text-xs data-[state=active]:bg-muted">
                        <Icon name="lucide:user" class="h-3.5 w-3.5" />
                        Users
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="roles" class="mt-0">
                      <ScrollArea class="h-56">
                        <div class="p-1">
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                            :class="!taskAssignee ? 'bg-accent' : ''"
                            @click="clearAssignee"
                          >
                            <div
                              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                                !taskAssignee ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                              ]"
                            >
                              <Icon v-if="!taskAssignee" name="lucide:check" class="h-3 w-3" />
                            </div>
                            <Icon name="lucide:user-plus" class="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span class="flex-1 truncate">Unassigned</span>
                          </button>
                          <template v-if="filteredRoles.length > 0">
                            <button
                              v-for="role in filteredRoles"
                              :key="role.value"
                              type="button"
                              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                              :class="taskAssignee === role.value && taskAssigneeType === 'role' ? 'bg-accent' : ''"
                              @click="pickAssignee(role.value, 'role')"
                            >
                              <div
                                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                                  taskAssignee === role.value && taskAssigneeType === 'role'
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-input',
                                ]"
                              >
                                <Icon v-if="taskAssignee === role.value && taskAssigneeType === 'role'" name="lucide:check" class="h-3 w-3" />
                              </div>
                              <Icon name="lucide:users-round" class="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span class="flex-1 truncate">{{ role.label }}</span>
                            </button>
                          </template>
                          <p v-else class="py-6 text-center text-sm text-muted-foreground">
                            No roles found
                          </p>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="users" class="mt-0">
                      <ScrollArea class="h-56">
                        <div class="p-1">
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                            :class="!taskAssignee ? 'bg-accent' : ''"
                            @click="clearAssignee"
                          >
                            <div
                              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                                !taskAssignee ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                              ]"
                            >
                              <Icon v-if="!taskAssignee" name="lucide:check" class="h-3 w-3" />
                            </div>
                            <Icon name="lucide:user-plus" class="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span class="flex-1 truncate">Unassigned</span>
                          </button>
                          <template v-if="filteredStaff.length > 0">
                            <button
                              v-for="staff in filteredStaff"
                              :key="staff.value"
                              type="button"
                              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                              :class="taskAssignee === staff.value && taskAssigneeType === 'person' ? 'bg-accent' : ''"
                              @click="pickAssignee(staff.value, 'person')"
                            >
                              <div
                                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                                  taskAssignee === staff.value && taskAssigneeType === 'person'
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-input',
                                ]"
                              >
                                <Icon v-if="taskAssignee === staff.value && taskAssigneeType === 'person'" name="lucide:check" class="h-3 w-3" />
                              </div>
                              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                {{ staff.label.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }}
                              </div>
                              <div class="flex min-w-0 flex-col text-left">
                                <span class="truncate text-sm leading-tight">{{ staff.label }}</span>
                                <span class="truncate text-xs text-muted-foreground">
                                  {{ assigneeRoles.find(r => r.value === staff.role)?.label ?? staff.role }}
                                </span>
                              </div>
                            </button>
                          </template>
                          <p v-else class="py-6 text-center text-sm text-muted-foreground">
                            No users found
                          </p>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
              </Popover>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Image</Label>
              <input
                ref="taskImageInputRef"
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                @change="handleImageUpload"
              >
              <Button
                v-if="!taskImages.length"
                type="button"
                variant="outline"
                class="w-full justify-start gap-1.5 px-3 text-sm font-normal text-muted-foreground"
                @click="taskImageInputRef?.click()"
              >
                <Icon name="lucide:image-plus" class="h-4 w-4" />
                Upload image
              </Button>
              <div v-else class="grid grid-cols-3 gap-2">
                <div v-for="(img, idx) in taskImages" :key="idx" class="relative group">
                  <img
                    :src="img"
                    alt=""
                    class="h-24 w-full rounded-lg border object-cover"
                  >
                  <button
                    type="button"
                    class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-destructive"
                    @click="removeImage(idx)"
                  >
                    <Icon name="lucide:x" class="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  class="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted"
                  @click="taskImageInputRef?.click()"
                >
                  <Icon name="lucide:plus" class="h-4 w-4" />
                  Add more
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" @click="close">
                Cancel
              </Button>
              <Button :disabled="!canCreateTask" @click="handleCreateTask">
                Create Task
              </Button>
            </DialogFooter>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
