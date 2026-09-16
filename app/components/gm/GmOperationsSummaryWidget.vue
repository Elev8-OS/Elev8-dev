<script setup lang="ts">
import type { GmKpiSet } from '~/components/gm/data/gm-dashboard'

const props = defineProps<{
  kpis: GmKpiSet
  unitCount: number
}>()
</script>

<template>
  <Card class="flex h-full flex-col justify-between">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Icon name="lucide:clipboard-check" class="size-4 text-emerald-600 dark:text-emerald-400" />
        Operations summary
      </CardTitle>
      <CardDescription>
        Today's in-house guest activity and daily turnover
      </CardDescription>
      <CardAction>
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/operations-calendar">
            Calendar
            <Icon name="lucide:arrow-up-right" class="size-4" />
          </NuxtLink>
        </Button>
      </CardAction>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg border bg-muted/30 p-3">
          <div class="text-xs font-medium text-muted-foreground">
            In-house guests
          </div>
          <div class="mt-1 text-2xl font-bold tracking-tight">
            {{ props.kpis.inHouseGuests }}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">
            Across {{ props.kpis.inHouseUnits }} units
          </div>
        </div>

        <div class="rounded-lg border bg-muted/30 p-3">
          <div class="text-xs font-medium text-muted-foreground">
            Occupied units
          </div>
          <div class="mt-1 text-2xl font-bold tracking-tight">
            {{ props.kpis.inHouseUnits }}<span class="text-sm font-normal text-muted-foreground">/{{ props.unitCount }}</span>
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">
            {{ Math.round((props.kpis.inHouseUnits / Math.max(1, props.unitCount)) * 100) }}% capacity
          </div>
        </div>

        <div class="rounded-lg border bg-muted/30 p-3">
          <div class="text-xs font-medium text-muted-foreground">
            Arrivals today
          </div>
          <div class="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {{ props.kpis.arrivalsToday }}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">
            Scheduled check-ins
          </div>
        </div>

        <div class="rounded-lg border bg-muted/30 p-3">
          <div class="text-xs font-medium text-muted-foreground">
            Departures today
          </div>
          <div class="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {{ props.kpis.departuresToday }}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">
            Check-outs & turns
          </div>
        </div>
      </div>

      <div
        v-if="props.kpis.unassignedArrivals > 0"
        class="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300"
      >
        <div class="flex items-center gap-2">
          <Icon name="lucide:shield-alert" class="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{{ props.kpis.unassignedArrivals }} unverified arrivals require guest registration before check-in</span>
        </div>
        <Button variant="ghost" size="sm" class="h-7 text-xs" as-child>
          <NuxtLink to="/guest-registration">
            Review
          </NuxtLink>
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
