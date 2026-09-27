<script lang="ts" setup>
import type { TaskStatus } from '~/components/tasks/data/schema'
import { isTaskOpen } from '~/components/inbox/data/internal'
import { TASK_STATUS_LABELS } from '~/components/tasks/data/schema'

const {
  selectedRoom,
  activeListing,
  membersOf,
  roomTasks,
  listingMembers,
  listingTasks,
  isLoading,
} = useInternalInbox()
const { currentUser } = useCurrentDashboardUser()
// A task card opens the task itself, in the same detail sheet the Tasks page
// uses, instead of dropping you on the task list to find it again.
const { openTaskDetailById } = useTaskDetail()
const { roles } = useRoles()

/**
 * Two modes. With a room open the panel is about that room: its members and
 * the tasks its role answers for. With only a listing open (picking a listing
 * opens no room) it is the listing overview: everybody staffing the property
 * and every task there, whoever it is assigned to.
 */
const panelListing = computed(() => {
  if (selectedRoom.value)
    return { id: selectedRoom.value.listingId, name: selectedRoom.value.listingName }
  if (activeListing.value)
    return { id: activeListing.value.listingId, name: activeListing.value.listingName }
  return undefined
})

const members = computed(() =>
  selectedRoom.value ? membersOf(selectedRoom.value) : listingMembers.value,
)

const panelTasks = computed(() =>
  selectedRoom.value ? roomTasks.value : listingTasks.value,
)

const openTasks = computed(() => panelTasks.value.filter(isTaskOpen))

function roleName(roleId: string) {
  return roles.value.find(r => r.id === roleId)?.name ?? roleId
}

const statusClass: Record<TaskStatus, string> = {
  'not started': 'bg-muted text-muted-foreground',
  'in progress': 'bg-secondary text-secondary-foreground',
  'completed': 'bg-green-500/15 text-green-600',
}

function statusLabel(status: string) {
  return TASK_STATUS_LABELS[status as TaskStatus] ?? status
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

    <template v-else-if="panelListing">
      <div class="flex h-[56px] shrink-0 items-center px-4">
        <h2 class="text-sm font-semibold">
          {{ selectedRoom ? 'Room' : 'Listing' }}
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
              :to="`/listings/${panelListing.id}`"
              class="text-sm font-medium underline-offset-2 hover:underline"
            >
              {{ panelListing.name }}
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
              {{ selectedRoom ? 'Nobody is assigned to this room yet.' : 'Nobody is assigned to this listing yet.' }}
            </p>
          </div>

          <!-- The work this room (or, with no room open, this listing)
               answers for, so a hand-off can be checked against what is
               already open rather than re-raised. -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted-foreground">
                {{ selectedRoom ? `${selectedRoom.name} tasks` : 'Tasks at this listing' }}
              </p>
              <span v-if="panelTasks.length" class="text-[10px] text-muted-foreground">
                {{ openTasks.length }} open
              </span>
            </div>

            <button
              v-for="task of panelTasks"
              :key="task.id"
              type="button"
              class="block w-full space-y-1 rounded-lg border p-2 text-left transition-colors hover:bg-accent"
              :aria-label="`Open task: ${task.title}`"
              @click="openTaskDetailById(task.id)"
            >
              <div class="flex items-start gap-1.5">
                <p class="min-w-0 flex-1 text-xs font-medium leading-tight">
                  {{ task.title }}
                </p>
                <span
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                  :class="statusClass[task.status as TaskStatus] ?? 'bg-muted text-muted-foreground'"
                >
                  {{ statusLabel(task.status) }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span v-if="task.priority" class="capitalize">{{ task.priority }}</span>
                <span v-if="task.dueDate" class="ml-auto inline-flex items-center gap-0.5">
                  <Icon name="lucide:calendar" class="size-2.5" />
                  {{ dueLabel(task.dueDate) }}
                </span>
              </div>
            </button>

            <p v-if="panelTasks.length === 0" class="text-xs text-muted-foreground">
              {{ selectedRoom
                ? 'No tasks fall to this role. Right-click a message to raise one.'
                : 'No tasks at this listing yet.' }}
            </p>
          </div>
        </div>
      </ScrollArea>
    </template>

    <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Icon name="lucide:users" class="size-10" />
      <p class="text-sm">
        Select a listing
      </p>
    </div>
  </div>
</template>
