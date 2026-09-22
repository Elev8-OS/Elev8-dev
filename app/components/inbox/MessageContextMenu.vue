<script lang="ts" setup>
/**
 * Right-click actions on a message. One component for both threads: the guest
 * thread and an internal room raise the same forward and task dialogs, and the
 * only difference is that a room message can also be replied to.
 */
interface MessageContextMenuProps {
  kind: 'guest' | 'internal'
  /** Selection mode is on in this thread. */
  selectionMode?: boolean
  /** This message is in the selection. */
  isSelected?: boolean
  /** How many messages the selection holds. */
  selectedCount?: number
  /** False for a system line, which nothing can be done with. */
  disabled?: boolean
}

const props = withDefaults(defineProps<MessageContextMenuProps>(), {
  selectionMode: false,
  isSelected: false,
  selectedCount: 0,
  disabled: false,
})

const emit = defineEmits<{
  forward: []
  task: []
  reply: []
  startSelect: []
  toggleSelect: []
  clearSelect: []
  copy: []
}>()

/**
 * Once a selection exists, the actions act on the SELECTION, not on whatever
 * was right-clicked. The labels say so, because silently forwarding one
 * message while four are ticked is the kind of thing nobody notices until the
 * wrong person has been asked to fix the wrong thing.
 */
const actsOnSelection = computed(() =>
  props.selectionMode && props.selectedCount > 0,
)

const forwardLabel = computed(() =>
  actsOnSelection.value
    ? `Forward ${props.selectedCount} message${props.selectedCount === 1 ? '' : 's'}`
    : 'Forward to room',
)

const taskLabel = computed(() =>
  actsOnSelection.value
    ? `Create task from ${props.selectedCount} message${props.selectedCount === 1 ? '' : 's'}`
    : 'Create task',
)
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger :disabled="disabled" as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-56">
      <ContextMenuItem v-if="kind === 'internal' && !actsOnSelection" @select="emit('reply')">
        <Icon name="lucide:reply" />
        Reply
      </ContextMenuItem>
      <ContextMenuItem @select="emit('forward')">
        <Icon name="lucide:forward" />
        {{ forwardLabel }}
      </ContextMenuItem>
      <ContextMenuItem @select="emit('task')">
        <Icon name="lucide:list-checks" />
        {{ taskLabel }}
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem v-if="!selectionMode" @select="emit('startSelect')">
        <Icon name="lucide:list-plus" />
        Select messages
      </ContextMenuItem>
      <template v-else>
        <ContextMenuItem @select="emit('toggleSelect')">
          <Icon :name="isSelected ? 'lucide:square-minus' : 'lucide:square-plus'" />
          {{ isSelected ? 'Remove from selection' : 'Add to selection' }}
        </ContextMenuItem>
        <ContextMenuItem @select="emit('clearSelect')">
          <Icon name="lucide:x" />
          Clear selection
        </ContextMenuItem>
      </template>

      <ContextMenuSeparator />

      <ContextMenuItem @select="emit('copy')">
        <Icon name="lucide:copy" />
        Copy text
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
