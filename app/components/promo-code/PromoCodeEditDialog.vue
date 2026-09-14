<script setup lang="ts">
import type { PromoCodeFormDraft, PromoCodeFormErrors, PromoCodeStepId } from './data/promo-code-form'
import type { PromoCode } from './data/promo-codes'
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
  promoCodeToFormDraft,
  validatePromoCodeStep,
} from './data/promo-code-form'
import PromoCodeDraftSummary from './PromoCodeDraftSummary.vue'
import PromoCodeFieldsBasics from './PromoCodeFieldsBasics.vue'
import PromoCodeFieldsDiscount from './PromoCodeFieldsDiscount.vue'
import PromoCodeFieldsRules from './PromoCodeFieldsRules.vue'
import PromoCodeFieldsScope from './PromoCodeFieldsScope.vue'

const props = defineProps<{ promoCode: PromoCode | null }>()

const emit = defineEmits<{ updated: [codeId: string] }>()

const open = defineModel<boolean>('open', { default: false })

const { updatePromoCode, isCodeTaken } = usePromoCodes()

const steps = PROMO_CODE_STEPS
const stepIndex = ref(0)
const draft = ref<PromoCodeFormDraft>(createDefaultPromoCodeFormDraft())
const errors = ref<PromoCodeFormErrors>({})

const basicsRef = ref<InstanceType<typeof PromoCodeFieldsBasics> | null>(null)
const discountRef = ref<InstanceType<typeof PromoCodeFieldsDiscount> | null>(null)

const step = computed(() => steps[stepIndex.value]!)
const isLastStep = computed(() => stepIndex.value === steps.length - 1)

function hydrate() {
  if (!props.promoCode)
    return
  draft.value = promoCodeToFormDraft(props.promoCode)
  errors.value = {}
  stepIndex.value = 0
}

watch(open, (isOpen) => {
  if (isOpen)
    hydrate()
}, { immediate: true })

watch(() => props.promoCode, () => {
  if (open.value)
    hydrate()
})

const validationContext = computed(() => ({
  isCodeTaken: (code: string) => isCodeTaken(code, props.promoCode?.id),
  scopedListingNames: draft.value.listingIds.length === 0
    ? allListings.value.map(l => l.name)
    : allListings.value.filter(l => draft.value.listingIds.includes(l.id)).map(l => l.name),
  upsellServices: mockUpsellServices,
}))

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

function submit() {
  const target = props.promoCode
  if (!target)
    return

  const failing = firstInvalidPromoCodeStep(draft.value, validationContext.value)
  if (failing) {
    goToStep(failing)
    errors.value = validatePromoCodeStep(draft.value, failing, validationContext.value)
    focusActiveStep()
    toast.error('Check the highlighted fields.')
    return
  }

  const updated = updatePromoCode(target.id, formDraftToPromoCodePayload(draft.value))
  if (!updated) {
    toast.error('Could not save this code.')
    return
  }

  toast.success(`Code ${updated.code} updated`)
  emit('updated', updated.id)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Edit promo code</DialogTitle>
        <DialogDescription>
          Four short steps: the code, where it works, the discount, and how long it runs.
        </DialogDescription>
      </DialogHeader>

      <!-- Progress -->
      <ol class="flex items-center gap-2" aria-label="Edit promo code steps">
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
          id-prefix="promo-edit-basics"
        />
        <PromoCodeFieldsScope
          v-else-if="step.id === 'scope'"
          v-model="draft"
          :errors="errors"
          id-prefix="promo-edit-scope"
        />
        <PromoCodeFieldsDiscount
          v-else-if="step.id === 'discount'"
          ref="discountRef"
          v-model="draft"
          :errors="errors"
          id-prefix="promo-edit-discount"
        />
        <template v-else>
          <PromoCodeFieldsRules v-model="draft" :errors="errors" id-prefix="promo-edit-rules" />

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
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
