<script setup lang="ts">
import type { OriginShare } from '~/components/analytics/data/analytics'

defineProps<{ origins: OriginShare[] }>()
</script>

<template>
  <Card class="flex h-full flex-col" data-testid="analytics-guest-origins">
    <CardHeader>
      <CardTitle>Guest origins</CardTitle>
      <CardDescription>Where arriving guests book from</CardDescription>
    </CardHeader>
    <CardContent class="flex-1">
      <ul v-if="origins.length" class="flex flex-col gap-3">
        <li v-for="o in origins" :key="o.country" class="flex flex-col gap-1.5" data-testid="analytics-origin-row">
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="truncate" :class="o.country === 'other' ? 'text-muted-foreground' : 'font-medium'">{{ o.name }}</span>
            <span class="shrink-0 tabular-nums text-muted-foreground">
              {{ o.stays }} · <span class="font-medium text-foreground">{{ Math.round(o.share * 100) }}%</span>
            </span>
          </div>
          <Progress :model-value="o.share * 100" class="h-1.5" />
        </li>
      </ul>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">
        No stays in this period
      </p>
    </CardContent>
  </Card>
</template>
