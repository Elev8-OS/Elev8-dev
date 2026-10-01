<script setup lang="ts">
import { computed } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'

const emit = defineEmits<{ openMapping: [listingId: string, channel: string] }>()

const { accounts, connectedChannels, mappedListingCount, unmappedListingCount, mappings, getAccount } = useChannels()

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

const sentence = computed(() => {
  if (connectedChannels.value.length === 0)
    return `None of your ${listings.value.length} listings are on a channel yet.`
  const listingsPart = mappedListingCount.value === listings.value.length
    ? `All ${plural(listings.value.length, 'listing', 'listings')} are sold`
    : `${mappedListingCount.value} of your ${listings.value.length} listings are sold`
  const rest = unmappedListingCount.value > 0
    ? ` ${plural(unmappedListingCount.value, 'listing is', 'listings are')} not on any channel.`
    : ''
  return `${listingsPart} on ${plural(connectedChannels.value.length, 'channel', 'channels')} through ${plural(accounts.value.length, 'account', 'accounts')}.${rest}`
})

const errors = computed(() => mappings.value
  .filter(m => m.status === 'error')
  .map(m => ({
    mapping: m,
    listingName: listings.value.find(l => l.id === m.listingId)?.name ?? m.listingId,
    accountName: getAccount(m.accountId)?.accountName ?? '',
  })))
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="max-w-prose text-base text-muted-foreground">
      {{ sentence }}
    </p>

    <ul v-if="errors.length > 0" class="flex flex-col gap-2" aria-label="Sync errors">
      <li
        v-for="e in errors"
        :key="e.mapping.id"
        class="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center"
      >
        <Icon name="lucide:circle-alert" class="hidden size-4 shrink-0 text-destructive sm:block" aria-hidden="true" />
        <div class="min-w-0 flex-1 text-sm">
          <p class="font-medium">
            {{ e.listingName }} on {{ e.mapping.channel }}<span v-if="e.accountName" class="font-normal text-muted-foreground"> ({{ e.accountName }})</span>
          </p>
          <p class="text-muted-foreground">
            {{ e.mapping.error }}
          </p>
        </div>
        <Button size="sm" variant="outline" class="shrink-0 self-start sm:self-auto" @click="emit('openMapping', e.mapping.listingId, e.mapping.channel)">
          Fix mapping
        </Button>
      </li>
    </ul>
  </div>
</template>
