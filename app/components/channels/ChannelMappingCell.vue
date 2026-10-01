<script setup lang="ts">
import type { ChannelMapping } from './data/channels'
import { computed } from 'vue'
import { MAPPING_STATUS_LABEL } from './data/channels'

const props = defineProps<{ mapping: ChannelMapping | undefined, listingName: string, channel: string, accountName?: string }>()

const emit = defineEmits<{ open: [] }>()

const label = computed(() => props.mapping ? MAPPING_STATUS_LABEL[props.mapping.status] : '')
</script>

<template>
  <div v-if="mapping" class="flex flex-col items-start gap-0.5">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
      :class="mapping.status === 'error' ? 'border-destructive/40 text-destructive' : ''"
      :aria-label="`${listingName} on ${channel}${accountName ? ` (${accountName})` : ''}: ${label}`"
      @click="emit('open')"
    >
      <Icon v-if="mapping.status === 'syncing'" name="lucide:loader-circle" class="size-3 animate-spin" aria-hidden="true" />
      <Icon v-else-if="mapping.status === 'error'" name="lucide:circle-alert" class="size-3" aria-hidden="true" />
      <span v-else class="size-1.5 rounded-full bg-green-500" aria-hidden="true" />
      {{ label }}
    </button>
    <span v-if="accountName" class="max-w-[140px] truncate pl-1 text-[11px] text-muted-foreground">{{ accountName }}</span>
  </div>
  <Button
    v-else
    variant="ghost"
    size="sm"
    class="h-7 px-2 text-xs text-muted-foreground"
    :aria-label="`Connect ${listingName} to ${channel}`"
    @click="emit('open')"
  >
    <Icon name="lucide:plus" class="mr-1 size-3" aria-hidden="true" />
    Connect
  </Button>
</template>
