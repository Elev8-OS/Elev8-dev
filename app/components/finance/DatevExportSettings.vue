<script setup lang="ts">
import type { DatevSettings, SkrChart } from '@/components/finance/data/datev'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  createDefaultDatevSettings,
  DATEV_CHANNELS,
  formatFiscalYearStart,
  SKR_DEFAULTS,
} from '@/components/finance/data/datev'
import { useDatev } from '@/composables/useDatev'

const { settings, isConfigured, saveSettings, switchChart, hydrate } = useDatev()

onMounted(hydrate)

/** Local draft so an abandoned edit never half-applies to the export. */
const draft = ref<DatevSettings>(cloneSettings(settings.value))
const errors = ref<Record<string, string>>({})

function cloneSettings(value: DatevSettings): DatevSettings {
  return { ...value, channelAccounts: { ...value.channelAccounts } }
}

// Re-sync the draft if the stored settings change underneath us (e.g. hydration).
watch(settings, value => (draft.value = cloneSettings(value)))

const chart = computed(() => SKR_DEFAULTS[draft.value.skr])

const isDirty = computed(
  () => JSON.stringify(draft.value) !== JSON.stringify(settings.value),
)

/** Switching the chart re-seeds every account — SKR03 is 8xxx, SKR04 is 4xxx. */
function handleChartChange(skr: SkrChart) {
  if (skr === draft.value.skr)
    return
  draft.value = switchChart(draft.value, skr)
  toast.info(`Account defaults reset to ${skr}.`)
}

function handleSave() {
  const result = saveSettings(draft.value)
  errors.value = result.errors
  if (!result.saved) {
    toast.error('Check the highlighted fields.')
    return
  }
  toast.success('DATEV settings saved.')
}

function handleReset() {
  draft.value = createDefaultDatevSettings(draft.value.skr)
  errors.value = {}
  toast.info('Reset to chart defaults. Save to apply.')
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
  <div class="flex flex-col gap-6">
    <!-- Intro -->
    <div class="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
      <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div class="text-xs leading-relaxed text-muted-foreground">
        <p class="mb-1 font-medium text-foreground">
          Your tax advisor provides these values.
        </p>
        <p>
          DATEV is not a connection — nothing is sent automatically. These settings shape the
          <span class="font-medium">Buchungsstapel</span> file you generate in
          <span class="font-medium">Finance → Exports</span> and hand to your advisor.
        </p>
      </div>
    </div>

    <!-- Advisor & client -->
    <section class="flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold">
          Advisor &amp; client
        </h3>
        <p class="text-xs text-muted-foreground">
          Written into the file header so DATEV routes the batch to the right client.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="datev-berater">Beraternummer</Label>
          <Input
            id="datev-berater"
            v-model="draft.beraternummer"
            inputmode="numeric"
            placeholder="1234567"
            maxlength="7"
            :class="errors.beraternummer ? 'border-destructive' : ''"
          />
          <p v-if="errors.beraternummer" class="text-xs text-destructive">
            {{ errors.beraternummer }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            Consultant number, up to 7 digits.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="datev-mandant">Mandantennummer</Label>
          <Input
            id="datev-mandant"
            v-model="draft.mandantennummer"
            inputmode="numeric"
            placeholder="10234"
            maxlength="5"
            :class="errors.mandantennummer ? 'border-destructive' : ''"
          />
          <p v-if="errors.mandantennummer" class="text-xs text-destructive">
            {{ errors.mandantennummer }}
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
            @update:model-value="(v) => draft.fiscalYearStartDay = Number(v)"
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
            @update:model-value="(v) => draft.fiscalYearStartMonth = Number(v)"
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
    </section>

    <Separator />

    <!-- Chart of accounts -->
    <section class="flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold">
          Kontenrahmen
        </h3>
        <p class="text-xs text-muted-foreground">
          Switching the chart re-seeds every account number below.
        </p>
      </div>

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
    </section>

    <Separator />

    <!-- Accounts -->
    <section class="flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold">
          Accounts
        </h3>
        <p class="text-xs text-muted-foreground">
          Each booking posts as receivable (debit) against a revenue account (credit).
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="datev-debitor">Debitorenkonto</Label>
          <Input
            id="datev-debitor"
            v-model="draft.debitorenkonto"
            inputmode="numeric"
            class="font-mono"
            :class="errors.debitorenkonto ? 'border-destructive' : ''"
          />
          <p v-if="errors.debitorenkonto" class="text-xs text-destructive">
            {{ errors.debitorenkonto }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            Collective receivables account.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="datev-erloes">Erlöskonto (default)</Label>
          <Input
            id="datev-erloes"
            v-model="draft.erloeskonto"
            inputmode="numeric"
            class="font-mono"
            :class="errors.erloeskonto ? 'border-destructive' : ''"
          />
          <p v-if="errors.erloeskonto" class="text-xs text-destructive">
            {{ errors.erloeskonto }}
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
              v-model="draft.channelAccounts[channel]"
              inputmode="numeric"
              class="font-mono"
              :placeholder="draft.erloeskonto"
              :class="errors[`channel:${channel}`] ? 'border-destructive' : ''"
            />
          </div>
        </div>
      </div>
    </section>

    <Separator />

    <!-- Export options -->
    <section class="flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold">
          Export options
        </h3>
      </div>

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
          @update:model-value="(v) => draft.includeCancelled = v"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="datev-email">Tax advisor e-mail</Label>
        <Input
          id="datev-email"
          v-model="draft.advisorEmail"
          type="email"
          placeholder="kanzlei@steuerberater.de"
          :class="errors.advisorEmail ? 'border-destructive' : ''"
        />
        <p v-if="errors.advisorEmail" class="text-xs text-destructive">
          {{ errors.advisorEmail }}
        </p>
        <p v-else class="text-xs text-muted-foreground">
          Recipient of the prefilled e-mail draft after you generate a file.
        </p>
      </div>
    </section>

    <Separator />

    <!-- Footer -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-xs">
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium"
          :class="isConfigured ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'"
        >
          <span class="size-1.5 rounded-full" :class="isConfigured ? 'bg-green-500' : 'bg-slate-400'" />
          {{ isConfigured ? 'Configured' : 'Not configured' }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="handleReset">
          Reset to {{ draft.skr }} defaults
        </Button>
        <Button size="sm" :disabled="!isDirty" @click="handleSave">
          Save settings
        </Button>
      </div>
    </div>
  </div>
</template>
