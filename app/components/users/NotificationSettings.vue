<!-- app/components/users/NotificationSettings.vue -->
<script setup lang="ts">
import type { AlertType } from '~/components/notifications/data/alerts'
import type { NotificationCategoryId } from '~/components/notifications/data/notification-settings'
import { notificationCategories } from '~/components/notifications/data/notification-settings'

interface Props {
  modelValue: {
    enabledAlertTypes: AlertType[]
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: { enabledAlertTypes: AlertType[] }]
}>()

function isCategoryEnabled(categoryId: NotificationCategoryId): boolean {
  const category = notificationCategories.find(c => c.id === categoryId)
  if (!category) return false
  return category.alertTypes.every(type => props.modelValue.enabledAlertTypes.includes(type))
}

function toggleCategory(categoryId: NotificationCategoryId): void {
  const category = notificationCategories.find(c => c.id === categoryId)
  if (!category) return
  const categoryTypes = new Set(category.alertTypes)
  const currentlyOn = isCategoryEnabled(categoryId)
  const next = currentlyOn
    ? props.modelValue.enabledAlertTypes.filter(type => !categoryTypes.has(type))
    : Array.from(new Set([...props.modelValue.enabledAlertTypes, ...category.alertTypes]))
  emit('update:modelValue', { enabledAlertTypes: next })
}
</script>

<template>
  <div
    v-for="category in notificationCategories"
    :key="category.id"
    :data-testid="`notification-category-${category.id}`"
    class="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
  >
    <p class="text-sm font-medium">
      {{ category.label }}
    </p>
    <button
      type="button"
      role="switch"
      :aria-checked="isCategoryEnabled(category.id)"
      :data-testid="`notification-category-toggle-${category.id}`"
      class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors"
      :class="isCategoryEnabled(category.id)
        ? 'border-primary bg-primary'
        : 'border-input bg-muted'"
      @click="toggleCategory(category.id)"
    >
      <span
        class="inline-block size-5 transform rounded-full bg-background shadow-sm transition-transform"
        :class="isCategoryEnabled(category.id) ? 'translate-x-5' : 'translate-x-0.5'"
      />
    </button>
  </div>
</template>
