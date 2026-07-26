<!-- app/components/users/NotificationSettings.vue -->
<script setup lang="ts">
import type { AlertType } from '~/components/notifications/data/alerts'
import type { NotificationCategoryDefinition, NotificationChannel, RoleNotifications } from '~/components/notifications/data/notification-settings'
import { alertDisplayLabels } from '~/components/notifications/data/alerts'
import { notificationCategories, notificationChannels } from '~/components/notifications/data/notification-settings'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

interface Props {
  modelValue: RoleNotifications
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: RoleNotifications]
}>()

function emitPatch(patch: Partial<RoleNotifications>) {
  emit('update:modelValue', {
    enabledAlertTypes: [...(patch.enabledAlertTypes ?? props.modelValue.enabledAlertTypes)],
    channels: [...(patch.channels ?? props.modelValue.channels)],
  })
}

function toggleChannel(channel: NotificationChannel) {
  const set = new Set(props.modelValue.channels)
  if (set.has(channel))
    set.delete(channel)
  else
    set.add(channel)
  emitPatch({ channels: Array.from(set) })
}

function toggleAlertType(type: AlertType) {
  const set = new Set(props.modelValue.enabledAlertTypes)
  if (set.has(type))
    set.delete(type)
  else
    set.add(type)
  emitPatch({ enabledAlertTypes: Array.from(set) })
}

function selectCategory(category: NotificationCategoryDefinition) {
  const set = new Set(props.modelValue.enabledAlertTypes)
  for (const type of category.alertTypes)
    set.add(type)
  emitPatch({ enabledAlertTypes: Array.from(set) })
}

function clearCategory(category: NotificationCategoryDefinition) {
  const remove = new Set<AlertType>(category.alertTypes)
  const next = props.modelValue.enabledAlertTypes.filter(type => !remove.has(type))
  emitPatch({ enabledAlertTypes: next })
}

function isChannelSelected(channel: NotificationChannel): boolean {
  return props.modelValue.channels.includes(channel)
}

function isAlertSelected(type: AlertType): boolean {
  return props.modelValue.enabledAlertTypes.includes(type)
}

function categorySelectedCount(category: NotificationCategoryDefinition): number {
  return category.alertTypes.filter(type => props.modelValue.enabledAlertTypes.includes(type)).length
}

// Open the Guest Activity category by default to spotlight the checkout flow.
const expanded = ref<Record<string, boolean>>({ guest_activity: true })

function toggleExpanded(id: string) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] }
}
</script>

<template>
  <Card>
    <CardHeader class="pb-3">
      <CardTitle class="text-base">
        Notifications
      </CardTitle>
      <p class="text-xs text-muted-foreground">
        Choose which alerts this role receives and how they should be delivered. Users inherit these defaults and cannot override them.
      </p>
    </CardHeader>
    <CardContent class="space-y-5">
      <!-- Delivery channels -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium">
            Delivery channels
          </p>
          <p class="text-xs text-muted-foreground">
            {{ modelValue.channels.length }} selected
          </p>
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            v-for="channelOption in notificationChannels"
            :key="channelOption.value"
            type="button"
            :data-testid="`notification-channel-${channelOption.value}`"
            :aria-pressed="isChannelSelected(channelOption.value)"
            class="flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors"
            :class="isChannelSelected(channelOption.value)
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-input bg-background hover:bg-muted'"
            @click="toggleChannel(channelOption.value)"
          >
            <span class="text-sm font-medium">{{ channelOption.label }}</span>
            <span class="text-xs text-muted-foreground">{{ channelOption.description }}</span>
          </button>
        </div>
        <p v-if="modelValue.channels.some(channel => channel === 'email' || channel === 'mobile')" class="text-xs text-muted-foreground">
          Email and mobile delivery are configured for future delivery.
        </p>
      </div>

      <!-- Alert categories -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium">
            Alert types
          </p>
          <p class="text-xs text-muted-foreground">
            {{ modelValue.enabledAlertTypes.length }} selected
          </p>
        </div>
        <div class="space-y-2">
          <div
            v-for="category in notificationCategories"
            :key="category.id"
            class="rounded-md border border-input"
          >
            <div
              role="button"
              tabindex="0"
              class="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left"
              :aria-expanded="!!expanded[category.id]"
              @click="toggleExpanded(category.id)"
              @keydown.enter.prevent="toggleExpanded(category.id)"
              @keydown.space.prevent="toggleExpanded(category.id)"
            >
              <div>
                <p class="text-sm font-medium">
                  {{ category.label }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ category.description }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground">{{ categorySelectedCount(category) }}/{{ category.alertTypes.length }}</span>
                <Icon :name="expanded[category.id] ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="size-4 text-muted-foreground" />
              </div>
            </div>
            <div v-if="expanded[category.id]" class="space-y-2 border-t px-3 py-3">
              <div class="flex gap-2">
                <button
                  type="button"
                  class="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
                  @click="selectCategory(category)"
                >
                  Select all
                </button>
                <button
                  type="button"
                  class="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
                  @click="clearCategory(category)"
                >
                  Clear
                </button>
              </div>
              <div class="space-y-1">
                <button
                  v-for="alertType in category.alertTypes"
                  :key="alertType"
                  type="button"
                  :data-testid="`notification-alert-${alertType}`"
                  :aria-pressed="isAlertSelected(alertType)"
                  class="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors"
                  :class="isAlertSelected(alertType)
                    ? 'border-primary bg-primary/10'
                    : 'border-input bg-background hover:bg-muted'"
                  @click="toggleAlertType(alertType)"
                >
                  <span>{{ alertDisplayLabels[alertType] }}</span>
                  <Icon
                    :name="isAlertSelected(alertType) ? 'lucide:check' : 'lucide:plus'"
                    class="size-4 text-muted-foreground"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
