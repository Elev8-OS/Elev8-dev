<script setup lang="ts">
import type { SavedViewVisibility } from '~/lib/saved-view-ownership'
import { Icon } from '#components'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'

/** Personal or Public choice shown when saving a view, with a line saying who will see it. */
const visibility = defineModel<SavedViewVisibility>({ required: true })

function pick(value: unknown) {
  // A single ToggleGroup emits undefined when the pressed item is clicked again.
  if (value === 'personal' || value === 'public')
    visibility.value = value
}
</script>

<template>
  <div class="space-y-1">
    <ToggleGroup
      :model-value="visibility"
      type="single"
      variant="outline"
      size="sm"
      class="w-full"
      @update:model-value="pick"
    >
      <ToggleGroupItem value="personal" class="h-7 flex-1 gap-1.5 text-xs" data-testid="visibility-personal">
        <Icon name="lucide:user" class="size-3.5" />
        Personal
      </ToggleGroupItem>
      <ToggleGroupItem value="public" class="h-7 flex-1 gap-1.5 text-xs" data-testid="visibility-public">
        <Icon name="lucide:users" class="size-3.5" />
        Public
      </ToggleGroupItem>
    </ToggleGroup>
    <p class="text-xs text-muted-foreground">
      {{ visibility === 'public' ? 'Everyone on your team can use it. Only you can edit it.' : 'Only you can see it.' }}
    </p>
  </div>
</template>
