<script setup lang="ts">
import type { ListingPerformanceRow } from '~/components/analytics/data/analytics'
import { LIFECYCLE_LABELS } from '~/components/analytics/data/analytics'
import { formatSignedPoints } from '~/components/gm/data/gm-dashboard'
import { formatOwnerMoneyRounded } from '~/components/owners/data/owner-money'

const props = defineProps<{ rows: ListingPerformanceRow[] }>()

type SortKey = 'listingName' | 'occupancy' | 'adr' | 'revpar' | 'revenue' | 'stays'

const COLUMNS: { key: SortKey, label: string, numeric: boolean }[] = [
  { key: 'listingName', label: 'Listing', numeric: false },
  { key: 'occupancy', label: 'Occupancy', numeric: true },
  { key: 'adr', label: 'ADR', numeric: true },
  { key: 'revpar', label: 'RevPAR', numeric: true },
  { key: 'revenue', label: 'Revenue', numeric: true },
  { key: 'stays', label: 'Stays', numeric: true },
]

const sortKey = ref<SortKey>('occupancy')
const sortDesc = ref(true)

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDesc.value = !sortDesc.value
    return
  }
  sortKey.value = key
  sortDesc.value = key !== 'listingName'
}

/**
 * Money columns hold several currencies and are never converted, so they sort
 * by currency first, then amount: a USD villa is not "bigger" than a EUR flat.
 */
const sorted = computed(() => {
  const key = sortKey.value
  const money = key === 'adr' || key === 'revpar' || key === 'revenue'
  const dir = sortDesc.value ? -1 : 1
  return [...props.rows].sort((a, b) => {
    if (money && a.currency !== b.currency)
      return a.currency.localeCompare(b.currency)
    const x = a[key]
    const y = b[key]
    const cmp = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)
    return cmp * dir || a.listingName.localeCompare(b.listingName)
  })
})

function sortIcon(key: SortKey) {
  if (sortKey.value !== key)
    return 'lucide:chevrons-up-down'
  return sortDesc.value ? 'lucide:arrow-down' : 'lucide:arrow-up'
}

function ariaSort(key: SortKey) {
  if (sortKey.value !== key)
    return 'none'
  return sortDesc.value ? 'descending' : 'ascending'
}
</script>

<template>
  <Card class="flex h-full flex-col" data-testid="analytics-listing-table">
    <CardHeader>
      <CardTitle>Listing performance</CardTitle>
      <CardDescription>Each listing in the currency it earns in. Occupancy change, when shown, is against the comparison period.</CardDescription>
    </CardHeader>
    <CardContent class="flex-1 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              v-for="col in COLUMNS"
              :key="col.key"
              :aria-sort="ariaSort(col.key)"
              :class="col.numeric ? 'text-right' : ''"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-foreground"
                :class="sortKey === col.key ? 'text-foreground' : ''"
                @click="sortBy(col.key)"
              >
                {{ col.label }}
                <Icon :name="sortIcon(col.key)" class="size-3.5" />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in sorted" :key="row.listingId" data-testid="analytics-listing-row">
            <TableCell class="max-w-[260px]">
              <div class="flex min-w-0 items-center gap-1.5">
                <!-- A deleted (or demo-only) listing has no page to open. -->
                <span v-if="!row.linkable" class="truncate font-medium">{{ row.listingName }}</span>
                <NuxtLink v-else :to="`/listings/${row.listingId}`" class="truncate font-medium hover:underline">
                  {{ row.listingName }}
                </NuxtLink>
                <Badge
                  v-if="row.lifecycle !== 'active'"
                  variant="outline"
                  class="shrink-0 px-1.5 py-0 text-[10px] text-muted-foreground"
                  data-testid="analytics-lifecycle-badge"
                >
                  {{ LIFECYCLE_LABELS[row.lifecycle] }}
                </Badge>
              </div>
              <span class="block truncate text-xs text-muted-foreground">{{ row.location }}</span>
            </TableCell>
            <TableCell class="text-right tabular-nums">
              <div class="font-medium">
                {{ Math.round(row.occupancy * 100) }}%
              </div>
              <div
                v-if="row.occupancyDelta !== null"
                class="text-xs"
                :class="row.occupancyDelta > 0.0005 ? 'text-green-700 dark:text-green-400' : row.occupancyDelta < -0.0005 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'"
              >
                {{ formatSignedPoints(row.occupancyDelta) }}
              </div>
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ formatOwnerMoneyRounded(row.adr, row.currency) }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ formatOwnerMoneyRounded(row.revpar, row.currency) }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ formatOwnerMoneyRounded(row.revenue, row.currency) }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ row.stays }}
            </TableCell>
          </TableRow>
          <TableEmpty v-if="!rows.length" :colspan="COLUMNS.length">
            No listings match these filters
          </TableEmpty>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
