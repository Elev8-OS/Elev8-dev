<script lang="ts" setup>
import type { Message } from '~/components/inbox/data/conversations'

interface HostbuddySuggestionEmits {
  use: [content: string]
  dismiss: []
}

defineProps<{ suggestion: Message }>()
const emit = defineEmits<HostbuddySuggestionEmits>()
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-full border border-[#FBC800]/30 bg-[#FBC800]/10 px-3 py-1.5 text-sm transition-all hover:border-[#FBC800]/50 hover:bg-[#FBC800]/20 cursor-pointer min-w-0"
    @click="emit('use', suggestion.content)"
  >
    <Icon name="elev8:elevai" class="size-4 shrink-0" />
    <span class="shrink-0 text-[#FBC800] font-medium">ElevAI</span>
    <span class="text-muted-foreground truncate min-w-0">{{ suggestion.content }}</span>
    <Icon name="lucide:arrow-down-left" class="size-3.5 text-[#FBC800] shrink-0" />
    <button
      class="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
      @click.stop="emit('dismiss')"
    >
      <Icon name="lucide:x" class="size-3" />
    </button>
  </div>
</template>
