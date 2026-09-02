<script setup lang="ts">
import type { DatevSettings, SkrChart } from '@/components/finance/data/datev'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import {
  applySkrDefaults,
  DATEV_CHANNELS,
  SKR_DEFAULTS,
} from '@/components/finance/data/datev'

const props = defineProps<{ errors: Record<string, string> }>()

/**
 * Chart of accounts + the accounts revenue posts to. Shared by the first-run
 * wizard and the flat settings form.
 */
const draft = defineModel<DatevSettings>({ required: true })

function patch(part: Partial<DatevSettings>) {
  draft.value = { ...draft.value, ...part }
}

const chart = computed(() => SKR_DEFAULTS[draft.value.skr])

/** Switching the chart re-seeds every account — SKR03 is 8xxx, SKR04 is 4xxx. */
function handleChartChange(skr: SkrChart) {
  if (skr === draft.value.skr)
    return
  draft.value = applySkrDefaults(draft.value, skr)
  toast.info(`Account defaults reset to ${skr}.`)
}

function patchChannel(channel: string, account: string) {
  patch({ channelAccounts: { ...draft.value.channelAccounts, [channel]: account } })
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        v-for="option in (['SKR03', 'SKR04'] as SkrChart[])"
        :key="option"
        type="button"
        class="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors"
        :class="draft.skr === option
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:border-border/80'"
        @click="handleChartChange(option)"
      >
        <span class="flex items-center gap-2 text-sm font-medium">
          <span
            class="flex size-4 items-center justify-center rounded-full border"
            :class="draft.skr === option ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
          >
            <Icon v-if="draft.skr === option" name="lucide:check" class="size-3" />
          </span>
          {{ SKR_DEFAULTS[option].label }}
        </span>
        <span class="text-xs leading-relaxed text-muted-foreground">
          {{ SKR_DEFAULTS[option].description }}
        </span>
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-1.5">
        <Label for="datev-debitor">Debitorenkonto</Label>
        <Input
          id="datev-debitor"
          :model-value="draft.debitorenkonto"
          inputmode="numeric"
          class="font-mono"
          :class="props.errors.debitorenkonto ? 'border-destructive' : ''"
          @update:model-value="(v) => patch({ debitorenkonto: String(v) })"
        />
        <p v-if="props.errors.debitorenkonto" class="text-xs text-destructive">
          {{ props.errors.debitorenkonto }}
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Collective receivables account.
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="datev-erloes">Erlöskonto (default)</Label>
        <Input
          id="datev-erloes"
          :model-value="draft.erloeskonto"
          inputmode="numeric"
          class="font-mono"
          :class="props.errors.erloeskonto ? 'border-destructive' : ''"
          @update:model-value="(v) => patch({ erloeskonto: String(v) })"
        />
        <p v-if="props.errors.erloeskonto" class="text-xs text-destructive">
          {{ props.errors.erloeskonto }}
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Used for channels without their own account.
        </p>
      </div>
    </div>

    <div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <Icon name="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0 text-amber-600" />
      <p class="text-xs leading-relaxed text-amber-800">
        {{ chart.erloeskonto }} is the standard <span class="font-medium">19% VAT</span> revenue
        account. German short-term accommodation is usually taxed at
        <span class="font-medium">7%</span> ({{ chart.reducedRateAccount }}). The export leaves
        the BU-Schlüssel empty so your advisor assigns the VAT key on import — but the account
        you pick here is the signal they read. Confirm it with them.
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <Label>Revenue account per channel</Label>
      <p class="-mt-1 text-xs text-muted-foreground">
        Splits revenue by booking source so your advisor sees each channel separately.
      </p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div v-for="channel in DATEV_CHANNELS" :key="channel" class="flex items-center gap-2">
          <span class="w-28 shrink-0 text-sm text-muted-foreground">{{ channel }}</span>
          <Input
            :model-value="draft.channelAccounts[channel]"
            inputmode="numeric"
            class="font-mono"
            :placeholder="draft.erloeskonto"
            :class="props.errors[`channel:${channel}`] ? 'border-destructive' : ''"
            @update:model-value="(v) => patchChannel(channel, String(v))"
          />
        </div>
      </div>
    </div>
  </div>
</template>
