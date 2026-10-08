<script setup lang="ts">
import type { BookingChannel } from '~/components/listings/data/listings'
import type { ProtectionPayer } from '~/components/reservations/data/reservations'
import type { TernTier } from '~/components/reservations/data/tern-products'
import type { UpsellService } from '~/components/upsells/data/upsell-services'
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
import TernActivationCard from '~/components/damage-protection/TernActivationCard.vue'
import { BOOKING_CHANNELS, listings } from '~/components/listings/data/listings'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { ternPriceFor } from '~/components/reservations/data/tern-products'
import { PROTECTION_CATEGORY } from '~/components/upsells/data/upsell-services'
import UpsellDrawer from '~/components/upsells/UpsellDrawer.vue'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useUpsellServices } from '~/composables/useUpsellServices'

/**
 * Damage protection, set ONCE for every listing (owner's decision, 2026-10-08).
 * The waiver is activated with Elev8 Cover (the card on top, whose wizard also
 * picks the package), then runs on every listing with one package. The deposit
 * comes with the waiver; on its own it can be offered without one.
 */
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
 * The waiver uses ONE upsell: the package is a Damage Protection upsell, edited
 * here in the same form as Upsells. Created here only when none exists yet.
 */
const packageDrawerOpen = ref(false)
const drawerService = ref<UpsellService | null>(null)

function openPackageForm(service: UpsellService | null) {
  drawerService.value = service
  packageDrawerOpen.value = true
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
    openPackageForm(null)
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

/** A package created here (there was none) becomes the waiver's; an edit keeps it, with its new price. */
function onPackageSaved(service: UpsellService) {
  if (drawerService.value)
    return
  // Created because there was none: it becomes the waiver's one package.
  if (active.value)
    apply({ waiver: true, packageServiceId: service.id }, `Every listing now offers ${service.name}`)
  else
    apply({ packageServiceId: service.id })
}

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

// ------------------------------------------------------- per listing, read only

/** What each listing ends up offering under these settings: nothing is set per listing. */
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
  return {
    id: listing.id,
    name: listing.name,
    payout: account ? `${account.currency}, ${account.provider === 'stripe' ? 'Stripe' : account.provider.toUpperCase()}` : 'No payout account',
    offered,
    covered: offered !== 'Not covered',
    note: state.block
      ? blockText(state.block, pkg.value, state.currency)
      : waiver && !takesCard && settings.value.deposit && payer.value === 'guest'
        ? 'No Stripe payout account, so no deposit card here.'
        : waiver ? undersizedText(pkg.value, listing.capacity) : null,
  }
}))
const coveredCount = computed(() => listingRows.value.filter(r => r.covered).length)
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
              <Button variant="outline" class="shrink-0" data-testid="protection-edit-package" @click="openPackageForm(packageService)">
                <Icon name="lucide:pencil" class="mr-1 size-4" />
                Edit package
              </Button>
            </div>
            <div v-else class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="protection-no-packages">
              The package is a Damage Protection upsell, and there is none yet.
              <Button size="sm" variant="outline" class="h-7 text-xs" data-testid="protection-new-package" @click="openPackageForm(null)">
                <Icon name="lucide:plus" class="mr-1 size-3.5" />
                Create a package
              </Button>
            </div>
            <p v-if="settings.waiver && packageService && !pkg" class="text-xs text-amber-700 dark:text-amber-400" data-testid="protection-package-missing">
              The package's upsell is paused, so no guest is offered the waiver. Switch it back on with Edit package.
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
            <Label class="text-xs text-muted-foreground" for="protection-deposit-limit">Card charged up to</Label>
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
              In each listing's own payout currency. Nothing is converted.
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

    <!-- Listings: read only, nothing is set per listing -->
    <Card data-testid="protection-listings">
      <CardHeader>
        <CardTitle>Listings</CardTitle>
        <CardDescription>
          {{ coveredCount }} of {{ listingRows.length }} listings covered. What guests on each listing are offered under
          the settings above. A listing paid out in another currency than the package is not covered: nothing is converted.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in listingRows" :key="row.id" class="border-t" data-testid="protection-listing-row">
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
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <!-- Mounted only while open: the form is heavy. -->
    <UpsellDrawer
      v-if="packageDrawerOpen"
      v-model:open="packageDrawerOpen"
      :service="drawerService"
      :initial-category="PROTECTION_CATEGORY"
      @saved="onPackageSaved"
    />
  </div>
</template>
