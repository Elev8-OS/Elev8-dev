<script setup lang="ts">
// StatementTable — sortable, paginated table for owner statement lists
// (drafts + published). Reused by OwnerStatementsPanel.

import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

interface Row {
  id: string
  ownerLabel: string
  listingId: string
  period: string
  currency: string
  totalAmount: number
  openIssues: number
}

const props = defineProps<{
  rows: Row[]
  total: number
  totalPages: number
  currentPage: number
  sortKey: 'owner' | 'listing' | 'period' | 'amount' | 'issues'
  sortDir: 'asc' | 'desc'
  mode: 'draft' | 'published'
}>()

const emit = defineEmits<{
  toggleSort: [key: 'owner' | 'listing' | 'period' | 'amount' | 'issues']
  pageChange: [page: number]
  publish: [id: string]
  adjust: [id: string]
}>()

function sortIcon(key: RowKey) {
  if (props.sortKey !== key)
    return 'lucide:chevrons-up-down'
  return props.sortDir === 'asc' ? 'lucide:chevron-up' : 'lucide:chevron-down'
}

type RowKey = 'owner' | 'listing' | 'period' | 'amount' | 'issues'

function formatAmount(row: Row) {
  return `${row.currency} ${row.totalAmount.toLocaleString('en-US')}`
}

function pageNumbers(): (number | 'ellipsis')[] {
  const total = props.totalPages
  if (total <= 5)
    return Array.from({ length: total }, (_, i) => i + 1)
  const current = props.currentPage
  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = Array.from(pages).filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1)
      result.push('ellipsis')
    result.push(p)
    prev = p
  }
  return result
}
</script>

<template>
  <div class="space-y-3">
    <div class="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                type="button"
                class="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-muted-foreground"
                @click="emit('toggleSort', 'owner')"
              >
                Owner
                <Icon :name="sortIcon('owner')" class="size-3.5" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                class="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-muted-foreground"
                @click="emit('toggleSort', 'listing')"
              >
                Listing
                <Icon :name="sortIcon('listing')" class="size-3.5" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                class="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-muted-foreground"
                @click="emit('toggleSort', 'period')"
              >
                Period
                <Icon :name="sortIcon('period')" class="size-3.5" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                class="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-muted-foreground"
                @click="emit('toggleSort', 'amount')"
              >
                Amount
                <Icon :name="sortIcon('amount')" class="size-3.5" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                class="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-muted-foreground"
                @click="emit('toggleSort', 'issues')"
              >
                Issues
                <Icon :name="sortIcon('issues')" class="size-3.5" />
              </button>
            </TableHead>
            <TableHead class="text-right">
              <span class="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in rows" :key="row.id">
            <TableCell class="font-medium">
              {{ row.ownerLabel }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ row.listingId }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ row.period }}
            </TableCell>
            <TableCell class="font-medium tabular-nums">
              {{ formatAmount(row) }}
            </TableCell>
            <TableCell>
              <Badge v-if="row.openIssues > 0" variant="destructive">
                {{ row.openIssues }}
              </Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell class="text-right">
              <Button
                v-if="mode === 'draft'"
                variant="default"
                size="sm"
                @click="emit('publish', row.id)"
              >
                Publish
              </Button>
              <Button
                v-else
                variant="outline"
                size="sm"
                @click="emit('adjust', row.id)"
              >
                Add adjustment
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div v-if="totalPages > 1" class="flex flex-wrap items-center justify-between gap-4">
      <div class="text-xs text-muted-foreground">
        Showing {{ (currentPage - 1) * 8 + 1 }}–{{ Math.min(currentPage * 8, total) }} of {{ total }} statements
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          :disabled="currentPage === 1"
          @click="emit('pageChange', currentPage - 1)"
        >
          <Icon name="lucide:chevron-left" class="size-4" />
        </Button>
        <template v-for="(p, i) in pageNumbers()" :key="p === 'ellipsis' ? `e-${i}` : p">
          <span v-if="p === 'ellipsis'" class="px-1 text-sm text-muted-foreground">…</span>
          <Button
            v-else
            variant="ghost"
            size="sm"
            class="min-w-8 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            :data-active="currentPage === p || undefined"
            @click="emit('pageChange', p)"
          >
            {{ p }}
          </Button>
        </template>
        <Button
          variant="outline"
          size="sm"
          :disabled="currentPage === totalPages"
          @click="emit('pageChange', currentPage + 1)"
        >
          <Icon name="lucide:chevron-right" class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
