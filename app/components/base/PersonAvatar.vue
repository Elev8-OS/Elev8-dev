<script setup lang="ts">
import { avatarColorFor, initials } from '~/lib/avatar-colors'

/**
 * A person's initials on their own deterministic colour. One component so the
 * reservations table, the reservation detail sheet and the guest page all show
 * the same face for the same guest.
 *
 * Size comes from the caller: `class` falls through to the Avatar root, whose
 * own `size-8` default is overridden by tailwind-merge, e.g.
 * `<BasePersonAvatar :name="guest.name" class="size-11" text-class="text-sm" />`.
 */
withDefaults(defineProps<{
  name: string
  textClass?: string
}>(), {
  textClass: 'text-xs',
})
</script>

<template>
  <Avatar>
    <AvatarFallback :class="[avatarColorFor(name), textClass]">
      {{ initials(name) }}
    </AvatarFallback>
  </Avatar>
</template>
