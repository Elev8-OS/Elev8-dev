<script setup lang="ts">
import { toast } from 'vue-sonner'
import { columns } from '@/components/tasks/components/columns'
import DataTable from '@/components/tasks/components/DataTable.vue'
import { assigneeOptions, priorities } from '@/components/tasks/data/data'
import { useHostBuddyInventorySync } from '@/composables/useHostBuddyInventorySync'
import { useTaskOwnerApproval } from '@/composables/useTaskOwnerApproval'
import { useTaskStore } from '@/composables/useTaskStore'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { listings } from '@/components/listings/data/listings'

const { tasks, addTask } = useTaskStore()
const { ownerForTask, notifyApprovalRequested } = useTaskOwnerApproval()

const { selectedTask, closeTaskDetail } = useTaskDetail()
const detailSheetOpen = computed({
  get: () => selectedTask.value !== null,
  set: (val) => {
    if (!val)
      closeTaskDetail()
  },
})
const { detectInventoryItem } = useHostBuddyInventorySync()

const newTaskOpen = ref(false)
const newTitle = ref('')
const newListing = ref('')
const assignee = ref('')
const assigneeType = ref<'role' | 'person'>('role')
const dueDate = ref('')
const newPriority = ref('medium')
const newDescription = ref('')
const isDetecting = ref(false)
const newImages = ref<string[]>([])
const imageInputRef = ref<HTMLInputElement | null>(null)

// --- Owner cost approval -----------------------------------------------------
// Ticking this holds the task until the owner approves the quoted cost.
const needsOwnerApproval = ref(false)
const newEstimatedCost = ref<number>(0)

/** The owner who would be asked, derived from the selected listing. */
const approvalOwner = computed(() => ownerForTask({ listing: newListing.value }))

// Listing picker state
const listingPopoverOpen = ref(false)
const listingSearch = ref('')
const listingTagPopoverOpen = ref(false)
const listingTagSearch = ref('')
const selectedListingTags = ref<string[]>([])

// Assignee picker state
const assigneePopoverOpen = ref(false)
const assigneeSearch = ref('')

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
  if (!query)
    return assigneeOptions
  return assigneeOptions.filter(a => a.label.toLowerCase().includes(query))
})

const detected = computed(() => {
  if (!newTitle.value.trim() || !newListing.value)
    return null
  return detectInventoryItem(newTitle.value, newListing.value)
})

watch([() => newTitle.value, () => newListing.value], () => {
  isDetecting.value = true
  setTimeout(() => { isDetecting.value = false }, 400)
})

function toggleListingTag(tag: string) {
  if (selectedListingTags.value.includes(tag))
    selectedListingTags.value = selectedListingTags.value.filter(t => t !== tag)
  else
    selectedListingTags.value = [...selectedListingTags.value, tag]
}

function selectListing(listingId: string) {
  const listing = listings.value.find(l => l.id === listingId)
  if (listing) {
    newListing.value = listing.name
  }
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
  newTitle.value = ''
  newListing.value = ''
  needsOwnerApproval.value = false
  newEstimatedCost.value = 0
  assignee.value = ''
  assigneeType.value = 'role'
  dueDate.value = ''
  newPriority.value = 'medium'
  newDescription.value = ''
  newImages.value = []
  listingSearch.value = ''
  listingTagSearch.value = ''
  selectedListingTags.value = []
  assigneeSearch.value = ''
}

function handleCreateTask() {
  if (!newTitle.value.trim())
    return
  const detection = detected.value
  const created = addTask({
    title: newTitle.value.trim(),
    status: 'todo',
    assignee: assignee.value || undefined,
    assigneeType: assignee.value ? assigneeType.value : undefined,
    priority: newPriority.value,
    listing: newListing.value || undefined,
    description: newDescription.value.trim() || undefined,
    dueDate: dueDate.value || undefined,
    images: newImages.value.length ? newImages.value : undefined,
    linkedInventoryItemId: detection?.itemId,
    linkedInventoryItemName: detection?.itemName,
    linkedInventoryEntryId: detection?.entryId,
    conditionBefore: detection ? 'good' : undefined,
    detectedByHostBuddy: detection ? true : undefined,
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
    toast.success(detection ? `Task created — HostBuddy linked ${detection.itemName}` : 'Task created')
  }
  newTaskOpen.value = false
  resetForm()
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

const todayDate = formatDate(new Date())
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Tasks
        </h2>
        <p class="text-muted-foreground">
          Operational task management.
        </p>
      </div>
      <Button variant="outline" @click="newTaskOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Task
      </Button>
    </div>

    <div class="grid gap-4">
      <DataTable :data="tasks" :columns="columns" />
    </div>

    <Dialog v-model:open="newTaskOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>HostBuddy will automatically detect and link inventory items from your description.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <Label>Title <span class="text-destructive">*</span></Label>
            <Input v-model="newTitle" placeholder="e.g. AC Split tidak dingin di Villa Merapi" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Listing</Label>
            <Popover v-model:open="listingPopoverOpen">
              <PopoverTrigger as-child>
                <Button variant="outline" class="w-full justify-between">
                  {{ newListing || 'Select a listing' }}
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
                            :class="selectedListingTags.length ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground'"
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
                          <Icon v-if="newListing === listing.name" name="lucide:check" class="size-4 text-primary mt-1" />
                        </div>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <!-- Owner cost approval — holds the task until the owner decides. -->
          <div class="rounded-md border p-3 space-y-3">
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

          <div v-if="newTitle.trim() && newListing" class="rounded-md border px-3 py-2.5 flex items-start gap-2.5" :class="detected ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20' : 'border-border bg-muted/40'">
            <Icon :name="isDetecting ? 'lucide:loader-circle' : detected ? 'lucide:sparkles' : 'lucide:search'" class="h-4 w-4 mt-0.5 shrink-0" :class="[isDetecting ? 'animate-spin text-muted-foreground' : '', detected && !isDetecting ? 'text-[#C8A84B]' : '', !detected && !isDetecting ? 'text-muted-foreground' : '']" />
            <div class="flex flex-col gap-0.5">
              <p class="text-xs font-semibold" :class="detected ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'">
                HostBuddy AI
              </p>
              <p class="text-xs" :class="detected ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'">
                <template v-if="isDetecting">
                  Scanning for inventory items…
                </template>
                <template v-else-if="detected">
                  Detected: <strong>{{ detected.itemName }}</strong> — condition will update to <strong>Damaged</strong>
                </template>
                <template v-else>
                  No matching inventory item found for this listing.
                </template>
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Assignee</Label>
              <Popover v-model:open="assigneePopoverOpen">
                <PopoverTrigger as-child>
                  <Button variant="outline" class="w-full justify-between h-10">
                    {{ assigneeOptions.find(a => a.value === assignee)?.label || 'Unassigned' }}
                    <Icon name="lucide:chevrons-up-down" class="size-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput v-model="assigneeSearch" placeholder="Search role or person..." />
                    <CommandList>
                      <CommandEmpty>No match found.</CommandEmpty>
                      <CommandGroup heading="Roles">
                        <CommandItem
                          v-for="opt in filteredAssigneeOptions.filter(a => a.type === 'role')"
                          :key="opt.value"
                          :value="opt.label"
                          class="cursor-pointer"
                          @select="selectAssignee(opt)"
                        >
                          <div class="flex items-center gap-2 w-full">
                            <Icon name="lucide:badge" class="size-4 text-muted-foreground" />
                            <span>{{ opt.label }}</span>
                            <Icon v-if="assignee === opt.value" name="lucide:check" class="size-4 text-primary ml-auto" />
                          </div>
                        </CommandItem>
                      </CommandGroup>
                      <CommandGroup heading="People">
                        <CommandItem
                          v-for="opt in filteredAssigneeOptions.filter(a => a.type === 'person')"
                          :key="opt.value"
                          :value="opt.label"
                          class="cursor-pointer"
                          @select="selectAssignee(opt)"
                        >
                          <div class="flex items-center gap-2 w-full">
                            <Icon name="lucide:user" class="size-4 text-muted-foreground" />
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
                    {{ p.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Due Date</Label>
              <Input v-model="dueDate" type="date" :min="todayDate" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>&nbsp;</Label>
              <!-- spacer for grid alignment -->
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea v-model="newDescription" placeholder="Additional details…" rows="3" />
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
          <Button variant="outline" @click="newTaskOpen = false; resetForm()">
            Cancel
          </Button>
          <Button :disabled="!newTitle.trim()" @click="handleCreateTask">
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <TasksTaskDetailSheet
      :task="selectedTask"
      :open="detailSheetOpen"
      @update:open="detailSheetOpen = $event"
    />
  </div>
</template>
