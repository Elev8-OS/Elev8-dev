<script setup lang="ts">
import type { PreArrivalField } from '../../data/types'

// Uses native <input type="checkbox"> to avoid the reka-ui Checkbox
// reactivity issue noted in CLAUDE.md. No Drag/Select component needed.

const props = defineProps<{ modelValue: Record<string, any> }>()
const emit = defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()

function update(patch: Record<string, any>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const fieldDefs: Array<{ key: PreArrivalField, label: string, hint: string }> = [
  { key: 'arrival_time', label: 'Expected arrival time', hint: 'e.g. 14:30' },
  { key: 'guests', label: 'Number of guests', hint: 'How many are arriving' },
  { key: 'mobile', label: 'Mobile (confirm)', hint: 'For last-minute updates' },
  { key: 'id_type', label: 'ID type', hint: 'Passport / KTP / Driver license' },
  { key: 'id_number', label: 'ID number', hint: 'Required by local regulations' },
  { key: 'id_photo', label: 'ID photo', hint: 'Upload (Phase 5)' },
  { key: 'requests', label: 'Special requests', hint: 'Free-form text' },
]

const fields = computed({
  get: () => (props.modelValue.fields ?? []) as PreArrivalField[],
  set: (v: PreArrivalField[]) => update({ fields: v }),
})

function isChecked(key: PreArrivalField): boolean {
  return fields.value.includes(key)
}

function toggle(key: PreArrivalField, checked: boolean) {
  if (checked) {
    if (!isChecked(key))
      fields.value = [...fields.value, key]
  }
  else {
    fields.value = fields.value.filter(f => f !== key)
  }
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-xs text-muted-foreground">
      Choose which fields the guest will be asked to fill in on the pre-arrival form.
    </p>
    <div class="space-y-2 rounded-md border p-3">
      <label
        v-for="f in fieldDefs"
        :key="f.key"
        class="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted"
      >
        <input
          type="checkbox"
          :checked="isChecked(f.key)"
          class="mt-0.5 size-4 rounded border-input"
          @change="toggle(f.key, ($event.target as HTMLInputElement).checked)"
        >
        <div class="flex-1">
          <div class="text-sm font-medium">{{ f.label }}</div>
          <div class="text-xs text-muted-foreground">{{ f.hint }}</div>
        </div>
      </label>
    </div>
  </div>
</template>
