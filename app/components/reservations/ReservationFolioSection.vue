<script setup lang="ts">
import type { FolioItem, FolioItemDraft, FolioPaymentMethod } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import {
  buildFolioSummary,
  canDeleteFolioItem,
  canVoidFolioItem,
  FOLIO_PAYMENT_METHOD_LABELS,
  folioItemUnpaidAmount,
  folioLineTotal,
} from '~/components/reservations/data/folio'
import FolioAddItemDialog from '~/components/reservations/FolioAddItemDialog.vue'
import FolioPayDialog from '~/components/reservations/FolioPayDialog.vue'
import FolioVoidDialog from '~/components/reservations/FolioVoidDialog.vue'
import { useReservationFolio } from '~/composables/useReservationFolio'
import { buildFolioInvoicePdf } from '~/lib/folio-invoice-pdf'

const props = withDefaults(defineProps<{
  reservation: ReservationEntry
  bare?: boolean
}>(), {
  bare: false,
})

const folio = useReservationFolio()

const addOpen = ref(false)
const voidOpen = ref(false)
const voidTargetId = ref<string | null>(null)
const payOpen = ref(false)
const payTargetItem = ref<FolioItem | null>(null)

const items = computed<FolioItem[]>(() => props.reservation.folioItems ?? [])
const summary = computed(() => buildFolioSummary(props.reservation))
const canPost = computed(() => folio.canPostTo(props.reservation.id))
const voidTarget = computed(() => items.value.find(item => item.id === voidTargetId.value) ?? null)

const statusLabels: Record<FolioItem['status'], string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  voided: 'Voided',
}

const statusClasses: Record<FolioItem['status'], string> = {
  unpaid: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  partially_paid: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  paid: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  voided: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

function statusLabel(item: FolioItem): string {
  if (item.status === 'unpaid' && item.paymentMethod === 'room')
    return 'Unpaid, on room account'
  if (item.status === 'partially_paid' && item.paidAmount)
    return `Partially paid (${fmt(item.paidAmount)})`
  if (item.status === 'paid' && item.paymentMethod)
    return `Paid · ${FOLIO_PAYMENT_METHOD_LABELS[item.paymentMethod]}`
  return statusLabels[item.status]
}

function fmt(amount: number): string {
  return `${props.reservation.currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function submitDraft(draft: FolioItemDraft) {
  folio.addItem(props.reservation.id, draft)
}

function pay(item: FolioItem, method: FolioPaymentMethod) {
  folio.markPaid(props.reservation.id, item.id, method)
}

function openPayAll() {
  payTargetItem.value = null
  payOpen.value = true
}

function openPayItem(item: FolioItem) {
  payTargetItem.value = item
  payOpen.value = true
}

function confirmPayment(payload: {
  method: FolioPaymentMethod
  amount: number
  isPartial: boolean
  note?: string
  itemId?: string
}) {
  if (payload.itemId) {
    folio.markPaid(props.reservation.id, payload.itemId, payload.method, {
      amount: payload.amount,
      note: payload.note,
    })
  }
  else {
    folio.markAllAsPaid(props.reservation.id, {
      method: payload.method,
      amount: payload.amount,
      isPartial: payload.isPartial,
      note: payload.note,
    })
  }
  payTargetItem.value = null
}

function handleDownloadInvoice() {
  try {
    buildFolioInvoicePdf(props.reservation, { download: true })
    toast.success('Invoice PDF downloaded')
  }
  catch (err) {
    console.error(err)
    toast.error('Failed to generate invoice PDF')
  }
}

function remove(item: FolioItem) {
  folio.deleteItem(props.reservation.id, item.id)
}

function openVoid(item: FolioItem) {
  voidTargetId.value = item.id
  voidOpen.value = true
}

function confirmVoid(reason: string) {
  if (voidTargetId.value)
    folio.voidItem(props.reservation.id, voidTargetId.value, reason)
  voidTargetId.value = null
}

// Cancelling (or dismissing) the dialog closes it without confirming, so clear
// the target here too, otherwise it sits stale until the next void reopens it.
watch(voidOpen, (open) => {
  if (!open)
    voidTargetId.value = null
})

watch(payOpen, (open) => {
  if (!open)
    payTargetItem.value = null
})
</script>

<template>
  <Accordion
    type="single"
    collapsible
    :default-value="bare ? 'folio' : undefined"
    class="w-full"
    :class="bare ? 'border-none p-0' : 'border-b px-2'"
  >
    <AccordionItem value="folio" class="border-b-0">
      <AccordionTrigger v-if="!bare" class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
        <span class="flex flex-1 items-center gap-2">
          <Icon name="lucide:receipt-text" class="size-4" />
          Charges & extras
          <Badge v-if="items.length" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
            {{ items.length }}
          </Badge>
          <span class="ml-auto mr-2 font-medium text-foreground">{{ fmt(summary.grandTotal) }}</span>
        </span>
      </AccordionTrigger>

      <AccordionContent :class="bare ? 'p-0 pt-1' : 'px-3 pb-3'">
        <div class="space-y-2">
          <!-- Top Action Bar: Download Invoice & Mark all as paid -->
          <div class="flex flex-wrap items-center justify-between gap-2 pb-1">
            <Button
              data-testid="folio-download-invoice"
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 text-xs"
              @click="handleDownloadInvoice"
            >
              <Icon name="lucide:download" class="size-3.5 text-muted-foreground" />
              Download invoice
            </Button>

            <Button
              v-if="summary.unpaidTotal > 0"
              data-testid="folio-mark-all-paid"
              variant="default"
              size="sm"
              class="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              :disabled="!canPost"
              @click="openPayAll"
            >
              <Icon name="lucide:check-check" class="size-3.5" />
              Mark all as paid
            </Button>
          </div>

          <!-- Staff-posted items -->
          <p v-if="!items.length" class="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            Nothing posted yet. Add a minibar item, a laundry bag or anything else the guest owes.
          </p>

          <div
            v-for="item in items"
            :key="item.id"
            data-testid="folio-item-row"
            class="rounded-md border px-3 py-2"
            :class="item.status === 'voided' ? 'bg-muted/20' : 'bg-muted/40'"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium" :class="item.status === 'voided' ? 'line-through text-muted-foreground' : ''">
                  {{ item.label }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ item.quantity }} × {{ fmt(item.unitPrice) }}
                  <template v-if="item.taxPercent">
                    · tax {{ item.taxPercent }}%
                  </template>
                  <template v-if="item.servicePercent">
                    · service {{ item.servicePercent }}%
                  </template>
                </p>
                <p v-if="item.status === 'partially_paid'" class="mt-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Remaining: {{ fmt(folioItemUnpaidAmount(item)) }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="text-sm font-medium" :class="item.status === 'voided' ? 'line-through text-muted-foreground' : ''">
                  {{ fmt(folioLineTotal(item)) }}
                </span>
                <DropdownMenu v-if="canDeleteFolioItem(item) || canVoidFolioItem(item)">
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-7" aria-label="Item actions">
                      <Icon name="lucide:ellipsis-vertical" class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <template v-if="item.status === 'unpaid' || item.status === 'partially_paid'">
                      <DropdownMenuItem data-testid="folio-pay-cash" @click="pay(item, 'cash')">
                        Mark paid · Cash
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="folio-pay-card" @click="pay(item, 'card')">
                        Mark paid · Card
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="folio-pay-custom" @click="openPayItem(item)">
                        Record DP / partial payment...
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="item.paymentMethod !== 'room' && item.status === 'unpaid'"
                        data-testid="folio-pay-room"
                        @click="pay(item, 'room')"
                      >
                        Charge to room
                      </DropdownMenuItem>
                    </template>
                    <DropdownMenuItem
                      v-if="canDeleteFolioItem(item)"
                      data-testid="folio-remove"
                      class="text-destructive"
                      @click="remove(item)"
                    >
                      Remove
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="canVoidFolioItem(item)"
                      data-testid="folio-void"
                      class="text-destructive"
                      @click="openVoid(item)"
                    >
                      Void item
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div class="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" class="h-4 px-1 text-[9px]" :class="statusClasses[item.status]">
                {{ statusLabel(item) }}
              </Badge>
              <span class="text-[10px] text-muted-foreground">{{ item.addedBy }}</span>
            </div>

            <p v-if="item.note" class="mt-1 text-xs text-muted-foreground">
              {{ item.note }}
            </p>
            <p v-if="item.voidReason" class="mt-1 text-xs text-muted-foreground">
              Voided by {{ item.voidedBy }} · {{ item.voidReason }}
            </p>
          </div>

          <!-- Totals -->
          <Separator />
          <div class="space-y-1 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Booking total</span>
              <span>{{ fmt(summary.bookingTotal) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Extras</span>
              <span>{{ fmt(summary.itemsTotal) }}</span>
            </div>
            <div class="flex items-center justify-between border-t pt-1 text-sm font-semibold">
              <span>Total</span>
              <span>{{ fmt(summary.grandTotal) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Extras paid</span>
              <span>{{ fmt(summary.itemsPaid) }}</span>
            </div>
            <!--
              Two independent gross rows, each shown whenever its own figure
              is non-zero. Extras still due (unpaidTotal) and Refund due
              (refundableTotal) are different things that net into the same
              itemsBalance: a stay can owe money on one line and owe a refund
              on another at the same time, and showing only whichever is
              larger (or only the net) hides the other. Neither branches on
              the sign of anything, so neither can disappear just because
              the other outweighs it.
            -->
            <div v-if="summary.unpaidTotal > 0" class="flex items-center justify-between font-medium">
              <span>Extras still due</span>
              <span>{{ fmt(summary.unpaidTotal) }}</span>
            </div>
            <div v-if="summary.refundableTotal > 0" class="flex items-center justify-between font-medium text-destructive">
              <span>Refund due</span>
              <span>{{ fmt(summary.refundableTotal) }}</span>
            </div>
            <div
              v-if="summary.unpaidTotal > 0 || summary.refundableTotal > 0"
              class="flex items-center justify-between border-t pt-1 text-muted-foreground"
            >
              <span>Net of the above</span>
              <span>{{ summary.refundDue > 0 ? `Refund ${fmt(summary.refundDue)}` : fmt(summary.itemsBalance) }}</span>
            </div>
            <div v-else class="flex items-center justify-between font-medium">
              <span>Extras settled</span>
              <span>{{ fmt(0) }}</span>
            </div>
          </div>

          <!-- Add -->
          <Button
            data-testid="folio-add"
            variant="outline"
            size="sm"
            class="w-full"
            :disabled="!canPost"
            @click="addOpen = true"
          >
            <Icon name="lucide:plus" class="mr-1 size-4" />
            Add item
          </Button>
          <p v-if="!canPost" class="text-center text-[10px] text-muted-foreground">
            This reservation is {{ reservation.status === 'blocked' ? 'blocked' : 'cancelled' }}, so no new
            charges can be posted.
          </p>
        </div>
      </AccordionContent>
    </AccordionItem>

    <FolioAddItemDialog
      v-model:open="addOpen"
      :reservation="reservation"
      @submit="submitDraft"
    />
    <FolioVoidDialog
      v-model:open="voidOpen"
      :item="voidTarget"
      :currency="reservation.currency"
      @confirm="confirmVoid"
    />
    <FolioPayDialog
      v-model:open="payOpen"
      :reservation="reservation"
      :target-item="payTargetItem"
      @confirm="confirmPayment"
    />
  </Accordion>
</template>
