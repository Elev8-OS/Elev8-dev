<script setup lang="ts">
import type { PromoCodeFormDraft, PromoCodeFormErrors, PromoCodeStepId } from './data/promo-code-form'
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings as allListings } from '~/components/listings/data/listings'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'
import { usePromoCodes } from '~/composables/usePromoCodes'
import {
  createDefaultPromoCodeFormDraft,
  firstInvalidPromoCodeStep,
  formDraftToPromoCodePayload,
  PROMO_CODE_STEPS,
  validatePromoCodeStep,
} from './data/promo-code-form'
import PromoCodeDraftSummary from './PromoCodeDraftSummary.vue'
import PromoCodeFieldsBasics from './PromoCodeFieldsBasics.vue'
import PromoCodeFieldsDiscount from './PromoCodeFieldsDiscount.vue'
import PromoCodeFieldsRules from './PromoCodeFieldsRules.vue'
import PromoCodeFieldsScope from './PromoCodeFieldsScope.vue'

/**
 * Creating a promo code asks eight unrelated questions. Asked all at once they
 * read as one intimidating wall, and the two that are conditional (currency,
 * upsell items) appear and vanish mid-scroll. This wizard asks one decision at
 * a time and ends on a read-back of the whole code.
 *
 * Editing stays a flat form — see `PromoCodeEditDialog`, which reuses the same
 * field groups so the labels cannot drift between the two surfaces.
 */
const emit = defineEmits<{ created: [codeId: string] }>()

const open = defineModel<boolean>('open', { default: false })

const { createPromoCode, isCodeTaken } = usePromoCodes()

const steps = PROMO_CODE_STEPS
const stepIndex = ref(0)
const draft = ref<PromoCodeFormDraft>(createDefaultPromoCodeFormDraft())
const errors = ref<PromoCodeFormErrors>({})

const basicsRef = ref<InstanceType<typeof PromoCodeFieldsBasics> | null>(null)
const discountRef = ref<InstanceType<typeof PromoCodeFieldsDiscount> | null>(null)

const step = computed(() => steps[stepIndex.value]!)
const isLastStep = computed(() => stepIndex.value === steps.length - 1)

/**
 * Listing names the code covers plus the upsell catalogue, so the validator
 * can reject a free upsell that none of those properties actually sell. Both
 * are injected rather than imported by the form module, which stays store-free.
 */
const validationContext = computed(() => ({
  isCodeTaken: (code: string) => isCodeTaken(code),
  scopedListingNames: draft.value.listingIds.length === 0
    ? allListings.value.map(l => l.name)
    : allListings.value.filter(l => draft.value.listingIds.includes(l.id)).map(l => l.name),
  upsellServices: mockUpsellServices,
}))

watch(open, (isOpen) => {
  if (!isOpen)
    return
  draft.value = createDefaultPromoCodeFormDraft()
  errors.value = {}
  stepIndex.value = 0
})

/** Puts the caret back on the field that failed, not just the message. */
function focusActiveStep() {
  nextTick(() => {
    if (step.value.id === 'basics')
      basicsRef.value?.focus()
    else if (step.value.id === 'discount')
      discountRef.value?.focus()
  })
}

function validateActiveStep(): boolean {
  errors.value = validatePromoCodeStep(draft.value, step.value.id, validationContext.value)
  const ok = Object.keys(errors.value).length === 0
  if (!ok)
    focusActiveStep()
  return ok
}

function goToStep(id: PromoCodeStepId) {
  const index = steps.findIndex(s => s.id === id)
  if (index >= 0)
    stepIndex.value = index
}

function back() {
  errors.value = {}
  stepIndex.value = Math.max(0, stepIndex.value - 1)
}

function next() {
  if (!validateActiveStep())
    return
  stepIndex.value = Math.min(steps.length - 1, stepIndex.value + 1)
  errors.value = {}
}

/**
 * A host can walk back and change an earlier answer, so the final submit
 * re-validates every step rather than trusting the ones already passed.
 */
function submit() {
  const failing = firstInvalidPromoCodeStep(draft.value, validationContext.value)
  if (failing) {
    goToStep(failing)
    errors.value = validatePromoCodeStep(draft.value, failing, validationContext.value)
    focusActiveStep()
    toast.error('Check the highlighted fields.')
    return
  }

  const created = createPromoCode(formDraftToPromoCodePayload(draft.value))
  toast.success(`Code ${created.code} created`)
  emit('created', created.id)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Create promo code</DialogTitle>
        <DialogDescription>
          Four short steps: the code, the discount, where it works, and how long it runs.
        </DialogDescription>
      </DialogHeader>

      <!-- Progress -->
      <ol class="flex items-center gap-2" aria-label="Create promo code steps">
        <li
          v-for="(item, index) in steps"
          :key="item.id"
          class="flex flex-1 items-center gap-2"
          :aria-current="index === stepIndex ? 'step' : undefined"
        >
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
            :class="index < stepIndex
              ? 'border-primary bg-primary text-primary-foreground'
              : index === stepIndex
                ? 'border-primary text-primary'
                : 'border-input text-muted-foreground'"
          >
            <Icon v-if="index < stepIndex" name="lucide:check" class="size-3" aria-hidden="true" />
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

      <form class="flex flex-col gap-4" @submit.prevent="isLastStep ? submit() : next()">
        <div>
          <h3 class="flex items-center gap-1.5 text-sm font-semibold">
            <Icon :name="step.icon" class="size-4 text-muted-foreground" aria-hidden="true" />
            Step {{ stepIndex + 1 }} of {{ steps.length }} — {{ step.title }}
          </h3>
          <p class="text-xs text-muted-foreground">
            {{ step.description }}
          </p>
        </div>

        <PromoCodeFieldsBasics
          v-if="step.id === 'basics'"
          ref="basicsRef"
          v-model="draft"
          :errors="errors"
          id-prefix="promo-create-basics"
        />
        <PromoCodeFieldsDiscount
          v-else-if="step.id === 'discount'"
          ref="discountRef"
          v-model="draft"
          :errors="errors"
          id-prefix="promo-create-discount"
        />
        <PromoCodeFieldsScope
          v-else-if="step.id === 'scope'"
          v-model="draft"
          :errors="errors"
          id-prefix="promo-create-scope"
        />
        <template v-else>
          <PromoCodeFieldsRules v-model="draft" :errors="errors" id-prefix="promo-create-rules" />

          <div class="flex flex-col gap-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Review
            </p>
            <PromoCodeDraftSummary :draft="draft" />
          </div>
        </template>
      </form>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button v-if="stepIndex > 0" type="button" variant="ghost" @click="back">
          <Icon name="lucide:arrow-left" class="mr-1.5 size-4" aria-hidden="true" />
          Back
        </Button>
        <Button v-else type="button" variant="ghost" @click="open = false">
          Cancel
        </Button>

        <Button v-if="!isLastStep" type="button" @click="next">
          Next
          <Icon name="lucide:arrow-right" class="ml-1.5 size-4" aria-hidden="true" />
        </Button>
        <Button v-else type="button" @click="submit">
          Create code
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
