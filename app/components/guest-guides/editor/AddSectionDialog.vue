<script setup lang="ts">
import type { GuideSectionType } from '../data/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [v: boolean]
  'select': [type: GuideSectionType]
}>()

const sectionTypes: Array<{ type: GuideSectionType, label: string, icon: string, description: string }> = [
  { type: 'hero', label: 'Hero', icon: 'image', description: 'Welcome banner with property photo' },
  { type: 'welcome', label: 'Welcome Message', icon: 'message-circle', description: 'Auto-translated greeting' },
  { type: 'checkin', label: 'Check-in', icon: 'log-in', description: 'Check-in time + instructions' },
  { type: 'checkout', label: 'Check-out', icon: 'log-out', description: 'Check-out time + instructions' },
  { type: 'house_rules', label: 'House Rules', icon: 'scroll', description: 'Rules with a title and description' },
  { type: 'good_to_know', label: 'Good to Know', icon: 'info', description: 'Practical tips from each listing' },
  { type: 'amenities', label: 'Amenities', icon: 'star', description: 'Icon grid of features' },
  { type: 'wifi', label: 'Wi-Fi', icon: 'wifi', description: 'Network name + password' },
  { type: 'local_tips', label: 'Local Tips', icon: 'map-pin', description: 'Restaurants, beaches, transport' },
  { type: 'documents', label: 'Documents', icon: 'file-text', description: 'Downloadable PDFs' },
  { type: 'upsells', label: 'Upsells', icon: 'shopping-bag', description: 'Bookable services' },
  { type: 'smart_lock', label: 'Smart Lock', icon: 'lock', description: 'Door code (24h before check-in)' },
  { type: 'pre_arrival', label: 'Pre-Arrival Form', icon: 'clipboard-list', description: 'Guest info collection' },
  { type: 'custom_rich', label: 'Custom Content', icon: 'edit', description: 'Free-form rich text' },
]
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add Section</DialogTitle>
        <DialogDescription>Pick the type of section to add to your guide</DialogDescription>
      </DialogHeader>
      <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
        <button
          v-for="s in sectionTypes"
          :key="s.type"
          class="flex flex-col items-start gap-1 rounded-md border p-3 text-left hover:bg-muted"
          @click="$emit('select', s.type); $emit('update:open', false)"
        >
          <Icon :name="`lucide:${s.icon}`" class="size-5 text-primary" />
          <span class="font-medium">{{ s.label }}</span>
          <span class="text-xs text-muted-foreground">{{ s.description }}</span>
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
