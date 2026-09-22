<script lang="ts" setup>
import type { RoomListingGroup } from '~/components/inbox/data/internal'
import { cn } from '~/lib/utils'

/**
 * One listing in the Internal nav: cover photo, name, and how many roles
 * staff it. Picking it scopes the room list to that listing.
 */
interface ListingCardProps {
  group: RoomListingGroup
  selected: boolean
  /** Unread across every room of this listing. */
  unread: number
}

defineProps<ListingCardProps>()
defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    :aria-pressed="selected"
    :class="cn(
      'flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors hover:bg-accent',
      selected && 'border-primary bg-muted',
    )"
    @click="$emit('select')"
  >
    <!-- A listing with no photo keeps the same footprint, so the column of
         names never goes ragged. -->
    <div class="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
      <img
        v-if="group.photo"
        :src="group.photo"
        :alt="group.listingName"
        class="size-full object-cover"
      >
      <div v-else class="flex size-full items-center justify-center">
        <Icon name="lucide:building-2" class="size-4 text-muted-foreground" />
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <p class="line-clamp-2 text-xs font-medium leading-tight">
        {{ group.listingName }}
      </p>
      <p class="mt-0.5 text-[10px] text-muted-foreground">
        {{ group.roleCount }} {{ group.roleCount === 1 ? 'role' : 'roles' }}
        ·
        {{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
      </p>
    </div>

    <Badge v-if="unread > 0" class="h-4 shrink-0 justify-center px-1.5 text-[10px]">
      {{ unread }}
    </Badge>
  </button>
</template>
