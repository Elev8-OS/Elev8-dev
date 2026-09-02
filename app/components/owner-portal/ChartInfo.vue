<script setup lang="ts">
// Small "what does this mean?" hint beside a chart title. The charts use the
// terms an owner sees on every other PMS report — Gross, Net, ADR — and this
// carries the plain-language definition without cluttering the card.

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'

defineProps<{ text: string }>()
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          aria-label="What this means"
        >
          <Icon name="lucide:info" class="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent class="max-w-64 text-xs">
        {{ text }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
