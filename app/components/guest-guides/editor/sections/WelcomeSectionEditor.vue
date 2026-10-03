<script setup lang="ts">
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()

function update(patch: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<template>
  <div>
    <Label>Welcome message</Label>
    <Textarea
      :model-value="modelValue.message ?? ''"
      rows="8"
      placeholder="Welcome to our property. We're thrilled to host you..."
      @update:model-value="update({ message: $event })"
    />
    <p class="mt-1 text-xs text-muted-foreground">
      Auto-translated at render time to the guest's language.
    </p>
  </div>
</template>
