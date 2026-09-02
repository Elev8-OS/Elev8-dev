<script setup lang="ts">
import type { OwnerStatementField } from '~/components/owners/data/owner-permissions'
import type { OwnerStatementLine } from '~/components/owners/data/owner-statements'
import { computed, ref, toRef } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwnerStatementDetail } from '~/composables/useOwnerStatementDetail'
import { useOwnerStatements } from '~/composables/useOwnerStatements'
import PortalChannelBreakdown from './PortalChannelBreakdown.vue'
import PortalExportButtons from './PortalExportButtons.vue'
import PortalRaiseIssueDialog from './PortalRaiseIssueDialog.vue'
import PortalStatementAdjustments from './PortalStatementAdjustments.vue'
import PortalStatementReservations from './PortalStatementReservations.vue'
import PortalStatementSummary from './PortalStatementSummary.vue'

const props = defineProps<{ statementId: string }>()

const statementId = toRef(props, 'statementId')
const { detail, isNotFound } = useOwnerStatementDetail(statementId)
const { issues } = useOwnerStatements()

const statement = computed(() => detail.value.statement)
const listingName = computed(() => {
  const id = statement.value?.listingId
  return listings.value.find(l => l.id === id)?.name ?? id ?? 'Property'
})

const sourceLines = computed(() => {
  if (!statement.value)
    return []
  return statement.value.publishedSnapshot?.lines ?? statement.value.lines
})

const totalAmount = computed(() => {
  if (!statement.value)
    return 0
  return statement.value.publishedSnapshot?.totalAmount ?? statement.value.totalAmount
})

const currency = computed(() => {
  if (!statement.value)
    return ''
  return statement.value.publishedSnapshot?.currency ?? statement.value.currency
})

// useOwnerPortal's canViewStatementField is the actual gate; we derive
// section visibility from the same gate as the existing implementation.
const portal = useOwnerPortal()

function canView(field: OwnerStatementField) {
  return portal.canViewStatementField(field)
}

const fieldForCategory: Record<OwnerStatementLine['category'], OwnerStatementField> = {
  revenue: 'revenueLines',
  expense: 'expenseDetails',
  commission: 'commissionDetails',
  tax: 'taxesAndFees',
  fee: 'taxesAndFees',
  adjustment: 'adjustments',
}

const sectionLabels: Record<OwnerStatementField, string> = {
  revenueLines: 'Revenue',
  expenseDetails: 'Operating expenses',
  commissionDetails: 'Commission',
  taxesAndFees: 'Taxes & fees',
  adjustments: 'Adjustments',
  netPayout: 'Net payout',
}

const sectionOrder: OwnerStatementField[] = [
  'revenueLines',
  'expenseDetails',
  'commissionDetails',
  'taxesAndFees',
  'adjustments',
]

const visibleSections = computed(() => sectionOrder
  .filter(field => canView(field))
  .map(field => ({
    field,
    label: sectionLabels[field],
    lines: sourceLines.value.filter(line => fieldForCategory[line.category] === field),
  }))
  .filter(section => section.lines.length > 0))

const selectedLine = ref<OwnerStatementLine | null>(null)
const issueDialogOpen = ref(false)

function openIssue(line: OwnerStatementLine) {
  selectedLine.value = line
  issueDialogOpen.value = true
}

function formatCurrency(amount: number) {
  return `${currency.value} ${amount.toLocaleString('id-ID')}`
}

function hasOpenIssue(lineId: string) {
  if (!statement.value)
    return false
  return issues.value.some(issue => issue.statementId === statement.value!.id
    && issue.lineId === lineId
    && !issue.resolvedAt)
}
</script>

<template>
  <div v-if="statement" data-print-target class="space-y-6">
    <div data-portal-chrome class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="space-y-1">
        <NuxtLink
          to="/owner-portal/statements"
          class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Icon name="lucide:arrow-left" class="size-4" aria-hidden="true" />
          Statements
        </NuxtLink>
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ listingName }}
          </h1>
          <Badge variant="secondary">
            Published
          </Badge>
        </div>
        <p class="text-sm text-muted-foreground">
          Statement for {{ statement.period }} · Published {{ statement.publishedAt ? new Date(statement.publishedAt).toLocaleDateString('en-US') : '—' }}
        </p>
      </div>
      <PortalExportButtons :statement-id="statement.id" />
    </div>

    <!-- Print-only header (visible only in print) -->
    <div data-print-only class="hidden border-b pb-4 print:block">
      <p class="text-sm text-muted-foreground">
        Owner statement
      </p>
      <p class="text-lg font-semibold">
        {{ listingName }} · {{ statement.period }}
      </p>
    </div>

    <PortalStatementSummary :detail="detail" />

    <PortalChannelBreakdown
      v-if="detail.channelBreakdown.length > 0"
      :breakdown="detail.channelBreakdown"
      :currency="currency"
    />

    <PortalStatementReservations
      v-if="detail.reservations.length > 0"
      :reservations="detail.reservations"
      :currency="currency"
    />

    <PortalStatementAdjustments
      v-if="detail.adjustments.length > 0"
      :adjustments="detail.adjustments"
      :currency="currency"
    />

    <Card class="print-no-break">
      <CardHeader>
        <CardTitle>Statement details</CardTitle>
        <CardDescription>
          Published values are read-only. Raise an issue on a line if Finance needs to review it.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <section
          v-for="section in visibleSections"
          :key="section.field"
          :data-testid="`statement-section-${section.field}`"
          class="space-y-2"
        >
          <h2 class="text-sm font-medium">
            {{ section.label }}
          </h2>
          <div class="divide-y rounded-md border">
            <div
              v-for="line in section.lines"
              :key="line.id"
              class="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <p class="text-sm">
                  {{ line.label }}
                </p>
                <p v-if="hasOpenIssue(line.id)" class="mt-1 text-xs text-primary">
                  Issue open with Finance
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <span
                  class="text-sm font-medium tabular-nums"
                  :class="line.amount < 0 ? 'text-destructive' : ''"
                >
                  {{ formatCurrency(line.amount) }}
                </span>
                <Button
                  data-portal-chrome
                  variant="ghost"
                  size="sm"
                  :data-testid="`raise-issue-${line.id}`"
                  :aria-label="`Raise an issue for ${line.label}`"
                  @click="openIssue(line)"
                >
                  <Icon name="lucide:flag" class="mr-2 size-4" aria-hidden="true" />
                  {{ hasOpenIssue(line.id) ? 'View issue' : 'Raise issue' }}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="canView('netPayout')"
          data-testid="statement-section-netPayout"
          class="flex items-center justify-between border-t pt-4"
        >
          <h2 class="text-base font-semibold">
            Net owner payout
          </h2>
          <span class="text-base font-semibold tabular-nums">
            {{ formatCurrency(totalAmount) }}
          </span>
        </section>
      </CardContent>
    </Card>

    <PortalRaiseIssueDialog
      v-if="selectedLine"
      v-model:open="issueDialogOpen"
      :statement-id="statement.id"
      :line-id="selectedLine.id"
      :line-label="selectedLine.label"
      :amount="selectedLine.amount"
    />
  </div>

  <div v-else data-testid="statement-not-found" class="flex min-h-72 items-center justify-center rounded-lg border border-dashed p-8 text-center" role="status">
    <div class="space-y-2">
      <Icon name="lucide:file-x-2" class="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <h1 class="text-lg font-semibold">
        {{ isNotFound ? 'Statement not found' : 'Loading…' }}
      </h1>
      <p class="max-w-sm text-sm text-muted-foreground">
        This statement is not available in your owner portal.
      </p>
      <Button data-portal-chrome as-child variant="outline" size="sm">
        <NuxtLink to="/owner-portal/statements">
          Back to statements
        </NuxtLink>
      </Button>
    </div>
  </div>
</template>

<style>
@media print {
  [data-portal-chrome] {
    display: none !important;
  }
  [data-print-target] {
    max-width: 100% !important;
    padding: 0 !important;
  }
  [data-print-only] {
    display: block !important;
  }
  .print-no-break {
    break-inside: avoid;
  }
  @page {
    margin: 1.5cm;
  }
}
</style>
