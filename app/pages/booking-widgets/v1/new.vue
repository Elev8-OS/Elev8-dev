<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { bookingWidgets, useBookingWidgets } from '~/components/booking-widget/data/widgets'
import { listings } from '~/components/listings/data/listings'
import { usePromoCodes } from '~/composables/usePromoCodes'
import PromoCodePicker from '~/components/promo-code/PromoCodePicker.vue'

definePageMeta({ layout: 'default' })

const router = useRouter()
const { buildEmbedPreview, getSnippetForForm } = useBookingWidgets()
const { setLinksForWidget } = usePromoCodes()
const activeTab = ref<'accommodation' | 'system' | 'embed'>('accommodation')
const listingDialogOpen = ref(false)
const listingSearch = ref('')
const activeTags = ref<string[]>([])
const tagPanelOpen = ref(false)
const tagSearch = ref('')
const paymentMethodOpen = ref(false)
const embedPreviewOpen = ref(false)

const form = reactive({
  name: '',
  selectedListingIds: [] as string[],
  currency: 'EUR',
  cleaningFee: { mode: 'currency' as 'currency' | 'percent', value: 120 },
  prepayment: { mode: 'percent' as 'currency' | 'percent', value: 50 },
  minDaysBeforeArrival: 0,
  extraGuestPerNight: { mode: 'currency' as 'currency' | 'percent', value: 25 },
  extraGuestStartAt: 3,
  maxGuests: 4,
  extraChildPerNight: { mode: 'currency' as 'currency' | 'percent', value: 0 },
  seasonalConditions: [] as Array<{ id: string, startDate: string, endDate: string, arrivalDays: number[], departureDays: number[] }>,
  lengthOfStayDiscounts: [] as Array<{ id: string, minNights: number, discountType: '%' | 'fixed', value: number }>,
  paymentMethods: [
    'Invoice (Bank Transfer)',
    'PayPal',
    'Pay upon arrival',
    'Stripe Connect (Credit Card)',
    'iDEAL (Stripe Connect)',
    'SEPA Direct Debit (Stripe Connect)',
    'Bancontact (Stripe Connect)',
    'EPS (Stripe Connect)',
    'Przelewy24 (Stripe Connect)',
    'Apple Pay',
    'ACH Direct Debit (Stripe Connect)',
    'Afterpay and Clearpay (Stripe Connect)',
    'Alipay (Stripe Connect)',
    'Bacs Direct Debit (Stripe Connect)',
    'BECS direct debit (Stripe Connect)',
    'Boleto (Stripe Connect)',
    'FPX (Stripe Connect)',
    'GrabPay (Stripe Connect)',
    'Klarna (Stripe Connect)',
    'Konbini (Stripe Connect)',
    'OXXO (Stripe Connect)',
    'PayNow (Stripe Connect)',
    'Sofort (Stripe Connect)',
    'WeChat Pay (Stripe Connect)',
  ] as string[],
  defaultPaymentOption: '',
  requestNumberOfPersons: 'Request separately adults and children',
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
  contactCopy: 'Contact',
  legalRequirementsCopy: 'Legal requirements',
  detailsCopy: 'Details',
  successfullyBookedCopy: 'Successfully booked',
  customStyleCopy: 'Custom style',
  accentColor: '#C8A84B',
  cornerRadius: 12,
  depositPct: 30,
  allowedDomains: [''],
  promoCodeIds: [] as string[],
})

const weekdayOptions = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
]

const paymentMethodOptions = [
  'Invoice (Bank Transfer)',
  'PayPal',
  'Pay upon arrival',
  'Stripe Connect (Credit Card)',
  'iDEAL (Stripe Connect)',
  'SEPA Direct Debit (Stripe Connect)',
  'Bancontact (Stripe Connect)',
  'EPS (Stripe Connect)',
  'Przelewy24 (Stripe Connect)',
  'Apple Pay',
  'ACH Direct Debit (Stripe Connect)',
  'Afterpay and Clearpay (Stripe Connect)',
  'Alipay (Stripe Connect)',
  'Bacs Direct Debit (Stripe Connect)',
  'BECS direct debit (Stripe Connect)',
  'Boleto (Stripe Connect)',
  'FPX (Stripe Connect)',
  'GrabPay (Stripe Connect)',
  'Klarna (Stripe Connect)',
  'Konbini (Stripe Connect)',
  'OXXO (Stripe Connect)',
  'PayNow (Stripe Connect)',
  'Sofort (Stripe Connect)',
  'WeChat Pay (Stripe Connect)',
]

const requestNumberOptions = [
  'Only number of persons(default)',
  'Request separately adults and children',
  'Contact',
  'Legal requirements',
  'Details',
  'Successfully booked',
  'Custom style',
]

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

const paymentMethodSummary = computed(() => {
  if (form.paymentMethods.length === 0)
    return 'Please select'
  if (form.paymentMethods.length <= 2)
    return form.paymentMethods.join(', ')
  return `${form.paymentMethods.length} selected`
})

const defaultPaymentMethodOptions = computed(() => form.paymentMethods)

watch(() => form.paymentMethods, (methods) => {
  if (!methods.includes(form.defaultPaymentOption))
    form.defaultPaymentOption = methods[0] || ''
}, { deep: true })

function isPaymentMethodSelected(method: string) {
  return form.paymentMethods.includes(method)
}

function togglePaymentMethod(method: string, checked: boolean) {
  form.paymentMethods = checked
    ? [...form.paymentMethods, method]
    : form.paymentMethods.filter(item => item !== method)

  if (!form.paymentMethods.includes(form.defaultPaymentOption))
    form.defaultPaymentOption = form.paymentMethods[0] || ''
}

function clearPaymentMethods() {
  form.paymentMethods = []
  form.defaultPaymentOption = ''
}

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
const widgetCurrency = computed(() => selectedListings.value[0]?.currency ?? 'USD')

const embedPreviewWidget = computed(() => buildEmbedPreview({
  id: 'preview',
  name: form.name || 'New Booking Widget',
  mode: form.selectedListingIds.length === 1 ? 'single' : 'multi',
  listingIds: [...form.selectedListingIds],
  primaryListingId: form.selectedListingIds[0] || null,
  currency: form.currency,
  paymentMethods: form.paymentMethods,
  defaultPaymentOption: form.defaultPaymentOption || null,
  requestNumberOfPersons: form.requestNumberOfPersons,
  contactFields: { ...form.contactFields },
  contactCopy: form.contactCopy,
  legalRequirementsCopy: form.legalRequirementsCopy,
  detailsCopy: form.detailsCopy,
  successfullyBookedCopy: form.successfullyBookedCopy,
  customStyleCopy: form.customStyleCopy,
  accentColor: form.accentColor,
  cornerRadius: form.cornerRadius,
  depositPct: form.depositPct,
  minDaysBeforeArrival: form.minDaysBeforeArrival,
  cleaningFee: { ...form.cleaningFee },
  prepayment: { ...form.prepayment },
  extraGuestPerNight: { ...form.extraGuestPerNight },
  extraGuestStartAt: form.extraGuestStartAt,
  maxGuests: form.maxGuests,
  extraChildPerNight: { ...form.extraChildPerNight },
  seasonalConditions: form.seasonalConditions.map(c => ({ ...c, arrivalDays: [...c.arrivalDays], departureDays: [...c.departureDays] })),
  lengthOfStayDiscounts: form.lengthOfStayDiscounts.map(d => ({ ...d })),
  allowedDomains: form.allowedDomains.filter(Boolean),
  promoCodeIds: [...form.promoCodeIds],
  embedVersion: 'v1',
}))

const embedSnippet = computed(() => getSnippetForForm({
  id: 'preview',
  name: form.name || 'New Booking Widget',
  mode: form.selectedListingIds.length === 1 ? 'single' : 'multi',
  listingIds: [...form.selectedListingIds],
  primaryListingId: form.selectedListingIds[0] || null,
  currency: form.currency,
  paymentMethods: form.paymentMethods,
  defaultPaymentOption: form.defaultPaymentOption || null,
  requestNumberOfPersons: form.requestNumberOfPersons,
  contactFields: { ...form.contactFields },
  contactCopy: form.contactCopy,
  legalRequirementsCopy: form.legalRequirementsCopy,
  detailsCopy: form.detailsCopy,
  successfullyBookedCopy: form.successfullyBookedCopy,
  customStyleCopy: form.customStyleCopy,
  accentColor: form.accentColor,
  cornerRadius: form.cornerRadius,
  depositPct: form.depositPct,
  minDaysBeforeArrival: form.minDaysBeforeArrival,
  cleaningFee: { ...form.cleaningFee },
  prepayment: { ...form.prepayment },
  extraGuestPerNight: { ...form.extraGuestPerNight },
  extraGuestStartAt: form.extraGuestStartAt,
  maxGuests: form.maxGuests,
  extraChildPerNight: { ...form.extraChildPerNight },
  seasonalConditions: form.seasonalConditions.map(c => ({ ...c, arrivalDays: [...c.arrivalDays], departureDays: [...c.departureDays] })),
  lengthOfStayDiscounts: form.lengthOfStayDiscounts.map(d => ({ ...d })),
  allowedDomains: form.allowedDomains.filter(Boolean),
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

function addSeasonalCondition() {
  form.seasonalConditions = [...form.seasonalConditions, { id: `sc-${Date.now()}`, startDate: '', endDate: '', arrivalDays: [], departureDays: [] }]
}

function removeSeasonalCondition(index: number) {
  form.seasonalConditions = form.seasonalConditions.filter((_, i) => i !== index)
}

function toggleSeasonalWeekday(conditionId: string, field: 'arrivalDays' | 'departureDays', day: number) {
  const condition = form.seasonalConditions.find(c => c.id === conditionId)
  if (!condition)
    return
  if (condition[field].includes(day)) {
    condition[field] = condition[field].filter(d => d !== day)
  }
  else {
    condition[field] = [...condition[field], day]
  }
}

function addLengthOfStayDiscount() {
  form.lengthOfStayDiscounts = [...form.lengthOfStayDiscounts, { id: `lod-${Date.now()}`, minNights: 3, discountType: '%', value: 10 }]
}

function removeLengthOfStayDiscount(index: number) {
  form.lengthOfStayDiscounts = form.lengthOfStayDiscounts.filter((_, i) => i !== index)
}

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

function parseDateToCalendarDate(dateStr: string): CalendarDate | undefined {
  if (!dateStr)
    return undefined
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number]
  return new CalendarDate(year, month, day)
}

function calendarDateToString(date: CalendarDate | undefined): string {
  if (!date)
    return ''
  return date.toDate(getLocalTimeZone()).toISOString().split('T')[0]!
}

const conditionDatePopover = ref<string | null>(null)

const popoverDateRange = ref<DateRange>({
  start: undefined as unknown as DateValue,
  end: undefined as unknown as DateValue,
})

// Initialize date range when a condition popover opens
watch(conditionDatePopover, (id) => {
  if (id) {
    const condition = form.seasonalConditions.find(c => c.id === id)
    if (condition) {
      popoverDateRange.value = {
        start: parseDateToCalendarDate(condition.startDate),
        end: parseDateToCalendarDate(condition.endDate),
      }
    }
  }
})

// Sync date range changes back to the active condition
watch(() => popoverDateRange.value, (val) => {
  if (conditionDatePopover.value) {
    const condition = form.seasonalConditions.find(c => c.id === conditionDatePopover.value)
    if (condition) {
      condition.startDate = val.start ? calendarDateToString(val.start as CalendarDate) : ''
      condition.endDate = val.end ? calendarDateToString(val.end as CalendarDate) : ''
    }
  }
}, { deep: true })

function getCurrencySymbol(code: string) {
  return code
}

function addDomain() {
  form.allowedDomains = [...form.allowedDomains, '']
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
    cornerRadius: form.cornerRadius,
    depositPct: form.depositPct,
    minDaysBeforeArrival: form.minDaysBeforeArrival,
    cleaningFee: { ...form.cleaningFee },
    prepayment: { ...form.prepayment },
    extraGuestPerNight: { ...form.extraGuestPerNight },
    extraGuestStartAt: form.extraGuestStartAt,
    maxGuests: form.maxGuests,
    extraChildPerNight: { ...form.extraChildPerNight },
    seasonalConditions: form.seasonalConditions.map(c => ({ ...c, arrivalDays: [...c.arrivalDays], departureDays: [...c.departureDays] })),
    lengthOfStayDiscounts: form.lengthOfStayDiscounts.map(d => ({ ...d })),
    allowedDomains: form.allowedDomains.filter(Boolean),
    promoCodeIds: [...form.promoCodeIds],
    currency: form.currency,
    paymentMethods: form.paymentMethods,
    defaultPaymentOption: form.defaultPaymentOption || null,
    requestNumberOfPersons: form.requestNumberOfPersons,
    contactCopy: form.contactCopy,
    legalRequirementsCopy: form.legalRequirementsCopy,
    detailsCopy: form.detailsCopy,
    successfullyBookedCopy: form.successfullyBookedCopy,
    customStyleCopy: form.customStyleCopy,
    embedVersion: 'v1',
  })

  setLinksForWidget(id, form.promoCodeIds)

  toast.success('Booking widget created')
  router.push('/booking-widgets/v1')
}
</script>

<template>
  <div class="w-full flex flex-col gap-6">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="sm" @click="router.push('/booking-widgets/v1')">
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
          Configure accommodation, booking system, and embed settings.
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

    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-3">
        <TabsTrigger value="accommodation">
          Accommodation Setting
        </TabsTrigger>
        <TabsTrigger value="system">
          Booking System Setting
        </TabsTrigger>
        <TabsTrigger value="embed">
          Embed in Website
        </TabsTrigger>
      </TabsList>

      <TabsContent value="accommodation" class="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              Accommodation Setting
            </CardTitle>
            <CardDescription>Choose listings, pricing, and accommodation rules for this widget.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
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
                            <Badge :variant="listing.eligible ? 'default' : 'destructive'">
                              {{ listing.eligible ? 'Eligible' : 'Blocked' }}
                            </Badge>
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

            <Separator />

            <div class="space-y-1">
              <Label class="text-sm font-semibold">Pricing &amp; Fees</Label>
              <p class="text-xs text-muted-foreground">
                Configure cleaning fee, prepayment, and extra guest charges.
              </p>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div class="space-y-2">
                <Label>Cleaning fee</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="form.cleaningFee.value" type="number" min="0" class="flex-1" />
                  <ToggleGroup type="single" :model-value="form.cleaningFee.mode" @update:model-value="(v) => { if (v) form.cleaningFee.mode = v as 'currency' | 'percent' }">
                    <ToggleGroupItem value="currency" class="min-w-[40px]">
                      {{ getCurrencySymbol(form.currency) }}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="percent" class="min-w-[40px]">
                      %
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div class="space-y-2">
                <Label>Prepayment</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="form.prepayment.value" type="number" min="0" class="flex-1" />
                  <ToggleGroup type="single" :model-value="form.prepayment.mode" @update:model-value="(v) => { if (v) form.prepayment.mode = v as 'currency' | 'percent' }">
                    <ToggleGroupItem value="currency" class="min-w-[40px]">
                      {{ getCurrencySymbol(form.currency) }}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="percent" class="min-w-[40px]">
                      %
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div class="space-y-2">
                <Label>Min. days between Booking and Arrival</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="form.minDaysBeforeArrival" type="number" min="0" class="flex-1" />
                  <span class="shrink-0 text-sm text-muted-foreground">days</span>
                </div>
              </div>

              <div class="space-y-2">
                <Label>Extra guests / night</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="form.extraGuestPerNight.value" type="number" min="0" class="flex-1" />
                  <ToggleGroup type="single" :model-value="form.extraGuestPerNight.mode" @update:model-value="(v) => { if (v) form.extraGuestPerNight.mode = v as 'currency' | 'percent' }">
                    <ToggleGroupItem value="currency" class="min-w-[40px]">
                      {{ getCurrencySymbol(form.currency) }}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="percent" class="min-w-[40px]">
                      %
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div class="space-y-2">
                <Label>Starting at the</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="form.extraGuestStartAt" type="number" min="1" class="flex-1" />
                  <span class="shrink-0 text-sm text-muted-foreground">guest</span>
                </div>
              </div>

              <div class="space-y-2">
                <Label>Max. number of guests</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="form.maxGuests" type="number" min="1" class="flex-1" />
                  <span class="shrink-0 text-sm text-muted-foreground">guests</span>
                </div>
              </div>

              <div class="space-y-2">
                <Label>Extra child / nights</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="form.extraChildPerNight.value" type="number" min="0" class="flex-1" />
                  <ToggleGroup type="single" :model-value="form.extraChildPerNight.mode" @update:model-value="(v) => { if (v) form.extraChildPerNight.mode = v as 'currency' | 'percent' }">
                    <ToggleGroupItem value="currency" class="min-w-[40px]">
                      {{ getCurrencySymbol(form.currency) }}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="percent" class="min-w-[40px]">
                      %
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>

            <Separator />

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <Label class="text-sm font-semibold">Arrival and Departure Days</Label>
                  <p class="text-xs text-muted-foreground">
                    Set seasonal check-in/check-out day restrictions for specific date ranges.
                  </p>
                </div>
                <Button variant="outline" size="sm" @click="addSeasonalCondition">
                  <Icon name="i-lucide-plus" class="size-4 mr-1.5" />
                  Add season
                </Button>
              </div>

              <div v-if="form.seasonalConditions.length > 0" class="space-y-3">
                <div v-for="(condition, index) in form.seasonalConditions" :key="condition.id" class="space-y-4 rounded-lg border p-4">
                  <div class="flex items-end gap-3">
                    <div class="flex-1 space-y-2">
                      <Label>Date range</Label>
                      <Popover :open="conditionDatePopover === condition.id" @update:open="(val) => conditionDatePopover = val ? condition.id : null">
                        <PopoverTrigger as-child>
                          <Button
                            variant="outline"
                            class="w-full justify-start text-left font-normal"
                          >
                            <Icon name="lucide:calendar" class="mr-2 size-4" />
                            <template v-if="condition.startDate && condition.endDate">
                              {{ df.format(parseDateToCalendarDate(condition.startDate)!.toDate(getLocalTimeZone())) }} - {{ df.format(parseDateToCalendarDate(condition.endDate)!.toDate(getLocalTimeZone())) }}
                            </template>
                            <template v-else-if="condition.startDate">
                              {{ df.format(parseDateToCalendarDate(condition.startDate)!.toDate(getLocalTimeZone())) }}
                            </template>
                            <span v-else class="text-muted-foreground">Pick a date range</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent class="w-auto p-0" align="start">
                          <RangeCalendar
                            v-model="popoverDateRange"
                            weekday-format="short"
                            :number-of-months="2"
                            initial-focus
                            @update:start-value="(startDate: any) => popoverDateRange.start = startDate"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button variant="ghost" size="icon-sm" type="button" @click="removeSeasonalCondition(index)">
                      <Icon name="i-lucide-trash-2" class="size-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div class="grid gap-4 sm:grid-cols-2">
                    <div class="space-y-2">
                      <Label>Arrival days</Label>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="day in weekdayOptions"
                          :key="`sc-${condition.id}-arr-${day.value}`"
                          type="button"
                          class="flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors"
                          :class="condition.arrivalDays.includes(day.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'"
                          @click="toggleSeasonalWeekday(condition.id, 'arrivalDays', day.value)"
                        >
                          {{ day.short }}
                        </button>
                      </div>
                    </div>

                    <div class="space-y-2">
                      <Label>Departure days</Label>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="day in weekdayOptions"
                          :key="`sc-${condition.id}-dep-${day.value}`"
                          type="button"
                          class="flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors"
                          :class="condition.departureDays.includes(day.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'"
                          @click="toggleSeasonalWeekday(condition.id, 'departureDays', day.value)"
                        >
                          {{ day.short }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Empty v-else class="rounded-lg border py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="i-lucide-calendar-days" class="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No seasonal conditions yet</EmptyTitle>
                  <EmptyDescription>Add date ranges with specific arrival/departure day rules.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>

            <Separator />

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <Label class="text-sm font-semibold">Length of Stay Discounts</Label>
                  <p class="text-xs text-muted-foreground">
                    Offer discounts based on minimum nights booked.
                  </p>
                </div>
                <Button variant="outline" size="sm" @click="addLengthOfStayDiscount">
                  <Icon name="i-lucide-plus" class="size-4 mr-1.5" />
                  Add discount
                </Button>
              </div>

              <div v-if="form.lengthOfStayDiscounts.length > 0" class="space-y-2">
                <div v-for="(tier, index) in form.lengthOfStayDiscounts" :key="tier.id" class="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                  <div class="space-y-2">
                    <Label>Min. nights</Label>
                    <Input v-model.number="tier.minNights" type="number" min="1" class="w-24" />
                  </div>
                  <div class="space-y-2">
                    <Label>Discount type</Label>
                    <Select v-model="tier.discountType">
                      <SelectTrigger class="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="%">
                          Percentage
                        </SelectItem>
                        <SelectItem value="fixed">
                          Fixed amount
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="space-y-2">
                    <Label>Value</Label>
                    <div class="flex items-center gap-2">
                      <span v-if="tier.discountType === 'fixed'" class="rounded-md border bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground">{{ getCurrencySymbol(form.currency) }}</span>
                      <span v-else class="rounded-md border bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground">%</span>
                      <Input v-model.number="tier.value" type="number" min="0" class="w-24" />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" type="button" class="ml-auto" @click="removeLengthOfStayDiscount(index)">
                    <Icon name="i-lucide-trash-2" class="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <Empty v-else class="rounded-lg border py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="i-lucide-percent" class="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No stay discounts yet</EmptyTitle>
                  <EmptyDescription>Add tiered discounts for longer stays.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>

            <Separator />

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold">
                    Promo codes
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Link codes managed in the Promo Codes page to this widget.
                  </p>
                </div>
                <NuxtLink to="/promo-codes" class="text-xs text-primary hover:underline">
                  Manage codes →
                </NuxtLink>
              </div>
              <PromoCodePicker v-model="form.promoCodeIds" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="system" class="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              Booking System Setting
            </CardTitle>
            <CardDescription>Define pricing behavior and booking rules.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label>Currency</Label>
                <Input v-model="form.currency" maxlength="3" class="uppercase font-mono" />
              </div>
            </div>

            <div class="grid gap-4 xl:grid-cols-2">
              <div class="space-y-2">
                <Label>Payment Methods</Label>
                <Popover v-model:open="paymentMethodOpen">
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      role="combobox"
                      :aria-expanded="paymentMethodOpen"
                      class="h-9 w-full justify-between text-left font-normal"
                    >
                      <span class="flex min-w-0 items-center gap-2 truncate">
                        <Icon name="lucide:credit-card" class="size-3.5 shrink-0" />
                        <span class="truncate">{{ paymentMethodSummary }}</span>
                      </span>
                      <Badge v-if="form.paymentMethods.length > 0" variant="secondary" class="ml-2 h-4 min-w-4 rounded-full px-1 text-[9px]">
                        {{ form.paymentMethods.length }}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-[420px] p-0" align="start" :side-offset="4">
                    <Command>
                      <CommandInput placeholder="Search payment methods..." />
                      <CommandEmpty>No payment methods found.</CommandEmpty>
                      <CommandList>
                        <CommandGroup>
                          <CommandItem
                            v-for="method in paymentMethodOptions"
                            :key="method"
                            :value="method"
                            @select="() => togglePaymentMethod(method, !isPaymentMethodSelected(method))"
                          >
                            <Checkbox :checked="isPaymentMethodSelected(method)" class="mr-2" />
                            <span class="flex-1 truncate">{{ method }}</span>
                            <Icon
                              name="radix-icons:check"
                              :class="cn('ml-auto size-4', isPaymentMethodSelected(method) ? 'opacity-100' : 'opacity-0')"
                            />
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <div class="flex items-center justify-between gap-2 border-t p-2">
                      <Button variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="clearPaymentMethods">
                        Clear all
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div class="space-y-2">
                <Label>Default payment option</Label>
                <Select v-model="form.defaultPaymentOption">
                  <SelectTrigger>
                    <SelectValue placeholder="Please select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="method in defaultPaymentMethodOptions" :key="method" :value="method">
                      {{ method }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="space-y-2">
              <Label>Request number of persons</Label>
              <Select v-model="form.requestNumberOfPersons" disabled>
                <SelectTrigger class="cursor-not-allowed opacity-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="option in requestNumberOptions" :key="option" :value="option">
                    {{ option }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-3">
              <Label class="text-sm font-semibold">Contact</Label>
              <p class="text-xs text-muted-foreground">
                Configure which contact fields guests must fill in.
              </p>
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="embed" class="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              Embed in Website
            </CardTitle>
            <CardDescription>Configure allowed domains, snippet output, and embed preview.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div class="space-y-2">
              <Label>Allowed domains</Label>
              <div v-for="(domain, index) in form.allowedDomains" :key="index" class="flex items-center gap-2">
                <Input v-model="form.allowedDomains[index]" placeholder="partner-bali.com" />
              </div>
              <Button variant="outline" size="sm" @click="addDomain">
                <Icon name="i-lucide-plus" class="size-4 mr-2" />
                Add domain
              </Button>
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

        <Dialog v-model:open="embedPreviewOpen">
          <DialogContent class="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Embed Preview</DialogTitle>
              <DialogDescription>Preview is generated from the current booking widget settings.</DialogDescription>
            </DialogHeader>
            <BookingWidgetPreview :widget="embedPreviewWidget" :listings="selectedListings.length > 0 ? selectedListings : eligibleListings" />
          </DialogContent>
        </Dialog>
      </TabsContent>
    </Tabs>
  </div>
</template>
