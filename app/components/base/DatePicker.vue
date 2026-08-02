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

const selected = computed({
  get: () => toCalendarDate(props.modelValue),
  set: (val) => {
    if (!val)
      emit('update:modelValue', null)
    else
      emit('update:modelValue', val.toString())
  },
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
          v-model="selected"
          weekday-format="short"
          :min-value="minDate"
          :max-value="maxDate"
          :default-value="defaultMonth"
          initial-focus
        />
      </PopoverContent>
    </Popover>
  </div>
</template>
