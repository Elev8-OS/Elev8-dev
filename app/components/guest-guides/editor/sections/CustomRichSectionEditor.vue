<script setup lang="ts">
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()

function update(patch: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <Label>Section title (optional)</Label>
      <Input
        :model-value="modelValue.title ?? ''"
        placeholder="e.g. About the area"
        @update:model-value="update({ title: $event })"
      />
    </div>

    <div>
      <Label>Content</Label>
      <Textarea
        :model-value="modelValue.html ?? ''"
        rows="12"
        placeholder="Write any additional content here. Markdown is supported (line breaks, **bold**, *italic*, lists)."
        @update:model-value="update({ html: $event })"
      />
      <p class="mt-1 text-xs text-muted-foreground">
        Markdown is supported. Auto-translated at render time.
      </p>
    </div>
  </div>
</template>
