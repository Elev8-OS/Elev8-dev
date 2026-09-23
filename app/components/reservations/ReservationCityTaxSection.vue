<script setup lang="ts">
import type { CityTaxBasisLine, CityTaxGuestRateLine } from '~/components/reservations/data/city-tax'
import type { CityTaxPaymentMethod, ReservationEntry } from '~/components/reservations/data/reservations'
import {
  CITY_TAX_METHOD_LABELS,
  cityTaxGuestCountLabel,
  formatCityTaxTotals,
  hasMixedGuestRates,
} from '~/components/reservations/data/city-tax'
import CityTaxCollectDialog from '~/components/reservations/CityTaxCollectDialog.vue'
import CityTaxWaiveDialog from '~/components/reservations/CityTaxWaiveDialog.vue'
import { useCityTax } from '~/composables/useCityTax'

const props = defineProps<{
  reservation: ReservationEntry
}>()

const cityTax = useCityTax()

const collectOpen = ref(false)
const waiveOpen = ref(false)

const assessment = computed(() => cityTax.assessmentFor(props.reservation.id))
const amountLabel = computed(() => formatCityTaxTotals(assessment.value.totals))
const settlementLabel = computed(() =>
  assessment.value.settlement ? formatCityTaxTotals(assessment.value.settlement.totals) : '')

const statusMeta = computed(() => {
  switch (assessment.value.status) {
    case 'due':
      return { label: 'Due', class: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' }
    case 'collected':
      return { label: 'Collected', class: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' }
    case 'waived':
      return { label: 'Waived', class: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
    default:
      return { label: 'Channel collects', class: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
  }
})

function money(line: CityTaxBasisLine, value: number): string {
  return `${line.currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * True when the categories are not all paying the same rate, in which case one
 * "N guests × RATE" line would misquote the bill and the per-category rows
 * below are shown instead.
 */
function isMixed(line: CityTaxBasisLine): boolean {
  return hasMixedGuestRates(line)
}

/** "2 adults × EUR 3.00 = EUR 6.00", one per chargeable category. */
function categoryLabel(line: CityTaxBasisLine, row: CityTaxGuestRateLine): string {
  const who = cityTaxGuestCountLabel(row.category, row.guests)
  return `${who} × ${money(line, row.rate)} = ${money(line, row.amount)}`
}

/** The multiplier applied to the per-category subtotal, when there is one. */
function mixedTotalLabel(line: CityTaxBasisLine): string {
  const perNight = line.guestBreakdown.reduce((sum, row) => sum + row.amount, 0)
  if (line.logic !== 'per_person_per_night')
    return `Total ${money(line, line.amount)}`
  return `${money(line, perNight)} × ${line.chargeableNights} nights = ${money(line, line.amount)}`
}

/** "2 guests × 4 nights × 3.00 EUR = 24.00 EUR", the working staff get asked for. */
function basisLabel(line: CityTaxBasisLine): string {
  const rate = `${line.currency} ${line.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const total = `${line.currency} ${line.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const factors: string[] = []
  if (line.logic === 'per_person' || line.logic === 'per_person_per_night')
    factors.push(`${line.chargeableGuests} guests`)
  if (line.logic === 'per_room' || line.logic === 'per_room_per_night')
    factors.push(`${line.rooms} rooms`)
  if (line.logic === 'per_night' || line.logic === 'per_person_per_night' || line.logic === 'per_room_per_night')
    factors.push(`${line.chargeableNights} nights`)
  if (line.logic === 'percent')
    return `${line.rate}% of the accommodation subtotal = ${total}`
  factors.push(rate)
  return `${factors.join(' × ')} = ${total}`
}

function methodLabel(method?: CityTaxPaymentMethod): string {
  return method ? CITY_TAX_METHOD_LABELS[method] : ''
}

function settledOn(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false })
}

function collect(payload: { method: CityTaxPaymentMethod, note?: string }) {
  cityTax.markCollected(props.reservation.id, payload)
}

function waive(reason: string) {
  cityTax.waive(props.reservation.id, reason)
}
</script>

<template>
  <!-- Nothing to say when this property levies no city tax on this channel. -->
  <Accordion
    v-if="assessment.status !== 'not_required'"
    data-testid="city-tax-section"
    type="single"
    collapsible
    class="w-full border-b px-2"
  >
    <AccordionItem value="city-tax" class="border-b-0">
      <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
        <span class="flex flex-1 items-center gap-2">
          <Icon name="lucide:landmark" class="size-4" />
          City tax
          <Badge variant="outline" :class="statusMeta.class">{{ statusMeta.label }}</Badge>
        </span>
      </AccordionTrigger>

      <AccordionContent class="px-3 pb-4">
        <!-- The OTA already took it. There is no action, so offer none. -->
        <p v-if="assessment.status === 'channel_collects'" class="text-sm text-muted-foreground">
          {{ props.reservation.channel }} collects and remits this tax. Nothing to collect at the property.
        </p>

        <div v-else-if="assessment.status === 'due'" class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-2xl font-semibold tabular-nums">{{ amountLabel }}</span>
            <span class="text-xs text-muted-foreground">Collect from the guest</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <div v-for="line in assessment.lines" :key="line.taxItemId" class="rounded-md border bg-muted/40 px-3 py-2">
              <div class="flex items-center justify-between gap-2 text-sm">
                <span class="font-medium">{{ line.taxTitle }}</span>
                <span v-if="line.authorityName" class="text-xs text-muted-foreground">{{ line.authorityName }}</span>
              </div>
              <!-- One rate for everybody: the single working line reads fine. -->
              <p v-if="!isMixed(line)" class="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {{ basisLabel(line) }}
              </p>
              <!-- Categories priced differently, so each one shows its own working. -->
              <div v-else class="mt-0.5 flex flex-col gap-0.5" :data-testid="`city-tax-breakdown-${line.taxItemId}`">
                <p
                  v-for="row in line.guestBreakdown"
                  :key="row.category"
                  class="text-xs tabular-nums text-muted-foreground"
                >
                  {{ categoryLabel(line, row) }}
                </p>
                <p class="text-xs font-medium tabular-nums text-foreground">
                  {{ mixedTotalLabel(line) }}
                </p>
              </div>
              <p v-if="line.note" class="mt-1 text-xs text-muted-foreground">
                {{ line.note }}
              </p>
            </div>
          </div>

          <div class="flex gap-2">
            <Button size="sm" data-testid="city-tax-collect" @click="collectOpen = true">
              Mark collected
            </Button>
            <Button size="sm" variant="outline" data-testid="city-tax-waive" @click="waiveOpen = true">
              Waive
            </Button>
          </div>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-xl font-semibold tabular-nums">{{ settlementLabel }}</span>
            <span class="text-xs text-muted-foreground">
              {{ assessment.status === 'collected' ? 'Collected' : 'Waived' }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ assessment.settlement?.settledBy }} · {{ settledOn(assessment.settlement!.settledAt) }}
            <template v-if="assessment.settlement?.method"> · {{ methodLabel(assessment.settlement.method) }}</template>
          </p>
          <p v-if="assessment.settlement?.reason" class="text-xs text-muted-foreground">
            Reason: {{ assessment.settlement.reason }}
          </p>
          <p v-if="assessment.settlement?.note" class="text-xs text-muted-foreground">
            {{ assessment.settlement.note }}
          </p>
          <div>
            <Button size="sm" variant="ghost" data-testid="city-tax-undo" @click="cityTax.undoSettlement(props.reservation.id)">
              Undo
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>

    <CityTaxCollectDialog v-model:open="collectOpen" :amount-label="amountLabel" @confirm="collect" />
    <CityTaxWaiveDialog v-model:open="waiveOpen" @confirm="waive" />
  </Accordion>
</template>
