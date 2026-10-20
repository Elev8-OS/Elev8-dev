<script setup lang="ts">
// The "what does this mean" icon beside a rule label.
defineProps<{ label: string, text: string }>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button type="button" class="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" :aria-label="`About ${label}`">
        <Icon name="lucide:info" class="size-3.5" aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent class="max-w-64 text-center">
      {{ text }}
    </TooltipContent>
  </Tooltip>
</template>
