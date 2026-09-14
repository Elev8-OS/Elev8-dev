<script setup lang="ts">
import type { CityTaxWorklistRow } from '~/composables/useCityTax'
import CityTaxStatusChip from '~/components/city-tax/CityTaxStatusChip.vue'
import { formatCityTaxTotals } from '~/components/reservations/data/city-tax'

const props = defineProps<{
  rows: CityTaxWorklistRow[]
  selectable: boolean
  selected: string[]
  emptyLabel: string
}>()

const emit = defineEmits<{
  'openDetail': [row: CityTaxWorklistRow]
  'update:selected': [ids: string[]]
}>()

// reka-ui CheckboxRoot ignores external :checked changes after first render, so
// a cleared selection leaves every box still looking ticked. Bumping this key
// forces a re-mount, the same pattern the finance tables use.
//
// It watches the PROP rather than only bumping inside toggleAll, because the
// page clears the selection too (switching tab), and that path would otherwise
// leave stale ticks behind.
const clearKey = ref(0)

watch(() => props.selected.length, (length) => {
  if (length === 0)
    clearKey.value++
})

const allSelected = computed(() =>
  props.rows.length > 0 && props.rows.every(row => props.selected.includes(row.reservation.id)))

function toggleRow(id: string) {
  emit('update:selected', props.selected.includes(id)
    ? props.selected.filter(selectedId => selectedId !== id)
    : [...props.selected, id])
}

function toggleAll() {
  if (allSelected.value) {
    emit('update:selected', [])
    return
  }
  emit('update:selected', props.rows.map(row => row.reservation.id))
}

function amount(row: CityTaxWorklistRow): string {
  return row.assessment.settlement
    ? formatCityTaxTotals(row.assessment.settlement.totals)
    : formatCityTaxTotals(row.assessment.totals)
}

function basisSummary(row: CityTaxWorklistRow): string {
  return row.assessment.lines.map(line => line.taxTitle).join(', ') || 'City tax'
}
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead v-if="props.selectable" class="w-10">
            <Checkbox :key="`all-${clearKey}`" :model-value="allSelected" @update:model-value="toggleAll" />
          </TableHead>
          <TableHead>Guest</TableHead>
          <TableHead>Property</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Check-in</TableHead>
          <TableHead>Check-out</TableHead>
          <TableHead>Tax</TableHead>
          <TableHead class="text-right">
            Amount
          </TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="props.rows.length === 0">
          <TableCell :colspan="props.selectable ? 9 : 8" class="py-10 text-center text-sm text-muted-foreground">
            {{ props.emptyLabel }}
          </TableCell>
        </TableRow>

        <TableRow
          v-for="row in props.rows"
          :key="row.reservation.id"
          class="cursor-pointer"
          @click="emit('openDetail', row)"
        >
          <TableCell v-if="props.selectable" @click.stop>
            <Checkbox
              :key="`${row.reservation.id}-${clearKey}`"
              :model-value="props.selected.includes(row.reservation.id)"
              @update:model-value="toggleRow(row.reservation.id)"
            />
          </TableCell>
          <TableCell class="font-medium">
            {{ row.reservation.guestName }}
          </TableCell>
          <TableCell>{{ row.reservation.listingName }}</TableCell>
          <TableCell>{{ row.reservation.channel }}</TableCell>
          <TableCell>{{ row.reservation.checkIn }}</TableCell>
          <TableCell>{{ row.reservation.checkOut }}</TableCell>
          <TableCell class="text-muted-foreground">
            {{ basisSummary(row) }}
          </TableCell>
          <TableCell class="text-right tabular-nums">
            {{ amount(row) }}
          </TableCell>
          <TableCell>
            <CityTaxStatusChip :status="row.assessment.status" :stage="row.stage" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
