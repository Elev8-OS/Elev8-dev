<script setup lang="ts">
import type { OwnerPropertyMapping } from '~/components/owners/data/owners'

defineProps<{ properties: OwnerPropertyMapping[], modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()
</script>

<template>
  <div v-if="properties.length > 1" class="space-y-1">
    <label for="portal-property" class="text-sm font-medium">Property</label>
    <select id="portal-property" :value="modelValue ?? ''" class="h-9 rounded-md border bg-background px-3 text-sm" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)">
      <option value="">
        All properties
      </option>
      <option v-for="property in properties" :key="property.listingId" :value="property.listingId">
        {{ property.listingId }}
      </option>
    </select>
  </div>
</template>
