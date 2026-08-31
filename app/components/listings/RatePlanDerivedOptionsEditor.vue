<script setup lang="ts">
import { computed } from 'vue'
import type { RatePlan } from '~/components/listings/data/listings'

interface Props {
  ratePlan: RatePlan
}

const props = defineProps<Props>()

type InheritEvent =
  | 'update:inheritRate'
  | 'update:inheritMinStayArrival'
  | 'update:inheritMinStayThrough'
  | 'update:inheritMaxStay'
  | 'update:inheritClosedToArrival'
  | 'update:inheritClosedToDeparture'
  | 'update:inheritStopSell'

const emit = defineEmits<{
  'update:inheritRate': [value: boolean]
  'update:inheritMinStayArrival': [value: boolean]
  'update:inheritMinStayThrough': [value: boolean]
  'update:inheritMaxStay': [value: boolean]
  'update:inheritClosedToArrival': [value: boolean]
  'update:inheritClosedToDeparture': [value: boolean]
  'update:inheritStopSell': [value: boolean]
}>()

const inheritRows = computed<{ event: InheritEvent, label: string, value: boolean }[]>(() => [
  { event: 'update:inheritRate', label: 'Rate', value: props.ratePlan.inheritRate === true },
  { event: 'update:inheritMinStayArrival', label: 'Min Stay Arrival', value: props.ratePlan.inheritMinStayArrival === true },
  { event: 'update:inheritMinStayThrough', label: 'Min Stay Through', value: props.ratePlan.inheritMinStayThrough === true },
  { event: 'update:inheritMaxStay', label: 'Max Stay', value: props.ratePlan.inheritMaxStay === true },
  { event: 'update:inheritClosedToArrival', label: 'Closed To Arrival', value: props.ratePlan.inheritClosedToArrival === true },
  { event: 'update:inheritClosedToDeparture', label: 'Closed To Departure', value: props.ratePlan.inheritClosedToDeparture === true },
  { event: 'update:inheritStopSell', label: 'Stop Sell', value: props.ratePlan.inheritStopSell === true },
])

// Every inherit event shares the same boolean payload, so one cast covers all.
function toggleInherit(row: { event: InheritEvent, value: boolean }) {
  emit(row.event as 'update:inheritRate', !row.value)
}
</script>

<template>
  <div class="space-y-2">
    <Label class="text-sm font-medium">Inherit from parent:</Label>
    <div class="space-y-1">
      <div
        v-for="row in inheritRows"
        :key="row.event"
        class="flex items-center gap-2 cursor-pointer"
        @click="toggleInherit(row)"
      >
        <div
          class="flex size-4 items-center justify-center rounded-[4px] border"
          :class="row.value ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
        >
          <Icon v-if="row.value" name="lucide:check" class="size-3" />
        </div>
        <span class="text-sm">{{ row.label }}</span>
      </div>
    </div>
  </div>
</template>
