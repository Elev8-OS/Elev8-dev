<script setup lang="ts">
import type { GuideSection } from '../data/types'
import { VueDraggable } from 'vue-draggable-plus'
import { Button } from '~/components/ui/button'

const props = defineProps<{
  modelValue: GuideSection[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [v: GuideSection[]]
  'select': [id: string]
  'add': []
  'delete': [id: string]
}>()

const sectionTypeIcons: Record<string, string> = {
  hero: 'image',
  welcome: 'message-circle',
  checkin: 'log-in',
  checkout: 'log-out',
  house_rules: 'scroll',
  good_to_know: 'info',
  amenities: 'star',
  wifi: 'wifi',
  local_tips: 'map-pin',
  documents: 'file-text',
  upsells: 'shopping-bag',
  smart_lock: 'lock',
  pre_arrival: 'clipboard-list',
  custom_rich: 'edit',
}

function handleUpdate(newValue: GuideSection[]) {
  // Re-number the order
  const renumbered = newValue.map((s, idx) => ({ ...s, order: idx }))
  emit('update:modelValue', renumbered)
}
</script>

<template>
  <div class="space-y-1">
    <VueDraggable
      :model-value="modelValue"
      handle=".drag-handle"
      item-key="id"
      class="space-y-1"
      @update:model-value="handleUpdate"
    >
      <template v-for="section in modelValue" :key="section.id">
        <div
          class="flex items-center gap-2 rounded-md border p-2 hover:bg-muted"
          :class="selectedId === section.id ? 'border-primary bg-muted' : ''"
          @click="$emit('select', section.id)"
        >
          <span class="drag-handle cursor-grab text-muted-foreground">⋮⋮</span>
          <Icon :name="`lucide:${sectionTypeIcons[section.type]}`" class="size-4 text-muted-foreground" />
          <span class="flex-1 text-sm capitalize">{{ section.type.replace('_', ' ') }}</span>
          <Button
            variant="ghost"
            size="sm"
            class="size-6 p-0"
            @click.stop="$emit('delete', section.id)"
          >
            <Icon name="lucide:trash-2" class="size-3" />
          </Button>
        </div>
      </template>
    </VueDraggable>
    <Button variant="outline" class="w-full" size="sm" @click="$emit('add')">
      + Add Section
    </Button>
  </div>
</template>
