<script setup lang="ts">
import type { DamageProtection, PartnerClaimStatus, ProtectionClaim } from '~/components/reservations/data/reservations'
import type { PartnerSimulation } from '~/composables/usePartnerClaims'
import { toast } from 'vue-sonner'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import {
  canTransition,
  PARTNER_EVENT_LABELS,
  PARTNER_STATUS_LABELS,
  partnerEligibility,
  payoutDueAt,
  payoutShortfall,
} from '~/components/reservations/data/partner-claims'
import { usePartnerClaims } from '~/composables/usePartnerClaims'

/**
 * The insurance side of one waiver claim: what can be claimed from the partner,
 * filing it, and following it until the money is in the property manager's
 * account. Staff only; the guest never sees this.
 */
const props = defineProps<{
  reservationId: string
  /** The stay's listing. One bank account per tenant today, so it does not change where the partner pays. */
  listingId: string
  protection: DamageProtection
  claim: ProtectionClaim
  canEdit?: boolean
}>()

const pc = usePartnerClaims()

const partnerClaim = computed(() => props.claim.partnerClaim)
const eligibility = computed(() => partnerEligibility(props.protection, props.claim, pc.partner.value))
const submitting = computed(() => pc.isSubmitting(props.claim.id))
const status = computed(() => partnerClaim.value?.status)
/** Where the partner would pay, before filing: the bank account registered at activation. */
const payoutAccount = computed(() => pc.payoutAccountFor(props.listingId))

const simulateFailure = ref(false)
const infoResponse = ref('')
const withdrawReason = ref('')
const showWithdraw = ref(false)
const receivedAmount = ref<number | undefined>(undefined)
const showSimulator = ref(false)

watch(() => partnerClaim.value?.paidAmount, (paid) => {
  receivedAmount.value = paid
}, { immediate: true })

function money(amount: number | undefined): string {
  return formatProtectionAmount(amount ?? 0, props.protection.currency)
}

function when(iso?: string): string {
  if (!iso)
    return ''
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

const STATUS_TONE: Record<PartnerClaimStatus, string> = {
  submitting: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  submitted: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  under_review: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  info_requested: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  submission_failed: 'border-destructive/30 bg-destructive/10 text-destructive',
  approved: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  partially_approved: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  payout_scheduled: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  paid: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  received: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  withdrawn: 'border-border bg-muted text-muted-foreground',
}

const shortfall = computed(() => partnerClaim.value ? payoutShortfall(partnerClaim.value) : 0)
const dueAt = computed(() => partnerClaim.value ? payoutDueAt(partnerClaim.value, pc.partner.value) : null)
const overdue = computed(() =>
  Boolean(dueAt.value && (status.value === 'approved' || status.value === 'partially_approved' || status.value === 'payout_scheduled')
    && new Date(dueAt.value) <= new Date()))
const canWithdraw = computed(() => status.value !== undefined && canTransition(status.value, 'withdrawn'))

async function submit() {
  const result = await pc.submitToPartner(props.reservationId, props.claim.id, simulateFailure.value)
  if (result.ok)
    toast.success(`Filed with ${pc.partner.value.name}`)
  else if (result.reason === 'submission_failed')
    toast.error('The partner rejected the submission. See the reason and retry.')
  else if (result.reason === 'waiver_not_activated')
    toast.error('Activate the damage waiver first: that is where you give Tern the bank account it pays into')
  else
    toast.error(`Could not file the claim (${result.reason})`)
}

function sendInfo() {
  const result = pc.respondToInfoRequest(props.reservationId, props.claim.id, infoResponse.value)
  if (result.ok) {
    infoResponse.value = ''
    toast.success('Information sent to the partner')
  }
  else {
    toast.error(result.reason === 'empty_response' ? 'Write what you are sending the partner' : `Could not send (${result.reason})`)
  }
}

function withdraw() {
  const result = pc.withdraw(props.reservationId, props.claim.id, withdrawReason.value)
  if (result.ok) {
    showWithdraw.value = false
    withdrawReason.value = ''
    toast.info('Claim withdrawn from the partner')
  }
  else {
    toast.error(result.reason === 'missing_reason' ? 'Say why the claim is withdrawn' : `Could not withdraw (${result.reason})`)
  }
}

function confirmReceived() {
  const result = pc.confirmReceived(props.reservationId, props.claim.id, receivedAmount.value)
  toast[result.ok ? 'success' : 'error'](result.ok ? 'Marked as received in the account' : `Could not confirm (${result.reason})`)
}

/** What the mock partner can say next, from this status. */
const simulations = computed<{ label: string, simulation: PartnerSimulation }[]>(() => {
  const s = status.value
  if (!s || !partnerClaim.value)
    return []
  const claimed = partnerClaim.value.claimedAmount
  const options: { label: string, simulation: PartnerSimulation, to: PartnerClaimStatus }[] = [
    { label: 'Start review', simulation: { kind: 'under_review' }, to: 'under_review' },
    { label: 'Request information', simulation: { kind: 'info_requested', infoRequest: 'Please send the repair invoice and a photo of the damage before repair.' }, to: 'info_requested' },
    { label: 'Approve in full', simulation: { kind: 'approved' }, to: 'approved' },
    { label: 'Approve partially', simulation: { kind: 'approved', approvedAmount: Math.round(claimed * 50) / 100 }, to: 'partially_approved' },
    { label: 'Reject', simulation: { kind: 'rejected', rejectionReason: 'Wear and tear is excluded under the policy.' }, to: 'rejected' },
    { label: 'Schedule payout', simulation: { kind: 'payout_scheduled', payoutScheduledFor: new Date(Date.now() + 5 * 86400000).toISOString() }, to: 'payout_scheduled' },
    { label: 'Send payment', simulation: { kind: 'paid' }, to: 'paid' },
  ]
  return options.filter(o => canTransition(s, o.to))
})

function simulate(simulation: PartnerSimulation) {
  const result = pc.simulatePartner(props.reservationId, props.claim.id, simulation)
  if (!result.ok)
    toast.error(`The partner event was refused (${result.reason})`)
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-md border border-dashed p-2.5" data-testid="partner-claim-panel">
    <div class="flex items-center justify-between gap-2">
      <p class="flex items-center gap-1.5 text-xs font-medium">
        <Icon name="lucide:shield-check" class="size-3.5 text-muted-foreground" />
        Insurance claim
        <span class="font-normal text-muted-foreground">· {{ pc.partner.value.name }}</span>
      </p>
      <span
        v-if="partnerClaim"
        class="rounded-md border px-1.5 py-0.5 text-[11px] whitespace-nowrap"
        :class="STATUS_TONE[partnerClaim.status]"
        data-testid="partner-claim-status"
      >
        {{ PARTNER_STATUS_LABELS[partnerClaim.status] }}
      </span>
    </div>

    <!-- Not filed yet -->
    <template v-if="!partnerClaim">
      <p v-if="eligibility.eligible" class="text-xs text-muted-foreground" data-testid="partner-claim-eligible">
        {{ money(claim.coveredAmount) }} covered, less the {{ money(eligibility.deductible) }} deductible:
        <span class="font-medium text-foreground">{{ money(eligibility.claimable) }}</span> can be claimed from the partner.
        <template v-if="eligibility.capped">
          Capped at the per-claim maximum.
        </template>
      </p>
      <p v-else-if="eligibility.reason === 'below_deductible'" class="text-xs text-muted-foreground" data-testid="partner-claim-below">
        Below the {{ money(eligibility.deductible) }} deductible, so the waiver pot carries it. Nothing is claimed from the partner.
      </p>
      <p v-else-if="eligibility.reason === 'currency_mismatch'" class="text-xs text-muted-foreground">
        The policy is in {{ pc.partner.value.currency }}, this claim is in {{ protection.currency }}. It cannot be filed.
      </p>

      <p v-if="eligibility.eligible && payoutAccount" class="text-xs text-muted-foreground" data-testid="partner-claim-destination">
        Paid by bank transfer into {{ payoutAccount.accountName }}.
      </p>

      <div v-if="eligibility.eligible" class="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          :disabled="submitting || !payoutAccount || canEdit === false"
          @click="submit"
        >
          <Icon v-if="submitting" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
          {{ submitting ? 'Submitting…' : 'Submit to partner' }}
        </Button>
        <div class="flex items-center gap-2">
          <Switch
            :id="`partner-fail-${claim.id}`"
            :model-value="simulateFailure"
            @update:model-value="(v) => simulateFailure = v"
          />
          <Label :for="`partner-fail-${claim.id}`" class="text-xs font-normal text-muted-foreground">Simulate a rejected submission</Label>
        </div>
        <p v-if="!payoutAccount" class="w-full text-xs text-amber-700 dark:text-amber-400" data-testid="partner-claim-no-account">
          The damage waiver is not activated, so there is no bank account for the partner to pay into. Activate it in Settings, Damage protection.
        </p>
      </div>
    </template>

    <!-- Filed -->
    <template v-else>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4" data-testid="partner-claim-amounts">
        <div>
          <p class="text-muted-foreground">
            Claimed
          </p>
          <p class="font-medium tabular-nums">
            {{ money(partnerClaim.claimedAmount) }}
          </p>
        </div>
        <div>
          <p class="text-muted-foreground">
            Approved
          </p>
          <p class="font-medium tabular-nums">
            {{ partnerClaim.approvedAmount !== undefined ? money(partnerClaim.approvedAmount) : '—' }}
          </p>
        </div>
        <div>
          <p class="text-muted-foreground">
            Paid by partner
          </p>
          <p class="font-medium tabular-nums">
            {{ partnerClaim.paidAmount !== undefined ? money(partnerClaim.paidAmount) : '—' }}
          </p>
        </div>
        <div>
          <p class="text-muted-foreground">
            Received
          </p>
          <p class="font-medium tabular-nums">
            {{ partnerClaim.receivedAmount !== undefined ? money(partnerClaim.receivedAmount) : '—' }}
          </p>
        </div>
      </div>
      <p class="text-[11px] text-muted-foreground">
        Policy {{ partnerClaim.policyNumber }} · pays into {{ partnerClaim.payoutAccountName }}<template v-if="partnerClaim.partnerClaimRef">
          · Partner ref {{ partnerClaim.partnerClaimRef }}
        </template> · {{ money(partnerClaim.deductible) }} deductible carried by the pot
      </p>

      <p v-if="shortfall > 0" class="text-xs text-amber-700 dark:text-amber-400" data-testid="partner-claim-shortfall">
        {{ money(shortfall) }} less than approved arrived. Follow it up with the partner.
      </p>

      <!-- What happens next, by status -->
      <div v-if="status === 'submission_failed'" class="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
        <p class="text-xs text-destructive">
          {{ partnerClaim.submissionError }}
        </p>
        <div>
          <Button size="sm" variant="outline" :disabled="submitting || canEdit === false" @click="submit">
            <Icon v-if="submitting" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
            {{ submitting ? 'Submitting…' : 'Retry submission' }}
          </Button>
        </div>
      </div>

      <div v-if="status === 'info_requested'" class="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2" data-testid="partner-claim-info-request">
        <p class="text-xs">
          <span class="font-medium">The partner asks:</span> {{ partnerClaim.infoRequest }}
        </p>
        <Textarea v-model="infoResponse" rows="2" placeholder="What you are sending, for example: repair invoice attached" class="text-xs" />
        <div>
          <Button size="sm" :disabled="canEdit === false" @click="sendInfo">
            Send to partner
          </Button>
        </div>
      </div>

      <p v-if="status === 'rejected'" class="text-xs text-destructive">
        Rejected: {{ partnerClaim.rejectionReason }} The waiver pot carries the claim.
      </p>

      <p v-if="status === 'approved' || status === 'partially_approved' || status === 'payout_scheduled'" class="text-xs" :class="overdue ? 'text-destructive' : 'text-muted-foreground'">
        <template v-if="status === 'payout_scheduled' && partnerClaim.payoutScheduledFor">
          Payout scheduled for {{ when(partnerClaim.payoutScheduledFor) }}.
        </template>
        <template v-if="dueAt">
          {{ overdue ? 'Overdue: due' : 'Due' }} by {{ when(dueAt) }} under the {{ pc.partner.value.paymentTermsDays }}-day payment terms.
        </template>
      </p>

      <div v-if="status === 'paid'" class="flex flex-col gap-2 rounded-md border p-2" data-testid="partner-claim-confirm">
        <p class="text-xs">
          The partner sent {{ money(partnerClaim.paidAmount) }} (ref {{ partnerClaim.payoutReference }}) by bank transfer to
          {{ partnerClaim.payoutAccountName }}. Confirm once it shows on the account.
        </p>
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex flex-col gap-1">
            <Label :for="`partner-received-${claim.id}`" class="text-[11px] text-muted-foreground">Amount received ({{ protection.currency }})</Label>
            <Input :id="`partner-received-${claim.id}`" v-model.number="receivedAmount" type="number" min="0" class="h-8 w-32 text-xs" />
          </div>
          <Button size="sm" :disabled="canEdit === false" @click="confirmReceived">
            Confirm received
          </Button>
        </div>
      </div>

      <div v-if="canWithdraw" class="flex flex-col gap-2">
        <div v-if="showWithdraw" class="flex flex-wrap items-end gap-2">
          <Input v-model="withdrawReason" placeholder="Why it is withdrawn" class="h-8 max-w-xs text-xs" />
          <Button size="sm" variant="outline" @click="withdraw">
            Withdraw
          </Button>
          <Button size="sm" variant="ghost" @click="showWithdraw = false">
            Cancel
          </Button>
        </div>
        <div v-else>
          <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" :disabled="canEdit === false" @click="showWithdraw = true">
            Withdraw claim
          </Button>
        </div>
      </div>

      <!-- Timeline, oldest first -->
      <ol class="flex flex-col gap-1 border-l pl-3" data-testid="partner-claim-timeline">
        <li v-for="event in partnerClaim.events" :key="event.id" class="text-[11px]">
          <span class="font-medium">{{ PARTNER_EVENT_LABELS[event.status] }}</span>
          <span class="text-muted-foreground"> · {{ when(event.at) }} · {{ event.source === 'staff' ? 'staff' : event.source === 'api' ? 'partner API' : 'partner webhook' }}</span>
          <span v-if="event.note" class="block text-muted-foreground">{{ event.note }}</span>
        </li>
      </ol>

      <!-- The mock partner: plays the partner's side until a real API exists. -->
      <div v-if="simulations.length" class="flex flex-col gap-1.5">
        <button
          type="button"
          class="flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground"
          :aria-expanded="showSimulator"
          @click="showSimulator = !showSimulator"
        >
          <Icon :name="showSimulator ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="size-3" />
          Simulate partner response (mock)
        </button>
        <div v-if="showSimulator" class="flex flex-wrap gap-1.5" data-testid="partner-claim-simulator">
          <Button
            v-for="option in simulations"
            :key="option.label"
            size="sm"
            variant="outline"
            class="h-7 px-2 text-xs"
            @click="simulate(option.simulation)"
          >
            {{ option.label }}
          </Button>
        </div>
      </div>
    </template>
  </div>
</template>
