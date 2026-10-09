<script setup lang="ts">
import type { Task } from '~/components/tasks/data/schema'
import { statuses } from '~/components/tasks/data/data'
import { Badge } from '~/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'

/**
 * The open task badge of a Cockpit unit row. Always shown, grey at 0 and red
 * from 1. A click lists the room's open tasks; picking one opens the task.
 */
const props = defineProps<{
  tasks: Task[]
  /** The row's name, for the popover heading. */
  roomName: string
  todayKey: string
}>()

const emit = defineEmits<{
  openTask: [task: Task]
}>()

const open = ref(false)

const label = computed(() => `${props.tasks.length} open ${props.tasks.length === 1 ? 'task' : 'tasks'}`)

const priorityClasses: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-foreground',
  low: 'text-muted-foreground',
}

function statusIcon(task: Task) {
  return statuses.find(s => s.value === task.status)?.icon
}

function isOverdue(task: Task) {
  return !!task.dueDate && task.dueDate.slice(0, 10) < props.todayKey
}

function formatDue(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function pick(task: Task) {
  open.value = false
  emit('openTask', task)
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        :title="label"
        :aria-label="`${label}. Show the tasks.`"
        data-testid="cockpit-room-tasks"
        @pointerdown.stop
      >
        <Badge
          :variant="tasks.length ? 'destructive' : 'secondary'"
          class="h-5 min-w-5 cursor-pointer justify-center rounded-full px-1 text-[10px] tabular-nums"
          :class="!tasks.length && 'text-muted-foreground'"
        >
          {{ tasks.length }}
        </Badge>
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-80 p-0" align="start" side="right">
      <div class="border-b px-3 py-2">
        <p class="truncate text-sm font-medium">
          {{ roomName }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ label }}
        </p>
      </div>
      <div v-if="!tasks.length" class="flex flex-col items-center gap-1 px-3 py-6 text-center text-sm text-muted-foreground" data-testid="cockpit-room-tasks-empty">
        <Icon name="lucide:circle-check" class="size-5" />
        No open tasks in this room.
      </div>
      <div v-else class="max-h-72 overflow-y-auto">
        <ul class="p-1">
          <li v-for="task in tasks" :key="task.id">
            <button
              type="button"
              class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              data-testid="cockpit-room-task"
              @click="pick(task)"
            >
              <component :is="statusIcon(task)" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1">
                <span class="line-clamp-2 text-sm">{{ task.title }}</span>
                <span class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span class="capitalize" :class="priorityClasses[task.priority]">{{ task.priority }}</span>
                  <span v-if="task.dueDate" :class="isOverdue(task) && 'font-medium text-destructive'">
                    {{ isOverdue(task) ? 'Overdue · ' : 'Due ' }}{{ formatDue(task.dueDate) }}
                  </span>
                  <span class="capitalize">{{ task.status }}</span>
                </span>
              </span>
            </button>
          </li>
        </ul>
      </div>
      <div class="border-t p-1">
        <NuxtLink to="/tasks" class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          <Icon name="lucide:list-checks" class="size-3.5" />
          Open Tasks
        </NuxtLink>
      </div>
    </PopoverContent>
  </Popover>
</template>
