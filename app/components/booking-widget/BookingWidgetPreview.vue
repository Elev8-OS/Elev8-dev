<script setup lang="ts">
import type { BookingWidgetEmbedPreview } from '~/components/booking-widget/data/widgets'

const props = defineProps<{
  widget: BookingWidgetEmbedPreview
  listings: Array<{
    id: string
    name: string
    location: string
    capacity: number
    pricing: { nightlyRate: number }
    photos: string[]
    websiteEnabled: boolean
    description: string
    currency: string
  }>
}>()

const activeListingId = ref(props.widget.primaryListingId ?? props.widget.listingIds[0] ?? props.listings[0]?.id ?? '')

watch(
  () => [props.widget.id, props.widget.primaryListingId, props.widget.listingIds.join(',')],
  () => {
    activeListingId.value = props.widget.primaryListingId ?? props.widget.listingIds[0] ?? props.listings[0]?.id ?? ''
  },
)

const selectedListing = computed(() => props.listings.find(listing => listing.id === activeListingId.value) ?? null)

function getEmbedSnippet() {
  const listingAttr = props.widget.mode === 'single'
    ? `data-listing="${props.widget.primaryListingId ?? props.widget.listingIds[0] ?? ''}"`
    : `data-listings="${props.widget.listingIds.join(',')}"`

  return [
    '<' + 'script async src="https://booking.elev8-suite.com/v1/elev8-booking.js"></' + 'script>',
    `<div class="e8bk-root" ${listingAttr} data-widget-id="${props.widget.id}"></div>`,
  ].join('\n')
}

const embedSnippet = computed(() => getEmbedSnippet())

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

const stayDiscountNights = computed(() => (props.widget.lengthOfStayDiscounts ?? []).map((t: { minNights: number }) => t.minNights).join(', '))
</script>

<template>
  <div class="overflow-hidden rounded-xl border bg-background">
    <div class="border-b bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold truncate">
          Booking Widget Preview
        </p>
        <p class="text-xs text-muted-foreground truncate">
          {{ widget.name }}
        </p>
      </div>
      <Badge variant="outline" class="shrink-0">
        {{ widget.mode === 'single' ? 'Single' : 'Multi' }}
      </Badge>
    </div>

    <div class="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section class="min-w-0 p-4 lg:p-5 space-y-4">
        <div class="rounded-xl border bg-card p-4 shadow-sm" :style="{ borderRadius: `${widget.cornerRadius}px` }">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                Step 1 of 5
              </p>
              <h3 class="mt-1 text-lg font-semibold truncate">
                Direct booking flow
              </h3>
            </div>
            <div class="size-3 rounded-full shrink-0" :style="{ backgroundColor: widget.accentColor }" />
          </div>

          <div v-if="widget.mode === 'multi'" class="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              v-for="listing in listings.slice(0, 4)"
              :key="listing.id"
              type="button"
              class="rounded-lg border p-3 text-left transition-colors"
              :class="listing.id === activeListingId ? 'border-foreground bg-muted' : 'hover:bg-muted/60'"
              @click="activeListingId = listing.id"
            >
              <p class="text-sm font-medium truncate">
                {{ listing.name }}
              </p>
              <p class="text-xs text-muted-foreground truncate">
                {{ listing.location }} · {{ listing.capacity }} guests
              </p>
            </button>
          </div>

          <div class="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div class="min-w-0 space-y-3">
              <div class="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <img
                  v-if="selectedListing?.photos[0]"
                  :src="selectedListing.photos[0]"
                  :alt="selectedListing.name"
                  class="size-full object-cover"
                >
              </div>
              <div class="space-y-1">
                <p class="text-base font-semibold truncate">
                  {{ selectedListing?.name ?? 'Select a listing' }}
                </p>
                <p class="text-sm text-muted-foreground truncate">
                  {{ selectedListing?.location ?? 'Listing preview appears here' }}
                </p>
              </div>
            </div>

            <div class="min-w-0 space-y-3 rounded-lg border bg-background p-4">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-muted-foreground">Nightly rate</span>
                <span class="font-medium tabular-nums">{{ formatMoney(selectedListing?.pricing.nightlyRate ?? 0) }}</span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-muted-foreground">Deposit</span>
                <span class="font-medium tabular-nums">{{ widget.depositPct }}%</span>
              </div>
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-muted-foreground">Lead time</span>
                <span class="font-medium tabular-nums">{{ widget.minDaysBeforeArrival }} days</span>
              </div>
              <div class="border-t pt-3 flex items-center justify-between gap-3 text-sm font-medium">
                <span>Estimated deposit</span>
                <span class="tabular-nums">{{ formatMoney(Math.ceil((selectedListing?.pricing.nightlyRate ?? 0) * 3 * (widget.depositPct / 100))) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="min-w-0 border-t bg-muted/20 p-4 lg:border-t-0 lg:border-l lg:p-5 space-y-4">
        <div class="space-y-1">
          <p class="text-sm font-semibold">
            Embed snippet
          </p>
          <p class="text-xs text-muted-foreground">
            Paste both lines into the partner site.
          </p>
        </div>
        <pre class="overflow-auto rounded-lg border bg-background p-3 text-xs leading-5 text-foreground whitespace-pre-wrap break-words">{{ embedSnippet }}</pre>

        <div class="grid gap-3 rounded-lg border bg-background p-4 text-sm">
          <div class="space-y-1" data-testid="widget-preview-rules">
            <div class="flex items-center justify-between gap-3">
              <span class="text-muted-foreground">Booking rules</span>
              <span class="truncate font-medium">{{ widget.websiteRuleSetName ? `Website: ${widget.websiteRuleSetName}` : 'This widget' }}</span>
            </div>
            <p v-if="widget.lengthOfStayDiscounts?.length" class="text-xs text-muted-foreground">
              Stay discounts from {{ stayDiscountNights }} nights
            </p>
            <p v-if="widget.minNights" class="text-xs text-muted-foreground">
              Stays of {{ widget.minNights }}{{ widget.maxNights ? ` to ${widget.maxNights}` : '+' }} nights
            </p>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">Allowed domains</span>
            <span class="font-medium">{{ widget.allowedDomains.length }}</span>
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-3">
              <span class="text-muted-foreground">Promo codes</span>
              <span class="font-medium">{{ widget.promoCodes.length }}</span>
            </div>
            <div v-if="widget.promoCodes.length" class="flex flex-wrap gap-1">
              <Badge v-for="p in widget.promoCodes.slice(0, 3)" :key="p.id" variant="secondary" class="text-[10px] font-mono">
                {{ p.code }}
              </Badge>
              <Badge v-if="widget.promoCodes.length > 3" variant="outline" class="text-[10px]">
                +{{ widget.promoCodes.length - 3 }}
              </Badge>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="text-muted-foreground">Accent color</span>
            <span class="font-medium font-mono">{{ widget.accentColor }}</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
