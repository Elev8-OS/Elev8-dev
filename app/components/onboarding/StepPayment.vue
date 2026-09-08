<script setup lang="ts">
import { toast } from 'vue-sonner'
import { formatUsd, PER_UNIT_CONTRACT_MONTHS, pmsModelOption } from '~/components/onboarding/data/onboarding'

const emit = defineEmits<{ (e: 'next'): void, (e: 'back'): void }>()

const {
  state,
  orderSummary,
  appliedPromo,
  applyPromo,
  removePromo,
  submitPayment,
  status,
} = useOnboarding()

const codeInput = ref(appliedPromo.value?.code ?? '')
const promoError = ref('')
const isApplying = ref(false)
const paymentError = ref('')
/** Demo switch so the declined card path can be exercised without a real Stripe. */
const simulateDecline = ref(false)

// Credit card info fields (User requirement)
const cardName = ref(state.value.profile.companyName || '')
const cardNumber = ref('')
const cardExpiry = ref('')
const cardCvc = ref('')
const cardPostal = ref(state.value.profile.zipCode || '')

function formatCardNumber(e: Event) {
  const target = e.target as HTMLInputElement
  const raw = target.value.replace(/\D/g, '').slice(0, 16)
  const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ')
  cardNumber.value = formatted
}

function formatExpiry(e: Event) {
  const target = e.target as HTMLInputElement
  const raw = target.value.replace(/\D/g, '').slice(0, 4)
  if (raw.length >= 3) {
    cardExpiry.value = `${raw.slice(0, 2)} / ${raw.slice(2)}`
  }
  else {
    cardExpiry.value = raw
  }
}

const summary = computed(() => orderSummary.value)
const model = computed(() => state.value.pmsModel)
const hasFailed = computed(() => status.value === 'payment_failed')

async function onApply(): Promise<void> {
  if (!codeInput.value.trim())
    return
  isApplying.value = true
  promoError.value = ''
  const result = await applyPromo(codeInput.value)
  isApplying.value = false

  if (result.valid) {
    toast.success(result.message)
    return
  }
  // Names the actual reason rather than a generic rejection (PRD 8).
  promoError.value = result.message
}

function onRemove(): void {
  removePromo()
  codeInput.value = ''
  promoError.value = ''
}

async function onPay(): Promise<void> {
  paymentError.value = ''
  const result = await submitPayment({ declineCard: simulateDecline.value })
  if (!result.ok) {
    paymentError.value = result.message
    return
  }
  toast.success(result.message)
  emit('next')
}
</script>

<template>
  <form v-if="summary" id="ob-payment-form" class="flex flex-col gap-6" @submit.prevent="onPay">
    <div>
      <h3 class="text-base font-semibold tracking-tight text-foreground">
        Review and activate
      </h3>
      <p class="text-xs text-muted-foreground">
        {{ model ? pmsModelOption(model).title : '' }}
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <!-- ── Credit Card Input Fields ────────────────────────────────────── -->
      <div class="flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
        <div class="flex items-center justify-between border-b border-border/60 pb-3">
          <div class="flex items-center gap-2">
            <Icon name="lucide:credit-card" class="size-4 text-foreground" />
            <h4 class="text-sm font-semibold text-foreground">
              Credit card details
            </h4>
          </div>
          <div class="flex items-center gap-1.5 opacity-80">
            <Icon name="simple-icons:visa" class="h-4 w-7 text-[#1A1F71]" />
            <Icon name="simple-icons:mastercard" class="h-4 w-6 text-[#EB001B]" />
            <Icon name="simple-icons:americanexpress" class="h-4 w-6 text-[#006FCF]" />
          </div>
        </div>

        <div class="space-y-4">
          <!-- Cardholder Name -->
          <div class="grid gap-1.5">
            <Label for="ob-cc-name" class="text-xs font-medium">Name on card</Label>
            <Input
              id="ob-cc-name"
              v-model="cardName"
              placeholder="e.g. Jane Doe"
            />
          </div>

          <!-- Card Number -->
          <div class="grid gap-1.5">
            <Label for="ob-cc-number" class="text-xs font-medium">Card number</Label>
            <div class="relative">
              <Input
                id="ob-cc-number"
                :value="cardNumber"
                placeholder="4242 •••• •••• 4242"
                maxlength="19"
                class="font-mono tracking-wider pl-9"
                @input="formatCardNumber"
              />
              <Icon name="lucide:lock" class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            </div>
          </div>

          <!-- Expiration and CVC -->
          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-1.5">
              <Label for="ob-cc-expiry" class="text-xs font-medium">Expiration date</Label>
              <Input
                id="ob-cc-expiry"
                :value="cardExpiry"
                placeholder="MM / YY"
                maxlength="7"
                class="font-mono"
                @input="formatExpiry"
              />
            </div>
            <div class="grid gap-1.5">
              <Label for="ob-cc-cvc" class="text-xs font-medium">CVC / CVV</Label>
              <Input
                id="ob-cc-cvc"
                v-model="cardCvc"
                placeholder="123"
                maxlength="4"
                class="font-mono"
              />
            </div>
          </div>

          <!-- Postal Code -->
          <div class="grid gap-1.5">
            <Label for="ob-cc-postal" class="text-xs font-medium">Billing postal code</Label>
            <Input
              id="ob-cc-postal"
              v-model="cardPostal"
              placeholder="ZIP / Postal code"
            />
          </div>

          <!-- Security reassurance -->
          <div class="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground">
            <Icon name="lucide:shield-check" class="size-4 shrink-0 text-emerald-600" />
            <span>Payments are securely processed using 256-bit end-to-end SSL encryption.</span>
          </div>
        </div>
      </div>

      <!-- ── Order Summary ────────────────────────────────────────────── -->
      <div class="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
        <div>
          <h4 class="text-sm font-semibold text-foreground">
            Order summary
          </h4>
          <p class="text-xs font-medium text-foreground mt-1">
            {{ summary.planName }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ summary.planDetail }}
          </p>
        </div>

        <!-- Promo field -->
        <div class="grid gap-2 border-t border-border/60 pt-4">
          <Label for="ob-promo" class="text-xs font-medium">Promo code</Label>
          <div v-if="appliedPromo" class="flex items-center justify-between gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
            <span class="flex items-center gap-2 text-xs font-medium text-green-800">
              <Icon name="lucide:badge-check" class="size-4" />
              {{ appliedPromo.code }} applied
            </span>
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="onRemove">
              Remove
            </Button>
          </div>
          <div v-else class="flex gap-2">
            <Input
              id="ob-promo"
              v-model="codeInput"
              placeholder="Enter a code"
              class="font-mono uppercase text-xs"
              spellcheck="false"
              :aria-invalid="Boolean(promoError)"
              @keydown.enter.prevent="onApply"
            />
            <Button variant="outline" size="sm" :disabled="isApplying || !codeInput.trim()" @click="onApply">
              <Icon v-if="isApplying" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
              Apply
            </Button>
          </div>
          <p v-if="promoError" class="text-xs text-destructive">
            {{ promoError }}
          </p>
          <p v-else-if="!appliedPromo" class="text-[11px] text-muted-foreground">
            No code? Leave this empty.
          </p>
        </div>

        <!-- Price breakdown -->
        <dl class="flex flex-col gap-2 border-t border-border/60 pt-4 text-xs">
          <div class="flex justify-between gap-2">
            <dt class="text-muted-foreground">
              Subtotal
            </dt>
            <dd class="tabular-nums font-medium">
              {{ formatUsd(summary.subtotal) }}
            </dd>
          </div>
          <div v-if="summary.discount > 0" class="flex justify-between gap-2 text-green-700">
            <dt>Discount, {{ summary.promoCode }}</dt>
            <dd class="tabular-nums font-medium">
              -{{ formatUsd(summary.discount) }}
            </dd>
          </div>
          <div class="flex justify-between gap-2 border-t border-border/60 pt-2 text-sm font-semibold text-foreground">
            <dt>Total due today</dt>
            <dd class="tabular-nums">
              {{ formatUsd(summary.total) }}
            </dd>
          </div>
        </dl>

        <p v-if="summary.discountIsFirstInvoiceOnly && summary.nextPeriodAmount !== null" class="text-[11px] text-muted-foreground">
          This discount covers your first invoice only. From {{ summary.nextPeriodLabel }} you pay
          {{ formatUsd(summary.nextPeriodAmount) }}.
        </p>

        <p v-if="summary.contractMonths" class="text-[11px] text-muted-foreground">
          Per unit plans run on a {{ PER_UNIT_CONTRACT_MONTHS }} month contract.
        </p>

        <!-- Payment failure message -->
        <div v-if="hasFailed" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p class="text-xs font-medium text-destructive">
            Payment did not go through
          </p>
          <p class="mt-1 text-xs text-destructive/90">
            {{ paymentError || 'Try another card. Your details are still saved.' }}
          </p>
        </div>
        <p v-else-if="paymentError" class="text-xs text-destructive">
          {{ paymentError }}
        </p>

        <!-- Decline simulator toggle -->
        <div class="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <Label for="ob-decline" class="text-xs font-normal text-muted-foreground">
            Simulate a declined card
          </Label>
          <Switch id="ob-decline" :model-value="simulateDecline" @update:model-value="(v) => simulateDecline = Boolean(v)" />
        </div>
      </div>
    </div>
  </form>
</template>
