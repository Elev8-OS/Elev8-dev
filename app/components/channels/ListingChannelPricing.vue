<script setup lang="ts">
import type { ChannelAdjustment, ChannelPromotion, PromotionType } from './data/channel-pricing'
import type { Listing } from '~/components/listings/data/listings'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { formatMoney } from '~/components/cockpit/data/cockpit'
import { listingCurrency } from '~/components/listings/data/listing-overview-charts'
import { listings, ratePlanNightlyRate } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'
import ChannelCopyToListingsDialog from './ChannelCopyToListingsDialog.vue'
import {
  adjustedAmount,
  adjustmentFor,
  copyPromotions,
  isValidAdjustment,
  listingChannelAdjustments,
  listingChannelPromotions,
  newPromotion,
  PROMOTION_CHANNELS,
  PROMOTION_TYPES,
  promotionIssues,
  promotionSummary,
} from './data/channel-pricing'
import { CHANNELS, otaIcon } from './data/channels'

/**
 * The listing's Pricing tab, channel part: promotions sent to the OTAs, and a
 * price adjustment per channel (NextPax rate and fee multipliers). Both can be
 * copied to other listings, which replaces theirs.
 */
const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const { isConnected } = useChannels()
const currency = computed(() => listingCurrency(props.listing))

// ── Promotions ──
const promotions = computed(() => listingChannelPromotions(props.listing))

function writePromotions(next: ChannelPromotion[]) {
  emit('update', { ...props.listing, channelPromotions: next })
}

const sheetOpen = ref(false)
const draft = ref<ChannelPromotion>(newPromotion())
const isNew = ref(true)
const issues = computed(() => promotionIssues(draft.value))

function openNew() {
  draft.value = newPromotion()
  isNew.value = true
  sheetOpen.value = true
}

function openEdit(p: ChannelPromotion) {
  draft.value = { ...p, channels: [...p.channels] }
  isNew.value = false
  sheetOpen.value = true
}

function setType(type: PromotionType) {
  // A type change resets the days to that type's usual value, so an early bird's 30 does not become a last minute's 30.
  draft.value = { ...draft.value, type, daysBeforeArrival: type === 'basic' ? null : type === 'early_bird' ? 30 : 7 }
}

function toggleDraftChannel(name: string) {
  const channels = draft.value.channels.includes(name) ? draft.value.channels.filter(c => c !== name) : [...draft.value.channels, name]
  draft.value = { ...draft.value, channels }
}

/** A number field: empty means "no limit". */
function numberOrNull(value: unknown): number | null {
  const n = Number(value)
  return String(value ?? '').trim() === '' || !Number.isFinite(n) ? null : n
}

function savePromotion() {
  if (issues.value.length)
    return
  const p = { ...draft.value, name: draft.value.name.trim() }
  writePromotions(isNew.value ? [...promotions.value, p] : promotions.value.map(x => x.id === p.id ? p : x))
  sheetOpen.value = false
  toast.success(isNew.value ? 'Promotion added' : 'Promotion updated')
}

function setActive(p: ChannelPromotion, active: boolean) {
  writePromotions(promotions.value.map(x => x.id === p.id ? { ...x, active } : x))
}

function removePromotion(p: ChannelPromotion) {
  writePromotions(promotions.value.filter(x => x.id !== p.id))
  toast.info(`"${p.name}" removed`)
}

// ── Price adjustments ──
/** Channels this listing sells on, or could: every connected channel. */
const adjustmentChannels = computed(() => CHANNELS.filter(c => isConnected(c.name)).map(c => c.name))

const baseRate = computed(() => {
  const plans = (props.listing.unitTypes ?? []).flatMap(t => t.pricing.ratePlans)
  const base = plans.find(p => p.isBase) ?? plans[0]
  return base ? ratePlanNightlyRate(base) : props.listing.pricing.nightlyRate
})

function setAdjustment(channel: string, key: keyof ChannelAdjustment, raw: string | number) {
  const pct = Number(String(raw).replace(',', '.') || 0)
  if (!isValidAdjustment(pct)) {
    toast.error('Use a percent above -100 and up to 500')
    return
  }
  const next = { ...listingChannelAdjustments(props.listing), [channel]: { ...adjustmentFor(props.listing, channel), [key]: pct } }
  emit('update', { ...props.listing, channelAdjustments: next })
}

// ── Copy to listings ──
const copyWhat = ref<'promotions' | 'adjustments' | null>(null)
const copyOpen = ref(false)

function openCopy(what: 'promotions' | 'adjustments') {
  copyWhat.value = what
  copyOpen.value = true
}

/** Writes the other listings at once, like every "Copy to listings" in the listing pages. */
function copyTo(ids: string[]) {
  const targets = new Set(ids)
  const what = copyWhat.value
  listings.value = listings.value.map((l) => {
    if (!targets.has(l.id))
      return l
    return what === 'promotions'
      ? { ...l, channelPromotions: copyPromotions(promotions.value, l.id) }
      : { ...l, channelAdjustments: structuredClone({ ...listingChannelAdjustments(props.listing) }) }
  })
  toast.success(`${what === 'promotions' ? 'Promotions' : 'Price adjustments'} copied to ${ids.length} ${ids.length === 1 ? 'listing' : 'listings'}`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card class="p-5" data-testid="channel-promotions">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">
            Channel promotions
          </h3>
          <p class="text-xs text-muted-foreground">
            Discounts {{ PROMOTION_CHANNELS.join(', ') }} show on this listing. Promo codes for your own website are in Promo Codes.
          </p>
        </div>
        <div class="flex gap-2">
          <Button v-if="promotions.length" variant="ghost" size="sm" @click="openCopy('promotions')">
            Copy to listings
          </Button>
          <Button variant="outline" size="sm" @click="openNew">
            <Icon name="lucide:plus" class="mr-1.5 size-4" aria-hidden="true" />
            Add promotion
          </Button>
        </div>
      </div>

      <ul v-if="promotions.length" class="flex flex-col divide-y rounded-lg border">
        <li v-for="p in promotions" :key="p.id" class="flex flex-wrap items-center gap-3 p-3" :class="p.active ? '' : 'opacity-60'">
          <div class="min-w-[200px] flex-1">
            <p class="flex flex-wrap items-center gap-2 text-sm font-medium">
              {{ p.name }}
              <Badge variant="secondary" class="text-[10px]">
                {{ PROMOTION_TYPES.find(t => t.value === p.type)?.label }}
              </Badge>
              <Badge v-if="!p.active" variant="outline" class="text-[10px]">
                Paused
              </Badge>
            </p>
            <p class="text-xs text-muted-foreground">
              {{ promotionSummary(p, currency) }}
            </p>
          </div>
          <span class="flex items-center gap-1" :aria-label="`On ${p.channels.join(', ')}`">
            <Icon v-for="c in p.channels" :key="c" :name="otaIcon(c)" class="size-4" aria-hidden="true" />
          </span>
          <Switch :model-value="p.active" :aria-label="`${p.active ? 'Pause' : 'Resume'} ${p.name}`" @update:model-value="v => setActive(p, !!v)" />
          <Button variant="ghost" size="icon" class="size-8" :aria-label="`Edit ${p.name}`" @click="openEdit(p)">
            <Icon name="lucide:pencil" class="size-4" />
          </Button>
          <Button variant="ghost" size="icon" class="size-8 text-destructive hover:text-destructive" :aria-label="`Remove ${p.name}`" @click="removePromotion(p)">
            <Icon name="lucide:trash-2" class="size-4" />
          </Button>
        </li>
      </ul>
      <p v-else class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No promotions on this listing.
      </p>
    </Card>

    <Card class="p-5" data-testid="channel-adjustments">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">
            Channel price adjustments
          </h3>
          <p class="text-xs text-muted-foreground">
            Raise or lower what each channel receives, e.g. to cover its commission. 0% sends your own prices.
          </p>
        </div>
        <Button v-if="adjustmentChannels.length" variant="ghost" size="sm" @click="openCopy('adjustments')">
          Copy to listings
        </Button>
      </div>

      <div v-if="adjustmentChannels.length" class="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Nightly rate</TableHead>
              <TableHead>Fees</TableHead>
              <TableHead>A {{ formatMoney(baseRate, currency) }} night becomes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="channel in adjustmentChannels" :key="channel">
              <TableCell>
                <span class="flex items-center gap-2 font-medium">
                  <Icon :name="otaIcon(channel)" class="size-4" aria-hidden="true" />
                  {{ channel }}
                </span>
              </TableCell>
              <TableCell v-for="key in (['rate', 'fee'] as const)" :key="key">
                <div class="relative w-28">
                  <Input
                    :model-value="adjustmentFor(listing, channel)[key]"
                    inputmode="decimal"
                    class="pr-7 tabular-nums"
                    :aria-label="`${channel} ${key === 'rate' ? 'nightly rate' : 'fees'} adjustment in percent`"
                    @change="(e: Event) => setAdjustment(channel, key, (e.target as HTMLInputElement).value)"
                  />
                  <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </TableCell>
              <TableCell class="tabular-nums">
                {{ formatMoney(adjustedAmount(baseRate, adjustmentFor(listing, channel).rate), currency) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p v-else class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Connect a channel first.
      </p>
    </Card>

    <Sheet v-model:open="sheetOpen">
      <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader class="border-b p-5">
          <SheetTitle>{{ isNew ? 'Add promotion' : 'Edit promotion' }}</SheetTitle>
          <SheetDescription>Sent to the channels you pick, for this listing.</SheetDescription>
        </SheetHeader>
        <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div class="flex flex-col gap-1.5">
            <Label for="promo-name">Name</Label>
            <Input id="promo-name" v-model="draft.name" placeholder="e.g. Book early, save 10%" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Type</Label>
            <div class="grid gap-2" role="radiogroup" aria-label="Promotion type">
              <button
                v-for="t in PROMOTION_TYPES"
                :key="t.value"
                type="button"
                role="radio"
                :aria-checked="draft.type === t.value"
                class="flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="draft.type === t.value ? 'border-primary ring-1 ring-primary' : ''"
                @click="setType(t.value)"
              >
                <span class="text-sm font-medium">{{ t.label }}</span>
                <span class="text-xs text-muted-foreground">{{ t.hint }}</span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label for="promo-amount">Discount</Label>
              <div class="flex gap-1.5">
                <Input id="promo-amount" v-model.number="draft.amount" inputmode="decimal" class="tabular-nums" />
                <Select v-model="draft.discountType">
                  <SelectTrigger class="w-24" aria-label="Discount unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">
                      %
                    </SelectItem>
                    <SelectItem value="amount">
                      {{ currency }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="promo-target">Off</Label>
              <Select v-model="draft.target">
                <SelectTrigger id="promo-target" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">
                    Nightly rent
                  </SelectItem>
                  <SelectItem value="total">
                    Whole stay with fees
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div v-if="draft.type !== 'basic'" class="flex flex-col gap-1.5">
            <Label for="promo-days">{{ draft.type === 'early_bird' ? 'Booked at least this many days ahead' : 'Booked at most this many days before arrival' }}</Label>
            <Input
              id="promo-days"
              :model-value="draft.daysBeforeArrival ?? ''"
              inputmode="numeric"
              class="w-28 tabular-nums"
              @update:model-value="v => draft = { ...draft, daysBeforeArrival: numberOrNull(v) }"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Stays from</Label>
              <BaseDatePicker :model-value="draft.stayFrom" placeholder="Any date" @update:model-value="v => draft = { ...draft, stayFrom: v }" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Stays until</Label>
              <BaseDatePicker :model-value="draft.stayUntil" placeholder="Open" :min="draft.stayFrom ?? undefined" @update:model-value="v => draft = { ...draft, stayUntil: v }" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="promo-min">Minimum nights</Label>
              <Input id="promo-min" :model-value="draft.minNights ?? ''" inputmode="numeric" placeholder="Any" @update:model-value="v => draft = { ...draft, minNights: numberOrNull(v) }" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="promo-max">Maximum nights</Label>
              <Input id="promo-max" :model-value="draft.maxNights ?? ''" inputmode="numeric" placeholder="Any" @update:model-value="v => draft = { ...draft, maxNights: numberOrNull(v) }" />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Channels</Label>
            <div class="flex flex-col gap-1 rounded-lg border p-2" role="group" aria-label="Channels for this promotion">
              <div
                v-for="channel in PROMOTION_CHANNELS"
                :key="channel"
                role="checkbox"
                tabindex="0"
                :aria-checked="draft.channels.includes(channel)"
                class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                @click="toggleDraftChannel(channel)"
                @keydown.space.prevent="toggleDraftChannel(channel)"
              >
                <div
                  class="flex size-4 items-center justify-center rounded-[4px] border"
                  :class="draft.channels.includes(channel) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                >
                  <Icon v-if="draft.channels.includes(channel)" name="lucide:check" class="size-3" />
                </div>
                <Icon :name="otaIcon(channel)" class="size-4" aria-hidden="true" />
                <span>{{ channel }}</span>
                <span v-if="!isConnected(channel)" class="ml-auto text-xs text-muted-foreground">Not connected</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2">
            <Label for="promo-active">Active</Label>
            <Switch id="promo-active" :model-value="draft.active" @update:model-value="v => draft = { ...draft, active: !!v }" />
          </div>

          <p class="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {{ promotionSummary(draft, currency) }}
          </p>
        </div>
        <SheetFooter class="flex-row items-center justify-end gap-2 border-t p-4">
          <p v-if="issues.length" class="mr-auto text-xs text-muted-foreground">
            {{ issues[0] }}
          </p>
          <Button variant="ghost" @click="sheetOpen = false">
            Cancel
          </Button>
          <Button :disabled="issues.length > 0" data-testid="promo-save" @click="savePromotion">
            {{ isNew ? 'Add promotion' : 'Save' }}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <ChannelCopyToListingsDialog
      v-model:open="copyOpen"
      :listing-id="listing.id"
      :what="copyWhat === 'promotions' ? 'channel promotions' : 'channel price adjustments'"
      @copy="copyTo"
    />
  </div>
</template>
