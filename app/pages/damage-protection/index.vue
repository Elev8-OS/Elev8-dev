<script setup lang="ts">
import type { PartnerBucket } from '~/components/reservations/data/partner-claims'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import type { ProtectionRow } from '~/composables/useDamageProtection'
import type { PartnerClaimRow } from '~/composables/usePartnerClaims'
import { toast } from 'vue-sonner'
import DamageProtectionTable from '~/components/damage-protection/DamageProtectionTable.vue'
import PartnerClaimTable from '~/components/damage-protection/PartnerClaimTable.vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { usePartnerClaims } from '~/composables/usePartnerClaims'

const dp = useDamageProtection()
const pc = usePartnerClaims()

// No scheduler in this app, so catch up on mount, the same way the city tax
// and guest registration worklists do.
onMounted(() => {
  dp.hydrate()
  dp.emitProtectionAlerts()
  pc.emitPartnerAlerts()
})

type Tab = 'awaiting_choice' | 'decision' | 'failed' | 'on_file' | 'refund_due' | 'settled' | 'insurance'
const tab = ref<Tab>('decision')
const search = ref('')
const channelFilter = ref<'all' | 'Airbnb' | 'Booking.com' | 'Direct'>('all')
const optionFilter = ref<'all' | 'waiver' | 'deposit'>('all')
const selected = ref<string[]>([])
const detailTarget = ref<ReservationEntry | null>(null)
const closing = ref(false)

const detailOpen = computed({
  get: () => detailTarget.value !== null,
  set: (value: boolean) => {
    if (!value)
      detailTarget.value = null
  },
})

/** Due and overdue share one tab, overdue first: both are "charge the claims or close it". */
const tabRows = computed<ProtectionRow[]>(() => {
  const byTab: Record<Tab, ProtectionRow[]> = {
    awaiting_choice: dp.awaitingChoice.value,
    decision: [...dp.decisionOverdue.value, ...dp.decisionDue.value],
    failed: dp.failed.value,
    on_file: dp.onFile.value,
    refund_due: dp.refundDue.value,
    settled: dp.settled.value,
    insurance: [],
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
  { label: 'Charge or close', values: [String(dp.decisionDue.value.length + dp.decisionOverdue.value.length)] },
  { label: 'Overdue', values: [String(dp.decisionOverdue.value.length)] },
  { label: 'Claims to charge', values: totalsLabel(dp.chargeableTotals.value) },
  // A limit, not money held: nothing is collected until there is damage.
  { label: 'Cover on saved cards', values: totalsLabel(dp.coverOnFileTotals.value) },
])

/**
 * Fees collected against claims paid, as TWO figures. Netting them would hide
 * exactly the signal this exists to give: whether the waiver is priced right.
 */
const waiverPot = computed(() => ({
  collected: totalsLabel(dp.waiverPotTotals.value.collected),
  paidOut: totalsLabel(dp.waiverPotTotals.value.paidOut),
}))

/** What Elev8 charges for covered stays, split by who pays the tenant back for it. */
const elev8Fees = computed(() => ({
  guestPaid: totalsLabel(dp.elev8FeeTotals.value.guestPaid),
  hostPaid: totalsLabel(dp.elev8FeeTotals.value.hostPaid),
}))

// ---------------------------------------------------------- insurance claims

type PartnerFilter = 'all' | PartnerBucket
const partnerFilter = ref<PartnerFilter>('all')

const partnerFilters: { id: PartnerFilter, label: string, count: () => number }[] = [
  { id: 'all', label: 'All', count: () => pc.rows.value.length },
  { id: 'to_submit', label: 'To submit', count: () => pc.toSubmit.value.length },
  { id: 'action_needed', label: 'Action needed', count: () => pc.actionNeeded.value.length },
  { id: 'with_partner', label: 'With partner', count: () => pc.withPartner.value.length },
  { id: 'awaiting_payout', label: 'Awaiting payout', count: () => pc.awaitingPayout.value.length },
  { id: 'to_confirm', label: 'Confirm receipt', count: () => pc.toConfirm.value.length },
  { id: 'closed', label: 'Closed', count: () => pc.closed.value.length },
]

const partnerRows = computed<PartnerClaimRow[]>(() => {
  const term = search.value.trim().toLowerCase()
  return pc.rows.value.filter((row) => {
    if (partnerFilter.value !== 'all' && row.bucket !== partnerFilter.value)
      return false
    if (term && !row.reservation.guestName.toLowerCase().includes(term)
      && !row.reservation.listingName.toLowerCase().includes(term)
      && !row.claim.label.toLowerCase().includes(term)
      && !(row.partnerClaim?.partnerClaimRef ?? '').toLowerCase().includes(term)) {
      return false
    }
    return true
  })
})

/** Four figures per currency, never netted: what could be claimed, is out, is owed, and arrived. */
const partnerKpis = computed(() => [
  { label: 'Claimable, not filed', values: totalsLabel(pc.moneyTotals.value.claimable) },
  { label: 'With the partner', values: totalsLabel(pc.moneyTotals.value.withPartner) },
  { label: 'Approved, not received', values: totalsLabel(pc.moneyTotals.value.approvedNotReceived) },
  { label: 'Received in account', values: totalsLabel(pc.moneyTotals.value.received) },
])

const tabs: { id: Tab, label: string }[] = [
  { id: 'decision', label: 'Charge or close' },
  { id: 'failed', label: 'Charge declined' },
  { id: 'awaiting_choice', label: 'Awaiting choice' },
  { id: 'on_file', label: 'On file' },
  { id: 'refund_due', label: 'Waiver refunds' },
  { id: 'settled', label: 'Closed' },
  { id: 'insurance', label: 'Insurance claims' },
]

/**
 * Bulk CLOSES, it never bulk charges. A stay with claims is skipped and said
 * so: charging a card is decided one guest at a time, each after being told.
 */
async function bulkClose() {
  closing.value = true
  let closed = 0
  let skipped = 0
  for (const id of [...selected.value]) {
    const row = rows.value.find(r => r.reservation.id === id)
    if (!row || row.chargeable > 0 || row.reservation.status === 'cancelled') {
      skipped += 1
      continue
    }
    const result = await dp.settleDeposit(id)
    if (result.ok)
      closed += 1
    else
      skipped += 1
  }
  closing.value = false
  selected.value = []
  if (closed)
    toast.success(`${closed} deposit(s) closed without a charge`)
  if (skipped)
    toast.error(`${skipped} skipped. A stay with claims, or a cancelled one, is handled on its own.`)
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
          Who chose what, which saved cards still need a decision, and what was charged.
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

      <div class="rounded-lg border p-4" data-testid="elev8-fees">
        <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
          Charged by Elev8 for Tern cover
        </p>
        <div class="mt-2 flex flex-wrap gap-8">
          <div>
            <p class="text-xs text-muted-foreground">
              Guest-paid stays
            </p>
            <p v-for="value in elev8Fees.guestPaid" :key="value" class="text-lg font-semibold tabular-nums">
              {{ value }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Host-paid stays
            </p>
            <p v-for="value in elev8Fees.hostPaid" :key="value" class="text-lg font-semibold tabular-nums">
              {{ value }}
            </p>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          A fixed fee per covered stay. On a host-paid listing the guest is not asked and you carry it.
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

      <!-- Insurance claims: the waiver claims filed with the partner under the
           property manager's master policy, until the money is in the account. -->
      <template v-if="tab === 'insurance'">
        <!-- Elev8's own integration with the partner, the same for every tenant:
             nothing to configure, so this is a read-out, not a form. -->
        <div class="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4" data-testid="partner-summary">
          <div>
            <p class="text-sm font-medium">
              {{ pc.partner.value.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              Policy {{ pc.partner.value.policyNumber }} ·
              {{ formatProtectionAmount(pc.partner.value.deductiblePerClaim, pc.partner.value.currency) }} deductible per claim ·
              pays into your Stripe payout account
            </p>
          </div>
          <span class="rounded-md border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[11px] text-green-700 dark:text-green-400">
            Integrated by Elev8
          </span>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="kpi in partnerKpis" :key="kpi.label" class="rounded-lg border p-4">
            <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
              {{ kpi.label }}
            </p>
            <p v-for="value in kpi.values" :key="value" class="text-xl font-semibold tabular-nums">
              {{ value }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Input v-model="search" placeholder="Search guest, property, claim or ref" class="max-w-xs" />
          <Button
            v-for="f in partnerFilters"
            :key="f.id"
            size="sm"
            :variant="partnerFilter === f.id ? 'secondary' : 'ghost'"
            @click="partnerFilter = f.id"
          >
            {{ f.label }}
            <span class="ml-1 text-xs text-muted-foreground tabular-nums">{{ f.count() }}</span>
          </Button>
        </div>

        <ClientOnly>
          <PartnerClaimTable
            :rows="partnerRows"
            empty-label="No insurance claims here."
            @open="detailTarget = $event.reservation"
          />
          <template #fallback>
            <Skeleton class="h-64 w-full" />
          </template>
        </ClientOnly>
      </template>

      <template v-else>
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
          <Button size="sm" :disabled="closing || !dp.canEditProtection.value" @click="bulkClose">
            Close {{ selected.length }} without charging
          </Button>
        </div>

        <ClientOnly>
          <DamageProtectionTable
            v-model:selected="selected"
            :rows="rows"
            :selectable="tab === 'decision'"
            :can-edit="dp.canEditProtection.value"
            empty-label="Nothing here."
            @open="detailTarget = $event.reservation"
          />
          <template #fallback>
            <Skeleton class="h-64 w-full" />
          </template>
        </ClientOnly>
      </template>
    </template>

    <ReservationDetailSheet
      v-if="detailTarget"
      v-model:open="detailOpen"
      :reservation="detailTarget"
    />
  </div>
</template>
