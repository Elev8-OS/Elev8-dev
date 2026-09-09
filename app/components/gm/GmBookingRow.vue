<script setup lang="ts">
import type { GmStay } from '~/components/gm/data/gm-dashboard'
import { formatDayShort, formatMoney, gmChannelIcons } from '~/components/gm/data/gm-dashboard'

const props = defineProps<{
  stay: GmStay
  kind: 'arrival' | 'departure' | 'stayover'
}>()

const meta = computed(() => {
  if (props.kind === 'arrival')
    return { icon: 'lucide:log-in', tone: 'text-green-600 dark:text-green-400', detail: `ETA ${props.stay.eta}` }
  if (props.kind === 'departure')
    return { icon: 'lucide:log-out', tone: 'text-amber-600 dark:text-amber-400', detail: `${props.stay.nights} nights` }
  return {
    icon: 'lucide:moon',
    tone: 'text-muted-foreground',
    detail: `until ${formatDayShort(props.stay.checkOut)}`,
  }
})
</script>

<template>
  <div class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
    <Avatar class="size-8 shrink-0">
      <AvatarFallback class="text-xs">
        {{ stay.initials }}
      </AvatarFallback>
    </Avatar>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="truncate text-sm font-medium">{{ stay.guestName }}</span>
        <Icon :name="gmChannelIcons[stay.channel]" class="size-3 shrink-0 text-muted-foreground" />
      </div>
      <div class="truncate text-xs text-muted-foreground">
        {{ stay.listingName }}
      </div>
    </div>
    <div class="shrink-0 text-right">
      <div class="flex items-center justify-end gap-1 text-xs" :class="meta.tone">
        <Icon :name="meta.icon" class="size-3" />
        {{ meta.detail }}
      </div>
      <div class="text-xs tabular-nums text-muted-foreground">
        {{ formatMoney(stay.total) }}
      </div>
    </div>
  </div>
</template>
