<script lang="ts" setup>
import { GENERAL_ROOM_KEY, isTaskOpen } from '~/components/inbox/data/internal'

const { selectedRoom, membersOf, roomTasks, isLoading } = useInternalInbox()
const { currentUser } = useCurrentDashboardUser()
const { roles } = useRoles()

const members = computed(() => membersOf(selectedRoom.value))

const openTasks = computed(() => roomTasks.value.filter(isTaskOpen))

/**
 * General is the room everybody at the property is in, so it answers for the
 * whole listing rather than for one role. The heading says which it is.
 */
const isGeneralRoom = computed(() => selectedRoom.value?.roomKey === GENERAL_ROOM_KEY)

function roleName(roleId: string) {
  return roles.value.find(r => r.id === roleId)?.name ?? roleId
}

const statusClass: Record<string, string> = {
  'todo': 'bg-muted text-muted-foreground',
  'backlog': 'bg-muted text-muted-foreground',
  'in progress': 'bg-secondary text-secondary-foreground',
  'done': 'bg-green-500/15 text-green-600',
  'canceled': 'bg-muted text-muted-foreground',
}

function dueLabel(due: string) {
  return new Date(due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <template v-if="isLoading">
      <div class="flex h-[56px] shrink-0 items-center px-4">
        <Skeleton class="h-3.5 w-16" />
      </div>
      <Separator />
      <div class="space-y-5 p-4" data-testid="room-panel-skeleton">
        <div class="space-y-1.5">
          <Skeleton class="h-3 w-14" />
          <Skeleton class="h-4 w-48" />
        </div>
        <div class="space-y-2">
          <Skeleton class="h-3 w-16" />
          <div v-for="n of 3" :key="n" class="flex items-center gap-2 rounded-lg border p-2">
            <Skeleton class="size-7 shrink-0 rounded-full" />
            <div class="space-y-1.5">
              <Skeleton class="h-3 w-28" />
              <Skeleton class="h-2.5 w-20" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="selectedRoom">
      <div class="flex h-[56px] shrink-0 items-center px-4">
        <h2 class="text-sm font-semibold">
          Room
        </h2>
      </div>
      <Separator />

      <ScrollArea class="min-h-0 flex-1">
        <div class="space-y-5 p-4">
          <div class="space-y-1">
            <p class="text-xs font-medium text-muted-foreground">
              Listing
            </p>
            <NuxtLink
              :to="`/listings/${selectedRoom.listingId}`"
              class="text-sm font-medium underline-offset-2 hover:underline"
            >
              {{ selectedRoom.listingName }}
            </NuxtLink>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted-foreground">
                Members
              </p>
              <span class="text-[10px] text-muted-foreground">{{ members.length }}</span>
            </div>
            <div
              v-for="member of members"
              :key="member.id"
              class="flex items-center gap-2 rounded-lg border p-2"
            >
              <Avatar class="size-7 shrink-0">
                <AvatarFallback class="text-[10px]">
                  {{ member.initials }}
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0">
                <p class="truncate text-xs font-medium">
                  {{ member.name }}
                  <span v-if="member.id === currentUser?.id" class="text-muted-foreground">(you)</span>
                </p>
                <p class="truncate text-[10px] text-muted-foreground">
                  {{ roleName(member.roleId) }}
                </p>
              </div>
            </div>
            <p v-if="members.length === 0" class="text-xs text-muted-foreground">
              Nobody is assigned to this room yet.
            </p>
          </div>

          <!-- The work this room answers for, so a hand-off can be checked
               against what is already open rather than re-raised. -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted-foreground">
                {{ isGeneralRoom ? 'Tasks at this listing' : `${selectedRoom.name} tasks` }}
              </p>
              <span v-if="roomTasks.length" class="text-[10px] text-muted-foreground">
                {{ openTasks.length }} open
              </span>
            </div>

            <NuxtLink
              v-for="task of roomTasks"
              :key="task.id"
              to="/tasks"
              class="block space-y-1 rounded-lg border p-2 transition-colors hover:bg-accent"
            >
              <div class="flex items-start gap-1.5">
                <p class="min-w-0 flex-1 text-xs font-medium leading-tight">
                  {{ task.title }}
                </p>
                <span
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium capitalize"
                  :class="statusClass[task.status.toLowerCase()] ?? 'bg-muted text-muted-foreground'"
                >
                  {{ task.status }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span class="font-mono">{{ task.id }}</span>
                <span v-if="task.priority" class="capitalize">· {{ task.priority }}</span>
                <span v-if="task.dueDate" class="ml-auto inline-flex items-center gap-0.5">
                  <Icon name="lucide:calendar" class="size-2.5" />
                  {{ dueLabel(task.dueDate) }}
                </span>
              </div>
            </NuxtLink>

            <p v-if="roomTasks.length === 0" class="text-xs text-muted-foreground">
              {{ isGeneralRoom
                ? 'No tasks at this listing yet.'
                : 'No tasks fall to this role. Right-click a message to raise one.' }}
            </p>
          </div>
        </div>
      </ScrollArea>
    </template>

    <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Icon name="lucide:users" class="size-10" />
      <p class="text-sm">
        Select a room
      </p>
    </div>
  </div>
</template>
