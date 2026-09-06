<script setup lang="ts">
import { Icon } from '#components'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useSubscriptionBilling } from '~/composables/useSubscriptionBilling'
import {
  cardBrandLabels,
  declineReasonLabels,
  detectCardBrand,
  formatUsd,
} from './data/subscription-billing'

const open = defineModel<boolean>('open', { default: false })

const { billing, isProcessing, isPaymentFailed, updatePaymentMethod, retryPayment } = useSubscriptionBilling()

const holderName = ref('')
const cardNumber = ref('')
const expiry = ref('')
const cvc = ref('')
const error = ref<string | null>(null)
const retrying = ref(false)

const currentCard = computed(() => {
  const pm = billing.value.paymentMethod
  return pm ? `${cardBrandLabels[pm.brand]} •••• ${pm.last4}` : null
})

const brand = computed(() => detectCardBrand(cardNumber.value))

const parsedExpiry = computed(() => {
  const match = expiry.value.match(/^(\d{2})\s*\/\s*(\d{2})$/)
  if (!match)
    return null
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12)
    return null
  return { month, year }
})

const digits = computed(() => cardNumber.value.replace(/\D/g, ''))

const canSubmit = computed(() =>
  holderName.value.trim().length > 1
  && digits.value.length >= 15
  && parsedExpiry.value !== null
  && cvc.value.replace(/\D/g, '').length >= 3
  && !isProcessing.value,
)

function onCardInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 16)
  cardNumber.value = raw.replace(/(.{4})/g, '$1 ').trim()
}

function onExpiryInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
  expiry.value = raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw
}

function onCvcInput(event: Event) {
  cvc.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
}

function resetForm() {
  holderName.value = ''
  cardNumber.value = ''
  expiry.value = ''
  cvc.value = ''
  error.value = null
}

watch(open, (isOpen) => {
  if (isOpen)
    resetForm()
})

async function handleSubmit() {
  const exp = parsedExpiry.value
  if (!exp || !canSubmit.value)
    return
  error.value = null

  const result = await updatePaymentMethod({
    cardNumber: cardNumber.value,
    expMonth: exp.month,
    expYear: exp.year,
    cvc: cvc.value,
    holderName: holderName.value,
    brand: brand.value,
  })

  if (!result.ok) {
    error.value = result.error ?? 'The payment could not be processed.'
    return
  }

  toast.success('Payment method updated', {
    description: 'The outstanding invoice has been paid. Your account is active again.',
  })
  open.value = false
}

async function handleRetry() {
  error.value = null
  retrying.value = true
  const result = await retryPayment()
  retrying.value = false

  if (!result.ok) {
    error.value = result.error ?? 'The retry did not go through.'
    return
  }

  toast.success('Payment successful', {
    description: `${currentCard.value} was charged. Your account is active again.`,
  })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Update payment method</DialogTitle>
        <DialogDescription>
          We will charge the outstanding invoice as soon as the new card is saved.
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="isPaymentFailed && billing.failedInvoice"
        class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
      >
        <div class="flex items-center justify-between font-medium">
          <span>{{ billing.failedInvoice.periodLabel }}</span>
          <span>{{ formatUsd(billing.failedInvoice.amountUsd) }}</span>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ billing.failedInvoice.number }} · {{ declineReasonLabels[billing.failedInvoice.declineReason] }}
          <template v-if="currentCard">
            ({{ currentCard }})
          </template>
        </p>
      </div>

      <div class="space-y-3">
        <div class="space-y-1.5">
          <Label for="billing-holder">
            Name on card
          </Label>
          <Input id="billing-holder" v-model="holderName" placeholder="Bali Villas Co." autocomplete="cc-name" />
        </div>

        <div class="space-y-1.5">
          <Label for="billing-card">
            Card number
          </Label>
          <div class="relative">
            <Input
              id="billing-card"
              :model-value="cardNumber"
              placeholder="4242 4242 4242 4242"
              inputmode="numeric"
              autocomplete="cc-number"
              class="pr-16"
              @input="onCardInput"
            />
            <span
              v-if="digits.length >= 2"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
            >
              {{ cardBrandLabels[brand] }}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <Label for="billing-expiry">
              Expiry
            </Label>
            <Input
              id="billing-expiry"
              :model-value="expiry"
              placeholder="MM/YY"
              inputmode="numeric"
              autocomplete="cc-exp"
              @input="onExpiryInput"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="billing-cvc">
              CVC
            </Label>
            <Input
              id="billing-cvc"
              :model-value="cvc"
              placeholder="123"
              inputmode="numeric"
              autocomplete="cc-csc"
              @input="onCvcInput"
            />
          </div>
        </div>

        <p v-if="error" class="flex items-start gap-2 text-sm text-destructive">
          <Icon name="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0" />
          <span>
            {{ error }}
          </span>
        </p>
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button
          v-if="currentCard && isPaymentFailed"
          variant="outline"
          :disabled="isProcessing"
          @click="handleRetry"
        >
          <Icon v-if="retrying" name="lucide:loader-2" class="size-4 animate-spin" />
          Retry {{ currentCard }}
        </Button>
        <Button :disabled="!canSubmit" @click="handleSubmit">
          <Icon v-if="isProcessing && !retrying" name="lucide:loader-2" class="size-4 animate-spin" />
          Save and pay
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
