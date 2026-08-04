<script setup lang="ts">
import { Calendar as CalendarIcon } from 'lucide-vue-next'
import { CalendarDate, DateFormatter, getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  placeholder?: string
  min?: string
  max?: string
  disabled?: boolean
  class?: string
}>(), {
  modelValue: null,
  placeholder: 'Pick a date',
  min: undefined,
  max: undefined,
  disabled: false,
  class: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

function toCalendarDate(value?: string | null) {
  if (!value)
    return null
  try {
    return parseDate(value)
  }
  catch {
    return null
  }
}

// Plain ref (not computed) — Reka UI Calendar's v-model only commits reliably
// to a mutable ref, not a computed with a transforming setter.
const selected = ref<CalendarDate | null>(toCalendarDate(props.modelValue))

function commitDate(val: CalendarDate | undefined) {
  if (!val) {
    selected.value = null
    emit('update:modelValue', null)
  }
  else {
    selected.value = val
    emit('update:modelValue', val.toString())
  }
}

watch(() => props.modelValue, (val) => {
  const next = toCalendarDate(val)
  if (!next || !selected.value || next.toString() !== selected.value.toString())
    selected.value = next
})

const minDate = computed(() => toCalendarDate(props.min) ?? undefined)
const maxDate = computed(() => toCalendarDate(props.max) ?? undefined)
const defaultMonth = computed(() => selected.value ?? today(getLocalTimeZone()))

const displayLabel = computed(() => {
  if (!selected.value)
    return props.placeholder
  return df.format(selected.value.toDate(getLocalTimeZone()))
})
</script>

<template>
  <div :class="cn('grid gap-2', props.class)">
    <Popover>
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :disabled="disabled"
          :class="cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
          )"
        >
          <CalendarIcon class="mr-2 h-4 w-4" />
          <span class="truncate">{{ displayLabel }}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="start">
        <Calendar
          :model-value="selected"
          weekday-format="short"
          :min-value="minDate"
          :max-value="maxDate"
          :default-value="defaultMonth"
          initial-focus
          @update:model-value="commitDate"
        />
      </PopoverContent>
    </Popover>
  </div>
</template>
