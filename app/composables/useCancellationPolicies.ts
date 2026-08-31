import { computed, ref } from 'vue'
import type { CancellationPolicyConfig } from '~/components/listings/data/listings'
import { createCancellationPolicyConfig } from '~/components/listings/data/listings'

// Single account-level default cancellation policy. Every listing uses this
// unless it has its own override stored in `overrides`.
const defaultConfig = ref<CancellationPolicyConfig>(createCancellationPolicyConfig('flexible'))

// Overrides keyed by listing id. A listing only appears here when someone
// explicitly set a custom policy for it.
const overrides = ref<Record<string, CancellationPolicyConfig>>({})

function getOverride(listingId: string): CancellationPolicyConfig | undefined {
  return overrides.value[listingId]
}

function hasOverride(listingId: string): boolean {
  return listingId in overrides.value
}

function setOverride(listingId: string, config: CancellationPolicyConfig): void {
  overrides.value = { ...overrides.value, [listingId]: config }
}

function clearOverride(listingId: string): void {
  const next = { ...overrides.value }
  delete next[listingId]
  overrides.value = next
}

function effectiveConfigForListing(listingId: string): CancellationPolicyConfig {
  return getOverride(listingId) ?? defaultConfig.value
}

const overrideCount = computed(() => Object.keys(overrides.value).length)

export function useCancellationPolicies() {
  return {
    defaultConfig,
    overrides,
    overrideCount,
    getOverride,
    hasOverride,
    setOverride,
    clearOverride,
    effectiveConfigForListing,
  }
}
