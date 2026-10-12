<script setup lang="ts">
import type { BookingChannel } from '~/components/listings/data/listings'
import type { ProtectionPayer } from '~/components/reservations/data/reservations'
import type { TernTier } from '~/components/reservations/data/tern-products'
import { toast } from 'vue-sonner'
import CoverageBreakdown from '~/components/damage-protection/CoverageBreakdown.vue'
import {
  blockText,
  packageSummary,
  PROTECTION_MODE_LABELS,
  protectionRefusalText,
  undersizedText,
} from '~/components/damage-protection/data/listing-protection'
import { DEFAULT_HOST_FALLBACK_DAYS, depositChannelsOf, HOST_FALLBACK_DAY_OPTIONS } from '~/components/damage-protection/data/listing-protection-setup'
import PartnerPackageDialog from '~/components/damage-protection/PartnerPackageDialog.vue'
import TernActivationCard from '~/components/damage-protection/TernActivationCard.vue'
import { BOOKING_CHANNELS, listings } from '~/components/listings/data/listings'
import { PAYOUT_SETTINGS_PATH } from '~/components/reservations/data/tern-activation'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { ternPriceFor } from '~/components/reservations/data/tern-products'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useUpsellServices } from '~/composables/useUpsellServices'

/**
 * Damage protection, set ONCE for every listing (owner's decision, 2026-10-08).
 * The waiver is activated with Elev8 Cover (the card on top, whose wizard also
 * picks the package), then runs on every listing with one package. The deposit
 * comes with the waiver; on its own it can be offered without one.
 */
const props = withDefaults(defineProps<{
  /** The per-listing table, hidden for now (2026-10-12); the specs still mount it. */
  showListings?: boolean
}>(), { showListings: false })

const dp = useDamageProtection()
const { services } = useUpsellServices()

onMounted(() => dp.hydrate())

const settings = computed(() => dp.settings.value)
const pkg = computed(() => dp.currentPackage.value)
const waiverOn = computed(() => settings.value.waiver && pkg.value !== null)
const payer = computed<ProtectionPayer>(() => settings.value.payer)
const active = computed(() => dp.waiverServiceActive.value)

function apply(patch: Parameters<typeof dp.setProtectionSettings>[0], success?: string) {
  const result = dp.setProtectionSettings(patch)
  if (!result.ok)
    toast.error(protectionRefusalText(result.reason))
  else if (success)
    toast.success(success)
  return result.ok
}

// ------------------------------------------------------------ the waiver

/**
 * The waiver uses ONE upsell, edited with the partner's packages and a price
 * (`PartnerPackageDialog`), never the upsell form. A first package made here
 * while the service is active switches the waiver on; an edit leaves it as is.
 */
const packageDialogOpen = ref(false)
const packageDialogTurnOn = ref(false)

function openPackageForm(first: boolean) {
  packageDialogTurnOn.value = first && active.value
  packageDialogOpen.value = true
}

/** The upsell the waiver uses, to edit. Found even while paused, so it can be switched back on. */
const packageService = computed(() => services.value.find(s => s.id === settings.value.packageServiceId) ?? null)

function setWaiver(on: boolean) {
  if (!on) {
    apply({ waiver: false }, 'Damage waiver turned off on every listing. The deposit stays on.')
    return
  }
  const serviceId = pkg.value?.serviceId ?? dp.packages.value[0]?.serviceId
  if (!serviceId) {
    openPackageForm(true)
    return
  }
  apply({ waiver: true, packageServiceId: serviceId }, 'Damage waiver on for every listing, with the deposit beside it')
}

/** What Elev8 charges per package, from the tier. Null where Elev8 Cover is not priced in that currency. */
function elev8FeeFor(p: { tier: TernTier, currency: string }): number | null {
  return ternPriceFor(p.tier, p.currency)?.perStayFee ?? null
}

/** The package in one sentence: the tier, the guest price, the cover and Elev8's fee. */
const packageLine = computed(() => {
  if (!pkg.value)
    return ''
  const fee = elev8FeeFor(pkg.value)
  const feeText = fee ? `, Elev8 charges you ${formatProtectionAmount(fee, pkg.value.currency)}` : ''
  return `${packageSummary(pkg.value)}${feeText}, per 30 nights of a stay.`
})

const coverageOpen = ref(false)

// --------------------------------------------------------------- who pays

const PAYER_META: Record<ProtectionPayer, { mode: 'guest_paid' | 'host_paid', icon: string, text: string }> = {
  guest: { mode: 'guest_paid', icon: 'lucide:user-round', text: 'The guest buys the damage waiver, or leaves a card on file, in the guest guide.' },
  host: { mode: 'host_paid', icon: 'lucide:building-2', text: 'The guest is not asked. Elev8 charges you the Elev8 Cover fee.' },
}
const PAYERS: ProtectionPayer[] = ['guest', 'host']

function payerBlocked(value: ProtectionPayer): string | null {
  if (value !== 'host')
    return null
  if (!active.value)
    return 'Activate the damage waiver first.'
  if (!waiverOn.value)
    return 'Turn on the damage waiver first.'
  return null
}

function setPayer(value: ProtectionPayer) {
  if (value === payer.value || payerBlocked(value))
    return
  const result = dp.setProtectionPayer(value)
  if (!result.ok)
    toast.error(protectionRefusalText(result.reason))
  else if (value === 'host')
    toast.success('Covered by you: guests are not asked, and Elev8 charges you the cover fee.')
  else
    toast.success('Guests now choose their protection')
}

const fallbackBlocked = computed<string | null>(() => {
  if (!waiverOn.value)
    return 'Turn on the damage waiver first: the host cover is the same package.'
  if (!active.value)
    return 'Activate the damage waiver first.'
  return null
})

function setHostFallback(on: boolean) {
  apply({ hostFallback: on }, on
    ? 'Stays without a waiver or deposit by the cut-off will be covered by you'
    : 'Automatic host cover turned off')
}

function setHostFallbackDays(value: unknown) {
  const days = Number(value)
  if (Number.isFinite(days) && days > 0)
    apply({ hostFallbackDays: days })
}

// ------------------------------------------------------------- the deposit

function setDeposit(on: boolean) {
  apply({ deposit: on }, on ? 'Deposit offered on every Stripe listing' : 'Deposit turned off')
}

// Edited locally and saved on blur, so a half-typed value never reaches the settings.
const limitDraft = ref(0)
const daysDraft = ref(0)
watch(settings, (s) => {
  limitDraft.value = s.depositLimit
  daysDraft.value = s.settleWithinDays
}, { immediate: true })

function saveDepositNumbers() {
  if (limitDraft.value === settings.value.depositLimit && daysDraft.value === settings.value.settleWithinDays)
    return
  if (!apply({ depositLimit: Number(limitDraft.value), settleWithinDays: Number(daysDraft.value) }, 'Deposit updated')) {
    limitDraft.value = settings.value.depositLimit
    daysDraft.value = settings.value.settleWithinDays
  }
}

/** With the waiver on, every channel is covered and the deposit rides along: the chips show on and locked. */
function channelOn(channel: BookingChannel): boolean {
  return waiverOn.value || depositChannelsOf(settings.value).includes(channel)
}

function toggleChannel(channel: BookingChannel) {
  if (waiverOn.value)
    return
  const current = depositChannelsOf(settings.value)
  const next = current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel]
  apply({ depositChannels: BOOKING_CHANNELS.filter(c => next.includes(c)) })
}

// ------------------------------------------------------- per listing

const NO_PAYOUT = 'No payout account'

function providerLabel(provider: string): string {
  return provider === 'stripe' ? 'Stripe' : provider.toUpperCase()
}

/** What each listing ends up offering under these settings. Only the deposit amount is set per listing. */
const listingRows = computed(() => listings.value.map((listing) => {
  const state = dp.listingProtection(listing.id)
  const account = dp.payoutAccountFor(listing.id)
  const takesCard = dp.railForListing(listing.id) === 'card'
  const offers = state.policy?.offers ?? []
  const waiver = offers.includes('waiver')
  const deposit = offers.includes('deposit') && takesCard
  let offered: string
  if (!state.policy)
    offered = 'Not covered'
  else if (payer.value === 'host' && waiver)
    offered = 'Waiver, host pays'
  else if (waiver && deposit)
    offered = 'Waiver or deposit'
  else if (waiver)
    offered = 'Waiver only'
  else if (deposit)
    offered = 'Deposit only'
  else
    offered = 'Not covered'
  const currency = state.policy?.currency ?? account?.currency ?? null
  const custom = settings.value.depositOverrides?.[listing.id]
  return {
    id: listing.id,
    name: listing.name,
    /** A card limit only where a guest can leave a card: the deposit is offered and the listing settles on Stripe. */
    depositShown: deposit && payer.value === 'guest' && currency !== null,
    depositCurrency: currency ?? '',
    depositAmount: custom ?? settings.value.depositLimit,
    depositCustom: custom !== undefined,
    payout: account ? `${account.currency}, ${providerLabel(account.provider)}` : NO_PAYOUT,
    hasPayout: account !== null,
    offered,
    covered: offered !== 'Not covered',
    note: state.block
      ? blockText(state.block, pkg.value, state.currency)
      : [
          state.convertTo && account && pkg.value && waiver
            ? `The guest pays ${formatProtectionAmount(pkg.value.guestPrice, pkg.value.currency)}, converted to ${state.convertTo} by ${providerLabel(account.provider)} at payment.`
            : null,
          waiver && !takesCard && settings.value.deposit && payer.value === 'guest'
            ? (account ? 'Not paid out with Stripe, so no deposit card here.' : 'No payout account, so no deposit card here.')
            : null,
          waiver ? undersizedText(pkg.value, listing.capacity) : null,
        ].filter(Boolean).join(' ') || null,
  }
}))
// One row's deposit is edited in place; Enter or Save writes it, Escape cancels.
const editingDepositId = ref<string | null>(null)
const depositDraft = ref(0)

function editDeposit(row: { id: string, depositAmount: number }) {
  editingDepositId.value = row.id
  depositDraft.value = row.depositAmount
}

function saveDeposit(row: { id: string, name: string, depositCurrency: string }) {
  const amount = Number(depositDraft.value)
  // The default typed in: keep the listing on the default rather than pinning a copy of it.
  const result = dp.setDepositOverride(row.id, amount === settings.value.depositLimit ? null : amount)
  if (!result.ok) {
    toast.error(protectionRefusalText(result.reason))
    return
  }
  editingDepositId.value = null
  toast.success(`${row.name}: card charged up to ${formatProtectionAmount(amount, row.depositCurrency)}`)
}

function resetDeposit(row: { id: string, name: string }) {
  dp.setDepositOverride(row.id, null)
  toast.success(`${row.name} uses the default deposit again`)
}

const coveredCount = computed(() => listingRows.value.filter(r => r.covered).length)

/**
 * Listings no payout account is assigned to. The waiver still runs on them, but
 * what the guest pays has no account to land in and no deposit card can be kept.
 */
const unassignedRows = computed(() => listingRows.value.filter(r => !r.hasPayout))
const unassignedNames = computed(() => {
  const names = unassignedRows.value.map(r => r.name)
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')
})

/** Narrow the table to the unassigned listings: the search matches the payout column. */
function showUnassigned() {
  listingSearch.value = NO_PAYOUT
}

// Search by name or payout, then page. A new search starts on page 1; a shrinking list never strands you past the end.
const listingSearch = ref('')
const PAGE_SIZES = [10, 20, 30, 50]
const pageSize = ref(10)
const currentPage = ref(1)

const searchedRows = computed(() => {
  const query = listingSearch.value.trim().toLowerCase()
  if (!query)
    return listingRows.value
  return listingRows.value.filter(row => row.name.toLowerCase().includes(query) || row.payout.toLowerCase().includes(query))
})
const totalPages = computed(() => Math.max(1, Math.ceil(searchedRows.value.length / pageSize.value)))
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return searchedRows.value.slice(start, start + pageSize.value)
})

watch(listingSearch, () => { currentPage.value = 1 })
watch(totalPages, (total) => {
  if (currentPage.value > total)
    currentPage.value = total
})

function setPageSize(value: unknown) {
  pageSize.value = Number(value)
  currentPage.value = 1
}
const depositCurrency = computed(() => pkg.value?.currency ?? dp.payoutAccountFor(listings.value[0]?.id ?? '')?.currency ?? 'USD')
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="damage-protection-settings">
    <div>
      <h2 class="text-lg font-semibold">
        Damage protection
      </h2>
      <p class="text-sm text-muted-foreground">
        Set once for every listing. Guests choose the damage waiver or a deposit before arrival, or you pay for the
        waiver and they are not asked. Owner stays are never included.
      </p>
    </div>

    <TernActivationCard />

    <Alert v-if="unassignedRows.length" variant="destructive" data-testid="protection-unassigned-payout">
      <Icon name="lucide:alert-circle" class="size-4" />
      <AlertTitle>
        {{ unassignedRows.length }} {{ unassignedRows.length === 1 ? 'listing is' : 'listings are' }} not assigned to a payout account
      </AlertTitle>
      <AlertDescription>
        <p>
          {{ unassignedNames }}. What guests pay for the damage waiver has no account to land in, and no deposit card
          can be kept. Assign them to a payout account.
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" class="h-7 text-xs" as-child>
            <NuxtLink :to="PAYOUT_SETTINGS_PATH" data-testid="protection-unassigned-assign">
              <Icon name="lucide:landmark" class="mr-1 size-3.5" />
              Assign in Payouts
            </NuxtLink>
          </Button>
          <Button v-if="props.showListings" size="sm" variant="ghost" class="h-7 text-xs" data-testid="protection-unassigned-show" @click="showUnassigned">
            Show {{ unassignedRows.length === 1 ? 'it' : 'them' }} below
          </Button>
        </div>
      </AlertDescription>
    </Alert>

    <!-- Damage waiver -->
    <Card data-testid="protection-waiver">
      <CardHeader class="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle class="flex items-center gap-2">
            <Icon name="lucide:shield-check" class="size-4" />
            Damage waiver
          </CardTitle>
          <CardDescription>
            A non-refundable fee. Accidental damage is covered by Elev8 Cover up to the package's limit. On for every
            listing, and it brings the deposit with it.
          </CardDescription>
        </div>
        <Switch
          :model-value="settings.waiver"
          :disabled="!active && !settings.waiver"
          aria-label="Offer the damage waiver on every listing"
          data-testid="protection-waiver-switch"
          @update:model-value="(v: boolean) => setWaiver(v)"
        />
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <p v-if="!active" class="flex items-start gap-1.5 text-sm text-muted-foreground" data-testid="protection-waiver-inactive">
          <Icon name="lucide:pause-circle" class="mt-0.5 size-4 shrink-0 text-amber-600" />
          {{ settings.waiver
            ? 'Paused: guests are not asked until the damage waiver is activated again.'
            : 'Activate the damage waiver above: you choose its package as part of it.' }}
        </p>

        <template v-if="settings.waiver || active">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Package, every listing</Label>
            <!-- One upsell, no picker: it is changed by editing it. -->
            <div v-if="packageService" class="flex items-center gap-2">
              <div class="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm" data-testid="protection-package">
                <span class="truncate font-medium">{{ packageService.name }}</span>
                <span v-if="pkg" class="truncate text-muted-foreground">
                  · guest pays {{ formatProtectionAmount(pkg.guestPrice, pkg.currency) }}
                </span>
                <Badge v-else variant="outline" class="shrink-0">
                  Paused
                </Badge>
              </div>
              <Button variant="outline" class="shrink-0" data-testid="protection-edit-package" @click="openPackageForm(false)">
                <Icon name="lucide:pencil" class="mr-1 size-4" />
                Edit package
              </Button>
            </div>
            <div v-else class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="protection-no-packages">
              There is no package yet. Choose one of the partner's packages and set its price.
              <Button size="sm" variant="outline" class="h-7 text-xs" data-testid="protection-new-package" @click="openPackageForm(true)">
                <Icon name="lucide:plus" class="mr-1 size-3.5" />
                Choose a package
              </Button>
            </div>
            <p v-if="settings.waiver && packageService && !pkg" class="text-xs text-amber-700 dark:text-amber-400" data-testid="protection-package-missing">
              The package is paused, so no guest is offered the waiver. Save it again with Edit package to switch it back on.
            </p>
            <p v-if="pkg" class="text-xs text-muted-foreground" data-testid="protection-package-summary">
              {{ packageLine }}
            </p>
            <Button
              v-if="pkg"
              variant="ghost"
              size="sm"
              class="h-7 w-fit px-2 text-xs"
              :aria-expanded="coverageOpen"
              data-testid="protection-coverage-toggle"
              @click="coverageOpen = !coverageOpen"
            >
              <Icon :name="coverageOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="mr-1 size-3.5" />
              What's covered
            </Button>
            <CoverageBreakdown v-if="coverageOpen && pkg" :tier="pkg.tier" :currency="pkg.currency" />
          </div>

          <!-- Who pays: the waiver is what the host can buy on the guest's behalf. -->
          <div class="flex flex-col gap-2 border-t pt-4" data-testid="protection-payer">
            <p class="text-sm font-medium">
              Who pays
            </p>
            <div class="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Who pays for damage protection">
              <button
                v-for="value in PAYERS"
                :key="value"
                type="button"
                role="radio"
                :aria-checked="payer === value"
                :disabled="Boolean(payerBlocked(value))"
                class="flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                :class="payer === value ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/60'"
                :data-testid="`protection-mode-${PAYER_META[value].mode}`"
                @click="setPayer(value)"
              >
                <span class="flex items-center gap-2 text-sm font-medium">
                  <Icon :name="PAYER_META[value].icon" class="size-4" />
                  {{ PROTECTION_MODE_LABELS[PAYER_META[value].mode] }}
                  <Icon v-if="payer === value" name="lucide:check" class="ml-auto size-4 text-primary" />
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ payerBlocked(value) ?? PAYER_META[value].text }}
                </span>
              </button>
            </div>

            <!-- Guest pays, with the host as the safety net. -->
            <div v-if="payer === 'guest'" class="mt-2 flex flex-col gap-3 rounded-lg border p-4" data-testid="protection-host-fallback">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-medium">
                    Auto-activate host-paid protection if the guest doesn't buy the upsell
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ fallbackBlocked ?? 'A stay with no waiver and no deposit card by then is covered by you, and Elev8 charges you the cover fee for it. The guest is no longer asked.' }}
                  </p>
                </div>
                <Switch
                  :model-value="Boolean(settings.hostFallback) && !fallbackBlocked"
                  :disabled="Boolean(fallbackBlocked)"
                  aria-label="Auto-activate host-paid protection"
                  data-testid="protection-host-fallback-switch"
                  @update:model-value="(v: boolean) => setHostFallback(v)"
                />
              </div>
              <div v-if="settings.hostFallback && !fallbackBlocked" class="flex flex-wrap items-center gap-2 text-sm">
                <span>Activate protection</span>
                <Select :model-value="String(settings.hostFallbackDays ?? DEFAULT_HOST_FALLBACK_DAYS)" @update:model-value="setHostFallbackDays">
                  <SelectTrigger class="h-8 w-28" data-testid="protection-host-fallback-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="days in HOST_FALLBACK_DAY_OPTIONS" :key="days" :value="String(days)">
                      {{ days }} {{ days === 1 ? 'day' : 'days' }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span>before check-in</span>
              </div>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- Deposit -->
    <Card data-testid="protection-deposit">
      <CardHeader class="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle class="flex items-center gap-2">
            <Icon name="lucide:credit-card" class="size-4" />
            Deposit
          </CardTitle>
          <CardDescription>
            <template v-if="settings.waiver">
              On with the damage waiver: the guest chooses one of the two. A card kept on file, charged only for damage
              after check-out. Listings paid out with Stripe only.
            </template>
            <template v-else>
              A card kept on file, charged only for damage after check-out. Nothing is charged at booking. Listings paid
              out with Stripe only.
            </template>
          </CardDescription>
        </div>
        <Switch
          :model-value="settings.deposit"
          :disabled="settings.waiver"
          :aria-label="settings.waiver ? 'Deposit, on with the damage waiver' : 'Offer the deposit'"
          data-testid="protection-deposit-switch"
          @update:model-value="(v: boolean) => setDeposit(v)"
        />
      </CardHeader>
      <CardContent v-if="settings.deposit" class="flex flex-col gap-4">
        <p v-if="payer === 'host'" class="text-xs text-muted-foreground">
          Not asked while you pay for the cover.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground" for="protection-deposit-limit">Card charged up to (default)</Label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                {{ depositCurrency }}
              </span>
              <Input
                id="protection-deposit-limit"
                v-model.number="limitDraft"
                type="number"
                min="1"
                class="pl-14"
                data-testid="protection-deposit-limit"
                @blur="saveDepositNumbers"
                @keydown.enter="saveDepositNumbers"
              />
            </div>
            <p class="text-xs text-muted-foreground">
              In each listing's own payout currency, nothing converted. Set a different amount for a property in
              the Listings table below.
            </p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground" for="protection-deposit-days">Decide within (days after check-out)</Label>
            <Input
              id="protection-deposit-days"
              v-model.number="daysDraft"
              type="number"
              min="1"
              data-testid="protection-deposit-days"
              @blur="saveDepositNumbers"
              @keydown.enter="saveDepositNumbers"
            />
          </div>
        </div>
        <div class="flex flex-col gap-1.5" data-testid="protection-deposit-channels">
          <Label class="text-xs text-muted-foreground">Booking channels</Label>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="channel in BOOKING_CHANNELS"
              :key="channel"
              role="checkbox"
              :aria-checked="channelOn(channel)"
              :aria-disabled="waiverOn"
              class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              :class="waiverOn ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/50'"
              :data-testid="`protection-deposit-channel-${channel}`"
              @click="toggleChannel(channel)"
            >
              <div
                class="flex size-4 items-center justify-center rounded-[4px] border"
                :class="channelOn(channel) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="channelOn(channel)" name="lucide:check" class="size-3" />
              </div>
              {{ channel }}
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ waiverOn
              ? 'With the damage waiver on, guests on every channel are asked, and the deposit is offered beside it.'
              : 'On its own, the deposit is asked only on the channels ticked here.' }}
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Listings: what each one offers, and its deposit -->
    <Card v-if="props.showListings" data-testid="protection-listings">
      <CardHeader>
        <CardTitle>Listings</CardTitle>
        <CardDescription>
          {{ coveredCount }} of {{ listingRows.length }} listings covered. What guests on each listing are offered under
          the settings above, and each listing's deposit: the default, or its own amount in its payout currency. On DOKU
          or Xendit, a package in another currency is converted into the payout currency by the gateway at payment; a
          Stripe listing paid out in another currency than the package is not covered.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div class="relative w-full sm:max-w-xs">
          <Icon name="lucide:search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="listingSearch"
            placeholder="Search listings"
            class="pl-9"
            aria-label="Search listings"
            data-testid="protection-listing-search"
          />
        </div>
        <div class="overflow-x-auto rounded-md border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th class="px-4 py-3 text-left font-medium">
                  Listing
                </th>
                <th class="px-4 py-3 text-left font-medium">
                  Paid out
                </th>
                <th class="px-4 py-3 text-left font-medium">
                  Guests are offered
                </th>
                <th class="px-4 py-3 text-left font-medium">
                  Deposit
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!pagedRows.length" class="border-t">
                <td colspan="4" class="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="protection-listing-empty">
                  No listings match "{{ listingSearch }}".
                </td>
              </tr>
              <tr v-for="row in pagedRows" :key="row.id" class="border-t" data-testid="protection-listing-row">
                <td class="px-4 py-3 font-medium">
                  {{ row.name }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {{ row.payout }}
                </td>
                <td class="px-4 py-3">
                  <span :class="row.covered ? '' : 'text-muted-foreground'">{{ row.offered }}</span>
                  <p v-if="row.note" class="text-xs text-muted-foreground">
                    {{ row.note }}
                  </p>
                </td>
                <td class="px-4 py-3" :data-testid="`protection-deposit-${row.id}`">
                  <span v-if="!row.depositShown" class="text-xs text-muted-foreground">No deposit</span>
                  <div v-else-if="editingDepositId === row.id" class="flex items-center gap-1">
                    <div class="relative w-40">
                      <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                        {{ row.depositCurrency }}
                      </span>
                      <Input
                        v-model.number="depositDraft"
                        type="number"
                        min="1"
                        class="h-8 pl-14"
                        :aria-label="`Deposit for ${row.name}`"
                        data-testid="protection-deposit-input"
                        @keydown.enter="saveDeposit(row)"
                        @keydown.esc="editingDepositId = null"
                      />
                    </div>
                    <Button size="icon" variant="ghost" class="size-8" aria-label="Save deposit" data-testid="protection-deposit-save" @click="saveDeposit(row)">
                      <Icon name="lucide:check" class="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" class="size-8" aria-label="Cancel" @click="editingDepositId = null">
                      <Icon name="lucide:x" class="size-4" />
                    </Button>
                  </div>
                  <div v-else class="flex items-center gap-1 whitespace-nowrap">
                    <span :class="row.depositCustom ? 'font-medium' : ''">
                      {{ formatProtectionAmount(row.depositAmount, row.depositCurrency) }}
                    </span>
                    <span class="text-xs text-muted-foreground">{{ row.depositCustom ? 'Custom' : 'Default' }}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-7"
                      :aria-label="`Change the deposit for ${row.name}`"
                      data-testid="protection-deposit-edit"
                      @click="editDeposit(row)"
                    >
                      <Icon name="lucide:pencil" class="size-3.5" />
                    </Button>
                    <Button
                      v-if="row.depositCustom"
                      variant="link"
                      size="sm"
                      class="h-auto p-0 text-xs"
                      data-testid="protection-deposit-reset"
                      @click="resetDeposit(row)"
                    >
                      Reset
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-2" data-testid="protection-listing-pagination">
          <div class="text-sm text-muted-foreground">
            {{ searchedRows.length }} {{ searchedRows.length === 1 ? 'listing' : 'listings' }}
          </div>
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium">
                Rows per page
              </p>
              <Select :model-value="`${pageSize}`" @update:model-value="setPageSize">
                <SelectTrigger class="h-8 w-[70px]" data-testid="protection-listing-page-size">
                  <SelectValue :placeholder="`${pageSize}`" />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectItem v-for="size in PAGE_SIZES" :key="size" :value="`${size}`">
                    {{ size }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="text-sm font-medium" data-testid="protection-listing-page">
              Page {{ currentPage }} of {{ totalPages }}
            </div>
            <div class="flex items-center gap-2">
              <Button variant="outline" class="hidden size-8 p-0 lg:flex" aria-label="First page" :disabled="currentPage <= 1" @click="currentPage = 1">
                <Icon name="lucide:chevrons-left" class="size-4" />
              </Button>
              <Button variant="outline" class="size-8 p-0" aria-label="Previous page" :disabled="currentPage <= 1" data-testid="protection-listing-prev" @click="currentPage = currentPage - 1">
                <Icon name="lucide:chevron-left" class="size-4" />
              </Button>
              <Button variant="outline" class="size-8 p-0" aria-label="Next page" :disabled="currentPage >= totalPages" data-testid="protection-listing-next" @click="currentPage = currentPage + 1">
                <Icon name="lucide:chevron-right" class="size-4" />
              </Button>
              <Button variant="outline" class="hidden size-8 p-0 lg:flex" aria-label="Last page" :disabled="currentPage >= totalPages" @click="currentPage = totalPages">
                <Icon name="lucide:chevrons-right" class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <PartnerPackageDialog v-model:open="packageDialogOpen" :turn-on="packageDialogTurnOn" />
  </div>
</template>
