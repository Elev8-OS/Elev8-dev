<script setup lang="ts">
import { toast } from 'vue-sonner'
import { bookingWidgets, useBookingWidgets } from '~/components/booking-widget/data/widgets'
import WidgetRuleSetSelect from '~/components/booking-widget/WidgetRuleSetSelect.vue'
import { listings } from '~/components/listings/data/listings'
import PromoCodePicker from '~/components/promo-code/PromoCodePicker.vue'
import { usePromoCodes } from '~/composables/usePromoCodes'

definePageMeta({ layout: 'default' })

const router = useRouter()
const { buildEmbedPreview, getSnippetForForm } = useBookingWidgets()
const { setLinksForWidget } = usePromoCodes()
const listingDialogOpen = ref(false)
const listingSearch = ref('')
const activeTags = ref<string[]>([])
const tagPanelOpen = ref(false)
const tagSearch = ref('')
const embedPreviewOpen = ref(false)
const showCustomColor = ref(false)

const presetColors = ['#F6BB11', '#C8A84B', '#1E293B', '#0EA5E9', '#10B981']

const form = reactive({
  name: '',
  selectedListingIds: [] as string[],
  // null = no discounts or stay rules (v2 has none of its own); or a Website channel rule set.
  websiteRuleSetId: null as string | null,
  contactFields: {
    firstName: 'required' as 'required' | 'optional' | 'hidden',
    lastName: 'required' as 'required' | 'optional' | 'hidden',
    email: 'required' as 'required' | 'optional' | 'hidden',
    phone: 'optional' as 'required' | 'optional' | 'hidden',
    country: 'optional' as 'required' | 'optional' | 'hidden',
    address: 'optional' as 'required' | 'optional' | 'hidden',
    notes: 'optional' as 'required' | 'optional' | 'hidden',
    arrivalTime: 'optional' as 'required' | 'optional' | 'hidden',
  },
  accentColor: '#F6BB11',
  promoCodeIds: [] as string[],
})

const contactFieldDefinitions = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'country', label: 'Country' },
  { key: 'address', label: 'Address' },
  { key: 'notes', label: 'Notes' },
  { key: 'arrivalTime', label: 'Arrival time' },
] as const

const fieldSettingOptions = [
  { value: 'required', label: 'Required field' },
  { value: 'optional', label: 'Optional' },
  { value: 'hidden', label: 'Don\'t show' },
]

const eligibleListings = computed(() => listings.value.map((listing) => {
  const eligible = Boolean(listing.photos.length > 0 && listing.resources.basics.description?.trim() && listing.status !== 'inactive')
  return {
    id: listing.id,
    name: listing.name,
    location: listing.location,
    tags: listing.tags,
    capacity: listing.capacity,
    pricing: { nightlyRate: listing.pricing.nightlyRate },
    photos: listing.photos,
    websiteEnabled: false,
    description: listing.resources.basics.description ?? '',
    currency: 'USD',
    eligible,
  }
}))

const selectedListings = computed(() => eligibleListings.value.filter(listing => form.selectedListingIds.includes(listing.id)))

const embedPreviewWidget = computed(() => buildEmbedPreview({
  id: 'preview',
  name: form.name || 'New Booking Widget',
  mode: form.selectedListingIds.length === 1 ? 'single' : 'multi',
  listingIds: [...form.selectedListingIds],
  primaryListingId: form.selectedListingIds[0] || null,
  requestNumberOfPersons: null,
  contactFields: { ...form.contactFields },
  contactCopy: 'Contact',
  legalRequirementsCopy: 'Legal requirements',
  detailsCopy: 'Details',
  successfullyBookedCopy: 'Successfully booked',
  customStyleCopy: 'Custom style',
  accentColor: form.accentColor,
  cornerRadius: 12,
  depositPct: 30,
  minDaysBeforeArrival: 0,
  cleaningFee: { mode: 'currency', value: 0 },
  prepayment: { mode: 'percent', value: 0 },
  extraGuestPerNight: { mode: 'currency', value: 0 },
  extraGuestStartAt: 3,
  maxGuests: 4,
  extraChildPerNight: { mode: 'currency', value: 0 },
  seasonalConditions: [],
  lengthOfStayDiscounts: [],
  websiteRuleSetId: form.websiteRuleSetId,
  allowedDomains: [],
  promoCodeIds: [...form.promoCodeIds],
  embedVersion: 'v1',
}))

const embedSnippet = computed(() => getSnippetForForm({
  id: 'preview',
  name: form.name || 'New Booking Widget',
  mode: form.selectedListingIds.length === 1 ? 'single' : 'multi',
  listingIds: [...form.selectedListingIds],
  primaryListingId: form.selectedListingIds[0] || null,
  requestNumberOfPersons: null,
  contactFields: { ...form.contactFields },
  contactCopy: 'Contact',
  legalRequirementsCopy: 'Legal requirements',
  detailsCopy: 'Details',
  successfullyBookedCopy: 'Successfully booked',
  customStyleCopy: 'Custom style',
  accentColor: form.accentColor,
  cornerRadius: 12,
  depositPct: 30,
  minDaysBeforeArrival: 0,
  cleaningFee: { mode: 'currency', value: 0 },
  prepayment: { mode: 'percent', value: 0 },
  extraGuestPerNight: { mode: 'currency', value: 0 },
  extraGuestStartAt: 3,
  maxGuests: 4,
  extraChildPerNight: { mode: 'currency', value: 0 },
  seasonalConditions: [],
  lengthOfStayDiscounts: [],
  websiteRuleSetId: form.websiteRuleSetId,
  allowedDomains: [],
  promoCodeIds: [...form.promoCodeIds],
  embedVersion: 'v1',
}))

async function copySnippet() {
  await navigator.clipboard.writeText(embedSnippet.value)
  toast.success('Snippet copied')
}

const filteredListings = computed(() => {
  const query = listingSearch.value.trim().toLowerCase()
  return eligibleListings.value.filter((listing) => {
    const matchesSearch = !query || listing.name.toLowerCase().includes(query) || listing.location.toLowerCase().includes(query)
    const matchesTag = activeTags.value.length === 0 || activeTags.value.every(tag => listing.tags.includes(tag))
    return matchesSearch && matchesTag
  })
})

const allTags = computed(() => Array.from(new Set(eligibleListings.value.flatMap(listing => listing.tags))).sort())

const filteredTags = computed(() => {
  if (!tagSearch.value)
    return allTags.value
  const q = tagSearch.value.toLowerCase()
  return allTags.value.filter(tag => tag.toLowerCase().includes(q))
})

function toggleTag(tag: string) {
  if (tag === 'all') {
    activeTags.value = []
    return
  }

  activeTags.value = activeTags.value.includes(tag)
    ? activeTags.value.filter(t => t !== tag)
    : [...activeTags.value, tag]
}

function clearTags() {
  activeTags.value = []
}

watch(tagPanelOpen, (open) => {
  if (!open)
    tagSearch.value = ''
})

function toggleListing(listingId: string) {
  form.selectedListingIds = form.selectedListingIds.includes(listingId)
    ? form.selectedListingIds.filter(id => id !== listingId)
    : [...form.selectedListingIds, listingId]
}

function saveWidget() {
  const id = `bk-widget-${Date.now()}`
  bookingWidgets.value.unshift({
    id,
    name: form.name || 'Untitled Widget',
    mode: form.selectedListingIds.length === 1 ? 'single' : 'multi',
    listingIds: [...form.selectedListingIds],
    primaryListingId: form.selectedListingIds[0] || null,
    accentColor: form.accentColor,
    cornerRadius: 12,
    depositPct: 30,
    minDaysBeforeArrival: 0,
    cleaningFee: { mode: 'currency', value: 0 },
    prepayment: { mode: 'percent', value: 0 },
    extraGuestPerNight: { mode: 'currency', value: 0 },
    extraGuestStartAt: 3,
    maxGuests: 4,
    extraChildPerNight: { mode: 'currency', value: 0 },
    seasonalConditions: [],
    lengthOfStayDiscounts: [],
    websiteRuleSetId: form.websiteRuleSetId,
    allowedDomains: [],
    promoCodeIds: [...form.promoCodeIds],
    requestNumberOfPersons: null,
    contactCopy: 'Contact',
    legalRequirementsCopy: 'Legal requirements',
    detailsCopy: 'Details',
    successfullyBookedCopy: 'Successfully booked',
    customStyleCopy: 'Custom style',
    embedVersion: 'v1',
  })

  setLinksForWidget(id, form.promoCodeIds)

  toast.success('Booking widget created')
  router.push('/booking-widgets')
}
</script>

<template>
  <div class="w-full flex flex-col gap-6">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="sm" @click="router.push('/booking-widgets')">
        <Icon name="i-lucide-arrow-left" class="size-4 mr-2" />
        Back to Booking Widgets
      </Button>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Create Booking Widget
        </h2>
        <p class="text-sm text-muted-foreground">
          Configure listings, booking system, and embed settings.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="embedPreviewOpen = true">
          <Icon name="i-lucide-eye" class="size-4 mr-2" />
          Preview
        </Button>
        <Button @click="saveWidget">
          <Icon name="i-lucide-save" class="size-4 mr-2" />
          Save Widget
        </Button>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Accommodation
        </CardTitle>
        <CardDescription>Choose listings for this widget.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <Label>Widget name</Label>
            <Input v-model="form.name" placeholder="Canggu Portfolio Widget" />
          </div>

          <div class="space-y-2 sm:col-span-2">
            <Label>Selected listings</Label>
            <div>
              <Dialog v-model:open="listingDialogOpen">
                <DialogTrigger as-child>
                  <Button variant="outline" class="w-full justify-between">
                    <span class="truncate">{{ selectedListings.length > 0 ? `${selectedListings.length} listing${selectedListings.length > 1 ? 's' : ''} selected` : 'Select listings' }}</span>
                    <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent class="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Select listings</DialogTitle>
                    <DialogDescription>Search listings and filter by tags. Select multiple listings.</DialogDescription>
                  </DialogHeader>

                  <div class="space-y-4">
                    <div class="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                      <div class="flex-1 min-w-[200px] max-w-xs">
                        <Input v-model="listingSearch" placeholder="Search listings..." class="h-9" />
                      </div>
                      <Popover v-model:open="tagPanelOpen">
                        <PopoverTrigger as-child>
                          <Button variant="outline" size="sm" class="h-9 gap-1.5 text-xs" :class="activeTags.length > 0 ? 'border-primary text-primary' : ''">
                            <Icon name="i-lucide-tag" class="size-3.5" />
                            Tags
                            <Badge v-if="activeTags.length > 0" variant="default" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[9px]">
                              {{ activeTags.length }}
                            </Badge>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent class="w-56 p-0" align="start" :side-offset="4">
                          <div class="p-2">
                            <Input v-model="tagSearch" placeholder="Search tags..." class="h-7 text-xs" />
                          </div>
                          <ScrollArea class="h-48 overflow-hidden">
                            <div class="space-y-1">
                              <div v-for="tag in filteredTags" :key="tag" class="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent" @click="toggleTag(tag)">
                                <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="activeTags.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                                  <Icon v-if="activeTags.includes(tag)" name="lucide:check" class="size-3" />
                                </div>
                                <span class="flex-1">{{ tag }}</span>
                              </div>
                              <p v-if="filteredTags.length === 0" class="px-2 py-1.5 text-xs text-muted-foreground">
                                No tags found.
                              </p>
                            </div>
                          </ScrollArea>
                          <div v-if="activeTags.length > 0" class="border-t px-2 py-2">
                            <Button variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="clearTags">
                              Clear all tags
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button v-if="form.selectedListingIds.length > 0" variant="ghost" size="sm" class="h-9 text-xs text-muted-foreground" @click="form.selectedListingIds = []">
                        Clear ({{ form.selectedListingIds.length }})
                      </Button>
                    </div>

                    <div class="max-h-[400px] overflow-y-auto space-y-1">
                      <div
                        v-for="listing in filteredListings"
                        :key="listing.id"
                        class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors"
                        :class="form.selectedListingIds.includes(listing.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/60'"
                        @click="toggleListing(listing.id)"
                      >
                        <div class="flex size-5 shrink-0 items-center justify-center rounded-[4px] border" :class="form.selectedListingIds.includes(listing.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                          <Icon v-if="form.selectedListingIds.includes(listing.id)" name="lucide:check" class="size-3.5" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-medium truncate">
                            {{ listing.name }}
                          </p>
                          <p class="text-xs text-muted-foreground truncate">
                            {{ listing.location }}
                          </p>
                        </div>
                      </div>
                      <p v-if="filteredListings.length === 0" class="py-8 text-center text-sm text-muted-foreground">
                        No listings found.
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button @click="listingDialogOpen = false">
                      Done ({{ form.selectedListingIds.length }} selected)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div v-if="selectedListings.length > 0" class="flex flex-wrap gap-1.5">
              <Badge v-for="listing in selectedListings" :key="listing.id" variant="secondary" class="gap-1 pr-1">
                {{ listing.name }}
                <button type="button" class="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5" @click="toggleListing(listing.id)">
                  <Icon name="lucide:x" class="size-3" />
                </button>
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Discounts and stay rules
        </CardTitle>
        <CardDescription>Use the discounts, stay rules and prepayment of a Website channel rule set.</CardDescription>
      </CardHeader>
      <CardContent>
        <WidgetRuleSetSelect v-model="form.websiteRuleSetId" own-label="No discounts or stay rules" />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Contact Fields
        </CardTitle>
        <CardDescription>Configure which contact fields guests must fill in.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="field in contactFieldDefinitions" :key="field.key" class="space-y-1.5">
            <Label class="text-xs">{{ field.label }}</Label>
            <Select v-model="form.contactFields[field.key]">
              <SelectTrigger class="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in fieldSettingOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Embed in Website
        </CardTitle>
        <CardDescription>Configure embed snippet and preview.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="space-y-3">
          <Label class="text-sm font-semibold">Accent Color</Label>
          <p class="text-xs text-muted-foreground">
            Choose a primary color for the widget.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="c in presetColors"
              :key="c"
              type="button"
              class="size-8 rounded-full border-2 transition-all"
              :class="form.accentColor === c ? 'border-foreground ring-2 ring-offset-2' : 'border-transparent hover:scale-110'"
              :style="{ backgroundColor: c }"
              @click="form.accentColor = c"
            />
            <div class="relative">
              <button
                type="button"
                class="size-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-muted-foreground transition-colors"
                :class="!presetColors.includes(form.accentColor) ? 'border-foreground ring-2 ring-offset-2' : ''"
                @click="showCustomColor = true"
              >
                <Icon v-if="!presetColors.includes(form.accentColor) || showCustomColor" name="lucide:pipette" class="size-4 text-muted-foreground" />
                <Icon v-else name="lucide:plus" class="size-4 text-muted-foreground" />
              </button>
              <input
                v-if="showCustomColor"
                type="color"
                :value="form.accentColor"
                class="absolute inset-0 size-8 opacity-0 cursor-pointer"
                @input="form.accentColor = ($event.target as HTMLInputElement).value"
              >
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <Label>Embed snippet</Label>
            <Button size="sm" class="h-8 gap-1.5" @click="copySnippet">
              <Icon name="lucide:copy" class="size-4" />
              Copy snippet
            </Button>
          </div>
          <pre class="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs leading-6"><code>{{ embedSnippet }}</code></pre>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Promo codes
        </CardTitle>
        <CardDescription>Link codes managed in the Promo Codes page to this widget.</CardDescription>
      </CardHeader>
      <CardContent>
        <PromoCodePicker v-model="form.promoCodeIds" />
        <p class="text-xs text-muted-foreground mt-2">
          <NuxtLink to="/promo-codes" class="text-primary hover:underline">
            Manage codes →
          </NuxtLink>
          Add new codes from the Promo Codes page.
        </p>
      </CardContent>
    </Card>

    <Dialog v-model:open="embedPreviewOpen">
      <DialogContent class="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Embed Preview</DialogTitle>
          <DialogDescription>Preview is generated from the current booking widget settings.</DialogDescription>
        </DialogHeader>
        <BookingWidgetPreview :widget="embedPreviewWidget" :listings="selectedListings.length > 0 ? selectedListings : eligibleListings" />
      </DialogContent>
    </Dialog>
  </div>
</template>
