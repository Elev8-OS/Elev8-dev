<script setup lang="ts">
import { computed } from 'vue'
import { websiteChannel } from '~/components/channels/data/website-channel'
import { websitesForListing } from '~/components/listings/data/listing-websites'
import { getUnits, listings } from '~/components/listings/data/listings'
import { websites } from '~/components/website-builder/data/websites'

/**
 * The Website column in the Listings table: how many Website Builder sites
 * sell the listing, with their names and rule sets in a tooltip. Read only.
 */
const props = defineProps<{ listingId: string }>()

const live = computed(() => listings.value.find(l => l.id === props.listingId))
const inactive = computed(() => {
  if (!live.value)
    return false
  if (live.value.unitType === 'multi')
    return getUnits(live.value).every(u => u.status === 'inactive')
  return live.value.status === 'inactive'
})

const rows = computed(() => websitesForListing(props.listingId, websites.value, websiteChannel.value))

const lines = computed(() => rows.value.map((row) => {
  const text = websiteChannel.value.enabled ? `${row.name}: ${row.ruleSetName ?? 'No rule set'}` : row.name
  return { id: row.websiteId, text }
}))

const label = computed(() => `On ${rows.value.length} ${rows.value.length === 1 ? 'website' : 'websites'}: ${lines.value.map(l => l.text).join(', ')}`)
</script>

<template>
  <div :class="inactive ? 'opacity-40' : ''">
    <Tooltip v-if="rows.length > 0">
      <TooltipTrigger as-child>
        <span
          tabindex="0"
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="label"
          data-testid="listing-website-count"
        >
          <Icon name="lucide:globe" class="size-3.5 text-muted-foreground" aria-hidden="true" />
          {{ rows.length }}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" class="max-w-[260px] text-xs">
        <ul class="flex flex-col gap-0.5">
          <li v-for="line in lines" :key="line.id">
            {{ line.text }}
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
    <span v-else class="px-2 text-xs text-muted-foreground/60" aria-label="On no website" data-testid="listing-website-none">–</span>
  </div>
</template>
