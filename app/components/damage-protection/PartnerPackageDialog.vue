<script setup lang="ts">
import type { TernTier } from '~/components/reservations/data/tern-products'
import { toast } from 'vue-sonner'
import { protectionRefusalText } from '~/components/damage-protection/data/listing-protection'
import PartnerPackagePicker from '~/components/damage-protection/PartnerPackagePicker.vue'
import { PACKAGE_CURRENCY, validatePackageChoice } from '~/components/reservations/data/tern-activation'
import { ternProduct } from '~/components/reservations/data/tern-products'
import { useDamageProtection } from '~/composables/useDamageProtection'

/**
 * Edit package in Settings, Damage protection: the same partner packages and
 * price as the activation wizard. Saving writes onto the waiver's one upsell;
 * it switches the waiver on only when `turnOn` says so (a first package while
 * active), otherwise the waiver stays as it is.
 */
const props = defineProps<{ turnOn?: boolean }>()
const open = defineModel<boolean>('open', { required: true })

const dp = useDamageProtection()

const tier = ref<TernTier | null>(null)
const price = ref(0)
const errors = ref<Record<string, string>>({})

watch(open, (isOpen) => {
  if (!isOpen)
    return
  tier.value = dp.currentPackage.value?.tier ?? null
  price.value = dp.currentPackage.value?.guestPrice ?? 0
  errors.value = {}
}, { immediate: true })

watch(tier, () => { errors.value = {} })

function save() {
  errors.value = validatePackageChoice(tier.value, price.value)
  if (Object.keys(errors.value).length)
    return
  const result = dp.setWaiverPackage(tier.value!, price.value, PACKAGE_CURRENCY, props.turnOn)
  if (!result.ok) {
    toast.error(protectionRefusalText(result.reason))
    return
  }
  toast.success(`Every listing now offers Elev8 Cover ${ternProduct(tier.value!).name}`)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-4xl" data-testid="partner-package-dialog">
      <DialogHeader class="border-b px-6 py-4">
        <DialogTitle>Damage waiver package</DialogTitle>
        <DialogDescription>
          Choose one of our insurance partner's packages and set what your guests pay for it. Every listing offers it;
          stays already protected keep the price they accepted.
        </DialogDescription>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <PartnerPackagePicker v-if="open" v-model:tier="tier" v-model:price="price" :errors="errors" />
      </div>
      <DialogFooter class="border-t px-6 py-4">
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button data-testid="partner-package-save" @click="save">
          Save package
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
