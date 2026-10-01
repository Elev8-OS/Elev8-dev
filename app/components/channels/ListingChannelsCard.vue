<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChannels } from '~/composables/useChannels'
import ChannelMappingCell from './ChannelMappingCell.vue'
import ChannelMappingDialog from './ChannelMappingDialog.vue'
import { formatSyncTime } from './data/format'

const props = defineProps<{ listingId: string, listingName: string }>()

const { connectedChannels, getMapping, getAccount } = useChannels()

// One row per channel that has an account; channels with none are set up on /channels.
const rows = computed(() => connectedChannels.value.map((channel) => {
  const mapping = getMapping(props.listingId, channel.name)
  return {
    channel,
    mapping,
    accountName: mapping ? getAccount(mapping.accountId)?.accountName : undefined,
  }
}))

const dialogChannel = ref<string | null>(null)
const dialogOpen = ref(false)

function openDialog(channel: string) {
  dialogChannel.value = channel
  dialogOpen.value = true
}
</script>

<template>
  <Card class="p-5">
    <div class="mb-4 flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">
        Distribution Channels
      </h3>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/channels">
          Manage channels
        </NuxtLink>
      </Button>
    </div>

    <ul v-if="rows.length > 0" class="flex flex-col gap-3">
      <li v-for="row in rows" :key="row.channel.name" class="flex flex-col gap-2 rounded-lg border p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <Icon :name="row.channel.icon" class="size-5 shrink-0" />
            <div class="min-w-0">
              <p class="text-sm font-medium">
                {{ row.channel.name }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                <template v-if="row.mapping">
                  {{ row.accountName }}, last sync {{ formatSyncTime(row.mapping.lastSyncAt).toLowerCase() }}
                </template>
                <template v-else>
                  Not on {{ row.channel.name }}
                </template>
              </p>
            </div>
          </div>
          <ChannelMappingCell
            :mapping="row.mapping"
            :listing-name="listingName"
            :channel="row.channel.name"
            @open="openDialog(row.channel.name)"
          />
        </div>
        <p v-if="row.mapping?.error" class="flex items-start gap-1.5 text-xs text-destructive">
          <Icon name="lucide:circle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {{ row.mapping.error }}
        </p>
      </li>
    </ul>
    <p v-else class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      No channel is connected yet. Connect one in Channels to sell this listing on it.
    </p>

    <ChannelMappingDialog v-model:open="dialogOpen" :listing-id="listingId" :channel="dialogChannel" />
  </Card>
</template>
