<script setup lang="ts">
import type { RevenueBreakdown } from '~/components/analytics/data/revenue-basis'
import { formatOwnerMoney } from '~/components/owners/data/owner-money'

// Gross down to owner net for the whole period, each line as a share of
// gross. Independent of the revenue basis switch: this is the whole ladder.
const props = defineProps<{
  totals: RevenueBreakdown
  currency: string
}>()

const rows = computed(() => {
  const t = props.totals
  const share = (v: number) => t.gross ? `${((v / t.gross) * 100).toFixed(1)}%` : '-'
  return [
    { label: 'Gross', value: t.gross, share: share(t.gross), kind: 'total' as const },
    { label: 'OTA commission', value: -t.otaCommission, share: share(t.otaCommission), kind: 'cost' as const },
    { label: 'Payment fees', value: -t.paymentFees, share: share(t.paymentFees), kind: 'cost' as const },
    { label: 'Net', value: t.net, share: share(t.net), kind: 'total' as const },
    { label: 'Management commission', value: -t.managementCommission, share: share(t.managementCommission), kind: 'cost' as const },
    { label: 'Owner net', value: t.ownerNet, share: share(t.ownerNet), kind: 'total' as const },
  ]
})

function money(v: number) {
  return v < 0 ? `- ${formatOwnerMoney(-v, props.currency)}` : formatOwnerMoney(v, props.currency)
}
</script>

<template>
  <Card class="flex h-full flex-col" data-testid="analytics-breakdown-table">
    <CardHeader>
      <CardTitle class="text-base">
        Gross to owner net
      </CardTitle>
      <CardDescription>The whole period, {{ currency }}. Shares are of gross.</CardDescription>
    </CardHeader>
    <CardContent class="flex-1">
      <Table>
        <TableBody>
          <TableRow v-for="row in rows" :key="row.label" :class="row.kind === 'total' ? 'font-medium' : ''">
            <TableCell :class="row.kind === 'cost' ? 'pl-6 text-muted-foreground' : ''">
              {{ row.label }}
            </TableCell>
            <TableCell class="text-right tabular-nums" :class="row.kind === 'cost' ? 'text-muted-foreground' : ''">
              {{ money(row.value) }}
            </TableCell>
            <TableCell class="w-16 text-right text-xs tabular-nums text-muted-foreground">
              {{ row.share }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
