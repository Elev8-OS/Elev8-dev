<script setup lang="ts">
import type { DamageProtectionPolicy, StaySlot } from '~/components/reservations/data/damage-protection'
import { toast } from 'vue-sonner'
import { allTags, listings } from '~/components/listings/data/listings'
import { formatProtectionAmount, listingSlots, LONG_STAY_THRESHOLD_NIGHTS } from '~/components/reservations/data/damage-protection'
import { elev8CoverPartner } from '~/components/reservations/data/damage-protection-seed'
import DamageProtectionPolicySheet from '~/components/settings/DamageProtectionPolicySheet.vue'
import { useDamageProtection } from '~/composables/useDamageProtection'

/**
 * Damage protection settings, in two plain parts: the policies (what a guest
 * can choose and on what terms) and the listings (which policy each property
 * uses for short and long stays). Editing happens in a side sheet on a draft.
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
  return {
    short: bands.filter(a => a.minNights < LONG_STAY_THRESHOLD_NIGHTS).length,
    long: bands.filter(a => a.minNights >= LONG_STAY_THRESHOLD_NIGHTS).length,
    total: new Set(bands.map(a => a.listingId)).size,
  }
}

function waiverLine(policy: DamageProtectionPolicy): string {
  const { pricing, rate, coverageCap } = policy.waiver
  const fee = pricing === 'percent_of_subtotal'
    ? `${rate}% of the stay`
    : `${formatProtectionAmount(rate, policy.currency)} ${pricing === 'per_night' ? 'per night' : 'per stay'}`
  return `${fee}, covers up to ${formatProtectionAmount(coverageCap, policy.currency)}`
}

function depositLine(policy: DamageProtectionPolicy): string {
  const { pricing, rate, settleWithinDays } = policy.deposit
  const limit = pricing === 'percent_of_subtotal' ? `${rate}% of the stay` : formatProtectionAmount(rate, policy.currency)
  return `Card on file, charged up to ${limit} only for damage, decided within ${settleWithinDays} days`
}

function channelsOf(policy: DamageProtectionPolicy): string[] {
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
const statusFilter = ref<'all' | 'unset' | 'set'>('all')

const missingGuide = computed(() => new Set(dp.listingsMissingGuideSection()))

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return listings.value
    .filter(l => !term || l.name.toLowerCase().includes(term) || l.location?.toLowerCase().includes(term))
    .filter(l => tagFilter.value === 'all' || l.tags.includes(tagFilter.value))
    .filter((l) => {
      if (statusFilter.value === 'all')
        return true
      const isSet = dp.assignments.value.some(a => a.listingId === l.id)
      return statusFilter.value === 'set' ? isSet : !isSet
    })
    .map((listing) => {
      const slots = listingSlots(dp.assignments.value, listing.id)
      const account = dp.payoutAccountFor(listing.id)
      const assigned = [slots.short, slots.long].filter(Boolean) as string[]
      const offersDeposit = assigned.some(id => dp.policies.value.find(p => p.id === id)?.offers.includes('deposit'))
      return {
        listing,
        slots,
        currency: account?.currency ?? null,
        waiverOnly: offersDeposit && dp.railForListing(listing.id) !== 'card',
        noChoiceScreen: assigned.length > 0 && missingGuide.value.has(listing.id),
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

function setSlot(listingId: string, slot: StaySlot, value: unknown) {
  const policyId = value === NONE || typeof value !== 'string' ? null : value
  const result = dp.setListingSlot(listingId, slot, policyId)
  if (!result.ok) {
    toast.error(result.reason === 'currency_mismatch'
      ? 'That policy is in another currency than this listing\'s payouts.'
      : `Could not set the policy (${result.reason.replace(/_/g, ' ')})`)
  }
}

// ------------------------------------------------------------ bulk assign

const selected = ref<string[]>([])
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
}

function listingNameOf(id: string): string {
  return listings.value.find(l => l.id === id)?.name ?? id
}

function applyBulk() {
  const change = { short: bulkValue(bulkShort.value), long: bulkValue(bulkLong.value) }
  if (change.short === undefined && change.long === undefined) {
    toast.error('Choose a policy for short stays, long stays, or both.')
    return
  }
  const { applied, skipped } = dp.setSlotsForListings(selected.value, change)
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
        Before arrival, each guest picks a damage waiver or leaves a card on file as a deposit.
        Set up the options here, then choose which properties use them.
      </p>
    </div>

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
            A policy is what a guest can choose, and at what price.
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
          Waiver claims above {{ formatProtectionAmount(elev8CoverPartner.deductiblePerClaim, elev8CoverPartner.currency) }}
          are insured by {{ elev8CoverPartner.name }} through Elev8 and paid into your Stripe payout account.
          Nothing to set up.
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
          Pick a policy for each property, or tick several and set them at once. Stays of
          {{ LONG_STAY_THRESHOLD_NIGHTS }} nights or more can use a different one.
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
            <SelectTrigger class="w-36" data-testid="listings-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All listings
              </SelectItem>
              <SelectItem value="unset">
                Not set up
              </SelectItem>
              <SelectItem value="set">
                Set up
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
                  </td>

                  <td v-if="row.slots.custom" colspan="2" class="px-4 py-3">
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
                            :disabled="currencyBlocked(policy, row.currency)"
                          >
                            {{ policy.name }}
                            <span v-if="currencyBlocked(policy, row.currency)" class="text-muted-foreground">
                              ({{ policy.currency }}, payouts are {{ row.currency }})
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
    />
  </div>
</template>
