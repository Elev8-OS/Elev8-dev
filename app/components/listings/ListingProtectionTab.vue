<script setup lang="ts">
import type { BookingChannel, Listing } from '~/components/listings/data/listings'
import type { ProtectionPayer } from '~/components/reservations/data/reservations'
import type { TernTier } from '~/components/reservations/data/tern-products'
import type { UpsellService } from '~/components/upsells/data/upsell-services'
import type { ProtectionRow } from '~/composables/useDamageProtection'
import { toast } from 'vue-sonner'
import DamageProtectionStatusChip from '~/components/damage-protection/DamageProtectionStatusChip.vue'
import {
  blockText,
  depositSummary,
  packageSummary,
  PROTECTION_MODE_LABELS,
  protectionRefusalText,
  undersizedText,
  waiverSummary,
} from '~/components/damage-protection/data/listing-protection'
import { depositChannelsOf, moveListingUpdates } from '~/components/damage-protection/data/listing-protection-setup'
import TernActivationWizard from '~/components/damage-protection/TernActivationWizard.vue'
import TernPromoDialog from '~/components/damage-protection/TernPromoDialog.vue'
import { BOOKING_CHANNELS } from '~/components/listings/data/listings'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { PAYOUT_SETTINGS_PATH } from '~/components/reservations/data/tern-activation'
import { ternPriceFor } from '~/components/reservations/data/tern-products'
import { PROTECTION_CATEGORY } from '~/components/upsells/data/upsell-services'
import UpsellDrawer from '~/components/upsells/UpsellDrawer.vue'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useTernActivation } from '~/composables/useTernActivation'
import { useUpsellServices } from '~/composables/useUpsellServices'

/**
 * One listing's damage protection (owner's decision, 2026-10-06: per listing,
 * no shared policies). It is ON when the listing is assigned to an active
 * Damage Protection upsell; here the host switches the waiver and the deposit
 * on or off, picks the package the upsell sells, and says who pays.
 */
const props = defineProps<{ listing: Listing }>()

const dp = useDamageProtection()
const { services, updateService } = useUpsellServices()

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

const state = computed(() => dp.listingProtection(props.listing.id))
const setup = computed(() => state.value.setup)
const mode = computed(() => dp.listingMode(props.listing.id))
const payer = computed<ProtectionPayer>(() => dp.payerFor(props.listing.id))
/** The waiver runs only where a protection upsell sells its package. */
const protectedByUpsell = computed(() => state.value.services.length > 0)
/** A deposit needs no upsell: switching it on protects the listing on its own. */
const isOn = computed(() => protectedByUpsell.value || setup.value.deposit)
/** The package this listing is in: the one its protection upsell sells. */
const shownPackage = computed(() => state.value.assignedPackage)
/** On only while an upsell assigns the listing: that upsell IS its package. */
const waiverOn = computed(() => protectedByUpsell.value && setup.value.waiver)
const hasPackages = computed(() => state.value.packages.length > 0)

/** The pitch starts from the price this listing already charges for the waiver, if it has one. */
const ownGuestPrice = computed(() => (shownPackage.value ?? state.value.packages[0])?.guestPrice ?? null)
const account = computed(() => dp.payoutAccountFor(props.listing.id))
const takesDeposit = computed(() => dp.railForListing(props.listing.id) === 'card')
const paused = computed(() => dp.pausedUntilActivation(state.value.policy))
const undersized = computed(() => waiverOn.value ? undersizedText(shownPackage.value, props.listing.capacity) : null)

function apply(patch: Parameters<typeof dp.setListingSetup>[1], success?: string) {
  const result = dp.setListingSetup(props.listing.id, patch)
  if (!result.ok)
    toast.error(protectionRefusalText(result.reason))
  else if (success)
    toast.success(success)
  return result.ok
}

function setDeposit(on: boolean) {
  apply({ deposit: on }, on ? 'Deposit offered on this listing' : 'Deposit turned off for this listing')
}

// The deposit's two numbers are edited locally and saved on blur, so a
// half-typed value never reaches the setup.
const limitDraft = ref(0)
const daysDraft = ref(0)
watch(setup, (s) => {
  limitDraft.value = s.depositLimit
  daysDraft.value = s.settleWithinDays
}, { immediate: true })

function saveDepositNumbers() {
  if (limitDraft.value === setup.value.depositLimit && daysDraft.value === setup.value.settleWithinDays)
    return
  if (!apply({ depositLimit: Number(limitDraft.value), settleWithinDays: Number(daysDraft.value) }, 'Deposit updated')) {
    limitDraft.value = setup.value.depositLimit
    daysDraft.value = setup.value.settleWithinDays
  }
}

/**
 * Where a deposit on its own is asked. With the waiver on, every channel is
 * covered and the deposit rides along, so the rows show on and locked.
 */
function channelOn(channel: BookingChannel): boolean {
  return waiverOn.value || depositChannelsOf(setup.value).includes(channel)
}

function toggleChannel(channel: BookingChannel) {
  if (waiverOn.value)
    return
  const current = depositChannelsOf(setup.value)
  const next = current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel]
  apply({ depositChannels: BOOKING_CHANNELS.filter(c => next.includes(c)) })
}

const PAYER_META: Record<ProtectionPayer, { mode: 'guest_paid' | 'host_paid', icon: string, text: string }> = {
  guest: { mode: 'guest_paid', icon: 'lucide:user-round', text: 'The guest buys the damage waiver, or leaves a card on file, in the guest guide.' },
  host: { mode: 'host_paid', icon: 'lucide:building-2', text: 'The guest is not asked. Elev8 charges you the Elev8 Cover fee.' },
}
const PAYERS: ProtectionPayer[] = ['guest', 'host']

/** Host-paid cover is Tern's: it needs the service activated and the waiver on. */
function payerBlocked(value: ProtectionPayer): string | null {
  if (value !== 'host')
    return null
  if (!dp.waiverServiceActive.value)
    return 'Activate the damage waiver first.'
  if (!setup.value.waiver || !protectedByUpsell.value)
    return 'Turn on the damage waiver first.'
  return null
}

function setPayer(value: ProtectionPayer) {
  if (value === payer.value || payerBlocked(value))
    return
  const result = dp.setListingPayer(props.listing.id, value)
  if (!result.ok)
    toast.error(protectionRefusalText(result.reason))
  else if (value === 'host')
    toast.success('Covered by you: guests on this listing are not asked, and Elev8 charges you the cover fee.')
  else
    toast.success('Guests on this listing now choose their protection')
}

// ------------------------------------------- the package, from the upsells

/**
 * Each Damage Protection upsell sells ONE package, so the listing's package is
 * the upsell it sits in. The waiver switch puts it in one (its last package, or
 * the first on offer) or takes it out; picking another package moves it there.
 */
function moveTo(serviceId: string | null) {
  for (const { id, ...patch } of moveListingUpdates(services.value, props.listing, serviceId))
    updateService(id, patch)
  dp.syncHostCover()
}

function setWaiverOn(on: boolean) {
  if (on) {
    const pkg = shownPackage.value ?? state.value.packages[0]
    if (!pkg)
      return
    if (!setup.value.waiver && !apply({ waiver: true }))
      return
    moveTo(pkg.serviceId)
    toast.success(`Damage waiver offered on this listing: ${pkg.serviceName}`)
    return
  }
  if (payer.value === 'host') {
    toast.error(protectionRefusalText('host_needs_waiver'))
    return
  }
  moveTo(null)
  toast.success('Damage waiver turned off for this listing')
}

/** What Elev8 charges per package, from the tier. Null where Elev8 Cover is not priced in that currency. */
function elev8FeeFor(pkg: { tier: TernTier, currency: string }): number | null {
  return ternPriceFor(pkg.tier, pkg.currency)?.perStayFee ?? null
}

/**
 * Switching the waiver ON shows the Elev8 Cover benefits first (the same pitch
 * the tab opens before activation). Its button turns the waiver on here, and
 * starts the activation wizard too when the service is not active yet.
 * "Not now" leaves the switch off. Switching OFF needs no pitch.
 */
const waiverPending = ref(false)

function onWaiverSwitch(on: boolean) {
  if (!on) {
    setWaiverOn(false)
    return
  }
  waiverPending.value = true
  promoOpen.value = true
}

function onPromoAction() {
  if (!waiverPending.value) {
    startActivation()
    return
  }
  waiverPending.value = false
  setWaiverOn(true)
  if (!dp.waiverServiceActive.value)
    wizardOpen.value = true
}

watch(promoOpen, (isOpen) => {
  if (!isOpen)
    setTimeout(() => { waiverPending.value = false }, 0)
})

function setPackage(value: unknown) {
  if (typeof value !== 'string' || value === shownPackage.value?.serviceId)
    return
  moveTo(value)
}

// ------------------------------------- a new package, without leaving the page

/**
 * The same upsell form as Upsells, opened on the Damage Protection category
 * with this listing ticked. Saving creates the upsell (the package) and puts
 * the listing in it, out of any other: the drawer's own one-package rule.
 */
const packageDrawerOpen = ref(false)

function openNewPackage() {
  packageDrawerOpen.value = true
}

function onPackageCreated(service: UpsellService) {
  if (!service.assignedListings.includes(props.listing.name))
    return
  if (!setup.value.waiver)
    apply({ waiver: true })
  toast.success(`This listing now offers ${service.name}`)
}

/** Off means off: out of the protection upsell, no deposit, and the guest pays again. */
function turnOff() {
  if (payer.value === 'host')
    dp.setListingPayer(props.listing.id, 'guest')
  moveTo(null)
  if (setup.value.deposit)
    dp.setListingSetup(props.listing.id, { deposit: false })
  toast.success('Damage protection turned off for this listing')
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
        The damage waiver is not activated yet, so it is paused and "Host pays" is not available.
        A deposit on its own keeps working.
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

    <!-- What guests are offered -->
    <Card data-testid="protection-options">
      <CardHeader class="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2">
            <Icon name="lucide:shield-check" class="size-4" />
            Damage protection
          </CardTitle>
          <CardDescription data-testid="protection-status">
            <template v-if="!isOn">
              Off. Turn on the damage waiver, a deposit, or both.
            </template>
            <template v-else-if="waiverOn && setup.deposit">
              Waiver and deposit: the guest chooses.
            </template>
            <template v-else-if="waiverOn">
              Waiver only.
            </template>
            <template v-else>
              Deposit only.
            </template>
            Owner stays are never included.
          </CardDescription>
        </div>
        <Button v-if="isOn" variant="outline" size="sm" class="shrink-0" data-testid="protection-remove" @click="turnOff">
          Turn off
        </Button>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <p
          v-if="state.block"
          class="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
          data-testid="protection-block"
        >
          <Icon name="lucide:alert-triangle" class="mt-0.5 size-4 shrink-0 text-amber-600" />
          {{ blockText(state.block, shownPackage, state.currency) }}
        </p>

        <!-- Damage waiver -->
        <div class="flex flex-col gap-3 rounded-lg border p-4" data-testid="protection-waiver">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-medium">
                Damage waiver
              </p>
              <p class="text-xs text-muted-foreground">
                A non-refundable fee. Accidental damage is covered by Elev8 Cover up to the package's limit.
              </p>
            </div>
            <Switch
              :model-value="waiverOn"
              :disabled="!hasPackages"
              aria-label="Offer the damage waiver"
              data-testid="protection-waiver-switch"
              @update:model-value="(v: boolean) => onWaiverSwitch(v)"
            />
          </div>
          <div v-if="!hasPackages && !waiverOn" class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="protection-waiver-missing">
            The packages are Damage Protection upsells, and there is none yet.
            <Button size="sm" variant="outline" class="h-7 text-xs" data-testid="protection-new-package" @click="openNewPackage">
              <Icon name="lucide:plus" class="mr-1 size-3.5" />
              Create a package
            </Button>
          </div>
          <template v-if="waiverOn">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Package</Label>
              <div class="flex gap-2">
                <Select :model-value="shownPackage?.serviceId" @update:model-value="setPackage">
                  <SelectTrigger class="w-full min-w-0 flex-1" data-testid="protection-package">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="pkg in state.packages" :key="pkg.serviceId" :value="pkg.serviceId">
                      {{ pkg.serviceName }} · guest pays {{ formatProtectionAmount(pkg.guestPrice, pkg.currency) }}
                      <span v-if="elev8FeeFor(pkg)" class="text-muted-foreground">· Elev8 charges you {{ formatProtectionAmount(elev8FeeFor(pkg)!, pkg.currency) }}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" class="shrink-0" data-testid="protection-new-package" @click="openNewPackage">
                  <Icon name="lucide:plus" class="mr-1 size-4" />
                  New package
                </Button>
              </div>
              <p v-if="shownPackage" class="text-xs text-muted-foreground" data-testid="protection-package-summary">
                {{ state.policy?.offers.includes('waiver') ? waiverSummary(state.policy) : packageSummary(shownPackage) }}.
                Each package is a Damage Protection upsell.
              </p>
            </div>
            <p v-if="undersized" class="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400" data-testid="protection-undersized">
              <Icon name="lucide:alert-triangle" class="mt-0.5 size-3.5 shrink-0" />
              {{ undersized }}
            </p>
            <p v-if="paused" class="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Icon name="lucide:pause-circle" class="mt-0.5 size-3.5 shrink-0" />
              Guests are not asked yet: the damage waiver is not activated.
            </p>
          </template>
        </div>

        <!-- Deposit -->
        <div class="flex flex-col gap-3 rounded-lg border p-4" data-testid="protection-deposit">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-medium" :class="takesDeposit && payer === 'guest' ? '' : 'text-muted-foreground'">
                Deposit
              </p>
              <p class="text-xs text-muted-foreground">
                <template v-if="!takesDeposit">
                  Needs a Stripe payout account: the card is saved with Stripe and charged only for damage.
                </template>
                <template v-else-if="payer === 'host'">
                  Not asked where you pay for the cover.
                </template>
                <template v-else>
                  A card kept on file, charged only for damage after check-out. Nothing is charged at booking.
                </template>
              </p>
            </div>
            <Switch
              :model-value="setup.deposit"
              :disabled="!takesDeposit || payer === 'host'"
              aria-label="Offer the deposit"
              data-testid="protection-deposit-switch"
              @update:model-value="(v: boolean) => setDeposit(v)"
            />
          </div>
          <template v-if="setup.deposit && takesDeposit && payer === 'guest'">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground" for="protection-deposit-limit">Card charged up to</Label>
                <div class="relative">
                  <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    {{ shownPackage?.currency ?? state.currency ?? 'USD' }}
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
            <p v-if="state.policy" class="text-xs text-muted-foreground">
              {{ depositSummary(state.policy) }}.
            </p>
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
          </template>
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
          Protection is set for the whole property: every room uses the same setup.
        </p>
      </CardContent>
    </Card>

    <!-- Who pays -->
    <Card v-if="isOn" data-testid="protection-payer">
      <CardHeader>
        <CardTitle>Who pays</CardTitle>
        <CardDescription>Currently: {{ PROTECTION_MODE_LABELS[mode] }}.</CardDescription>
      </CardHeader>
      <CardContent>
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
      :currency="state.currency"
      :guest-price="ownGuestPrice"
      :action-label="waiverPending ? 'Turn on damage waiver' : undefined"
      @activate="onPromoAction"
    />
    <TernActivationWizard v-model:open="wizardOpen" />
    <!-- Mounted only while open: the form is heavy and the tab remounts on every visit. -->
    <UpsellDrawer
      v-if="packageDrawerOpen"
      v-model:open="packageDrawerOpen"
      :service="null"
      :initial-category="PROTECTION_CATEGORY"
      :initial-listings="[listing.name]"
      @saved="onPackageCreated"
    />
  </div>
</template>
