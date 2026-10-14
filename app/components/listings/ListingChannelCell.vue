<script setup lang="ts">
import type { ChannelMappingStatus } from '~/components/channels/data/channels'
import { channelListingUrl, MAPPING_STATUS_LABEL } from '~/components/channels/data/channels'
import { getUnits, listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'

/**
 * One channel's column in the Listings table. On the channel: a button with the
 * sync status that opens the listing on the OTA (or the mapping dialog when the
 * OTA has no public page). Not on it: Connect, which opens the mapping dialog,
 * or goes to /channels when the channel has no account yet.
 */
const props = defineProps<{ listingId: string, channel: string }>()
const emit = defineEmits<{ openMapping: [] }>()

const { getMapping, getAccount, isConnected } = useChannels()

const live = computed(() => listings.value.find(l => l.id === props.listingId))
const inactive = computed(() => {
  if (!live.value)
    return false
  if (live.value.unitType === 'multi')
    return getUnits(live.value).every(u => u.status === 'inactive')
  return live.value.status === 'inactive'
})

const DOT: Record<ChannelMappingStatus, string> = {
  active: 'bg-green-500',
  syncing: 'bg-amber-500 animate-pulse motion-reduce:animate-none',
  error: 'bg-destructive',
}

const state = computed(() => {
  if (!live.value?.otaConnected?.includes(props.channel))
    return null
  const mapping = getMapping(props.listingId, props.channel)
  const account = mapping ? getAccount(mapping.accountId) : undefined
  const url = mapping ? channelListingUrl(props.channel, mapping.externalId, account?.propertyId) : null
  const status = mapping ? MAPPING_STATUS_LABEL[mapping.status] : 'Connected'
  return {
    url,
    status,
    dot: mapping ? DOT[mapping.status] : 'bg-green-500',
    error: mapping?.status === 'error',
    label: [
      url ? `Open on ${props.channel} (${status})` : `${props.channel}: ${status}`,
      account?.accountName,
      mapping?.error,
    ].filter(Boolean).join('. '),
  }
})
</script>

<template>
  <div :class="inactive ? 'opacity-40' : ''">
    <Tooltip v-if="state">
      <TooltipTrigger as-child>
        <Button
          v-if="state.url"
          variant="outline"
          size="sm"
          class="h-7 w-full justify-start gap-1.5 px-2 text-xs"
          :class="state.error ? 'text-destructive' : ''"
          as-child
        >
          <a :href="state.url" target="_blank" rel="noopener noreferrer" :aria-label="state.label">
            <span class="size-1.5 shrink-0 rounded-full" :class="state.dot" aria-hidden="true" />
            {{ state.status }}
            <Icon name="lucide:external-link" class="ml-auto size-3.5 text-muted-foreground" />
          </a>
        </Button>
        <Button
          v-else
          variant="outline"
          size="sm"
          class="h-7 w-full justify-start gap-1.5 px-2 text-xs"
          :class="state.error ? 'text-destructive' : ''"
          :aria-label="state.label"
          @click="emit('openMapping')"
        >
          <span class="size-1.5 shrink-0 rounded-full" :class="state.dot" aria-hidden="true" />
          {{ state.status }}
          <Icon name="lucide:settings-2" class="ml-auto size-3.5 text-muted-foreground" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" class="max-w-[260px] text-xs">
        {{ state.label }}
      </TooltipContent>
    </Tooltip>
    <Button
      v-else-if="isConnected(channel)"
      variant="ghost"
      size="sm"
      class="h-7 w-full justify-start gap-1.5 px-2 text-xs text-muted-foreground"
      :aria-label="`Connect to ${channel}`"
      @click="emit('openMapping')"
    >
      <Icon name="lucide:plus" class="size-3.5" />
      Connect
    </Button>
    <Button
      v-else
      variant="ghost"
      size="sm"
      class="h-7 w-full justify-start gap-1.5 px-2 text-xs text-muted-foreground"
      :aria-label="`Connect a ${channel} account`"
      as-child
    >
      <NuxtLink to="/channels">
        <Icon name="lucide:plus" class="size-3.5" />
        Connect
      </NuxtLink>
    </Button>
  </div>
</template>
