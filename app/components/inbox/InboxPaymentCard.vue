<script setup lang="ts">
import type { MessagePaymentRequest } from '~/components/inbox/data/conversations'
import { toast } from 'vue-sonner'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { useInbox } from '~/composables/useInbox'
import { useCityTax } from '~/composables/useCityTax'

interface Props {
  paymentRequest: MessagePaymentRequest
  conversationId: string
}

const props = defineProps<Props>()

const { requests } = usePaymentRequests()

// Live status from payment requests store if found
const currentRequest = computed(() => {
  return requests.value.find(r => r.id === props.paymentRequest.id)
})

const liveStatus = computed(() => {
  return currentRequest.value?.status ?? props.paymentRequest.status
})

const { conversations } = useInbox()
const isCityTax = computed(() => props.paymentRequest.title.toLowerCase().includes('city tax'))

const isCopied = ref(false)

async function handleCopyLink() {
  const link = props.paymentRequest.paymentLink
  try {
    await navigator.clipboard.writeText(link)
    isCopied.value = true
    toast.success('Payment link copied to clipboard')
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  }
  catch {
    toast.error('Failed to copy link')
  }
}

function handleOpenPayment() {
  window.open(props.paymentRequest.paymentLink, '_blank')
}

function handleMarkAsPaid() {
  if (currentRequest.value) {
    currentRequest.value.status = 'paid'
    currentRequest.value.paidAt = new Date().toISOString()
    props.paymentRequest.status = 'paid'
    toast.success(isCityTax.value ? 'City Tax marked as paid' : 'Payment marked as paid')

    // Settle city tax on reservation if linked
    const conv = conversations.value.find(c => c.id === props.conversationId)
    if (conv?.reservationId && isCityTax.value) {
      try {
        useCityTax().markCollected(conv.reservationId, {
          method: 'card',
          note: 'Paid via direct payment link in inbox',
        })
      }
      catch {
        // safe fallback
      }
    }
  }
}

const statusBadgeConfig = computed(() => {
  switch (liveStatus.value) {
    case 'paid':
      return {
        label: isCityTax.value ? 'City Tax Paid' : 'Paid',
        class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        icon: 'lucide:check-circle',
      }
    case 'expired':
      return {
        label: 'Expired',
        class: 'bg-destructive/10 text-destructive border-destructive/30',
        icon: 'lucide:alert-circle',
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        class: 'bg-muted text-muted-foreground border-border',
        icon: 'lucide:ban',
      }
    case 'pending':
    default:
      return {
        label: isCityTax.value ? 'City Tax Due' : 'Payment Pending',
        class: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        icon: isCityTax.value ? 'lucide:landmark' : 'lucide:clock',
      }
  }
})

const formattedBaseAmount = computed(() => {
  const c = props.paymentRequest.currency
  const val = props.paymentRequest.amount
  const digits = c === 'IDR' ? 0 : 2
  return `${c} ${val.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
})

const formattedFeeAmount = computed(() => {
  const c = props.paymentRequest.currency
  const val = props.paymentRequest.feeAmount ?? 0
  const digits = c === 'IDR' ? 0 : 2
  return `${c} ${val.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
})

const formattedTotalAmount = computed(() => {
  const c = props.paymentRequest.currency
  const val = props.paymentRequest.totalAmount
  const digits = c === 'IDR' ? 0 : 2
  return `${c} ${val.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
})

const formattedExpiry = computed(() => {
  if (!props.paymentRequest.expiresAt)
    return ''
  try {
    const d = new Date(props.paymentRequest.expiresAt)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  }
  catch {
    return props.paymentRequest.expiresAt
  }
})
</script>

<template>
  <div class="mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs transition-all">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3.5 py-2.5">
      <div class="flex items-center gap-2">
        <div class="flex size-7 items-center justify-center rounded-lg" :class="isCityTax ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'">
          <Icon :name="isCityTax ? 'lucide:landmark' : 'lucide:credit-card'" class="size-4" />
        </div>
        <div>
          <h4 class="text-xs font-semibold leading-tight text-foreground">
            {{ paymentRequest.title }}
          </h4>
          <span class="text-[10px] text-muted-foreground font-mono">
            {{ isCityTax ? 'Local Tax · ' + paymentRequest.id : paymentRequest.id }}
          </span>
        </div>
      </div>
      <Badge variant="outline" class="gap-1 text-[10px] font-medium" :class="statusBadgeConfig.class">
        <Icon :name="statusBadgeConfig.icon" class="size-3" />
        {{ statusBadgeConfig.label }}
      </Badge>
    </div>

    <!-- Body / Breakdown -->
    <div class="space-y-1.5 px-3.5 py-2.5 text-xs">
      <div class="flex items-center justify-between text-muted-foreground">
        <span>{{ isCityTax ? 'City Tax Obligation' : 'Reservation Amount' }}</span>
        <span class="font-medium text-foreground">{{ formattedBaseAmount }}</span>
      </div>

      <div v-if="paymentRequest.feeAmount && paymentRequest.feeAmount > 0" class="flex items-center justify-between text-muted-foreground">
        <span>Card Processing Fee</span>
        <span class="font-medium text-foreground">{{ formattedFeeAmount }}</span>
      </div>

      <div class="border-t border-border/60 pt-1.5 flex items-center justify-between text-sm font-semibold text-foreground">
        <span>Total Payable</span>
        <span class="text-primary font-bold">{{ formattedTotalAmount }}</span>
      </div>

      <div v-if="formattedExpiry" class="pt-0.5 text-[10px] text-muted-foreground">
        <span v-if="liveStatus === 'paid'">Paid successfully</span>
        <span v-else-if="liveStatus === 'expired'">Expired on {{ formattedExpiry }}</span>
        <span v-else>Valid until: {{ formattedExpiry }}</span>
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
      <template v-if="liveStatus === 'pending'">
        <Button
          size="sm"
          class="h-7 flex-1 text-xs gap-1 font-medium cursor-pointer"
          @click="handleOpenPayment"
        >
          <Icon name="lucide:external-link" class="size-3" />
          Pay Now
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs gap-1 cursor-pointer"
          @click="handleCopyLink"
        >
          <Icon :name="isCopied ? 'lucide:check' : 'lucide:copy'" class="size-3" />
          {{ isCopied ? 'Copied' : 'Copy Link' }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title="Simulate Guest Payment"
          class="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
          @click="handleMarkAsPaid"
        >
          <Icon name="lucide:check-circle" class="size-3 text-emerald-600 mr-1" />
          Simulate
        </Button>
      </template>

      <template v-else-if="liveStatus === 'paid'">
        <div class="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
          <Icon name="lucide:check-circle-2" class="size-4" />
          Payment Confirmed
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 ml-auto text-xs gap-1 cursor-pointer"
          @click="handleCopyLink"
        >
          <Icon :name="isCopied ? 'lucide:check' : 'lucide:copy'" class="size-3" />
          Link
        </Button>
      </template>

      <template v-else>
        <Button
          variant="outline"
          size="sm"
          class="h-7 w-full text-xs gap-1 cursor-pointer"
          @click="handleCopyLink"
        >
          <Icon :name="isCopied ? 'lucide:check' : 'lucide:copy'" class="size-3" />
          {{ isCopied ? 'Copied' : 'Copy Payment Link' }}
        </Button>
      </template>
    </div>
  </div>
</template>
