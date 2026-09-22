<script lang="ts" setup>
import { format, formatDistanceToNow, isToday } from 'date-fns'

const {
  activeRooms,
  activeListing,
  selectedRoomId,
  selectRoom,
  unreadFor,
  lastMessagePreview,
  lastMessageAt,
  isMine,
  clearRoomFilters,
  isLoading,
} = useInternalInbox()

function timeLabel(iso: string | undefined) {
  if (!iso)
    return ''
  const date = new Date(iso)
  return isToday(date) ? format(date, 'HH:mm') : formatDistanceToNow(date, { addSuffix: true })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- One listing is always open, so its name belongs in the header and the
         rows below need no group headers to say which listing they are on. -->
    <div class="flex h-[56px] shrink-0 items-center px-4">
      <div class="min-w-0">
        <h1 class="truncate text-xl font-bold">
          Rooms
        </h1>
        <Skeleton v-if="isLoading" class="mt-1 h-3 w-40" />
        <p v-else-if="activeListing" class="truncate text-xs text-muted-foreground">
          {{ activeListing.listingName }}
        </p>
      </div>
    </div>
    <Separator />

    <ScrollArea class="min-h-0 flex-1">
      <div class="flex flex-col gap-2 p-4">
        <template v-if="isLoading">
          <div
            v-for="n of 5"
            :key="n"
            class="space-y-2 rounded-lg border p-3"
            data-testid="room-list-skeleton"
          >
            <Skeleton class="h-3.5 w-32" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-2.5 w-16" />
          </div>
        </template>

        <div v-else-if="activeRooms.length === 0" class="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Icon name="lucide:users" class="size-8" />
          <p class="text-sm">
            {{ activeListing ? 'No rooms match this search.' : 'No listings match these filters.' }}
          </p>
          <Button variant="outline" size="sm" @click="clearRoomFilters">
            Clear filters
          </Button>
        </div>

        <button
          v-for="room of isLoading ? [] : activeRooms"
          :key="room.id"
          type="button"
          class="flex w-full flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent"
          :class="selectedRoomId === room.id && 'bg-muted'"
          @click="selectRoom(room.id)"
        >
          <div class="flex w-full items-center gap-1.5">
            <Icon name="lucide:hash" class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="truncate font-medium">{{ room.name }}</span>
            <Badge v-if="isMine(room)" variant="secondary" class="h-4 shrink-0 px-1 text-[9px]">
              You
            </Badge>
            <Badge v-if="unreadFor(room.id)" class="ml-auto h-4 shrink-0 px-1.5 text-[10px]">
              {{ unreadFor(room.id) }}
            </Badge>
            <span
              v-else-if="lastMessageAt(room.id)"
              class="ml-auto shrink-0 text-[10px] text-muted-foreground"
            >
              {{ timeLabel(lastMessageAt(room.id)) }}
            </span>
          </div>
          <p v-if="lastMessagePreview(room.id).text" class="flex items-start gap-1 text-xs text-muted-foreground">
            <Icon
              v-if="lastMessagePreview(room.id).icon"
              :name="lastMessagePreview(room.id).icon!"
              class="mt-0.5 size-3 shrink-0"
            />
            <span class="line-clamp-2">{{ lastMessagePreview(room.id).text }}</span>
          </p>
          <p v-else class="text-xs italic text-muted-foreground">
            No messages yet
          </p>
          <span class="text-[10px] text-muted-foreground">
            {{ room.memberIds.length }} {{ room.memberIds.length === 1 ? 'member' : 'members' }}
          </span>
        </button>
      </div>
    </ScrollArea>
  </div>
</template>
