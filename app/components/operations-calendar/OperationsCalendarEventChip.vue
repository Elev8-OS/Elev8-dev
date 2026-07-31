<script setup lang="ts">
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { cleaningJobPriorityLabels } from '~/components/cleaning/data/cleaning-jobs'
import { computed } from 'vue'
import { formatTime } from '~/components/operations-calendar/data/operations-calendar'

const props = defineProps<{
  event: CalendarEvent
  draggable?: boolean
}>()

const emit = defineEmits<{
  click: [event: CalendarEvent]
  dragstart: [event: CalendarEvent]
}>()

const chipClasses = computed(() => {
  const base = 'flex w-full flex-col rounded-md border-l-4 px-2 py-1 text-left text-[11px] leading-tight shadow-sm transition-shadow hover:shadow-md'
  if (props.event.type === 'guest_stay') {
    return `${base} border-l-primary/60 bg-primary/10 border-primary/20 text-foreground`
  }

  if (props.event.type === 'task') {
    if (isOverdueTask.value) {
      return `${base} border-l-destructive bg-destructive/10 border-destructive/50 text-foreground ring-1 ring-destructive/40`
    }
    return `${base} border-l-amber-500 bg-amber-500/10 border-amber-500/30 text-foreground`
  }

  if (props.event.type === 'upsell') {
    return `${base} border-l-violet-500 bg-violet-500/10 border-violet-500/20 text-foreground`
  }

  if (props.event.type === 'cleaning') {
    return `${base} border-l-sky-500 bg-sky-500/10 border-sky-500/30 text-foreground`
  }
  return `${base} border-l-muted bg-card border-border text-foreground`
})

const isOverdueTask = computed(() => {
  if (props.event.type !== 'task' || !props.event.start)
    return false
  const dueDate = props.event.start.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (dueDate >= today)
    return false
  const status = props.event.status
  return status !== 'done' && status !== 'canceled'
})

const displayTitle = computed(() => {
  if (props.event.type === 'guest_stay')
    return props.event.guestName ?? props.event.title
  return props.event.title
})

const timeRange = computed(() => {
  if (props.event.type === 'guest_stay' || props.event.type === 'task')
    return ''
  return `${formatTime(props.event.start)} - ${formatTime(props.event.end)}`
})

const cleaningStatusConfig: Record<string, { label: string, variant: 'outline' | 'default' | 'secondary' | 'destructive', class: string }> = {
  draft: { label: 'Draft', variant: 'outline', class: '' },
  confirmed: { label: 'Confirmed', variant: 'default', class: 'bg-blue-500/80' },
  in_progress: { label: 'In Progress', variant: 'default', class: 'bg-amber-500/80' },
  done: { label: 'Done', variant: 'default', class: 'bg-emerald-500/80' },
  cancelled: { label: 'Cancelled', variant: 'destructive', class: '' },
  missed: { label: 'Missed', variant: 'destructive', class: '' },
}

const statusConfig = computed(() => {
  if (props.event.type !== 'cleaning' || !props.event.status)
    return null
  return cleaningStatusConfig[props.event.status] ?? null
})

const priorityConfig = computed(() => {
  if (props.event.type !== 'cleaning' || !props.event.priority)
    return null
  const isHigh = props.event.priority === 'high'
  return {
    label: cleaningJobPriorityLabels[props.event.priority],
    variant: isHigh ? ('destructive' as const) : ('secondary' as const),
    icon: isHigh ? 'lucide:flag' : null,
    highlight: isHigh,
  }
})
</script>

<template>
  <button
    type="button"
    :class="chipClasses"
    :draggable="draggable"
    @click.stop="emit('click', event)"
    @dragstart.stop="emit('dragstart', event)"
  >
    <p class="flex min-w-0 items-center gap-1.5 truncate font-semibold">
      <Icon
        v-if="event.type === 'cleaning'"
        name="lucide:brush"
        class="h-3 w-3 shrink-0 text-sky-600"
      />
      <Icon
        v-else-if="event.type === 'task'"
        name="lucide:clipboard-list"
        class="h-3 w-3 shrink-0 text-amber-600"
      />
      <Icon
        v-else-if="event.type === 'upsell'"
        name="lucide:sparkles"
        class="h-3 w-3 shrink-0 text-violet-600"
      />
      <Icon
        v-else-if="event.type === 'guest_stay'"
        name="lucide:bed"
        class="h-3 w-3 shrink-0 text-primary"
      />
      <span class="min-w-0 truncate">{{ displayTitle }}</span>
    </p>
    <p v-if="timeRange" class="min-w-0 truncate text-[10px] text-muted-foreground">
      {{ timeRange }}
    </p>
    <div v-if="event.type === 'cleaning'" class="mt-0.5 flex flex-wrap items-center gap-1">
      <Badge
        v-if="priorityConfig"
        :variant="priorityConfig.variant"
        class="text-[9px] font-medium"
        :class="priorityConfig.highlight ? 'bg-destructive/90 text-white' : ''"
        data-testid="event-priority-badge"
      >
        <Icon v-if="priorityConfig.icon" :name="priorityConfig.icon" class="mr-0.5 h-2.5 w-2.5" />
        {{ priorityConfig.label }}
      </Badge>
      <Badge v-if="!event.assignedTo?.length" variant="destructive" class="text-[9px] font-medium">
        Unassigned
      </Badge>
      <Badge
        v-for="name in event.assignedTo"
        :key="name"
        variant="secondary"
        class="text-[9px] font-medium"
      >
        {{ name }}
      </Badge>
      <Badge v-if="statusConfig" :variant="statusConfig.variant" class="text-[9px] font-medium" :class="statusConfig.class">
        {{ statusConfig.label }}
      </Badge>
    </div>
    <div v-if="event.type === 'task'" class="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
      <Badge
        v-if="isOverdueTask"
        variant="destructive"
        class="gap-0.5 text-[9px] font-medium"
        data-testid="event-overdue-badge"
      >
        <Icon name="lucide:alert-triangle" class="h-2.5 w-2.5" />
        Overdue
      </Badge>
      <Badge
        v-if="event.priority === 'high' || event.priority === 'urgent'"
        variant="destructive"
        class="gap-0.5 text-[9px] font-medium"
        data-testid="event-priority-badge"
      >
        <Icon name="lucide:flag" class="h-2.5 w-2.5" />
        {{ event.priority === 'urgent' ? 'Urgent' : 'High' }}
      </Badge>
      <Badge
        v-if="event.assigneeLabel"
        variant="secondary"
        class="max-w-full min-w-0 gap-0.5 text-[9px] font-medium"
        data-testid="event-assignee-badge"
      >
        <Icon
          :name="event.assigneeType === 'person' ? 'lucide:user' : 'lucide:users-round'"
          class="h-2.5 w-2.5 shrink-0"
        />
        <span class="min-w-0 flex-1 truncate">
          {{ event.assigneeLabel }}<span v-if="event.assigneeRoleLabel" class="text-muted-foreground"> · {{ event.assigneeRoleLabel }}</span>
        </span>
      </Badge>
      <Badge v-else variant="outline" class="gap-0.5 text-[9px] font-medium text-muted-foreground">
        <Icon name="lucide:user-plus" class="h-2.5 w-2.5" />
        Unassigned
      </Badge>
    </div>
    <div v-if="event.type === 'upsell'" class="mt-0.5 flex flex-wrap items-center gap-1">
      <Badge
        v-if="event.status"
        :variant="event.status === 'completed' ? 'default' : event.status === 'in_progress' ? 'secondary' : 'outline'"
        class="text-[9px] font-medium"
        :class="event.status === 'completed' ? 'bg-emerald-500/80' : ''"
      >
        {{ event.status === 'not_started' ? 'Pending' : event.status === 'in_progress' ? 'In Progress' : 'Done' }}
      </Badge>
    </div>
  </button>
</template>
