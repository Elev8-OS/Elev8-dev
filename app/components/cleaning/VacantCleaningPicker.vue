<script setup lang="ts">
import type { DayOfWeek, VacantCleaningFrequency, VacantCleaningSettings } from '~/components/reservations/data/cleaning-schedule'
import { DAY_OF_WEEK_OPTIONS, DEFAULT_VACANT_CLEANING } from '~/components/reservations/data/cleaning-schedule'

/**
 * "When empty": how often the daily routine cleans a listing with nobody in it
 * (`vacantCleaningDue`). Used by the listing's cleaning schedule dialog and the
 * onboarding's Set up cleaning. Emits a fresh object on every change.
 */
const model = defineModel<VacantCleaningSettings | undefined>()

const value = computed<VacantCleaningSettings>(() => model.value ?? DEFAULT_VACANT_CLEANING)

const OPTIONS: { id: VacantCleaningFrequency, label: string }[] = [
  { id: 'weekdays', label: 'On set days' },
  { id: 'every_n_days', label: 'Every few days' },
  { id: 'every_day', label: 'Every day' },
  { id: 'never', label: 'Never' },
]

function setFrequency(frequency: VacantCleaningFrequency) {
  model.value = {
    frequency,
    dayInterval: frequency === 'every_n_days' ? (value.value.dayInterval ?? 2) : undefined,
    weekDays: frequency === 'weekdays' ? [...(value.value.weekDays?.length ? value.value.weekDays : DEFAULT_VACANT_CLEANING.weekDays!)] : undefined,
  }
}

function toggleDay(day: DayOfWeek) {
  const days = value.value.weekDays ?? []
  const next = days.includes(day) ? days.filter(d => d !== day) : DAY_OF_WEEK_OPTIONS.map(o => o.id).filter(d => d === day || days.includes(d))
  model.value = { frequency: 'weekdays', weekDays: next }
}

function setInterval(raw: string | number) {
  model.value = { frequency: 'every_n_days', dayInterval: Math.min(14, Math.max(1, Number(raw) || 2)) }
}
</script>

<template>
  <div class="grid gap-2" data-testid="vacant-cleaning-picker">
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="When empty">
      <button
        v-for="option in OPTIONS"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="value.frequency === option.id"
        class="rounded-md border px-2.5 py-1.5 text-xs transition-colors"
        :class="value.frequency === option.id ? 'border-primary bg-primary/5 font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'"
        :data-testid="`vacant-frequency-${option.id}`"
        @click="setFrequency(option.id)"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="value.frequency === 'weekdays'" class="flex flex-wrap gap-1.5" role="group" aria-label="Days">
      <button
        v-for="day in DAY_OF_WEEK_OPTIONS"
        :key="day.id"
        type="button"
        :aria-pressed="value.weekDays?.includes(day.id) ?? false"
        class="min-w-11 rounded-md border px-2 py-1 text-xs transition-colors"
        :class="value.weekDays?.includes(day.id) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        :data-testid="`vacant-day-${day.id}`"
        @click="toggleDay(day.id)"
      >
        {{ day.short }}
      </button>
    </div>

    <div v-else-if="value.frequency === 'every_n_days'" class="flex items-center gap-2 text-xs">
      <span class="text-muted-foreground">Every</span>
      <Input
        :model-value="value.dayInterval ?? 2"
        type="number"
        min="1"
        max="14"
        class="h-8 w-16 text-xs"
        aria-label="Days between cleanings"
        data-testid="vacant-interval"
        @update:model-value="setInterval"
      />
      <span class="text-muted-foreground">days since the last cleaning</span>
    </div>

    <p v-if="value.frequency === 'weekdays' && !value.weekDays?.length" class="text-xs text-amber-700 dark:text-amber-300">
      No day picked: an empty listing is not cleaned.
    </p>
  </div>
</template>
