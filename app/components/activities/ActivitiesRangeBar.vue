<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import type { ActivityPresetId } from '~/composables/useActivityReport'
import { CalendarDate } from '@internationalized/date'
import { parseLocalDateKey, toLocalDateKey } from '~/components/activities/data/activities'
import BaseDateRangePicker from '~/components/base/DateRangePicker.vue'
import { Button } from '~/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { ACTIVITY_PRESETS, rangeForPreset, useActivityReport } from '~/composables/useActivityReport'

interface Selection { preset: ActivityPresetId, range: { from: string, to: string } }

/** Reused by Attendance: pass its own selection and first day. Without them the bar drives the Activities range. */
const props = defineProps<{ selection?: Selection, earliest?: string }>()
const emit = defineEmits<{ 'update:selection': [value: Selection] }>()

const activity = props.selection ? undefined : useActivityReport()
const selection = computed<Selection>({
  get: () => props.selection ?? activity!.selection.value,
  set: (v) => {
    if (activity)
      activity.selection.value = v
    else
      emit('update:selection', v)
  },
})
const earliestDate = computed(() => props.selection ? props.earliest : activity!.earliestDate.value)

const todayKey = computed(() => toLocalDateKey(new Date()))

function toCalendarDate(key: string) {
  const d = parseLocalDateKey(key)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

const pickerValue = computed<DateRange>({
  get: () => ({ start: toCalendarDate(selection.value.range.from), end: toCalendarDate(selection.value.range.to) }),
  set: (v) => {
    if (!v.start || !v.end)
      return
    const key = (d: typeof v.start) => `${d!.year}-${String(d!.month).padStart(2, '0')}-${String(d!.day).padStart(2, '0')}`
    selection.value = { preset: 'custom', range: { from: key(v.start), to: key(v.end) } }
  },
})

const minValue = computed(() => earliestDate.value ? toCalendarDate(earliestDate.value) : undefined)
const maxValue = computed(() => toCalendarDate(todayKey.value))

function selectPreset(id: string) {
  const preset = id as Exclude<ActivityPresetId, 'custom'>
  selection.value = { preset, range: rangeForPreset(preset) }
}

const presetLabel = computed(() => ACTIVITY_PRESETS.find(p => p.id === selection.value.preset)?.label ?? 'Custom range')

/** The previous and next day arrows only make sense while one day is shown. */
const singleDay = computed(() => selection.value.range.from === selection.value.range.to)

function shiftDay(delta: number) {
  const d = parseLocalDateKey(selection.value.range.from)
  const next = toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta))
  selection.value = {
    preset: next === todayKey.value ? 'today' : 'custom',
    range: { from: next, to: next },
  }
}

const canGoBack = computed(() => !earliestDate.value || selection.value.range.from > earliestDate.value)
const canGoForward = computed(() => selection.value.range.to < todayKey.value)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div v-if="singleDay" class="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Previous day" :disabled="!canGoBack" @click="shiftDay(-1)">
        <Icon name="lucide:chevron-left" class="size-4" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Next day" :disabled="!canGoForward" @click="shiftDay(1)">
        <Icon name="lucide:chevron-right" class="size-4" />
      </Button>
    </div>
    <BaseDateRangePicker
      v-model="pickerValue"
      class="w-full sm:w-64"
      placeholder="Select dates"
      :min-value="minValue"
      :max-value="maxValue"
    />
    <Select :model-value="selection.preset === 'custom' ? '' : selection.preset" @update:model-value="selectPreset(String($event))">
      <SelectTrigger class="w-full sm:w-40" aria-label="Period">
        <SelectValue :placeholder="presetLabel" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="p in ACTIVITY_PRESETS" :key="p.id" :value="p.id">
          {{ p.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
