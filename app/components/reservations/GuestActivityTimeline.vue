<script setup lang="ts">
import type { ActivityEvent } from '~/components/inbox/data/conversations'

defineProps<{ events: ActivityEvent[] }>()

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })

function fmtTimestamp(iso: string): string {
  return df.format(new Date(iso))
}

const typeMeta: Record<ActivityEvent['type'], { icon: string, tone: string }> = {
  message: { icon: 'lucide:message-square', tone: 'bg-blue-500/10 text-blue-700' },
  reply: { icon: 'lucide:reply', tone: 'bg-green-500/10 text-green-700' },
  reservation: { icon: 'lucide:calendar-check', tone: 'bg-primary/10 text-primary' },
  guide_sent: { icon: 'lucide:book-open', tone: 'bg-amber-500/10 text-amber-700' },
  cleaning: { icon: 'lucide:sparkles', tone: 'bg-purple-500/10 text-purple-700' },
  task: { icon: 'lucide:check-square', tone: 'bg-slate-500/10 text-slate-700' },
  system: { icon: 'lucide:cpu', tone: 'bg-muted text-muted-foreground' },
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Activity
      </CardTitle>
    </CardHeader>
    <CardContent class="px-6 pb-4">
      <div v-if="events.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
        <Icon name="lucide:activity" class="size-8 opacity-50" />
        No activity recorded yet.
      </div>
      <ol v-else class="divide-y">
        <li
          v-for="e in events"
          :key="e.id"
          class="flex items-start gap-3 py-3"
        >
          <div class="flex size-9 items-center justify-center rounded-full shrink-0" :class="[typeMeta[e.type].tone]">
            <Icon :name="typeMeta[e.type].icon" class="size-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <div class="text-sm font-medium truncate">
                {{ e.title }}
              </div>
              <div class="text-xs text-muted-foreground whitespace-nowrap">
                {{ fmtTimestamp(e.timestamp) }}
              </div>
            </div>
            <div v-if="e.description" class="text-xs text-muted-foreground mt-0.5">
              {{ e.description }}
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              {{ e.actor }}
            </div>
          </div>
        </li>
      </ol>
    </CardContent>
  </Card>
</template>
