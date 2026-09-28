<script setup lang="ts">
import type { SubscriptionInvoice } from '~/components/billing/data/subscription-billing'
import type { WaiverInvoice } from '~/components/damage-protection/data/waiver-billing'
import { nextSubscriptionInvoice, packageView } from '~/components/billing/data/billing-overview'
import { cardBrandLabels, declineReasonLabels } from '~/components/billing/data/subscription-billing'
import { periodLabel } from '~/components/damage-protection/data/waiver-billing'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { useOnboarding } from '~/composables/useOnboarding'
import { useSubscriptionBilling } from '~/composables/useSubscriptionBilling'
import { useTenantBillTo } from '~/composables/useTenantBillTo'
import { useTernActivation } from '~/composables/useTernActivation'
import { useWaiverBilling } from '~/composables/useWaiverBilling'
import { buildSubscriptionInvoicePdf } from '~/lib/subscription-invoice-pdf'
import { buildWaiverInvoicePdf } from '~/lib/waiver-invoice-pdf'

/**
 * The tenant's own Elev8 billing: the package and how many units are active,
 * the next invoices, the card they are charged to, and every invoice so far.
 * Two kinds of invoice meet here: the subscription (the package) and the
 * damage waiver (Tern cover, billed on the 1st). Both go on the same card.
 */
const onboarding = useOnboarding()
const subscription = useSubscriptionBilling()
const waiver = useWaiverBilling()
const tern = useTernActivation()
const { billTo } = useTenantBillTo()

onMounted(() => {
  waiver.hydrate()
  // Catch up any 1st that has passed, the same as the damage protection worklist.
  waiver.runDueBilling()
})

const updateOpen = ref(false)

const activatedAt = computed(() => onboarding.state.value.activatedAt)
const pkg = computed(() => packageView(onboarding.subscription.value, activatedAt.value))
const nextSub = computed(() =>
  nextSubscriptionInvoice(onboarding.subscription.value, subscription.invoices.value, activatedAt.value))
const nextWaiver = computed(() => waiver.upcoming.value)

const failed = computed(() => subscription.billing.value.failedInvoice)
const card = computed(() => subscription.billing.value.paymentMethod)

const cardExpired = computed(() => {
  const pm = card.value
  if (!pm)
    return false
  const now = new Date()
  return pm.expYear < now.getFullYear() || (pm.expYear === now.getFullYear() && pm.expMonth < now.getMonth() + 1)
})

const df = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
function fmtDay(iso: string): string {
  return df.format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso))
}
function usd(amount: number): string {
  return formatProtectionAmount(amount, 'USD')
}

/** A share of the package range, for the units bar. The top package has no maximum. */
const unitsShare = computed(() => {
  const p = pkg.value
  if (!p || p.model !== 'per_unit' || !p.unitsMax)
    return null
  return Math.min(100, Math.round((p.unitsActive / p.unitsMax) * 100))
})

// ---------------------------------------------------------------- history

type RowStatus = 'paid' | 'payment_failed' | 'charging'

interface HistoryRow {
  key: string
  date: string
  number: string
  description: string
  amount: string
  status: RowStatus
  note?: string
  download: () => void
}

const STATUS_LABEL: Record<RowStatus, string> = { paid: 'Paid', payment_failed: 'Payment failed', charging: 'Charging' }
const STATUS_CLASS: Record<RowStatus, string> = {
  paid: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  charging: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  payment_failed: 'border-destructive/30 bg-destructive/10 text-destructive',
}

function subscriptionRow(inv: SubscriptionInvoice): HistoryRow {
  return {
    key: `sub-${inv.id}`,
    date: inv.issuedOn,
    number: inv.number,
    description: `Subscription, ${inv.periodLabel}. ${inv.planName}, ${inv.units} units`,
    amount: usd(inv.amountUsd),
    status: inv.status,
    note: inv.status === 'paid' ? inv.cardLabel : inv.failureReason,
    download: () => buildSubscriptionInvoicePdf(inv, billTo(), { download: true }),
  }
}

function waiverRow(inv: WaiverInvoice): HistoryRow {
  const count = inv.lines.length
  return {
    key: `dw-${inv.id}`,
    date: inv.issuedOn,
    number: inv.number,
    description: `Damage waiver, ${periodLabel(inv.period)}. ${count} covered ${count === 1 ? 'stay' : 'stays'}`,
    amount: formatProtectionAmount(inv.total, inv.currency),
    status: inv.status,
    note: inv.status === 'paid' ? inv.cardLabel : inv.failureReason,
    download: () => buildWaiverInvoicePdf(inv, { download: true }),
  }
}

/** Newest first, both kinds of invoice in one list. */
const history = computed<HistoryRow[]>(() => [
  ...subscription.invoices.value.map(subscriptionRow),
  ...waiver.invoices.value.map(waiverRow),
].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)))
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="billing-page">
    <div>
      <h2 class="text-lg font-semibold">
        Billing
      </h2>
      <p class="text-sm text-muted-foreground">
        Your Elev8 package, the next invoices, the card they are charged to, and every invoice so far.
      </p>
    </div>

    <!-- A failed subscription charge comes first: the account is suspended if it stays unpaid. -->
    <div
      v-if="subscription.needsPaymentUpdate.value && failed"
      class="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
      data-testid="billing-failed"
    >
      <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0 text-destructive" />
      <div class="min-w-0 flex-1">
        <p class="font-medium">
          {{ usd(failed.amountUsd) }} for {{ failed.periodLabel }} was not collected
        </p>
        <p class="text-muted-foreground">
          {{ declineReasonLabels[failed.declineReason] }}.
          <template v-if="subscription.daysLeft.value !== null">
            Update the card within {{ subscription.daysLeft.value }} {{ subscription.daysLeft.value === 1 ? 'day' : 'days' }} to keep your account active.
          </template>
        </p>
      </div>
      <Button size="sm" data-testid="billing-failed-update" @click="updateOpen = true">
        Update card
      </Button>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <!-- Package -->
      <section class="flex flex-col gap-5 rounded-lg border p-5" aria-labelledby="billing-package" data-testid="billing-package">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="billing-package" class="text-sm font-medium text-muted-foreground">
              Package
            </h3>
            <p v-if="pkg" class="mt-1 text-2xl font-semibold tracking-tight" data-testid="billing-plan">
              {{ pkg.planName }}
            </p>
            <p v-if="pkg" class="text-sm text-muted-foreground">
              {{ pkg.pmsLabel }}, billed {{ pkg.model === 'per_unit' ? `per unit, ${pkg.cycle}` : 'per booking' }}
            </p>
            <p v-else class="mt-1 text-sm text-muted-foreground">
              No package yet. Choose one in onboarding.
            </p>
          </div>
        </div>

        <template v-if="pkg?.model === 'per_unit'">
          <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span>Active units</span>
              <span class="tabular-nums" data-testid="billing-units">
                <span class="font-semibold">{{ pkg.unitsActive }}</span>
                <span class="text-muted-foreground">
                  {{ pkg.unitsMax ? ` of ${pkg.unitsMax}` : '' }}
                </span>
              </span>
            </div>
            <Progress v-if="unitsShare !== null" :model-value="unitsShare" class="h-2" aria-label="Active units in the package range" />
            <p class="text-xs text-muted-foreground">
              {{ pkg.planName }} covers {{ pkg.unitsMin }}{{ pkg.unitsMax ? ` to ${pkg.unitsMax}` : ' or more' }} units, and bills at
              least {{ pkg.floor }}. A unit is one room you have activated.
              <template v-if="pkg.unitsMax">
                Activating more than {{ pkg.unitsMax }} moves you to the next package.
              </template>
            </p>
          </div>

          <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-xs text-muted-foreground">
                Rate
              </dt>
              <dd class="tabular-nums">
                {{ usd(pkg.unitRateUsd) }} per unit per month
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Billed for
              </dt>
              <dd class="tabular-nums">
                {{ pkg.billedUnits }} {{ pkg.billedUnits === 1 ? 'unit' : 'units' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Contract
              </dt>
              <dd>
                {{ pkg.contractEndsOn ? `${pkg.contractMonths} months, until ${fmtDay(pkg.contractEndsOn)}` : `${pkg.contractMonths} months` }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Damage waiver
              </dt>
              <dd data-testid="billing-waiver-addon">
                <template v-if="tern.isActive.value">
                  Active, billed on the 1st per covered stay
                </template>
                <NuxtLink v-else to="/settings/damage-protection" class="underline underline-offset-2">
                  Not activated
                </NuxtLink>
              </dd>
            </div>
          </dl>
        </template>

        <dl v-else-if="pkg?.model === 'per_booking'" class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-xs text-muted-foreground">
              Bookings left
            </dt>
            <dd class="tabular-nums">
              {{ pkg.quotaRemaining }} of {{ pkg.quotaTotal }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Rate
            </dt>
            <dd class="tabular-nums">
              {{ usd(pkg.rateUsd) }} per booking
            </dd>
          </div>
        </dl>
      </section>

      <!-- Payment method -->
      <section class="flex flex-col gap-4 rounded-lg border p-5" aria-labelledby="billing-card" data-testid="billing-card">
        <h3 id="billing-card" class="text-sm font-medium text-muted-foreground">
          Payment method
        </h3>
        <div v-if="card" class="flex items-start gap-3">
          <div class="flex h-9 w-12 shrink-0 items-center justify-center rounded-md border bg-muted">
            <Icon name="lucide:credit-card" class="size-5 text-muted-foreground" />
          </div>
          <div class="min-w-0">
            <p class="font-medium" data-testid="billing-card-label">
              {{ cardBrandLabels[card.brand] }} ending {{ card.last4 }}
            </p>
            <p class="text-sm" :class="cardExpired ? 'text-destructive' : 'text-muted-foreground'">
              {{ cardExpired ? 'Expired' : 'Expires' }} {{ String(card.expMonth).padStart(2, '0') }}/{{ card.expYear }}
            </p>
            <p class="truncate text-sm text-muted-foreground">
              {{ card.holderName }}
            </p>
          </div>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          No card on file.
        </p>
        <p class="text-xs text-muted-foreground">
          Charged for your subscription and for damage waiver invoices.
        </p>
        <Button variant="outline" size="sm" class="self-start" data-testid="billing-card-update" @click="updateOpen = true">
          {{ card ? 'Update card' : 'Add card' }}
        </Button>
      </section>
    </div>

    <!-- Next invoices -->
    <section class="rounded-lg border" aria-labelledby="billing-next" data-testid="billing-next">
      <h3 id="billing-next" class="border-b px-5 py-3 text-sm font-medium text-muted-foreground">
        Next invoices
      </h3>
      <ul class="divide-y">
        <li v-if="nextSub" class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4" data-testid="billing-next-subscription">
          <div>
            <p class="font-medium">
              Subscription, {{ fmtDay(nextSub.on) }}
            </p>
            <p class="text-sm text-muted-foreground">
              {{ nextSub.planName }}, {{ nextSub.units }} {{ nextSub.units === 1 ? 'unit' : 'units' }} at {{ usd(nextSub.unitRateUsd) }}
            </p>
          </div>
          <p class="text-lg font-semibold tabular-nums">
            {{ usd(nextSub.amountUsd) }}
          </p>
        </li>
        <li v-else-if="pkg?.model === 'per_booking'" class="px-5 py-4 text-sm text-muted-foreground">
          No scheduled subscription invoice: your booking quota refills when 10% of it is left.
        </li>
        <li v-if="tern.isActive.value" class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4" data-testid="billing-next-waiver">
          <div>
            <p class="font-medium">
              Damage waiver, {{ fmtDay(nextWaiver.billsOn) }}
            </p>
            <p class="text-sm text-muted-foreground">
              Covered stays that check out in {{ periodLabel(nextWaiver.period) }}, so far.
              <NuxtLink to="/damage-protection?tab=billing" class="underline underline-offset-2">
                See the stays
              </NuxtLink>
            </p>
          </div>
          <div class="text-right">
            <p v-if="!nextWaiver.totals.length" class="text-lg font-semibold tabular-nums">
              {{ usd(0) }}
            </p>
            <p v-for="total in nextWaiver.totals" :key="total.currency" class="text-lg font-semibold tabular-nums">
              {{ formatProtectionAmount(total.total, total.currency) }}
            </p>
          </div>
        </li>
      </ul>
    </section>

    <!-- Billing history -->
    <section class="flex flex-col gap-3" aria-labelledby="billing-history">
      <h3 id="billing-history" class="text-sm font-medium">
        Billing history
      </h3>
      <p v-if="!history.length" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No invoices yet.
      </p>
      <div v-else class="rounded-md border">
        <div class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="billing-history">
            <thead class="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th class="px-4 py-3 text-left font-medium">
                  Date
                </th>
                <th class="px-4 py-3 text-left font-medium">
                  Invoice
                </th>
                <th class="px-4 py-3 text-left font-medium">
                  Type
                </th>
                <th class="px-4 py-3 text-left font-medium">
                  Status
                </th>
                <th class="px-4 py-3 text-right font-medium">
                  Amount
                </th>
                <th class="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in history" :key="row.key" class="border-t align-top" data-testid="billing-history-row">
                <td class="px-4 py-3 whitespace-nowrap tabular-nums">
                  {{ fmtDay(row.date) }}
                </td>
                <td class="px-4 py-3">
                  <p class="font-medium">
                    {{ row.number }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ row.description }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  Invoice
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex rounded-md border px-1.5 py-0.5 text-[11px]" :class="STATUS_CLASS[row.status]" data-testid="billing-history-status">
                    {{ STATUS_LABEL[row.status] }}
                  </span>
                  <p v-if="row.note" class="mt-0.5 text-xs" :class="row.status === 'payment_failed' ? 'text-destructive' : 'text-muted-foreground'">
                    {{ row.note }}
                  </p>
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {{ row.amount }}
                </td>
                <td class="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-7 gap-1 text-xs"
                    :aria-label="`Download ${row.number} as PDF`"
                    data-testid="billing-history-pdf"
                    @click="row.download()"
                  >
                    <Icon name="lucide:download" class="size-3.5" />
                    PDF
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <BillingUpdatePaymentDialog v-model:open="updateOpen" />
  </div>
</template>
