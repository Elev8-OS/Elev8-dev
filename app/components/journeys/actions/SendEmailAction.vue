<script setup lang="ts">
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'

defineProps<{ modelValue: Record<string, any> }>()
defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()
</script>

<template>
  <div class="space-y-3">
    <div>
      <Label>To</Label>
      <Select
        :model-value="modelValue.to ?? 'guest'"
        @update:model-value="$emit('update:modelValue', { ...modelValue, to: $event })"
      >
        <SelectTrigger class="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="guest">
            Guest email
          </SelectItem>
          <SelectItem value="staff">
            Staff / internal
          </SelectItem>
          <SelectItem value="custom">
            Custom address
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div v-if="modelValue.to === 'custom'">
      <Label>Recipient address</Label>
      <Input
        :model-value="modelValue.recipient ?? ''"
        class="mt-1 font-mono"
        placeholder="owner@example.com"
        @update:model-value="$emit('update:modelValue', { ...modelValue, recipient: $event })"
      />
    </div>
    <div>
      <Label>Subject</Label>
      <Input
        :model-value="modelValue.subject ?? ''"
        class="mt-1"
        placeholder="Your stay at {{ property_name }}"
        @update:model-value="$emit('update:modelValue', { ...modelValue, subject: $event })"
      />
    </div>
    <div>
      <Label>Body</Label>
      <Textarea
        :model-value="modelValue.body ?? ''"
        class="mt-1 min-h-24 text-sm"
        placeholder="Hi {{ guest_name }}, …"
        @update:model-value="$emit('update:modelValue', { ...modelValue, body: $event })"
      />
    </div>
  </div>
</template>
