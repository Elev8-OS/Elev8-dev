<script setup lang="ts">
import { computed } from 'vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { cn } from '~/lib/utils'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  class?: string
  step?: number // minutes between options (default 30)
  startHour?: number // start hour (default 6 for 06:00)
  endHour?: number // end hour (default 22 for 22:00)
}>(), {
  modelValue: '11:00',
  placeholder: 'Select time',
  disabled: false,
  class: '',
  step: 30,
  startHour: 6,
  endHour: 22,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const timeSlots = computed(() => {
  const slots: string[] = []
  const step = Math.max(5, props.step || 30)
  const start = Math.max(0, props.startHour ?? 6) * 60
  const end = Math.min(24, props.endHour ?? 22) * 60

  for (let m = start; m <= end; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    slots.push(`${hh}:${mm}`)
  }

  // Ensure current modelValue is in the list if set
  if (props.modelValue && !slots.includes(props.modelValue)) {
    slots.push(props.modelValue)
    slots.sort()
  }

  return slots
})

function handleValueChange(val: any) {
  if (val) {
    emit('update:modelValue', String(val))
  }
}
</script>

<template>
  <div :class="cn('w-full', props.class)">
    <Select
      :model-value="modelValue ?? undefined"
      :disabled="disabled"
      @update:model-value="handleValueChange"
    >
      <SelectTrigger class="w-full h-9 justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <Icon name="lucide:clock" class="size-3.5 text-muted-foreground shrink-0" />
          <SelectValue :placeholder="placeholder" />
        </div>
      </SelectTrigger>
      <SelectContent class="max-h-56 z-[100]">
        <SelectItem v-for="t in timeSlots" :key="t" :value="t">
          {{ t }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
