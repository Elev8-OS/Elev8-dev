<script setup lang="ts">
import type { DatevSettings, DatevSetupStepId } from '@/components/finance/data/datev'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  createDefaultDatevSettings,
  DATEV_SETUP_STEPS,
  formatFiscalYearStart,
  validateDatevSetupStep,
} from '@/components/finance/data/datev'
import { useDatev } from '@/composables/useDatev'

/**
 * First-run DATEV setup. A tenant lands here with nothing configured, so the
 * three questions are asked one at a time instead of as one long form, and the
 * flow ends on the handover it exists for: generating the first file.
 *
 * Emitted once the tenant chooses to review the saved settings — the parent
 * then swaps this wizard for the flat form.
 */
const emit = defineEmits<{ (e: 'done'): void }>()

const { settings, saveSettings } = useDatev()

// Local draft, so an abandoned setup leaves the tenant unconfigured rather
// than half-configured.
const draft = ref<DatevSettings>({
  ...createDefaultDatevSettings(settings.value.skr),
  ...settings.value,
  channelAccounts: { ...settings.value.channelAccounts },
})

const stepIndex = ref(0)
const errors = ref<Record<string, string>>({})
/** Set after Finish, so the success panel survives `isConfigured` flipping. */
const finished = ref(false)

const activeFinanceTab = useState<string>('finance-active-tab', () => 'overview')
// Shared with IntegrationsTab so the last step can close the sheet it lives in.
const sheetOpen = useState<boolean>('finance-integration-sheet-open', () => false)

const steps = DATEV_SETUP_STEPS
const step = computed(() => steps[stepIndex.value]!)
const isLastStep = computed(() => stepIndex.value === steps.length - 1)

function validateStep(id: DatevSetupStepId): boolean {
  errors.value = validateDatevSetupStep(draft.value, id)
  return Object.keys(errors.value).length === 0
}

function back() {
  errors.value = {}
  stepIndex.value = Math.max(0, stepIndex.value - 1)
}

function next() {
  if (!validateStep(step.value.id)) {
    toast.error('Check the highlighted fields.')
    return
  }
  stepIndex.value = Math.min(steps.length - 1, stepIndex.value + 1)
}

function finish() {
  if (!validateStep(step.value.id)) {
    toast.error('Check the highlighted fields.')
    return
  }
  const result = saveSettings(draft.value)
  errors.value = result.errors
  if (!result.saved) {
    // A field from an earlier step failed — jump back to it so it is visible.
    const failing = steps.find(s => Object.keys(validateDatevSetupStep(draft.value, s.id)).length > 0)
    if (failing)
      stepIndex.value = steps.indexOf(failing)
    toast.error('Check the highlighted fields.')
    return
  }
  finished.value = true
  toast.success('DATEV is set up. You can create your first Buchungsstapel.')
}

/** Leaves the sheet and lands on the surface the setup was for. */
function goToExports() {
  activeFinanceTab.value = 'exports'
  sheetOpen.value = false
}
</script>

<template>
  <!-- ── Done ─────────────────────────────────────────────────────────── -->
  <div v-if="finished" class="flex flex-col gap-5">
    <div class="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/60 p-4">
      <Icon name="lucide:circle-check" class="mt-0.5 size-5 shrink-0 text-green-600" />
      <div>
        <p class="text-sm font-medium text-green-900">
          DATEV is set up
        </p>
        <p class="mt-1 text-xs leading-relaxed text-green-800">
          Berater {{ draft.beraternummer }} · Mandant {{ draft.mandantennummer }} ·
          {{ draft.skr }} · WJ {{ formatFiscalYearStart(draft) }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2 rounded-lg border p-4">
      <p class="text-sm font-medium">
        What happens next
      </p>
      <ol class="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <li>1. Pick a period in <span class="font-medium text-foreground">Finance → Exports</span>.</li>
        <li>2. Review the Buchungssätze the period produced.</li>
        <li>3. Download the file or open the prefilled e-mail draft to your advisor.</li>
      </ol>
    </div>

    <div class="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" @click="emit('done')">
        Review settings
      </Button>
      <Button size="sm" @click="goToExports">
        Go to Exports
        <Icon name="lucide:arrow-right" class="ml-1.5 size-4" />
      </Button>
    </div>
  </div>

  <!-- ── Steps ────────────────────────────────────────────────────────── -->
  <div v-else class="flex flex-col gap-6">
    <div class="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
      <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div class="text-xs leading-relaxed text-muted-foreground">
        <p class="mb-1 font-medium text-foreground">
          Your tax advisor provides these values.
        </p>
        <p>
          DATEV is not a connection — nothing is sent automatically. Setup shapes the
          <span class="font-medium">Buchungsstapel</span> file you generate in
          <span class="font-medium">Finance → Exports</span> and hand to your advisor.
        </p>
      </div>
    </div>

    <!-- Progress -->
    <ol class="flex items-center gap-2">
      <li
        v-for="(item, index) in steps"
        :key="item.id"
        class="flex flex-1 items-center gap-2"
      >
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
          :class="index < stepIndex
            ? 'border-primary bg-primary text-primary-foreground'
            : index === stepIndex
              ? 'border-primary text-primary'
              : 'border-input text-muted-foreground'"
        >
          <Icon v-if="index < stepIndex" name="lucide:check" class="size-3" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span
          class="hidden truncate text-xs sm:inline"
          :class="index === stepIndex ? 'font-medium text-foreground' : 'text-muted-foreground'"
        >
          {{ item.title }}
        </span>
        <Separator v-if="index < steps.length - 1" class="hidden flex-1 sm:block" />
      </li>
    </ol>

    <!-- Active step -->
    <section class="flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold">
          Step {{ stepIndex + 1 }} of {{ steps.length }} — {{ step.title }}
        </h3>
        <p class="text-xs text-muted-foreground">
          {{ step.description }}
        </p>
      </div>

      <FinanceDatevFieldsAdvisor
        v-if="step.id === 'advisor'"
        v-model="draft"
        :errors="errors"
      />
      <FinanceDatevFieldsAccounts
        v-else-if="step.id === 'accounts'"
        v-model="draft"
        :errors="errors"
      />
      <template v-else>
        <FinanceDatevFieldsHandover v-model="draft" :errors="errors" />

        <div class="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Review
          </p>
          <dl class="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            <div class="flex items-center justify-between gap-2 sm:col-span-2">
              <dt class="text-muted-foreground">
                Berater / Mandant
              </dt>
              <dd class="font-mono">
                {{ draft.beraternummer }} / {{ draft.mandantennummer }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-2 sm:col-span-2">
              <dt class="text-muted-foreground">
                Kontenrahmen
              </dt>
              <dd>{{ draft.skr }} · WJ {{ formatFiscalYearStart(draft) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-2 sm:col-span-2">
              <dt class="text-muted-foreground">
                Debitor / Erlös
              </dt>
              <dd class="font-mono">
                {{ draft.debitorenkonto }} / {{ draft.erloeskonto }}
              </dd>
            </div>
          </dl>
        </div>
      </template>
    </section>

    <!-- Footer -->
    <div class="flex items-center justify-between gap-3 border-t pt-4">
      <Button
        variant="outline"
        size="sm"
        :disabled="stepIndex === 0"
        @click="back"
      >
        <Icon name="lucide:arrow-left" class="mr-1.5 size-4" />
        Back
      </Button>
      <Button v-if="!isLastStep" size="sm" @click="next">
        Continue
        <Icon name="lucide:arrow-right" class="ml-1.5 size-4" />
      </Button>
      <Button v-else size="sm" @click="finish">
        Finish setup
      </Button>
    </div>
  </div>
</template>
