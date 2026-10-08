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

/* Pagination, the same controls as the upsell orders table. */
const PAGE_SIZES = [10, 20, 50]
const pageSize = ref(10)
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.rows.length / pageSize.value)))
const pageRows = computed(() => sorted.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value))
const rangeLabel = computed(() => {
  if (!props.rows.length)
    return '0 listings'
  const first = (currentPage.value - 1) * pageSize.value + 1
  const last = Math.min(currentPage.value * pageSize.value, props.rows.length)
  return `${first}-${last} of ${props.rows.length} listings`
})

// A new order or a narrower filter starts again from the first page.
watch([sortKey, sortDesc, pageSize], () => {
  currentPage.value = 1
})
watch(() => props.rows.length, () => {
  currentPage.value = Math.min(currentPage.value, totalPages.value)
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
          <TableRow v-for="row in pageRows" :key="row.listingId" data-testid="analytics-listing-row">
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
    <CardFooter class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2" data-testid="analytics-listing-pagination">
      <span class="text-sm text-muted-foreground tabular-nums">{{ rangeLabel }}</span>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">Rows per page</span>
          <Select :model-value="`${pageSize}`" @update:model-value="(v) => pageSize = Number(v)">
            <SelectTrigger size="sm" class="h-8 w-[70px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem v-for="n in PAGE_SIZES" :key="n" :value="`${n}`">
                {{ n }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span class="text-sm font-medium tabular-nums" data-testid="analytics-listing-page">Page {{ currentPage }} of {{ totalPages }}</span>
        <div class="flex items-center gap-2">
          <Button variant="outline" class="size-8 p-0" :disabled="currentPage <= 1" aria-label="First page" @click="currentPage = 1">
            <Icon name="lucide:chevrons-left" class="size-4" />
          </Button>
          <Button variant="outline" class="size-8 p-0" :disabled="currentPage <= 1" aria-label="Previous page" @click="currentPage -= 1">
            <Icon name="lucide:chevron-left" class="size-4" />
          </Button>
          <Button variant="outline" class="size-8 p-0" :disabled="currentPage >= totalPages" aria-label="Next page" @click="currentPage += 1">
            <Icon name="lucide:chevron-right" class="size-4" />
          </Button>
          <Button variant="outline" class="size-8 p-0" :disabled="currentPage >= totalPages" aria-label="Last page" @click="currentPage = totalPages">
            <Icon name="lucide:chevrons-right" class="size-4" />
          </Button>
        </div>
      </div>
    </CardFooter>
  </Card>
</template>
