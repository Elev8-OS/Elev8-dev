<script setup lang="ts">
import type { Alert } from '~/components/notifications/data/alerts'
import type { NotificationKindFilter, SeverityFilter } from '~/composables/useNotifications'
import { getNotificationKind } from '~/composables/useNotifications'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import NotificationItem from './NotificationItem.vue'

const popoverOpen = ref(false)

const {
  unreadCount,
  activeAlerts,
  selectedSeverity,
  selectedKind,
  filteredAlerts,
  markAllAsRead,
  navigateToAlert,
} = useNotifications()

const hasCritical = computed(() => activeAlerts.value.some(a => a.severity === 'CRITICAL'))

const tabs: { label: string, value: SeverityFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'Warning', value: 'warning' },
  { label: 'Info', value: 'info' },
]

const kindTabs: { label: string, value: NotificationKindFilter }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'System', value: 'system' },
  { label: 'Cleanings', value: 'cleaning' },
  { label: 'Calls', value: 'calls' },
  { label: 'Reviews', value: 'reviews' },
  { label: 'Guest Activity', value: 'guest_activity' },
  { label: 'Upsell', value: 'upsell' },
]

function alertKind(alert: Alert) {
  const kind = getNotificationKind(alert.type)
  return kind === 'guest_activity' ? 'Guest Activity' : kind === 'cleaning' ? 'Cleaning' : kind === 'calls' ? 'Call' : kind === 'reviews' ? 'Review' : kind === 'upsell' ? 'Upsell' : 'System'
}

function handleNavigate(alert: Alert) {
  navigateToAlert(alert)
  popoverOpen.value = false
}

function handleMarkAllRead() {
  markAllAsRead()
  toast.success('All notifications marked as read')
}
</script>

<template>
  <Popover v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="relative size-8" aria-label="Notifications" aria-haspopup="true">
        <Icon name="i-lucide-bell" class="size-5" />
        <Badge
          v-if="unreadCount > 0"
          class="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
          :class="hasCritical ? 'bg-red-500 text-white' : 'bg-muted text-foreground'"
        >
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </Badge>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="flex h-[min(32rem,calc(100vh-6rem))] w-[380px] min-h-0 flex-col overflow-hidden p-0" align="end" :side-offset="8">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3">
        <h3 class="text-sm font-semibold">
          Notifications
        </h3>
        <div class="flex items-center gap-2">
          <button v-if="unreadCount > 0" class="text-xs text-muted-foreground hover:text-foreground transition-colors" @click="handleMarkAllRead">
            Mark All Read
          </button>
        </div>
      </div>

      <Separator />

      <!-- Kind Tabs -->
      <div class="flex gap-1 px-4 py-2">
        <button
          v-for="tab in kindTabs"
          :key="tab.value"
          class="px-3 py-1 text-xs font-medium rounded-full transition-colors"
          :class="selectedKind === tab.value
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/60 text-muted-foreground hover:text-foreground'"
          @click="selectedKind = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Filter Tabs -->
      <div class="flex gap-1 px-4 py-2">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="px-3 py-1 text-xs font-medium rounded-full transition-colors"
          :class="selectedSeverity === tab.value
            ? 'bg-muted text-foreground'
            : 'bg-muted/30 text-muted-foreground hover:text-foreground'"
          @click="selectedSeverity = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <Separator />

      <!-- Notification List / Empty State -->
      <ScrollArea class="min-h-0 flex-1 overflow-hidden">
        <div
          v-if="filteredAlerts.length === 0"
          class="flex flex-col items-center justify-center py-12 text-muted-foreground"
        >
          <Icon name="i-lucide-bell-off" class="size-8 mb-2" />
          <p class="text-sm">
            No notifications
          </p>
        </div>
        <NotificationItem
          v-for="alert in filteredAlerts"
          :key="alert.alert_id"
          :alert="alert"
          :kind="alertKind(alert)"
          @click="handleNavigate(alert)"
        />
      </ScrollArea>
    </PopoverContent>
  </Popover>
</template>
