<script lang="ts" setup>
import type { ForwardedRef } from '~/components/inbox/data/internal'

/**
 * A forwarded message as it appears inside a room. It is a snapshot taken at
 * forward time, so it renders its own copy of the text rather than reading
 * back through `sourceId`: a later edit upstream must not change what the
 * room was asked to act on.
 *
 * ⚠️ The card sets its OWN surface and text colour (`bg-card` /
 * `text-card-foreground`), and must keep doing so. It sits inside two very
 * different bubbles: `bg-muted` on somebody else's message, and
 * `bg-primary text-primary-foreground` on your own. It used to be
 * `bg-background/60` with no text colour, so inside your own bubble it
 * inherited `text-primary-foreground`, which is a near-white in ten of the
 * eleven themes (only `.theme-yellow` sets a dark one). Your own forwards were
 * therefore near-white text on a near-white card everywhere but that theme.
 * An opaque card also makes the primary left rule visible on both.
 */
interface ForwardedCardProps {
  items: ForwardedRef[]
}

defineProps<ForwardedCardProps>()

const { selectedConversationId, inboxView } = useInbox()
const { openImage } = useImageViewer()

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Jumping back to the guest thread the message came from. Only offered for a
 * guest forward, and only when the conversation still exists.
 */
function openSource(item: ForwardedRef) {
  if (item.sourceKind !== 'guest' || !item.conversationId)
    return
  selectedConversationId.value = item.conversationId
  inboxView.value = 'conversations'
}
</script>

<template>
  <div class="divide-y rounded-lg border border-l-2 border-l-primary bg-card text-card-foreground">
    <div
      v-for="item of items"
      :key="item.sourceId"
      class="space-y-1 px-3 py-2"
    >
      <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon name="lucide:forward" class="size-3 shrink-0" />
        <span class="font-medium text-foreground">{{ item.senderName }}</span>
        <span>{{ item.senderLabel }}</span>
        <span v-if="item.channel">· via {{ item.channel }}</span>
        <span>· {{ timeLabel(item.timestamp) }}</span>
      </div>
      <button
        v-if="item.mediaUrl"
        type="button"
        class="block w-full cursor-zoom-in overflow-hidden rounded-md"
        :aria-label="`View photo from ${item.senderName}`"
        @click="openImage({
          url: item.mediaUrl,
          senderName: item.senderName,
          caption: item.content,
          timestamp: item.timestamp,
        })"
      >
        <img :src="item.mediaUrl" :alt="item.content" class="max-h-40 w-full object-cover">
      </button>
      <p v-if="item.content" class="whitespace-pre-line text-xs">
        {{ item.content }}
      </p>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-muted-foreground truncate">{{ item.contextLabel }}</span>
        <button
          v-if="item.sourceKind === 'guest' && item.conversationId"
          type="button"
          class="ml-auto shrink-0 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          @click="openSource(item)"
        >
          Open thread
        </button>
      </div>
    </div>
  </div>
</template>
