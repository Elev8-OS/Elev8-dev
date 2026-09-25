<script setup lang="ts">
import type { PartnerClaimRow } from '~/composables/usePartnerClaims'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { PARTNER_STATUS_LABELS, payoutShortfall } from '~/components/reservations/data/partner-claims'

/** Waiver claims that are, or could be, with the insurance partner. */
defineProps<{
  rows: PartnerClaimRow[]
  emptyLabel: string
}>()

const emit = defineEmits<{ open: [PartnerClaimRow] }>()

function money(row: PartnerClaimRow, amount: number | undefined): string {
  return amount === undefined ? '—' : formatProtectionAmount(amount, row.protection.currency)
}

function claimable(row: PartnerClaimRow): number | undefined {
  if (row.partnerClaim)
    return row.partnerClaim.claimedAmount
  return row.eligibility.eligible ? row.eligibility.claimable : undefined
}

function statusLabel(row: PartnerClaimRow): string {
  return row.partnerClaim ? PARTNER_STATUS_LABELS[row.partnerClaim.status] : 'Not filed'
}
</script>

<template>
  <div class="rounded-md border">
    <div class="overflow-x-auto">
      <table class="w-full text-sm" data-testid="partner-claim-table">
        <thead class="bg-muted/50 text-xs text-muted-foreground uppercase">
          <tr>
            <th class="px-4 py-3 text-left font-medium">
              Guest
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Claim
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Partner ref
            </th>
            <th class="px-4 py-3 text-right font-medium">
              Claimed
            </th>
            <th class="px-4 py-3 text-right font-medium">
              Approved
            </th>
            <th class="px-4 py-3 text-right font-medium">
              Received
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="7" class="px-4 py-10 text-center text-muted-foreground">
              {{ emptyLabel }}
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.claim.id"
            class="cursor-pointer border-t transition-colors hover:bg-muted/30"
            @click="emit('open', row)"
          >
            <td class="px-4 py-3">
              <p>{{ row.reservation.guestName }}</p>
              <p class="text-xs text-muted-foreground">
                {{ row.reservation.listingName }}
              </p>
            </td>
            <td class="px-4 py-3">
              {{ row.claim.label }}
            </td>
            <td class="px-4 py-3 tabular-nums">
              {{ row.partnerClaim?.partnerClaimRef ?? '—' }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums">
              {{ money(row, claimable(row)) }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums">
              {{ money(row, row.partnerClaim?.approvedAmount) }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums">
              {{ money(row, row.partnerClaim?.receivedAmount) }}
              <p v-if="row.partnerClaim && payoutShortfall(row.partnerClaim) > 0" class="text-xs text-amber-700 dark:text-amber-400">
                {{ money(row, payoutShortfall(row.partnerClaim)) }} short
              </p>
            </td>
            <td class="px-4 py-3">
              <span class="text-xs">{{ statusLabel(row) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
