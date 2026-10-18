<script setup lang="ts">
import type { CheckinStepsMode, CheckinStepsVisibility } from '~/components/listings/data/checkin-steps-visibility'
import { CHECKIN_STEPS_MODES, clampCheckinStepsHours, describeCheckinStepsVisibility, MAX_CHECKIN_STEPS_HOURS } from '~/components/listings/data/checkin-steps-visibility'

/**
 * When guests can see the check-in steps. Every change is emitted at once; the
 * tab saves it onto the listing.
 */
const props = defineProps<{ settings: CheckinStepsVisibility }>()
const emit = defineEmits<{ change: [settings: CheckinStepsVisibility] }>()

function setMode(mode: CheckinStepsMode) {
  if (mode !== props.settings.mode)
    emit('change', { ...props.settings, mode })
}

function setHours(value: string | number) {
  const hoursBefore = clampCheckinStepsHours(Number(value))
  if (hoursBefore !== props.settings.hoursBefore)
    emit('change', { ...props.settings, hoursBefore })
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3" data-testid="checkin-steps-visibility">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div class="flex items-center gap-2">
        <Icon name="lucide:eye" class="size-4 text-muted-foreground" />
        <span class="text-sm font-medium">Show check-in steps</span>
      </div>
      <Select :model-value="settings.mode" @update:model-value="(v) => setMode(v as CheckinStepsMode)">
        <SelectTrigger class="h-9 w-56" aria-label="When to show the check-in steps" data-testid="checkin-steps-mode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="m in CHECKIN_STEPS_MODES" :key="m.value" :value="m.value">
            {{ m.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <div v-if="settings.mode === 'hours_before'" class="flex items-center gap-2">
        <Input
          type="number"
          inputmode="numeric"
          min="1"
          :max="MAX_CHECKIN_STEPS_HOURS"
          class="h-9 w-20"
          aria-label="Hours before check-in"
          data-testid="checkin-steps-hours"
          :model-value="settings.hoursBefore"
          @change="(e: Event) => setHours((e.target as HTMLInputElement).value)"
        />
        <span class="text-sm text-muted-foreground">{{ settings.hoursBefore === 1 ? 'hour' : 'hours' }} before check-in</span>
      </div>
    </div>
    <p class="text-xs text-muted-foreground" data-testid="checkin-steps-description">
      {{ describeCheckinStepsVisibility(settings) }}
    </p>
  </div>
</template>
