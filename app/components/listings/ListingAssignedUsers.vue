<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import type { User } from '~/components/users/data/users'
import { toast } from 'vue-sonner'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { useRoles } from '~/composables/useRoles'
import { useUsers } from '~/composables/useUsers'
import { avatarColorFor } from '~/lib/avatar-colors'

/**
 * Who works on this listing: avatars and a count in the listing hero, and a
 * popover to assign or unassign users. Reads and writes `User.listingIds`
 * through `useUsers`, the same assignment the Users page edits.
 */
const props = defineProps<{ listing: Listing }>()

const { users, getUsersForListing, setListingAssignments } = useUsers()
const { getRole } = useRoles()

const MAX_AVATARS = 3

const assigned = computed(() => getUsersForListing(props.listing.id))
const shownAvatars = computed(() => assigned.value.slice(0, MAX_AVATARS))
const overflow = computed(() => Math.max(0, assigned.value.length - MAX_AVATARS))

const search = ref('')

function isAssigned(user: User) {
  return user.listingIds.includes(props.listing.id)
}

/** Assigned users first, then the rest; active before inactive; by name. */
const options = computed(() => {
  const q = search.value.trim().toLowerCase()
  return users.value
    .filter(u => !q || u.name.toLowerCase().includes(q) || (getRole(u.roleId)?.name ?? '').toLowerCase().includes(q))
    .sort((a, b) =>
      Number(isAssigned(b)) - Number(isAssigned(a))
      || Number(b.status === 'active') - Number(a.status === 'active')
      || a.name.localeCompare(b.name),
    )
})

function toggle(user: User) {
  const wasAssigned = isAssigned(user)
  const next = wasAssigned
    ? user.listingIds.filter(id => id !== props.listing.id)
    : [...user.listingIds, props.listing.id]
  setListingAssignments(user.id, next)
  toast.success(wasAssigned ? `${user.name} unassigned` : `${user.name} assigned to ${props.listing.name}`)
}

function roleName(user: User) {
  return getRole(user.roleId)?.name ?? user.roleId
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-9 gap-2 px-2.5 text-sm"
        :aria-label="`${assigned.length} users assigned to this listing`"
        data-testid="assigned-users-trigger"
      >
        <div v-if="assigned.length" class="flex -space-x-2">
          <Avatar
            v-for="user in shownAvatars"
            :key="user.id"
            class="size-7 bg-background ring-2 ring-background"
          >
            <AvatarFallback :class="avatarColorFor(user.name)" class="text-[10px]">
              {{ user.initials }}
            </AvatarFallback>
          </Avatar>
          <div
            v-if="overflow > 0"
            class="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background"
          >
            +{{ overflow }}
          </div>
        </div>
        <Icon v-else name="lucide:user-plus" class="size-4" />
        <span data-testid="assigned-users-count">
          {{ assigned.length ? `${assigned.length} ${assigned.length === 1 ? 'user' : 'users'}` : 'Assign users' }}
        </span>
      </Button>
    </PopoverTrigger>

    <PopoverContent align="start" class="w-80 p-0">
      <div class="flex items-center justify-between border-b px-3 py-2.5">
        <span class="text-sm font-semibold">Assigned users</span>
        <span class="text-xs text-muted-foreground">{{ assigned.length }} of {{ users.length }}</span>
      </div>
      <div class="border-b p-2">
        <Input v-model="search" placeholder="Search name or role..." class="h-8 text-xs" />
      </div>
      <div class="max-h-72 overflow-y-auto">
        <div class="flex flex-col p-1">
          <div
            v-for="user in options"
            :key="user.id"
            class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60"
            :class="user.status === 'inactive' && 'opacity-60'"
            data-testid="assigned-users-option"
            :data-assigned="isAssigned(user) || undefined"
            @click="toggle(user)"
          >
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
              :class="isAssigned(user) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
            >
              <Icon v-if="isAssigned(user)" name="lucide:check" class="size-3" />
            </div>
            <Avatar class="size-9">
              <AvatarFallback :class="avatarColorFor(user.name)" class="text-xs">
                {{ user.initials }}
              </AvatarFallback>
            </Avatar>
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm">{{ user.name }}</span>
              <span class="truncate text-xs text-muted-foreground">
                {{ roleName(user) }}<template v-if="user.status === 'inactive'"> · Inactive</template>
              </span>
            </div>
          </div>
          <p v-if="options.length === 0" class="py-6 text-center text-xs text-muted-foreground">
            No users found.
          </p>
        </div>
      </div>
      <div class="border-t p-1">
        <Button variant="ghost" size="sm" class="h-8 w-full justify-start gap-2 text-xs" as-child>
          <NuxtLink to="/users">
            <Icon name="lucide:users" class="size-3.5" />
            Manage users
          </NuxtLink>
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
