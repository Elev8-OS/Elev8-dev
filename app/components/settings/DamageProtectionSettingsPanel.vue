<script setup lang="ts">
import type { DamageProtectionPolicy } from '~/components/reservations/data/damage-protection'
import { toast } from 'vue-sonner'
import ProtectionOptionCards from '~/components/damage-protection/ProtectionOptionCards.vue'
import { listings } from '~/components/listings/data/listings'
import { LONG_STAY_THRESHOLD_NIGHTS } from '~/components/reservations/data/damage-protection'
import { useDamageProtection } from '~/composables/useDamageProtection'

const dp = useDamageProtection()

onMounted(() => dp.hydrate())

const openPolicyId = ref<string | null>(null)
const listingSearch = ref('')
const bandMin = ref(1)
const bandMax = ref<number | undefined>(27)
const bandOpenEnded = ref(false)
const bandTarget = ref<string[]>([])

/**
 * A policy assigned to a listing does nothing unless that listing's guest guide
 * also has an enabled damage_protection section. The two assignments are
 * independent lists, so the mismatch would otherwise fail silently.
 */
const missingGuideSections = computed(() => dp.listingsMissingGuideSection())

function listingName(id: string): string {
  return listings.value.find(l => l.id === id)?.name ?? id
}

const filteredListings = computed(() => {
  const term = listingSearch.value.trim().toLowerCase()
  return listings.value.filter(l => !term || l.name.toLowerCase().includes(term))
})

function bandsFor(policyId: string) {
  return dp.assignments.value.filter(a => a.policyId === policyId)
}

/** Long-stay bands must carry a ceiling and must name wear and tear. */
function longStayIssues(policy: DamageProtectionPolicy, minNights: number): string[] {
  if (minNights < LONG_STAY_THRESHOLD_NIGHTS)
    return []
  const issues: string[] = []
  if (policy.waiver.pricing !== 'flat' && policy.waiver.maxAmount === undefined)
    issues.push('Set a maximum waiver fee. Without a ceiling, a 90-night stay computes an unbounded fee.')
  if (policy.deposit.pricing !== 'flat' && policy.deposit.maxAmount === undefined)
    issues.push('Set a maximum deposit. Without a ceiling, a long stay computes an unbounded deposit.')
  if (policy.offers.includes('waiver') && !policy.waiver.exclusions.some(e => /wear and tear/i.test(e)))
    issues.push('Name normal wear and tear in the exclusions. Over months it is the argument you will actually have.')
  return issues
}

function policyIssues(policy: DamageProtectionPolicy): string[] {
  const minBand = Math.min(...bandsFor(policy.id).map(b => b.minNights), Number.POSITIVE_INFINITY)
  return Number.isFinite(minBand) ? longStayIssues(policy, minBand) : []
}

/** The preview renders the same cards the guest sees, from the same builder. */
function previewOptions(policy: DamageProtectionPolicy) {
  return policy.offers.map(option => ({
    option,
    amount: option === 'waiver' ? policy.waiver.rate : policy.deposit.rate,
    currency: policy.currency,
    coverageCap: option === 'waiver' ? policy.waiver.coverageCap : undefined,
    exclusions: option === 'waiver' ? policy.waiver.exclusions : undefined,
    chargeDueAt: option === 'deposit' ? new Date().toISOString() : undefined,
    refundSlaDays: option === 'deposit' ? policy.deposit.refundSlaDays : undefined,
    isDefault: option === policy.defaultOption,
  }))
}

function save(policy: DamageProtectionPolicy) {
  dp.savePolicy({ ...policy })
  toast.success('Policy saved. Bookings that already accepted it keep the terms they agreed to.')
}

function assign(policyId: string) {
  const max = bandOpenEnded.value ? null : (bandMax.value ?? null)
  let assigned = 0
  const refusals: string[] = []
  for (const listingId of bandTarget.value) {
    const result = dp.assignBand(listingId, policyId, bandMin.value, max)
    if (result.ok)
      assigned += 1
    else
      refusals.push(`${listingName(listingId)}: ${result.reason.replace(/_/g, ' ')}`)
  }
  bandTarget.value = []
  if (assigned)
    toast.success(`Assigned to ${assigned} listing(s)`)
  for (const refusal of refusals)
    toast.error(refusal)
}

function toggleTarget(listingId: string) {
  bandTarget.value = bandTarget.value.includes(listingId)
    ? bandTarget.value.filter(x => x !== listingId)
    : [...bandTarget.value, listingId]
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h2 class="text-lg font-semibold">
        Damage protection
      </h2>
      <p class="text-sm text-muted-foreground">
        A guest chooses a waiver or a deposit before arrival. A listing carries one policy per stay-length band.
      </p>
    </div>

    <div
      v-if="missingGuideSections.length"
      class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
    >
      <p class="text-sm font-medium text-amber-700 dark:text-amber-400">
        These listings have a policy but no choice screen
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        Their guest guide has no enabled Damage protection section, so the guest is never asked and nothing happens.
      </p>
      <ul class="mt-2 flex flex-col gap-1 text-sm">
        <li v-for="listingId in missingGuideSections" :key="listingId">
          {{ listingName(listingId) }}
        </li>
      </ul>
    </div>

    <div v-for="policy in dp.policies.value" :key="policy.id" class="rounded-lg border">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 p-4 text-left"
        @click="openPolicyId = openPolicyId === policy.id ? null : policy.id"
      >
        <div>
          <p class="text-sm font-medium">
            {{ policy.name }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ policy.currency }} ·
            offers {{ policy.offers.join(' and ') }} ·
            {{ bandsFor(policy.id).length }} band(s)
          </p>
        </div>
        <Icon :name="openPolicyId === policy.id ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="size-4" />
      </button>

      <div v-if="openPolicyId === policy.id" class="flex flex-col gap-5 border-t p-4">
        <div v-if="policyIssues(policy).length" class="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p v-for="issue in policyIssues(policy)" :key="issue" class="text-sm text-destructive">
            {{ issue }}
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label :for="`${policy.id}-name`">Name</Label>
            <Input :id="`${policy.id}-name`" v-model="policy.name" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label :for="`${policy.id}-terms-version`">Terms version</Label>
            <Input :id="`${policy.id}-terms-version`" v-model="policy.termsVersion" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <Label :for="`${policy.id}-waiver-rate`">Waiver fee ({{ policy.currency }})</Label>
            <Input :id="`${policy.id}-waiver-rate`" v-model.number="policy.waiver.rate" type="number" min="0" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label :for="`${policy.id}-waiver-cap`">Coverage cap</Label>
            <Input :id="`${policy.id}-waiver-cap`" v-model.number="policy.waiver.coverageCap" type="number" min="0" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label :for="`${policy.id}-deposit-rate`">Deposit</Label>
            <Input :id="`${policy.id}-deposit-rate`" v-model.number="policy.deposit.rate" type="number" min="0" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label :for="`${policy.id}-lead`">Charge lead (days before check-in)</Label>
            <Input :id="`${policy.id}-lead`" v-model.number="policy.deposit.chargeLeadDays" type="number" min="0" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label :for="`${policy.id}-sla`">Refund SLA (days after check-out)</Label>
            <Input :id="`${policy.id}-sla`" v-model.number="policy.deposit.refundSlaDays" type="number" min="0" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label :for="`${policy.id}-terms`">Terms shown to the guest</Label>
          <Textarea :id="`${policy.id}-terms`" v-model="policy.termsText" rows="4" />
          <p class="text-xs text-muted-foreground">
            Editing the terms does not change any booking that already accepted them. Bump the version so new
            acceptances are distinguishable.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
            Channels
          </p>
          <div class="flex flex-wrap gap-4">
            <div v-for="channel in (['Airbnb', 'Booking.com', 'Direct'] as const)" :key="channel" class="flex items-center gap-2">
              <Switch
                :id="`${policy.id}-${channel}`"
                :model-value="policy.channelPolicy[channel] === 'offer'"
                @update:model-value="(v) => policy.channelPolicy[channel] = v ? 'offer' : 'skip'"
              />
              <Label :for="`${policy.id}-${channel}`" class="text-sm font-normal">{{ channel }}</Label>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            Channels you leave off are skipped. Airbnb and Booking.com run their own guest damage programmes.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
            Stay-length bands
          </p>
          <ul v-if="bandsFor(policy.id).length" class="flex flex-col gap-1 text-sm">
            <li
              v-for="band in bandsFor(policy.id)"
              :key="`${band.listingId}-${band.minNights}`"
              class="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
            >
              <span>
                {{ listingName(band.listingId) }} ·
                {{ band.minNights }}{{ band.maxNights === null ? '+' : `-${band.maxNights}` }} nights
              </span>
              <Button size="sm" variant="ghost" @click="dp.removeBand(band.listingId, policy.id)">
                Remove
              </Button>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">
            Not assigned to any listing yet.
          </p>

          <div class="flex flex-wrap items-end gap-3 rounded-md border p-3">
            <div class="flex flex-col gap-1.5">
              <Label :for="`${policy.id}-band-min`">From (nights)</Label>
              <Input :id="`${policy.id}-band-min`" v-model.number="bandMin" type="number" min="1" class="w-28" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label :for="`${policy.id}-band-max`">To</Label>
              <Input
                :id="`${policy.id}-band-max`"
                v-model.number="bandMax"
                type="number"
                min="1"
                class="w-28"
                :disabled="bandOpenEnded"
              />
            </div>
            <div class="flex items-center gap-2 pb-2">
              <Checkbox
                :id="`${policy.id}-band-open`"
                :model-value="bandOpenEnded"
                @update:model-value="(v) => bandOpenEnded = v === true"
              />
              <Label :for="`${policy.id}-band-open`" class="text-sm font-normal">Open ended</Label>
            </div>
            <Button size="sm" :disabled="!bandTarget.length" @click="assign(policy.id)">
              Assign to {{ bandTarget.length }} listing(s)
            </Button>
          </div>

          <Input v-model="listingSearch" placeholder="Search listings" class="max-w-xs" />
          <div class="max-h-56 overflow-y-auto rounded-md border">
            <div
              v-for="listing in filteredListings"
              :key="listing.id"
              class="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40"
              @click="toggleTarget(listing.id)"
            >
              <div
                class="flex size-4 items-center justify-center rounded-[4px] border"
                :class="bandTarget.includes(listing.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="bandTarget.includes(listing.id)" name="lucide:check" class="size-3" />
              </div>
              <span class="text-sm">{{ listing.name }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <p class="text-[11px] tracking-wide text-muted-foreground uppercase">
            What the guest sees
          </p>
          <ProtectionOptionCards :options="previewOptions(policy)" :selectable="false" />
        </div>

        <div class="flex justify-end">
          <Button size="sm" @click="save(policy)">
            Save policy
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
