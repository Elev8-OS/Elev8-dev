<script setup lang="ts">
import { ref } from 'vue'
import ChannelAccountsSection from '~/components/channels/ChannelAccountsSection.vue'
import ChannelMappingDialog from '~/components/channels/ChannelMappingDialog.vue'
import ChannelSummary from '~/components/channels/ChannelSummary.vue'

definePageMeta({ layout: 'default' })

// Opened from the sync error rows in the summary.
const mappingListingId = ref<string | null>(null)
const mappingChannel = ref<string | null>(null)
const mappingOpen = ref(false)

function openMapping(listingId: string, channel: string) {
  mappingListingId.value = listingId
  mappingChannel.value = channel
  mappingOpen.value = true
}
</script>

<template>
  <div class="w-full flex flex-col gap-8">
    <header class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        Channels
      </h1>
      <ChannelSummary @open-mapping="openMapping" />
    </header>

    <ChannelAccountsSection />

    <ChannelMappingDialog v-model:open="mappingOpen" :listing-id="mappingListingId" :channel="mappingChannel" />
  </div>
</template>
