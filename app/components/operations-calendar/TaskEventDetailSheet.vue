<script setup lang="ts">
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
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

const { tasks: taskStore, deleteTask } = useTaskStore()

const task = computed(() => {
  if (!props.event || props.event.type !== 'task')
    return null
  const taskId = props.event.id.replace(/^task-/, '')
  return taskStore.value.find(t => t.id === taskId) ?? null
})

const statusUpdates = computed(() => {
  if (!task.value?.statusUpdates)
    return []
  return [...task.value.statusUpdates].reverse()
})

type PriorityKey = 'urgent' | 'high' | 'medium' | 'low'

const priorityMeta: Record<PriorityKey, {
  label: string
  variant: 'destructive' | 'secondary' | 'outline'
  icon: string
  iconColor: string
  accentClass: string
}> = {
  urgent: {
    label: 'Urgent',
    variant: 'destructive',
    icon: 'lucide:flame',
    iconColor: '#dc2626',
    accentClass: 'from-red-500/20 via-red-500/10 to-transparent',
  },
  high: {
    label: 'High',
    variant: 'destructive',
    icon: 'lucide:flag',
    iconColor: '#dc2626',
    accentClass: 'from-red-500/15 via-red-500/5 to-transparent',
  },
  medium: {
    label: 'Medium',
    variant: 'secondary',
    icon: 'lucide:flag',
    iconColor: '#2563eb',
    accentClass: 'from-blue-500/15 via-blue-500/5 to-transparent',
  },
  low: {
    label: 'Low',
    variant: 'secondary',
    icon: 'lucide:flag',
    iconColor: '#16a34a',
    accentClass: 'from-green-500/15 via-green-500/5 to-transparent',
  },
}

const priority = computed<PriorityKey>(() => {
  const p = (task.value?.priority as PriorityKey) ?? 'medium'
  return priorityMeta[p] ? p : 'medium'
})

const priorityBadge = computed(() => priorityMeta[priority.value])

const isOverdue = computed(() => {
  if (!task.value?.dueDate)
    return false
  return task.value.dueDate < new Date().toISOString().slice(0, 10)
    && task.value.status !== 'done'
    && task.value.status !== 'canceled'
})

const statusMeta = computed(() => {
  const status = task.value?.status ?? 'todo'
  switch (status) {
    case 'todo':
      return { icon: 'lucide:circle-dot', label: 'To do', color: 'text-muted-foreground' }
    case 'in_progress':
      return { icon: 'lucide:loader', label: 'In progress', color: 'text-amber-600' }
    case 'done':
      return { icon: 'lucide:circle-check', label: 'Done', color: 'text-green-600' }
    case 'canceled':
      return { icon: 'lucide:circle-x', label: 'Canceled', color: 'text-muted-foreground' }
    default:
      return { icon: 'lucide:circle-dot', label: status, color: 'text-muted-foreground' }
  }
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)
    return 'just now'
  if (mins < 60)
    return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24)
    return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30)
    return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function close() {
  emit('update:open', false)
}

function handleDelete() {
  if (!task.value || !props.event)
    return
  deleteTask(task.value.id)
  toast.success('Task deleted')
  emit('deleted', props.event)
  close()
}
</script>

<template>
  <Sheet :open="open" @update:open="$event ? emit('update:open', true) : close()">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" side="right">
      <template v-if="task">
        <!-- Accent strip -->
        <div class="h-1.5 w-full shrink-0" :class="priorityBadge.accentClass" />

        <!-- Header -->
        <SheetHeader class="shrink-0 border-b bg-gradient-to-b from-muted/40 to-transparent px-6 py-5">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="lucide:clipboard-list" class="h-3.5 w-3.5" />
            <span class="font-medium uppercase tracking-wider">Task</span>
            <span class="text-muted-foreground/50">·</span>
            <span class="capitalize">{{ statusMeta.label }}</span>
          </div>
          <SheetTitle class="mt-2 text-xl leading-snug">
            {{ task.title }}
          </SheetTitle>
          <SheetDescription v-if="task.listing" class="flex items-center gap-1.5">
            <Icon name="lucide:home" class="h-3.5 w-3.5" />
            {{ task.listing }}
          </SheetDescription>
          <div class="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge :variant="priorityBadge.variant" class="gap-1 text-[10px] font-medium">
              <Icon :name="priorityBadge.icon" class="h-3 w-3" :style="{ color: priorityBadge.iconColor }" />
              {{ priorityBadge.label }} priority
            </Badge>
            <Badge v-if="isOverdue" variant="destructive" class="gap-1 text-[10px]">
              <Icon name="lucide:alert-triangle" class="h-3 w-3" />
              Overdue
            </Badge>
            <Badge v-if="task.images?.length" variant="outline" class="gap-1 text-[10px]">
              <Icon name="lucide:image" class="h-3 w-3" />
              {{ task.images.length }}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea class="min-h-0 flex-1 overflow-y-auto">
          <div class="flex flex-col gap-6 px-6 py-5">
            <!-- Quick info row -->
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-lg border bg-card p-3">
                <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Icon name="lucide:calendar-clock" class="h-3 w-3" />
                  Due date
                </div>
                <p class="mt-1.5 text-sm font-semibold" :class="isOverdue ? 'text-destructive' : ''">
                  {{ task.dueDate ? formatDate(task.dueDate) : '—' }}
                </p>
              </div>
              <div class="rounded-lg border bg-card p-3">
                <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Icon :name="statusMeta.icon" class="h-3 w-3" :class="statusMeta.color" />
                  Status
                </div>
                <p class="mt-1.5 text-sm font-semibold capitalize">
                  {{ statusMeta.label }}
                </p>
              </div>
              <div class="rounded-lg border bg-card p-3">
                <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Icon name="lucide:plus-circle" class="h-3 w-3" />
                  Created
                </div>
                <p class="mt-1.5 text-sm font-semibold">
                  {{ task.createdAt ? formatDate(task.createdAt) : '—' }}
                </p>
              </div>
              <div class="rounded-lg border bg-card p-3">
                <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Icon name="lucide:gauge" class="h-3 w-3" />
                  Progress
                </div>
                <p class="mt-1.5 text-sm font-semibold">
                  {{ task.progress ?? 0 }}%
                </p>
              </div>
            </div>

            <!-- Images -->
            <div v-if="task.images && task.images.length">
              <div class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon name="lucide:image" class="h-3.5 w-3.5" />
                Images
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div
                  v-for="(img, idx) in task.images"
                  :key="idx"
                  class="group relative overflow-hidden rounded-lg border bg-muted"
                >
                  <img
                    :src="img"
                    alt=""
                    class="h-24 w-full object-cover transition-transform group-hover:scale-105"
                  >
                </div>
              </div>
            </div>

            <!-- Timeline -->
            <div>
              <div class="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon name="lucide:history" class="h-3.5 w-3.5" />
                Timeline
                <span class="ml-1 text-muted-foreground/60 normal-case font-normal">
                  ({{ statusUpdates.length }})
                </span>
              </div>
              <ol v-if="statusUpdates.length" class="relative space-y-4 pl-6">
                <li
                  v-for="(entry, idx) in statusUpdates"
                  :key="idx"
                  class="relative rounded-md"
                >
                  <span
                    class="absolute -left-6 top-1 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-background"
                    :class="entry.progress !== undefined && entry.progress >= 100 ? 'bg-green-500' : 'bg-primary'"
                  >
                    <Icon
                      v-if="entry.progress !== undefined && entry.progress >= 100"
                      name="lucide:check"
                      class="h-2 w-2 text-white"
                    />
                  </span>
                  <div
                    v-if="idx !== statusUpdates.length - 1"
                    class="absolute -left-[19px] top-4 h-[calc(100%+1rem)] w-0.5 bg-border"
                  />
                  <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon name="lucide:clock" class="h-3 w-3" />
                    {{ timeAgo(entry.date) }}
                    <span v-if="entry.progress !== undefined" class="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                      <Icon name="lucide:gauge" class="h-2.5 w-2.5" />
                      {{ entry.progress }}%
                    </span>
                  </div>
                  <p v-if="entry.note" class="mt-1 text-sm leading-relaxed">{{ entry.note }}</p>
                  <div v-if="entry.images && entry.images.length" class="mt-2 flex flex-wrap gap-1.5">
                    <img
                      v-for="(img, imgIdx) in entry.images"
                      :key="imgIdx"
                      :src="img"
                      alt=""
                      class="h-14 w-14 rounded-md border object-cover"
                    >
                  </div>
                </li>
              </ol>
              <div
                v-else
                class="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-sm text-muted-foreground"
              >
                <Icon name="lucide:message-square-dashed" class="h-4 w-4" />
                No timeline entries yet.
              </div>
            </div>
          </div>
        </ScrollArea>

        <div class="shrink-0 border-t bg-muted/30 px-6 py-3">
          <div class="flex items-center justify-between gap-2">
            <Button variant="ghost" @click="close">
              <Icon name="lucide:x" class="mr-2 h-4 w-4" />
              Close
            </Button>
            <Button variant="destructive" @click="handleDelete">
              <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
              Delete task
            </Button>
          </div>
        </div>
      </template>

      <div v-else class="flex flex-1 items-center justify-center">
        <p class="text-sm text-muted-foreground">Task not found.</p>
      </div>
    </SheetContent>
  </Sheet>
</template>
