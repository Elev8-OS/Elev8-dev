<script setup lang="ts">
import type { PromoCodeFormDraft } from './data/promo-code-form'
import { computed } from 'vue'
import { listings as allListings } from '~/components/listings/data/listings'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'
import { websites as allWebsites } from '~/components/website-builder/data/websites'
import { formatDraftDiscount } from './data/promo-code-form'
import { formatPromoWindow } from './data/promo-codes'

/**
 * Final read-back before a code is created. Resolves every ID the draft holds
 * into the name the host recognises, so "3 listings" is never the last thing
 * they see before committing.
 */
const props = defineProps<{ draft: PromoCodeFormDraft }>()

const listingNames = computed(() =>
  props.draft.listingIds
    .map(id => allListings.value.find(l => l.id === id)?.name)
    .filter((n): n is string => Boolean(n)),
)

const websiteNames = computed(() =>
  props.draft.websiteIds
    .map(id => allWebsites.value.find(w => w.id === id)?.name)
    .filter((n): n is string => Boolean(n)),
)

const upsellItemNames = computed(() => {
  const names: string[] = []
  for (const service of mockUpsellServices) {
    for (const item of service.items) {
      if (props.draft.freeUpsellItemIds.includes(item.id))
        names.push(`${service.name} · ${item.name}`)
    }
  }
  return names
})

const channelLabel = computed(() => {
  if (props.draft.channel === 'widget')
    return 'Booking widgets only'
  return websiteNames.value.length === 0
    ? 'Websites only — all websites'
    : `Websites only — ${websiteNames.value.join(', ')}`
})

const listingsLabel = computed(() =>
  listingNames.value.length === 0 ? 'All listings' : listingNames.value.join(', '),
)

const windowsLabel = computed(() => {
  const parts: string[] = []
  if (props.draft.bookingWindows.length > 0)
    parts.push(`Book: ${props.draft.bookingWindows.map(formatPromoWindow).join(' · ')}`)
  if (props.draft.stayWindows.length > 0)
    parts.push(`Stay: ${props.draft.stayWindows.map(formatPromoWindow).join(' · ')}`)
  return parts.length === 0 ? 'Always valid' : parts.join(' | ')
})

const usageLabel = computed(() =>
  props.draft.usageLimit === null ? 'Unlimited redemptions' : `Up to ${props.draft.usageLimit} redemptions`,
)

const rows = computed(() => [
  { label: 'Discount', value: formatDraftDiscount(props.draft) },
  ...(upsellItemNames.value.length > 0 ? [{ label: 'Free items', value: upsellItemNames.value.join(', ') }] : []),
  { label: 'Channel', value: channelLabel.value },
  { label: 'Listings', value: listingsLabel.value },
  { label: 'Validity', value: windowsLabel.value },
  { label: 'Usage', value: usageLabel.value },
])
</script>

<template>
  <div class="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="font-mono text-sm font-semibold tracking-wide">
        {{ props.draft.code || '—' }}
      </p>
      <Badge :variant="props.draft.active ? 'default' : 'secondary'">
        {{ props.draft.active ? 'Active on create' : 'Inactive' }}
      </Badge>
    </div>
    <p v-if="props.draft.description" class="text-xs text-muted-foreground">
      {{ props.draft.description }}
    </p>
    <dl class="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
      <template v-for="row in rows" :key="row.label">
        <dt class="font-medium text-muted-foreground">
          {{ row.label }}
        </dt>
        <dd class="break-words">
          {{ row.value }}
        </dd>
      </template>
    </dl>
  </div>
</template>
