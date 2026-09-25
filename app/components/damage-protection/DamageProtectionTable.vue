<script setup lang="ts">
import type { ProtectionRow } from '~/composables/useDamageProtection'
import DamageProtectionStatusChip from '~/components/damage-protection/DamageProtectionStatusChip.vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'

const props = defineProps<{
  rows: ProtectionRow[]
  emptyLabel: string
  /** Selection is only offered where a bulk close makes sense. */
  selectable?: boolean
  canEdit?: boolean
}>()

const emit = defineEmits<{ open: [ProtectionRow] }>()

function cardLabel(row: ProtectionRow): string {
  const card = row.protection?.card
  return card ? `•••• ${card.last4}` : '—'
}

const selected = defineModel<string[]>('selected', { default: () => [] })

/**
 * reka-ui CheckboxRoot ignores external state changes after first render, so
 * the boxes stay ticked after a clear without a changing key.
 */
const clearKey = ref(0)

function toggleRow(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter(x => x !== id)
    : [...selected.value, id]
}

function clearSelection() {
  selected.value = []
  clearKey.value++
}

defineExpose({ clearSelection })

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00`))
}

function money(row: ProtectionRow, amount: number): string {
  return formatProtectionAmount(amount, row.protection?.currency ?? row.policy.currency)
}

function failureLabel(row: ProtectionRow): string {
  return row.protection?.state === 'charge_failed' ? (row.protection.chargeFailureReason ?? 'Declined') : ''
}
</script>

<template>
  <div class="rounded-md border">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-xs text-muted-foreground uppercase">
          <tr>
            <th v-if="props.selectable" class="w-10 px-4 py-3" />
            <th class="px-4 py-3 text-left font-medium">
              Guest
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Property
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Channel
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Check-in
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Check-out
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Option
            </th>
            <th class="px-4 py-3 text-right font-medium">
              Amount
            </th>
            <th class="px-4 py-3 text-right font-medium">
              Claims to charge
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Card
            </th>
            <th class="px-4 py-3 text-left font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td :colspan="props.selectable ? 11 : 10" class="px-4 py-10 text-center text-muted-foreground">
              {{ emptyLabel }}
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.reservation.id"
            class="cursor-pointer border-t transition-colors hover:bg-muted/30"
            @click="emit('open', row)"
          >
            <td v-if="props.selectable" class="px-4 py-3" @click.stop>
              <Checkbox
                :key="`${row.reservation.id}-${clearKey}`"
                :model-value="selected.includes(row.reservation.id)"
                :disabled="!canEdit"
                @click.stop="toggleRow(row.reservation.id)"
              />
            </td>
            <td class="px-4 py-3">
              {{ row.reservation.guestName }}
            </td>
            <td class="px-4 py-3">
              {{ row.reservation.listingName }}
            </td>
            <td class="px-4 py-3">
              {{ row.reservation.channel }}
            </td>
            <td class="px-4 py-3">
              {{ fmtDate(row.reservation.checkIn) }}
            </td>
            <td class="px-4 py-3">
              {{ fmtDate(row.reservation.checkOut) }}
            </td>
            <td class="px-4 py-3">
              <span class="capitalize">{{ row.protection?.option ?? '—' }}</span>
              <span v-if="row.protection?.paidBy === 'host'" class="ml-1.5 text-xs text-muted-foreground" data-testid="row-host-paid">
                Host pays
              </span>
            </td>
            <td class="px-4 py-3 text-right tabular-nums">
              {{ !row.protection ? '—' : row.protection.paidBy === 'host' ? 'Not charged' : money(row, row.protection.amount) }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums">
              {{ row.chargeable ? money(row, row.chargeable) : '—' }}
            </td>
            <td class="px-4 py-3 tabular-nums">
              {{ cardLabel(row) }}
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap items-center gap-1.5">
                <DamageProtectionStatusChip :bucket="row.bucket" :option="row.protection?.option" />
                <span v-if="failureLabel(row)" class="text-xs text-muted-foreground">
                  {{ failureLabel(row) }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
