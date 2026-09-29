<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import type { DamageProtectionPolicy, StaySlot } from '~/components/reservations/data/damage-protection'
import type { ListingProtectionMode, ProtectionRow } from '~/composables/useDamageProtection'
import { toast } from 'vue-sonner'
import DamageProtectionStatusChip from '~/components/damage-protection/DamageProtectionStatusChip.vue'
import {
  currencyBlocked,
  depositSummary,
  hostBlocked,
  listingProtectionView,
  policyUsage,
  PROTECTION_MODE_LABELS,
  PROTECTION_MODES,
  protectionRefusalText,
  waiverSummary,
} from '~/components/damage-protection/data/listing-protection'
import TernActivationWizard from '~/components/damage-protection/TernActivationWizard.vue'
import TernPromoDialog from '~/components/damage-protection/TernPromoDialog.vue'
import { formatProtectionAmount, LONG_STAY_THRESHOLD_NIGHTS } from '~/components/reservations/data/damage-protection'
import { PAYOUT_SETTINGS_PATH } from '~/components/reservations/data/tern-activation'
import DamageProtectionPolicySheet from '~/components/settings/DamageProtectionPolicySheet.vue'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useTernActivation } from '~/composables/useTernActivation'

/**
 * One listing's damage protection: who pays, the policies for short and long
 * stays, what those policies offer, and the stays they cover. The same writes
 * as the Listings tab of /settings/damage-protection, for this listing only.
 */
const props = defineProps<{ listing: Listing }>()

const dp = useDamageProtection()

const tern = useTernActivation()
const promoOpen = ref(false)
const wizardOpen = ref(false)

// The tab mounts each time it is opened, so the pitch shows on every visit
// until the waiver is active. Not while a registration is already running.
onMounted(() => {
  dp.hydrate()
  const status = tern.activation.value.status
  if (status === 'not_activated' || status === 'registration_failed')
    promoOpen.value = true
})

function startActivation() {
  promoOpen.value = false
  wizardOpen.value = true
}

const NONE = 'none'

const missingGuide = computed(() => new Set(dp.listingsMissingGuideSection()))
const view = computed(() => listingProtectionView(dp, props.listing, missingGuide.value))

/** The pitch starts from the price this listing already charges for the waiver, if it has one. */
const ownGuestPrice = computed(() =>
  view.value.policies.find(p => p.offers.includes('waiver'))?.waiver.guestPrice ?? null)
const account = computed(() => dp.payoutAccountFor(props.listing.id))
const takesDeposit = computed(() => dp.railForListing(props.listing.id) === 'card')

const MODE_META: Record<ListingProtectionMode, { icon: string, text: string }> = {
  off: { icon: 'lucide:shield-off', text: 'Damage is handled outside Elev8.' },
  guest_paid: { icon: 'lucide:user-round', text: 'The guest buys the damage waiver, or leaves a card on file, in the guest guide.' },
  host_paid: { icon: 'lucide:building-2', text: 'The guest is not asked. Elev8 charges you the Elev8 Cover fee.' },
}

/** Host-paid cover is Tern's: it cannot be chosen before the service is activated. */
function modeBlocked(mode: ListingProtectionMode): boolean {
  return mode === 'host_paid' && !dp.waiverServiceActive.value
}

function setMode(mode: ListingProtectionMode) {
  if (mode === view.value.mode || modeBlocked(mode))
    return
  const result = dp.setListingMode(props.listing.id, mode)
  if (!result.ok)
    toast.error(protectionRefusalText(result.reason, 'listing'))
  else if (mode === 'host_paid')
    toast.success('Covered by you: guests on this listing are not asked, and Elev8 charges you the cover fee.')
  else
    toast.success(mode === 'off' ? 'Protection turned off for this listing' : 'Guests on this listing now choose their protection')
}

function setSlot(slot: StaySlot, value: unknown) {
  const policyId = value === NONE || typeof value !== 'string' ? null : value
  const result = dp.setListingSlot(props.listing.id, slot, policyId)
  if (!result.ok)
    toast.error(protectionRefusalText(result.reason, 'listing'))
}

function resetCustom() {
  dp.resetListingBands(props.listing.id)
  toast.info('Custom night ranges cleared. Pick the policies for short and long stays.')
}

const SLOTS: { slot: StaySlot, label: string }[] = [
  { slot: 'short', label: `Stays under ${LONG_STAY_THRESHOLD_NIGHTS} nights` },
  { slot: 'long', label: `Stays of ${LONG_STAY_THRESHOLD_NIGHTS}+ nights` },
]

/** A deposit reaches the guest only where they pay and the card can be saved. */
function depositOffered(policy: DamageProtectionPolicy): boolean {
  return policy.offers.includes('deposit') && view.value.mode === 'guest_paid' && !view.value.waiverOnly
}

function depositText(policy: DamageProtectionPolicy): string {
  if (!policy.offers.includes('deposit'))
    return 'not offered'
  if (view.value.mode === 'host_paid')
    return 'not asked, you pay for the waiver here'
  if (view.value.waiverOnly)
    return 'not offered here, deposits need a Stripe payout account'
  return depositSummary(policy)
}

// ------------------------------------------------------------ policy sheet

const sheetOpen = ref(false)
const editing = ref<DamageProtectionPolicy | null>(null)
const editingUsage = computed(() => editing.value ? policyUsage(dp, editing.value.id) : null)

function openEditor(policy: DamageProtectionPolicy) {
  editing.value = policy
  sheetOpen.value = true
}

// ------------------------------------------------------------------ stays

const stays = computed<ProtectionRow[]>(() =>
  dp.rows.value
    .filter(row => row.reservation.listingId === props.listing.id)
    .sort((a, b) => b.reservation.checkIn.localeCompare(a.reservation.checkIn)))

const PAGE_SIZES = [10, 20, 30, 50]
const pageSize = ref(10)
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(stays.value.length / pageSize.value)))
const pagedStays = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return stays.value.slice(start, start + pageSize.value)
})

// Another listing starts on its first page; a shrinking list never strands you past the end.
watch(() => props.listing.id, () => { currentPage.value = 1 })
watch(totalPages, (total) => {
  if (currentPage.value > total)
    currentPage.value = total
})

function setPageSize(value: unknown) {
  pageSize.value = Number(value)
  currentPage.value = 1
}

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00`))
}

function optionLabel(row: ProtectionRow): string {
  const protection = row.protection
  if (!protection)
    return 'Not chosen yet'
  if (protection.option === 'waiver')
    return protection.paidBy === 'host' ? 'Waiver, host pays' : 'Waiver'
  return protection.card ? `Deposit, card •••• ${protection.card.last4}` : 'Deposit'
}

function amountLabel(row: ProtectionRow): string {
  const protection = row.protection
  if (!protection)
    return '—'
  return formatProtectionAmount(protection.amount, protection.currency)
}

function claimCount(row: ProtectionRow): number {
  return row.protection?.claims?.length ?? 0
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Not activated: the waiver, and everything built on it, is paused. -->
    <div
      v-if="!dp.waiverServiceActive.value"
      class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
      data-testid="protection-not-activated"
    >
      <Icon name="lucide:pause-circle" class="mt-0.5 size-4 shrink-0 text-amber-600" />
      <span class="flex-1">
        The damage waiver is not activated yet, so waiver policies are paused and "Host pays" is not available.
        Deposit-only policies keep working.
        <template v-if="!tern.hasStripePayout.value">
          Activating it needs a Stripe payout account first.
        </template>
      </span>
      <NuxtLink v-if="!tern.hasStripePayout.value" :to="PAYOUT_SETTINGS_PATH">
        <Button size="sm" variant="outline" class="h-7 text-xs" data-testid="protection-connect-stripe">
          Connect Stripe
        </Button>
      </NuxtLink>
      <Button v-else size="sm" variant="outline" class="h-7 text-xs" data-testid="protection-activate" @click="startActivation">
        Activate
      </Button>
    </div>

    <!-- Who pays -->
    <Card>
      <CardHeader class="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2">
            <Icon name="lucide:shield-check" class="size-4" />
            Damage protection
          </CardTitle>
          <CardDescription>
            Who pays if something breaks. The cover is Elev8 Cover. Owner stays are never included.
          </CardDescription>
        </div>
        <NuxtLink to="/settings/damage-protection" class="shrink-0">
          <Button variant="outline" size="sm">
            Manage policies
          </Button>
        </NuxtLink>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div class="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Who pays for damage protection">
          <button
            v-for="mode in PROTECTION_MODES"
            :key="mode"
            type="button"
            role="radio"
            :aria-checked="view.mode === mode"
            :disabled="modeBlocked(mode)"
            class="flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="view.mode === mode ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/60'"
            :data-testid="`protection-mode-${mode}`"
            @click="setMode(mode)"
          >
            <span class="flex items-center gap-2 text-sm font-medium">
              <Icon :name="MODE_META[mode].icon" class="size-4" />
              {{ PROTECTION_MODE_LABELS[mode] }}
              <Icon v-if="view.mode === mode" name="lucide:check" class="ml-auto size-4 text-primary" />
            </span>
            <span class="text-xs text-muted-foreground">
              {{ modeBlocked(mode) ? 'Activate the damage waiver first.' : MODE_META[mode].text }}
            </span>
          </button>
        </div>

        <!-- Where the money settles decides whether a deposit is possible. -->
        <p class="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="protection-payout">
          <Icon name="lucide:landmark" class="mt-0.5 size-3.5 shrink-0" />
          <template v-if="!account">
            No payout account for this listing: guests here can only be offered the waiver.
          </template>
          <template v-else-if="takesDeposit">
            Paid out to {{ account.accountName }} ({{ account.currency }}, Stripe). A deposit can be taken here as a card on file.
          </template>
          <template v-else>
            Paid out to {{ account.accountName }} ({{ account.currency }}). Deposits need a Stripe payout account, so
            guests here are offered the waiver only.
          </template>
        </p>
        <p
          v-if="listing.unitType === 'multi'"
          class="flex items-start gap-1.5 text-xs text-muted-foreground"
        >
          <Icon name="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
          Protection is set for the whole property: every room uses the same policies.
        </p>
      </CardContent>
    </Card>

    <!-- Policies -->
    <Card v-if="view.mode !== 'off'" data-testid="protection-policies">
      <CardHeader>
        <CardTitle>Policies</CardTitle>
        <CardDescription>
          The policy decides the Elev8 Cover tier, what the guest pays and the terms. Stays of
          {{ LONG_STAY_THRESHOLD_NIGHTS }} nights or more can use a different one.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="view.slots.custom" class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          This listing uses custom night ranges.
          <Button size="sm" variant="outline" class="h-7 text-xs" @click="resetCustom">
            Switch to short and long stays
          </Button>
        </div>
        <div v-else class="grid gap-4 sm:grid-cols-2">
          <div v-for="{ slot, label } in SLOTS" :key="slot" class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">{{ label }}</Label>
            <Select :model-value="view.slots[slot] ?? NONE" @update:model-value="(v) => setSlot(slot, v)">
              <SelectTrigger class="w-full" :data-testid="`protection-slot-${slot}`">
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
                  :disabled="currencyBlocked(policy, view.currency) || hostBlocked(policy, view.mode)"
                >
                  {{ policy.name }}
                  <span v-if="currencyBlocked(policy, view.currency)" class="text-muted-foreground">
                    ({{ policy.currency }}, payouts are {{ view.currency }})
                  </span>
                  <span v-else-if="hostBlocked(policy, view.mode)" class="text-muted-foreground">
                    (no waiver for you to pay for)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- What needs fixing before guests see anything. -->
        <p v-if="view.undersized" class="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400" data-testid="protection-undersized">
          <Icon name="lucide:alert-triangle" class="mt-0.5 size-3.5 shrink-0" />
          {{ view.undersized }}
        </p>
        <p v-if="view.mode === 'guest_paid' && view.paused" class="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <Icon name="lucide:pause-circle" class="mt-0.5 size-3.5 shrink-0" />
          Guests are not asked yet: the waiver is not activated.
        </p>

        <!-- What the assigned policies offer, in plain words. -->
        <div
          v-for="policy in view.policies"
          :key="policy.id"
          class="flex flex-col gap-3 rounded-lg border p-4"
          data-testid="protection-policy"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium">
                {{ policy.name }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ policy.currency }} · terms {{ policy.termsVersion }}
                <template v-if="policyUsage(dp, policy.id).total > 1">
                  · also used on {{ policyUsage(dp, policy.id).total - 1 }} other
                  {{ policyUsage(dp, policy.id).total - 1 === 1 ? 'listing' : 'listings' }}
                </template>
              </p>
            </div>
            <Button size="sm" variant="outline" @click="openEditor(policy)">
              Edit policy
            </Button>
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
                {{ policy.offers.includes('waiver') ? waiverSummary(policy) : 'not offered' }}
              </span>
            </li>
            <li class="flex items-start gap-2">
              <Icon
                :name="depositOffered(policy) ? 'lucide:credit-card' : 'lucide:minus'"
                class="mt-0.5 size-4 shrink-0"
                :class="depositOffered(policy) ? 'text-foreground' : 'text-muted-foreground'"
              />
              <span :class="depositOffered(policy) ? '' : 'text-muted-foreground'">
                <span class="font-medium">Deposit:</span>
                {{ depositText(policy) }}
              </span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>

    <!-- The stays this listing's protection covers -->
    <Card data-testid="protection-stays">
      <CardHeader class="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Protected stays</CardTitle>
          <CardDescription>Each stay keeps the protection it was booked under, even if the policy changes later.</CardDescription>
        </div>
        <NuxtLink to="/damage-protection" class="shrink-0">
          <Button variant="outline" size="sm">
            Open worklist
          </Button>
        </NuxtLink>
      </CardHeader>
      <CardContent>
        <p v-if="!stays.length" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No protected stays on this listing yet.
        </p>
        <div v-else class="rounded-md border">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left font-medium">
                    Guest
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Stay
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Protection
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    Amount
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    Status
                  </th>
                  <th class="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in pagedStays" :key="row.reservation.id" class="border-t" data-testid="protection-stay">
                  <td class="px-4 py-3">
                    <p class="font-medium">
                      {{ row.reservation.guestName }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ row.reservation.channel }}
                    </p>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    {{ fmtDate(row.reservation.checkIn) }} to {{ fmtDate(row.reservation.checkOut) }}
                    <p class="text-xs text-muted-foreground">
                      {{ row.reservation.nights }} {{ row.reservation.nights === 1 ? 'night' : 'nights' }}
                    </p>
                  </td>
                  <td class="px-4 py-3">
                    {{ optionLabel(row) }}
                    <p v-if="claimCount(row)" class="text-xs text-muted-foreground">
                      {{ claimCount(row) }} {{ claimCount(row) === 1 ? 'claim' : 'claims' }}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {{ amountLabel(row) }}
                  </td>
                  <td class="px-4 py-3">
                    <DamageProtectionStatusChip :bucket="row.bucket" :option="row.protection?.option" />
                  </td>
                  <td class="px-4 py-3 text-right">
                    <NuxtLink :to="`/reservations?reservation=${row.reservation.id}`">
                      <Button size="sm" variant="ghost" class="h-7 text-xs">
                        Open
                      </Button>
                    </NuxtLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="stays.length" class="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-2" data-testid="protection-stays-pagination">
          <div class="text-sm text-muted-foreground">
            {{ stays.length }} {{ stays.length === 1 ? 'stay' : 'stays' }}
          </div>
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium">
                Rows per page
              </p>
              <Select :model-value="`${pageSize}`" @update:model-value="setPageSize">
                <SelectTrigger class="h-8 w-[70px]" data-testid="protection-stays-page-size">
                  <SelectValue :placeholder="`${pageSize}`" />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectItem v-for="size in PAGE_SIZES" :key="size" :value="`${size}`">
                    {{ size }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="text-sm font-medium" data-testid="protection-stays-page">
              Page {{ currentPage }} of {{ totalPages }}
            </div>
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                class="hidden h-8 w-8 p-0 lg:flex"
                aria-label="First page"
                :disabled="currentPage <= 1"
                @click="currentPage = 1"
              >
                <Icon name="lucide:chevrons-left" class="size-4" />
              </Button>
              <Button
                variant="outline"
                class="h-8 w-8 p-0"
                aria-label="Previous page"
                :disabled="currentPage <= 1"
                @click="currentPage = currentPage - 1"
              >
                <Icon name="lucide:chevron-left" class="size-4" />
              </Button>
              <Button
                variant="outline"
                class="h-8 w-8 p-0"
                aria-label="Next page"
                :disabled="currentPage >= totalPages"
                @click="currentPage = currentPage + 1"
              >
                <Icon name="lucide:chevron-right" class="size-4" />
              </Button>
              <Button
                variant="outline"
                class="hidden h-8 w-8 p-0 lg:flex"
                aria-label="Last page"
                :disabled="currentPage >= totalPages"
                @click="currentPage = totalPages"
              >
                <Icon name="lucide:chevrons-right" class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <TernPromoDialog
      v-model:open="promoOpen"
      :listing="listing"
      :currency="view.currency"
      :guest-price="ownGuestPrice"
      @activate="startActivation"
    />
    <TernActivationWizard v-model:open="wizardOpen" />

    <DamageProtectionPolicySheet
      v-model:open="sheetOpen"
      :policy="editing"
      :used-for-long-stays="editingUsage ? editingUsage.long > 0 : false"
      :guest-paid="editingUsage ? !editingUsage.hostOnly : true"
    />
  </div>
</template>
