<script setup lang="ts">
import type { TernProduct, TernTier } from '~/components/reservations/data/tern-products'
import CoverageBreakdown from '~/components/damage-protection/CoverageBreakdown.vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { PACKAGE_CURRENCY } from '~/components/reservations/data/tern-activation'
import { ternPriceFor, ternSizeLabel } from '~/components/reservations/data/tern-products'
import { useTernApi } from '~/composables/useTernApi'

/**
 * The damage waiver's package: one of the PARTNER's packages (Elev8 Cover
 * tiers, read from the partner's catalogue, never an upsell) and what the guest
 * pays for it, which the tenant must set. Shared by the activation wizard and
 * Edit package in Settings, Damage protection.
 */
defineProps<{
  /** Field errors from `validateActivationStep(..., 'package')`. */
  errors?: Record<string, string>
}>()

const tier = defineModel<TernTier | null>('tier', { required: true })
const price = defineModel<number>('price', { required: true })

const ternApi = useTernApi()
const packages = ref<TernProduct[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    packages.value = await ternApi.fetchPackages(PACKAGE_CURRENCY)
  }
  finally {
    loading.value = false
  }
})

function pick(value: TernTier) {
  tier.value = value
}

function setPrice(value: string | number) {
  price.value = Number(value) || 0
}

/** Elev8's fee per package beside what the guest pays: what the tenant keeps. */
const marginText = computed(() => {
  const cover = tier.value ? ternPriceFor(tier.value, PACKAGE_CURRENCY) : null
  if (!cover)
    return ''
  const fee = `Elev8 charges you ${formatProtectionAmount(cover.perStayFee, PACKAGE_CURRENCY)} per package (30 nights of a covered stay)`
  return price.value > 0
    ? `${fee}, so you keep ${formatProtectionAmount(price.value - cover.perStayFee, PACKAGE_CURRENCY)}.`
    : `${fee}.`
})
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="partner-package-picker">
    <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground" data-testid="tern-packages-loading">
      <Icon name="lucide:loader-2" class="size-4 animate-spin" />
      Loading the partner's packages…
    </div>
    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Package">
        <button
          v-for="product in packages"
          :key="product.tier"
          type="button"
          role="radio"
          :aria-checked="tier === product.tier"
          class="flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors"
          :class="tier === product.tier ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/60'"
          :data-testid="`tern-package-${product.tier}`"
          @click="pick(product.tier)"
        >
          <span class="flex items-center gap-2 font-medium">
            Elev8 Cover {{ product.name }}
            <Icon v-if="tier === product.tier" name="lucide:check" class="ml-auto size-4 text-primary" />
          </span>
          <span class="text-xs text-muted-foreground">
            {{ ternSizeLabel(product) }} · covers up to {{ formatProtectionAmount(product.prices[PACKAGE_CURRENCY]!.coverageCap, PACKAGE_CURRENCY) }}
          </span>
          <span class="text-xs">
            Elev8 charges you {{ formatProtectionAmount(product.prices[PACKAGE_CURRENCY]!.perStayFee, PACKAGE_CURRENCY) }} per 30 nights
          </span>
        </button>
      </div>
      <p v-if="errors?.packageTier" class="text-xs text-destructive">
        {{ errors.packageTier }}
      </p>

      <div v-if="tier" class="flex flex-col gap-1.5">
        <Label for="tern-guest-price">Guest pays per package (30 nights)</Label>
        <div class="relative sm:max-w-xs">
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {{ PACKAGE_CURRENCY }}
          </span>
          <Input
            id="tern-guest-price"
            type="number"
            min="0"
            step="0.01"
            class="pl-14"
            :model-value="price || ''"
            data-testid="tern-guest-price"
            @update:model-value="setPrice"
          />
        </div>
        <p v-if="errors?.guestPrice" class="text-xs text-destructive">
          {{ errors.guestPrice }}
        </p>
        <p class="text-xs text-muted-foreground" data-testid="tern-package-margin">
          {{ marginText }}
        </p>
      </div>

      <CoverageBreakdown v-if="tier" :tier="tier" :currency="PACKAGE_CURRENCY" />
    </template>
  </div>
</template>
