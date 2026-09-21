<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import type { ProtectionRow } from '~/composables/useDamageProtection'
import { toast } from 'vue-sonner'
import DamageProtectionTable from '~/components/damage-protection/DamageProtectionTable.vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import { useDamageProtection } from '~/composables/useDamageProtection'

const dp = useDamageProtection()

// No scheduler in this app, so catch up on mount, the same way the city tax
// and guest registration worklists do.
onMounted(() => {
  dp.hydrate()
  dp.emitProtectionAlerts()
})

type Tab = 'awaiting_choice' | 'charge_due' | 'failed' | 'held' | 'refund_due' | 'settled'
const tab = ref<Tab>('charge_due')
const search = ref('')
const channelFilter = ref<'all' | 'Airbnb' | 'Booking.com' | 'Direct'>('all')
const optionFilter = ref<'all' | 'waiver' | 'deposit'>('all')
const selected = ref<string[]>([])
const detailTarget = ref<ReservationEntry | null>(null)
const releasing = ref(false)

const detailOpen = computed({
  get: () => detailTarget.value !== null,
  set: (value: boolean) => {
    if (!value)
      detailTarget.value = null
  },
})

/** Refund due and refund overdue share one tab: both are money owed back. */
const tabRows = computed<ProtectionRow[]>(() => {
  const byTab: Record<Tab, ProtectionRow[]> = {
    awaiting_choice: dp.awaitingChoice.value,
    charge_due: dp.chargeDue.value,
    failed: dp.failed.value,
    held: dp.held.value,
    refund_due: [...dp.refundOverdue.value, ...dp.refundDue.value],
    settled: dp.settled.value,
  }
  return byTab[tab.value]
})

const rows = computed(() => tabRows.value.filter((row) => {
  const term = search.value.trim().toLowerCase()
  if (term && !row.reservation.guestName.toLowerCase().includes(term)
    && !row.reservation.listingName.toLowerCase().includes(term)) {
    return false
  }
  if (channelFilter.value !== 'all' && row.reservation.channel !== channelFilter.value)
    return false
  if (optionFilter.value !== 'all' && row.protection?.option !== optionFilter.value)
    return false
  return true
}))

watch([tab, search, channelFilter, optionFilter], () => {
  selected.value = []
})

function totalsLabel(totals: { currency: string, amount: number }[]): string[] {
  if (!totals.length)
    return ['—']
  return totals.map(t => formatProtectionAmount(t.amount, t.currency))
}

const kpis = computed(() => [
  { label: 'Awaiting choice', values: [String(dp.awaitingChoice.value.length)] },
  { label: 'Charge due', values: [String(dp.chargeDue.value.length)] },
  { label: 'Failed', values: [String(dp.failed.value.length)] },
  { label: 'Refund due', values: totalsLabel(dp.refundDueTotals.value) },
  { label: 'Held now', values: totalsLabel(dp.heldTotals.value) },
])

/**
 * Fees collected against claims paid, as TWO figures. Netting them would hide
 * exactly the signal this exists to give: whether the waiver is priced right.
 */
const waiverPot = computed(() => ({
  collected: totalsLabel(dp.waiverPotTotals.value.collected),
  paidOut: totalsLabel(dp.waiverPotTotals.value.paidOut),
}))

const tabs: { id: Tab, label: string }[] = [
  { id: 'awaiting_choice', label: 'Awaiting choice' },
  { id: 'charge_due', label: 'Charge due' },
  { id: 'failed', label: 'Failed' },
  { id: 'held', label: 'Held' },
  { id: 'refund_due', label: 'Refund due' },
  { id: 'settled', label: 'Settled' },
]

async function bulkRelease() {
  releasing.value = true
  let released = 0
  let blocked = 0
  for (const id of [...selected.value]) {
    const result = await dp.releaseDeposit(id)
    if (result.ok)
      released += 1
    else
      blocked += 1
  }
  releasing.value = false
  selected.value = []
  if (released)
    toast.success(`${released} deposit(s) released`)
  if (blocked)
    toast.error(`${blocked} could not be released. Notify the guest of every claim first.`)
}
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Damage protection
        </h1>
        <p class="text-sm text-muted-foreground">
          Who chose what, what has been charged, and what is owed back.
        </p>
      </div>
      <Button variant="outline" size="sm" @click="dp.emitProtectionAlerts()">
        Check for alerts
      </Button>
    </div>

    <div v-if="!dp.canViewProtection.value" class="rounded-md border p-10 text-center text-muted-foreground">
      You do not have access to damage protection.
    </div>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div v-for="kpi in kpis" :key="kpi.label" class="rounded-lg border p-4">
          <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
            {{ kpi.label }}
          </p>
          <p v-for="value in kpi.values" :key="value" class="text-xl font-semibold tabular-nums">
            {{ value }}
          </p>
        </div>
      </div>

      <div class="rounded-lg border p-4">
        <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
          Waiver pot
        </p>
        <div class="mt-2 flex flex-wrap gap-8">
          <div>
            <p class="text-xs text-muted-foreground">
              Fees collected
            </p>
            <p v-for="value in waiverPot.collected" :key="value" class="text-lg font-semibold tabular-nums">
              {{ value }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Claims paid
            </p>
            <p v-for="value in waiverPot.paidOut" :key="value" class="text-lg font-semibold tabular-nums">
              {{ value }}
            </p>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Shown as two figures on purpose. Netting them hides whether the fee is priced right.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-for="t in tabs"
          :key="t.id"
          size="sm"
          :variant="tab === t.id ? 'default' : 'outline'"
          @click="tab = t.id"
        >
          {{ t.label }}
        </Button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Input v-model="search" placeholder="Search guest or property" class="max-w-xs" />
        <Select v-model="channelFilter">
          <SelectTrigger class="w-40">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All channels
            </SelectItem>
            <SelectItem value="Airbnb">
              Airbnb
            </SelectItem>
            <SelectItem value="Booking.com">
              Booking.com
            </SelectItem>
            <SelectItem value="Direct">
              Direct
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="optionFilter">
          <SelectTrigger class="w-36">
            <SelectValue placeholder="Option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All options
            </SelectItem>
            <SelectItem value="waiver">
              Waiver
            </SelectItem>
            <SelectItem value="deposit">
              Deposit
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="selected.length" class="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-4 py-2 text-sm">
        <span>{{ selected.length }} selected</span>
        <Button size="sm" variant="ghost" @click="selected = []">
          Clear
        </Button>
        <Button size="sm" :disabled="releasing || !dp.canEditProtection.value" @click="bulkRelease">
          Release {{ selected.length }} deposit(s)
        </Button>
      </div>

      <ClientOnly>
        <DamageProtectionTable
          v-model:selected="selected"
          :rows="rows"
          :selectable="tab === 'refund_due' || tab === 'held'"
          :can-edit="dp.canEditProtection.value"
          empty-label="Nothing here."
          @open="detailTarget = $event.reservation"
        />
        <template #fallback>
          <Skeleton class="h-64 w-full" />
        </template>
      </ClientOnly>
    </template>

    <ReservationDetailSheet
      v-if="detailTarget"
      v-model:open="detailOpen"
      :reservation="detailTarget"
    />
  </div>
</template>
