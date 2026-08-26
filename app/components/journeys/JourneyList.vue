<script setup lang="ts">
import type { Journey, JourneyGroup } from './data/journeys'
import { toast } from 'vue-sonner'
import { triggerMeta } from './data/journeys'

const emit = defineEmits<{
  'new-journey': []
  'new-journey-scratch': []
  'open-marketplace': []
  'edit-journey': [journey: Journey]
}>()

const {
  journeys,
  toggleStatus,
  deleteJourney,
  duplicateJourney,
  groups,
  createGroup,
  deleteGroup,
  renameGroup,
  toggleGroupCollapse,
  moveJourneyToGroup,
  addJourneysToGroup,
} = useJourneys()

const { isConnected: whatsappConnected } = useWhatsApp()

function hasWhatsAppStep(journey: Journey): boolean {
  return journey.steps.some(s => s.type === 'message' && (s as any).channel === 'whatsapp')
}

function isWhatsAppBlocked(journey: Journey): boolean {
  return hasWhatsAppStep(journey) && !whatsappConnected.value
}

// Auto-deactivate WhatsApp-dependent journeys the moment WhatsApp disconnects,
// so a journey can't silently sit "active" while its WhatsApp steps would skip.
watch(
  whatsappConnected,
  (connected, wasConnected) => {
    if (wasConnected !== false || connected)
      return
    let deactivated = 0
    for (const journey of journeys.value) {
      if (hasWhatsAppStep(journey) && journey.status === 'active') {
        toggleStatus(journey.id)
        deactivated++
      }
    }
    if (deactivated > 0)
      toast.warning(`${deactivated} journey${deactivated === 1 ? '' : 's'} paused because WhatsApp disconnected.`)
  },
)

const statusConfig: Record<string, { label: string, variant: 'default' | 'secondary' }> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'secondary' },
}

function getTriggerLabel(t: string) {
  return triggerMeta[t]?.label ?? t
}

function handleMoveToGroup(journey: Journey, groupId: string | null) {
  moveJourneyToGroup(journey.id, groupId)
  if (groupId) {
    const groupName = groups.value.find(g => g.id === groupId)?.name ?? ''
    toast.success(`"${journey.name}" moved to "${groupName}"`)
  }
  else {
    toast.success(`"${journey.name}" removed from group`)
  }
}

function handleToggleStatus(journey: Journey) {
  const next = journey.status === 'active' ? 'inactive' : 'active'
  toggleStatus(journey.id)
  toast.success(`"${journey.name}" set to ${next}`)
}

// --- Grouping helpers ---
const ungroupedJourneys = computed(() => {
  const groupedIds = new Set(groups.value.flatMap(g => g.journeyIds))
  return journeys.value.filter(j => !groupedIds.has(j.id))
})

function getGroupJourneys(group: JourneyGroup): Journey[] {
  return group.journeyIds
    .map(id => journeys.value.find(j => j.id === id))
    .filter((j): j is Journey => !!j)
}

function getJourneyGroup(journeyId: string): JourneyGroup | undefined {
  return groups.value.find(g => g.journeyIds.includes(journeyId))
}

// --- Create Group Dialog ---
const createGroupOpen = ref(false)
const newGroupName = ref('')
const newGroupJourneyIds = ref<string[]>([])

function openCreateGroup() {
  newGroupName.value = ''
  newGroupJourneyIds.value = []
  createGroupOpen.value = true
}

function toggleNewGroupJourney(id: string) {
  const idx = newGroupJourneyIds.value.indexOf(id)
  if (idx === -1)
    newGroupJourneyIds.value.push(id)
  else newGroupJourneyIds.value.splice(idx, 1)
}

function submitCreateGroup() {
  const name = newGroupName.value.trim()
  if (!name)
    return
  createGroup(name, [...newGroupJourneyIds.value])
  toast.success(`Group "${name}" created`)
  createGroupOpen.value = false
}

// --- Add Journey to Group Dialog ---
const addToGroupOpen = ref(false)
const addToGroupId = ref('')
const addToGroupSelectedIds = ref<string[]>([])

const addToGroupName = computed(
  () => groups.value.find(g => g.id === addToGroupId.value)?.name ?? '',
)

const addToGroupAvailable = computed(() => {
  const allGroupedIds = new Set(groups.value.flatMap(g => g.journeyIds))
  return journeys.value.filter(j => !allGroupedIds.has(j.id))
})

function openAddToGroup(groupId: string) {
  addToGroupId.value = groupId
  addToGroupSelectedIds.value = []
  addToGroupOpen.value = true
}

function toggleAddToGroupJourney(id: string) {
  const idx = addToGroupSelectedIds.value.indexOf(id)
  if (idx === -1)
    addToGroupSelectedIds.value.push(id)
  else addToGroupSelectedIds.value.splice(idx, 1)
}

function submitAddToGroup() {
  const count = addToGroupSelectedIds.value.length
  if (count > 0) {
    addJourneysToGroup(addToGroupId.value, [...addToGroupSelectedIds.value])
    toast.success(`${count} ${count === 1 ? 'journey' : 'journeys'} added to "${addToGroupName.value}"`)
  }
  addToGroupOpen.value = false
}

// --- Delete confirmations ---
// Separate open flag from target so @update:open can't null the target before the action handler reads it
const duplicateOpen = ref(false)
const duplicateTarget = ref<Journey | null>(null)
const deleteJourneyOpen = ref(false)
const deleteJourneyTarget = ref<Journey | null>(null)
const deleteGroupOpen = ref(false)
const deleteGroupTarget = ref<JourneyGroup | null>(null)

function confirmDuplicateJourney(journey: Journey) { duplicateTarget.value = journey; duplicateOpen.value = true }
function confirmDeleteJourney(journey: Journey) { deleteJourneyTarget.value = journey; deleteJourneyOpen.value = true }
function confirmDeleteGroup(group: JourneyGroup) { deleteGroupTarget.value = group; deleteGroupOpen.value = true }

function doDuplicateJourney() {
  const target = duplicateTarget.value
  duplicateOpen.value = false
  if (target) {
    duplicateJourney(target.id)
    toast.success(`"${target.name}" duplicated`)
  }
}

function doDeleteJourney() {
  const target = deleteJourneyTarget.value
  deleteJourneyOpen.value = false
  if (target) {
    deleteJourney(target.id)
    toast.success(`"${target.name}" deleted`)
  }
}

function doDeleteGroup() {
  const target = deleteGroupTarget.value
  deleteGroupOpen.value = false
  if (target) {
    deleteGroup(target.id)
    toast.success(`Group "${target.name}" deleted`)
  }
}

// --- Rename Group Dialog ---
const renameDialogOpen = ref(false)
const renamingGroupId = ref<string | null>(null)
const renameInput = ref('')

function openRenameDialog(group: JourneyGroup) {
  renamingGroupId.value = group.id
  renameInput.value = group.name
  renameDialogOpen.value = true
}

function submitRename() {
  if (renamingGroupId.value && renameInput.value.trim()) {
    renameGroup(renamingGroupId.value, renameInput.value.trim())
    toast.success(`Group renamed to "${renameInput.value.trim()}"`)
  }
  renameDialogOpen.value = false
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 border-b bg-background px-6 py-5">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Journeys
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">
          Automate guest communication end-to-end with AI-powered flows.
        </p>
      </div>
      <div class="flex shrink-0 gap-2">
        <Button variant="outline" @click="openCreateGroup">
          <Icon name="i-lucide-folder-plus" class="mr-2 h-4 w-4" />
          New Group
        </Button>
        <Button variant="outline" @click="emit('open-marketplace')">
          <Icon name="i-lucide-store" class="mr-2 h-4 w-4" />
          Marketplace
        </Button>
        <DropdownMenu>
          <div class="flex">
            <Button class="rounded-r-none pr-3" @click="emit('new-journey')">
              <Icon name="i-lucide-sparkles" class="mr-2 h-4 w-4" />
              Build with AI
            </Button>
            <DropdownMenuTrigger as-child>
              <Button class="rounded-l-none border-l border-primary-foreground/20 px-2">
                <Icon name="i-lucide-chevron-down" class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="emit('new-journey')">
              <Icon name="i-lucide-sparkles" class="mr-2 h-4 w-4" />
              Build with AI
            </DropdownMenuItem>
            <DropdownMenuItem @click="emit('new-journey-scratch')">
              <Icon name="i-lucide-pencil-line" class="mr-2 h-4 w-4" />
              Start from scratch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 p-6">
      <!-- Empty state -->
      <div v-if="journeys.length === 0" class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <Icon name="i-lucide-route" class="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
        <h3 class="text-lg font-semibold">
          No Journeys yet
        </h3>
        <p class="mt-1 mb-5 text-sm text-muted-foreground max-w-sm">
          Create your first Journey to automate guest communication end-to-end.
        </p>
        <div class="flex gap-2">
          <Button @click="emit('new-journey')">
            <Icon name="i-lucide-sparkles" class="mr-2 h-4 w-4" />
            Build with AI
          </Button>
          <Button variant="outline" @click="emit('new-journey-scratch')">
            <Icon name="i-lucide-pencil-line" class="mr-2 h-4 w-4" />
            From Scratch
          </Button>
        </div>
      </div>

      <!-- Journey table -->
      <div v-else class="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[300px]">
                Name
              </TableHead>
              <TableHead class="w-[160px]">
                Status
              </TableHead>
              <TableHead class="w-[70px]">
                Steps
              </TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead class="w-[130px]">
                Properties
              </TableHead>
              <TableHead class="w-[130px]">
                Last Modified
              </TableHead>
              <TableHead class="w-[56px] text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <!-- Groups -->
            <template v-for="group in groups" :key="group.id">
              <!-- Group header row -->
              <TableRow class="bg-muted/40 hover:bg-muted/50 border-b">
                <TableCell colspan="7" class="py-2 pr-3">
                  <div class="flex items-center gap-2">
                    <button
                      class="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-muted-foreground/10"
                      @click="toggleGroupCollapse(group.id)"
                    >
                      <Icon
                        :name="group.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                        class="h-3.5 w-3.5 text-muted-foreground"
                      />
                    </button>
                    <Icon name="i-lucide-folder" class="h-4 w-4 shrink-0 text-muted-foreground" />

                    <span class="text-sm font-medium">{{ group.name }}</span>

                    <Badge variant="secondary" class="h-5 px-1.5 text-[10px] font-normal">
                      {{ getGroupJourneys(group).length }}
                    </Badge>

                    <div class="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                        @click="openAddToGroup(group.id)"
                      >
                        <Icon name="i-lucide-plus" class="h-3 w-3" />
                        Add Journey
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button variant="ghost" size="icon" class="h-7 w-7" aria-label="Group actions">
                            <Icon name="i-lucide-ellipsis" class="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem @click="openRenameDialog(group)">
                            <Icon name="i-lucide-pencil" class="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem class="text-destructive" @click="confirmDeleteGroup(group)">
                            <Icon name="i-lucide-trash-2" class="mr-2 h-4 w-4" />
                            Delete Group
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </TableCell>
              </TableRow>

              <!-- Journey rows inside group -->
              <template v-if="!group.collapsed">
                <TableRow
                  v-for="journey in getGroupJourneys(group)"
                  :key="journey.id"
                >
                  <TableCell class="font-medium pl-10">
                    {{ journey.name }}
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <Switch
                        :key="`${journey.id}-${journey.status}`"
                        :model-value="journey.status === 'active'"
                        @update:model-value="handleToggleStatus(journey)"
                      />
                      <Badge :variant="statusConfig[journey.status]?.variant ?? 'outline'">
                        {{ statusConfig[journey.status]?.label ?? journey.status }}
                      </Badge>
                      <TooltipProvider v-if="isWhatsAppBlocked(journey)">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Icon name="i-lucide-triangle-alert" class="h-4 w-4 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>WhatsApp not connected — this journey won't send WhatsApp messages</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  <TableCell>{{ journey.steps.length }}</TableCell>
                  <TableCell class="text-muted-foreground text-sm">
                    {{ getTriggerLabel(journey.triggerType) }}
                  </TableCell>
                  <TableCell class="text-sm">
                    <div class="flex items-center gap-1.5 text-muted-foreground">
                      <Icon name="i-lucide-building-2" class="h-3.5 w-3.5 shrink-0" />
                      <span>{{ journey.properties?.includes('All Properties') ? 'All' : `${journey.properties?.length ?? 0}` }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-muted-foreground text-sm">
                    {{ journey.lastModified }}
                  </TableCell>
                  <TableCell class="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" aria-label="Journey actions">
                          <Icon name="i-lucide-ellipsis" class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="emit('edit-journey', journey)">
                          <Icon name="i-lucide-pencil" class="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="confirmDuplicateJourney(journey)">
                          <Icon name="i-lucide-copy" class="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Icon name="i-lucide-folder-symlink" class="mr-2 h-4 w-4" />
                            Move to Group
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              v-for="g in groups.filter(g => g.id !== getJourneyGroup(journey.id)?.id)"
                              :key="g.id"
                              @click="handleMoveToGroup(journey, g.id)"
                            >
                              <Icon name="i-lucide-folder" class="mr-2 h-4 w-4" />
                              {{ g.name }}
                            </DropdownMenuItem>
                            <template v-if="getJourneyGroup(journey.id)">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem @click="handleMoveToGroup(journey, null)">
                                <Icon name="i-lucide-folder-minus" class="mr-2 h-4 w-4" />
                                Remove from Group
                              </DropdownMenuItem>
                            </template>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem class="text-destructive" @click="confirmDeleteJourney(journey)">
                          <Icon name="i-lucide-trash-2" class="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </template>
            </template>

            <!-- Ungrouped section -->
            <template v-if="ungroupedJourneys.length > 0">
              <TableRow v-if="groups.length > 0" class="bg-muted/20 hover:bg-muted/20">
                <TableCell colspan="7" class="py-1.5 pl-4">
                  <span class="text-xs font-medium text-muted-foreground">Ungrouped</span>
                </TableCell>
              </TableRow>
              <TableRow
                v-for="journey in ungroupedJourneys"
                :key="journey.id"
              >
                <TableCell class="font-medium">
                  {{ journey.name }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <Switch
                      :key="`${journey.id}-${journey.status}`"
                      :model-value="journey.status === 'active'"
                      @update:model-value="handleToggleStatus(journey)"
                    />
                    <Badge :variant="statusConfig[journey.status]?.variant ?? 'outline'">
                      {{ statusConfig[journey.status]?.label ?? journey.status }}
                    </Badge>
                    <TooltipProvider v-if="isWhatsAppBlocked(journey)">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Icon name="i-lucide-triangle-alert" class="h-4 w-4 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>WhatsApp not connected — this journey won't send WhatsApp messages</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
                <TableCell>{{ journey.steps.length }}</TableCell>
                <TableCell class="text-muted-foreground text-sm">
                  {{ getTriggerLabel(journey.triggerType) }}
                </TableCell>
                <TableCell class="text-sm">
                  <div class="flex items-center gap-1.5 text-muted-foreground">
                    <Icon name="i-lucide-building-2" class="h-3.5 w-3.5 shrink-0" />
                    <span>{{ journey.properties?.includes('All Properties') ? 'All' : `${journey.properties?.length ?? 0}` }}</span>
                  </div>
                </TableCell>
                <TableCell class="text-muted-foreground text-sm">
                  {{ journey.lastModified }}
                </TableCell>
                <TableCell class="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" aria-label="Journey actions">
                        <Icon name="i-lucide-ellipsis" class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="emit('edit-journey', journey)">
                        <Icon name="i-lucide-pencil" class="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="confirmDuplicateJourney(journey)">
                        <Icon name="i-lucide-copy" class="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSub v-if="groups.length > 0">
                        <DropdownMenuSubTrigger>
                          <Icon name="i-lucide-folder-symlink" class="mr-2 h-4 w-4" />
                          Move to Group
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem
                            v-for="g in groups"
                            :key="g.id"
                            @click="handleMoveToGroup(journey, g.id)"
                          >
                            <Icon name="i-lucide-folder" class="mr-2 h-4 w-4" />
                            {{ g.name }}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-destructive" @click="confirmDeleteJourney(journey)">
                        <Icon name="i-lucide-trash-2" class="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Create Group Dialog -->
    <Dialog v-model:open="createGroupOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Group</DialogTitle>
          <DialogDescription>Organize journeys into a named group.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-1">
          <div class="flex flex-col gap-1.5">
            <Label for="new-group-name">Group Name</Label>
            <Input
              id="new-group-name"
              v-model="newGroupName"
              placeholder="e.g. Guest Experience"
              @keydown.enter="submitCreateGroup"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>
              Add Journeys
              <span class="text-muted-foreground font-normal ml-1">(optional)</span>
            </Label>
            <ScrollArea class="h-48 rounded-md border">
              <div class="p-1.5 space-y-0.5">
                <button
                  v-for="j in journeys"
                  :key="j.id"
                  class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  @click="toggleNewGroupJourney(j.id)"
                >
                  <div
                    class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                      newGroupJourneyIds.includes(j.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    ]"
                  >
                    <Icon v-if="newGroupJourneyIds.includes(j.id)" name="i-lucide-check" class="h-3 w-3" />
                  </div>
                  <span class="flex-1 truncate text-left">{{ j.name }}</span>
                  <Badge :variant="statusConfig[j.status]?.variant ?? 'outline'" class="h-5 px-1.5 text-[10px]">
                    {{ statusConfig[j.status]?.label ?? j.status }}
                  </Badge>
                </button>
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createGroupOpen = false">
            Cancel
          </Button>
          <Button :disabled="!newGroupName.trim()" @click="submitCreateGroup">
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Rename Group Dialog -->
    <Dialog v-model:open="renameDialogOpen">
      <DialogContent class="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Rename Group</DialogTitle>
        </DialogHeader>
        <div class="py-2">
          <Input
            v-model="renameInput"
            placeholder="Group name"
            @keydown.enter="submitRename"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="renameDialogOpen = false">
            Cancel
          </Button>
          <Button :disabled="!renameInput.trim()" @click="submitRename">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Duplicate Journey Confirmation -->
    <AlertDialog v-model:open="duplicateOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicate Journey?</AlertDialogTitle>
          <AlertDialogDescription>
            A copy of <span class="font-medium text-foreground">{{ duplicateTarget?.name }}</span> will be created (inactive).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="doDuplicateJourney">
            Duplicate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Delete Journey Confirmation -->
    <AlertDialog v-model:open="deleteJourneyOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Journey?</AlertDialogTitle>
          <AlertDialogDescription>
            <span class="font-medium text-foreground">{{ deleteJourneyTarget?.name }}</span> will be permanently deleted. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="doDeleteJourney">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Delete Group Confirmation -->
    <AlertDialog v-model:open="deleteGroupOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Group?</AlertDialogTitle>
          <AlertDialogDescription>
            <span class="font-medium text-foreground">{{ deleteGroupTarget?.name }}</span> will be deleted. Journeys inside will become ungrouped.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="doDeleteGroup">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Add Journey to Group Dialog -->
    <Dialog v-model:open="addToGroupOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to "{{ addToGroupName }}"</DialogTitle>
          <DialogDescription>Select ungrouped journeys to add to this group.</DialogDescription>
        </DialogHeader>
        <ScrollArea class="h-52 rounded-md border my-2">
          <div class="p-1.5 space-y-0.5">
            <p v-if="addToGroupAvailable.length === 0" class="py-6 text-center text-sm text-muted-foreground">
              No ungrouped journeys available.
            </p>
            <button
              v-for="j in addToGroupAvailable"
              :key="j.id"
              class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              @click="toggleAddToGroupJourney(j.id)"
            >
              <div
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                  addToGroupSelectedIds.includes(j.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                ]"
              >
                <Icon v-if="addToGroupSelectedIds.includes(j.id)" name="i-lucide-check" class="h-3 w-3" />
              </div>
              <span class="flex-1 truncate text-left">{{ j.name }}</span>
            </button>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" @click="addToGroupOpen = false">
            Cancel
          </Button>
          <Button :disabled="addToGroupSelectedIds.length === 0" @click="submitAddToGroup">
            Add {{ addToGroupSelectedIds.length > 0 ? `${addToGroupSelectedIds.length} ` : '' }}{{ addToGroupSelectedIds.length === 1 ? 'Journey' : 'Journeys' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
