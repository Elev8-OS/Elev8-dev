<script setup lang="ts">
import type { PromoCode } from './data/promo-codes'
import type { UpsellService } from '~/components/upsells/data/upsell-services'
import { computed, ref, watch } from 'vue'
import { bookingWidgets } from '~/components/booking-widget/data/widgets'
import { listings as allListings } from '~/components/listings/data/listings'
import { websites as allWebsites } from '~/components/website-builder/data/websites'
import { usePromoCodes } from '~/composables/usePromoCodes'
import { usePromoRedemption } from '~/composables/usePromoRedemption'
import { useUpsellServices } from '~/composables/useUpsellServices'
import { codeWideRejection } from './data/promo-code-redemption'
import { formatPromoDiscount, formatPromoLengthOfStay, formatPromoWindow, getChannelRestriction, getPromoCodeStatus, getPromoCodeTypeLabel } from './data/promo-codes'

const props = defineProps<{
  promoCode: PromoCode | null
}>()

const emit = defineEmits<{
  edit: [code: PromoCode]
  duplicate: [id: string]
  requestDelete: [code: PromoCode]
}>()

const open = defineModel<boolean>('open', { default: false })

const { getUsagesByCode } = usePromoCodes()
const { services: upsellServices } = useUpsellServices()
const { scopedListings, listingsRejectingCode, grantsAtListing } = usePromoRedemption()

const usages = computed(() => {
  if (!props.promoCode)
    return []
  return getUsagesByCode(props.promoCode.id)
})

const usagesWithLabel = computed(() => usages.value.map((link) => {
  if (link.source === 'widget') {
    const widget = bookingWidgets.value.find(w => w.id === link.sourceId)
    return { ...link, label: widget?.name ?? link.sourceId }
  }
  return { ...link, label: link.sourceId }
}))

const status = computed(() => props.promoCode ? getPromoCodeStatus(props.promoCode) : 'inactive')

const isFreeUpsell = computed(() => props.promoCode?.discountType === 'free_upsell')

// Resolve selected item IDs back to their parent service + item, then
// group by service so the detail view shows "Spa > Balinese Massage 60min"
// style context instead of a flat list of item names.
const freeUpsellGroups = computed(() => {
  if (!props.promoCode?.freeUpsellItemIds)
    return []
  const groups: { service: UpsellService, items: UpsellService['items'] }[] = []
  for (const itemId of props.promoCode.freeUpsellItemIds) {
    for (const service of upsellServices.value) {
      const item = service.items.find(i => i.id === itemId)
      if (item) {
        let group = groups.find(g => g.service.id === service.id)
        if (!group) {
          group = { service, items: [] }
          groups.push(group)
        }
        group.items.push(item)
        break
      }
    }
  }
  return groups
})

const freeUpsellTotal = computed(() => props.promoCode?.freeUpsellItemIds?.length ?? 0)

// ─── Where the code is rejected, and what a guest at one listing gets ─────────
// A free-upsell code resolves per listing: each guest gets the picked services offered at
// their property. Both views read the live upsell catalog, so a service switched off or
// re-assigned after the code was made shows here.
const rejectedListings = computed(() => props.promoCode ? listingsRejectingCode(props.promoCode) : [])

const REJECTED_NAMED = 3

const rejectedLabel = computed(() => {
  const names = rejectedListings.value
  const shown = names.slice(0, REJECTED_NAMED).join(', ')
  return names.length > REJECTED_NAMED ? `${shown} and ${names.length - REJECTED_NAMED} more` : shown
})

const previewListings = computed(() => props.promoCode ? scopedListings(props.promoCode) : [])
const previewListingId = ref('')

watch(() => props.promoCode?.id, () => {
  previewListingId.value = ''
})

/** Rejects every guest right now (inactive, expired, limit reached, booking window closed). */
const codeWide = computed(() => props.promoCode ? codeWideRejection(props.promoCode) : null)

const previewListing = computed(() => previewListings.value.find(l => l.id === previewListingId.value) ?? null)

const previewGrants = computed(() => {
  if (!props.promoCode || !previewListing.value)
    return []
  return grantsAtListing(props.promoCode, previewListing.value.name)
})

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

const assignedListings = computed(() => {
  if (!props.promoCode?.listingIds || props.promoCode.listingIds.length === 0)
    return []
  return props.promoCode.listingIds
    .map(id => allListings.value.find(l => l.id === id))
    .filter((l): l is NonNullable<typeof l> => l !== undefined)
})

const bookingWindows = computed(() => props.promoCode?.bookingWindows ?? [])
const stayWindows = computed(() => props.promoCode?.stayWindows ?? [])

const listingScopeLabel = computed(() => {
  if (!props.promoCode)
    return '—'
  if (!props.promoCode.listingIds || props.promoCode.listingIds.length === 0)
    return 'All listings'
  if (assignedListings.value.length === 0)
    return `${props.promoCode.listingIds.length} listing(s) — not found`
  return `${assignedListings.value.length} listing${assignedListings.value.length === 1 ? '' : 's'}`
})

// Channel restriction display — show which channels the code is allowed
// on and (if narrowed to websites) which website IDs it targets.
const channelRestriction = computed(() => {
  if (!props.promoCode)
    return { channel: 'widget' as ('widget' | 'website'), websiteIds: [] as string[] }
  return getChannelRestriction(props.promoCode)
})

const channelLabel = computed(() => {
  return channelRestriction.value.channel === 'widget' ? 'Widget only' : 'Website only'
})

const assignedWebsites = computed(() => {
  const { websiteIds } = channelRestriction.value
  if (websiteIds.length === 0)
    return []
  return websiteIds
    .map(id => allWebsites.value.find(w => w.id === id))
    .filter((w): w is NonNullable<typeof w> => w !== undefined)
})

const websiteScopeLabel = computed(() => {
  const { channel, websiteIds } = channelRestriction.value
  if (channel !== 'website')
    return null
  if (websiteIds.length === 0)
    return 'All websites'
  if (assignedWebsites.value.length === 0)
    return `${websiteIds.length} website(s) — not found`
  return `${assignedWebsites.value.length} website${assignedWebsites.value.length === 1 ? '' : 's'}`
})

function formatDateTime(iso: string | null | undefined) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false })
}

function statusVariant() {
  if (status.value === 'active')
    return 'default'
  if (status.value === 'expired')
    return 'secondary'
  return 'outline'
}

function onRequestDelete() {
  if (!props.promoCode)
    return
  emit('requestDelete', props.promoCode)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Promo code details</DialogTitle>
        <DialogDescription>{{ promoCode?.description || 'No description' }}</DialogDescription>
      </DialogHeader>

      <div v-if="promoCode" class="space-y-4">
        <div class="rounded-lg border p-4 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-lg font-semibold tracking-wide">{{ promoCode.code }}</span>
            <Badge :variant="statusVariant()" class="capitalize">
              {{ status }}
            </Badge>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-muted-foreground text-xs">
                Type
              </p>
              <p class="font-medium">
                {{ getPromoCodeTypeLabel(promoCode) }}
              </p>
            </div>
            <div v-if="!isFreeUpsell">
              <p class="text-muted-foreground text-xs">
                Discount
              </p>
              <p class="font-medium">
                {{ formatPromoDiscount(promoCode) }}<span v-if="promoCode.discountType === 'fixed' && promoCode.currency"> {{ promoCode.currency }}</span>
              </p>
            </div>
            <div v-if="isFreeUpsell" class="col-span-2">
              <p class="text-muted-foreground text-xs">
                Free upsell items
                <span v-if="freeUpsellTotal > 0" class="text-foreground/70">({{ freeUpsellTotal }})</span>
              </p>
              <div v-if="freeUpsellGroups.length > 0" class="mt-1 space-y-2" role="list" aria-label="Free upsell items">
                <div
                  v-for="group in freeUpsellGroups"
                  :key="group.service.id"
                  class="rounded-md border bg-muted/30 p-2"
                  role="listitem"
                >
                  <p class="text-xs font-medium text-muted-foreground">
                    {{ group.service.name }}
                  </p>
                  <ul class="mt-1 flex flex-wrap gap-1.5">
                    <li v-for="item in group.items" :key="item.id">
                      <Badge variant="secondary" class="gap-1">
                        <Icon name="lucide:sparkles" class="size-3 text-primary" aria-hidden="true" />
                        {{ item.name }}
                      </Badge>
                    </li>
                  </ul>
                </div>
              </div>
              <p v-else class="text-sm text-muted-foreground italic mt-1">
                No upsell items selected
              </p>
              <p
                v-if="rejectedListings.length > 0"
                class="mt-2 flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs"
                role="status"
              >
                <Icon name="lucide:triangle-alert" class="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  Rejected at {{ rejectedListings.length }} listing{{ rejectedListings.length === 1 ? '' : 's' }}:
                  {{ rejectedLabel }}. None of this code's upsells is offered there, or they were switched off.
                </span>
              </p>
            </div>
            <div class="col-span-2">
              <p class="text-muted-foreground text-xs">
                Assigned listings
              </p>
              <p class="font-medium">
                {{ listingScopeLabel }}
              </p>
              <ul v-if="assignedListings.length > 0" class="mt-1 flex flex-wrap gap-1.5" role="list" aria-label="Assigned listings">
                <li v-for="listing in assignedListings" :key="listing.id">
                  <Badge variant="outline" class="gap-1">
                    <Icon name="lucide:home" class="size-3" aria-hidden="true" />
                    <span class="truncate max-w-[200px]">{{ listing.name }}</span>
                  </Badge>
                </li>
              </ul>
            </div>
            <div class="col-span-2">
              <p class="text-muted-foreground text-xs">
                Channels
              </p>
              <p class="font-medium">
                {{ channelLabel }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1.5">
                <Badge v-if="channelRestriction.channel === 'widget'" variant="outline" class="gap-1">
                  <Icon name="lucide:code-2" class="size-3" aria-hidden="true" />
                  Widget
                </Badge>
                <Badge v-if="channelRestriction.channel === 'website'" variant="outline" class="gap-1">
                  <Icon name="lucide:globe" class="size-3" aria-hidden="true" />
                  Website
                </Badge>
              </div>
              <p v-if="websiteScopeLabel" class="text-xs text-muted-foreground mt-1">
                {{ websiteScopeLabel }}
              </p>
              <ul v-if="assignedWebsites.length > 0" class="mt-1 flex flex-wrap gap-1.5" role="list" aria-label="Assigned websites">
                <li v-for="website in assignedWebsites" :key="website.id">
                  <Badge variant="outline" class="gap-1">
                    <Icon name="lucide:globe" class="size-3" aria-hidden="true" />
                    <span class="truncate max-w-[200px]">{{ website.name }}</span>
                  </Badge>
                </li>
              </ul>
            </div>
            <div>
              <p class="text-muted-foreground text-xs flex items-center gap-1">
                <Icon name="lucide:calendar-clock" class="size-3" aria-hidden="true" />
                Booking window
              </p>
              <p v-if="bookingWindows.length === 0" class="font-medium">
                Any booking date
              </p>
              <ul v-else class="mt-1 space-y-0.5">
                <li v-for="(window, idx) in bookingWindows" :key="`bw-${idx}`" class="font-medium text-sm">
                  {{ formatPromoWindow(window) }}
                </li>
              </ul>
            </div>
            <div>
              <p class="text-muted-foreground text-xs flex items-center gap-1">
                <Icon name="lucide:bed" class="size-3" aria-hidden="true" />
                Stay window
              </p>
              <p v-if="stayWindows.length === 0" class="font-medium">
                Any check-in date
              </p>
              <ul v-else class="mt-1 space-y-0.5">
                <li v-for="(window, idx) in stayWindows" :key="`sw-${idx}`" class="font-medium text-sm">
                  {{ formatPromoWindow(window) }}
                </li>
              </ul>
            </div>
            <div :class="promoCode.lengthOfStayTiers && promoCode.lengthOfStayTiers.length > 0 ? 'col-span-2' : ''">
              <p class="text-muted-foreground text-xs flex items-center gap-1">
                <Icon name="lucide:moon" class="size-3" aria-hidden="true" />
                Length of stay
              </p>
              <div v-if="promoCode.lengthOfStayTiers && promoCode.lengthOfStayTiers.length > 0" class="mt-1 flex flex-wrap gap-1.5">
                <Badge
                  v-for="tier in promoCode.lengthOfStayTiers"
                  :key="tier.id"
                  variant="outline"
                  class="text-xs"
                >
                  {{ tier.minNights }}+ nights: {{ tier.value }}{{ tier.discountType === '%' ? '%' : ` ${promoCode.currency ?? 'USD'}` }} off
                </Badge>
              </div>
              <p v-else class="font-medium text-sm">
                {{ formatPromoLengthOfStay(promoCode) }}
              </p>
            </div>
            <div>
              <p class="text-muted-foreground text-xs">
                Redemptions
              </p>
              <p class="font-medium">
                {{ promoCode.redemptionCount }}<span v-if="promoCode.usageLimit"> / {{ promoCode.usageLimit }}</span>
              </p>
            </div>
            <div class="col-span-2">
              <p class="text-muted-foreground text-xs">
                Created
              </p>
              <p class="font-medium text-xs">
                {{ formatDateTime(promoCode.createdAt) }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="isFreeUpsell" class="space-y-2" data-testid="promo-listing-preview">
          <div>
            <p class="text-sm font-semibold">
              Preview for listing
            </p>
            <p class="text-xs text-muted-foreground">
              What a guest at this property gets when they enter {{ promoCode.code }}.
            </p>
          </div>
          <Select v-model="previewListingId">
            <SelectTrigger class="w-full" aria-label="Preview listing">
              <SelectValue placeholder="Pick a listing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="listing in previewListings" :key="listing.id" :value="listing.id">
                <span class="truncate">{{ listing.name }}</span>
              </SelectItem>
            </SelectContent>
          </Select>

          <div v-if="previewListing" class="rounded-md border p-3 text-sm">
            <div v-if="previewGrants.length === 0" class="flex items-start gap-2">
              <Icon name="lucide:circle-x" class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p class="font-medium">
                  Rejected at this listing
                </p>
                <p class="text-xs text-muted-foreground">
                  None of this code's upsells is offered here. The guest is told the code is not valid for this property.
                </p>
              </div>
            </div>
            <ul v-else class="space-y-3" aria-label="Free upsells at this listing">
              <li v-for="grant in previewGrants" :key="grant.serviceId" class="space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <p class="flex items-center gap-1.5 font-medium">
                    <Icon name="lucide:gift" class="size-3.5 text-primary" aria-hidden="true" />
                    {{ grant.serviceName }}
                  </p>
                  <Badge variant="outline" class="shrink-0 text-[10px] font-normal">
                    {{ grant.availability === 'by_request' ? 'Team confirms the date' : 'Confirmed on booking' }}
                  </Badge>
                </div>
                <p v-if="grant.choices.length > 1" class="text-xs text-muted-foreground">
                  Guest picks one:
                </p>
                <ul class="space-y-0.5 pl-5">
                  <li v-for="item in grant.choices" :key="item.id" class="flex items-center justify-between gap-2 text-xs">
                    <span class="truncate">{{ item.name }}</span>
                    <span class="shrink-0 tabular-nums text-muted-foreground">{{ formatPrice(item.price, grant.currency) }} value</span>
                  </li>
                </ul>
              </li>
            </ul>
          </div>
          <p class="text-xs text-muted-foreground">
            One item per service, once per stay. Dates, usage limit and channel are checked when the guest books.
            <template v-if="codeWide">
              Right now every guest is rejected: "{{ codeWide.message }}"
            </template>
          </p>
        </div>

        <div>
          <p class="text-sm font-semibold mb-2">
            Used in
          </p>
          <div v-if="usagesWithLabel.length === 0" class="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
            Not linked to any widget or site yet.
          </div>
          <ul v-else class="space-y-2" role="list">
            <li v-for="link in usagesWithLabel" :key="`${link.source}-${link.sourceId}`" class="flex items-center justify-between gap-3 rounded-md border p-3">
              <div class="flex items-center gap-2">
                <Icon :name="link.source === 'widget' ? 'lucide:code-2' : 'lucide:globe'" class="size-4 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p class="text-sm font-medium">
                    {{ link.label }}
                  </p>
                  <p class="text-xs text-muted-foreground capitalize">
                    {{ link.source }}
                  </p>
                </div>
              </div>
              <span class="text-sm text-muted-foreground">{{ link.usageCount }} redemptions</span>
            </li>
          </ul>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="onRequestDelete">
          <Icon name="lucide:trash-2" class="size-4 mr-1.5" aria-hidden="true" />
          Delete
        </Button>
        <Button variant="outline" @click="emit('duplicate', promoCode?.id ?? '')">
          <Icon name="lucide:copy-plus" class="size-4 mr-1.5" aria-hidden="true" />
          Duplicate
        </Button>
        <Button @click="emit('edit', promoCode as PromoCode)">
          <Icon name="lucide:pencil" class="size-4 mr-1.5" aria-hidden="true" />
          Edit
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
