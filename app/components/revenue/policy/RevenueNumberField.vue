<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

/**
 * A number input with a currency code in front (`pl-14`) or a unit after it.
 * Emits a number, or null when the field is emptied and `nullable` is set.
 */
const props = withDefaults(defineProps<{
  modelValue: number | null
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
  nullable?: boolean
  placeholder?: string
  invalid?: boolean
  id?: string
  ariaLabel?: string
  class?: HTMLAttributes['class']
}>(), {
  step: 1,
})

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

function onInput(raw: string | number) {
  if (raw === '' || raw === null) {
    emit('update:modelValue', props.nullable ? null : 0)
    return
  }
  const value = Number(raw)
  if (!Number.isNaN(value))
    emit('update:modelValue', value)
}
</script>

<template>
  <div :class="cn('relative', props.class)">
    <span v-if="prefix" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{{ prefix }}</span>
    <Input
      :id="id"
      type="number"
      :model-value="modelValue ?? ''"
      :min="min"
      :max="max"
      :step="step"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :aria-invalid="invalid || undefined"
      class="h-9 tabular-nums"
      :class="[prefix ? 'pl-14' : '', suffix ? (suffix.length <= 2 ? 'pr-7' : 'pr-16') : '']"
      @update:model-value="onInput"
    />
    <span v-if="suffix" class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{{ suffix }}</span>
  </div>
</template>
