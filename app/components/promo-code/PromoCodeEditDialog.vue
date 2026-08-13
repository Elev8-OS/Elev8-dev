<script setup lang="ts">
import type { PromoCode, PromoCodeChannel, PromoCodeDiscountType, PromoCodeWindow } from './data/promo-codes'
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings as allListings, allTags } from '~/components/listings/data/listings'
import { Switch } from '~/components/ui/switch'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'
import { websites as allWebsites } from '~/components/website-builder/data/websites'
import { usePromoCodes } from '~/composables/usePromoCodes'

const props = defineProps<{
  promoCode: PromoCode | null
}>()

const emit = defineEmits<{
  updated: [codeId: string]
}>()

const open = defineModel<boolean>('open', { default: false })

const { updatePromoCode, isCodeTaken } = usePromoCodes()

const code = ref('')
const description = ref('')
const discountType = ref<PromoCodeDiscountType>('%')
const value = ref<number>(10)
const currency = ref<string>('USD')
const bookingWindows = ref<PromoCodeWindow[]>([])
const stayWindows = ref<PromoCodeWindow[]>([])
const usageLimit = ref<number | null>(null)
const active = ref(true)
const freeUpsellItemIds = ref<string[]>([])
const listingIds = ref<string[]>([])
// Channel restriction — pulled from the promo code on hydrate.
const channel = ref<PromoCodeChannel>('widget')
const websiteIds = ref<string[]>([])

// Search-state refs must be declared before hydrate() because that
// function clears them on entry.
const freeUpsellSearch = ref('')
const expandedServiceIds = ref<string[]>([])
const listingSearch = ref('')
const websiteSearch = ref('')

const codeError = ref('')
const freeUpsellError = ref('')

const codeInputRef = ref<HTMLInputElement | null>(null)
const upsellTriggerRef = ref<HTMLButtonElement | null>(null)

const currencyOptions = ['USD', 'EUR', 'GBP', 'IDR', 'CHF', 'AUD', 'JPY']

const isFreeUpsell = computed(() => discountType.value === 'free_upsell')

function hydrate() {
  const c = props.promoCode
  if (!c)
    return
  code.value = c.code
  description.value = c.description ?? ''
  discountType.value = c.discountType
  value.value = c.discountType === 'free_upsell' ? 0 : c.value
  currency.value = c.currency ?? 'USD'
  bookingWindows.value = (c.bookingWindows ?? []).map(w => ({ from: w.from ?? null, until: w.until ?? null }))
  stayWindows.value = (c.stayWindows ?? []).map(w => ({ from: w.from ?? null, until: w.until ?? null }))
  usageLimit.value = c.usageLimit ?? null
  active.value = c.active
  freeUpsellItemIds.value = c.freeUpsellItemIds ? [...c.freeUpsellItemIds] : []
  listingIds.value = c.listingIds ? [...c.listingIds] : []
  channel.value = c.channelRestriction ? c.channelRestriction.channel : 'widget'
  websiteIds.value = c.channelRestriction ? [...c.channelRestriction.websiteIds] : []
  codeError.value = ''
  freeUpsellError.value = ''
  freeUpsellSearch.value = ''
  listingSearch.value = ''
  websiteSearch.value = ''
}

watch(open, (isOpen) => {
  if (isOpen) {
    hydrate()
    // Auto-expand any service that already has at least one selected
    // item so the user can see what's currently configured.
    const expanded = new Set<string>()
    for (const id of freeUpsellItemIds.value) {
      for (const service of mockUpsellServices) {
        if (service.items.some(item => item.id === id))
          expanded.add(service.id)
      }
    }
    expandedServiceIds.value = [...expanded]
  }
})

watch(() => props.promoCode, () => {
  if (open.value)
    hydrate()
})

function onCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  const upper = target.value.toUpperCase().replace(/\s+/g, '')
  code.value = upper
  target.value = upper
  codeError.value = ''
}

// ─── Free Upsell items picker ──────────────────────────────────────────────
// Selection is by UpsellItem (the unit the guest actually redeems). Items
// are nested under their parent UpsellService in the picker so the user can
// see context (e.g. "Spa > Balinese Massage 60min"). The picker shows
// services as collapsible rows; clicking a service reveals its items.
const freeUpsellOpen = ref(false)
// freeUpsellSearch + expandedServiceIds declared above (before hydrate)

const upsellItemIndex = computed(() => {
  const map = new Map<string, { service: typeof mockUpsellServices[number], item: typeof mockUpsellServices[number]['items'][number] }>()
  for (const service of mockUpsellServices) {
    for (const item of service.items) {
      map.set(item.id, { service, item })
    }
  }
  return map
})

const filteredUpsellServices = computed(() => {
  const query = freeUpsellSearch.value.trim().toLowerCase()
  if (!query)
    return mockUpsellServices
  return mockUpsellServices.filter((s) => {
    const serviceHaystack = `${s.name} ${s.category}`.toLowerCase()
    if (serviceHaystack.includes(query))
      return true
    return s.items.some(item => `${item.name} ${item.description ?? ''}`.toLowerCase().includes(query))
  })
})

const selectedUpsellItems = computed(() =>
  freeUpsellItemIds.value
    .map(id => upsellItemIndex.value.get(id))
    .filter((entry): entry is { service: typeof mockUpsellServices[number], item: typeof mockUpsellServices[number]['items'][number] } => entry !== undefined),
)

function toggleUpsellItem(id: string) {
  freeUpsellItemIds.value = freeUpsellItemIds.value.includes(id)
    ? freeUpsellItemIds.value.filter(x => x !== id)
    : [...freeUpsellItemIds.value, id]
  freeUpsellError.value = ''
}

function isServicePartiallySelected(service: typeof mockUpsellServices[number]) {
  const hits = service.items.filter(item => freeUpsellItemIds.value.includes(item.id)).length
  return hits > 0 && hits < service.items.length
}

function isServiceFullySelected(service: typeof mockUpsellServices[number]) {
  return service.items.length > 0 && service.items.every(item => freeUpsellItemIds.value.includes(item.id))
}

function toggleService(service: typeof mockUpsellServices[number]) {
  const ids = service.items.map(item => item.id)
  if (isServiceFullySelected(service)) {
    freeUpsellItemIds.value = freeUpsellItemIds.value.filter(id => !ids.includes(id))
  }
  else {
    const set = new Set(freeUpsellItemIds.value)
    for (const id of ids)
      set.add(id)
    freeUpsellItemIds.value = [...set]
  }
  freeUpsellError.value = ''
}

function toggleServiceExpand(serviceId: string) {
  expandedServiceIds.value = expandedServiceIds.value.includes(serviceId)
    ? expandedServiceIds.value.filter(x => x !== serviceId)
    : [...expandedServiceIds.value, serviceId]
}

function clearUpsellItems() {
  freeUpsellItemIds.value = []
  expandedServiceIds.value = []
  freeUpsellError.value = ''
}

function upsellTriggerLabel() {
  const n = freeUpsellItemIds.value.length
  if (n === 0)
    return 'Select upsell items'
  if (n === 1)
    return '1 item selected'
  return `${n} items selected`
}

watch(freeUpsellOpen, (open) => {
  if (!open)
    freeUpsellSearch.value = ''
})

// ─── Listings picker ────────────────────────────────────────────────────────
const listingOpen = ref(false)
// listingSearch declared above (before hydrate)
const listingTagsFilter = ref<string[]>([])
const tagPopoverOpen = ref(false)
const tagSearch = ref('')

const filteredTags = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  if (!q)
    return allTags.value
  return allTags.value.filter(t => t.toLowerCase().includes(q))
})

const filteredListings = computed(() => {
  const query = listingSearch.value.trim().toLowerCase()
  let result = allListings.value

  // When this is a Free Upsell code with at least one selected upsell
  // item, derive the parent services from those items and restrict to
  // listings assigned to ALL parent services (intersection). Assigned
  // listings are matched by name since UpsellService.assignedListings uses
  // names, not IDs.
  if (isFreeUpsell.value && freeUpsellItemIds.value.length > 0) {
    const parentServiceIds = new Set<string>()
    for (const id of freeUpsellItemIds.value) {
      const entry = upsellItemIndex.value.get(id)
      if (entry)
        parentServiceIds.add(entry.service.id)
    }
    const selectedServices = mockUpsellServices.filter(s => parentServiceIds.has(s.id))
    const allowedNames = selectedServices.reduce<Set<string> | null>((acc, service) => {
      const names = new Set(service.assignedListings)
      if (acc === null)
        return names
      const next = new Set<string>()
      for (const n of acc) {
        if (names.has(n))
          next.add(n)
      }
      return next
    }, null)
    if (allowedNames && allowedNames.size > 0) {
      result = result.filter(l => allowedNames.has(l.name))
    }
  }

  if (listingTagsFilter.value.length > 0) {
    // AND logic: listing must contain every selected tag
    result = result.filter(l => listingTagsFilter.value.every(t => l.tags.includes(t)))
  }
  if (query) {
    result = result.filter((l) => {
      const haystack = `${l.name} ${l.location ?? ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }
  return result
})

const listingsFilteredByUpsell = computed(() =>
  isFreeUpsell.value && freeUpsellItemIds.value.length > 0,
)

function toggleListing(id: string) {
  listingIds.value = listingIds.value.includes(id)
    ? listingIds.value.filter(x => x !== id)
    : [...listingIds.value, id]
}

function toggleListingTag(tag: string) {
  listingTagsFilter.value = listingTagsFilter.value.includes(tag)
    ? listingTagsFilter.value.filter(x => x !== tag)
    : [...listingTagsFilter.value, tag]
}

function clearListingTags() {
  listingTagsFilter.value = []
}

function clearListings() {
  listingIds.value = []
}

function listingTriggerLabel() {
  const n = listingIds.value.length
  if (n === 0)
    return 'All listings'
  if (n === 1)
    return '1 listing'
  return `${n} listings`
}

watch(listingOpen, (open) => {
  if (!open) {
    listingSearch.value = ''
    listingTagsFilter.value = []
    tagSearch.value = ''
  }
})

watch(tagPopoverOpen, (open) => {
  if (!open)
    tagSearch.value = ''
})

// ─── Channel restriction ────────────────────────────────────────────────────
// Choose which channel the code can be redeemed on. Every code is pinned
// to one channel. When channel === 'website' the website picker
// underneath lets the host narrow down to specific websites — empty
// `websiteIds` with channel === 'website' means "every website".
const websitePickerOpen = ref(false)

const isWebsiteChannel = computed(() => channel.value === 'website')

const filteredWebsites = computed(() => {
  const q = websiteSearch.value.trim().toLowerCase()
  if (!q)
    return allWebsites.value
  return allWebsites.value.filter((w) => {
    const haystack = `${w.name} ${w.url} ${w.template}`.toLowerCase()
    return haystack.includes(q)
  })
})

function selectChannel(next: PromoCodeChannel) {
  channel.value = next
  if (next !== 'website')
    websiteIds.value = []
}

function toggleWebsite(id: string) {
  websiteIds.value = websiteIds.value.includes(id)
    ? websiteIds.value.filter(x => x !== id)
    : [...websiteIds.value, id]
}

function clearWebsites() {
  websiteIds.value = []
}

function websiteTriggerLabel() {
  const n = websiteIds.value.length
  if (n === 0)
    return 'All websites'
  if (n === 1)
    return '1 website selected'
  return `${n} websites selected`
}

watch(websitePickerOpen, (open) => {
  if (!open)
    websiteSearch.value = ''
})

// ─── Validity windows ──────────────────────────────────────────────────────
function addBookingWindow() {
  bookingWindows.value = [...bookingWindows.value, { from: null, until: null }]
}

function removeBookingWindow(idx: number) {
  bookingWindows.value = bookingWindows.value.filter((_, i) => i !== idx)
}

function updateBookingWindow(idx: number, key: 'from' | 'until', value: string) {
  bookingWindows.value = bookingWindows.value.map((w, i) => (i === idx ? { ...w, [key]: value || null } : w))
}

function addStayWindow() {
  stayWindows.value = [...stayWindows.value, { from: null, until: null }]
}

function removeStayWindow(idx: number) {
  stayWindows.value = stayWindows.value.filter((_, i) => i !== idx)
}

function updateStayWindow(idx: number, key: 'from' | 'until', value: string) {
  stayWindows.value = stayWindows.value.map((w, i) => (i === idx ? { ...w, [key]: value || null } : w))
}

// ─── Submit ────────────────────────────────────────────────────────────────
function submit() {
  if (!props.promoCode)
    return
  const trimmed = code.value.trim()
  if (!trimmed) {
    codeError.value = 'Code is required'
    nextTick(() => codeInputRef.value?.focus())
    return
  }
  if (isCodeTaken(trimmed, props.promoCode.id)) {
    codeError.value = 'A code with this value already exists'
    nextTick(() => codeInputRef.value?.focus())
    return
  }
  if (isFreeUpsell.value && freeUpsellItemIds.value.length === 0) {
    freeUpsellError.value = 'Select at least one upsell item for a Free Upsell code'
    nextTick(() => upsellTriggerRef.value?.focus())
    return
  }
  if (!isFreeUpsell.value && (!value.value || value.value <= 0)) {
    toast.error('Value must be greater than 0')
    return
  }

  updatePromoCode(props.promoCode.id, {
    code: trimmed,
    description: description.value.trim() || undefined,
    discountType: discountType.value,
    value: isFreeUpsell.value ? 0 : value.value,
    currency: discountType.value === 'fixed' ? currency.value : null,
    active: active.value,
    bookingWindows: bookingWindows.value.map(w => ({ from: w.from || null, until: w.until || null })),
    stayWindows: stayWindows.value.map(w => ({ from: w.from || null, until: w.until || null })),
    usageLimit: usageLimit.value,
    freeUpsellItemIds: isFreeUpsell.value ? freeUpsellItemIds.value : [],
    listingIds: listingIds.value,
    channelRestriction: {
      channel: channel.value,
      websiteIds: isWebsiteChannel.value ? [...websiteIds.value] : [],
    },
  })

  toast.success(`Code ${trimmed} updated`)
  emit('updated', props.promoCode.id)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit promo code</DialogTitle>
        <DialogDescription>Update the code details. Existing usages are not affected.</DialogDescription>
      </DialogHeader>

      <form v-if="promoCode" class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="promo-edit-code">Code</Label>
          <Input
            id="promo-edit-code"
            ref="codeInputRef"
            :model-value="code"
            placeholder="WELCOME10"
            class="font-mono uppercase"
            :class="codeError ? 'border-destructive' : ''"
            :aria-invalid="codeError ? 'true' : 'false'"
            aria-describedby="promo-edit-code-error"
            @input="onCodeInput"
          />
          <p
            v-if="codeError"
            id="promo-edit-code-error"
            role="alert"
            class="text-xs text-destructive"
          >
            {{ codeError }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="promo-edit-description">
            Description <span class="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea id="promo-edit-description" v-model="description" placeholder="What is this code for?" rows="2" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="promo-edit-type">Type</Label>
            <Select v-model="discountType">
              <SelectTrigger id="promo-edit-type" aria-label="Discount type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="%">
                  Percentage
                </SelectItem>
                <SelectItem value="fixed">
                  Fixed amount
                </SelectItem>
                <SelectItem value="free_upsell">
                  Free Upsell
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="!isFreeUpsell" class="space-y-2">
            <Label for="promo-edit-value">Value</Label>
            <div class="flex items-center gap-2">
              <span v-if="discountType === 'fixed'" aria-hidden="true" class="rounded-md border bg-muted px-2 py-1 text-xs font-medium text-foreground">{{ currency }}</span>
              <span v-else aria-hidden="true" class="rounded-md border bg-muted px-2 py-1 text-xs font-medium text-foreground">%</span>
              <Input id="promo-edit-value" v-model.number="value" type="number" min="1" class="flex-1" />
            </div>
          </div>
        </div>

        <div v-if="discountType === 'fixed'" class="space-y-2">
          <Label for="promo-edit-currency">Currency</Label>
          <Select v-model="currency">
            <SelectTrigger id="promo-edit-currency" aria-label="Currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in currencyOptions" :key="c" :value="c">
                {{ c }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Free Upsell items picker -->
        <div v-if="isFreeUpsell" class="space-y-2">
          <Label for="promo-edit-upsell-trigger">
            Free upsell items
            <span class="text-muted-foreground font-normal">(required)</span>
          </Label>
          <Popover v-model:open="freeUpsellOpen">
            <PopoverTrigger as-child>
              <Button
                id="promo-edit-upsell-trigger"
                ref="upsellTriggerRef"
                variant="outline"
                class="w-full justify-between"
                :aria-invalid="freeUpsellError ? 'true' : 'false'"
                :aria-describedby="freeUpsellError ? 'promo-edit-upsell-error' : undefined"
              >
                <span class="truncate">{{ upsellTriggerLabel() }}</span>
                <div class="flex items-center gap-2">
                  <Badge v-if="freeUpsellItemIds.length > 0" variant="secondary" class="h-4 min-w-4 rounded-full px-1 text-[9px]" :aria-label="`${freeUpsellItemIds.length} selected`">
                    {{ freeUpsellItemIds.length }}
                  </Badge>
                  <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[420px] p-0" align="start" :side-offset="4">
              <div class="p-2 border-b">
                <Input v-model="freeUpsellSearch" placeholder="Search upsell services or items..." class="h-8 text-sm" aria-label="Search upsell services or items" />
              </div>
              <div class="max-h-80 overflow-y-auto">
                <p v-if="filteredUpsellServices.length === 0" class="px-3 py-6 text-center text-xs text-muted-foreground">
                  No upsell services found.
                </p>
                <div
                  v-for="service in filteredUpsellServices"
                  :key="service.id"
                  class="border-b last:border-b-0"
                >
                  <div class="flex w-full items-center gap-2 px-2 py-2">
                    <button
                      type="button"
                      class="flex flex-1 items-center gap-2 text-left"
                      :aria-label="`Toggle ${service.name}`"
                      :aria-expanded="expandedServiceIds.includes(service.id) ? 'true' : 'false'"
                      @click="toggleServiceExpand(service.id)"
                    >
                      <Icon
                        name="lucide:chevron-right"
                        class="size-3.5 shrink-0 text-muted-foreground transition-transform"
                        :class="expandedServiceIds.includes(service.id) ? 'rotate-90' : ''"
                        aria-hidden="true"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate">
                          {{ service.name }}
                        </p>
                        <p class="text-xs text-muted-foreground truncate">
                          {{ service.category }} · {{ service.items.length }} item{{ service.items.length === 1 ? '' : 's' }}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                      :class="isServiceFullySelected(service) ? 'border-primary bg-primary text-primary-foreground' : isServicePartiallySelected(service) ? 'border-primary bg-primary/20 text-primary' : 'border-input'"
                      role="checkbox"
                      :aria-checked="isServiceFullySelected(service) ? 'true' : isServicePartiallySelected(service) ? 'mixed' : 'false'"
                      :aria-label="`Select all items in ${service.name}`"
                      @click="toggleService(service)"
                    >
                      <Icon v-if="isServiceFullySelected(service)" name="lucide:check" class="size-3" aria-hidden="true" />
                      <span v-else-if="isServicePartiallySelected(service)" class="text-[10px] leading-none font-bold" aria-hidden="true">−</span>
                    </button>
                  </div>
                  <ul v-if="expandedServiceIds.includes(service.id)" class="pb-1">
                    <li
                      v-for="item in service.items"
                      :key="item.id"
                      class="flex items-start gap-2 px-2 py-1.5 pl-9 hover:bg-muted/50"
                    >
                      <button
                        type="button"
                        class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                        :class="freeUpsellItemIds.includes(item.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                        role="checkbox"
                        :aria-checked="freeUpsellItemIds.includes(item.id) ? 'true' : 'false'"
                        :aria-label="`Toggle ${item.name}`"
                        @click="toggleUpsellItem(item.id)"
                      >
                        <Icon v-if="freeUpsellItemIds.includes(item.id)" name="lucide:check" class="size-3" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        class="flex-1 min-w-0 text-left"
                        @click="toggleUpsellItem(item.id)"
                      >
                        <p class="text-sm truncate">
                          {{ item.name }}
                        </p>
                        <p v-if="item.description" class="text-xs text-muted-foreground line-clamp-2">
                          {{ item.description }}
                        </p>
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
              <div class="flex items-center justify-between gap-2 border-t p-2">
                <Button v-if="freeUpsellItemIds.length > 0" type="button" variant="ghost" size="sm" class="h-6 text-xs" @click="clearUpsellItems">
                  Clear
                </Button>
                <span v-else class="text-xs text-muted-foreground" aria-live="polite">No items selected</span>
                <Button type="button" size="sm" class="h-7" @click="freeUpsellOpen = false">
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <ul v-if="selectedUpsellItems.length > 0" class="flex flex-wrap gap-1.5" role="list" aria-label="Selected upsell items">
            <li v-for="entry in selectedUpsellItems" :key="entry.item.id">
              <Badge variant="secondary" class="gap-1 pr-1">
                <Icon name="lucide:sparkles" class="size-3 text-primary-foreground" aria-hidden="true" />
                <span class="text-xs">{{ entry.item.name }}</span>
                <button
                  type="button"
                  class="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                  :aria-label="`Remove ${entry.item.name}`"
                  @click="toggleUpsellItem(entry.item.id)"
                >
                  <Icon name="lucide:x" class="size-3 text-primary-foreground" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          </ul>
          <p
            v-if="freeUpsellError"
            id="promo-edit-upsell-error"
            role="alert"
            class="text-xs text-destructive"
          >
            {{ freeUpsellError }}
          </p>
        </div>

        <!-- Channel restriction -->
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div>
              <Label>Restrict to property channel</Label>
              <p class="text-xs text-muted-foreground">
                Choose which channel this code can be redeemed on.
              </p>
            </div>
          </div>
          <RadioGroup
            :model-value="channel"
            class="grid grid-cols-1 gap-2 sm:grid-cols-2"
            @update:model-value="(v: string) => selectChannel(v as PromoCodeChannel)"
          >
            <label
              class="flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/40"
              :class="channel === 'widget' ? 'border-primary bg-primary/5' : ''"
            >
              <RadioGroupItem id="promo-edit-channel-widget" value="widget" class="mt-0.5" />
              <div class="min-w-0">
                <p class="text-sm font-medium flex items-center gap-1.5">
                  <Icon name="lucide:code-2" class="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Widget only
                </p>
                <p class="text-xs text-muted-foreground">
                  Embedded booking widgets on partner sites.
                </p>
              </div>
            </label>
            <label
              class="flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/40"
              :class="channel === 'website' ? 'border-primary bg-primary/5' : ''"
            >
              <RadioGroupItem id="promo-edit-channel-website" value="website" class="mt-0.5" />
              <div class="min-w-0">
                <p class="text-sm font-medium flex items-center gap-1.5">
                  <Icon name="lucide:globe" class="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Website only
                </p>
                <p class="text-xs text-muted-foreground">
                  Property websites built with the Website Builder.
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>

        <!-- Website picker (only when Website channel is selected) -->
        <div v-if="isWebsiteChannel" class="space-y-2">
          <Label for="promo-edit-websites-trigger">
            Apply to websites
            <span class="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Popover v-model:open="websitePickerOpen">
            <PopoverTrigger as-child>
              <Button
                id="promo-edit-websites-trigger"
                variant="outline"
                class="w-full justify-between"
              >
                <span class="truncate">{{ websiteTriggerLabel() }}</span>
                <div class="flex items-center gap-2">
                  <Badge v-if="websiteIds.length > 0" variant="secondary" class="h-4 min-w-4 rounded-full px-1 text-[9px]" :aria-label="`${websiteIds.length} selected`">
                    {{ websiteIds.length }}
                  </Badge>
                  <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[420px] p-0" align="start" :side-offset="4">
              <div class="p-2 border-b">
                <div class="relative">
                  <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input v-model="websiteSearch" placeholder="Search websites..." class="h-8 pl-7 text-sm" aria-label="Search websites" />
                </div>
              </div>
              <div class="max-h-72 overflow-y-auto">
                <p v-if="filteredWebsites.length === 0" class="px-3 py-6 text-center text-xs text-muted-foreground">
                  No websites found.
                </p>
                <ul class="py-1">
                  <li
                    v-for="website in filteredWebsites"
                    :key="website.id"
                    class="flex items-start gap-2 px-2 py-1.5 hover:bg-muted/50"
                  >
                    <button
                      type="button"
                      class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                      :class="websiteIds.includes(website.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                      role="checkbox"
                      :aria-checked="websiteIds.includes(website.id) ? 'true' : 'false'"
                      :aria-label="`Toggle ${website.name}`"
                      @click="toggleWebsite(website.id)"
                    >
                      <Icon v-if="websiteIds.includes(website.id)" name="lucide:check" class="size-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="flex-1 min-w-0 text-left"
                      @click="toggleWebsite(website.id)"
                    >
                      <p class="text-sm font-medium truncate flex items-center gap-1.5">
                        <Icon name="lucide:globe" class="size-3 text-muted-foreground" aria-hidden="true" />
                        {{ website.name }}
                      </p>
                      <p class="text-xs text-muted-foreground truncate">
                        {{ website.url }} · {{ website.template }}
                      </p>
                    </button>
                  </li>
                </ul>
              </div>
              <div class="flex items-center justify-between gap-2 border-t p-2">
                <Button v-if="websiteIds.length > 0" type="button" variant="ghost" size="sm" class="h-6 text-xs" @click="clearWebsites">
                  Clear
                </Button>
                <span v-else class="text-xs text-muted-foreground" aria-live="polite">No websites = applies to all</span>
                <Button type="button" size="sm" class="h-7" @click="websitePickerOpen = false">
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <p class="text-xs text-muted-foreground">
            {{ websiteIds.length === 0
              ? 'No specific websites selected — code applies to every website.'
              : `Code applies to ${websiteIds.length} selected website${websiteIds.length === 1 ? '' : 's'}.` }}
          </p>
        </div>

        <!-- Assigned listings picker -->
        <div class="space-y-2">
          <Label for="promo-edit-listings-trigger">
            Assigned listings
            <span class="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Popover v-model:open="listingOpen">
            <PopoverTrigger as-child>
              <Button
                id="promo-edit-listings-trigger"
                variant="outline"
                class="w-full justify-between"
              >
                <span class="truncate">{{ listingTriggerLabel() }}</span>
                <div class="flex items-center gap-2">
                  <Badge
                    v-if="listingsFilteredByUpsell"
                    variant="outline"
                    class="h-5 gap-1 border-primary/40 bg-primary/10 px-1.5 text-[10px] text-primary-foreground"
                    aria-label="Filtered by selected upsell services"
                  >
                    <Icon name="lucide:sparkles" class="size-2.5 text-primary-foreground" aria-hidden="true" />
                    upsell scope
                  </Badge>
                  <Badge v-if="listingIds.length > 0" variant="secondary" class="h-4 min-w-4 rounded-full px-1 text-[9px]" :aria-label="`${listingIds.length} selected`">
                    {{ listingIds.length }}
                  </Badge>
                  <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[420px] p-0" align="start" :side-offset="4">
              <div v-if="listingsFilteredByUpsell" class="flex items-center gap-1.5 border-b bg-primary/5 px-3 py-1.5 text-[11px] text-primary-foreground">
                <Icon name="lucide:sparkles" class="size-3" aria-hidden="true" />
                <span>Filtered to listings assigned to every selected upsell service.</span>
              </div>
              <div class="flex items-center gap-1.5 border-b p-2">
                <div class="relative flex-1">
                  <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input v-model="listingSearch" placeholder="Search listings..." class="h-8 pl-7 text-sm" aria-label="Search listings" />
                </div>
                <Popover v-model:open="tagPopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      class="h-8 shrink-0"
                      :class="listingTagsFilter.length > 0 ? 'border-primary bg-primary/5 text-primary-foreground' : ''"
                      aria-label="Filter listings by tag"
                    >
                      <Icon name="lucide:tag" class="size-3.5" aria-hidden="true" />
                      Tags
                      <span v-if="listingTagsFilter.length > 0" class="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground" aria-hidden="true">
                        {{ listingTagsFilter.length }}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-56 p-0" align="end" :side-offset="4">
                    <div class="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
                      Filter by tag
                    </div>
                    <div class="p-2">
                      <Input v-model="tagSearch" placeholder="Search tags..." class="mb-2 h-8 text-xs" aria-label="Search tags" />
                      <div class="max-h-48 overflow-y-auto">
                        <button
                          v-for="tag in filteredTags"
                          :key="tag"
                          type="button"
                          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                          role="checkbox"
                          :aria-checked="listingTagsFilter.includes(tag) ? 'true' : 'false'"
                          :aria-label="`${tag} tag filter`"
                          @click="toggleListingTag(tag)"
                        >
                          <span
                            class="inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors"
                            :class="listingTagsFilter.includes(tag) ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-transparent'"
                            aria-hidden="true"
                          >
                            <Icon v-if="listingTagsFilter.includes(tag)" name="lucide:check" class="size-3.5" />
                          </span>
                          {{ tag }}
                        </button>
                        <p v-if="filteredTags.length === 0" class="px-2 py-3 text-sm text-muted-foreground">
                          No tags found.
                        </p>
                      </div>
                      <Button
                        v-if="listingTagsFilter.length"
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="mt-2 h-7 w-full text-xs text-muted-foreground"
                        @click="clearListingTags"
                      >
                        Clear tags
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Command>
                <CommandList>
                  <CommandEmpty>No listings found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      v-for="listing in filteredListings"
                      :key="listing.id"
                      :value="listing.id"
                      class="cursor-pointer"
                      @select="() => toggleListing(listing.id)"
                    >
                      <div
                        class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                        :class="listingIds.includes(listing.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                        role="checkbox"
                        :aria-checked="listingIds.includes(listing.id) ? 'true' : 'false'"
                        :aria-label="`Toggle ${listing.name}`"
                      >
                        <Icon v-if="listingIds.includes(listing.id)" name="lucide:check" class="size-3" aria-hidden="true" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate">
                          {{ listing.name }}
                        </p>
                        <p v-if="listing.location" class="text-xs text-muted-foreground truncate">
                          {{ listing.location }}
                        </p>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
              <div class="flex items-center justify-between gap-2 border-t p-2">
                <Button v-if="listingIds.length > 0" type="button" variant="ghost" size="sm" class="h-6 text-xs" @click="clearListings">
                  Clear
                </Button>
                <span v-else class="text-xs text-muted-foreground" aria-live="polite">No listings = applies to all</span>
                <Button type="button" size="sm" class="h-7" @click="listingOpen = false">
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div class="space-y-3 rounded-md border p-3">
          <div>
            <p class="text-sm font-medium">
              Validity windows
            </p>
            <p class="text-xs text-muted-foreground">
              Leave both lists empty for an always-valid code. Each list accepts multiple date ranges — the code is redeemable when at least one booking range <em>and</em> at least one stay range are open.
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <Icon name="lucide:calendar-clock" class="size-3.5 text-muted-foreground" aria-hidden="true" />
                <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking windows</Label>
              </div>
              <Button type="button" variant="ghost" size="sm" class="h-7 text-xs" @click="addBookingWindow">
                <Icon name="lucide:plus" class="size-3.5 mr-1" aria-hidden="true" />
                Add window
              </Button>
            </div>
            <div v-if="bookingWindows.length === 0" class="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              No booking window — code is bookable any time.
            </div>
            <div v-else class="space-y-2">
              <fieldset
                v-for="(window, idx) in bookingWindows"
                :key="`bw-${idx}`"
                class="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border bg-muted/30 p-2"
              >
                <legend class="sr-only">
                  Booking window {{ idx + 1 }}
                </legend>
                <div class="space-y-1">
                  <Label :for="`promo-edit-bw-from-${idx}`" class="text-xs">From</Label>
                  <Input
                    :id="`promo-edit-bw-from-${idx}`"
                    :model-value="window.from ?? ''"
                    type="date"
                    :aria-label="`Booking window ${idx + 1} start date`"
                    @input="(e: Event) => updateBookingWindow(idx, 'from', (e.target as HTMLInputElement).value)"
                  />
                </div>
                <div class="space-y-1">
                  <Label :for="`promo-edit-bw-until-${idx}`" class="text-xs">Until</Label>
                  <Input
                    :id="`promo-edit-bw-until-${idx}`"
                    :model-value="window.until ?? ''"
                    type="date"
                    :aria-label="`Booking window ${idx + 1} end date`"
                    @input="(e: Event) => updateBookingWindow(idx, 'until', (e.target as HTMLInputElement).value)"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="size-8 text-muted-foreground hover:text-destructive"
                  :aria-label="`Remove booking window ${idx + 1}`"
                  @click="removeBookingWindow(idx)"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" aria-hidden="true" />
                </Button>
              </fieldset>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <Icon name="lucide:bed" class="size-3.5 text-muted-foreground" aria-hidden="true" />
                <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stay windows</Label>
              </div>
              <Button type="button" variant="ghost" size="sm" class="h-7 text-xs" @click="addStayWindow">
                <Icon name="lucide:plus" class="size-3.5 mr-1" aria-hidden="true" />
                Add window
              </Button>
            </div>
            <div v-if="stayWindows.length === 0" class="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              No stay window — code applies to any check-in date.
            </div>
            <div v-else class="space-y-2">
              <fieldset
                v-for="(window, idx) in stayWindows"
                :key="`sw-${idx}`"
                class="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border bg-muted/30 p-2"
              >
                <legend class="sr-only">
                  Stay window {{ idx + 1 }}
                </legend>
                <div class="space-y-1">
                  <Label :for="`promo-edit-sw-from-${idx}`" class="text-xs">From</Label>
                  <Input
                    :id="`promo-edit-sw-from-${idx}`"
                    :model-value="window.from ?? ''"
                    type="date"
                    :aria-label="`Stay window ${idx + 1} check-in start date`"
                    @input="(e: Event) => updateStayWindow(idx, 'from', (e.target as HTMLInputElement).value)"
                  />
                </div>
                <div class="space-y-1">
                  <Label :for="`promo-edit-sw-until-${idx}`" class="text-xs">Until</Label>
                  <Input
                    :id="`promo-edit-sw-until-${idx}`"
                    :model-value="window.until ?? ''"
                    type="date"
                    :aria-label="`Stay window ${idx + 1} check-in end date`"
                    @input="(e: Event) => updateStayWindow(idx, 'until', (e.target as HTMLInputElement).value)"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="size-8 text-muted-foreground hover:text-destructive"
                  :aria-label="`Remove stay window ${idx + 1}`"
                  @click="removeStayWindow(idx)"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" aria-hidden="true" />
                </Button>
              </fieldset>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="promo-edit-usage-limit">
            Usage limit <span class="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="promo-edit-usage-limit"
            :model-value="usageLimit === null ? '' : String(usageLimit)"
            type="number"
            min="1"
            placeholder="Unlimited"
            aria-describedby="promo-edit-usage-limit-help"
            @input="(e: Event) => { const v = (e.target as HTMLInputElement).value; usageLimit = v === '' ? null : Number(v) }"
          />
          <p id="promo-edit-usage-limit-help" class="text-xs text-muted-foreground">
            Leave blank for unlimited redemptions.
          </p>
        </div>

        <div class="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <Label for="promo-edit-active" class="text-sm font-medium">Active</Label>
            <p id="promo-edit-active-help" class="text-xs text-muted-foreground">
              Inactive codes cannot be redeemed.
            </p>
          </div>
          <Switch
            id="promo-edit-active"
            :model-value="active"
            aria-describedby="promo-edit-active-help"
            @update:model-value="(v) => active = v"
          />
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button @click="submit">
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
