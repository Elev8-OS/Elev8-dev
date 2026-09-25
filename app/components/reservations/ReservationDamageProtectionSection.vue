<script setup lang="ts">
import type { ClaimDraft } from '~/components/reservations/data/damage-protection'
import type { ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import type { ProtectionChoiceSubmission } from '~/components/reservations/ProtectionChoiceDialog.vue'
import { toast } from 'vue-sonner'
import DamageProtectionStatusChip from '~/components/damage-protection/DamageProtectionStatusChip.vue'
import PartnerClaimPanel from '~/components/damage-protection/PartnerClaimPanel.vue'
import ProtectionOptionCards from '~/components/damage-protection/ProtectionOptionCards.vue'
import { cleaningReportsForReservation } from '~/components/reservations/data/claim-cleaning'
import {
  chargeableTotal,
  claimEvidenceSummary,
  formatProtectionAmount,
  formatSavedCard,
  isLongStay,
  remainingCover,
  waiverPotTotal,
} from '~/components/reservations/data/damage-protection'
import ProtectionChoiceDialog from '~/components/reservations/ProtectionChoiceDialog.vue'
import ProtectionClaimDialog from '~/components/reservations/ProtectionClaimDialog.vue'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'
import { buildClaimEvidencePdf, claimPhotoSources, loadEvidencePhotos } from '~/lib/claim-evidence-pdf'

const props = defineProps<{ reservation: ReservationEntry }>()

const dp = useDamageProtection()
const { jobs: cleaningJobs } = useCleaningJobs()

const choiceOpen = ref(false)
const claimOpen = ref(false)
const simulateChargeDecline = ref(false)

const protection = computed(() => props.reservation.damageProtection ?? null)
const bucket = computed(() => dp.bucketFor(props.reservation.id))
const options = computed(() => dp.optionsFor(props.reservation.id))
const offered = computed(() => dp.isOfferedFor(props.reservation.id))
const longStay = computed(() => isLongStay(props.reservation.nights))
const policy = computed(() => dp.policyFor(props.reservation.listingId, props.reservation.nights))

const claims = computed<ProtectionClaim[]>(() => protection.value?.claims ?? [])
/** What housekeeping reported on this stay, offered as claim candidates. */
const cleaningReports = computed(() => cleaningReportsForReservation(props.reservation, cleaningJobs.value))
const unnotified = computed(() => claims.value.filter(c => !c.guestNotifiedAt))
const settleRefusal = computed(() => dp.settleRefusalFor(props.reservation.id))
const canSettle = computed(() => settleRefusal.value === null)

const state = computed(() => protection.value?.state ?? null)
const isCharging = computed(() => dp.isCharging(props.reservation.id))
const chargeable = computed(() => protection.value ? chargeableTotal(protection.value) : 0)
const isCancelledStay = computed(() => props.reservation.status === 'cancelled')
const checkedOut = computed(() => new Date(`${props.reservation.checkOut}T00:00:00`).getTime() <= Date.now())

/** Renders nothing at all when the channel, the status or the rail skips protection. */
const visible = computed(() => offered.value || protection.value !== null)

function money(amount: number): string {
  return formatProtectionAmount(amount, protection.value?.currency ?? policy.value?.currency ?? 'USD')
}

function when(iso?: string): string {
  if (!iso)
    return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * A deposit is recorded only once the card is saved. A declined card leaves the
 * guest where they were, awaiting a choice, rather than holding a deposit with
 * no card behind it.
 */
async function onChoice(submission: ProtectionChoiceSubmission) {
  if (submission.option === 'waiver') {
    const result = dp.recordChoice(props.reservation.id, { option: 'waiver', termsAccepted: true }, 'staff')
    toast[result.ok ? 'success' : 'error'](result.ok ? 'Waiver recorded' : `Could not record the choice (${result.reason})`)
    return
  }
  const saved = await dp.saveCard(submission.cardInput!, submission.simulateDecline)
  if (!saved.ok) {
    toast.error(`${saved.reason} Nothing was recorded.`)
    return
  }
  const result = dp.recordChoice(props.reservation.id, {
    option: 'deposit',
    termsAccepted: true,
    chargeConsent: submission.chargeConsent,
    card: saved.card,
  }, 'staff')
  toast[result.ok ? 'success' : 'error'](result.ok ? 'Card saved. Nothing has been charged.' : `Could not record the choice (${result.reason})`)
}

function onClaim(draft: ClaimDraft) {
  const result = dp.recordClaim(props.reservation.id, draft)
  if (result.ok)
    toast.success('Claim recorded. Notify the guest before charging their card.')
  else if (result.reason === 'finding_already_claimed')
    toast.error('That cleaning finding is already on a claim')
  else
    toast.error(`Could not record the claim (${result.reason})`)
}

async function notify(claimId: string) {
  const result = await dp.notifyGuestOfClaim(props.reservation.id, claimId)
  if (result.ok)
    toast.success('Guest notified in the inbox')
  else if (result.reason === 'no_contact')
    toast.error('This guest has no conversation and no email address, so they could not be told. Add an email to the reservation first.')
  else
    toast.error(`Could not notify the guest (${result.reason})`)
}

async function settle() {
  const charging = chargeable.value > 0
  const result = await dp.settleDeposit(props.reservation.id, charging && simulateChargeDecline.value)
  if (result.ok)
    toast.success(charging ? `${money(chargeable.value)} charged to the saved card` : 'Deposit closed. Nothing was charged.')
  else if (result.reason === 'claim_not_notified')
    toast.error('Tell the guest about every claim before charging their card')
  else if (result.reason === 'charge_declined')
    toast.error('The card was declined')
  else
    toast.error(`Could not settle the deposit (${result.reason})`)
}

function cancel() {
  const result = dp.cancelProtection(props.reservation.id)
  toast[result.ok ? 'success' : 'error'](result.ok
    ? (protection.value?.option === 'waiver' ? 'Waiver fee refunded' : 'Saved card released')
    : `Could not cancel (${result.reason})`)
}

const downloadingClaimId = ref<string | null>(null)

/**
 * One PDF per claim with everything that backs it, photos embedded, for a
 * dispute or a chargeback. The letterhead is the listing's invoice template,
 * the same one the guest invoice and the owner statement print.
 */
async function downloadEvidence(claim: ProtectionClaim) {
  if (!protection.value || downloadingClaimId.value)
    return
  downloadingClaimId.value = claim.id
  try {
    const photos = await loadEvidencePhotos(claimPhotoSources(claim))
    const { getTemplateForListing } = useInvoiceTemplates()
    buildClaimEvidencePdf({
      reservation: props.reservation,
      protection: protection.value,
      claim,
      photos,
      company: getTemplateForListing(props.reservation.listingId).company,
    }, { download: true })
    const missing = photos.filter(p => !p.dataUrl).length
    if (missing)
      toast.info(`Evidence downloaded. ${missing} photo(s) could not be loaded and are listed in the file instead.`)
    else
      toast.success('Evidence downloaded')
  }
  catch {
    toast.error('Could not build the evidence file')
  }
  finally {
    downloadingClaimId.value = null
  }
}

function undo() {
  const result = dp.undoSettlement(props.reservation.id)
  toast[result.ok ? 'info' : 'error'](result.ok ? 'Deposit reopened. The card is on file again.' : `Could not undo (${result.reason})`)
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
      <!-- Same header and content padding as the city tax and folio sections
           beside it in the detail sheet: icon, title, then the status. -->
      <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
        <span class="flex flex-1 items-center gap-2">
          <Icon name="lucide:shield-check" class="size-4" />
          Damage protection
          <DamageProtectionStatusChip :bucket="bucket" :option="protection?.option" />
        </span>
      </AccordionTrigger>

      <AccordionContent class="flex flex-col gap-4 px-3 pb-4">
        <!-- Nobody has chosen yet. The desk is the resolution: a fee cannot be
             charged against terms nobody accepted. -->
        <template v-if="!protection || state === 'awaiting_choice'">
          <p class="text-sm text-muted-foreground">
            The guest has not chosen yet. Check-in is {{ when(reservation.checkIn) }}.
          </p>
          <ProtectionOptionCards :options="options" :long-stay="longStay" :selectable="false" />
          <div>
            <Button size="sm" :disabled="dp.savingCard.value" @click="choiceOpen = true">
              <Icon v-if="dp.savingCard.value" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
              {{ dp.savingCard.value ? 'Saving card…' : 'Record choice for guest' }}
            </Button>
          </div>
        </template>

        <template v-else>
          <div class="grid gap-3 sm:grid-cols-3">
            <div>
              <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
                {{ protection.option === 'waiver' ? 'Waiver fee' : 'Card may be charged up to' }}
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
                  Claims to charge
                </p>
                <p class="text-lg font-semibold tabular-nums">
                  {{ money(chargeable) }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ money(remainingCover(protection)) }} left under the limit
                </p>
              </div>
              <div>
                <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
                  Decide by
                </p>
                <p class="text-sm font-medium">
                  {{ when(protection.settleDueAt) || '—' }}
                </p>
              </div>
            </template>
          </div>

          <p v-if="protection.card" class="flex items-center gap-1.5 text-sm" data-testid="protection-saved-card">
            <Icon name="lucide:credit-card" class="size-4 shrink-0 text-muted-foreground" />
            {{ formatSavedCard(protection.card) }}
            <span class="text-xs text-muted-foreground">
              {{ state === 'card_on_file' || state === 'charge_failed' ? 'on file, nothing charged yet' : '' }}
            </span>
          </p>

          <p class="text-xs text-muted-foreground">
            Accepted {{ when(protection.acceptedAt) }}
            {{ protection.acceptedVia === 'guest_guide' ? 'in the guest guide' : 'by staff' }},
            terms {{ protection.termsVersion }}.
          </p>

          <!-- A cancelled stay admits no claim: the card is released, or the
               waiver fee refunded, straight away. -->
          <div
            v-if="isCancelledStay && (state === 'card_on_file' || state === 'waiver_active')"
            class="flex flex-col gap-2 rounded-lg border p-3"
            data-testid="protection-cancelled-stay"
          >
            <p class="text-sm">
              {{ state === 'waiver_active'
                ? `The stay was cancelled. The ${money(protection.amount)} waiver fee is owed back.`
                : 'The stay was cancelled. Release the saved card: nothing can be charged for a stay that did not happen.' }}
            </p>
            <div>
              <Button size="sm" :disabled="!dp.canEditProtection.value" @click="cancel">
                {{ state === 'waiver_active' ? 'Refund waiver fee' : 'Release card' }}
              </Button>
            </div>
          </div>

          <!-- The charge to the saved card was declined. The claims still stand. -->
          <div v-if="state === 'charge_failed'" class="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p class="text-sm text-destructive">
              {{ protection.chargeFailureReason }}
              <span class="text-muted-foreground">({{ protection.chargeAttempts ?? 1 }} attempt(s))</span>
            </p>
            <p class="text-xs text-muted-foreground">
              {{ money(chargeable) }} is still owed. Retry, or post it to the folio and send the guest a payment request.
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <Button size="sm" :disabled="isCharging || !dp.canEditProtection.value" @click="settle">
                <Icon v-if="isCharging" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
                {{ isCharging ? 'Charging…' : 'Retry charge' }}
              </Button>
              <div class="flex items-center gap-2">
                <Switch
                  id="simulate-retry-decline"
                  :model-value="simulateChargeDecline"
                  @update:model-value="(v) => simulateChargeDecline = v"
                />
                <Label for="simulate-retry-decline" class="text-xs font-normal text-muted-foreground">
                  Simulate a decline
                </Label>
              </div>
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
                v-if="!isCancelledStay && (state === 'card_on_file' || state === 'waiver_active' || state === 'charge_failed')"
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
              <p
                v-if="claimEvidenceSummary(claim)"
                data-testid="claim-evidence-summary"
                class="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Icon :name="claim.cleaningReport ? 'lucide:brush-cleaning' : 'lucide:paperclip'" class="size-3.5 shrink-0" />
                <span>
                  Evidence: {{ claimEvidenceSummary(claim) }}<template v-if="claim.cleaningReport">, by {{ claim.cleaningReport.reportedBy }}</template>
                </span>
              </p>
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
                <Button
                  size="sm"
                  variant="ghost"
                  class="gap-1.5"
                  :disabled="downloadingClaimId !== null"
                  data-testid="claim-download-evidence"
                  @click="downloadEvidence(claim)"
                >
                  <Icon
                    :name="downloadingClaimId === claim.id ? 'lucide:loader-2' : 'lucide:download'"
                    class="size-3.5"
                    :class="downloadingClaimId === claim.id ? 'animate-spin' : ''"
                  />
                  {{ downloadingClaimId === claim.id ? 'Preparing…' : 'Download evidence' }}
                </Button>
                <span class="text-xs text-muted-foreground">
                  {{ claim.recordedBy }}, {{ when(claim.recordedAt) }}
                </span>
              </div>
              <!-- A waiver claim is claimed back from the insurance partner under
                   the master policy. Staff only: the guest never sees it. -->
              <PartnerClaimPanel
                v-if="protection.option === 'waiver'"
                :reservation-id="reservation.id"
                :listing-id="reservation.listingId"
                :protection="protection"
                :claim="claim"
                :can-edit="dp.canEditProtection.value"
              />
            </div>
          </div>

          <!-- Charge or close. Blocked while any claim is unnotified: a charge the
               guest first meets on their card statement is a chargeback. -->
          <div
            v-if="state === 'card_on_file' && !isCancelledStay"
            class="flex flex-col gap-2 rounded-lg border p-3"
            data-testid="protection-settle"
          >
            <p class="text-sm">
              <template v-if="chargeable > 0">
                Charge {{ money(chargeable) }} to the saved card for the claims above.
              </template>
              <template v-else-if="checkedOut">
                No claims. Close the deposit and stop keeping the card on file.
              </template>
              <template v-else>
                The guest has not checked out yet. Claims can be recorded until the deposit is closed.
              </template>
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <Button size="sm" :disabled="isCharging || !canSettle || !dp.canEditProtection.value" @click="settle">
                <Icon v-if="isCharging" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
                {{ isCharging ? 'Charging…' : chargeable > 0 ? `Charge ${money(chargeable)}` : 'Close without charging' }}
              </Button>
              <div v-if="chargeable > 0" class="flex items-center gap-2">
                <Switch
                  id="simulate-charge-decline"
                  :model-value="simulateChargeDecline"
                  @update:model-value="(v) => simulateChargeDecline = v"
                />
                <Label for="simulate-charge-decline" class="text-xs font-normal text-muted-foreground">
                  Simulate a decline
                </Label>
              </div>
            </div>
            <p v-if="settleRefusal === 'claim_not_notified'" class="text-xs text-amber-700 dark:text-amber-400">
              {{ unnotified.length }} claim(s) have not been shown to the guest yet. Notify them first.
            </p>
          </div>

          <!-- Settled: the arithmetic spelled out, because staff get challenged on it. -->
          <div
            v-if="state === 'deposit_charged' || state === 'deposit_released' || state === 'cancelled'"
            class="flex flex-col gap-1.5 rounded-lg border p-3"
            data-testid="protection-settled"
          >
            <template v-if="state === 'deposit_charged'">
              <div v-for="claim in claims" :key="claim.id" class="flex justify-between text-sm">
                <span class="text-muted-foreground">{{ claim.label }}</span>
                <span class="tabular-nums">{{ money(claim.coveredAmount) }}</span>
              </div>
              <Separator class="my-1" />
              <div class="flex justify-between text-sm font-semibold">
                <span>Charged to the saved card</span>
                <span class="tabular-nums">{{ money(protection.chargedAmount ?? 0) }}</span>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ when(protection.chargedAt) }}. The card is no longer on file.
              </p>
            </template>
            <template v-else-if="state === 'deposit_released'">
              <p class="text-sm font-medium">
                Closed without a charge
              </p>
              <p class="text-xs text-muted-foreground">
                {{ when(protection.releasedAt) }}. The card is no longer on file.
              </p>
              <div>
                <Button size="sm" variant="ghost" @click="undo">
                  Undo
                </Button>
              </div>
            </template>
            <template v-else>
              <p class="text-sm font-medium">
                Cancelled with the stay
              </p>
              <p class="text-xs text-muted-foreground">
                {{ protection.option === 'waiver'
                  ? `${money(protection.refundedAmount ?? 0)} waiver fee refunded ${when(protection.refundedAt)}.`
                  : `Saved card released ${when(protection.releasedAt)}. Nothing was charged.` }}
              </p>
            </template>
          </div>
        </template>
      </AccordionContent>

      <ProtectionChoiceDialog
        v-model:open="choiceOpen"
        :options="options"
        :terms-text="policy?.termsText ?? ''"
        :long-stay="longStay"
        @submit="onChoice"
      />
      <ProtectionClaimDialog
        v-if="protection"
        v-model:open="claimOpen"
        :protection="protection"
        :reports="cleaningReports"
        @submit="onClaim"
      />
    </AccordionItem>
  </Accordion>
</template>
