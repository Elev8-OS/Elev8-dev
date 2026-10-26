<script setup lang="ts">
import type { WebsiteRuleSet } from './data/website-channel'
import { computed, ref, watch } from 'vue'
import DatePicker from '~/components/base/DatePicker.vue'
import { listings } from '~/components/listings/data/listings'
import { addDays, isoDate } from '~/components/revenue/data/revenue-policy'
import { getListingIdsForWebsite } from '~/components/website-builder/data/property-listings'
import { websites } from '~/components/website-builder/data/websites'
import { useWebsiteQuote } from '~/composables/useWebsiteQuote'

/** Quotes a real stay under the rule set being edited, next to what the listing charges without it. */
const props = defineProps<{ ruleSet: WebsiteRuleSet }>()

const { quoteStay } = useWebsiteQuote()

const today = isoDate(new Date())
const websiteId = ref<string>('')
const listingId = ref<string>('')
const checkIn = ref<string | null>(isoDate(addDays(new Date(), 30)))
const nights = ref(7)

const siteOptions = computed(() => websites.value.filter(w => props.ruleSet.websiteIds.includes(w.id)))

// A site with no coverage recorded may sell anything, so offer every listing.
const listingOptions = computed(() => {
  const site = websites.value.find(w => w.id === websiteId.value)
  if (!site)
    return []
  const ids = site.propertyIds?.length ? getListingIdsForWebsite(site) : listings.value.map(l => l.id)
  return listings.value.filter(l => ids.includes(l.id))
})

watch(siteOptions, (sites) => {
  if (!sites.some(s => s.id === websiteId.value))
    websiteId.value = sites[0]?.id ?? ''
}, { immediate: true })

watch(listingOptions, (options) => {
  if (!options.some(l => l.id === listingId.value))
    listingId.value = options[0]?.id ?? ''
}, { immediate: true })

const checkOut = computed(() => checkIn.value && nights.value > 0 ? isoDate(addDays(new Date(`${checkIn.value}T00:00:00`), nights.value)) : null)

const derivedNote = computed(() => {
  const { logic, value } = props.ruleSet.derivedRates
  if (logic === 'same_as_base')
    return ''
  const sign = logic.startsWith('increase') ? '+' : '-'
  return `${sign}${value}${logic.endsWith('percent') ? '%' : ' per night'}`
})

const quotes = computed(() => {
  if (!listingId.value || !checkIn.value || !checkOut.value)
    return null
  const args = { listingId: listingId.value, checkIn: checkIn.value, checkOut: checkOut.value, bookedOn: today }
  const withSet = quoteStay({ ...args, ruleSet: props.ruleSet })
  const without = quoteStay({ ...args, ruleSet: null })
  return withSet && without ? { withSet, without } : null
})

function money(currency: string, value: number) {
  const digits = currency === 'IDR' ? 0 : 2
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="wrs-price-check">
    <div>
      <h3 class="text-sm font-semibold">
        Price check
      </h3>
      <p class="text-xs text-muted-foreground">
        A stay booked today. The rule set's stay discount replaces the listing's own length of stay and weekly or monthly discounts.
      </p>
    </div>

    <p v-if="siteOptions.length === 0" class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
      Pick a website above to check a price.
    </p>

    <template v-else>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="wpc-site">Website</Label>
          <Select v-model="websiteId">
            <SelectTrigger id="wpc-site" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="site in siteOptions" :key="site.id" :value="site.id">
                {{ site.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="wpc-listing">Listing</Label>
          <Select v-model="listingId">
            <SelectTrigger id="wpc-listing" class="w-full">
              <SelectValue placeholder="No listings on this site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="listing in listingOptions" :key="listing.id" :value="listing.id">
                {{ listing.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Check-in</Label>
          <DatePicker v-model="checkIn" :min="today" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="wpc-nights">Nights</Label>
          <Input id="wpc-nights" v-model.number="nights" type="number" min="1" />
        </div>
      </div>

      <div v-if="quotes" class="flex flex-col gap-1.5 rounded-md bg-muted/60 p-3 text-sm">
        <div v-if="derivedNote" class="text-xs text-muted-foreground" data-testid="wpc-derived">
          Derived from listing base rates: {{ derivedNote }}
        </div>
        <div class="flex justify-between gap-2">
          <span class="text-muted-foreground">{{ quotes.withSet.nights }} nights</span>
          <span class="tabular-nums">{{ money(quotes.withSet.currency, quotes.withSet.subtotal) }}</span>
        </div>
        <div v-for="d in quotes.withSet.discounts" :key="d.label" class="flex justify-between gap-2">
          <span class="text-muted-foreground">{{ d.label }}</span>
          <span class="tabular-nums">-{{ money(quotes.withSet.currency, d.amount) }}</span>
        </div>
        <div class="flex justify-between gap-2 border-t pt-1.5 font-medium" data-testid="wpc-total">
          <span>On the website</span>
          <span class="tabular-nums">{{ money(quotes.withSet.currency, quotes.withSet.total) }}</span>
        </div>
        <div v-if="quotes.withSet.prepayment !== null" class="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>Charged at booking ({{ ruleSet.prepaymentPct }}%)</span>
          <span class="tabular-nums">{{ money(quotes.withSet.currency, quotes.withSet.prepayment) }}</span>
        </div>
        <div class="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>Without the rule set{{ quotes.without.discounts[0] ? ` (${quotes.without.discounts[0].label})` : '' }}</span>
          <span class="tabular-nums">{{ money(quotes.without.currency, quotes.without.total) }}</span>
        </div>
        <ul v-if="quotes.withSet.blockers.length" class="mt-1 flex flex-col gap-0.5 text-xs text-destructive">
          <li v-for="b in quotes.withSet.blockers" :key="b" class="flex items-center gap-1">
            <Icon name="lucide:circle-alert" class="size-3" aria-hidden="true" />
            {{ b }}
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
