<script setup lang="ts">
// StatementIssuesPanel — the staff worklist for owner statement disputes.
//
// Before this existed, an issue raised in the owner portal surfaced only as a
// red count badge on the statements table: staff could see that three lines
// were disputed but never what was disputed, and nothing in the UI could
// close one. This is the list; `StatementIssueDrawer` is where a dispute is
// answered and closed.

import { computed, ref } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { mockOwners } from '~/components/owners/data/owners'
import StatementIssueDrawer from '~/components/owners/StatementIssueDrawer.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const { issues, statements } = useOwnerStatements()

const filter = ref<'open' | 'resolved'>('open')
const selectedIssueId = ref<string | null>(null)
const drawerOpen = ref(false)

const rows = computed(() => issues.value.map((issue) => {
  const statement = statements.value.find(s => s.id === issue.statementId)
  const lines = statement?.publishedSnapshot?.lines ?? statement?.lines ?? []
  const line = lines.find(l => l.id === issue.lineId)
  return {
    id: issue.id,
    ownerLabel: mockOwners.find(o => o.id === statement?.ownerId)?.name ?? statement?.ownerId ?? '—',
    listingLabel: listings.value.find(l => l.id === statement?.listingId)?.name ?? statement?.listingId ?? '—',
    period: statement?.period ?? '—',
    lineLabel: line?.label ?? 'Statement line',
    currency: statement?.publishedSnapshot?.currency ?? statement?.currency ?? '',
    amount: issue.amount,
    createdAt: issue.createdAt,
    resolvedAt: issue.resolvedAt,
    resolutionType: issue.resolution?.type,
    replies: issue.thread?.length ?? 0,
  }
}))

const openRows = computed(() => rows.value
  .filter(row => !row.resolvedAt)
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

const resolvedRows = computed(() => rows.value
  .filter(row => row.resolvedAt)
  .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')))

const visibleRows = computed(() => filter.value === 'open' ? openRows.value : resolvedRows.value)

function openIssue(id: string) {
  selectedIssueId.value = id
  drawerOpen.value = true
}

function formatAmount(row: { currency: string, amount: number }) {
  return `${row.currency} ${row.amount.toLocaleString('en-US')}`
}

function formatDate(iso?: string) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
}

// Oldest first in the open list, so the age of the worst-neglected dispute is
// the first thing on screen rather than something staff have to sort for.
function daysOpen(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : `${days}d`
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <Button
        :variant="filter === 'open' ? 'default' : 'outline'"
        size="sm"
        data-testid="issues-filter-open"
        @click="filter = 'open'"
      >
        Open ({{ openRows.length }})
      </Button>
      <Button
        :variant="filter === 'resolved' ? 'default' : 'outline'"
        size="sm"
        data-testid="issues-filter-resolved"
        @click="filter = 'resolved'"
      >
        Resolved ({{ resolvedRows.length }})
      </Button>
    </div>

    <div
      v-if="visibleRows.length === 0"
      class="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground"
      data-testid="issues-empty"
    >
      <Icon name="lucide:message-square-check" class="size-6 opacity-60" />
      <p>
        {{ filter === 'open' ? 'No open issues. Owners have nothing outstanding.' : 'No resolved issues yet.' }}
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Owner</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Line</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>{{ filter === 'open' ? 'Waiting' : 'Resolved' }}</TableHead>
            <TableHead class="text-right">
              <span class="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in visibleRows" :key="row.id" data-testid="issue-row">
            <TableCell class="font-medium">
              {{ row.ownerLabel }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ row.listingLabel }} · {{ row.period }}
            </TableCell>
            <TableCell>
              <span>{{ row.lineLabel }}</span>
              <span v-if="row.replies > 0" class="ml-2 text-xs text-muted-foreground">
                {{ row.replies }} {{ row.replies === 1 ? 'reply' : 'replies' }}
              </span>
            </TableCell>
            <TableCell class="tabular-nums" :class="row.amount < 0 ? 'text-destructive' : ''">
              {{ formatAmount(row) }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              <template v-if="!row.resolvedAt">
                {{ daysOpen(row.createdAt) }}
              </template>
              <template v-else>
                <Badge variant="secondary">
                  {{ row.resolutionType === 'adjusted' ? 'Adjusted' : 'Explained' }}
                </Badge>
                <span class="ml-2 text-xs">{{ formatDate(row.resolvedAt) }}</span>
              </template>
            </TableCell>
            <TableCell class="text-right">
              <Button variant="outline" size="sm" :data-testid="`issue-open-${row.id}`" @click="openIssue(row.id)">
                {{ row.resolvedAt ? 'View' : 'Review' }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <StatementIssueDrawer v-model:open="drawerOpen" :issue-id="selectedIssueId" />
  </div>
</template>
