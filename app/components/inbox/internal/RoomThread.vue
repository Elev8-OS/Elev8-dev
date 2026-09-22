<script lang="ts" setup>
import { format, isToday, isYesterday } from 'date-fns'
import { taskAssigneeForRoom } from '~/components/inbox/data/internal'

const {
  selectedRoom,
  selectedRoomMessages,
  selectedMessages,
  selectedMessageIds,
  clearMessageSelection,
  sendInternalMessage,
  replyDraft,
  membersOf,
  isMine,
  refsFromInternalMessages,
  isLoading,
} = useInternalInbox()
const { openForward, openTask } = useMessageActions()

const draft = ref('')
const scrollRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const attachedImage = ref<string | null>(null)
const attachedImageDims = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

/** A photo on its own is a valid message: it often says more than a caption. */
const canSend = computed(() => draft.value.trim().length > 0 || !!attachedImage.value)

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  const url = URL.createObjectURL(file)
  attachedImage.value = url
  const img = new Image()
  img.onload = () => {
    attachedImageDims.value = `${img.naturalWidth} × ${img.naturalHeight}`
  }
  img.src = url
  // Cleared so picking the same file twice in a row still fires a change.
  if (fileInputRef.value)
    fileInputRef.value.value = ''
}

function removeAttachedImage() {
  attachedImage.value = null
  attachedImageDims.value = null
}

const members = computed(() => membersOf(selectedRoom.value))

function dateLabel(iso: string) {
  const date = new Date(iso)
  if (isToday(date))
    return 'Today'
  if (isYesterday(date))
    return 'Yesterday'
  return format(date, 'EEEE, d MMM yyyy')
}

function handleSend() {
  const room = selectedRoom.value
  if (!room || !canSend.value)
    return
  sendInternalMessage(room.id, draft.value, {
    replyTo: replyDraft.value,
    mediaUrl: attachedImage.value,
    mediaDims: attachedImageDims.value,
  })
  draft.value = ''
  replyDraft.value = null
  // The object URL is deliberately NOT revoked: the message now renders it.
  attachedImage.value = null
  attachedImageDims.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

function forwardSelection() {
  const room = selectedRoom.value
  if (!room)
    return
  openForward({
    refs: refsFromInternalMessages(selectedMessages.value, room),
    excludeRoomId: room.id,
    preferListingId: room.listingId,
  })
}

function taskFromSelection() {
  const room = selectedRoom.value
  if (!room)
    return
  openTask({
    refs: refsFromInternalMessages(selectedMessages.value, room),
    listingName: room.listingName,
    roomId: room.id,
    assignee: taskAssigneeForRoom(room.roomKey),
  })
}

/**
 * Pin the thread to the newest message. Without it a message you just sent
 * lands below the fold, which reads as nothing having happened, and the
 * sending and failed states are exactly the ones you need to see.
 *
 * reka-ui's ScrollArea scrolls an inner viewport, not its own root, so the
 * element to move is the one carrying `data-reka-scroll-area-viewport`.
 */
function scrollToLatest() {
  const root = scrollRef.value
  const el = (root && '$el' in root ? root.$el : root) as HTMLElement | undefined
  const viewport = el?.querySelector<HTMLElement>('[data-reka-scroll-area-viewport]')
  if (viewport)
    viewport.scrollTop = viewport.scrollHeight
}

watch(
  [() => selectedRoomMessages.value.length, selectedRoom],
  async () => {
    await nextTick()
    scrollToLatest()
  },
  { immediate: true },
)

// Clearing the draft reply when the room changes: a quote belongs to the
// room it was taken from.
watch(selectedRoom, () => {
  draft.value = ''
  removeAttachedImage()
})
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Alternating sides, so the skeleton reads as a conversation rather than
         a stack of bars. -->
    <template v-if="isLoading">
      <div class="flex h-[56px] shrink-0 items-center gap-2 border-b px-4">
        <Skeleton class="size-4 shrink-0 rounded" />
        <div class="space-y-1.5">
          <Skeleton class="h-3.5 w-28" />
          <Skeleton class="h-3 w-44" />
        </div>
      </div>
      <div class="flex-1 space-y-4 p-4" data-testid="thread-skeleton">
        <div
          v-for="n of 4"
          :key="n"
          class="flex gap-2.5"
          :class="n % 2 === 0 ? 'justify-end' : 'justify-start'"
        >
          <Skeleton v-if="n % 2 !== 0" class="mt-1 size-8 shrink-0 rounded-full" />
          <div class="max-w-[60%] space-y-1.5">
            <Skeleton class="h-3 w-32" />
            <Skeleton class="h-12" :class="n % 2 === 0 ? 'w-56' : 'w-64'" />
          </div>
        </div>
      </div>
      <div class="shrink-0 border-t p-3">
        <Skeleton class="h-16 w-full" />
      </div>
    </template>

    <template v-else-if="selectedRoom">
      <div class="flex h-[56px] shrink-0 items-center gap-2 border-b px-4">
        <Icon name="lucide:hash" class="size-4 shrink-0 text-muted-foreground" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="truncate text-sm font-semibold">
              {{ selectedRoom.name }}
            </h2>
            <Badge v-if="isMine(selectedRoom)" variant="secondary" class="h-4 px-1 text-[9px]">
              Your room
            </Badge>
          </div>
          <p class="truncate text-xs text-muted-foreground">
            {{ selectedRoom.listingName }}
          </p>
        </div>
        <div class="ml-auto flex items-center -space-x-2">
          <Avatar v-for="member of members.slice(0, 4)" :key="member.id" class="size-6 border-2 border-background">
            <AvatarFallback class="text-[9px]">
              {{ member.initials }}
            </AvatarFallback>
          </Avatar>
          <span v-if="members.length > 4" class="pl-3 text-[10px] text-muted-foreground">
            +{{ members.length - 4 }}
          </span>
        </div>
      </div>

      <ScrollArea ref="scrollRef" class="min-h-0 flex-1">
        <div class="flex flex-col gap-4 p-4">
          <div v-if="selectedRoomMessages.length === 0" class="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Icon name="lucide:message-square-plus" class="size-8" />
            <p class="text-sm">
              Nothing here yet. Say something, or forward a guest message in.
            </p>
          </div>

          <template v-for="(message, index) of selectedRoomMessages" :key="message.id">
            <div
              v-if="index === 0 || dateLabel(message.createdAt) !== dateLabel(selectedRoomMessages[index - 1]!.createdAt)"
              class="flex items-center justify-center"
            >
              <Badge variant="outline" class="text-xs text-muted-foreground">
                {{ dateLabel(message.createdAt) }}
              </Badge>
            </div>
            <InboxInternalRoomMessage :message="message" :room="selectedRoom" />
          </template>
        </div>
      </ScrollArea>

      <!-- Selection bar -->
      <div v-if="selectedMessageIds.length > 0" class="flex shrink-0 items-center gap-2 border-t bg-muted/40 px-4 py-2">
        <span class="text-xs font-medium">
          {{ selectedMessageIds.length }} selected
        </span>
        <Button size="sm" variant="outline" class="h-7 text-xs" @click="forwardSelection">
          <Icon name="lucide:forward" class="size-3.5" />
          Forward
        </Button>
        <Button size="sm" variant="outline" class="h-7 text-xs" @click="taskFromSelection">
          <Icon name="lucide:list-checks" class="size-3.5" />
          Create task
        </Button>
        <Button size="sm" variant="ghost" class="ml-auto h-7 text-xs" @click="clearMessageSelection">
          Clear
        </Button>
      </div>

      <!-- Composer -->
      <div class="shrink-0 border-t p-3">
        <div v-if="replyDraft" class="mb-2 flex items-start gap-2 rounded-md border-l-2 border-primary bg-muted/50 px-2.5 py-1.5">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-medium">
              Replying to {{ replyDraft.senderName }}
            </p>
            <p class="truncate text-[11px] text-muted-foreground">
              {{ replyDraft.excerpt }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Cancel reply"
            @click="replyDraft = null"
          >
            <Icon name="lucide:x" class="size-3.5" />
          </button>
        </div>
        <div v-if="attachedImage" class="mb-2 inline-flex items-start gap-2 rounded-md border p-1.5">
          <img :src="attachedImage" alt="Attached photo" data-testid="composer-photo" class="size-14 rounded object-cover">
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-muted-foreground">{{ attachedImageDims ?? 'Photo' }}</span>
            <button
              type="button"
              class="inline-flex w-fit items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
              aria-label="Remove photo"
              @click="removeAttachedImage"
            >
              <Icon name="lucide:x" class="size-3" />
              Remove
            </button>
          </div>
        </div>

        <Textarea
          v-model="draft"
          :placeholder="`Message ${selectedRoom.name}`"
          class="min-h-[64px] resize-none text-sm"
          @keydown="handleKeydown"
        />
        <div class="mt-2 flex items-center justify-between gap-2">
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileSelect"
          >
          <Button
            variant="ghost"
            size="sm"
            class="h-7 shrink-0 px-2 text-muted-foreground"
            aria-label="Attach a photo"
            @click="fileInputRef?.click()"
          >
            <Icon name="lucide:paperclip" class="size-3.5" />
          </Button>
          <span class="truncate text-[10px] text-muted-foreground">
            Internal only. Guests never see this.
          </span>
          <Button size="sm" class="shrink-0" :disabled="!canSend" @click="handleSend">
            <Icon name="lucide:send" class="size-3.5" />
            Send
          </Button>
        </div>
      </div>
    </template>

    <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Icon name="lucide:hash" class="size-10" />
      <p class="text-sm">
        Select a room
      </p>
    </div>
  </div>
</template>
