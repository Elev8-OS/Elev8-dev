<script setup lang="ts">
import { computed } from 'vue'
import { SECTION_CAPABILITY } from '~/components/revenue/data/revenue-policy'
import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { usePriceLabs } from '~/composables/usePriceLabs'

/**
 * "Enforced by Elev8" on a setting the connected pricing engine cannot take
 * (§15.5). Elev8 then applies it itself when it resolves the price, so what
 * the guest sees is the same either way. Nothing renders when no engine is
 * connected, or when the engine accepts the setting.
 */
const props = defineProps<{ section: keyof typeof SECTION_CAPABILITY }>()

const pl = usePriceLabs()

const enforcedByElev8 = computed(() => {
  if (!pl.isConnected.value)
    return false
  const key = SECTION_CAPABILITY[props.section]
  const capability = pl.capabilities.value.find(c => c.key === key)
  return capability?.access === 'unsupported' || capability?.access === 'read_only'
})
</script>

<template>
  <Tooltip v-if="enforcedByElev8">
    <TooltipTrigger as-child>
      <Badge variant="outline" class="gap-1 text-[11px] font-normal">
        <Icon name="lucide:shield-check" class="size-3" />
        Enforced by Elev8
      </Badge>
    </TooltipTrigger>
    <TooltipContent class="max-w-64">
      The pricing engine cannot take this setting, so Elev8 applies it when it works out each night's price.
    </TooltipContent>
  </Tooltip>
</template>
