<script setup lang="ts">
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { cleaningJobStatusLabels, cleaningJobPriorityLabels } from '~/components/cleaning/data/cleaning-jobs'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useTaskStore } from '~/composables/useTaskStore'
import { toast } from 'vue-sonner'

const props = defineProps<{
  open: boolean
  event: CalendarEvent | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'deleted': [event: CalendarEvent]
}>()

const { jobs: cleaningJobs, updateJob, deleteJob } = useCleaningJobs()
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
</script>

<template>
  <Dialog :open="open" @update:open="$event ? emit('update:open', true) : close()">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <div class="flex items-center gap-2">
          <Badge variant="secondary" class="text-[10px] uppercase tracking-wider">
            {{ eventTypeLabel }}
          </Badge>
        </div>
        <DialogTitle class="leading-tight">
          {{ event?.title || 'Event details' }}
        </DialogTitle>
        <DialogDescription v-if="event?.listingName">
          {{ event.listingName }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="event" class="flex flex-col gap-4">
        <!-- Time range -->
        <div class="flex items-center gap-2 text-sm">
          <Icon name="lucide:clock" class="h-4 w-4 text-muted-foreground" />
          <span>
            {{ formatDate(event.start) }} · {{ formatTime(event.start) }} – {{ formatTime(event.end) }}
          </span>
        </div>

        <!-- Cleaning job details -->
        <template v-if="event.type === 'cleaning' && cleaningJob">
          <div
            class="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm"
            :class="cleaningJob.priority === 'high' ? 'border-destructive/40 bg-destructive/10 ring-1 ring-destructive/30' : 'bg-muted/30'"
          >
            <div>
              <p class="text-xs text-muted-foreground">Status</p>
              <p class="font-medium">{{ statusLabel }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Priority</p>
              <Badge
                :variant="priorityVariant"
                class="mt-0.5 text-[10px]"
                :class="cleaningJob.priority === 'high' ? 'gap-1 bg-destructive/90 text-white' : ''"
              >
                <Icon v-if="cleaningJob.priority === 'high'" name="lucide:flag" class="h-3 w-3" />
                {{ priorityLabel }}
              </Badge>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-muted-foreground">Housekeeping</p>
              <p v-if="cleaningJob.cleanerNames.length" class="mt-1 flex flex-wrap gap-1">
                <Badge v-for="name in cleaningJob.cleanerNames" :key="name" variant="secondary" class="text-[10px]">
                  {{ name }}
                </Badge>
              </p>
              <p v-else class="font-medium text-muted-foreground">Unassigned</p>
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

      <DialogFooter class="gap-2">
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
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
