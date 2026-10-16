<script setup lang="ts">
import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { useActivityReport } from '~/composables/useActivityReport'

/** Marks a person who works for several tenants. Renders nothing for everyone else. */
const props = defineProps<{ userId: string }>()

const { tenantsFor, activeTenantId } = useActivityReport()

const tenants = computed(() => tenantsFor(props.userId))
const names = computed(() => tenants.value.map(t => t.name).join(', '))
const label = computed(() => `Assigned to ${tenants.value.length} tenants: ${names.value}`)
</script>

<template>
  <TooltipProvider v-if="tenants.length" :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <Badge variant="outline" class="shrink-0 gap-1 font-normal" tabindex="0" :aria-label="label">
          <Icon name="lucide:arrow-right-left" class="size-3" />
          {{ tenants.length }} tenants
        </Badge>
      </TooltipTrigger>
      <TooltipContent class="max-w-64">
        <p class="font-medium">
          Works for {{ tenants.length }} tenants
        </p>
        <ul class="mt-1 space-y-0.5">
          <li v-for="t in tenants" :key="t.id">
            {{ t.name }}<span v-if="t.id === activeTenantId" class="opacity-70"> (active)</span>
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
