<script setup lang="ts">
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import ListingOwnedContentNotice from './ListingOwnedContentNotice.vue'

/** Check-in steps and time come from each listing; the guide keeps only the early check-in option. */
const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()

function update(patch: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<template>
  <ListingOwnedContentNotice kind="checkin">
    <div class="flex items-center justify-between rounded-md border p-3">
      <div>
        <Label>Early check-in available</Label>
        <p class="mt-1 text-xs text-muted-foreground">
          Show option to request early arrival.
        </p>
      </div>
      <Switch
        :model-value="!!modelValue.earlyCheckinAvailable"
        @update:model-value="update({ earlyCheckinAvailable: $event })"
      />
    </div>
  </ListingOwnedContentNotice>
</template>
