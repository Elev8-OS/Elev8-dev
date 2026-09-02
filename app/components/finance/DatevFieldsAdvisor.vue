<script setup lang="ts">
import type { DatevSettings } from '@/components/finance/data/datev'
import { formatFiscalYearStart } from '@/components/finance/data/datev'

const props = defineProps<{ errors: Record<string, string> }>()

/**
 * Advisor identity fields. Shared by the first-run wizard and the flat
 * settings form so both surfaces validate and label them identically.
 */
const draft = defineModel<DatevSettings>({ required: true })

function patch(part: Partial<DatevSettings>) {
  draft.value = { ...draft.value, ...part }
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <Label for="datev-berater">Beraternummer</Label>
        <Input
          id="datev-berater"
          :model-value="draft.beraternummer"
          inputmode="numeric"
          placeholder="1234567"
          maxlength="7"
          :class="props.errors.beraternummer ? 'border-destructive' : ''"
          @update:model-value="(v) => patch({ beraternummer: String(v) })"
        />
        <p v-if="props.errors.beraternummer" class="text-xs text-destructive">
          {{ props.errors.beraternummer }}
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Consultant number, up to 7 digits.
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="datev-mandant">Mandantennummer</Label>
        <Input
          id="datev-mandant"
          :model-value="draft.mandantennummer"
          inputmode="numeric"
          placeholder="10234"
          maxlength="5"
          :class="props.errors.mandantennummer ? 'border-destructive' : ''"
          @update:model-value="(v) => patch({ mandantennummer: String(v) })"
        />
        <p v-if="props.errors.mandantennummer" class="text-xs text-destructive">
          {{ props.errors.mandantennummer }}
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Your client number at that advisor, 1-5 digits.
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <Label>Wirtschaftsjahresbeginn</Label>
      <div class="flex items-center gap-2">
        <Select
          :model-value="String(draft.fiscalYearStartDay)"
          @update:model-value="(v) => patch({ fiscalYearStartDay: Number(v) })"
        >
          <SelectTrigger class="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="day in 31" :key="day" :value="String(day)">
              {{ day }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select
          :model-value="String(draft.fiscalYearStartMonth)"
          @update:model-value="(v) => patch({ fiscalYearStartMonth: Number(v) })"
        >
          <SelectTrigger class="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="(month, index) in months" :key="month" :value="String(index + 1)">
              {{ month }}
            </SelectItem>
          </SelectContent>
        </Select>
        <span class="text-xs text-muted-foreground">
          → {{ formatFiscalYearStart(draft) }}
        </span>
      </div>
      <p class="text-xs text-muted-foreground">
        Almost always 01.01. — confirm with your advisor if your fiscal year differs.
      </p>
    </div>
  </div>
</template>
