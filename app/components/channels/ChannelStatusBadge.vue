<script setup lang="ts">
import type { ChannelMappingStatus } from './data/channels'
import { MAPPING_STATUS_ICON, MAPPING_STATUS_LABEL, MAPPING_STATUS_TONE } from './data/channels'

/** One listing's status on one channel. No status means not on the channel. */
defineProps<{ status: ChannelMappingStatus | null }>()
</script>

<template>
  <Badge v-if="status" variant="outline" class="gap-1 whitespace-nowrap" :class="MAPPING_STATUS_TONE[status]">
    <Icon
      v-if="MAPPING_STATUS_ICON[status]"
      :name="MAPPING_STATUS_ICON[status]!"
      class="size-3"
      :class="status === 'syncing' ? 'animate-spin motion-reduce:animate-none' : ''"
      aria-hidden="true"
    />
    <span v-else class="size-1.5 rounded-full bg-green-500" aria-hidden="true" />
    {{ MAPPING_STATUS_LABEL[status] }}
  </Badge>
  <Badge v-else variant="outline" class="whitespace-nowrap text-muted-foreground">
    Not connected
  </Badge>
</template>
