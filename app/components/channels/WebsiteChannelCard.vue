<script setup lang="ts">
import { computed } from 'vue'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'
import { WEBSITE_CHANNEL } from './data/website-channel'

const emit = defineEmits<{ manage: [] }>()

const { ruleSets } = useWebsiteChannel()

// A website is in at most one rule set, so the sum has no duplicates.
const websiteCount = computed(() => ruleSets.value.reduce((n, r) => n + r.websiteIds.length, 0))
</script>

<template>
  <Card class="flex flex-col gap-3 p-4">
    <div class="flex items-start justify-between gap-2">
      <div class="flex size-10 items-center justify-center rounded-lg border bg-background">
        <Icon :name="WEBSITE_CHANNEL.icon" class="size-6" />
      </div>
      <Badge variant="outline" class="gap-1 border-green-500/40 text-green-700 dark:text-green-400">
        <span class="size-1.5 rounded-full bg-green-500" aria-hidden="true" />
        Active
      </Badge>
    </div>

    <div class="flex-1">
      <p class="text-sm font-semibold">
        {{ WEBSITE_CHANNEL.name }}
      </p>
      <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
        {{ WEBSITE_CHANNEL.description }}
      </p>
    </div>

    <div class="flex items-center justify-between gap-2 border-t pt-3">
      <div class="min-w-0 text-xs">
        <p class="font-medium tabular-nums">
          {{ websiteCount }} {{ websiteCount === 1 ? 'website' : 'websites' }}
        </p>
        <p class="truncate text-muted-foreground">
          {{ ruleSets.length }} {{ ruleSets.length === 1 ? 'rule set' : 'rule sets' }}
        </p>
      </div>
      <Button variant="outline" size="sm" class="shrink-0" @click="emit('manage')">
        Manage rule sets
      </Button>
    </div>
  </Card>
</template>
