<script lang="ts" setup>
import type { ExtensionEvent } from '~/components/reservations/data/extension-events'
import { format } from 'date-fns'
import { cn } from '~/lib/utils'

// A system line in the thread for a step of the stay's extension (created, paid,
// cancelled). Read only: the money and the cancel live on the reservation panel.
defineProps<{
  event: ExtensionEvent
}>()
</script>

<template>
  <div class="flex justify-center" data-testid="thread-extension-event">
    <div
      :class="cn(
        'flex max-w-[85%] items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        event.tone === 'pending' && 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        event.tone === 'ok' && 'bg-muted/50 text-foreground',
        event.tone === 'muted' && 'border-dashed text-muted-foreground',
      )"
    >
      <Icon :name="event.kind === 'paid' ? 'lucide:circle-check' : event.kind === 'cancelled' ? 'lucide:calendar-x' : 'lucide:calendar-plus'" class="mt-0.5 size-4 shrink-0" />
      <div class="min-w-0">
        <p class="font-medium">
          {{ event.title }}
        </p>
        <p class="text-[11px] opacity-80">
          {{ event.detail }}
        </p>
      </div>
      <span class="shrink-0 pt-0.5 text-[10px] opacity-70">{{ format(new Date(event.timestamp), 'HH:mm') }}</span>
    </div>
  </div>
</template>
