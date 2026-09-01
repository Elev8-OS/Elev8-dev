<script setup lang="ts">
// Reusable date-range field: a button showing the selected range that opens a
// RangeCalendar. Works both as a form control (`v-model`) and standalone —
// `defineModel` keeps local state when the parent binds nothing, so existing
// decorative usages need no changes.

import type { DateRange } from 'reka-ui'
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { Calendar as CalendarIcon } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  /** Shown when no range is selected. */
  placeholder?: string
  numberOfMonths?: number
  disabled?: boolean
  id?: string
}>(), {
  placeholder: 'Pick a date range',
  numberOfMonths: 2,
  disabled: false,
})

const value = defineModel<DateRange>({
  default: () => ({ start: undefined, end: undefined }),
})

const df = new DateFormatter('en-GB', { dateStyle: 'medium' })

function label(date: NonNullable<DateRange['start']>): string {
  return df.format(date.toDate(getLocalTimeZone()))
}
</script>

<template>
  <div :class="cn('grid gap-2', $attrs.class ?? '')">
    <Popover>
      <PopoverTrigger as-child>
        <Button
          :id="props.id"
          variant="outline"
          :disabled="props.disabled"
          :class="cn(
            'w-full justify-start text-left font-normal',
            !value.start && 'text-muted-foreground',
          )"
        >
          <CalendarIcon class="mr-2 h-4 w-4 shrink-0" />
          <template v-if="value.start">
            <template v-if="value.end">
              {{ label(value.start) }} – {{ label(value.end) }}
            </template>
            <template v-else>
              {{ label(value.start) }} – …
            </template>
          </template>
          <template v-else>
            {{ props.placeholder }}
          </template>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="start">
        <RangeCalendar
          v-model="value"
          weekday-format="short"
          :number-of-months="props.numberOfMonths"
          initial-focus
          :placeholder="value.start"
        />
      </PopoverContent>
    </Popover>
  </div>
</template>
