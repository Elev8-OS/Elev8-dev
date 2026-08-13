<script setup lang="ts">
import type { PromoCode } from './data/promo-codes'
import { computed } from 'vue'
import { bookingWidgets } from '~/components/booking-widget/data/widgets'
import { listings as allListings } from '~/components/listings/data/listings'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'
import { websites as allWebsites } from '~/components/website-builder/data/websites'
import { usePromoCodes } from '~/composables/usePromoCodes'
import { formatPromoDiscount, formatPromoWindow, getChannelRestriction, getPromoCodeStatus, getPromoCodeTypeLabel } from './data/promo-codes'

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
  const groups: { service: typeof mockUpsellServices[number], items: typeof mockUpsellServices[number]['items'] }[] = []
  for (const itemId of props.promoCode.freeUpsellItemIds) {
    for (const service of mockUpsellServices) {
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
  return new Date(iso).toLocaleString()
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
                Any time
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
                Any check-in
              </p>
              <ul v-else class="mt-1 space-y-0.5">
                <li v-for="(window, idx) in stayWindows" :key="`sw-${idx}`" class="font-medium text-sm">
                  {{ formatPromoWindow(window) }}
                </li>
              </ul>
            </div>
            <div>
              <p class="text-muted-foreground text-xs">
                Redemptions
              </p>
              <p class="font-medium">
                {{ promoCode.redemptionCount }}<span v-if="promoCode.usageLimit"> / {{ promoCode.usageLimit }}</span>
              </p>
            </div>
            <div>
              <p class="text-muted-foreground text-xs">
                Created
              </p>
              <p class="font-medium text-xs">
                {{ formatDateTime(promoCode.createdAt) }}
              </p>
            </div>
          </div>
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
