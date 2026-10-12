<script setup lang="ts">
import type { ComponentPublicInstance, Ref } from 'vue'
import { nextTick } from 'vue'
import { toast } from 'vue-sonner'
import { formatUsd, PER_UNIT_CONTRACT_MONTHS, pmsModelOption } from '~/components/onboarding/data/onboarding'

const emit = defineEmits<{ (e: 'next'): void, (e: 'back'): void, (e: 'skipCard'): void }>()

const {
  state,
  orderSummary,
  appliedPromo,
  applyPromo,
  removePromo,
  submitPayment,
  status,
  isSavingPayment,
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

/**
 * Formatting runs through v-model and a watcher. Binding `:value` + `@input` on the
 * shadcn Input gave it two writers (its own internal v-model and ours), so typed
 * digits jumped and doubled.
 */
function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 4)
  return raw.length >= 3 ? `${raw.slice(0, 2)} / ${raw.slice(2)}` : raw
}

const cardNumberInput = ref<ComponentPublicInstance | null>(null)
const cardExpiryInput = ref<ComponentPublicInstance | null>(null)

/**
 * When a stripped character leaves the text equal to what is already rendered (a
 * letter, a seventeenth digit), Vue sees no change and the input keeps showing it.
 */
function applyFormatted(target: Ref<string>, formatted: string, input: ComponentPublicInstance | null): void {
  target.value = formatted
  nextTick(() => {
    const el = input?.$el as HTMLInputElement | undefined
    if (el && el.value !== formatted)
      el.value = formatted
  })
}

watch(cardNumber, (value) => {
  const formatted = formatCardNumber(value)
  if (formatted !== value)
    applyFormatted(cardNumber, formatted, cardNumberInput.value)
})

watch(cardExpiry, (value, previous) => {
  // Deleting back over " / " must not re-add it, or backspace gets stuck.
  const deletedIntoSlash = value.length < (previous?.length ?? 0) && /\/\s*$/.test(value)
  const formatted = deletedIntoSlash ? value.replace(/\s*\/\s*$/, '') : formatExpiry(value)
  if (formatted !== value)
    applyFormatted(cardExpiry, formatted, cardExpiryInput.value)
})

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
                ref="cardNumberInput"
                v-model="cardNumber"
                placeholder="4242 •••• •••• 4242"
                maxlength="19"
                inputmode="numeric"
                autocomplete="cc-number"
                class="font-mono tracking-wider pl-9"
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
                ref="cardExpiryInput"
                v-model="cardExpiry"
                placeholder="MM / YY"
                maxlength="7"
                inputmode="numeric"
                autocomplete="cc-exp"
                class="font-mono"
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
          <div v-for="addOn in summary.addOns" :key="addOn.name" class="mt-2">
            <p class="text-xs font-medium text-foreground">
              + {{ addOn.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ addOn.detail }}
            </p>
          </div>
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
          <template v-if="summary.addOns.length">
            <div class="flex justify-between gap-2">
              <dt class="text-muted-foreground">
                Plan
              </dt>
              <dd class="tabular-nums font-medium">
                {{ formatUsd(summary.planAmount) }}
              </dd>
            </div>
            <div v-for="addOn in summary.addOns" :key="addOn.name" class="flex justify-between gap-2">
              <dt class="text-muted-foreground">
                {{ addOn.name }}
              </dt>
              <dd class="tabular-nums font-medium">
                {{ formatUsd(addOn.amount) }}
              </dd>
            </div>
          </template>
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

        <div class="flex flex-col gap-1">
          <Button
            type="submit"
            size="lg"
            :disabled="isSavingPayment"
            class="w-full h-11 text-sm font-medium"
          >
            <Icon v-if="isSavingPayment" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
            <Icon v-else name="lucide:lock" class="mr-2 size-4" />
            {{ isSavingPayment ? 'Processing payment' : summary.total > 0 ? `Pay ${formatUsd(summary.total)}` : 'Activate plan' }}
          </Button>
          <Button
            v-if="summary.total === 0"
            type="button"
            variant="ghost"
            size="sm"
            :disabled="isSavingPayment"
            class="text-xs text-muted-foreground hover:text-foreground"
            @click="emit('skipCard')"
          >
            Continue without saving a card
          </Button>
        </div>

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
            Your card was declined
          </p>
          <p class="mt-1 text-xs text-destructive/90">
            {{ paymentError || 'Nothing was charged. Check the card details or use a different card.' }}
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
