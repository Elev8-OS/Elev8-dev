<script setup lang="ts">
import type { Role, WeekDay } from '~/components/users/data/roles'
import { Button } from '~/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { WEEK_DAYS } from '~/components/users/data/roles'
import { useRoles } from '~/composables/useRoles'
import { useSchedule } from '~/composables/useSchedule'
import { useScheduleUndo } from '~/composables/useScheduleUndo'
import { useUsers } from '~/composables/useUsers'
import { MAX_SHIFTS_PER_DAY, spansMidnight, workingHoursProblem } from '~/lib/schedule'
import { cn } from '~/lib/utils'

/** The working days and shifts each role follows. A person only differs from it if they have a schedule of their own. */
const { roles } = useRoles()
const { users } = useUsers()
const { run } = useScheduleUndo()
const { shifts, personDays, personShifts, rotations, setRoleHours } = useSchedule()

const members = (role: Role) => users.value.filter(u => u.roleId === role.id && u.status === 'active')
const ownCount = (role: Role) => members(role).filter(u => personDays.value[u.id] || personShifts.value[u.id]?.length || rotations.value[u.id]).length

// Roles with people first, then by name.
const rows = computed(() => [...roles.value].sort((a, b) => members(b).length - members(a).length || a.name.localeCompare(b.name)))

/** Applies the change if it is valid. A refusal says why and leaves the role as it was. */
function apply(role: Role, patch: Partial<Role['workingHours']>) {
  run(`${role.name} updated`, () => {
    const refused = setRoleHours(role.id, { ...role.workingHours, ...patch })
    return refused ? `${role.name}: ${refused}` : undefined
  })
}

function setType(role: Role, value: unknown) {
  if (value !== 'flexible' && value !== 'fixed')
    return
  if (value === 'fixed' && !role.workingHours.shiftIds?.length) {
    const first = shifts.value.find(t => t.id === 'shift-office') ?? shifts.value[0]
    apply(role, { scheduleType: 'fixed', shiftIds: first ? [first.id] : undefined, startTime: role.workingHours.startTime ?? first?.start ?? '10:00', endTime: role.workingHours.endTime ?? first?.end ?? '18:00' })
    return
  }
  apply(role, { scheduleType: value })
}

function toggleDay(role: Role, day: WeekDay) {
  const days = role.workingHours.days.includes(day) ? role.workingHours.days.filter(d => d !== day) : [...role.workingHours.days, day]
  apply(role, { days })
}

const idsOf = (role: Role) => role.workingHours.shiftIds ?? []
const unused = (role: Role) => shifts.value.filter(t => !idsOf(role).includes(t.id))
/** The first unused shift that fits with the ones already picked (no overlap, no clash with the next day), if any. */
const addable = (role: Role) => unused(role).find(t => !workingHoursProblem({ ...role.workingHours, shiftIds: [...idsOf(role), t.id] }, id => shifts.value.find(x => x.id === id)))
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm text-muted-foreground">
      What each role works when a person has no schedule of their own. Changes apply to everyone in the role straight away.
    </p>

    <div v-for="role in rows" :key="role.id" class="space-y-3 rounded-lg border p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="font-medium">
            {{ role.name }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ members(role).length }} active {{ members(role).length === 1 ? 'person' : 'people' }}<template v-if="ownCount(role)">, {{ ownCount(role) }} with a schedule of their own</template>
          </p>
        </div>
        <ToggleGroup :model-value="role.workingHours.scheduleType" type="single" variant="outline" @update:model-value="v => setType(role, v)">
          <ToggleGroupItem value="flexible" class="flex-none px-4">
            Flexible
          </ToggleGroupItem>
          <ToggleGroupItem value="fixed" class="flex-none px-4">
            Fixed hours
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div class="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-start">
        <div class="flex flex-wrap gap-1" role="group" :aria-label="`Working days for ${role.name}`">
          <button
            v-for="d in WEEK_DAYS"
            :key="d"
            type="button"
            :aria-pressed="role.workingHours.days.includes(d)"
            :class="cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              role.workingHours.days.includes(d) ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:bg-muted',
            )"
            @click="toggleDay(role, d)"
          >
            {{ d }}
          </button>
        </div>

        <div v-if="role.workingHours.scheduleType === 'fixed'" class="space-y-2">
          <p v-if="!idsOf(role).length" class="text-xs text-muted-foreground">
            No shift picked: the plain hours {{ role.workingHours.startTime }} to {{ role.workingHours.endTime }} are used.
          </p>
          <div v-for="(id, i) in idsOf(role)" :key="id" class="flex items-center gap-2">
            <Select :model-value="id" @update:model-value="v => apply(role, { shiftIds: idsOf(role).map((x, k) => k === i ? String(v) : x) })">
              <SelectTrigger class="w-full sm:max-w-sm" :aria-label="`Shift ${i + 1} for ${role.name}`">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in shifts.filter(x => x.id === id || !idsOf(role).includes(x.id))" :key="t.id" :value="t.id">
                  {{ t.name }}, {{ t.start }} to {{ t.end }}{{ spansMidnight(t.start, t.end) ? ' (+1)' : '' }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" class="size-9 shrink-0" :disabled="idsOf(role).length < 2" :aria-label="`Remove shift ${i + 1} for ${role.name}`" @click="apply(role, { shiftIds: idsOf(role).filter((_, k) => k !== i) })">
              <Icon name="lucide:x" class="size-4" />
            </Button>
          </div>
          <Button v-if="addable(role) && idsOf(role).length < MAX_SHIFTS_PER_DAY" type="button" variant="outline" size="sm" @click="apply(role, { shiftIds: [...idsOf(role), addable(role)!.id] })">
            <Icon name="lucide:plus" class="mr-2 size-4" />
            {{ idsOf(role).length ? 'Add another shift a day' : 'Pick a shift' }}
          </Button>
          <p v-else-if="idsOf(role).length && unused(role).length && idsOf(role).length < MAX_SHIFTS_PER_DAY" class="text-xs text-muted-foreground">
            No other shift fits with these. Make one that starts later in the Shifts tab.
          </p>
        </div>
        <p v-else class="self-center text-xs text-muted-foreground">
          No fixed hours: nobody in this role is ever late or early.
        </p>
      </div>
    </div>
  </div>
</template>
