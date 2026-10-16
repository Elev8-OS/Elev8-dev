<script setup lang="ts">
import type { ActivityListingSummary } from '~/composables/useActivityReport'
import { formatDuration } from '~/components/activities/data/activities'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'

defineProps<{ items: ActivityListingSummary[] }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Listings worked on ({{ items.length }})</SheetTitle>
        <SheetDescription>Activity and time per listing in the selected period.</SheetDescription>
      </SheetHeader>
      <div class="space-y-3 px-4 pb-4">
        <p v-if="!items.length" class="py-8 text-center text-sm text-muted-foreground">
          No listings in this period.
        </p>
        <div v-for="item in items" :key="item.listingId" class="rounded-lg border p-4">
          <p class="font-medium">
            {{ item.listingName }}
          </p>
          <div class="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <Icon name="lucide:circle-check" class="size-4" />
              {{ item.count }} {{ item.count === 1 ? 'activity' : 'activities' }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <Icon name="lucide:timer" class="size-4" />
              {{ formatDuration(item.minutes) }}
            </span>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
