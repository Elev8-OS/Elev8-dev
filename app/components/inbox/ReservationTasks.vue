<script lang="ts" setup>
import type { TaskStatus } from '~/components/tasks/data/schema'
import { tasksForListing } from '~/components/inbox/data/internal'
import { assigneeOptions } from '~/components/tasks/data/data'
import { TASK_STATUS_LABELS } from '~/components/tasks/data/schema'
import { cn } from '~/lib/utils'

interface ReservationTasksProps {
  /** Listing NAME, which is what `Task.listing` stores. */
  listingName: string
}

const props = defineProps<ReservationTasksProps>()

// Read from the live task store (not the reservation's mock list), so a task
// raised from this conversation shows here at once and a card can open it in
// the same detail sheet the Tasks page and the internal inbox use.
const { tasks: allTasks } = useTaskStore()
const { openTaskDetailById } = useTaskDetail()

const tasks = computed(() => tasksForListing(allTasks.value, props.listingName))

function assigneeLabel(value: string) {
  return assigneeOptions.find(a => a.value === value)?.label ?? value
}

const statusClass: Record<TaskStatus, string> = {
  'not started': 'bg-muted text-muted-foreground',
  'in progress': 'bg-secondary text-secondary-foreground',
  'completed': 'bg-green-500/20 text-green-600',
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="tasks.length === 0" class="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
      <Icon name="lucide:check-circle" class="size-8" />
      <p class="text-sm">
        No tasks
      </p>
    </div>

    <button
      v-for="task of tasks"
      :key="task.id"
      type="button"
      class="block w-full rounded-lg border bg-card p-3 space-y-1 text-left transition-colors hover:bg-accent"
      :aria-label="`Open task: ${task.title}`"
      @click="openTaskDetailById(task.id)"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">{{ task.title }}</span>
        <span :class="cn('inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium', statusClass[task.status as TaskStatus] ?? 'bg-muted text-muted-foreground')">
          {{ TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status }}
        </span>
      </div>
      <div v-if="task.assignee" class="text-xs text-muted-foreground">
        Assigned to {{ assigneeLabel(task.assignee) }}
      </div>
      <div v-if="task.dueDate" class="text-xs text-muted-foreground">
        Due {{ new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }}
      </div>
    </button>
  </div>
</template>
