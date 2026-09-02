<script setup lang="ts">
import type { DatevSettings } from '@/components/finance/data/datev'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { createDefaultDatevSettings, formatFiscalYearStart } from '@/components/finance/data/datev'
import { useDatev } from '@/composables/useDatev'

const { settings, isConfigured, saveSettings, hydrate } = useDatev()

/**
 * A tenant that has never entered the advisor's numbers gets the guided setup;
 * everyone else gets the flat form. Local state, not derived from
 * `isConfigured` — the wizard saves before it is done talking, and deriving
 * would swap its success panel away the instant it did.
 */
const mode = ref<'setup' | 'manage'>(isConfigured.value ? 'manage' : 'setup')

// `hydrate()` is synchronous, so a tenant who already set DATEV up on this
// browser skips the wizard on the first paint after mount.
onMounted(() => {
  hydrate()
  if (isConfigured.value)
    mode.value = 'manage'
})

/** Local draft so an abandoned edit never half-applies to the export. */
const draft = ref<DatevSettings>(cloneSettings(settings.value))
const errors = ref<Record<string, string>>({})

function cloneSettings(value: DatevSettings): DatevSettings {
  return { ...value, channelAccounts: { ...value.channelAccounts } }
}

// Re-sync the draft if the stored settings change underneath us (e.g. hydration,
// or the wizard saving before handing over to this form).
watch(settings, value => (draft.value = cloneSettings(value)))

const isDirty = computed(
  () => JSON.stringify(draft.value) !== JSON.stringify(settings.value),
)

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
</script>

<template>
  <FinanceDatevSetupWizard v-if="mode === 'setup'" @done="mode = 'manage'" />

  <div v-else class="flex flex-col gap-6">
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
      <FinanceDatevFieldsAdvisor v-model="draft" :errors="errors" />
    </section>

    <Separator />

    <!-- Chart of accounts + accounts -->
    <section class="flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold">
          Kontenrahmen &amp; accounts
        </h3>
        <p class="text-xs text-muted-foreground">
          Switching the chart re-seeds every account number below. Each booking posts as
          receivable (debit) against a revenue account (credit).
        </p>
      </div>
      <FinanceDatevFieldsAccounts v-model="draft" :errors="errors" />
    </section>

    <Separator />

    <!-- Export options -->
    <section class="flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold">
          Export options
        </h3>
      </div>
      <FinanceDatevFieldsHandover v-model="draft" :errors="errors" />
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
          {{ isConfigured ? `Configured · WJ ${formatFiscalYearStart(settings)}` : 'Not configured' }}
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
