<script lang="ts" setup>
import type { AiSkipReason, ScheduledTemplate } from '~/components/inbox/data/conversations'
import { format } from 'date-fns'

/**
 * A skipped template, shown in the Messages tab at the moment ElevAI decided
 * to hold it back, so the host reading the thread sees the gap where it
 * happened instead of only in the reservation timeline.
 */
const props = defineProps<{
  template: ScheduledTemplate & { skipReason: AiSkipReason }
}>()

const open = ref(false)

const timeLabel = computed(() => format(new Date(props.template.skipReason.decidedAt), 'HH:mm'))
</script>

<template>
  <div class="flex justify-center" data-testid="thread-skip-notice">
    <div class="flex max-w-[75%] items-start gap-2 rounded-lg border border-[#C8A84B]/30 bg-muted/40 px-3 py-2 text-xs">
      <Icon name="elev8:elevai" class="mt-0.5 size-3.5 shrink-0" />
      <div class="min-w-0">
        <p>
          <span class="font-medium">ElevAI skipped {{ template.label }}</span>
          <span class="text-[10px] text-muted-foreground"> · {{ timeLabel }}</span>
        </p>
        <button
          type="button"
          class="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          @click="open = true"
        >
          Why was this skipped?
          <Icon name="lucide:arrow-up-right" class="size-2.5" />
        </button>
      </div>
    </div>
    <InboxAiSkipReasonDialog
      v-model:open="open"
      :reason="template.skipReason"
      :template-label="template.label"
      :template-content="template.content"
    />
  </div>
</template>
