<script setup lang="ts">
import type { PromoCodeFormDraft, PromoCodeFormErrors } from './data/promo-code-form'
import type { PromoCode } from './data/promo-codes'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings as allListings } from '~/components/listings/data/listings'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'
import { usePromoCodes } from '~/composables/usePromoCodes'
import {
  createDefaultPromoCodeFormDraft,
  formDraftToPromoCodePayload,
  promoCodeToFormDraft,
  validatePromoCodeForm,
} from './data/promo-code-form'
import PromoCodeFieldsBasics from './PromoCodeFieldsBasics.vue'
import PromoCodeFieldsDiscount from './PromoCodeFieldsDiscount.vue'
import PromoCodeFieldsRules from './PromoCodeFieldsRules.vue'
import PromoCodeFieldsScope from './PromoCodeFieldsScope.vue'

/**
 * Editing stays a single scrollable form rather than the create wizard: the
 * host already knows the code and usually came here to change one field, so
 * stepping through four screens to reach it would be slower, not clearer.
 * The field groups are the same ones the wizard renders, so the labels and
 * the validation copy cannot drift between the two surfaces.
 */
const props = defineProps<{ promoCode: PromoCode | null }>()

const emit = defineEmits<{ updated: [codeId: string] }>()

const open = defineModel<boolean>('open', { default: false })

const { updatePromoCode, isCodeTaken } = usePromoCodes()

const draft = ref<PromoCodeFormDraft>(createDefaultPromoCodeFormDraft())
const errors = ref<PromoCodeFormErrors>({})

function hydrate() {
  if (!props.promoCode)
    return
  draft.value = promoCodeToFormDraft(props.promoCode)
  errors.value = {}
}

// `immediate` so the form is populated whether the dialog is toggled open or
// mounted already-open — a plain change watcher would leave the second case blank.
watch(open, (isOpen) => {
  if (isOpen)
    hydrate()
}, { immediate: true })

watch(() => props.promoCode, () => {
  if (open.value)
    hydrate()
})

function submit() {
  const target = props.promoCode
  if (!target)
    return

  errors.value = validatePromoCodeForm(draft.value, {
    // The code being edited is allowed to keep its own value.
    isCodeTaken: (code: string) => isCodeTaken(code, target.id),
    scopedListingNames: draft.value.listingIds.length === 0
      ? allListings.value.map(l => l.name)
      : allListings.value.filter(l => draft.value.listingIds.includes(l.id)).map(l => l.name),
    upsellServices: mockUpsellServices,
  })
  if (Object.keys(errors.value).length > 0) {
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
          Update the code, its discount, where it works, and how long it runs.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-6" @submit.prevent="submit">
        <PromoCodeFieldsBasics v-model="draft" :errors="errors" id-prefix="promo-edit-basics" />
        <Separator />
        <PromoCodeFieldsDiscount v-model="draft" :errors="errors" id-prefix="promo-edit-discount" />
        <Separator />
        <PromoCodeFieldsScope v-model="draft" :errors="errors" id-prefix="promo-edit-scope" />
        <Separator />
        <PromoCodeFieldsRules v-model="draft" :errors="errors" id-prefix="promo-edit-rules" />
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button type="button" @click="submit">
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
