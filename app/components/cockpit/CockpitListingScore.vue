<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import { listingSetupProgress } from '~/components/listings/data/listing-setup-progress'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '~/components/ui/hover-card'

/**
 * A listing's score on the Cockpit header row: a ring gauge of its Listing
 * Setup completion (`listingSetupProgress`, the same number as the setup
 * page). Hover shows the score per section and what is still missing.
 */
const props = defineProps<{ listing: Listing }>()

const progress = computed(() => listingSetupProgress(props.listing))
const incomplete = computed(() => progress.value.sections.filter(s => !s.complete))

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Red under 50, amber under 80, primary from 80. */
const tone = computed(() => {
  const p = progress.value.percent
  if (p < 50)
    return 'text-destructive'
  if (p < 80)
    return 'text-warning'
  return 'text-primary'
})
</script>

<template>
  <HoverCard :open-delay="150" :close-delay="100">
    <HoverCardTrigger as-child>
      <NuxtLink
        :to="`/listings/${listing.id}/setup`"
        class="relative flex size-7 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        :aria-label="`Listing score ${progress.percent}%. Open Listing Setup.`"
        data-testid="cockpit-listing-score"
      >
        <svg viewBox="0 0 24 24" class="absolute inset-0 size-full -rotate-90" aria-hidden="true">
          <circle cx="12" cy="12" :r="RADIUS" fill="none" stroke-width="3" class="stroke-muted" />
          <circle
            cx="12"
            cy="12"
            :r="RADIUS"
            fill="none"
            stroke-width="3"
            stroke-linecap="round"
            stroke="currentColor"
            :class="tone"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="CIRCUMFERENCE * (1 - progress.percent / 100)"
          />
        </svg>
        <span class="relative text-[9px] font-semibold tabular-nums">{{ progress.percent }}</span>
      </NuxtLink>
    </HoverCardTrigger>
    <HoverCardContent class="w-72 p-0" align="start" side="right">
      <div class="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div class="min-w-0">
          <p class="text-xs text-muted-foreground">
            Listing score
          </p>
          <p class="truncate text-sm font-medium">
            {{ listing.name }}
          </p>
        </div>
        <span class="text-xl font-bold tabular-nums" :class="tone">{{ progress.percent }}%</span>
      </div>
      <ul class="flex flex-col gap-1 px-3 py-2">
        <li v-for="s in progress.sections" :key="s.key" class="flex items-center gap-2 text-sm">
          <Icon :name="s.complete ? 'lucide:circle-check' : s.icon" class="size-4 shrink-0" :class="s.complete ? 'text-primary' : 'text-muted-foreground'" />
          <span class="flex-1">{{ s.label }}</span>
          <span class="text-xs text-muted-foreground tabular-nums">{{ s.done }}/{{ s.total }}</span>
        </li>
      </ul>
      <div v-if="incomplete.length" class="border-t px-3 py-2" data-testid="cockpit-listing-score-missing">
        <p class="mb-1 text-xs font-medium text-muted-foreground">
          Still missing
        </p>
        <ul class="flex flex-col gap-1 text-xs">
          <li v-for="s in incomplete" :key="s.key">
            <span class="font-medium">{{ s.label }}:</span>
            {{ s.missing.length ? s.missing.join(', ') : 'Nothing to fill in yet' }}
          </li>
        </ul>
      </div>
      <p v-else class="border-t px-3 py-2 text-xs text-muted-foreground">
        Everything is filled in.
      </p>
      <div class="border-t p-1">
        <NuxtLink :to="`/listings/${listing.id}/setup`" class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          <Icon name="lucide:settings-2" class="size-3.5" />
          Open Listing Setup
        </NuxtLink>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
