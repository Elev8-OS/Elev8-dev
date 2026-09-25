<script setup lang="ts">
interface OptionView {
  option: 'waiver' | 'deposit'
  amount: number
  currency: string
  coverageCap?: number
  exclusions?: string[]
  /** Deposit: how long after check-out the card stays on file. */
  settleWithinDays?: number
  isDefault?: boolean
}

const props = withDefaults(defineProps<{
  token: string
  options?: OptionView[]
  termsText?: string
  longStay?: boolean
}>(), { longStay: false })

// The dashboard lists the waiver first and pre-selects it; keep that order.
const ordered = computed(() => [...(props.options ?? [])]
  .sort((a, b) => (a.option === 'waiver' ? -1 : 0) - (b.option === 'waiver' ? -1 : 0)))

const selected = ref<'waiver' | 'deposit' | null>(
  props.options?.find(o => o.option === 'waiver')?.option ?? props.options?.[0]?.option ?? null,
)
const termsAccepted = ref(false)
const chargeConsent = ref(false)
const cardNumber = ref('')
const cardExpiry = ref('')
const cardCvc = ref('')
const error = ref('')
const submitting = ref(false)
const submitted = ref(false)
const savedLast4 = ref('')

const isDeposit = computed(() => selected.value === 'deposit')
const chosen = computed(() => props.options?.find(o => o.option === selected.value) ?? null)

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('de-CH', {
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  })}`
}

/** The consent the guest gives, worded the same as the dashboard's `chargeMandateText`. */
const mandate = computed(() => {
  const view = props.options?.find(o => o.option === 'deposit')
  if (!view)
    return ''
  return `I authorise the property to keep this card on file and to charge it after check-out, up to ${money(view.amount, view.currency)}, only for damage recorded during my stay, only after I have been told what was found and why, and no later than ${view.settleWithinDays ?? 0} days after check-out.`
})

function digits(value: string): string {
  return value.replace(/\D/g, '')
}

function passesLuhn(number: string): boolean {
  const d = digits(number)
  if (d.length < 12 || d.length > 19)
    return false
  let sum = 0
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9)
        n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

function parsedExpiry(): { month: number, year: number } | null {
  const match = cardExpiry.value.trim().match(/^(\d{1,2})\s*\/\s*(\d{2})$/)
  if (!match)
    return null
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12 || new Date(year, month, 0, 23, 59, 59).getTime() < Date.now())
    return null
  return { month, year }
}

function cardError(): string {
  if (!passesLuhn(cardNumber.value))
    return 'Please check your card number.'
  if (!parsedExpiry())
    return 'Please enter a valid expiry date as MM/YY.'
  if (!/^\d{3,4}$/.test(cardCvc.value.trim()))
    return 'Please enter the 3 or 4 digit security code.'
  return ''
}

const valid = computed(() => {
  if (!selected.value || !termsAccepted.value)
    return false
  if (!isDeposit.value)
    return true
  return chargeConsent.value && !cardError()
})

/**
 * Mock of Stripe Elements confirming a SetupIntent in the browser. What leaves
 * this function is what Stripe would hand back: a PaymentMethod reference and
 * the printable bits. The number and CVC never go to our server.
 */
async function saveCardWithProvider() {
  await new Promise(resolve => setTimeout(resolve, 800))
  const d = digits(cardNumber.value)
  const expiry = parsedExpiry()!
  return {
    paymentMethodId: `pm_mock_${d.slice(-4)}_${Date.now()}`,
    brand: d.startsWith('4') ? 'visa' : /^5[1-5]/.test(d) ? 'mastercard' : /^3[47]/.test(d) ? 'amex' : 'card',
    last4: d.slice(-4),
    expMonth: expiry.month,
    expYear: expiry.year,
  }
}

async function submit() {
  if (!valid.value) {
    error.value = !termsAccepted.value
      ? 'Please accept the terms to continue.'
      : isDeposit.value && cardError()
        ? cardError()
        : 'Please agree to your card being charged after check-out, or choose the waiver.'
    return
  }
  error.value = ''
  submitting.value = true
  try {
    const card = isDeposit.value ? await saveCardWithProvider() : undefined
    await $fetch(`/api/guest-guides/by-token/${props.token}/protection-choice`, {
      method: 'POST',
      body: {
        option: selected.value,
        ...(card ? { card, chargeConsent: true } : {}),
      },
    })
    savedLast4.value = card?.last4 ?? ''
    // Drop what was typed the moment it is no longer needed.
    cardNumber.value = ''
    cardCvc.value = ''
    submitted.value = true
  }
  catch {
    error.value = 'We could not save your choice. Please try again.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div data-testid="damage-protection-form" class="flex flex-col gap-4">
    <!-- A second acceptance would need a second freeze, so the form closes. -->
    <div v-if="submitted" data-testid="damage-protection-confirmation" class="rounded-lg border p-4">
      <p class="font-medium">
        {{ chosen?.option === 'waiver' ? 'Damage waiver confirmed' : 'Card saved for your deposit' }}
      </p>
      <p v-if="chosen && chosen.option === 'waiver'" class="mt-1 text-sm text-muted-foreground">
        {{ money(chosen.amount, chosen.currency) }}. You are covered for accidental damage.
      </p>
      <p v-else-if="chosen" class="mt-1 text-sm text-muted-foreground">
        Card ending {{ savedLast4 }} saved. Nothing has been charged. After check-out it can be charged up to
        {{ money(chosen.amount, chosen.currency) }}, only for damage we have told you about.
      </p>
      <p class="mt-2 text-xs text-muted-foreground">
        Need to change this? Please contact your host.
      </p>
    </div>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="view in ordered"
          :key="view.option"
          type="button"
          role="radio"
          :aria-checked="selected === view.option"
          class="flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors"
          :class="selected === view.option ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/60'"
          @click="selected = view.option"
        >
          <div>
            <p class="text-sm font-semibold">
              {{ view.option === 'waiver' ? 'Damage waiver' : 'Security deposit (card on file)' }}
            </p>
            <p class="mt-1 text-2xl font-bold">
              {{ money(view.amount, view.currency) }}
            </p>
            <p v-if="view.option === 'deposit'" class="text-xs text-muted-foreground">
              the most your card can be charged
            </p>
          </div>
          <ul class="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <template v-if="view.option === 'waiver'">
              <li>Covers accidental damage up to {{ money(view.coverageCap ?? 0, view.currency) }}</li>
              <li>Nothing more to pay after you leave</li>
              <li>No card kept on file</li>
              <li>Pay with any method. Non-refundable</li>
            </template>
            <template v-else>
              <li>A credit card is kept on file. Nothing is charged now</li>
              <li>After check-out, your card can be charged up to {{ money(view.amount, view.currency) }} for damage we find</li>
              <li>You pay for any damage yourself, up to that amount</li>
              <li>Your card stays on file until {{ view.settleWithinDays }} days after check-out</li>
              <li v-if="longStay">
                Claims may be recorded during your stay at each scheduled cleaning, not only at check-out
              </li>
            </template>
          </ul>
          <div v-if="view.option === 'waiver' && view.exclusions?.length" class="border-t pt-3">
            <p class="text-xs font-medium uppercase text-muted-foreground">
              Not covered
            </p>
            <ul class="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
              <li v-for="exclusion in view.exclusions" :key="exclusion">
                {{ exclusion }}
              </li>
            </ul>
          </div>
        </button>
      </div>

      <div v-if="isDeposit" data-testid="damage-protection-card" class="flex flex-col gap-3 rounded-lg border p-4">
        <div>
          <p class="text-sm font-medium">
            Card to keep on file
          </p>
          <p class="text-xs text-muted-foreground">
            Your card is saved securely with our payment provider. We never see or store the full number.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-[1fr_7rem_6rem]">
          <div class="flex flex-col gap-1.5">
            <label for="dp-card-number" class="text-sm">Card number</label>
            <input id="dp-card-number" v-model="cardNumber" inputmode="numeric" autocomplete="cc-number" class="rounded-md border px-3 py-2 text-sm">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="dp-card-expiry" class="text-sm">Expiry</label>
            <input id="dp-card-expiry" v-model="cardExpiry" placeholder="MM/YY" autocomplete="cc-exp" class="rounded-md border px-3 py-2 text-sm">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="dp-card-cvc" class="text-sm">CVC</label>
            <input id="dp-card-cvc" v-model="cardCvc" inputmode="numeric" autocomplete="cc-csc" class="rounded-md border px-3 py-2 text-sm">
          </div>
        </div>
        <div class="flex items-start gap-2">
          <!-- Sibling label, never a wrapping one. -->
          <input id="dp-charge-consent" v-model="chargeConsent" type="checkbox" class="mt-0.5 size-4 rounded border">
          <label for="dp-charge-consent" class="text-sm leading-snug">{{ mandate }}</label>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="max-h-36 overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {{ termsText }}
        </div>
        <div class="flex items-center gap-2">
          <!-- Sibling label, never a wrapping one: a wrapping label
               re-dispatches the click and double-toggles. -->
          <input
            id="dp-terms"
            v-model="termsAccepted"
            type="checkbox"
            class="size-4 rounded border"
          >
          <label for="dp-terms" class="text-sm">I accept these terms</label>
        </div>
      </div>

      <p v-if="error" data-testid="damage-protection-error" class="text-sm text-red-600">
        {{ error }}
      </p>

      <div>
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          :disabled="!valid || submitting"
          @click="submit"
        >
          {{ submitting ? 'Saving…' : isDeposit ? 'Save card and confirm' : 'Confirm' }}
        </button>
      </div>
    </template>
  </div>
</template>
