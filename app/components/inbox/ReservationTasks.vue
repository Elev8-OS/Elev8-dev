<script lang="ts" setup>
import type { Task } from '~/components/inbox/data/conversations'
import { cn } from '~/lib/utils'

interface ReservationTasksProps {
  tasks: Task[]
}

defineProps<ReservationTasksProps>()

const statusConfig: Record<string, { label: string, class: string }> = {
  todo: { label: 'To Do', class: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', class: 'bg-secondary text-secondary-foreground' },
  done: { label: 'Done', class: 'bg-green-500/20 text-green-600' },
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

    <div
      v-for="task of tasks"
      :key="task.id"
      class="rounded-lg border bg-card p-3 space-y-1"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ task.title }}</span>
        <span :class="cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium', statusConfig[task.status]?.class ?? '')">
          {{ statusConfig[task.status]?.label ?? task.status }}
        </span>
      </div>
      <div v-if="task.assignee" class="text-xs text-muted-foreground">
        Assigned to {{ task.assignee }}
      </div>
      <div v-if="task.dueDate" class="text-xs text-muted-foreground">
        Due {{ new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }}
      </div>
    </div>
  </div>
</template>
