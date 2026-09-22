<script setup lang="ts">
interface OptionView {
  option: 'waiver' | 'deposit'
  amount: number
  currency: string
  coverageCap?: number
  exclusions?: string[]
  chargeDueAt?: string
  refundSlaDays?: number
  isDefault?: boolean
}

const props = withDefaults(defineProps<{
  token: string
  options?: OptionView[]
  termsText?: string
  /** 'non_card' rails frequently cannot be refunded to source. */
  rail?: 'card' | 'non_card'
  longStay?: boolean
}>(), { rail: 'card', longStay: false })

const selected = ref<'waiver' | 'deposit' | null>(
  props.options?.find(o => o.isDefault)?.option ?? props.options?.[0]?.option ?? null,
)
const termsAccepted = ref(false)
const accountName = ref('')
const accountNumber = ref('')
const bankName = ref('')
const error = ref('')
const submitting = ref(false)
const submitted = ref(false)

const needsBank = computed(() => selected.value === 'deposit' && props.rail === 'non_card')

const valid = computed(() => {
  if (!selected.value || !termsAccepted.value)
    return false
  if (!needsBank.value)
    return true
  return Boolean(accountName.value.trim() && accountNumber.value.trim() && bankName.value.trim())
})

const chosen = computed(() => props.options?.find(o => o.option === selected.value) ?? null)

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('de-CH', {
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  })}`
}

function formatDate(iso?: string): string {
  if (!iso)
    return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function submit() {
  if (!valid.value) {
    error.value = !termsAccepted.value
      ? 'Please accept the terms to continue.'
      : 'Please give the account name, number and bank so we can return your deposit.'
    return
  }
  error.value = ''
  submitting.value = true
  try {
    await $fetch(`/api/guest-guides/by-token/${props.token}/protection-choice`, {
      method: 'POST',
      body: {
        option: selected.value,
        refundDestination: needsBank.value
          ? { accountName: accountName.value, accountNumber: accountNumber.value, bankName: bankName.value }
          : undefined,
      },
    })
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
        {{ chosen?.option === 'waiver' ? 'Damage waiver confirmed' : 'Security deposit confirmed' }}
      </p>
      <p v-if="chosen" class="mt-1 text-sm text-muted-foreground">
        {{ money(chosen.amount, chosen.currency) }}
        <template v-if="chosen.option === 'deposit'">
          , charged {{ formatDate(chosen.chargeDueAt) }} and refunded within
          {{ chosen.refundSlaDays }} days of check-out.
        </template>
      </p>
      <p class="mt-2 text-xs text-muted-foreground">
        Need to change this? Please contact your host.
      </p>
    </div>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="view in options"
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
              {{ view.option === 'waiver' ? 'Damage waiver' : 'Security deposit' }}
            </p>
            <p class="mt-1 text-2xl font-bold">
              {{ money(view.amount, view.currency) }}
            </p>
          </div>
          <ul class="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <template v-if="view.option === 'waiver'">
              <li>Covers accidental damage up to {{ money(view.coverageCap ?? 0, view.currency) }}</li>
              <li>Non-refundable</li>
              <li>Pay with any method</li>
            </template>
            <template v-else>
              <li>Charged {{ formatDate(view.chargeDueAt) }}</li>
              <li>Refunded within {{ view.refundSlaDays }} days of check-out</li>
              <li>You stay responsible for damage above {{ money(view.amount, view.currency) }}</li>
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

      <div v-if="needsBank" data-testid="damage-protection-bank" class="flex flex-col gap-3 rounded-lg border p-4">
        <p class="text-sm font-medium">
          Where should we send your deposit back?
        </p>
        <p class="text-xs text-muted-foreground">
          Your payment method cannot be refunded automatically, so we need your bank details now.
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <label for="dp-account-name" class="text-sm">Account name</label>
            <input id="dp-account-name" v-model="accountName" class="rounded-md border px-3 py-2 text-sm">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="dp-account-number" class="text-sm">Account number</label>
            <input id="dp-account-number" v-model="accountNumber" class="rounded-md border px-3 py-2 text-sm">
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="dp-bank-name" class="text-sm">Bank</label>
            <input id="dp-bank-name" v-model="bankName" class="rounded-md border px-3 py-2 text-sm">
          </div>
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
          {{ submitting ? 'Saving…' : 'Confirm' }}
        </button>
      </div>
    </template>
  </div>
</template>
