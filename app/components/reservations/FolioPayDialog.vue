<script setup lang="ts">
import type { FolioItem, FolioPaymentMethod } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import {
  buildFolioSummary,
  folioItemUnpaidAmount,
  roundFolioAmount,
} from '~/components/reservations/data/folio'

const props = defineProps<{
  open: boolean
  reservation: ReservationEntry
  targetItem?: FolioItem | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [payload: {
    method: FolioPaymentMethod
    amount: number
    isPartial: boolean
    note?: string
    itemId?: string
  }]
}>()

const method = ref<FolioPaymentMethod>('cash')
const isPartial = ref(false)
const partialAmount = ref<number | null>(null)
const note = ref('')

const totalDue = computed(() => {
  if (props.targetItem)
    return folioItemUnpaidAmount(props.targetItem)
  return buildFolioSummary(props.reservation).unpaidTotal
})

function fmt(amount: number): string {
  return `${props.reservation.currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const effectiveAmount = computed(() => {
  if (!isPartial.value)
    return totalDue.value
  return partialAmount.value ?? 0
})

const remainingAfterPay = computed(() => {
  return roundFolioAmount(Math.max(0, totalDue.value - effectiveAmount.value))
})

const canConfirm = computed(() => {
  if (totalDue.value <= 0)
    return false
  if (!isPartial.value)
    return true
  return (
    partialAmount.value !== null
    && Number.isFinite(partialAmount.value)
    && partialAmount.value > 0
    && partialAmount.value <= totalDue.value
  )
})

function setPercentage(pct: number) {
  isPartial.value = true
  partialAmount.value = roundFolioAmount(totalDue.value * (pct / 100))
}

function selectFull() {
  isPartial.value = false
  partialAmount.value = totalDue.value
}

function selectPartial() {
  isPartial.value = true
  if (partialAmount.value === null || partialAmount.value >= totalDue.value) {
    partialAmount.value = roundFolioAmount(totalDue.value * 0.5)
  }
}

function confirm() {
  if (!canConfirm.value)
    return

  emit('confirm', {
    method: method.value,
    amount: effectiveAmount.value,
    isPartial: isPartial.value,
    note: note.value.trim() || undefined,
    itemId: props.targetItem?.id,
  })

  emit('update:open', false)
}

watch(() => props.open, (open) => {
  if (open) {
    method.value = 'cash'
    isPartial.value = false
    partialAmount.value = totalDue.value
    note.value = ''
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-md" data-testid="folio-pay-dialog">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:check-circle-2" class="size-5 text-foreground" />
          {{ targetItem ? `Collect Payment · ${targetItem.label}` : 'Mark Folio as Paid' }}
        </DialogTitle>
        <DialogDescription>
          {{ targetItem
            ? `Record full or partial / down payment (DP) for ${targetItem.label}.`
            : 'Record payment for all outstanding folio charges.'
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-1">
        <!-- Balance banner -->
        <div class="rounded-lg border bg-muted/30 p-3.5 flex items-center justify-between">
          <div>
            <span class="text-xs text-muted-foreground">Total outstanding due</span>
            <p class="text-base font-semibold text-foreground">
              {{ fmt(totalDue) }}
            </p>
          </div>
          <Badge variant="outline" class="text-xs font-normal">
            {{ reservation.currency }}
          </Badge>
        </div>

        <!-- Payment mode: Full vs Partial (DP) -->
        <div class="space-y-2">
          <Label class="text-xs font-medium text-muted-foreground">Payment Type</Label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="folio-pay-mode-full"
              class="flex flex-col items-start gap-1 rounded-md border p-2.5 text-left text-xs transition-colors"
              :class="!isPartial
                ? 'border-primary bg-primary/10 text-foreground font-medium shadow-xs'
                : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'"
              @click="selectFull"
            >
              <div class="flex items-center gap-1.5">
                <Icon
                  name="lucide:check"
                  class="size-3.5"
                  :class="!isPartial ? 'text-foreground font-bold' : 'text-muted-foreground'"
                />
                <span :class="!isPartial ? 'text-foreground font-semibold' : 'text-foreground/80'">Full Payment</span>
              </div>
              <span class="text-[11px] text-muted-foreground font-normal">
                {{ fmt(totalDue) }}
              </span>
            </button>

            <button
              type="button"
              data-testid="folio-pay-mode-partial"
              class="flex flex-col items-start gap-1 rounded-md border p-2.5 text-left text-xs transition-colors"
              :class="isPartial
                ? 'border-primary bg-primary/10 text-foreground font-medium shadow-xs'
                : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'"
              @click="selectPartial"
            >
              <div class="flex items-center gap-1.5">
                <Icon
                  name="lucide:split"
                  class="size-3.5"
                  :class="isPartial ? 'text-foreground font-bold' : 'text-muted-foreground'"
                />
                <span :class="isPartial ? 'text-foreground font-semibold' : 'text-foreground/80'">Partial / DP</span>
              </div>
              <span class="text-[11px] text-muted-foreground font-normal">
                Pay down payment
              </span>
            </button>
          </div>
        </div>

        <!-- Partial Payment Configuration -->
        <div v-if="isPartial" class="space-y-3 rounded-lg border border-dashed p-3 bg-muted/10">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-medium text-foreground">Quick DP Presets</Label>
            <div class="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-6 px-2 text-[10px]"
                @click="setPercentage(25)"
              >
                25%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-6 px-2 text-[10px]"
                @click="setPercentage(30)"
              >
                30%
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-6 px-2 text-[10px]"
                @click="setPercentage(50)"
              >
                50% DP
              </Button>
            </div>
          </div>

          <div class="space-y-1">
            <Label for="dp-amount" class="text-xs text-muted-foreground">Amount to pay now</Label>
            <div class="relative">
              <span class="absolute left-3 top-2 text-xs font-medium text-muted-foreground">
                {{ reservation.currency }}
              </span>
              <Input
                id="dp-amount"
                v-model.number="partialAmount"
                type="number"
                step="any"
                min="0.01"
                :max="totalDue"
                data-testid="folio-pay-amount-input"
                class="pl-12"
                placeholder="0.00"
              />
            </div>
          </div>

          <div class="flex items-center justify-between text-xs pt-1 border-t">
            <span class="text-muted-foreground">Remaining balance after payment:</span>
            <span class="font-semibold text-foreground">
              {{ fmt(remainingAfterPay) }}
            </span>
          </div>
        </div>

        <!-- Payment Method -->
        <div class="space-y-1.5">
          <Label class="text-xs font-medium text-muted-foreground">Payment Method</Label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              data-testid="folio-pay-method-cash"
              class="flex items-center justify-center gap-1.5 rounded-md border p-2 text-xs transition-colors"
              :class="method === 'cash'
                ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs'
                : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'"
              @click="method = 'cash'"
            >
              <Icon
                name="lucide:banknote"
                class="size-3.5"
                :class="method === 'cash' ? 'text-foreground' : 'text-muted-foreground'"
              />
              <span class="text-foreground font-medium">Cash</span>
            </button>
            <button
              type="button"
              data-testid="folio-pay-method-card"
              class="flex items-center justify-center gap-1.5 rounded-md border p-2 text-xs transition-colors"
              :class="method === 'card'
                ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs'
                : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'"
              @click="method = 'card'"
            >
              <Icon
                name="lucide:credit-card"
                class="size-3.5"
                :class="method === 'card' ? 'text-foreground' : 'text-muted-foreground'"
              />
              <span class="text-foreground font-medium">Card</span>
            </button>
            <button
              type="button"
              data-testid="folio-pay-method-bank"
              class="flex items-center justify-center gap-1.5 rounded-md border p-2 text-xs transition-colors"
              :class="method === 'bank_transfer'
                ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs'
                : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'"
              @click="method = 'bank_transfer'"
            >
              <Icon
                name="lucide:landmark"
                class="size-3.5"
                :class="method === 'bank_transfer' ? 'text-foreground' : 'text-muted-foreground'"
              />
              <span class="text-foreground font-medium">Bank</span>
            </button>
          </div>
        </div>

        <!-- Optional Note -->
        <div class="space-y-1">
          <Label for="pay-note" class="text-xs text-muted-foreground">Notes (optional)</Label>
          <Input
            id="pay-note"
            v-model="note"
            data-testid="folio-pay-note"
            class="text-xs"
            placeholder="e.g. DP 50% via BCA / cash front desk"
          />
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button
          variant="outline"
          size="sm"
          @click="emit('update:open', false)"
        >
          Cancel
        </Button>
        <Button
          data-testid="folio-pay-confirm"
          size="sm"
          :disabled="!canConfirm"
          @click="confirm"
        >
          <Icon name="lucide:check" class="mr-1.5 size-4" />
          {{ isPartial ? `Record DP · ${fmt(effectiveAmount)}` : `Mark Paid · ${fmt(effectiveAmount)}` }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
