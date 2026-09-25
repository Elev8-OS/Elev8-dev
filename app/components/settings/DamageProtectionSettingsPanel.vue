<script setup lang="ts">
import type { DamageProtectionPolicy, StaySlot } from '~/components/reservations/data/damage-protection'
import type { ListingProtectionMode } from '~/composables/useDamageProtection'
import { toast } from 'vue-sonner'
import TernActivationCard from '~/components/damage-protection/TernActivationCard.vue'
import { allTags, listings } from '~/components/listings/data/listings'
import {
  channelsSelectable,
  formatProtectionAmount,
  listingSlots,
  LONG_STAY_THRESHOLD_NIGHTS,
  waiverCover,
} from '~/components/reservations/data/damage-protection'
import { elev8CoverPartner } from '~/components/reservations/data/damage-protection-seed'
import { recommendedTier, ternProduct, tierTooSmall } from '~/components/reservations/data/tern-products'
import DamageProtectionPolicySheet from '~/components/settings/DamageProtectionPolicySheet.vue'
import { useDamageProtection } from '~/composables/useDamageProtection'

/**
 * Damage protection settings, in two plain parts: the policies (the Tern cover,
 * the guest price and the terms) and the listings (whether each property is
 * protected, who pays, and which policy it uses for short and long stays).
 * Editing happens in a side sheet on a draft.
 */
const dp = useDamageProtection()

onMounted(() => dp.hydrate())

const tab = ref<'policies' | 'listings'>('policies')

// ---------------------------------------------------------------- policies

const sheetOpen = ref(false)
const editing = ref<DamageProtectionPolicy | null>(null)

function openEditor(policy: DamageProtectionPolicy | null) {
  editing.value = policy
  sheetOpen.value = true
}

function usage(policyId: string) {
  const bands = dp.assignments.value.filter(a => a.policyId === policyId)
  const listingIds = new Set(bands.map(a => a.listingId))
  return {
    short: bands.filter(a => a.minNights < LONG_STAY_THRESHOLD_NIGHTS).length,
    long: bands.filter(a => a.minNights >= LONG_STAY_THRESHOLD_NIGHTS).length,
    total: listingIds.size,
    /** Used, and only on host-paid listings: the guest price is never charged. */
    hostOnly: listingIds.size > 0 && [...listingIds].every(id => dp.payerFor(id) === 'host'),
  }
}

function waiverLine(policy: DamageProtectionPolicy): string {
  const cover = waiverCover(policy)
  const tier = ternProduct(policy.waiver.tier).name
  if (!cover)
    return `Tern ${tier}, not available in ${policy.currency} yet`
  return `Tern ${tier}, covers up to ${formatProtectionAmount(cover.coverageCap, policy.currency)}. `
    + `Guest pays ${formatProtectionAmount(policy.waiver.guestPrice, policy.currency)}, `
    + `Elev8 charges you ${formatProtectionAmount(cover.perStayFee, policy.currency)} per stay`
}

function depositLine(policy: DamageProtectionPolicy): string {
  const { pricing, rate, settleWithinDays } = policy.deposit
  const limit = pricing === 'percent_of_subtotal' ? `${rate}% of the stay` : formatProtectionAmount(rate, policy.currency)
  return `Card on file, charged up to ${limit} only for damage, decided within ${settleWithinDays} days`
}

/** A waiver covers every booking, so its channels are not a choice. */
function channelsOf(policy: DamageProtectionPolicy): string[] {
  if (!channelsSelectable(policy))
    return ['All channels']
  return Object.entries(policy.channelPolicy).filter(([, v]) => v === 'offer').map(([channel]) => channel)
}

function remove(policy: DamageProtectionPolicy) {
  const result = dp.deletePolicy(policy.id)
  toast[result.ok ? 'success' : 'error'](result.ok
    ? `${policy.name} deleted`
    : 'Remove this policy from every listing first, in the Listings tab.')
}

// ---------------------------------------------------------------- listings

const search = ref('')
const NONE = 'none'
/** In the bulk bar: leave this slot as each listing has it. */
const KEEP = 'keep'

const tagFilter = ref<string>('all')
const statusFilter = ref<'all' | ListingProtectionMode>('all')

const MODE_LABELS: Record<ListingProtectionMode, string> = {
  off: 'No protection',
  guest_paid: 'Guest pays',
  host_paid: 'Host pays',
}
const MODES: ListingProtectionMode[] = ['off', 'guest_paid', 'host_paid']

const missingGuide = computed(() => new Set(dp.listingsMissingGuideSection()))

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return listings.value
    .filter(l => !term || l.name.toLowerCase().includes(term) || l.location?.toLowerCase().includes(term))
    .filter(l => tagFilter.value === 'all' || l.tags.includes(tagFilter.value))
    .filter(l => statusFilter.value === 'all' || dp.listingMode(l.id) === statusFilter.value)
    .map((listing) => {
      const slots = listingSlots(dp.assignments.value, listing.id)
      const account = dp.payoutAccountFor(listing.id)
      const mode = dp.listingMode(listing.id)
      const assigned = [slots.short, slots.long].filter(Boolean) as string[]
      const offersDeposit = assigned.some(id => dp.policies.value.find(p => p.id === id)?.offers.includes('deposit'))
      // Sized to the property: a tier smaller than its guest count calls for is flagged.
      const undersized = assigned
        .map(id => dp.policies.value.find(p => p.id === id))
        .filter((p): p is DamageProtectionPolicy => Boolean(p?.offers.includes('waiver')))
        .filter(p => tierTooSmall(p.waiver.tier, listing.capacity))
      return {
        listing,
        slots,
        mode,
        currency: account?.currency ?? null,
        // The host pays for the waiver, so there is no deposit to lose here.
        waiverOnly: mode === 'guest_paid' && offersDeposit && dp.railForListing(listing.id) !== 'card',
        // Its policies carry the waiver, and the waiver is not activated yet.
        paused: assigned.some(id => dp.pausedUntilActivation(dp.policies.value.find(p => p.id === id) ?? null)),
        noChoiceScreen: mode === 'guest_paid' && assigned.length > 0 && missingGuide.value.has(listing.id),
        undersized: undersized.length
          ? `${ternProduct(undersized[0]!.waiver.tier).name} cover is sized for smaller properties. This one sleeps ${listing.capacity}: ${ternProduct(recommendedTier(listing.capacity)).name} is recommended.`
          : null,
      }
    })
})

const setUpCount = computed(() =>
  listings.value.filter(l => dp.assignments.value.some(a => a.listingId === l.id)).length)
const needsAttention = computed(() => rows.value.filter(r => r.noChoiceScreen).length)

/** A policy in another currency cannot be used where the listing is paid out: no conversion, ever. */
function currencyBlocked(policy: DamageProtectionPolicy, currency: string | null): boolean {
  return currency !== null && policy.currency !== currency
}

/** Host-paid cover is Tern's: it cannot be chosen before the service is activated. */
function modeBlocked(mode: ListingProtectionMode): boolean {
  return mode === 'host_paid' && !dp.waiverServiceActive.value
}

/** Where the host pays, a deposit-only policy has nothing for them to pay for. */
function hostBlocked(policy: DamageProtectionPolicy, mode: ListingProtectionMode): boolean {
  return mode === 'host_paid' && !policy.offers.includes('waiver')
}

const REFUSALS: Record<string, string> = {
  currency_mismatch: 'That policy is in another currency than this listing\'s payouts.',
  host_needs_waiver: 'Where you pay for the cover, the policy needs the waiver. A deposit-only policy has nothing for you to pay for.',
  no_policy_in_currency: 'There is no policy in this listing\'s payout currency yet. Create one from a template in the Policies tab.',
  waiver_not_activated: 'Activate the damage waiver first, at the top of this page: host-paid cover is Tern\'s.',
}

function refusalText(reason: string): string {
  return REFUSALS[reason] ?? `Could not set the policy (${reason.replace(/_/g, ' ')})`
}

function setSlot(listingId: string, slot: StaySlot, value: unknown) {
  const policyId = value === NONE || typeof value !== 'string' ? null : value
  const result = dp.setListingSlot(listingId, slot, policyId)
  if (!result.ok)
    toast.error(refusalText(result.reason))
}

function setMode(listingId: string, value: unknown) {
  if (typeof value !== 'string')
    return
  const result = dp.setListingMode(listingId, value as ListingProtectionMode)
  if (!result.ok)
    toast.error(refusalText(result.reason))
  else if (value === 'host_paid')
    toast.success('Covered by you: guests on this listing are not asked, and Elev8 charges you per stay.')
}

// ------------------------------------------------------------ bulk assign

const selected = ref<string[]>([])
const bulkMode = ref<string>(KEEP)
const bulkShort = ref<string>(KEEP)
const bulkLong = ref<string>(KEEP)

/** "Select all" means all SHOWN: search, tag and status double as a picker for a group. */
const allShownSelected = computed(() =>
  rows.value.length > 0 && rows.value.every(r => selected.value.includes(r.listing.id)))
const someShownSelected = computed(() =>
  !allShownSelected.value && rows.value.some(r => selected.value.includes(r.listing.id)))

function toggleRow(listingId: string) {
  selected.value = selected.value.includes(listingId)
    ? selected.value.filter(id => id !== listingId)
    : [...selected.value, listingId]
}

function toggleAllShown() {
  const shown = rows.value.map(r => r.listing.id)
  selected.value = allShownSelected.value
    ? selected.value.filter(id => !shown.includes(id))
    : [...new Set([...selected.value, ...shown])]
}

function bulkValue(value: string): string | null | undefined {
  if (value === KEEP)
    return undefined
  return value === NONE ? null : value
}

const SKIP_REASONS: Record<string, string> = {
  currency_mismatch: 'currency differs from its payouts',
  custom_ranges: 'uses custom night ranges',
  overlapping_band: 'overlaps a custom range',
  host_needs_waiver: 'host pays, so the policy needs the waiver',
  no_policy_in_currency: 'no policy in its payout currency',
  waiver_not_activated: 'the damage waiver is not activated',
}

function listingNameOf(id: string): string {
  return listings.value.find(l => l.id === id)?.name ?? id
}

function applyBulk() {
  const change = { short: bulkValue(bulkShort.value), long: bulkValue(bulkLong.value) }
  const mode = bulkMode.value === KEEP ? null : bulkMode.value as ListingProtectionMode
  if (!mode && change.short === undefined && change.long === undefined) {
    toast.error('Choose who pays, a policy for short stays, long stays, or any of them.')
    return
  }
  // Who pays first, so a policy change below is checked against the new payer.
  const modeSkipped: { listingId: string, reason: string }[] = []
  let targets = selected.value
  if (mode) {
    for (const listingId of selected.value) {
      const result = dp.setListingMode(listingId, mode)
      if (!result.ok)
        modeSkipped.push({ listingId, reason: result.reason })
    }
    targets = mode === 'off' ? [] : selected.value.filter(id => !modeSkipped.some(s => s.listingId === id))
  }
  const slotResult = change.short === undefined && change.long === undefined
    ? { applied: targets, skipped: [] as { listingId: string, reason: string }[] }
    : dp.setSlotsForListings(targets, change)
  const applied = mode === 'off' ? selected.value : slotResult.applied
  const skipped = [...modeSkipped, ...slotResult.skipped]
  if (applied.length)
    toast.success(`Applied to ${applied.length} ${applied.length === 1 ? 'listing' : 'listings'}`)
  if (skipped.length) {
    const detail = skipped.slice(0, 3)
      .map(s => `${listingNameOf(s.listingId)} (${SKIP_REASONS[s.reason] ?? s.reason.replace(/_/g, ' ')})`)
      .join(', ')
    toast.error(`${skipped.length} skipped: ${detail}${skipped.length > 3 ? ', ...' : ''}`)
  }
  // Keep the skipped ones selected, so they can be dealt with next.
  selected.value = skipped.map(s => s.listingId)
  bulkMode.value = KEEP
  bulkShort.value = KEEP
  bulkLong.value = KEEP
}

function resetCustom(listingId: string) {
  dp.resetListingBands(listingId)
  toast.info('Custom night ranges cleared. Pick the policies for short and long stays.')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h2 class="text-lg font-semibold">
        Damage protection
      </h2>
      <p class="text-sm text-muted-foreground">
        Choose for each property: no protection, the guest buys the damage waiver in the guest guide, or you pay
        for it and the guest is not asked. The cover comes from Tern through Elev8. Owner stays are never included.
      </p>
    </div>

    <TernActivationCard />

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger value="policies" data-testid="tab-policies">
          Policies
        </TabsTrigger>
        <TabsTrigger value="listings" data-testid="tab-listings">
          Listings
          <span class="ml-1.5 text-xs text-muted-foreground tabular-nums">{{ setUpCount }}/{{ listings.length }}</span>
        </TabsTrigger>
      </TabsList>

      <!-- Policies -->
      <TabsContent value="policies" class="mt-4 flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-muted-foreground">
            A policy is the Tern cover, what the guest pays for it, and the terms. Start new ones from a template.
          </p>
          <Button size="sm" class="gap-1.5" data-testid="policy-new" @click="openEditor(null)">
            <Icon name="lucide:plus" class="size-4" />
            New policy
          </Button>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div
            v-for="policy in dp.policies.value"
            :key="policy.id"
            class="flex flex-col gap-3 rounded-lg border p-4"
            data-testid="policy-card"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium">
                  {{ policy.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ policy.currency }} · terms {{ policy.termsVersion }}
                </p>
                <p
                  v-if="dp.pausedUntilActivation(policy)"
                  class="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                  data-testid="policy-paused"
                >
                  <Icon name="lucide:pause-circle" class="size-3" />
                  Paused until the damage waiver is activated
                </p>
              </div>
              <div class="flex items-center gap-1">
                <Button size="sm" variant="outline" @click="openEditor(policy)">
                  Edit
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 hover:text-destructive"
                  :aria-label="`Delete ${policy.name}`"
                  :disabled="usage(policy.id).total > 0"
                  :title="usage(policy.id).total > 0 ? 'In use on listings: remove it there first' : `Delete ${policy.name}`"
                  @click="remove(policy)"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
                </Button>
              </div>
            </div>

            <ul class="flex flex-col gap-2 text-sm">
              <li class="flex items-start gap-2">
                <Icon
                  :name="policy.offers.includes('waiver') ? 'lucide:shield-check' : 'lucide:minus'"
                  class="mt-0.5 size-4 shrink-0"
                  :class="policy.offers.includes('waiver') ? 'text-foreground' : 'text-muted-foreground'"
                />
                <span :class="policy.offers.includes('waiver') ? '' : 'text-muted-foreground'">
                  <span class="font-medium">Waiver:</span>
                  {{ policy.offers.includes('waiver') ? waiverLine(policy) : 'not offered' }}
                </span>
              </li>
              <li class="flex items-start gap-2">
                <Icon
                  :name="policy.offers.includes('deposit') ? 'lucide:credit-card' : 'lucide:minus'"
                  class="mt-0.5 size-4 shrink-0"
                  :class="policy.offers.includes('deposit') ? 'text-foreground' : 'text-muted-foreground'"
                />
                <span :class="policy.offers.includes('deposit') ? '' : 'text-muted-foreground'">
                  <span class="font-medium">Deposit:</span>
                  {{ policy.offers.includes('deposit') ? depositLine(policy) : 'not offered' }}
                </span>
              </li>
            </ul>

            <div class="mt-auto flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
              <Badge v-for="channel in channelsOf(policy)" :key="channel" variant="secondary" class="font-normal">
                {{ channel }}
              </Badge>
              <span class="ml-auto" data-testid="policy-usage">
                <template v-if="usage(policy.id).total === 0">Not used on any listing yet</template>
                <template v-else>
                  Used on {{ usage(policy.id).total }} {{ usage(policy.id).total === 1 ? 'listing' : 'listings' }}
                  <template v-if="usage(policy.id).long && !usage(policy.id).short">for long stays</template>
                  <template v-else-if="usage(policy.id).short && !usage(policy.id).long">for short stays</template>
                </template>
              </span>
            </div>
          </div>
        </div>

        <!-- Elev8's own insurance integration: a read-out, nothing to set. -->
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="lucide:info" class="size-3.5 shrink-0" />
          The waiver cover is provided by {{ elev8CoverPartner.name }} through Elev8. Claims above
          {{ formatProtectionAmount(elev8CoverPartner.deductiblePerClaim, elev8CoverPartner.currency) }} are insured by
          {{ elev8CoverPartner.name }} and paid by bank transfer into the account you gave when activating.
        </p>
      </TabsContent>

      <!-- Listings -->
      <TabsContent value="listings" class="mt-4 flex flex-col gap-4">
        <div
          v-if="needsAttention"
          class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
          data-testid="listings-attention"
        >
          <Icon name="lucide:alert-triangle" class="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>
            {{ needsAttention }} {{ needsAttention === 1 ? 'listing has' : 'listings have' }} a policy but no Damage protection
            section in the guest guide, so guests there are never asked. Add the section in Guest Guides.
          </span>
        </div>

        <p class="text-sm text-muted-foreground">
          Choose who pays for each property, then the policy it uses, or tick several and set them at once. Stays of
          {{ LONG_STAY_THRESHOLD_NIGHTS }} nights or more can use a different policy.
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <Input v-model="search" placeholder="Search listings" class="max-w-xs" data-testid="listings-search" />
          <Select v-model="tagFilter">
            <SelectTrigger class="w-40" data-testid="listings-tag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All tags
              </SelectItem>
              <SelectItem v-for="tag in allTags" :key="tag" :value="tag">
                {{ tag }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="statusFilter">
            <SelectTrigger class="w-40" data-testid="listings-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All listings
              </SelectItem>
              <SelectItem v-for="mode in MODES" :key="mode" :value="mode">
                {{ MODE_LABELS[mode] }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="text-xs text-muted-foreground">{{ rows.length }} shown</span>
        </div>

        <!-- Bulk bar: the same two choices, applied to every ticked listing. -->
        <div
          v-if="selected.length"
          class="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-sm backdrop-blur"
          data-testid="bulk-bar"
        >
          <span class="font-medium">{{ selected.length }} selected</span>
          <span class="text-muted-foreground">Who pays</span>
          <Select v-model="bulkMode">
            <SelectTrigger class="h-8 w-40" data-testid="bulk-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="KEEP">
                Keep as is
              </SelectItem>
              <SelectItem v-for="mode in MODES" :key="mode" :value="mode" :disabled="modeBlocked(mode)">
                {{ MODE_LABELS[mode] }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="text-muted-foreground">Short stays</span>
          <Select v-model="bulkShort">
            <SelectTrigger class="h-8 w-44" data-testid="bulk-short">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="KEEP">
                Keep as is
              </SelectItem>
              <SelectItem :value="NONE">
                No protection
              </SelectItem>
              <SelectItem v-for="policy in dp.policies.value" :key="policy.id" :value="policy.id">
                {{ policy.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="text-muted-foreground">Long stays</span>
          <Select v-model="bulkLong">
            <SelectTrigger class="h-8 w-44" data-testid="bulk-long">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="KEEP">
                Keep as is
              </SelectItem>
              <SelectItem :value="NONE">
                No protection
              </SelectItem>
              <SelectItem v-for="policy in dp.policies.value" :key="policy.id" :value="policy.id">
                {{ policy.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" data-testid="bulk-apply" @click="applyBulk">
            Apply to {{ selected.length }}
          </Button>
          <Button size="sm" variant="ghost" class="ml-auto" @click="selected = []">
            Clear selection
          </Button>
        </div>

        <div class="rounded-md border">
          <div class="overflow-x-auto">
            <table class="w-full text-sm" data-testid="listings-table">
              <thead class="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th class="w-10 px-4 py-3">
                    <!-- A custom box, not reka-ui's Checkbox: it must show "some" and
                         cannot desync from `selected`. -->
                    <button
                      type="button"
                      class="flex size-4 items-center justify-center rounded-[4px] border"
                      :class="allShownSelected || someShownSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                      :aria-label="allShownSelected ? 'Unselect all shown listings' : 'Select all shown listings'"
                      :aria-checked="allShownSelected ? 'true' : someShownSelected ? 'mixed' : 'false'"
                      role="checkbox"
                      data-testid="select-all-shown"
                      @click="toggleAllShown"
                    >
                      <Icon v-if="allShownSelected" name="lucide:check" class="size-3" />
                      <Icon v-else-if="someShownSelected" name="lucide:minus" class="size-3" />
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Listing
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Protection
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Stays under {{ LONG_STAY_THRESHOLD_NIGHTS }} nights
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Stays of {{ LONG_STAY_THRESHOLD_NIGHTS }}+ nights
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in rows"
                  :key="row.listing.id"
                  class="border-t align-top"
                  :class="selected.includes(row.listing.id) ? 'bg-muted/40' : ''"
                  data-testid="listing-row"
                >
                  <td class="px-4 py-3">
                    <button
                      type="button"
                      class="mt-0.5 flex size-4 items-center justify-center rounded-[4px] border"
                      :class="selected.includes(row.listing.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                      role="checkbox"
                      :aria-checked="selected.includes(row.listing.id)"
                      :aria-label="`Select ${row.listing.name}`"
                      data-testid="row-select"
                      @click="toggleRow(row.listing.id)"
                    >
                      <Icon v-if="selected.includes(row.listing.id)" name="lucide:check" class="size-3" />
                    </button>
                  </td>
                  <td class="px-4 py-3">
                    <p class="font-medium">
                      {{ row.listing.name }}
                    </p>
                    <p v-if="row.waiverOnly" class="mt-0.5 text-xs text-muted-foreground">
                      Waiver only here: deposits need a Stripe payout account.
                    </p>
                    <p v-if="row.noChoiceScreen" class="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <Icon name="lucide:alert-triangle" class="size-3" />
                      Not in the guest guide yet
                    </p>
                    <p
                      v-if="row.undersized"
                      class="mt-0.5 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400"
                      data-testid="listing-undersized"
                    >
                      <Icon name="lucide:alert-triangle" class="mt-0.5 size-3 shrink-0" />
                      {{ row.undersized }}
                    </p>
                  </td>

                  <td class="px-4 py-3">
                    <Select :model-value="row.mode" @update:model-value="(v) => setMode(row.listing.id, v)">
                      <SelectTrigger class="h-8 w-full min-w-36 text-sm" data-testid="listing-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="mode in MODES" :key="mode" :value="mode" :disabled="modeBlocked(mode)">
                          {{ MODE_LABELS[mode] }}
                          <span v-if="modeBlocked(mode)" class="text-muted-foreground">(activate the waiver first)</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p v-if="row.mode === 'host_paid'" class="mt-1 text-xs text-muted-foreground">
                      Guests are not asked. Elev8 charges you per stay.
                    </p>
                    <p
                      v-else-if="row.mode === 'guest_paid' && row.paused"
                      class="mt-1 text-xs text-amber-700 dark:text-amber-400"
                      data-testid="listing-paused"
                    >
                      Guests are not asked yet: the waiver is not activated.
                    </p>
                  </td>

                  <td v-if="row.mode === 'off'" colspan="2" class="px-4 py-3 text-xs text-muted-foreground">
                    Not protected. Damage is handled outside Elev8.
                  </td>
                  <td v-else-if="row.slots.custom" colspan="2" class="px-4 py-3">
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      Uses custom night ranges.
                      <Button size="sm" variant="outline" class="h-7 text-xs" @click="resetCustom(row.listing.id)">
                        Switch to short and long stays
                      </Button>
                    </div>
                  </td>
                  <template v-else>
                    <td v-for="slot in (['short', 'long'] as const)" :key="slot" class="px-4 py-3">
                      <Select
                        :model-value="row.slots[slot] ?? NONE"
                        @update:model-value="(v) => setSlot(row.listing.id, slot, v)"
                      >
                        <SelectTrigger class="h-8 w-full min-w-44 text-sm" :data-testid="`slot-${slot}`">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem :value="NONE">
                            No protection
                          </SelectItem>
                          <SelectItem
                            v-for="policy in dp.policies.value"
                            :key="policy.id"
                            :value="policy.id"
                            :disabled="currencyBlocked(policy, row.currency) || hostBlocked(policy, row.mode)"
                          >
                            {{ policy.name }}
                            <span v-if="currencyBlocked(policy, row.currency)" class="text-muted-foreground">
                              ({{ policy.currency }}, payouts are {{ row.currency }})
                            </span>
                            <span v-else-if="hostBlocked(policy, row.mode)" class="text-muted-foreground">
                              (no waiver for you to pay for)
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <DamageProtectionPolicySheet
      v-model:open="sheetOpen"
      :policy="editing"
      :used-for-long-stays="editing ? usage(editing.id).long > 0 : false"
      :guest-paid="editing ? !usage(editing.id).hostOnly : true"
    />
  </div>
</template>
