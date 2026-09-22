<script lang="ts" setup>
import type { RoomListingGroup } from '~/components/inbox/data/internal'
import { toast } from 'vue-sonner'

/**
 * Picks the rooms a message goes to. Multi-target on purpose: a broken pump is
 * housekeeping's problem and maintenance's problem at the same time, and
 * asking the host to forward twice is how one of the two gets forgotten.
 */
const { forwardRequest, forwardOpen, closeForward } = useMessageActions()
const { roomGroups, forwardToRooms, isMine, membersOf, roomById } = useInternalInbox()

const search = ref('')
const note = ref('')
const targetRoomIds = ref<string[]>([])

const refs = computed(() => forwardRequest.value?.refs ?? [])

/**
 * The picker draws from ALL rooms in scope, never from the room list's own
 * filters: a host who has narrowed the sidebar to unread rooms is still
 * allowed to forward somewhere quiet.
 */
const groups = computed<RoomListingGroup[]>(() => {
  const exclude = forwardRequest.value?.excludeRoomId
  const q = search.value.trim().toLowerCase()
  const prefer = forwardRequest.value?.preferListingId

  const mapped = roomGroups.value
    .map(group => ({
      ...group,
      rooms: group.rooms.filter((room) => {
        if (room.id === exclude)
          return false
        if (!q)
          return true
        return room.name.toLowerCase().includes(q)
          || group.listingName.toLowerCase().includes(q)
      }),
    }))
    .filter(group => group.rooms.length > 0)

  if (!prefer)
    return mapped
  // The listing the message came from goes first: it is the answer nine
  // times out of ten, and scrolling for it is the other one.
  return [...mapped].sort((a, b) => {
    if (a.listingId === prefer)
      return -1
    if (b.listingId === prefer)
      return 1
    return 0
  })
})

const totalRooms = computed(() => groups.value.reduce((n, g) => n + g.rooms.length, 0))

function toggleRoom(id: string) {
  targetRoomIds.value = targetRoomIds.value.includes(id)
    ? targetRoomIds.value.filter(r => r !== id)
    : [...targetRoomIds.value, id]
}

const recipientCount = computed(() => {
  const ids = new Set<string>()
  for (const roomId of targetRoomIds.value) {
    for (const member of membersOf(roomById(roomId)))
      ids.add(member.id)
  }
  return ids.size
})

// Reopening must never carry the last forward's targets or note over.
watch(forwardOpen, (open) => {
  if (open) {
    search.value = ''
    note.value = ''
    targetRoomIds.value = []
  }
})

function handleForward() {
  if (targetRoomIds.value.length === 0)
    return
  const count = forwardToRooms(targetRoomIds.value, refs.value, note.value)
  toast.success(
    count === 1
      ? `Forwarded to ${roomById(targetRoomIds.value[0]!)?.name ?? 'the room'}`
      : `Forwarded to ${count} rooms`,
  )
  closeForward()
}

function previewTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
</script>

<template>
  <Dialog v-model:open="forwardOpen">
    <DialogContent class="sm:max-w-[560px] flex flex-col gap-0 p-0 max-h-[85vh]">
      <DialogHeader class="px-6 pt-5 pb-3 border-b shrink-0">
        <DialogTitle>
          Forward {{ refs.length }} message{{ refs.length === 1 ? '' : 's' }}
        </DialogTitle>
        <DialogDescription>
          Pick the rooms that should see this. Everyone in a room gets it.
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        <!-- What is being forwarded -->
        <div class="rounded-lg border bg-muted/40 divide-y">
          <div
            v-for="item of refs.slice(0, 3)"
            :key="item.sourceId"
            class="px-3 py-2 space-y-0.5"
          >
            <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span class="font-medium text-foreground">{{ item.senderName }}</span>
              <span>{{ item.senderLabel }}</span>
              <span>· {{ previewTime(item.timestamp) }}</span>
            </div>
            <p v-if="item.content" class="line-clamp-2 text-xs">
              {{ item.content }}
            </p>
            <p v-else class="flex items-center gap-1 text-xs text-muted-foreground">
              <Icon name="lucide:camera" class="size-3 shrink-0" />
              Photo
            </p>
          </div>
          <div v-if="refs.length > 3" class="px-3 py-1.5 text-[10px] text-muted-foreground">
            and {{ refs.length - 3 }} more
          </div>
        </div>

        <!-- Room picker -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-xs">Send to</Label>
            <span class="text-[10px] text-muted-foreground">
              {{ targetRoomIds.length }} selected
            </span>
          </div>
          <Input v-model="search" placeholder="Search rooms or listings" class="h-8 text-xs" />

          <ScrollArea class="h-56 rounded-md border">
            <div class="p-1">
              <div v-if="totalRooms === 0" class="px-3 py-8 text-center text-xs text-muted-foreground">
                No rooms match that search.
              </div>
              <template v-for="group of groups" :key="group.listingId">
                <div class="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {{ group.listingName }}
                </div>
                <div
                  v-for="room of group.rooms"
                  :key="room.id"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                  @click="toggleRoom(room.id)"
                >
                  <div
                    class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                    :class="targetRoomIds.includes(room.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  >
                    <Icon v-if="targetRoomIds.includes(room.id)" name="lucide:check" class="size-3" />
                  </div>
                  <Icon name="lucide:hash" class="size-3.5 shrink-0 text-muted-foreground" />
                  <span class="text-sm truncate">{{ room.name }}</span>
                  <Badge v-if="isMine(room)" variant="secondary" class="h-4 px-1 text-[9px]">
                    Your room
                  </Badge>
                  <span class="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {{ room.memberIds.length }}
                  </span>
                </div>
              </template>
            </div>
          </ScrollArea>
        </div>

        <div class="space-y-1.5">
          <Label for="forward-note" class="text-xs">Add a note (optional)</Label>
          <Textarea
            id="forward-note"
            v-model="note"
            placeholder="What needs to happen with this?"
            class="min-h-[70px] resize-none text-sm"
          />
        </div>
      </div>

      <DialogFooter class="px-6 py-4 border-t shrink-0 sm:justify-between">
        <span class="text-xs text-muted-foreground self-center">
          <template v-if="recipientCount > 0">
            {{ recipientCount }} {{ recipientCount === 1 ? 'person' : 'people' }} will see this
          </template>
        </span>
        <div class="flex items-center gap-2">
          <Button variant="outline" @click="closeForward">
            Cancel
          </Button>
          <Button :disabled="targetRoomIds.length === 0" @click="handleForward">
            Forward
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
