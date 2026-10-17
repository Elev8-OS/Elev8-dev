<script setup lang="ts">
import type { ScheduledDay } from '~/lib/schedule'
import { parseLocalDateKey } from '~/components/activities/data/activities'
import BaseDatePicker from '~/components/base/DatePicker.vue'
import BaseTimePicker from '~/components/base/TimePicker.vue'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { useSchedule } from '~/composables/useSchedule'
import { useScheduleUndo } from '~/composables/useScheduleUndo'
import { useUsers } from '~/composables/useUsers'
import { DAY_OFF_TYPES, datesBetween, MAX_SHIFTS_PER_DAY, scheduleLabelLong, segmentsProblem } from '~/lib/schedule'
import { cn } from '~/lib/utils'

type Mode = 'default' | 'day_off' | 'working'

/** One person (a cell) or several (the Assign button). */
const props = defineProps<{ userIds: string[], date: string | null }>()
const open = defineModel<boolean>('open', { default: false })

const { getUser } = useUsers()
const { shifts, scheduleFor, overrideFor, setDayOff, setWorking, clearOverride } = useSchedule()
const { run } = useScheduleUndo()

const from = ref('')
const to = ref('')
const mode = ref<Mode>('day_off')
const dayOffType = ref<(typeof DAY_OFF_TYPES)[number]['value']>('leave')
/** `role` (the role's hours), a shift id, or `custom`. */
const hoursChoice = ref('role')
const startTime = ref('08:00')
const endTime = ref('17:00')
const note = ref('')
/** More shifts the same day (a split shift), in time order. A shift id, or `custom` with its own hours. */
interface ExtraShift { choice: string, start: string, end: string }
const extras = ref<ExtraShift[]>([])

const single = computed(() => props.userIds.length === 1 ? props.userIds[0]! : undefined)
const heading = computed(() => single.value ? (getUser(single.value)?.name ?? '') : `${props.userIds.length} people`)
const base = computed<ScheduledDay | undefined>(() => single.value && props.date ? scheduleFor(single.value, props.date) : undefined)
const existing = computed(() => single.value && props.date ? overrideFor(single.value, props.date) : undefined)

// Reset the form each time the dialog opens.
watch(open, (isOpen) => {
  if (!isOpen || !props.date)
    return
  from.value = props.date
  to.value = props.date
  const o = existing.value
  // A working day offers "day off", an off day offers "working day"; with several people, assigning a shift.
  mode.value = o ? o.kind : (single.value && base.value?.working ? 'day_off' : 'working')
  dayOffType.value = o?.dayOffType ?? 'leave'
  hoursChoice.value = o?.shiftId && shifts.value.some(t => t.id === o.shiftId) ? o.shiftId : o?.startTime ? 'custom' : (shifts.value[0] && !single.value ? shifts.value[0].id : 'role')
  startTime.value = o?.startTime ?? '08:00'
  endTime.value = o?.endTime ?? '17:00'
  note.value = o?.note ?? ''
  extras.value = (o?.extra ?? []).map(x => ({ choice: x.shiftId && shifts.value.some(t => t.id === x.shiftId) ? x.shiftId : 'custom', start: x.startTime, end: x.endTime }))
})

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const title = computed(() => props.date ? dayFmt.format(parseLocalDateKey(props.date)) : '')
const dates = computed(() => from.value && to.value ? datesBetween(from.value, to.value) : [])
const custom = computed(() => hoursChoice.value === 'custom')
// An end earlier than the start is a shift that runs past midnight; only the same time is wrong.
const hoursInvalid = computed(() => mode.value === 'working' && custom.value && startTime.value === endTime.value)

/** The hours of the first shift, when it has any: a shift's or the custom ones. The role's hours are not known here. */
const firstHours = computed(() => {
  if (custom.value)
    return { start: startTime.value, end: endTime.value }
  const t = shifts.value.find(x => x.id === hoursChoice.value)
  return t ? { start: t.start, end: t.end } : undefined
})
const hoursOf = (x: ExtraShift) => {
  const t = x.choice === 'custom' ? undefined : shifts.value.find(sh => sh.id === x.choice)
  return t ? { start: t.start, end: t.end } : { start: x.start, end: x.end }
}
const canSplit = computed(() => mode.value === 'working' && !!firstHours.value && !hoursInvalid.value)
const extrasProblem = computed(() => extras.value.length && canSplit.value ? segmentsProblem([firstHours.value!, ...extras.value.map(hoursOf)]) : undefined)

function addExtra() {
  // Start the next one after the last one ends, so the default is already valid.
  const last = extras.value.at(-1) ? hoursOf(extras.value.at(-1)!) : firstHours.value
  const startAt = last && last.end > last.start ? last.end : '20:00'
  const h = Number(startAt.slice(0, 2))
  const end = `${String(Math.min(23, h + 4)).padStart(2, '0')}:${startAt.slice(3)}`
  extras.value = [...extras.value, { choice: 'custom', start: startAt, end: end === startAt ? '23:45' : end }]
}

function removeExtra(index: number) {
  extras.value = extras.value.filter((_, i) => i !== index)
}

function updateExtra(index: number, patch: Partial<ExtraShift>) {
  extras.value = extras.value.map((x, i) => i === index ? { ...x, ...patch } : x)
}
const canSave = computed(() => props.userIds.length > 0 && dates.value.length > 0 && dates.value.length <= 62 && !hoursInvalid.value && !extrasProblem.value)

const MODES: { value: Mode, label: string, hint: string }[] = [
  { value: 'working', label: 'Working day', hint: 'Choose the shift or hours for this day' },
  { value: 'day_off', label: 'Day off', hint: 'Not working, so never counted as absent' },
  { value: 'default', label: 'Back to the usual schedule', hint: 'Remove the change: follow the role and their own schedule again' },
]

function save() {
  if (!canSave.value)
    return
  const n = dates.value.length
  const who = single.value ? heading.value : `${props.userIds.length} people`
  const message = mode.value === 'default'
    ? `${who} ${single.value ? 'is' : 'are'} back to the usual schedule`
    : `${who}: ${n} ${n === 1 ? 'day' : 'days'} updated`
  // All or nothing: if one person clashes, nobody is changed.
  const refused = run(message, () => {
    for (const id of props.userIds) {
      let problem: string | undefined
      if (mode.value === 'default') {
        problem = clearOverride(id, dates.value)
      }
      else if (mode.value === 'day_off') {
        problem = setDayOff(id, dates.value, { type: dayOffType.value, note: note.value })
      }
      else {
        const extra = extras.value.length && canSplit.value
          ? extras.value.map(x => x.choice === 'custom' ? { startTime: x.start, endTime: x.end } : { shiftId: x.choice })
          : undefined
        problem = custom.value
          ? setWorking(id, dates.value, { startTime: startTime.value, endTime: endTime.value, extra, note: note.value })
          : setWorking(id, dates.value, { shiftId: hoursChoice.value === 'role' ? undefined : hoursChoice.value, extra, note: note.value })
      }
      if (problem)
        return single.value ? problem : `${getUser(id)?.name}: ${problem}`
    }
  })
  if (!refused)
    open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ heading }}</DialogTitle>
        <DialogDescription>
          {{ title }}<span v-if="base"> · {{ scheduleLabelLong(base) }}</span>
        </DialogDescription>
      </DialogHeader>

      <div class="min-w-0 space-y-4">
        <div class="space-y-2">
          <Label>Set as</Label>
          <div class="grid gap-2">
            <button
              v-for="m in MODES"
              :key="m.value"
              type="button"
              :aria-pressed="mode === m.value"
              :class="cn('flex flex-col rounded-md border p-3 text-left text-sm transition-colors', mode === m.value ? 'border-primary bg-primary/5' : 'hover:bg-muted')"
              @click="mode = m.value"
            >
              <span class="font-medium">{{ m.label }}</span>
              <span class="text-xs text-muted-foreground">{{ m.hint }}</span>
            </button>
          </div>
        </div>

        <div v-if="mode === 'day_off'" class="space-y-2">
          <Label>Type</Label>
          <Select v-model="dayOffType">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in DAY_OFF_TYPES" :key="t.value" :value="t.value">
                {{ t.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="mode === 'working'" class="space-y-2">
          <Label>Shift</Label>
          <Select v-model="hoursChoice">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="role">
                Hours from the role
              </SelectItem>
              <SelectItem v-for="t in shifts" :key="t.id" :value="t.id">
                {{ t.name }}, {{ t.start }} to {{ t.end }}
              </SelectItem>
              <SelectItem value="custom">
                Custom hours
              </SelectItem>
            </SelectContent>
          </Select>
          <div v-if="custom" class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <Label>Start</Label>
              <BaseTimePicker v-model="startTime" :step="15" :start-hour="0" :end-hour="23" />
            </div>
            <div class="space-y-1">
              <Label>End</Label>
              <BaseTimePicker v-model="endTime" :step="15" :start-hour="0" :end-hour="23" />
            </div>
            <p v-if="hoursInvalid" class="col-span-2 text-xs text-destructive">
              The end has to be a different time than the start.
            </p>
            <p v-else-if="startTime > endTime" class="col-span-2 text-xs text-muted-foreground">
              Ends the next day.
            </p>
          </div>
          <template v-if="canSplit">
            <div v-for="(x, i) in extras" :key="i" class="space-y-2 rounded-md border p-3">
              <div class="flex items-center justify-between">
                <Label>Shift {{ i + 2 }}</Label>
                <Button type="button" variant="ghost" size="sm" @click="removeExtra(i)">
                  Remove
                </Button>
              </div>
              <Select :model-value="x.choice" @update:model-value="v => updateExtra(i, { choice: String(v) })">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in shifts" :key="t.id" :value="t.id">
                    {{ t.name }}, {{ t.start }} to {{ t.end }}
                  </SelectItem>
                  <SelectItem value="custom">
                    Custom hours
                  </SelectItem>
                </SelectContent>
              </Select>
              <div v-if="x.choice === 'custom'" class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <Label>Start</Label>
                  <BaseTimePicker :model-value="x.start" :step="15" :start-hour="0" :end-hour="23" @update:model-value="v => updateExtra(i, { start: v })" />
                </div>
                <div class="space-y-1">
                  <Label>End</Label>
                  <BaseTimePicker :model-value="x.end" :step="15" :start-hour="0" :end-hour="23" @update:model-value="v => updateExtra(i, { end: v })" />
                </div>
              </div>
            </div>
            <p v-if="extrasProblem" class="text-xs text-destructive">
              {{ extrasProblem }}
            </p>
            <Button v-if="extras.length + 1 < MAX_SHIFTS_PER_DAY" type="button" variant="outline" size="sm" @click="addExtra">
              <Icon name="lucide:plus" class="mr-2 size-4" />
              Add another shift this day
            </Button>
          </template>
          <p v-else-if="mode === 'working' && !hoursInvalid" class="text-xs text-muted-foreground">
            Pick a shift or custom hours to add another shift.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <Label>From</Label>
            <BaseDatePicker v-model="from" @update:model-value="v => { if (v && to < v) to = v }" />
          </div>
          <div class="space-y-1">
            <Label>To</Label>
            <BaseDatePicker v-model="to" :min="from" />
          </div>
          <p v-if="dates.length > 62" class="col-span-2 text-xs text-destructive">
            Pick at most 62 days at a time.
          </p>
          <p v-else-if="dates.length > 1" class="col-span-2 text-xs text-muted-foreground">
            {{ dates.length }} days.
          </p>
        </div>

        <div v-if="mode !== 'default'" class="space-y-1">
          <Label>Note (optional)</Label>
          <Textarea v-model="note" rows="2" placeholder="For example: covering a villa turnover" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!canSave" @click="save">
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
