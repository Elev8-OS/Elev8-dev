<script setup lang="ts">
import type { WaiverInvoice } from '~/components/damage-protection/data/waiver-billing'
import { toast } from 'vue-sonner'
import { billingDateFor, periodLabel, WAIVER_INVOICE_STATUS_LABELS } from '~/components/damage-protection/data/waiver-billing'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { ternProduct } from '~/components/reservations/data/tern-products'
import { useSubscriptionBilling } from '~/composables/useSubscriptionBilling'
import { useTernActivation } from '~/composables/useTernActivation'
import { useWaiverBilling } from '~/composables/useWaiverBilling'
import { buildWaiverInvoicePdf } from '~/lib/waiver-invoice-pdf'

/**
 * Elev8's damage waiver billing, seen by the tenant: what the next 1st will
 * invoice so far, and every invoice since, each downloadable as a PDF. The
 * rules are in `waiver-billing.ts`; this only reads and asks.
 */
const props = withDefaults(defineProps<{ canEdit?: boolean }>(), { canEdit: false })

const billing = useWaiverBilling()
const tern = useTernActivation()
const subscription = useSubscriptionBilling()

const df = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
function fmtDay(iso: string): string {
  return df.format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso))
}
function money(amount: number, currency: string): string {
  return formatProtectionAmount(amount, currency)
}

const upcoming = computed(() => billing.upcoming.value)
const expanded = ref<string | null>(null)

function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}

const STATUS_CLASS: Record<WaiverInvoice['status'], string> = {
  paid: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  charging: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  payment_failed: 'border-destructive/30 bg-destructive/10 text-destructive',
}

function download(invoice: WaiverInvoice) {
  buildWaiverInvoicePdf(invoice, { download: true })
}

async function retry(invoice: WaiverInvoice) {
  const result = await billing.retryCharge(invoice.id)
  if (result.ok) {
    toast.success(`${invoice.number} paid`)
  }
  else {
    toast.error(subscription.needsPaymentUpdate.value
      ? 'Declined again. Update the card on your Elev8 subscription first, in the banner at the top.'
      : 'The charge did not go through.')
  }
}

/** Plays the coming 1st now, for the demo: the month in progress is billed as if it had ended. */
async function runNextFirst() {
  const created = await billing.runDueBilling(billingDateFor(upcoming.value.period))
  if (!created.length) {
    toast.info(`Nothing to bill for ${periodLabel(upcoming.value.period)}: no covered stays checked out.`)
    return
  }
  const paid = created.filter(inv => inv.status === 'paid')
  if (paid.length === created.length)
    toast.success(`${created.length === 1 ? `${created[0]!.number} issued and paid` : `${created.length} invoices issued and paid`}`)
  else
    toast.error('Invoice issued, but the charge was declined. See below.')
}
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="waiver-billing">
    <p
      v-if="!tern.isActive.value"
      class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
      data-testid="waiver-billing-inactive"
    >
      Billing starts once the damage waiver is activated. Elev8 then invoices the Tern fee on the 1st of every month.
    </p>

    <template v-else>
      <!-- The next 1st -->
      <div class="flex flex-col gap-4 rounded-lg border p-5" data-testid="waiver-billing-upcoming">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium">
              Next invoice on {{ fmtDay(upcoming.billsOn) }}
            </p>
            <p class="text-sm text-muted-foreground">
              For covered stays that check out in {{ periodLabel(upcoming.period) }}. Charged to {{ billing.cardLabel.value }},
              the card on your Elev8 subscription.
            </p>
          </div>
          <Button
            v-if="props.canEdit"
            size="sm"
            variant="outline"
            :disabled="billing.running.value"
            data-testid="waiver-billing-run"
            @click="runNextFirst"
          >
            <Icon v-if="billing.running.value" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
            Run the {{ fmtDay(upcoming.billsOn) }} billing now (demo)
          </Button>
        </div>

        <div class="flex flex-wrap gap-8">
          <div v-if="!upcoming.totals.length">
            <p class="text-xs text-muted-foreground">
              So far
            </p>
            <p class="text-lg font-semibold tabular-nums">
              Nothing yet
            </p>
          </div>
          <div v-for="total in upcoming.totals" :key="total.currency">
            <p class="text-xs text-muted-foreground">
              So far, {{ total.count }} {{ total.count === 1 ? 'stay' : 'stays' }}
            </p>
            <p class="text-lg font-semibold tabular-nums" data-testid="waiver-billing-upcoming-total">
              {{ money(total.total, total.currency) }}
            </p>
          </div>
        </div>

        <p
          v-if="subscription.needsPaymentUpdate.value"
          class="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
          data-testid="waiver-billing-card-failing"
        >
          <Icon name="lucide:alert-triangle" class="mt-0.5 size-3.5 shrink-0" />
          The card on your subscription is failing, so this charge would be declined too. Update it in the banner at the top.
        </p>
      </div>

      <!-- Invoices -->
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium">
          Invoices
        </h3>
        <p v-if="!billing.history.value.length" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No invoices yet. The first one is issued on {{ fmtDay(upcoming.billsOn) }}.
        </p>
        <div v-else class="rounded-md border">
          <div class="overflow-x-auto">
            <table class="w-full text-sm" data-testid="waiver-invoices">
              <thead class="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left font-medium">
                    Invoice
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Month
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    Stays
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    Total
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Status
                  </th>
                  <th class="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                <template v-for="invoice in billing.history.value" :key="invoice.id">
                  <tr class="border-t" data-testid="waiver-invoice">
                    <td class="px-4 py-3">
                      <button
                        type="button"
                        class="flex items-center gap-1.5 font-medium hover:underline"
                        :aria-expanded="expanded === invoice.id"
                        :aria-label="`Show the stays on ${invoice.number}`"
                        @click="toggle(invoice.id)"
                      >
                        <Icon :name="expanded === invoice.id ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="size-4" />
                        {{ invoice.number }}
                      </button>
                      <p class="pl-5.5 text-xs text-muted-foreground">
                        Issued {{ fmtDay(invoice.issuedOn) }}
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      {{ periodLabel(invoice.period) }}
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums">
                      {{ invoice.lines.length }}
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {{ money(invoice.total, invoice.currency) }}
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex rounded-md border px-1.5 py-0.5 text-[11px]"
                        :class="STATUS_CLASS[invoice.status]"
                        data-testid="waiver-invoice-status"
                      >
                        {{ WAIVER_INVOICE_STATUS_LABELS[invoice.status] }}
                      </span>
                      <p v-if="invoice.status === 'paid' && invoice.chargedAt" class="mt-0.5 text-xs text-muted-foreground">
                        {{ fmtDay(invoice.chargedAt) }}, {{ invoice.cardLabel }}
                      </p>
                      <p v-else-if="invoice.failureReason" class="mt-0.5 text-xs text-destructive">
                        {{ invoice.failureReason }}
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center justify-end gap-1">
                        <Button
                          v-if="invoice.status === 'payment_failed' && props.canEdit"
                          size="sm"
                          variant="outline"
                          class="h-7 text-xs"
                          :disabled="billing.charging.value.includes(invoice.id)"
                          data-testid="waiver-invoice-retry"
                          @click="retry(invoice)"
                        >
                          Retry charge
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          class="h-7 gap-1 text-xs"
                          :aria-label="`Download ${invoice.number} as PDF`"
                          data-testid="waiver-invoice-pdf"
                          @click="download(invoice)"
                        >
                          <Icon name="lucide:download" class="size-3.5" />
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="expanded === invoice.id" class="bg-muted/30" data-testid="waiver-invoice-lines">
                    <td colspan="6" class="px-4 py-3">
                      <ul class="flex flex-col gap-1.5 text-xs">
                        <li v-for="line in invoice.lines" :key="line.reservationId" class="flex flex-wrap items-baseline gap-x-3">
                          <span class="w-24 shrink-0 tabular-nums text-muted-foreground">{{ fmtDay(line.checkOut) }}</span>
                          <span class="font-medium">{{ line.guestName }}</span>
                          <span class="text-muted-foreground">{{ line.listingName }}</span>
                          <span class="text-muted-foreground">
                            {{ line.tier ? `Tern ${ternProduct(line.tier).name}` : '' }}{{ line.paidBy === 'host' ? ', you pay' : ', guest pays' }}
                          </span>
                          <span class="ml-auto tabular-nums">{{ money(line.fee, invoice.currency) }}</span>
                        </li>
                      </ul>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
