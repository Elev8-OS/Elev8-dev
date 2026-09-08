<script setup lang="ts">
/**
 * One banner per page, highest priority only (PRD 9): plan inactive, import
 * failed, importing, then reconnect channels. `activeBanner` decides which,
 * so no page can stack two.
 */
const { activeBanner, importFailedCount, importJobs, isImporting } = useOnboarding()

const importPercent = computed(() => {
  const total = importJobs.value.reduce((sum, j) => sum + j.totalCount, 0)
  const done = importJobs.value.reduce((sum, j) => sum + j.processedCount, 0)
  return total === 0 ? 0 : Math.round((done / total) * 100)
})
</script>

<template>
  <div v-if="activeBanner" data-testid="onboarding-banner">
    <!-- Plan inactive -->
    <div
      v-if="activeBanner === 'plan_inactive'"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
    >
      <div class="flex items-start gap-2.5">
        <Icon name="lucide:circle-alert" class="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p class="text-sm font-medium text-destructive">
            Your plan is not active yet
          </p>
          <p class="text-xs text-destructive/90">
            Save a card to activate it. Billing features stay locked until you do.
          </p>
        </div>
      </div>
      <Button as-child size="sm" variant="destructive">
        <NuxtLink to="/onboarding">
          Retry payment
        </NuxtLink>
      </Button>
    </div>

    <!-- Import finished with failures -->
    <div
      v-else-if="activeBanner === 'import_failed'"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3"
    >
      <div class="flex items-start gap-2.5">
        <Icon name="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div>
          <p class="text-sm font-medium text-amber-900">
            {{ importFailedCount }} item{{ importFailedCount === 1 ? '' : 's' }} did not import
          </p>
          <p class="text-xs text-amber-800">
            Everything else came through. You can retry the rest one at a time.
          </p>
        </div>
      </div>
      <Button as-child size="sm" variant="outline">
        <NuxtLink to="/settings/integrations">
          See what failed
        </NuxtLink>
      </Button>
    </div>

    <!-- Import running -->
    <div
      v-else-if="activeBanner === 'importing'"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/60 px-4 py-3"
    >
      <div class="flex items-start gap-2.5">
        <Icon name="lucide:loader-2" class="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
        <div>
          <p class="text-sm font-medium">
            Importing your data, {{ importPercent }}% done
          </p>
          <p class="text-xs text-muted-foreground">
            You can keep working. Listings and reservations fill in as they arrive.
          </p>
        </div>
      </div>
      <Button as-child size="sm" variant="outline" :disabled="!isImporting">
        <NuxtLink to="/onboarding">
          View progress
        </NuxtLink>
      </Button>
    </div>

    <!-- Channels not reconnected after a migration -->
    <div
      v-else-if="activeBanner === 'reconnect_channels'"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3"
    >
      <div class="flex items-start gap-2.5">
        <Icon name="lucide:unplug" class="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div>
          <p class="text-sm font-medium text-amber-900">
            Your channels are not connected
          </p>
          <p class="text-xs text-amber-800">
            Rates and availability are not being sent anywhere until you reconnect at least one.
          </p>
        </div>
      </div>
      <Button as-child size="sm" variant="outline">
        <NuxtLink to="/onboarding">
          Reconnect channels
        </NuxtLink>
      </Button>
    </div>
  </div>
</template>
