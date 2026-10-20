<script setup lang="ts">
import type { WebsiteRuleSet, WebsiteSettingsIssue } from './data/website-channel'
import { computed } from 'vue'
import { formatPromoDiscount, getPromoCodeStatus, isPromoCodeValidOnWebsite } from '~/components/promo-code/data/promo-codes'
import { getListingIdsForWebsite } from '~/components/website-builder/data/property-listings'
import { websites } from '~/components/website-builder/data/websites'
import { usePromoCodes } from '~/composables/usePromoCodes'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'
import WebsitePriceCheck from './WebsitePriceCheck.vue'

/** `siteOnly`: rules of one website (Website Builder), so no name, website picker, promo list or price check. */
const props = defineProps<{ issues: WebsiteSettingsIssue[], siteOnly?: boolean }>()

const draft = defineModel<WebsiteRuleSet>('ruleSet', { required: true })

const { ruleSets } = useWebsiteChannel()
const { codes } = usePromoCodes()

function issueFor(field: string) {
  return props.issues.find(i => i.field === field)?.message
}

const STATUS_LABEL = { published: 'Published', draft: 'Draft', building: 'Building' } as const

// Listing coverage comes from Website Builder; a site with no properties recorded is "not set", not "none".
function coverage(site: { propertyIds?: string[] }) {
  if (!site.propertyIds?.length)
    return 'Listing coverage not set'
  const n = getListingIdsForWebsite(site).length
  return `${n} ${n === 1 ? 'listing' : 'listings'}`
}

/** The other rule set a website sits in now, if any. Picking it here moves it on save. */
function otherSetName(websiteId: string) {
  return ruleSets.value.find(r => r.id !== draft.value.id && r.websiteIds.includes(websiteId))?.name
}

function toggleWebsite(id: string) {
  const ids = draft.value.websiteIds
  draft.value = { ...draft.value, websiteIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }
}

function addTier() {
  const tiers = draft.value.lengthOfStayDiscounts
  const next = tiers.length ? Math.max(...tiers.map(t => t.minNights)) + 7 : 7
  draft.value = { ...draft.value, lengthOfStayDiscounts: [...tiers, { id: `wlos-${Date.now().toString(36)}`, minNights: next, pct: 10 }] }
}

function removeTier(id: string) {
  draft.value = { ...draft.value, lengthOfStayDiscounts: draft.value.lengthOfStayDiscounts.filter(t => t.id !== id) }
}

const WEEKDAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
]

function toggleDay(field: 'arrivalDays' | 'departureDays', day: number) {
  const days = draft.value[field]
  draft.value = { ...draft.value, [field]: days.includes(day) ? days.filter(d => d !== day) : [...days, day] }
}

function setWindow(key: 'earlyBird' | 'lastMinute', enabled: boolean) {
  draft.value = { ...draft.value, [key]: { ...draft.value[key], enabled } }
}

const maxNightsInput = computed({
  get: () => draft.value.maxNights ?? '',
  set: (v: string | number) => {
    draft.value = { ...draft.value, maxNights: v === '' || v === null ? null : Number(v) }
  },
})

// Read only: Promo Codes decides where a code works. Listed so the host sees what guests on these sites can use.
const validCodes = computed(() => codes.value
  .filter(code => draft.value.websiteIds.some(id => isPromoCodeValidOnWebsite(code, id)))
  .map(code => ({ code, status: getPromoCodeStatus(code) })))
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Name -->
    <div v-if="!siteOnly" class="flex flex-col gap-1.5">
      <Label for="wrs-name">Rule set name</Label>
      <Input id="wrs-name" v-model="draft.name" data-testid="wrs-name" placeholder="e.g. Long stay sites" :class="issueFor('name') && 'border-destructive'" />
      <p v-if="issueFor('name')" class="text-xs text-destructive">
        {{ issueFor('name') }}
      </p>
    </div>

    <!-- Websites -->
    <section v-if="!siteOnly" class="flex flex-col gap-3">
      <div>
        <h3 class="text-sm font-semibold">
          Websites
        </h3>
        <p class="text-xs text-muted-foreground">
          Bookings on these websites use this rule set. A website is in one rule set only.
        </p>
      </div>

      <div class="rounded-md border" :class="issueFor('websites') && 'border-destructive'">
        <div
          v-for="site in websites"
          :key="site.id"
          class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/60"
          role="checkbox"
          :aria-checked="draft.websiteIds.includes(site.id)"
          data-testid="wrs-website"
          tabindex="0"
          @click="toggleWebsite(site.id)"
          @keydown.space.prevent="toggleWebsite(site.id)"
        >
          <div
            class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
            :class="draft.websiteIds.includes(site.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
          >
            <Icon v-if="draft.websiteIds.includes(site.id)" name="lucide:check" class="size-3" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">
              {{ site.name }}
            </p>
            <p class="truncate text-xs text-muted-foreground">
              {{ site.url }} · {{ coverage(site) }}
            </p>
            <p v-if="otherSetName(site.id)" class="text-xs text-warning-foreground">
              <template v-if="draft.websiteIds.includes(site.id)">
                Moves here from "{{ otherSetName(site.id) }}" on save
              </template>
              <template v-else>
                In "{{ otherSetName(site.id) }}"
              </template>
            </p>
          </div>
          <Badge variant="outline" class="shrink-0">
            {{ STATUS_LABEL[site.status] }}
          </Badge>
        </div>
        <p v-if="websites.length === 0" class="p-4 text-center text-sm text-muted-foreground">
          No websites yet. Build one in
          <NuxtLink to="/website-builder" class="text-primary hover:underline">
            Website Builder
          </NuxtLink>.
        </p>
      </div>
      <p v-if="issueFor('websites')" class="text-xs text-destructive">
        {{ issueFor('websites') }}
      </p>
    </section>

    <Separator v-if="!siteOnly" />

    <!-- Length of stay -->
    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold">
            Length of stay discounts
          </h3>
          <p class="text-xs text-muted-foreground">
            A stay gets the highest tier it reaches.
          </p>
        </div>
        <Button variant="outline" size="sm" @click="addTier">
          <Icon name="lucide:plus" class="mr-1.5 size-4" aria-hidden="true" />
          Add tier
        </Button>
      </div>
      <div v-if="draft.lengthOfStayDiscounts.length > 0" class="flex flex-col gap-2">
        <div v-for="tier in draft.lengthOfStayDiscounts" :key="tier.id" class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2 rounded-md border p-2.5" :class="issueFor(`los-${tier.id}`) && 'border-destructive'">
            <span class="text-sm text-muted-foreground">From</span>
            <Input v-model.number="tier.minNights" type="number" min="2" class="h-8 w-20" aria-label="Minimum nights" />
            <span class="text-sm text-muted-foreground">nights,</span>
            <Input v-model.number="tier.pct" type="number" min="1" max="99" class="h-8 w-20" aria-label="Discount percent" />
            <span class="text-sm text-muted-foreground">% off</span>
            <Button variant="ghost" size="icon" class="ml-auto size-8" aria-label="Remove tier" @click="removeTier(tier.id)">
              <Icon name="lucide:trash-2" class="size-4 text-muted-foreground" />
            </Button>
          </div>
          <p v-if="issueFor(`los-${tier.id}`)" class="text-xs text-destructive">
            {{ issueFor(`los-${tier.id}`) }}
          </p>
        </div>
      </div>
      <p v-else class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        No length of stay discounts. Longer stays pay the full rate.
      </p>
    </section>

    <Separator />

    <!-- Booking window -->
    <section class="flex flex-col gap-3">
      <div>
        <h3 class="text-sm font-semibold">
          Booking window discounts
        </h3>
        <p class="text-xs text-muted-foreground">
          Added on top of the length of stay discount.
        </p>
      </div>
      <div v-for="rule in [{ key: 'earlyBird', label: 'Early bird', lead: 'Booked at least', tail: 'days before arrival' }, { key: 'lastMinute', label: 'Last minute', lead: 'Booked within', tail: 'days of arrival' }] as const" :key="rule.key" class="flex flex-col gap-1">
        <div class="flex flex-col gap-2 rounded-md border p-3" :class="issueFor(rule.key) && 'border-destructive'">
          <div class="flex items-center justify-between gap-2">
            <Label :for="`wrs-${rule.key}`" class="text-sm font-medium">{{ rule.label }}</Label>
            <Switch :id="`wrs-${rule.key}`" :model-value="draft[rule.key].enabled" @update:model-value="(v: boolean) => setWindow(rule.key, v)" />
          </div>
          <div v-if="draft[rule.key].enabled" class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted-foreground">{{ rule.lead }}</span>
            <Input v-model.number="draft[rule.key].days" type="number" min="1" class="h-8 w-20" :aria-label="`${rule.label} days`" />
            <span class="text-sm text-muted-foreground">{{ rule.tail }},</span>
            <Input v-model.number="draft[rule.key].pct" type="number" min="1" max="99" class="h-8 w-20" :aria-label="`${rule.label} percent`" />
            <span class="text-sm text-muted-foreground">% off</span>
          </div>
        </div>
        <p v-if="issueFor(rule.key)" class="text-xs text-destructive">
          {{ issueFor(rule.key) }}
        </p>
      </div>
    </section>

    <Separator />

    <!-- Stay rules -->
    <section class="flex flex-col gap-3">
      <h3 class="text-sm font-semibold">
        Stay rules
      </h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5">
            <Label for="wrs-min-nights">Minimum stay</Label>
            <ChannelsWebsiteRuleHint label="Minimum stay" text="The fewest nights a guest can book. A minimum of 1 allows any stay." />
          </div>
          <div class="flex items-center gap-2">
            <Input id="wrs-min-nights" v-model.number="draft.minNights" type="number" min="1" :class="issueFor('minNights') && 'border-destructive'" />
            <span class="text-sm text-muted-foreground">nights</span>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5">
            <Label for="wrs-max-nights">Maximum stay</Label>
            <ChannelsWebsiteRuleHint label="Maximum stay" text="The most nights a guest can book. Leave empty for no limit." />
          </div>
          <div class="flex items-center gap-2">
            <Input id="wrs-max-nights" v-model="maxNightsInput" type="number" min="1" placeholder="No limit" :class="issueFor('maxNights') && 'border-destructive'" />
            <span class="text-sm text-muted-foreground">nights</span>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5">
            <Label for="wrs-notice">Booking notice</Label>
            <ChannelsWebsiteRuleHint label="Booking notice" text="How many days before arrival a booking must be made. 0 allows same day bookings, 2 closes the next 2 days." />
          </div>
          <div class="flex items-center gap-2">
            <Input id="wrs-notice" v-model.number="draft.minDaysBeforeArrival" type="number" min="0" :class="issueFor('minDaysBeforeArrival') && 'border-destructive'" />
            <span class="text-sm text-muted-foreground">days</span>
          </div>
        </div>
      </div>
      <p v-if="issueFor('minNights') || issueFor('maxNights') || issueFor('minDaysBeforeArrival')" class="text-xs text-destructive">
        {{ issueFor('minNights') || issueFor('maxNights') || issueFor('minDaysBeforeArrival') }}
      </p>

      <div v-for="field in [{ key: 'arrivalDays', label: 'Arrival days', hint: 'Days of the week a stay can start. Leave all unselected to allow any day.' }, { key: 'departureDays', label: 'Departure days', hint: 'Days of the week a stay can end. Leave all unselected to allow any day.' }] as const" :key="field.key" class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label>{{ field.label }}</Label>
          <ChannelsWebsiteRuleHint :label="field.label" :text="field.hint" />
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="day in WEEKDAYS"
            :key="day.value"
            type="button"
            class="flex h-8 min-w-11 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors"
            :class="draft[field.key].includes(day.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'"
            :aria-pressed="draft[field.key].includes(day.value)"
            @click="toggleDay(field.key, day.value)"
          >
            {{ day.short }}
          </button>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ draft[field.key].length === 0 ? 'Any day. Pick days to restrict.' : `Only on the ${draft[field.key].length} selected ${draft[field.key].length === 1 ? 'day' : 'days'}.` }}
        </p>
      </div>
    </section>

    <Separator />

    <!-- Payment and codes -->
    <section class="flex flex-col gap-3">
      <h3 class="text-sm font-semibold">
        {{ siteOnly ? 'Payment' : 'Payment and promo codes' }}
      </h3>
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label for="wrs-prepay">Prepayment at booking</Label>
          <ChannelsWebsiteRuleHint label="Prepayment at booking" text="Share of the stay total charged when the guest books. The rest is due before arrival." />
        </div>
        <div class="flex items-center gap-2">
          <Input id="wrs-prepay" v-model.number="draft.prepaymentPct" type="number" min="0" max="100" class="w-28" :class="issueFor('prepaymentPct') && 'border-destructive'" />
          <span class="text-sm text-muted-foreground">% of the stay, the rest is due before arrival</span>
        </div>
        <p v-if="issueFor('prepaymentPct')" class="text-xs text-destructive">
          {{ issueFor('prepaymentPct') }}
        </p>
      </div>
      <div v-if="!siteOnly" class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <Label>Promo codes valid on these websites</Label>
          <NuxtLink to="/promo-codes" class="text-xs text-primary hover:underline">
            Manage in Promo Codes
          </NuxtLink>
        </div>
        <ul v-if="validCodes.length" class="flex flex-col divide-y rounded-md border" data-testid="wrs-promo-codes">
          <li v-for="{ code, status } in validCodes" :key="code.id" class="flex items-center gap-3 px-3 py-2 text-sm">
            <span class="font-mono font-medium">{{ code.code }}</span>
            <span class="min-w-0 flex-1 truncate text-muted-foreground">{{ formatPromoDiscount(code) }}</span>
            <Badge :variant="status === 'active' ? 'default' : 'outline'" class="shrink-0 capitalize">
              {{ status }}
            </Badge>
          </li>
        </ul>
        <p v-else class="text-xs text-muted-foreground">
          No promo code is set to work on these websites. Set where a code works in Promo Codes.
        </p>
      </div>
    </section>

    <template v-if="!siteOnly">
      <Separator />

      <WebsitePriceCheck :rule-set="draft" />
    </template>
  </div>
</template>
