<script setup lang="ts">
import type { CockpitRoomType } from '~/components/cockpit/data/cockpit'
import type { Listing } from '~/components/listings/data/listings'
import { channelListingUrl, getChannel, MAPPING_STATUS_DOT, MAPPING_STATUS_LABEL, otaIcon } from '~/components/channels/data/channels'
import { roomTypeExternalId, useChannels } from '~/composables/useChannels'

/**
 * The channels a listing is on, on the Cockpit board. Channels map room types,
 * so a multi-unit listing shows them on each room type row (`roomType`) and a
 * single-unit listing on its header row. Each logo opens that page on the OTA
 * in a new tab (`channelListingUrl`); a channel with no public page shows the
 * logo only. The dot is the sync status, as in the Listings table.
 */
const props = defineProps<{ listing: Listing, roomType?: CockpitRoomType }>()

const { getMapping, getAccount } = useChannels()

const links = computed(() => (props.listing.otaConnected ?? []).flatMap((channel) => {
  const mapping = getMapping(props.listing.id, channel)
  if (!mapping)
    return []
  const account = getAccount(mapping.accountId)
  const externalId = props.roomType ? roomTypeExternalId(props.listing.id, props.roomType.id, channel) : mapping.externalId
  const url = channelListingUrl(channel, externalId, account?.propertyId)
  const status = MAPPING_STATUS_LABEL[mapping.status]
  return [{
    channel,
    url,
    dot: MAPPING_STATUS_DOT[mapping.status],
    label: [
      url ? `Open ${props.roomType?.name ?? 'listing'} on ${channel} (${status})` : `${channel}: ${status}`,
      `${getChannel(channel)?.listingIdLabel ?? 'ID'} ${externalId}`,
      account?.accountName,
      mapping.error,
    ].filter(Boolean).join('. '),
  }]
}))
</script>

<template>
  <div v-if="links.length" class="flex shrink-0 items-center gap-1.5" data-testid="cockpit-channel-links">
    <Tooltip v-for="l in links" :key="l.channel">
      <TooltipTrigger as-child>
        <a
          v-if="l.url"
          :href="l.url"
          target="_blank"
          rel="noopener noreferrer"
          class="relative inline-flex rounded-sm hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :aria-label="l.label"
          data-testid="cockpit-channel-link"
        >
          <Icon :name="otaIcon(l.channel)" class="size-3.5" />
          <span class="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-muted" :class="l.dot" aria-hidden="true" />
        </a>
        <span v-else class="relative inline-flex" tabindex="0" :aria-label="l.label">
          <Icon :name="otaIcon(l.channel)" class="size-3.5" />
          <span class="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-muted" :class="l.dot" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" class="max-w-[260px] text-xs">
        {{ l.label }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>
