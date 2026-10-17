<script setup lang="ts">
import type { ShiftTemplate, ShiftTone } from '~/lib/schedule'
import BaseTimePicker from '~/components/base/TimePicker.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Card, CardContent } from '~/components/ui/card'
import { shiftProblem, useSchedule } from '~/composables/useSchedule'
import { useScheduleUndo } from '~/composables/useScheduleUndo'
import { SEED_SHIFTS, shiftLength, SHIFT_TONES, spansMidnight, toneOf } from '~/lib/schedule'
import { cn } from '~/lib/utils'

const { run } = useScheduleUndo()
const { shifts, addShift, updateShift, removeShift, shiftUsage } = useSchedule()

/** `null` = the form is closed, `''` = a new shift, else the id being edited. */
const editing = ref<string | null>(null)
const name = ref('')
const start = ref('08:00')
const end = ref('17:00')
const breakMinutes = ref(30)
const tone = ref<ShiftTone>('primary')
const confirmingDelete = ref<string | null>(null)

const BREAKS = [0, 15, 30, 45, 60, 90]

const input = computed(() => ({ name: name.value, start: start.value, end: end.value, breakMinutes: breakMinutes.value, tone: tone.value }))
const problem = computed(() => editing.value === null ? undefined : shiftProblem(input.value, shifts.value, editing.value || undefined))
// Show the problem once something has been typed, so a fresh form is not red.
const showProblem = computed(() => !!name.value.trim() || (problem.value && !problem.value.startsWith('Give the shift a name')))

function minutesLabel(t: Pick<ShiftTemplate, 'start' | 'end' | 'breakMinutes'>) {
  const mins = shiftLength(t.start, t.end) - t.breakMinutes
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${String(m).padStart(2, '0')}m paid` : `${h}h paid`
}

/** `Used by 2 roles, 3 people and 1 rotation`, or `Not used yet`. */
function usageLabel(id: string) {
  const u = shiftUsage(id)
  const parts = [
    u.roles && `${u.roles} ${u.roles === 1 ? 'role' : 'roles'}`,
    u.people && `${u.people} ${u.people === 1 ? 'person' : 'people'}`,
    u.rotations && `${u.rotations} ${u.rotations === 1 ? 'rotation' : 'rotations'}`,
    u.days && `${u.days} single ${u.days === 1 ? 'day' : 'days'}`,
  ].filter(Boolean)
  return parts.length ? `Used by ${parts.join(', ')}` : 'Not used yet'
}

/** The usual four, for an empty list. */
function addCommon() {
  run('Common shifts added', () => {
    for (const t of SEED_SHIFTS) {
      const added = addShift({ name: t.name, start: t.start, end: t.end, breakMinutes: t.breakMinutes, tone: t.tone })
      if (typeof added === 'string')
        return added
    }
  })
}

function startNew() {
  editing.value = ''
  name.value = ''
  start.value = '08:00'
  end.value = '17:00'
  breakMinutes.value = 30
  tone.value = SHIFT_TONES[shifts.value.length % SHIFT_TONES.length]!.value
}

function startEdit(t: ShiftTemplate) {
  editing.value = t.id
  name.value = t.name
  start.value = t.start
  end.value = t.end
  breakMinutes.value = t.breakMinutes
  tone.value = t.tone
}

function save() {
  if (editing.value === null || problem.value)
    return
  const id = editing.value
  const refused = run(id ? 'Shift updated' : 'Shift added', () => {
    if (id)
      return updateShift(id, input.value)
    const added = addShift(input.value)
    return typeof added === 'string' ? added : undefined
  })
  if (!refused)
    editing.value = null
}

function remove(id: string) {
  const name = shifts.value.find(t => t.id === id)?.name ?? 'Shift'
  run(`${name} deleted`, () => {
    removeShift(id)
  })
  confirmingDelete.value = null
  if (editing.value === id)
    editing.value = null
}

</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-muted-foreground">
          Named hours you can give a role, a person, or a single day. Made once, used everywhere.
        </p>
        <Button v-if="editing === null" @click="startNew">
          <Icon name="lucide:plus" class="mr-2 size-4" />
          New shift
        </Button>
      </div>
      <Card v-if="!shifts.length" class="gap-0 py-0">
        <CardContent class="space-y-3 p-6 text-center">
          <p class="text-sm text-muted-foreground">
            No shifts yet. Add the usual ones to start from.
          </p>
          <Button variant="outline" @click="addCommon">
            Add common shifts
          </Button>
        </CardContent>
      </Card>
      <div class="space-y-3">
        <div
          v-for="t in shifts"
          :key="t.id"
          class="rounded-md border p-3"
        >
          <div class="flex items-start gap-3">
            <span :class="cn('mt-1 size-3 shrink-0 rounded-full', toneOf(t.tone).dot)" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <p class="font-medium">
                {{ t.name }}
              </p>
              <p class="text-sm text-muted-foreground tabular-nums">
                {{ t.start }} to {{ t.end }}{{ spansMidnight(t.start, t.end) ? ' (+1)' : '' }}, {{ t.breakMinutes }} min break, {{ minutesLabel(t) }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ usageLabel(t.id) }}
              </p>
            </div>
            <Button variant="ghost" size="icon" class="size-8" :aria-label="`Edit ${t.name}`" @click="startEdit(t)">
              <Icon name="lucide:pencil" class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" class="size-8" :aria-label="`Delete ${t.name}`" @click="confirmingDelete = t.id">
              <Icon name="lucide:trash-2" class="size-4" />
            </Button>
          </div>
          <div v-if="confirmingDelete === t.id" class="mt-3 space-y-2 rounded-md bg-muted p-3 text-sm">
            <p>
              Delete {{ t.name }}? Roles and people who use it go back to the role's plain hours, and rotation days with it become days off. Days you already set keep their hours.
            </p>
            <div class="flex gap-2">
              <Button size="sm" variant="destructive" @click="remove(t.id)">
                Delete
              </Button>
              <Button size="sm" variant="outline" @click="confirmingDelete = null">
                Keep
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <form v-if="editing !== null" class="min-w-0 space-y-3 rounded-md border border-primary/40 p-3" @submit.prevent="save">
            <p class="text-sm font-medium">
              {{ editing ? 'Edit shift' : 'New shift' }}
            </p>
            <div class="space-y-1">
              <Label for="shift-name">Name</Label>
              <Input id="shift-name" v-model="name" placeholder="Morning" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <Label>Start</Label>
                <BaseTimePicker v-model="start" :step="15" :start-hour="0" :end-hour="23" />
              </div>
              <div class="space-y-1">
                <Label>End</Label>
                <BaseTimePicker v-model="end" :step="15" :start-hour="0" :end-hour="23" />
              </div>
            </div>
            <div class="space-y-1">
              <Label>Break</Label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="b in BREAKS"
                  :key="b"
                  type="button"
                  :aria-pressed="breakMinutes === b"
                  :class="cn('rounded-md border px-2.5 py-1 text-xs transition-colors', breakMinutes === b ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')"
                  @click="breakMinutes = b"
                >
                  {{ b ? `${b} min` : 'None' }}
                </button>
              </div>
            </div>
            <div class="space-y-1">
              <Label>Colour</Label>
              <div class="flex gap-2">
                <button
                  v-for="c in SHIFT_TONES"
                  :key="c.value"
                  type="button"
                  :aria-label="c.label"
                  :aria-pressed="tone === c.value"
                  :class="cn('size-7 rounded-full border-2 border-transparent transition', c.dot, tone === c.value && 'border-foreground ring-2 ring-background ring-offset-0')"
                  @click="tone = c.value"
                />
              </div>
            </div>
            <p v-if="!problem && start > end" class="text-xs text-muted-foreground">
              Ends the next day.
            </p>
            <p v-if="problem && showProblem" class="text-xs text-destructive">
              {{ problem }}
            </p>
            <div class="flex gap-2">
              <Button type="submit" size="sm" :disabled="!!problem">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" @click="editing = null">
                Cancel
              </Button>
            </div>
          </form>
      <p v-else class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Pick the pencil on a shift to edit it, or add a new one.
      </p>
    </div>
  </div>
</template>
