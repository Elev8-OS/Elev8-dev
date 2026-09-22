<script lang="ts" setup>
import type { InternalMessage, InternalRoom } from '~/components/inbox/data/internal'
import { format, formatDistanceToNow, isToday } from 'date-fns'
import { toast } from 'vue-sonner'
import { replyRefFrom, taskAssigneeForRoom } from '~/components/inbox/data/internal'
import { cn } from '~/lib/utils'

interface RoomMessageProps {
  message: InternalMessage
  room: InternalRoom
}

const props = defineProps<RoomMessageProps>()

const {
  replyDraft,
  retryInternalMessage,
  discardFailedMessage,
  selectedMessageIds,
  selectedMessages,
  toggleMessageSelection,
  clearMessageSelection,
  refsFromInternalMessages,
} = useInternalInbox()
const { openForward, openTask } = useMessageActions()
const { openImage } = useImageViewer()
const { currentUser } = useCurrentDashboardUser()

const isMine = computed(() => props.message.authorId === currentUser.value?.id)
const isSystem = computed(() => !!props.message.systemKind)
const isSelected = computed(() => selectedMessageIds.value.includes(props.message.id))
const selectionMode = computed(() => selectedMessageIds.value.length > 0)

/**
 * The actions run on the selection when there is one, and on the clicked
 * message otherwise. Same rule in both threads, see `MessageContextMenu`.
 */
const actionTargets = computed(() =>
  selectionMode.value && isSelected.value
    ? selectedMessages.value
    : [props.message],
)

function handleForward() {
  openForward({
    refs: refsFromInternalMessages(actionTargets.value, props.room),
    excludeRoomId: props.room.id,
    preferListingId: props.room.listingId,
  })
}

function handleTask() {
  openTask({
    refs: refsFromInternalMessages(actionTargets.value, props.room),
    listingName: props.room.listingName,
    roomId: props.room.id,
    assignee: taskAssigneeForRoom(props.room.roomKey),
  })
}

function handleReply() {
  replyDraft.value = replyRefFrom(props.message)
}

function handleCopy() {
  const text = actionTargets.value.map(m => m.content).filter(Boolean).join('\n\n')
  if (!text) {
    // Nothing to put on the clipboard, most likely a photo with no caption.
    toast.info('No text to copy')
    return
  }
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}

const isSending = computed(() => props.message.sendStatus === 'sending')
const hasFailed = computed(() => props.message.sendStatus === 'failed')

/**
 * The photo itself can fail to load even after the message lands: a blob URL
 * does not survive a reload, so a room reopened later would otherwise show a
 * broken image icon with no explanation.
 */
const photoBroken = ref(false)
watch(() => props.message.mediaUrl, () => {
  photoBroken.value = false
})

const statusLabel = computed(() => {
  if (isSending.value)
    return props.message.mediaUrl ? 'Uploading photo…' : 'Sending…'
  return ''
})

function viewPhoto() {
  if (!props.message.mediaUrl || photoBroken.value)
    return
  openImage({
    url: props.message.mediaUrl,
    senderName: isMine.value ? 'You' : props.message.authorName,
    caption: props.message.content,
    timestamp: props.message.createdAt,
    dims: props.message.mediaDims,
  })
}

function handleRetry() {
  retryInternalMessage(props.room.id, props.message.id)
}

function handleDiscard() {
  discardFailedMessage(props.room.id, props.message.id)
}

const timeLabel = computed(() => {
  const date = new Date(props.message.createdAt)
  return isToday(date) ? formatDistanceToNow(date, { addSuffix: true }) : format(date, 'HH:mm')
})
</script>

<template>
  <!-- A task notice is a record, not a message: nothing to reply to, forward or
       select, so it renders outside the context menu entirely. -->
  <div v-if="isSystem" class="flex justify-center">
    <div class="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Icon name="lucide:list-checks" class="size-3.5" />
      <span class="font-medium text-foreground">{{ message.authorName }}</span>
      opened task
      <NuxtLink to="/tasks" class="font-medium text-foreground underline-offset-2 hover:underline">
        {{ message.taskRef?.id }}
      </NuxtLink>
      · {{ message.taskRef?.title }}
    </div>
  </div>

  <InboxMessageContextMenu
    v-else
    kind="internal"
    :selection-mode="selectionMode"
    :is-selected="isSelected"
    :selected-count="selectedMessageIds.length"
    @forward="handleForward"
    @task="handleTask"
    @reply="handleReply"
    @start-select="toggleMessageSelection(message.id)"
    @toggle-select="toggleMessageSelection(message.id)"
    @clear-select="clearMessageSelection"
    @copy="handleCopy"
  >
    <div :class="cn('flex gap-2.5', isMine ? 'justify-end' : 'justify-start')">
      <button
        v-if="selectionMode"
        type="button"
        class="mt-2 flex size-4 shrink-0 items-center justify-center self-start rounded-[4px] border"
        :class="isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
        :aria-label="isSelected ? 'Remove from selection' : 'Add to selection'"
        @click="toggleMessageSelection(message.id)"
      >
        <Icon v-if="isSelected" name="lucide:check" class="size-3" />
      </button>

      <Avatar v-if="!isMine" class="mt-1 size-8 shrink-0">
        <AvatarFallback class="text-xs">
          {{ message.authorInitials }}
        </AvatarFallback>
      </Avatar>

      <div class="flex max-w-[78%] flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium">{{ isMine ? 'You' : message.authorName }}</span>
          <span v-if="message.authorRole" class="text-[10px] text-muted-foreground">{{ message.authorRole }}</span>
          <span class="text-[10px] text-muted-foreground">{{ timeLabel }}</span>
        </div>

        <div
          :class="cn(
            'rounded-2xl px-3 py-2 text-sm space-y-2 transition-opacity',
            isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
            isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            isSending && 'opacity-60',
            hasFailed && 'ring-1 ring-destructive',
          )"
        >
          <div
            v-if="message.replyTo"
            class="rounded-md border-l-2 border-current/40 bg-background/40 px-2 py-1"
          >
            <p class="text-[10px] font-medium opacity-80">
              {{ message.replyTo.senderName }}
            </p>
            <p class="text-[11px] opacity-70">
              {{ message.replyTo.excerpt }}
            </p>
          </div>

          <InboxInternalForwardedCard v-if="message.forwarded?.length" :items="message.forwarded" />

          <div v-if="message.mediaUrl" class="overflow-hidden rounded-lg">
            <div
              v-if="photoBroken"
              class="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-xs opacity-80"
              data-testid="photo-unavailable"
            >
              <Icon name="lucide:image-off" class="size-4 shrink-0" />
              Photo unavailable
            </div>
            <div v-else class="relative">
              <!-- A button, not a bare img with a handler: the photo has to be
                   reachable by keyboard and announce what it does. -->
              <button
                type="button"
                class="block w-full cursor-zoom-in"
                :aria-label="`View photo${message.content ? `: ${message.content}` : ''}`"
                @click="viewPhoto"
              >
                <img
                  :src="message.mediaUrl"
                  :alt="message.content || 'Attached photo'"
                  class="max-h-56 w-full object-cover"
                  @error="photoBroken = true"
                >
              </button>
              <!-- The upload is what takes the time, so the spinner sits on the
                   photo rather than only in the status line below. -->
              <div
                v-if="isSending"
                class="absolute inset-0 flex items-center justify-center bg-background/50"
                data-testid="photo-uploading"
              >
                <Icon name="lucide:loader-2" class="size-5 animate-spin" />
              </div>
            </div>
            <div v-if="message.mediaDims && !photoBroken" class="flex items-center gap-1 pt-1 text-[10px] opacity-70">
              <Icon name="lucide:camera" class="size-3" />
              {{ message.mediaDims }}
            </div>
          </div>

          <p v-if="message.content" class="whitespace-pre-line">
            {{ message.content }}
          </p>
        </div>

        <div
          v-if="isSending"
          class="flex items-center gap-1 self-end text-[10px] text-muted-foreground"
        >
          <Icon name="lucide:loader-2" class="size-2.5 animate-spin" />
          {{ statusLabel }}
        </div>
        <!-- A failed message keeps its place in the room: dropping it would
             lose what was typed, and a photo picked from a file dialog cannot
             be recovered by retyping. -->
        <div
          v-else-if="hasFailed"
          class="flex items-center gap-1.5 self-end text-[10px] text-destructive"
        >
          <Icon name="lucide:alert-circle" class="size-2.5 shrink-0" />
          {{ message.mediaUrl ? 'Photo failed to send' : 'Failed to send' }}
          <button type="button" class="underline underline-offset-2 hover:text-destructive/80" @click="handleRetry">
            Retry
          </button>
          <button type="button" class="underline underline-offset-2 hover:text-destructive/80" @click="handleDiscard">
            Discard
          </button>
        </div>
      </div>
    </div>
  </InboxMessageContextMenu>
</template>
