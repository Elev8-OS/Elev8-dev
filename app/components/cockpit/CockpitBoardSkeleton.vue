<script setup lang="ts">
import { Skeleton } from '~/components/ui/skeleton'

/**
 * The Cockpit board while it loads (the board is client-only): the same
 * frame as `CockpitTimeline`, with the listing column, the date header, and a
 * few listings with bars. Fixed shapes, so the server and client agree.
 */
const DAYS = 14

/** Per listing: its unit rows, each a list of bars as [first day, nights]. */
const GROUPS: Array<Array<Array<[number, number]>>> = [
  [[[0, 3], [4, 5], [11, 3]], [[2, 4], [8, 2]], [[1, 6], [9, 4]]],
  [[[3, 3], [7, 5]]],
  [[[0, 2], [5, 4], [12, 2]], [[1, 3], [6, 6]]],
]

const columns = `var(--cockpit-left) repeat(${DAYS}, 7rem)`

/** Bars run midday to midday, like the real ones; one running past the last day stops at the edge. */
function barColumn([start, nights]: [number, number]) {
  const first = start * 2 + 3
  const end = Math.min(first + nights * 2, DAYS * 2 + 2)
  return `${first} / ${end}`
}
</script>

<template>
  <div
    class="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card [--cockpit-left:9rem] md:[--cockpit-left:17rem]"
    role="status"
    aria-busy="true"
    data-testid="cockpit-skeleton"
  >
    <span class="sr-only">Loading the board</span>
    <div class="min-w-max" aria-hidden="true">
      <!-- Header: tools, then the dates -->
      <div class="grid border-b" :style="{ gridTemplateColumns: columns }">
        <div class="flex flex-col gap-2 border-r p-2">
          <div class="hidden gap-1.5 md:flex">
            <Skeleton class="size-9 rounded-md" />
            <Skeleton class="size-9 rounded-md" />
          </div>
          <Skeleton class="hidden h-8 w-full md:block" />
          <Skeleton class="h-4 w-20" />
        </div>
        <div v-for="d in DAYS" :key="d" class="flex flex-col items-center justify-end gap-1.5 border-r pt-2 pb-1.5 last:border-r-0">
          <Skeleton class="h-3 w-8" />
          <Skeleton class="size-8 rounded-md" />
          <Skeleton class="h-2.5 w-6" />
        </div>
      </div>

      <template v-for="(rows, g) in GROUPS" :key="g">
        <!-- Listing header row -->
        <div class="grid border-b bg-muted/60" :style="{ gridTemplateColumns: columns }">
          <div class="flex min-h-14 items-center gap-2 border-r px-3">
            <div class="flex flex-1 flex-col gap-1.5">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="hidden h-3 w-1/2 md:block" />
            </div>
            <Skeleton class="size-7 rounded-full" />
          </div>
          <div v-for="d in DAYS" :key="d" class="flex flex-col items-center justify-center gap-1 border-r last:border-r-0">
            <Skeleton class="h-3 w-3" />
            <Skeleton class="h-4 w-12 rounded-full" />
          </div>
        </div>

        <!-- Unit rows: the room name, then bars across two half-day columns per day -->
        <div
          v-for="(bars, r) in rows"
          :key="r"
          class="grid border-b"
          :style="{ gridTemplateColumns: `var(--cockpit-left) repeat(${DAYS * 2}, 3.5rem)` }"
        >
          <div class="flex h-10 items-center gap-2 border-r px-3" :style="{ gridColumn: '1', gridRow: '1' }">
            <Skeleton class="h-3.5 w-24" />
            <Skeleton class="ml-auto size-5 rounded-full" />
            <Skeleton class="size-5 rounded-full" />
          </div>
          <div
            v-for="(bar, b) in bars"
            :key="b"
            class="my-1 flex items-center"
            :style="{ gridColumn: barColumn(bar), gridRow: '1' }"
          >
            <Skeleton class="h-8 w-full rounded-sm" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
