<script setup lang="ts">
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { cleaningJobPriorityLabels } from '~/components/cleaning/data/cleaning-jobs'
import { computed } from 'vue'
import { cleaningTypeIcons, formatTime } from '~/components/operations-calendar/data/operations-calendar'
import { staffMembers } from '~/components/tasks/data/data'

const props = defineProps<{
  event: CalendarEvent
  draggable?: boolean
}>()

const emit = defineEmits<{
  click: [event: CalendarEvent]
  dragstart: [event: CalendarEvent]
}>()

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
  return `${formatTime(props.event.start)} – ${formatTime(props.event.end)}`
})

const cleaningStatusConfig: Record<string, { label: string, class: string, icon: string, spin?: boolean }> = {
  draft: { label: 'Draft', class: 'bg-muted text-muted-foreground', icon: 'lucide:file-text' },
  confirmed: { label: 'Confirmed', class: 'bg-sky-100 text-sky-700', icon: 'lucide:check-circle-2' },
  in_progress: { label: 'In progress', class: 'bg-amber-100 text-amber-700', icon: 'lucide:loader', spin: true },
  done: { label: 'Completed', class: 'bg-emerald-100 text-emerald-700', icon: 'lucide:check' },
  cancelled: { label: 'Cancelled', class: 'bg-red-100 text-red-700', icon: 'lucide:ban' },
  missed: { label: 'Missed', class: 'bg-red-100 text-red-700', icon: 'lucide:x' },
}

const statusConfig = computed(() => {
  if (props.event.type !== 'cleaning' || !props.event.status)
    return null
  return cleaningStatusConfig[props.event.status] ?? null
})

const priorityConfig = computed(() => {
  if (props.event.type !== 'cleaning' || !props.event.priority)
    return null
  return {
    label: cleaningJobPriorityLabels[props.event.priority],
    isHigh: props.event.priority === 'high',
  }
})

const cleaningTypeConfig = computed(() => {
  if (props.event.type !== 'cleaning' || !props.event.cleaningType)
    return null
  return {
    type: props.event.cleaningType,
    label: props.event.cleaningTypeLabel ?? '',
    icon: cleaningTypeIcons[props.event.cleaningType],
  }
})

const hasPet = computed(() => props.event.type === 'cleaning' && Boolean(props.event.hasPet))

type ChipStateTone = 'done' | 'in_progress' | 'missed' | 'was_missed' | 'cancelled' | null

const stateMeta = computed<{ label: string, icon: string, tone: ChipStateTone } | null>(() => {
  if (props.event.type !== 'cleaning')
    return null
  const status = props.event.status
  if (status === 'done')
    return { label: 'Completed', icon: 'lucide:check', tone: 'done' }
  if (status === 'in_progress')
    return { label: 'In progress', icon: 'lucide:loader', tone: 'in_progress' }
  if (status === 'missed')
    return { label: 'Missed', icon: 'lucide:x', tone: 'missed' }
  if (status === 'cancelled')
    return { label: 'Cancelled', icon: 'lucide:ban', tone: 'cancelled' }
  if (status === 'scheduled' && props.event.start) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const scheduled = new Date(props.event.start)
    scheduled.setHours(0, 0, 0, 0)
    if (scheduled.getTime() < today.getTime())
      return { label: 'Was missed', icon: 'lucide:x', tone: 'was_missed' }
  }
  return null
})

const assignedStaff = computed(() => {
  const names = props.event.assignedTo ?? []
  return names.map((name) => {
    const member = staffMembers.find(s => s.label === name)
    return {
      name,
      initials: member?.label.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      color: member ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
    }
  })
})

const isUnassigned = computed(() => assignedStaff.value.length === 0)
</script>

<template>
  <button
    type="button"
    :draggable="draggable"
    class="group flex w-full flex-col gap-0.5 rounded border bg-background px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm transition-shadow hover:shadow-md"
    :class="{
      'border-sky-200 bg-sky-50/40': event.type === 'cleaning' && !stateMeta,
      'border-emerald-300 bg-emerald-50/50': stateMeta?.tone === 'done',
      'border-amber-300 bg-amber-50/50': stateMeta?.tone === 'in_progress',
      'border-red-300 bg-red-50/50': stateMeta?.tone === 'missed' || stateMeta?.tone === 'was_missed' || stateMeta?.tone === 'cancelled',
    }"
    @click.stop="emit('click', event)"
    @dragstart.stop="emit('dragstart', event)"
  >
    <!-- Title row with type icon + time + pet (one line) -->
    <div class="flex items-center gap-1">
      <Icon
        v-if="event.type === 'cleaning'"
        :name="cleaningTypeConfig?.icon ?? 'lucide:brush'"
        class="h-3 w-3 shrink-0 text-muted-foreground"
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
      <p class="min-w-0 flex-1 truncate text-[10px] font-semibold">
        {{ cleaningTypeConfig?.label || displayTitle }}
      </p>
      <Icon
        v-if="hasPet"
        name="lucide:paw-print"
        class="h-2.5 w-2.5 shrink-0 text-amber-600"
      />
    </div>

    <!-- Time range (if present) -->
    <p v-if="timeRange" class="text-[9px] text-muted-foreground">
      {{ timeRange }}
    </p>

    <!-- Status + priority badges (cleaning) — one row -->
    <div
      v-if="event.type === 'cleaning'"
      class="flex flex-wrap items-center gap-0.5"
    >
      <Badge
        v-if="priorityConfig?.isHigh"
        class="gap-0.5 border-0 bg-red-100 px-1 py-0 text-[9px] font-semibold text-red-600"
      >
        <Icon name="lucide:flag" class="h-2.5 w-2.5 fill-red-500 text-red-500" />
        High
      </Badge>
      <Badge
        v-if="stateMeta || statusConfig"
        :class="['gap-0.5 border-0 px-1 py-0 text-[9px] font-semibold', (stateMeta ? cleaningStatusConfig[event.status as string]?.class : statusConfig?.class) || '']"
      >
        <Icon
          :name="(stateMeta?.icon ?? statusConfig?.icon) || 'lucide:circle'"
          :class="[(stateMeta?.tone === 'in_progress' || event.status === 'in_progress') ? 'h-2.5 w-2.5 animate-spin' : 'h-2.5 w-2.5']"
        />
        {{ stateMeta?.label || statusConfig?.label }}
      </Badge>
    </div>

    <!-- Staff chips (cleaning) -->
    <div
      v-if="event.type === 'cleaning'"
      class="flex flex-wrap items-center gap-0.5"
    >
      <span
        v-for="member in assignedStaff.slice(0, 2)"
        :key="member.name"
        class="inline-flex items-center gap-0.5 rounded-full bg-background px-1 text-[9px] font-medium ring-1 ring-border"
        :title="member.name"
      >
        <span
          class="flex h-3 w-3 items-center justify-center rounded-full text-[7px] font-bold"
          :class="member.color"
        >
          {{ member.initials }}
        </span>
        <span class="max-w-[50px] truncate">{{ member.name.split(' ')[0] }}</span>
      </span>
      <span
        v-if="isUnassigned"
        class="inline-flex items-center gap-0.5 rounded-full bg-background px-1 text-[9px] font-medium text-muted-foreground ring-1 ring-border"
      >
        <Icon name="lucide:user-plus" class="h-2.5 w-2.5" />
        Unassigned
      </span>
    </div>

    <!-- Task badges -->
    <div
      v-if="event.type === 'task'"
      class="flex flex-wrap items-center gap-0.5"
    >
      <Badge
        v-if="isOverdueTask"
        variant="destructive"
        class="gap-0.5 border-0 bg-red-100 px-1.5 py-0 text-[9px] font-semibold text-red-600"
      >
        <Icon name="lucide:alert-triangle" class="h-2.5 w-2.5" />
        Overdue
      </Badge>
      <Badge
        v-if="event.priority === 'high' || event.priority === 'urgent'"
        class="gap-0.5 border-0 bg-red-100 px-1.5 py-0 text-[9px] font-semibold text-red-600"
      >
        <Icon name="lucide:flag" class="h-2.5 w-2.5 fill-red-500 text-red-500" />
        {{ event.priority === 'urgent' ? 'Urgent' : 'High' }}
      </Badge>
      <Badge
        v-if="event.assigneeLabel"
        class="gap-0.5 border-0 bg-muted px-1.5 py-0 text-[9px] font-medium text-muted-foreground"
      >
        <Icon
          :name="event.assigneeType === 'person' ? 'lucide:user' : 'lucide:users-round'"
          class="h-2.5 w-2.5"
        />
        <span class="max-w-[60px] truncate">{{ event.assigneeLabel }}</span>
      </Badge>
      <Badge
        v-else
        class="gap-0.5 border-0 bg-muted px-1.5 py-0 text-[9px] font-medium text-muted-foreground"
      >
        <Icon name="lucide:user-plus" class="h-2.5 w-2.5" />
        Unassigned
      </Badge>
    </div>

    <!-- Upsell status -->
    <div
      v-if="event.type === 'upsell' && event.status"
      class="flex items-center"
    >
      <Badge
        :class="['gap-0.5 border-0 px-1.5 py-0 text-[9px] font-semibold', event.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : event.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground']"
      >
        {{ event.status === 'not_started' ? 'Pending' : event.status === 'in_progress' ? 'In Progress' : 'Done' }}
      </Badge>
    </div>
  </button>
</template>
