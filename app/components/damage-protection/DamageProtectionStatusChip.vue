<script setup lang="ts">
import type { ProtectionBucket } from '~/components/reservations/data/damage-protection'
import type { ProtectionOption } from '~/components/reservations/data/reservations'

const props = defineProps<{
  bucket: ProtectionBucket
  option?: ProtectionOption
}>()

const AMBER = 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
const BLUE = 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400'
const GREEN = 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
const RED = 'border-destructive/30 bg-destructive/10 text-destructive'

const meta = computed<{ label: string, class: string } | null>(() => {
  switch (props.bucket) {
    case 'awaiting_choice':
      return { label: 'Awaiting choice', class: AMBER }
    case 'on_file':
      return { label: props.option === 'waiver' ? 'Waiver' : 'Card on file', class: BLUE }
    case 'decision_due':
      return { label: 'Charge or close', class: AMBER }
    case 'decision_overdue':
      return { label: 'Decision overdue', class: RED }
    case 'failed':
      return { label: 'Charge declined', class: RED }
    case 'refund_due':
      return { label: 'Refund waiver fee', class: AMBER }
    case 'settled':
      return props.option === 'waiver'
        ? { label: 'Waiver', class: BLUE }
        : { label: 'Closed', class: GREEN }
    default:
      // 'not_offered' renders nothing: a skipped channel must not leave a gap.
      return null
  }
})
</script>

<template>
  <span
    v-if="meta"
    class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
    :class="meta.class"
  >
    {{ meta.label }}
  </span>
</template>
