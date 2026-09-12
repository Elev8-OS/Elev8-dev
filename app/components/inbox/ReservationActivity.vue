<script lang="ts" setup>
import type { ActivityEvent, AiSkipReason, PhoneCall, Reservation } from '~/components/inbox/data/conversations'
import { format, isToday } from 'date-fns'
import { toast } from 'vue-sonner'

interface ReservationActivityProps {
  activity: ActivityEvent[]
  reservation: Reservation
  phoneCalls?: PhoneCall[]
}

const props = defineProps<ReservationActivityProps>()

const dotColorMap: Record<string, string> = {
  gold: 'bg-foreground',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  gray: 'bg-muted-foreground',
}

function formatTimestamp(ts: string) {
  const date = new Date(ts)
  if (isToday(date)) {
    return `Today, ${format(date, 'h:mm a')}`
  }
  return format(date, 'EEEE, d MMM yyyy, h:mm a')
}

const reversedActivity = computed(() =>
  props.activity
    .filter(e => e.type !== 'message' && e.type !== 'reply')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
)

const generatedEvents = computed(() => {
  const events: {
    id: string
    title: string
    description: string
    timestamp: string
    type: string
    colorDot: string
    channel: string | undefined
    _canSend?: boolean
    _templateLabel?: string
    _templateContent?: string
    _skipReason?: AiSkipReason
  }[] = []

  const hasExistingGuideSent = props.activity.some(e => e.type === 'guide_sent')

  if (props.reservation.guestDetails?.phone) {
    events.push({
      id: 'sys-verified',
      title: 'Guest is Verified',
      description: 'Guest has completed their information',
      timestamp: props.reservation.checkIn,
      type: 'system',
      colorDot: 'green',
      channel: undefined,
    })
  }

  if (!hasExistingGuideSent) {
    events.push({
      id: 'sys-guide-sent',
      title: 'Guest Guide Sent',
      description: 'Property guide and house rules have been sent to guest',
      timestamp: props.reservation.checkIn,
      type: 'guide_sent',
      colorDot: 'blue',
      channel: undefined,
    })
  }

  events.push({
    id: 'sys-checkout',
    title: 'Check-out',
    description: `Guest checks out at ${new Date(props.reservation.checkOut).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`,
    timestamp: props.reservation.checkOut,
    type: 'system',
    colorDot: 'gray',
    channel: undefined,
  })

  if (props.reservation.scheduledTemplates) {
    for (const tpl of props.reservation.scheduledTemplates) {
      if (tpl.status === 'pending') {
        events.push({
          id: `tpl-${tpl.id}`,
          title: `Scheduled — ${tpl.label}`,
          description: `Will be sent ${new Date(tpl.scheduledFor).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric' })}`,
          timestamp: tpl.scheduledFor,
          type: 'system',
          colorDot: 'gray',
          channel: undefined,
        })
      }
      else if (tpl.status === 'skipped' && tpl.skipReason) {
        events.push({
          id: `tpl-${tpl.id}`,
          title: `ElevAI skipped — ${tpl.label}`,
          description: tpl.skipReason.summary,
          timestamp: tpl.skipReason.decidedAt,
          type: 'ai_skip',
          colorDot: 'gold',
          channel: undefined,
          _canSend: true,
          _templateLabel: tpl.label,
          _templateContent: tpl.content,
          _skipReason: tpl.skipReason,
        })
      }
      else if (tpl.status === 'cancelled') {
        events.push({
          id: `tpl-${tpl.id}`,
          title: `Already covered — ${tpl.label}`,
          description: 'Already discussed in previous conversation',
          timestamp: tpl.scheduledFor,
          type: 'system',
          colorDot: 'gray',
          channel: undefined,
          _canSend: true,
          _templateLabel: tpl.label,
          _templateContent: tpl.content,
        })
      }
    }
  }

  return events
})

const sentTemplates = ref(new Set<string>())

/** Id of the skipped template whose explanation dialog is open, if any. */
const openSkipId = ref<string | null>(null)

function sendTemplate(event: any) {
  sentTemplates.value = new Set([...sentTemplates.value, event.id])
  toast.success(`${event._templateLabel} sent to guest`)
}

const allActivities = computed(() => {
  const items = [
    ...reversedActivity.value,
    ...(props.phoneCalls ?? []).filter(c => c.summary).map(c => ({
      id: c.id,
      title: 'Phone call',
      description: c.summary!,
      timestamp: c.timestamp,
      type: 'phone_call' as const,
      colorDot: 'green' as const,
      channel: 'Phone' as const,
    })),
    ...generatedEvents.value,
  ]
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
})
</script>

<template>
  <div>
    <h3 class="text-sm font-medium mb-3">
      Timeline
    </h3>

    <div class="space-y-0">
      <div
        v-for="(event, i) of allActivities"
        :key="event.id"
        class="flex gap-3 pb-4"
      >
        <div class="flex flex-col items-center">
          <div
            v-if="event.type === 'ai_skip'"
            class="flex size-2.5 shrink-0 items-center justify-center rounded-full bg-[#C8A84B] mt-1.5"
          />
          <div v-else class="size-2.5 shrink-0 rounded-full mt-1.5" :class="[event.type === 'phone_call' ? 'bg-green-500' : dotColorMap[event.colorDot] ?? 'bg-muted-foreground']" />
          <div v-if="i < allActivities.length - 1" class="w-px flex-1 bg-border" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-medium">{{ event.title }}</span>
            <span
              v-if="event.type === 'ai_skip'"
              class="inline-flex items-center gap-0.5 rounded border border-[#C8A84B]/40 px-1 py-px text-[9px] font-medium text-[#8a7223] dark:text-[#C8A84B]"
            >
              <Icon name="lucide:sparkles" class="size-2.5" />
              ElevAI
            </span>
          </div>
          <div class="text-xs text-muted-foreground">
            {{ event.description }}
          </div>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[10px] text-muted-foreground">{{ formatTimestamp(event.timestamp) }}</span>
            <span v-if="event.channel" class="text-[10px] text-muted-foreground">via {{ event.channel }}</span>
          </div>
          <template v-if="(event as any)._skipReason">
            <button
              type="button"
              class="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              @click="openSkipId = event.id"
            >
              Why was this skipped?
              <Icon name="lucide:arrow-up-right" class="size-2.5" />
            </button>
            <InboxAiSkipReasonDialog
              :open="openSkipId === event.id"
              :reason="(event as any)._skipReason"
              :template-label="(event as any)._templateLabel"
              :template-content="(event as any)._templateContent"
              :can-send="!sentTemplates.has(event.id)"
              @update:open="(v: boolean) => openSkipId = v ? event.id : null"
              @send="sendTemplate(event)"
            />
          </template>

          <button
            v-if="(event as any)._canSend && !sentTemplates.has(event.id)"
            class="mt-2 block text-xs text-primary hover:text-primary/80 transition-colors"
            @click="sendTemplate(event)"
          >
            {{ (event as any)._skipReason ? 'Send it anyway' : 'Send now' }}
          </button>
          <span
            v-else-if="(event as any)._canSend && sentTemplates.has(event.id)"
            class="mt-2 block text-xs text-green-600"
          >
            Sent ✓
          </span>
        </div>
      </div>

      <div v-if="allActivities.length === 0" class="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
        <Icon name="lucide:activity" class="size-8" />
        <p class="text-sm">
          No activity yet
        </p>
      </div>
    </div>
  </div>
</template>
