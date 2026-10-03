<script setup lang="ts">
/**
 * The select tick used by Listing Setup's bulk actions. A div, not a reka
 * `Checkbox` (that double-toggles inside a label). Neutral colours: the yellow
 * primary is unreadable on white.
 */
const props = defineProps<{ checked: boolean, indeterminate?: boolean, label: string }>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <div
    role="checkbox"
    tabindex="0"
    :aria-checked="props.indeterminate ? 'mixed' : props.checked"
    :aria-label="label"
    class="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :class="checked || indeterminate ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground/60'"
    @click.stop="emit('toggle')"
    @keydown.space.prevent.stop="emit('toggle')"
    @keydown.enter.prevent.stop="emit('toggle')"
  >
    <Icon v-if="indeterminate" name="lucide:minus" class="size-3" />
    <Icon v-else-if="checked" name="lucide:check" class="size-3" />
  </div>
</template>
