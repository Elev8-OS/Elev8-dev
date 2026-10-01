<script setup lang="ts">
import type { ChannelMappingStatus } from '~/components/channels/data/channels'
import { MAPPING_STATUS_LABEL, otaIcon } from '~/components/channels/data/channels'
import { getUnits, listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'

const props = defineProps<{ listingId: string }>()

const { getMapping, getAccount } = useChannels()

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

// Sync status per channel, so the list shows which listings are live and which are failing.
const otas = computed(() => (live.value?.otaConnected ?? []).map((ota) => {
  const mapping = getMapping(props.listingId, ota)
  const account = mapping ? getAccount(mapping.accountId)?.accountName : undefined
  const status = mapping ? MAPPING_STATUS_LABEL[mapping.status] : 'Connected'
  return {
    ota,
    dot: mapping ? DOT[mapping.status] : undefined,
    label: [`${ota}: ${status}`, account, mapping?.error].filter(Boolean).join('. '),
  }
}))
</script>

<template>
  <div class="flex items-center gap-2" :class="inactive ? 'opacity-40' : ''">
    <Tooltip v-for="o in otas" :key="o.ota">
      <TooltipTrigger as-child>
        <span class="relative inline-flex" tabindex="0" :aria-label="o.label">
          <Icon :name="otaIcon(o.ota)" class="size-4" />
          <span
            v-if="o.dot"
            class="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-background"
            :class="o.dot"
            aria-hidden="true"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" class="max-w-[260px] text-xs">
        {{ o.label }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>
