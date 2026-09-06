<script setup lang="ts">
import { Icon } from '#components'
import {
  cardBrandLabels,
  declineReasonShort,
  DUNNING_WINDOW_DAYS,
  formatDeadline,
  formatUsd,
} from '~/components/billing/data/subscription-billing'
import { Button } from '~/components/ui/button'
import { useSubscriptionBilling } from '~/composables/useSubscriptionBilling'

const { billing, needsPaymentUpdate, isSuspended, daysLeft } = useSubscriptionBilling()

const dialogOpen = ref(false)

const card = computed(() => {
  const pm = billing.value.paymentMethod
  return pm ? `${cardBrandLabels[pm.brand]} •••• ${pm.last4}` : 'the card on file'
})

const headline = computed(() =>
  isSuspended.value ? 'Account suspended, payment overdue:' : 'Payment failed:',
)

const detail = computed(() => {
  const inv = billing.value.failedInvoice
  if (!inv)
    return `We could not charge ${card.value}.`

  const amount = `${formatUsd(inv.amountUsd)} for ${inv.periodLabel}`

  if (isSuspended.value)
    return `${amount} is still unpaid (${declineReasonShort[inv.declineReason]}). Update your payment method to restore access.`

  // The retry count is the honest version of "we keep trying": billing attempts the
  // card once a day for seven days before suspending (PP-502).
  const tries = `attempt ${inv.attempts} of ${DUNNING_WINDOW_DAYS}, ${declineReasonShort[inv.declineReason]}`
  const deadline = billing.value.finalAttemptDate
  const left = daysLeft.value

  const window = !deadline || left === null
    ? ''
    : left === 0
      ? ' Today is the final attempt. Your account is suspended if it fails.'
      : ` Update your payment method before ${formatDeadline(deadline)} to avoid suspension.`

  return `${amount} could not be collected (${tries}).${window}`
})
</script>

<template>
  <div
    v-if="needsPaymentUpdate"
    role="alert"
    class="flex items-center gap-3 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-destructive md:px-6 dark:bg-destructive/15"
  >
    <Icon name="lucide:octagon-alert" class="size-4 shrink-0" />

    <p class="min-w-0 flex-1 text-sm leading-snug">
      <span class="font-semibold">{{ headline }}</span>
      <span class="hidden sm:inline">&nbsp;{{ detail }}</span>
    </p>

    <Button
      variant="destructive"
      size="sm"
      class="h-7 shrink-0"
      @click="dialogOpen = true"
    >
      Update payment
    </Button>

    <BillingUpdatePaymentDialog v-model:open="dialogOpen" />
  </div>
</template>
