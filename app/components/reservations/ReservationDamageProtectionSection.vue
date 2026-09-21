<script setup lang="ts">
import type { ProtectionChoiceDraft } from '~/components/reservations/data/damage-protection'
import type { ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import DamageProtectionStatusChip from '~/components/damage-protection/DamageProtectionStatusChip.vue'
import ProtectionOptionCards from '~/components/damage-protection/ProtectionOptionCards.vue'
import {
  formatProtectionAmount,
  isLongStay,
  refundableAmount,
  waiverPotTotal,
} from '~/components/reservations/data/damage-protection'
import ProtectionChoiceDialog from '~/components/reservations/ProtectionChoiceDialog.vue'
import ProtectionClaimDialog from '~/components/reservations/ProtectionClaimDialog.vue'
import { useDamageProtection } from '~/composables/useDamageProtection'

const props = defineProps<{ reservation: ReservationEntry }>()

const dp = useDamageProtection()

const choiceOpen = ref(false)
const claimOpen = ref(false)
const simulateChargeFailure = ref(false)
const simulateRefundFailure = ref(false)
const busy = ref(false)

const protection = computed(() => props.reservation.damageProtection ?? null)
const bucket = computed(() => dp.bucketFor(props.reservation.id))
const options = computed(() => dp.optionsFor(props.reservation.id))
const offered = computed(() => dp.isOfferedFor(props.reservation.id))
const longStay = computed(() => isLongStay(props.reservation.nights))
const policy = computed(() => dp.policyFor(props.reservation.listingId, props.reservation.nights))
const rail = computed(() => dp.railForListing(props.reservation.listingId))

const claims = computed<ProtectionClaim[]>(() => protection.value?.claims ?? [])
const unnotified = computed(() => claims.value.filter(c => !c.guestNotifiedAt))
const releaseRefusal = computed(() => dp.releaseRefusalFor(props.reservation.id))
const canRelease = computed(() => releaseRefusal.value === null)

const state = computed(() => protection.value?.state ?? null)
const isCharging = computed(() => dp.isCharging(props.reservation.id))

/** Renders nothing at all when the channel or the status skips protection. */
const visible = computed(() => offered.value || protection.value !== null)

function money(amount: number): string {
  return formatProtectionAmount(amount, protection.value?.currency ?? policy.value?.currency ?? 'USD')
}

function when(iso?: string): string {
  if (!iso)
    return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function onChoice(draft: ProtectionChoiceDraft) {
  const result = dp.recordChoice(props.reservation.id, draft, 'staff')
  if (result.ok)
    toast.success('Choice recorded')
  else
    toast.error(`Could not record the choice (${result.reason})`)
}

async function charge() {
  busy.value = true
  await dp.chargeDeposit(props.reservation.id, simulateChargeFailure.value)
  busy.value = false
  toast[simulateChargeFailure.value ? 'error' : 'success'](
    simulateChargeFailure.value ? 'The deposit charge was declined' : 'Deposit charged',
  )
}

function onClaim(draft: { label: string, amount: number, reason: string, evidenceUrls: string[] }) {
  const result = dp.recordClaim(props.reservation.id, draft)
  if (result.ok)
    toast.success('Claim recorded. Notify the guest before releasing the deposit.')
  else
    toast.error(`Could not record the claim (${result.reason})`)
}

async function notify(claimId: string) {
  const result = await dp.notifyGuestOfClaim(props.reservation.id, claimId)
  if (result.ok)
    toast.success('Guest notified')
  else if (result.reason === 'no_conversation')
    toast.error('No conversation on this reservation, so the guest could not be told')
  else
    toast.error(`Could not notify the guest (${result.reason})`)
}

async function release() {
  busy.value = true
  const result = await dp.releaseDeposit(props.reservation.id, simulateRefundFailure.value)
  busy.value = false
  if (result.ok)
    toast.success('Deposit released')
  else if (result.reason === 'claim_not_notified')
    toast.error('Tell the guest about the claim before keeping any of the deposit')
  else if (result.reason === 'refund_failed')
    toast.error('The refund was rejected by the provider')
  else
    toast.error(`Could not release the deposit (${result.reason})`)
}

async function retryRefund() {
  busy.value = true
  const result = await dp.retryRefund(props.reservation.id)
  busy.value = false
  toast[result.ok ? 'success' : 'error'](result.ok ? 'Deposit released' : 'The refund failed again')
}

function undo() {
  dp.undoSettlement(props.reservation.id)
  toast.info('Settlement undone. The claims were kept.')
}

function switchToWaiver() {
  const result = dp.recordChoice(props.reservation.id, { option: 'waiver', termsAccepted: true }, 'staff')
  toast[result.ok ? 'success' : 'error'](result.ok ? 'Switched to the waiver' : 'Could not switch')
}
</script>

<template>
  <Accordion
    v-if="visible"
    data-testid="damage-protection-section"
    type="single"
    collapsible
    class="w-full border-b px-2"
  >
    <AccordionItem value="damage-protection" class="border-b-0">
      <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
        <span class="flex flex-1 items-center justify-between gap-2 pr-2">
          <span class="text-sm font-medium">Damage protection</span>
          <DamageProtectionStatusChip :bucket="bucket" :option="protection?.option" />
        </span>
      </AccordionTrigger>

      <AccordionContent class="flex flex-col gap-4 pb-4">
        <!-- Nobody has chosen yet. The desk is the resolution: a fee cannot be
             charged against terms nobody accepted. -->
        <template v-if="!protection || state === 'awaiting_choice'">
          <p class="text-sm text-muted-foreground">
            The guest has not chosen yet. Check-in is {{ when(reservation.checkIn) }}.
          </p>
          <ProtectionOptionCards :options="options" :long-stay="longStay" :selectable="false" />
          <div>
            <Button size="sm" @click="choiceOpen = true">
              Record choice for guest
            </Button>
          </div>
        </template>

        <template v-else>
          <div class="grid gap-3 sm:grid-cols-3">
            <div>
              <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
                {{ protection.option === 'waiver' ? 'Waiver fee' : 'Deposit' }}
              </p>
              <p class="text-lg font-semibold tabular-nums">
                {{ money(protection.amount) }}
              </p>
            </div>
            <div v-if="protection.option === 'waiver'">
              <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
                Cover
              </p>
              <p class="text-lg font-semibold tabular-nums">
                {{ money(protection.coverageCap ?? 0) }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ money(waiverPotTotal(protection)) }} claimed
              </p>
            </div>
            <template v-else>
              <div>
                <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
                  Refundable now
                </p>
                <p class="text-lg font-semibold tabular-nums">
                  {{ money(refundableAmount(protection)) }}
                </p>
              </div>
              <div>
                <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
                  Refund due
                </p>
                <p class="text-sm font-medium">
                  {{ when(protection.refundDueAt) || '—' }}
                </p>
              </div>
            </template>
          </div>

          <p class="text-xs text-muted-foreground">
            Accepted {{ when(protection.acceptedAt) }}
            {{ protection.acceptedVia === 'guest_guide' ? 'in the guest guide' : 'by staff' }},
            terms {{ protection.termsVersion }}.
          </p>

          <!-- Pending: the charge has not been attempted yet. -->
          <div v-if="state === 'deposit_pending'" class="flex flex-col gap-2 rounded-lg border p-3">
            <p class="text-sm">
              Charges {{ when(protection.chargeDueAt) }}.
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <Button size="sm" :disabled="busy || isCharging" @click="charge">
                <Icon v-if="isCharging" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
                {{ isCharging ? 'Charging…' : 'Charge now' }}
              </Button>
              <div class="flex items-center gap-2">
                <Switch
                  id="simulate-charge-failure"
                  :model-value="simulateChargeFailure"
                  @update:model-value="(v) => simulateChargeFailure = v"
                />
                <Label for="simulate-charge-failure" class="text-xs font-normal text-muted-foreground">
                  Simulate a decline
                </Label>
              </div>
            </div>
          </div>

          <!-- The charge was declined. -->
          <div v-if="state === 'deposit_failed'" class="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p class="text-sm text-destructive">
              {{ protection.failureReason }}
              <span class="text-muted-foreground">({{ protection.failedAttempts }} attempt(s))</span>
            </p>
            <div class="flex flex-wrap gap-2">
              <Button size="sm" :disabled="isCharging" @click="dp.retryCharge(reservation.id)">
                Retry charge
              </Button>
              <Button size="sm" variant="outline" @click="switchToWaiver">
                Switch to waiver
              </Button>
            </div>
          </div>

          <!-- The refund itself was rejected. Without this state a failed refund
               reads as a completed one. -->
          <div v-if="state === 'refund_failed'" class="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p class="text-sm text-destructive">
              {{ protection.refundFailureReason }}
            </p>
            <div class="flex flex-wrap gap-2">
              <Button size="sm" :disabled="busy" @click="retryRefund">
                Retry refund
              </Button>
            </div>
          </div>

          <!-- Claims. Recorded on BOTH paths: on a waiver no money moves and the
               record is what prices the pot. -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
                Claims
              </p>
              <Button
                v-if="state === 'deposit_held' || state === 'waiver_active' || state === 'refund_failed'"
                size="sm"
                variant="outline"
                @click="claimOpen = true"
              >
                Record claim
              </Button>
            </div>

            <p v-if="!claims.length" class="text-sm text-muted-foreground">
              None recorded.
            </p>

            <div
              v-for="claim in claims"
              :key="claim.id"
              class="flex flex-col gap-1.5 rounded-lg border p-3"
            >
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm font-medium">
                    {{ claim.label }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ claim.reason }}
                  </p>
                </div>
                <p class="text-sm font-semibold tabular-nums whitespace-nowrap">
                  {{ money(claim.coveredAmount) }}
                </p>
              </div>
              <p v-if="claim.excessAmount > 0" class="text-xs text-amber-700 dark:text-amber-400">
                {{ money(claim.excessAmount) }} above the cover. Post it to the folio by hand.
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-md border px-1.5 py-0.5 text-[11px]"
                  :class="claim.guestNotifiedAt
                    ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'"
                >
                  {{ claim.guestNotifiedAt ? 'Guest notified' : 'Guest not notified' }}
                </span>
                <Button
                  v-if="!claim.guestNotifiedAt"
                  size="sm"
                  variant="outline"
                  @click="notify(claim.id)"
                >
                  Notify guest
                </Button>
                <Button
                  v-if="!claim.guestNotifiedAt"
                  size="sm"
                  variant="ghost"
                  @click="dp.removeClaim(reservation.id, claim.id)"
                >
                  Remove
                </Button>
                <span class="text-xs text-muted-foreground">
                  {{ claim.recordedBy }}, {{ when(claim.recordedAt) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Release. Blocked while any claim is unnotified: a deduction the
               guest first meets as a smaller refund is a chargeback. -->
          <div v-if="state === 'deposit_held'" class="flex flex-col gap-2 rounded-lg border p-3">
            <div class="flex flex-wrap items-center gap-3">
              <Button size="sm" :disabled="busy || !canRelease" @click="release">
                Release deposit
              </Button>
              <div class="flex items-center gap-2">
                <Switch
                  id="simulate-refund-failure"
                  :model-value="simulateRefundFailure"
                  @update:model-value="(v) => simulateRefundFailure = v"
                />
                <Label for="simulate-refund-failure" class="text-xs font-normal text-muted-foreground">
                  Simulate a rejected refund
                </Label>
              </div>
            </div>
            <p v-if="releaseRefusal === 'claim_not_notified'" class="text-xs text-amber-700 dark:text-amber-400">
              {{ unnotified.length }} claim(s) have not been shown to the guest yet. Notify them first.
            </p>
          </div>

          <!-- Settled: the arithmetic spelled out, because staff get challenged on it. -->
          <div
            v-if="['deposit_released', 'deposit_partial', 'deposit_forfeited', 'cancelled_refunded'].includes(state ?? '')"
            class="flex flex-col gap-1.5 rounded-lg border p-3"
          >
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Deposit</span>
              <span class="tabular-nums">{{ money(protection.amount) }}</span>
            </div>
            <div v-for="claim in claims" :key="claim.id" class="flex justify-between text-sm">
              <span class="text-muted-foreground">{{ claim.label }}</span>
              <span class="tabular-nums">-{{ money(claim.coveredAmount) }}</span>
            </div>
            <Separator class="my-1" />
            <div class="flex justify-between text-sm font-semibold">
              <span>{{ state === 'cancelled_refunded' ? 'Refunded on cancellation' : 'Refunded' }}</span>
              <span class="tabular-nums">{{ money(protection.refundedAmount ?? 0) }}</span>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ when(protection.refundedAt) }}
            </p>
            <div v-if="state !== 'cancelled_refunded'">
              <Button size="sm" variant="ghost" @click="undo">
                Undo
              </Button>
            </div>
          </div>
        </template>
      </AccordionContent>

      <ProtectionChoiceDialog
        v-model:open="choiceOpen"
        :options="options"
        :rail="rail"
        :terms-text="policy?.termsText ?? ''"
        :long-stay="longStay"
        @submit="onChoice"
      />
      <ProtectionClaimDialog
        v-if="protection"
        v-model:open="claimOpen"
        :protection="protection"
        @submit="onClaim"
      />
    </AccordionItem>
  </Accordion>
</template>
