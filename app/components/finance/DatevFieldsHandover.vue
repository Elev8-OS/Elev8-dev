<script setup lang="ts">
import type { DatevSettings } from '@/components/finance/data/datev'

const props = defineProps<{ errors: Record<string, string> }>()

/**
 * How the batch is shaped and who receives it. Shared by the first-run wizard
 * and the flat settings form.
 */
const draft = defineModel<DatevSettings>({ required: true })

function patch(part: Partial<DatevSettings>) {
  draft.value = { ...draft.value, ...part }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <p class="text-sm font-medium">
          Include cancelled bookings
        </p>
        <p class="text-xs text-muted-foreground">
          Cancellations post as a Generalumkehr (reversal), not a second revenue line.
        </p>
      </div>
      <Switch
        :model-value="draft.includeCancelled"
        @update:model-value="(v) => patch({ includeCancelled: v })"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <Label for="datev-email">Tax advisor e-mail</Label>
      <Input
        id="datev-email"
        :model-value="draft.advisorEmail"
        type="email"
        placeholder="kanzlei@steuerberater.de"
        :class="props.errors.advisorEmail ? 'border-destructive' : ''"
        @update:model-value="(v) => patch({ advisorEmail: String(v) })"
      />
      <p v-if="props.errors.advisorEmail" class="text-xs text-destructive">
        {{ props.errors.advisorEmail }}
      </p>
      <p v-else class="text-xs text-muted-foreground">
        Optional — recipient of the prefilled e-mail draft after you generate a file.
      </p>
    </div>
  </div>
</template>
