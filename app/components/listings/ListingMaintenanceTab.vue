<script setup lang="ts">
import type { Listing, MaintenanceTask, Unit } from '~/components/listings/data/listings'

import CleaningJobForm from '~/components/cleaning/CleaningJobForm.vue'
import { useCleaningJobs } from '~/composables/useCleaningJobs'

const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const showAddDialog = ref(false)
const showCleaningDialog = ref(false)
const newTask = ref({ title: '', assignedTo: '', type: 'cleaning' as MaintenanceTask['type'] })
const { createJob, jobsForListing, resolveCleanerNames } = useCleaningJobs()

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
  </div>
</template>
