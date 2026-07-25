<script setup lang="ts">
import type { PromoCodeDiscountType, PromoCodeWindow } from './data/promo-codes'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings as allListings, allTags } from '~/components/listings/data/listings'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'
import { usePromoCodes } from '~/composables/usePromoCodes'

const emit = defineEmits<{
  created: [codeId: string]
}>()

const open = defineModel<boolean>('open', { default: false })

const { createPromoCode, isCodeTaken } = usePromoCodes()

const code = ref('')
const description = ref('')
const discountType = ref<PromoCodeDiscountType>('%')
const value = ref<number>(10)
const currency = ref<string>('USD')
const bookingWindows = ref<PromoCodeWindow[]>([])
const stayWindows = ref<PromoCodeWindow[]>([])
const usageLimit = ref<number | null>(null)
const active = ref(true)
const freeUpsellServiceIds = ref<string[]>([])
const listingIds = ref<string[]>([])

// Search-state refs must be declared before reset() because that
// function clears them on entry.
const freeUpsellSearch = ref('')
const listingSearch = ref('')

const codeError = ref('')
const freeUpsellError = ref('')

const currencyOptions = ['USD', 'EUR', 'GBP', 'IDR', 'CHF', 'AUD', 'JPY']

const isFreeUpsell = computed(() => discountType.value === 'free_upsell')

function reset() {
  code.value = ''
  description.value = ''
  discountType.value = '%'
  value.value = 10
  currency.value = 'USD'
  bookingWindows.value = []
  stayWindows.value = []
  usageLimit.value = null
  active.value = true
  freeUpsellServiceIds.value = []
  listingIds.value = []
  codeError.value = ''
  freeUpsellError.value = ''
  freeUpsellSearch.value = ''
  listingSearch.value = ''
}

watch(open, (isOpen) => {
  if (isOpen)
    reset()
})

function onCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  const upper = target.value.toUpperCase().replace(/\s+/g, '')
  code.value = upper
  target.value = upper
  codeError.value = ''
}

// ─── Free Upsell services picker ────────────────────────────────────────────
const freeUpsellOpen = ref(false)
// freeUpsellSearch declared above (before reset)

const filteredUpsellServices = computed(() => {
  const query = freeUpsellSearch.value.trim().toLowerCase()
  if (!query)
    return mockUpsellServices
  return mockUpsellServices.filter((s) => {
    const haystack = `${s.name} ${s.category}`.toLowerCase()
    return haystack.includes(query)
  })
})

const selectedUpsellServices = computed(() =>
  mockUpsellServices.filter(s => freeUpsellServiceIds.value.includes(s.id)),
)

function toggleUpsellService(id: string) {
  freeUpsellServiceIds.value = freeUpsellServiceIds.value.includes(id)
    ? freeUpsellServiceIds.value.filter(x => x !== id)
    : [...freeUpsellServiceIds.value, id]
  freeUpsellError.value = ''
}

function clearUpsellServices() {
  freeUpsellServiceIds.value = []
  freeUpsellError.value = ''
}

function upsellTriggerLabel() {
  const n = freeUpsellServiceIds.value.length
  if (n === 0)
    return 'Select upsell services'
  if (n === 1)
    return '1 service selected'
  return `${n} services selected`
}

watch(freeUpsellOpen, (open) => {
  if (!open)
    freeUpsellSearch.value = ''
})

// ─── Listings picker ────────────────────────────────────────────────────────
const listingOpen = ref(false)
// listingSearch declared above (before reset)
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

// ─── Submit ────────────────────────────────────────────────────────────────
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

function submit() {
  const trimmed = code.value.trim()
  if (!trimmed) {
    codeError.value = 'Code is required'
    return
  }
  if (isCodeTaken(trimmed)) {
    codeError.value = 'A code with this value already exists'
    return
  }
  if (isFreeUpsell.value && freeUpsellServiceIds.value.length === 0) {
    freeUpsellError.value = 'Select at least one upsell service for a Free Upsell code'
    return
  }
  if (!isFreeUpsell.value && (!value.value || value.value <= 0)) {
    toast.error('Value must be greater than 0')
    return
  }

  const created = createPromoCode({
    code: trimmed,
    description: description.value.trim() || undefined,
    discountType: discountType.value,
    value: isFreeUpsell.value ? 0 : value.value,
    currency: discountType.value === 'fixed' ? currency.value : null,
    active: active.value,
    bookingWindows: bookingWindows.value.map(w => ({ from: w.from || null, until: w.until || null })),
    stayWindows: stayWindows.value.map(w => ({ from: w.from || null, until: w.until || null })),
    usageLimit: usageLimit.value,
    freeUpsellServiceIds: isFreeUpsell.value ? freeUpsellServiceIds.value : [],
    listingIds: listingIds.value,
  })

  toast.success(`Code ${created.code} created`)
  emit('created', created.id)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create promo code</DialogTitle>
        <DialogDescription>Add a new code that can be linked to booking widgets and the website.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label>Code</Label>
          <Input
            :model-value="code"
            placeholder="WELCOME10"
            class="font-mono uppercase"
            :class="codeError ? 'border-destructive' : ''"
            @input="onCodeInput"
          />
          <p v-if="codeError" class="text-xs text-destructive">
            {{ codeError }}
          </p>
        </div>

        <div class="space-y-2">
          <Label>Description <span class="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea v-model="description" placeholder="What is this code for?" rows="2" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label>Type</Label>
            <Select v-model="discountType">
              <SelectTrigger>
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
            <Label>Value</Label>
            <div class="flex items-center gap-2">
              <span v-if="discountType === 'fixed'" class="rounded-md border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{{ currency }}</span>
              <span v-else class="rounded-md border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">%</span>
              <Input v-model.number="value" type="number" min="1" class="flex-1" />
            </div>
          </div>
        </div>

        <div v-if="discountType === 'fixed'" class="space-y-2">
          <Label>Currency</Label>
          <Select v-model="currency">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in currencyOptions" :key="c" :value="c">
                {{ c }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Free Upsell services picker -->
        <div v-if="isFreeUpsell" class="space-y-2">
          <Label>
            Free upsell services
            <span class="text-muted-foreground font-normal">(required)</span>
          </Label>
          <Popover v-model:open="freeUpsellOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-between">
                <span class="truncate">{{ upsellTriggerLabel() }}</span>
                <div class="flex items-center gap-2">
                  <Badge v-if="freeUpsellServiceIds.length > 0" variant="secondary" class="h-4 min-w-4 rounded-full px-1 text-[9px]">
                    {{ freeUpsellServiceIds.length }}
                  </Badge>
                  <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted-foreground" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[420px] p-0" align="start" :side-offset="4">
              <div class="p-2 border-b">
                <Input v-model="freeUpsellSearch" placeholder="Search upsell services..." class="h-8 text-sm" />
              </div>
              <Command>
                <CommandList>
                  <CommandEmpty>No upsell services found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      v-for="service in filteredUpsellServices"
                      :key="service.id"
                      :value="service.id"
                      class="cursor-pointer"
                      @select="() => toggleUpsellService(service.id)"
                    >
                      <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="freeUpsellServiceIds.includes(service.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                        <Icon v-if="freeUpsellServiceIds.includes(service.id)" name="lucide:check" class="size-3" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate">
                          {{ service.name }}
                        </p>
                        <p class="text-xs text-muted-foreground truncate">
                          {{ service.category }}
                        </p>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
              <div class="flex items-center justify-between gap-2 border-t p-2">
                <Button v-if="freeUpsellServiceIds.length > 0" variant="ghost" size="sm" class="h-6 text-xs" @click="clearUpsellServices">
                  Clear
                </Button>
                <span v-else class="text-xs text-muted-foreground">{{ freeUpsellServiceIds.length }} selected</span>
                <Button size="sm" class="h-7" @click="freeUpsellOpen = false">
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div v-if="selectedUpsellServices.length > 0" class="flex flex-wrap gap-1.5">
            <Badge v-for="service in selectedUpsellServices" :key="service.id" variant="secondary" class="gap-1 pr-1">
              <Icon name="lucide:sparkles" class="size-3 text-primary" />
              <span class="text-xs">{{ service.name }}</span>
              <button type="button" class="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5" @click="toggleUpsellService(service.id)">
                <Icon name="lucide:x" class="size-3" />
              </button>
            </Badge>
          </div>
          <p v-if="freeUpsellError" class="text-xs text-destructive">
            {{ freeUpsellError }}
          </p>
        </div>

        <!-- Assigned listings picker -->
        <div class="space-y-2">
          <Label>
            Assigned listings
            <span class="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Popover v-model:open="listingOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-between">
                <span class="truncate">{{ listingTriggerLabel() }}</span>
                <div class="flex items-center gap-2">
                  <Badge v-if="listingIds.length > 0" variant="secondary" class="h-4 min-w-4 rounded-full px-1 text-[9px]">
                    {{ listingIds.length }}
                  </Badge>
                  <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted-foreground" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[420px] p-0" align="start" :side-offset="4">
              <div class="flex items-center gap-1.5 border-b p-2">
                <div class="relative flex-1">
                  <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input v-model="listingSearch" placeholder="Search listings..." class="h-8 pl-7 text-sm" />
                </div>
                <Popover v-model:open="tagPopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-8 shrink-0"
                      :class="listingTagsFilter.length > 0 ? 'border-primary text-primary' : ''"
                    >
                      <Icon name="lucide:tag" class="size-3.5" />
                      Tags
                      <span v-if="listingTagsFilter.length > 0" class="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                        {{ listingTagsFilter.length }}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-56 p-0" align="end" :side-offset="4">
                    <div class="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
                      Filter by tag
                    </div>
                    <div class="p-2">
                      <Input v-model="tagSearch" placeholder="Search tags..." class="mb-2 h-8 text-xs" />
                      <div class="max-h-48 overflow-y-auto">
                        <button
                          v-for="tag in filteredTags"
                          :key="tag"
                          type="button"
                          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                          @click="toggleListingTag(tag)"
                        >
                          <span
                            class="inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors"
                            :class="listingTagsFilter.includes(tag) ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-transparent'"
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
                      <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="listingIds.includes(listing.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                        <Icon v-if="listingIds.includes(listing.id)" name="lucide:check" class="size-3" />
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
                <Button v-if="listingIds.length > 0" variant="ghost" size="sm" class="h-6 text-xs" @click="clearListings">
                  Clear
                </Button>
                <span v-else class="text-xs text-muted-foreground">No listings = applies to all</span>
                <Button size="sm" class="h-7" @click="listingOpen = false">
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
                <Icon name="lucide:calendar-clock" class="size-3.5 text-muted-foreground" />
                <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking windows</Label>
              </div>
              <Button type="button" variant="ghost" size="sm" class="h-7 text-xs" @click="addBookingWindow">
                <Icon name="lucide:plus" class="size-3.5 mr-1" />
                Add window
              </Button>
            </div>
            <div v-if="bookingWindows.length === 0" class="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              No booking window — code is bookable any time.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(window, idx) in bookingWindows"
                :key="`bw-${idx}`"
                class="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border bg-muted/30 p-2"
              >
                <div class="space-y-1">
                  <Label class="text-xs">From</Label>
                  <Input :model-value="window.from ?? ''" type="date" @input="(e: Event) => updateBookingWindow(idx, 'from', (e.target as HTMLInputElement).value)" />
                </div>
                <div class="space-y-1">
                  <Label class="text-xs">Until</Label>
                  <Input :model-value="window.until ?? ''" type="date" @input="(e: Event) => updateBookingWindow(idx, 'until', (e.target as HTMLInputElement).value)" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="size-8 text-muted-foreground hover:text-destructive"
                  :aria-label="`Remove booking window ${idx + 1}`"
                  @click="removeBookingWindow(idx)"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <Icon name="lucide:bed" class="size-3.5 text-muted-foreground" />
                <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stay windows</Label>
              </div>
              <Button type="button" variant="ghost" size="sm" class="h-7 text-xs" @click="addStayWindow">
                <Icon name="lucide:plus" class="size-3.5 mr-1" />
                Add window
              </Button>
            </div>
            <div v-if="stayWindows.length === 0" class="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              No stay window — code applies to any check-in date.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(window, idx) in stayWindows"
                :key="`sw-${idx}`"
                class="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border bg-muted/30 p-2"
              >
                <div class="space-y-1">
                  <Label class="text-xs">From</Label>
                  <Input :model-value="window.from ?? ''" type="date" @input="(e: Event) => updateStayWindow(idx, 'from', (e.target as HTMLInputElement).value)" />
                </div>
                <div class="space-y-1">
                  <Label class="text-xs">Until</Label>
                  <Input :model-value="window.until ?? ''" type="date" @input="(e: Event) => updateStayWindow(idx, 'until', (e.target as HTMLInputElement).value)" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="size-8 text-muted-foreground hover:text-destructive"
                  :aria-label="`Remove stay window ${idx + 1}`"
                  @click="removeStayWindow(idx)"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <Label>Usage limit <span class="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            :model-value="usageLimit === null ? '' : String(usageLimit)"
            type="number"
            min="1"
            placeholder="Unlimited"
            @input="(e: Event) => { const v = (e.target as HTMLInputElement).value; usageLimit = v === '' ? null : Number(v) }"
          />
        </div>

        <div class="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <p class="text-sm font-medium">
              Active
            </p>
            <p class="text-xs text-muted-foreground">
              Inactive codes cannot be redeemed.
            </p>
          </div>
          <button
            type="button"
            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            :class="active ? 'bg-primary' : 'bg-input'"
            @click="active = !active"
          >
            <span
              class="pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
              :class="active ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button @click="submit">
          Create code
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
