<script setup lang="ts">
import type { ScheduledDay } from '~/lib/schedule'
import type { AttendanceEntry } from '~/lib/schedule-cell'
import { parseLocalDateKey } from '~/components/activities/data/activities'
import { Button } from '~/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '~/components/ui/hover-card'
import { scheduleLabelLong, toneOf } from '~/lib/schedule'
import { clockedLabel, dayStatus, shortRange } from '~/lib/schedule-cell'
import { cn } from '~/lib/utils'

/**
 * One day of one person in the week grid. The cell only summarises (the shift, a status once the time has
 * passed, a few small markers); the detail is in the hover card. `view` picks what the cell is about: the
 * plan (`schedule`) or what was clocked (`attendance`).
 */
const props = defineProps<{
  name: string
  date: string
  today: string
  day: ScheduledDay
  /** The overnight shift of the day before still running into this day. */
  carry?: { until: string, name?: string }
  attendance: AttendanceEntry[]
  view: 'schedule' | 'attendance'
}>()
const emit = defineEmits<{ change: [], openAttendance: [] }>()

const isToday = computed(() => props.date === props.today)
const status = computed(() => dayStatus(props.attendance, props.date, props.today))
const shown = computed(() => props.day.working ? props.day.segments.slice(0, 2) : [])
const hidden = computed(() => props.day.working ? Math.max(0, props.day.segments.length - 2) : 0)
const fixedHours = (s: { start?: string, end?: string, flexible: boolean }) => !s.flexible && !!s.start && !!s.end

const SOURCE: Record<ScheduledDay['source'], string> = {
  role: 'From the role',
  person: 'Their own schedule',
  rotation: 'Rotation',
  override: 'Changed for this day',
}
const accent = computed(() => props.day.source === 'override' || props.day.source === 'rotation')

const dateLabel = computed(() => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseLocalDateKey(props.date)))
const hasAnything = computed(() => props.day.working || props.attendance.length > 0)

const ariaLabel = computed(() => {
  const clocked = props.attendance.map(a => a.record ? `Clocked ${clockedLabel(a.record, props.date, props.today)}` : 'Absent')
  return `${props.name}, ${props.date}: ${scheduleLabelLong(props.day)}${clocked.length ? `. ${clocked.join(', ')}` : ''}. Change`
})
</script>

<template>
  <HoverCard :open-delay="250" :close-delay="80">
    <HoverCardTrigger as-child>
      <button
        type="button"
        :aria-label="ariaLabel"
        :class="cn(
          'relative flex h-16 w-full flex-col justify-center gap-0.5 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:border-primary',
          day.working ? 'bg-card' : 'border-dashed bg-muted/60 text-muted-foreground',
          accent && 'border-primary/50',
          isToday && 'ring-1 ring-primary/40',
        )"
        @click="emit('change')"
      >
        <!-- Attendance view: what was clocked -->
        <template v-if="view === 'attendance'">
          <template v-if="attendance.length">
            <span
              v-for="a in attendance.slice(0, 3)"
              :key="a.segment"
              :class="cn('flex items-center gap-1 truncate tabular-nums', dayStatus([a], date, today)?.problem ? 'font-medium text-destructive' : '')"
            >
              <Icon :name="a.record ? 'lucide:log-in' : 'lucide:user-x'" class="size-3 shrink-0" />
              {{ a.record ? `${a.record.clockIn}-${a.record.clockOut ? `${a.record.clockOut}${a.record.clockOutNextDay ? ' +1' : ''}` : (date < today ? '?' : 'now')}` : 'Absent' }}
            </span>
            <span v-if="!day.working" class="text-[10px] text-muted-foreground">Day off</span>
          </template>
          <span v-else-if="!day.working" class="text-center">Day off</span>
          <span v-else class="text-center text-muted-foreground">{{ date > today ? '' : '-' }}</span>
        </template>

        <!-- Schedule view: the plan, then a status and a few markers -->
        <template v-else>
          <template v-if="day.working">
            <template v-if="shown.some(fixedHours)">
              <span v-for="(part, i) in shown" :key="i" class="flex min-w-0 items-center gap-1.5">
                <span v-if="part.name" :class="cn('size-2 shrink-0 rounded-full', toneOf(part.tone).dot)" aria-hidden="true" />
                <span class="truncate font-medium">{{ part.name ?? (fixedHours(part) ? shortRange(part.start!, part.end!) : 'Flexible') }}</span>
                <span v-if="part.name && fixedHours(part)" class="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{{ shortRange(part.start!, part.end!) }}</span>
              </span>
              <span v-if="hidden" class="text-[10px] text-muted-foreground">+{{ hidden }} more</span>
            </template>
            <span v-else class="text-muted-foreground">Flexible</span>
          </template>
          <span v-else class="text-center">{{ scheduleLabelLong(day) }}</span>

          <span v-if="status || carry || day.source === 'override' || day.source === 'rotation'" class="mt-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Icon v-if="carry" name="lucide:moon" class="size-3" />
            <Icon v-if="day.source === 'rotation'" name="lucide:repeat" class="size-3" />
            <Icon v-else-if="day.source === 'override'" name="lucide:pencil" class="size-3" />
            <span v-if="status" :class="cn('ml-auto flex items-center gap-1', status.problem && 'font-medium text-destructive')">
              <Icon :name="status.icon" class="size-3" />
              {{ status.label }}
            </span>
          </span>
        </template>
      </button>
    </HoverCardTrigger>

    <HoverCardContent class="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-sm" align="start">
      <div>
        <p class="font-medium">
          {{ name }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ dateLabel }}
        </p>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Planned
        </p>
        <template v-if="day.working">
          <p v-for="(part, i) in day.segments" :key="i" class="tabular-nums">
            {{ part.name ? `${part.name}, ` : '' }}{{ part.flexible || !part.start ? 'Flexible hours' : `${part.start} to ${part.end}` }}
          </p>
        </template>
        <p v-else>
          {{ scheduleLabelLong(day) }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ SOURCE[day.source] }}<template v-if="day.note">: {{ day.note }}</template>
        </p>
        <p v-if="carry" class="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon name="lucide:moon" class="size-3" />
          Last night's shift runs until {{ carry.until }}
        </p>
      </div>

      <div v-if="attendance.length" class="space-y-1">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Clocked
        </p>
        <div v-for="a in attendance" :key="a.segment" class="space-y-0.5">
          <p v-if="a.record" :class="cn('tabular-nums', dayStatus([a], date, today)?.problem && 'text-destructive')">
            <template v-if="attendance.length > 1 || a.segment > 1">Shift {{ a.segment }}: </template>{{ clockedLabel(a.record, date, today) }}
            <span class="text-xs">({{ dayStatus([a], date, today)?.label }})</span>
          </p>
          <p v-else class="font-medium text-destructive">
            <template v-if="attendance.length > 1 || a.segment > 1">Shift {{ a.segment }}: </template>Absent
          </p>
          <p v-if="a.record?.clockInNote" class="text-xs text-muted-foreground">
            In: {{ a.record.clockInNote }}
          </p>
          <p v-if="a.record?.clockOutNote" class="text-xs text-muted-foreground">
            Out: {{ a.record.clockOutNote }}
          </p>
        </div>
      </div>
      <p v-else-if="hasAnything && date < today" class="text-xs text-muted-foreground">
        Nothing clocked.
      </p>

      <div class="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" class="whitespace-nowrap" @click="emit('change')">
          Change this day
        </Button>
        <Button v-if="attendance.length || date <= today" size="sm" variant="ghost" class="whitespace-nowrap" @click="emit('openAttendance')">
          <Icon name="lucide:external-link" class="mr-1.5 size-3.5" />
          Open in Attendance
        </Button>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
