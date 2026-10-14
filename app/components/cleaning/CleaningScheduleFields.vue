<script setup lang="ts">
import type { ListingCleaningConfig, ReservationCleaningType } from '~/components/reservations/data/cleaning-schedule'
import TimePicker from '~/components/base/TimePicker.vue'
import VacantCleaningPicker from '~/components/cleaning/VacantCleaningPicker.vue'
import { describeListingCleaning } from '~/components/reservations/data/cleaning-schedule'

/**
 * The company cleaning schedule's fields: when listings are cleaned, the time,
 * and for the daily routine how often an empty listing is cleaned. Shared by
 * Settings > Cleaning and the onboarding's Set up cleaning. Fields it does not
 * show (cleaners, start offset) pass through untouched.
 */
const model = defineModel<ListingCleaningConfig>({ required: true })

const OPTIONS: { id: ReservationCleaningType, title: string, hint: string, icon: string }[] = [
  { id: 'daily', title: 'Every day, booked or not', hint: 'Daily with guests in, check-out when they leave, upkeep when empty', icon: 'lucide:calendar-days' },
  { id: 'checkout', title: 'Only at check-out', hint: 'One turnover clean per booking', icon: 'lucide:log-out' },
  { id: 'custom', title: 'Every few days', hint: 'During a stay, at the interval you pick', icon: 'lucide:repeat' },
]

function patch(next: Partial<ListingCleaningConfig>) {
  model.value = { ...model.value, ...next }
}

function setType(type: ReservationCleaningType) {
  patch({
    type,
    custom: type === 'custom' ? { frequency: 'day', dayInterval: model.value.custom?.dayInterval ?? 2 } : undefined,
  })
}

function setInterval(raw: string | number) {
  patch({ custom: { frequency: 'day', dayInterval: Math.min(14, Math.max(1, Number(raw) || 2)) } })
}

const summary = computed(() => describeListingCleaning(model.value))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-2">
      <Label>When are listings cleaned?</Label>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="When are listings cleaned?">
        <div
          v-for="option in OPTIONS"
          :key="option.id"
          role="radio"
          :aria-checked="model.type === option.id"
          tabindex="0"
          class="flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors"
          :class="model.type === option.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'"
          :data-testid="`schedule-type-${option.id}`"
          @click="setType(option.id)"
          @keydown.enter.prevent="setType(option.id)"
          @keydown.space.prevent="setType(option.id)"
        >
          <Icon :name="option.icon" class="size-4 text-muted-foreground" />
          <span class="text-sm font-medium">{{ option.title }}</span>
          <span class="text-xs text-muted-foreground">{{ option.hint }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div v-if="model.type === 'custom'" class="grid gap-1.5">
        <Label for="schedule-interval">Every how many days?</Label>
        <Input
          id="schedule-interval"
          :model-value="model.custom?.dayInterval ?? 2"
          type="number"
          min="1"
          max="14"
          @update:model-value="setInterval"
        />
      </div>
      <div class="grid gap-1.5">
        <Label>Time</Label>
        <TimePicker :model-value="model.time ?? '11:00'" @update:model-value="time => patch({ time })" />
      </div>
    </div>

    <div v-if="model.type === 'daily'" class="grid gap-1.5" data-testid="schedule-when-empty">
      <Label>When a listing is empty, clean it</Label>
      <VacantCleaningPicker :model-value="model.vacant" @update:model-value="vacant => patch({ vacant })" />
    </div>

    <p class="rounded-lg border bg-muted/20 p-3 text-sm" data-testid="schedule-summary">
      {{ summary }}
    </p>
  </div>
</template>
