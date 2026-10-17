<script setup lang="ts">
import type { WeekDay } from '~/components/users/data/roles'
import type { RotationCell, ScheduleRotation } from '~/lib/schedule'
import { parseLocalDateKey, toLocalDateKey } from '~/components/activities/data/activities'
import BaseDatePicker from '~/components/base/DatePicker.vue'
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { WEEK_DAYS } from '~/components/users/data/roles'
import { useRoles } from '~/composables/useRoles'
import { useSchedule } from '~/composables/useSchedule'
import { useScheduleUndo } from '~/composables/useScheduleUndo'
import { useUsers } from '~/composables/useUsers'
import { MAX_ROTATION_WEEKS, MAX_SHIFTS_PER_DAY, rotationProblem, segmentsProblem, sortDays, spansMidnight, weekStart } from '~/lib/schedule'
import { cn } from '~/lib/utils'

/**
 * One person's usual schedule, in one place: the same every week (days and shifts), or a rotation of weeks.
 * It starts from the role; this is only for a person who differs. A single day is changed in the grid.
 */
const props = defineProps<{ userId: string | null }>()
const open = defineModel<boolean>('open', { default: false })

const { getUser } = useUsers()
const { getRole } = useRoles()
const { run } = useScheduleUndo()
const { shifts, personDays, personShifts, rotations, weekDaysFor, setPersonDays, setPersonShifts, setRotation, removeRotation } = useSchedule()

type Mode = 'weekly' | 'rotating'
const OFF = 'off'
type Pick = string

const user = computed(() => props.userId ? getUser(props.userId) : undefined)
const role = computed(() => getRole(user.value?.roleId ?? ''))
const mode = ref<Mode>('weekly')

// Same every week
const draftDays = ref<WeekDay[]>([])
const shiftChoices = ref<string[]>([])

// Rotating. One shift (or off) per day here; a day that already holds several keeps them while untouched.
const startDate = ref('')
const weeks = ref<Record<WeekDay, Pick>[]>([])
const blankWeek = (): Record<WeekDay, Pick> => ({ Mon: OFF, Tue: OFF, Wed: OFF, Thu: OFF, Fri: OFF, Sat: OFF, Sun: OFF })

const existing = computed(() => props.userId ? rotations.value[props.userId] : undefined)

watch(open, (isOpen) => {
  if (!isOpen || !props.userId)
    return
  const r = existing.value
  mode.value = r ? 'rotating' : 'weekly'
  draftDays.value = [...weekDaysFor(props.userId)]
  shiftChoices.value = [...(personShifts.value[props.userId] ?? [])]
  startDate.value = r?.startDate ?? weekStart(toLocalDateKey(new Date()))
  weeks.value = r
    ? r.weeks.map((w) => {
        const week = blankWeek()
        for (const d of WEEK_DAYS) {
          const cell = w[d]
          week[d] = Array.isArray(cell) && cell[0] ? cell[0] : OFF
        }
        return week
      })
    : [blankWeek(), blankWeek()]
})

// --- Same every week
const roleDays = computed<WeekDay[]>(() => role.value?.workingHours.days ?? [])
const chosenTemplates = computed(() => shiftChoices.value.map(id => shifts.value.find(t => t.id === id)).filter(t => !!t))
const shiftsProblem = computed(() => segmentsProblem([...chosenTemplates.value].sort((a, b) => a.start.localeCompare(b.start)).map(t => ({ start: t.start, end: t.end }))))
const unusedShifts = computed(() => shifts.value.filter(t => !shiftChoices.value.includes(t.id)))
/** The first unused shift that starts after the picked ones end, if any. */
const addableShift = computed(() => unusedShifts.value.find(t =>
  !segmentsProblem([...chosenTemplates.value, t].sort((a, b) => a.start.localeCompare(b.start)).map(x => ({ start: x.start, end: x.end })))))
const followsRole = computed(() => sortDays(draftDays.value).join() === sortDays(roleDays.value).join() && !shiftChoices.value.length)

const roleSummary = computed(() => {
  const wh = role.value?.workingHours
  if (!wh)
    return ''
  const days = wh.days.length === 7 ? 'every day' : wh.days.join(', ')
  const names = (wh.shiftIds ?? []).map(id => shifts.value.find(t => t.id === id)).filter(t => !!t)
  const hours = wh.scheduleType === 'flexible'
    ? 'flexible hours'
    : names.length ? names.map(t => `${t.name} ${t.start} to ${t.end}`).join(' + ') : `${wh.startTime} to ${wh.endTime}`
  return `${days}, ${hours}`
})

function toggleDay(day: WeekDay) {
  draftDays.value = draftDays.value.includes(day) ? draftDays.value.filter(d => d !== day) : [...draftDays.value, day]
}

function resetToRole() {
  draftDays.value = [...roleDays.value]
  shiftChoices.value = []
}

// --- Rotating
function setCount(n: number) {
  weeks.value = Array.from({ length: n }, (_, i) => weeks.value[i] ?? blankWeek())
}

function setCell(weekIndex: number, day: WeekDay, value: Pick) {
  weeks.value = weeks.value.map((w, i) => i === weekIndex ? { ...w, [day]: value } : w)
}

function fillWeek(weekIndex: number, value: Pick, days: WeekDay[]) {
  weeks.value = weeks.value.map((w, i) => i === weekIndex ? { ...w, ...Object.fromEntries(days.map(d => [d, value])) } : w)
}

const candidate = computed<ScheduleRotation | undefined>(() => props.userId
  ? {
      userId: props.userId,
      startDate: weekStart(startDate.value || toLocalDateKey(new Date())),
      weeks: weeks.value.map((w, i) => Object.fromEntries(WEEK_DAYS.map((d): [WeekDay, RotationCell] => {
        const original = existing.value?.weeks[i]?.[d]
        if (Array.isArray(original) && original[0] === w[d])
          return [d, original]
        return [d, w[d] === OFF ? 'off' : [w[d]]]
      }))),
    }
  : undefined)
const rotationIssue = computed(() => candidate.value ? rotationProblem(candidate.value, id => shifts.value.find(t => t.id === id)) : undefined)
const hasWork = computed(() => weeks.value.some(w => WEEK_DAYS.some(d => w[d] !== OFF)))

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
function weekLabel(i: number) {
  const from = parseLocalDateKey(weekStart(startDate.value || toLocalDateKey(new Date())))
  return `Week ${i + 1} · ${dateFmt.format(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i * 7))}`
}

const canSave = computed(() => mode.value === 'weekly' ? !!draftDays.value.length && !shiftsProblem.value : !rotationIssue.value && hasWork.value)

function save() {
  const id = props.userId
  if (!id || !canSave.value)
    return
  const refused = run(`Schedule saved for ${user.value?.name}`, () => {
    if (mode.value === 'weekly') {
      // The same days as the role, with no shift of their own, is no change: they keep following the role.
      const problem = setPersonDays(id, sortDays(draftDays.value).join() === sortDays(roleDays.value).join() ? null : draftDays.value) ?? setPersonShifts(id, shiftChoices.value)
      if (!problem && existing.value)
        removeRotation(id)
      return problem
    }
    return candidate.value ? setRotation(id, candidate.value.startDate, candidate.value.weeks) : undefined
  })
  if (!refused)
    open.value = false
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 sm:max-w-2xl">
      <SheetHeader>
        <div class="flex items-center gap-3">
          <BasePersonAvatar v-if="user" :name="user.name" :src="user.avatarUrl" class="size-10" />
          <div class="min-w-0">
            <SheetTitle class="truncate">
              {{ user?.name }}
            </SheetTitle>
            <SheetDescription class="truncate">
              {{ role?.name }}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <ScrollArea class="min-h-0 flex-1">
        <div class="space-y-5 px-4 pb-4">
          <div class="rounded-md bg-muted p-3 text-sm">
            <p class="font-medium">
              From the role
            </p>
            <p class="text-muted-foreground">
              {{ roleSummary }}.
              <NuxtLink to="/schedule?tab=defaults" class="font-medium text-foreground underline underline-offset-2" @click="open = false">Change the role</NuxtLink>
            </p>
          </div>

          <div class="space-y-2">
            <Label>This person works</Label>
            <ToggleGroup :model-value="mode" type="single" variant="outline" class="w-full" @update:model-value="v => { if (v === 'weekly' || v === 'rotating') mode = v }">
              <ToggleGroupItem value="weekly">
                The same every week
              </ToggleGroupItem>
              <ToggleGroupItem value="rotating">
                A rotation
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <!-- The same every week -->
          <div v-if="mode === 'weekly'" class="space-y-4">
            <div class="space-y-2">
              <Label>Days</Label>
              <div class="grid grid-cols-7 gap-1.5">
                <button
                  v-for="d in WEEK_DAYS"
                  :key="d"
                  type="button"
                  :aria-pressed="draftDays.includes(d)"
                  :class="cn('rounded-md border py-2 text-sm font-medium transition-colors', draftDays.includes(d) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')"
                  @click="toggleDay(d)"
                >
                  {{ d }}
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <Label>Shifts</Label>
              <p v-if="!shiftChoices.length" class="text-xs text-muted-foreground">
                None picked: the hours come from the role.
              </p>
              <div v-for="(id, i) in shiftChoices" :key="id" class="flex items-center gap-2">
                <Select :model-value="id" @update:model-value="v => shiftChoices = shiftChoices.map((x, k) => k === i ? String(v) : x)">
                  <SelectTrigger class="w-full" :aria-label="`Shift ${i + 1}`">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="t in shifts.filter(x => x.id === id || !shiftChoices.includes(x.id))" :key="t.id" :value="t.id">
                      {{ t.name }}, {{ t.start }} to {{ t.end }}{{ spansMidnight(t.start, t.end) ? ' (+1)' : '' }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" class="size-9 shrink-0" :aria-label="`Remove shift ${i + 1}`" @click="shiftChoices = shiftChoices.filter((_, k) => k !== i)">
                  <Icon name="lucide:x" class="size-4" />
                </Button>
              </div>
              <p v-if="shiftsProblem" class="text-xs text-destructive">
                {{ shiftsProblem }}
              </p>
              <Button v-if="addableShift && shiftChoices.length < MAX_SHIFTS_PER_DAY" type="button" variant="outline" size="sm" @click="shiftChoices = [...shiftChoices, addableShift.id]">
                <Icon name="lucide:plus" class="mr-2 size-4" />
                {{ shiftChoices.length ? 'Add another shift a day' : 'Add a shift' }}
              </Button>
              <p v-else-if="shiftChoices.length && unusedShifts.length && shiftChoices.length < MAX_SHIFTS_PER_DAY" class="text-xs text-muted-foreground">
                No other shift fits with these. Make one that starts later in the Shifts tab.
              </p>
              <p v-if="shiftChoices.length > 1" class="text-xs text-muted-foreground">
                Two or more shifts in a day make a split shift.
              </p>
            </div>

            <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span v-if="followsRole">Same as the role.</span>
              <span v-else>Differs from the role.</span>
              <Button v-if="!followsRole" type="button" variant="ghost" size="sm" @click="resetToRole">
                Back to the role
              </Button>
            </div>
            <p v-if="existing" class="text-xs text-muted-foreground">
              Saving this stops the rotation.
            </p>
          </div>

          <!-- A rotation -->
          <div v-else class="min-w-0 space-y-4">
            <p class="text-xs text-muted-foreground">
              Weeks that repeat by themselves: week 1 starts on the date below, then week 2, and after the last week it starts again from week 1.
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <Label>Starts (week 1)</Label>
                <BaseDatePicker v-model="startDate" />
                <p class="text-xs text-muted-foreground">
                  Moves to that week's Monday. Days before it follow the usual schedule.
                </p>
              </div>
              <div class="space-y-1">
                <Label>Weeks before it repeats</Label>
                <Select :model-value="String(weeks.length)" @update:model-value="v => setCount(Number(v))">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="n in MAX_ROTATION_WEEKS" :key="n" :value="String(n)">
                      {{ n }} {{ n === 1 ? 'week' : 'weeks' }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="overflow-x-auto">
              <div class="min-w-[32rem] space-y-3">
                <div v-for="(w, i) in weeks" :key="i" class="space-y-1.5">
                  <div class="flex flex-wrap items-center justify-between gap-1">
                    <p class="text-sm font-medium">
                      {{ weekLabel(i) }}
                    </p>
                    <div class="flex flex-wrap gap-1">
                      <Button v-for="t in shifts.slice(0, 3)" :key="t.id" type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="fillWeek(i, t.id, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])">
                        Mon to Fri {{ t.name }}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="fillWeek(i, OFF, [...WEEK_DAYS])">
                        All off
                      </Button>
                    </div>
                  </div>
                  <div class="grid grid-cols-7 gap-1.5">
                    <div v-for="d in WEEK_DAYS" :key="d" class="space-y-1">
                      <Label class="text-xs text-muted-foreground">{{ d }}</Label>
                      <Select :model-value="w[d]" @update:model-value="v => setCell(i, d, String(v))">
                        <SelectTrigger :aria-label="`Week ${i + 1}, ${d}`" class="h-9 w-full px-2 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem :value="OFF">
                            Off
                          </SelectItem>
                          <SelectItem v-for="t in shifts" :key="t.id" :value="t.id">
                            {{ t.name }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p v-if="rotationIssue" class="text-sm text-destructive">
              {{ rotationIssue }}
            </p>
            <p v-else-if="!hasWork" class="text-xs text-muted-foreground">
              Every day is off. Pick a shift for the days they work.
            </p>
          </div>
        </div>
      </ScrollArea>

      <SheetFooter class="border-t px-4 py-3 sm:flex-row sm:justify-end">
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!canSave" @click="save">
          Save
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
