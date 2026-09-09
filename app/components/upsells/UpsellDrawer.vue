<script setup lang="ts">
import type { LockAccessConfig } from '@/components/upsells/data/lock-access'
import type {
  BookingStatusFilter,
  OtaChannel,
  UpsellCategory,
  UpsellItem,
  UpsellService,
  VisibilityConditionKey,
  VisibilityConditions,
  VisibilityMatchMode,
} from '@/components/upsells/data/upsell-services'
import {
  emptyVisibilityConditions,
  getConditionDefault,
  getConditionEmpty,
  summarizeVisibility,
} from '@/components/upsells/data/upsell-services'
import { toast } from 'vue-sonner'
import draggable from 'vuedraggable'
import { listings as allListings } from '@/components/listings/data/listings'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createDefaultLockAccessConfig } from '@/components/upsells/data/lock-access'
import { BALI_LISTINGS } from '@/components/upsells/data/upsell-services'
import { useUpsellServices } from '@/composables/useUpsellServices'

const props = defineProps<{
  service: UpsellService | null
  initialCategory: UpsellCategory | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { addService, updateService, deleteService } = useUpsellServices()

const isEditing = computed(() => props.service !== null)

const currentStep = ref(1)
const visitedSteps = ref<Set<number>>(new Set([1]))
const nameError = ref(false)

const steps = [
  { id: 1, label: 'Basic Info' },
  { id: 2, label: 'Items' },
  { id: 3, label: 'Listings' },
  { id: 4, label: 'Visibility' },
  { id: 5, label: 'Settings' },
]

function stepCircleClass(stepId: number) {
  if (currentStep.value === stepId)
    return 'bg-primary text-primary-foreground'
  if (visitedSteps.value.has(stepId))
    return 'bg-primary/20 text-primary'
  return 'bg-muted text-muted-foreground'
}

function goToStep(n: number) {
  currentStep.value = n
  const next = new Set(visitedSteps.value)
  next.add(n)
  visitedSteps.value = next
}

function nextStep() {
  if (currentStep.value === 1 && !formName.value.trim()) {
    nameError.value = true
    return
  }
  nameError.value = false
  goToStep(currentStep.value + 1)
}

function prevStep() {
  goToStep(currentStep.value - 1)
}

const formName = ref('')
const formDescription = ref('')
const formCategory = ref<UpsellService['category']>('Airport Transport')
const formCurrency = ref('CHF')
const formImage = ref<string | undefined>(undefined)
const serviceImageInputRef = ref<HTMLInputElement | null>(null)
const formYoutubeLinks = ref<string[]>([])
const formNewYoutubeLink = ref('')
const formInternalNotes = ref('')
const formNotificationUsers = ref<string[]>([])
const formNewNotificationUser = ref('')
const formPricingEnabled = ref(false)
const formTaxPercent = ref(0)
const formServicePercent = ref(0)
const formItems = ref<UpsellItem[]>([])
const formListings = ref<string[]>([])
const formAvailability = ref<'always' | 'by_request'>('always')
const formStatus = ref<'active' | 'inactive'>('active')
const formLockAccess = ref<LockAccessConfig>(createDefaultLockAccessConfig())
const formVisibility = ref<VisibilityConditions>(emptyVisibilityConditions())
const formVisibilityMatchMode = ref<VisibilityMatchMode>('all')

function isConditionEnabled(key: VisibilityConditionKey): boolean {
  return formVisibility.value[key] !== null
}

function toggleCondition(key: VisibilityConditionKey) {
  if (isConditionEnabled(key)) {
    formVisibility.value = {
      ...formVisibility.value,
      [key]: getConditionEmpty(key),
    }
  }
  else {
    formVisibility.value = {
      ...formVisibility.value,
      [key]: getConditionDefault(key),
    }
  }
}

function isBookingStatusSelected(status: BookingStatusFilter): boolean {
  return formVisibility.value.bookingStatuses?.includes(status) ?? false
}

function toggleBookingStatus(status: BookingStatusFilter) {
  const current = formVisibility.value.bookingStatuses ?? []
  formVisibility.value = {
    ...formVisibility.value,
    bookingStatuses: current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status],
  }
}

function isChannelSelected(channel: OtaChannel): boolean {
  return formVisibility.value.channels?.includes(channel) ?? false
}

function toggleChannel(channel: OtaChannel) {
  const current = formVisibility.value.channels ?? []
  formVisibility.value = {
    ...formVisibility.value,
    channels: current.includes(channel)
      ? current.filter(c => c !== channel)
      : [...current, channel],
  }
}

function isRelatedUpsellSelected(serviceId: string): boolean {
  return formVisibility.value.excludeIfUpsellPurchased?.includes(serviceId) ?? false
}

function toggleRelatedUpsell(serviceId: string) {
  const current = formVisibility.value.excludeIfUpsellPurchased ?? []
  formVisibility.value = {
    ...formVisibility.value,
    excludeIfUpsellPurchased: current.includes(serviceId)
      ? current.filter(id => id !== serviceId)
      : [...current, serviceId],
  }
}

const otherUpsellServices = computed(() => {
  const all = useUpsellServices().services.value
  return props.service ? all.filter(s => s.id !== props.service!.id) : all
})

const activeConditionSummaries = computed(() => summarizeVisibility(formVisibility.value))

const summaryText = computed(() => {
  const entries = activeConditionSummaries.value
  if (entries.length === 0)
    return 'No visibility conditions set — upsell will show everywhere.'
  const conditionCount = entries.length
  const matchLabel = formVisibilityMatchMode.value === 'all' ? 'All conditions met' : 'Any condition met'
  return `${conditionCount} condition${conditionCount === 1 ? '' : 's'} active: ${entries.map(e => e.label).join(', ')}. Match mode: ${matchLabel}.`
})

const showDeleteConfirm = ref(false)

// Item modal state
const showItemModal = ref(false)
const editingItemId = ref<string | null>(null)
const itemFormName = ref('')
const itemFormDescription = ref('')
const itemFormPrice = ref(0)
const itemFormImage = ref<string | undefined>(undefined)
const itemImageInputRef = ref<HTMLInputElement | null>(null)

watch(() => props.open, (open) => {
  if (open) {
    showDeleteConfirm.value = false
    if (props.service) {
      currentStep.value = 1
      visitedSteps.value = new Set([1, 2, 3, 4, 5])
      nameError.value = false
      formName.value = props.service.name
      formDescription.value = props.service.description
      formCategory.value = props.service.category
      formCurrency.value = props.service.currency
      formImage.value = props.service.image
      formYoutubeLinks.value = [...props.service.youtubeLinks]
      formInternalNotes.value = props.service.internalNotes
      formNotificationUsers.value = [...props.service.notificationUsers]
      formPricingEnabled.value = props.service.pricingEnabled
      formTaxPercent.value = props.service.taxPercent
      formServicePercent.value = props.service.servicePercent
      formItems.value = props.service.items.map(i => ({ ...i }))
      formListings.value = [...props.service.assignedListings]
      formAvailability.value = props.service.availability
      formLockAccess.value = props.service.lockAccess
        ? { ...props.service.lockAccess, lockNames: [...props.service.lockAccess.lockNames] }
        : createDefaultLockAccessConfig()
      formStatus.value = props.service.status
      formVisibility.value = { ...props.service.visibility }
      formVisibilityMatchMode.value = props.service.visibilityMatchMode
    }
    else {
      formName.value = ''
      formDescription.value = ''
      formCategory.value = props.initialCategory ?? 'Airport Transport'
      formCurrency.value = 'CHF'
      formImage.value = undefined
      formYoutubeLinks.value = []
      formNewYoutubeLink.value = ''
      formInternalNotes.value = ''
      formNotificationUsers.value = []
      formNewNotificationUser.value = ''
      formPricingEnabled.value = false
      formTaxPercent.value = 0
      formServicePercent.value = 0
      formItems.value = []
      formListings.value = []
      formAvailability.value = 'always'
      formLockAccess.value = createDefaultLockAccessConfig()
      formStatus.value = 'active'
      formVisibility.value = emptyVisibilityConditions()
      formVisibilityMatchMode.value = 'all'
      currentStep.value = 1
      visitedSteps.value = new Set([1])
      nameError.value = false
    }
  }
})

const smartLock = useSmartLock()

/** Listing ids behind the currently selected listing names. */
const scopedListingIds = computed(() => {
  const names = formListings.value.length > 0 ? formListings.value : BALI_LISTINGS
  return names
    .map(name => allListings.value.find(l => l.name === name)?.id)
    .filter((id): id is string => Boolean(id))
})

/**
 * Lock names available to grant, with how far each one reaches into the selected listings.
 *
 * Locks are matched by name rather than by id because one service covers many properties.
 * Stating the coverage keeps the host from selling pool access at 16 villas when only 3
 * have a pool gate paired.
 */
const lockNameOptions = computed(() => {
  const counts = new Map<string, { name: string, listingIds: Set<string> }>()
  for (const listingId of scopedListingIds.value) {
    for (const lock of smartLock.getLocksForListing(listingId)) {
      const key = lock.name.trim().toLowerCase()
      if (!key)
        continue
      const entry = counts.get(key) ?? { name: lock.name, listingIds: new Set<string>() }
      entry.listingIds.add(listingId)
      counts.set(key, entry)
    }
  }
  return [...counts.values()]
    .map(e => ({ name: e.name, coveredListings: e.listingIds.size }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const scopedListingCount = computed(() => scopedListingIds.value.length)

function isLockNameSelected(name: string) {
  return formLockAccess.value.lockNames.some(n => n.trim().toLowerCase() === name.trim().toLowerCase())
}

function toggleLockName(name: string) {
  const selected = isLockNameSelected(name)
  formLockAccess.value = {
    ...formLockAccess.value,
    lockNames: selected
      ? formLockAccess.value.lockNames.filter(n => n.trim().toLowerCase() !== name.trim().toLowerCase())
      : [...formLockAccess.value.lockNames, name],
  }
}

/** Names the host picked that no lock in the current listing scope answers to any more. */
const strandedLockNames = computed(() =>
  formLockAccess.value.lockNames.filter(
    n => !lockNameOptions.value.some(o => o.name.trim().toLowerCase() === n.trim().toLowerCase()),
  ),
)

function dropStrandedLockNames() {
  const stranded = new Set(strandedLockNames.value.map(n => n.trim().toLowerCase()))
  formLockAccess.value = {
    ...formLockAccess.value,
    lockNames: formLockAccess.value.lockNames.filter(n => !stranded.has(n.trim().toLowerCase())),
  }
}

function addYoutubeLink() {
  const link = formNewYoutubeLink.value.trim()
  if (link) {
    formYoutubeLinks.value = [...formYoutubeLinks.value, link]
    formNewYoutubeLink.value = ''
  }
}

function removeYoutubeLink(idx: number) {
  formYoutubeLinks.value = formYoutubeLinks.value.filter((_, i) => i !== idx)
}

function addNotificationUser() {
  const user = formNewNotificationUser.value.trim()
  if (user) {
    formNotificationUsers.value = [...formNotificationUsers.value, user]
    formNewNotificationUser.value = ''
  }
}

function removeNotificationUser(idx: number) {
  formNotificationUsers.value = formNotificationUsers.value.filter((_, i) => i !== idx)
}

function toggleListing(listing: string) {
  if (formListings.value.includes(listing)) {
    formListings.value = formListings.value.filter(l => l !== listing)
  }
  else {
    formListings.value = [...formListings.value, listing]
  }
}

function selectAllListings() {
  formListings.value = [...BALI_LISTINGS]
}

function clearAllListings() {
  formListings.value = []
}

function removeItem(id: string) {
  formItems.value = formItems.value.filter(i => i.id !== id)
}

function openAddItemModal() {
  editingItemId.value = null
  itemFormName.value = ''
  itemFormDescription.value = ''
  itemFormPrice.value = 0
  itemFormImage.value = undefined
  showItemModal.value = true
}

function openEditItemModal(item: UpsellItem) {
  editingItemId.value = item.id
  itemFormName.value = item.name
  itemFormDescription.value = item.description || ''
  itemFormPrice.value = item.price
  itemFormImage.value = item.image
  showItemModal.value = true
}

function saveItemModal() {
  if (!itemFormName.value.trim()) {
    toast.error('Item name is required.')
    return
  }
  if (editingItemId.value) {
    formItems.value = formItems.value.map(i =>
      i.id === editingItemId.value
        ? { ...i, name: itemFormName.value.trim(), description: itemFormDescription.value.trim(), price: itemFormPrice.value, image: itemFormImage.value }
        : i,
    )
  }
  else {
    formItems.value = [...formItems.value, {
      id: `itm-${Date.now()}`,
      name: itemFormName.value.trim(),
      description: itemFormDescription.value.trim(),
      price: itemFormPrice.value,
      image: itemFormImage.value,
    }]
  }
  showItemModal.value = false
}

function onItemsReorder() {
  // vuedraggable updates formItems directly via v-model
}

function handleServiceImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    formImage.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function handleItemImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (e) => {
    itemFormImage.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function handleSave() {
  if (!formName.value.trim()) {
    nameError.value = true
    goToStep(1)
    toast.error('Service name is required.')
    return
  }
  if (formItems.value.length === 0) {
    toast.error('At least one item is required.')
    goToStep(2)
    return
  }

  const data = {
    name: formName.value.trim(),
    description: formDescription.value.trim(),
    category: formCategory.value,
    currency: formCurrency.value,
    image: formImage.value,
    youtubeLinks: formYoutubeLinks.value,
    internalNotes: formInternalNotes.value.trim(),
    notificationUsers: formNotificationUsers.value,
    pricingEnabled: formPricingEnabled.value,
    taxPercent: formTaxPercent.value,
    servicePercent: formServicePercent.value,
    items: formItems.value,
    assignedListings: formListings.value,
    availability: formAvailability.value,
    lockAccess: formLockAccess.value.enabled
      ? {
          enabled: true,
          lockNames: [...formLockAccess.value.lockNames],
          instructions: formLockAccess.value.instructions?.trim() || undefined,
        }
      : undefined,
    status: formStatus.value,
    visibility: { ...formVisibility.value },
    visibilityMatchMode: formVisibilityMatchMode.value,
  }

  if (isEditing.value && props.service) {
    updateService(props.service.id, data)
    toast.success('Service updated.')
  }
  else {
    addService(data)
    toast.success('Service created.')
  }
  emit('update:open', false)
}

function handleDelete() {
  if (props.service) {
    deleteService(props.service.id)
    toast.success('Service deleted.')
    emit('update:open', false)
  }
}

function onOpenChange(val: boolean) {
  emit('update:open', val)
}
</script>

<template>
  <Sheet :open="props.open" @update:open="onOpenChange">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" side="right">
      <SheetHeader class="shrink-0 border-b px-6 py-4">
        <SheetTitle>{{ isEditing ? 'Edit Service' : `Add ${formCategory} Service` }}</SheetTitle>
        <SheetDescription>
          {{ isEditing ? 'Update the upsell service details.' : 'Create a new upsell service to offer to guests.' }}
        </SheetDescription>
      </SheetHeader>

      <div class="shrink-0 border-b px-6 pb-4 pt-3">
        <div class="flex items-center">
          <template v-for="(step, idx) in steps" :key="step.id">
            <button
              type="button"
              class="flex flex-col items-center gap-1.5 focus:outline-none"
              @click="goToStep(step.id)"
            >
              <div
                class="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                :class="stepCircleClass(step.id)"
              >
                <Icon
                  v-if="visitedSteps.has(step.id) && currentStep !== step.id"
                  name="lucide:check"
                  class="h-3.5 w-3.5"
                />
                <span v-else class="text-xs font-medium">{{ step.id }}</span>
              </div>
              <span
                class="text-xs transition-colors"
                :class="currentStep === step.id ? 'font-medium text-foreground' : 'text-muted-foreground'"
              >
                {{ step.label }}
              </span>
            </button>
            <div
              v-if="idx < steps.length - 1"
              class="mb-4 h-px flex-1 bg-border"
            />
          </template>
        </div>
      </div>

      <ScrollArea class="min-h-0 flex-1 overflow-y-auto">
        <!-- Step 1: Basic Info -->
        <div v-if="currentStep === 1" class="flex flex-col gap-5 p-6">
          <div class="flex flex-col gap-2">
            <Label>Name <span class="text-destructive">*</span></Label>
            <Input
              v-model="formName"
              placeholder="Enter the name of the upsell (e.g., In-villa SPA)"
              :class="nameError ? 'border-destructive' : ''"
              @input="nameError = false"
            />
            <p v-if="nameError" class="text-xs text-destructive">
              Service name is required.
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <Label>Description</Label>
            <Textarea v-model="formDescription" placeholder="Describe the service..." rows="3" />
            <div class="flex flex-wrap gap-1.5">
              <span class="text-xs text-muted-foreground">Variable Replacement</span>
              <code class="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;guest_first_name&gt;</code>
              <code class="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;guest_last_name&gt;</code>
              <code class="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;listing_name&gt;</code>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <Label>Image</Label>
            <input
              ref="serviceImageInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleServiceImageUpload"
            >
            <div v-if="formImage" class="relative">
              <img
                :src="formImage"
                alt="Service image"
                class="h-40 w-full rounded-md border object-cover"
              >
              <Button
                variant="destructive"
                size="icon"
                class="absolute right-2 top-2 h-7 w-7"
                @click="formImage = undefined"
              >
                <Icon name="lucide:x" class="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              v-else
              variant="outline"
              class="w-full"
              @click="serviceImageInputRef?.click()"
            >
              <Icon name="lucide:upload" class="mr-2 h-4 w-4" />
              Upload Image
            </Button>
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <Label>YouTube Links</Label>
            <div class="flex flex-col gap-2">
              <div
                v-for="(link, idx) in formYoutubeLinks"
                :key="idx"
                class="flex items-center gap-2"
              >
                <Input :model-value="link" class="flex-1" disabled />
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  @click="removeYoutubeLink(idx)"
                >
                  <Icon name="lucide:x" class="h-4 w-4" />
                </Button>
              </div>
              <div class="flex items-center gap-2">
                <Input
                  v-model="formNewYoutubeLink"
                  placeholder="Paste a YouTube link (optional)"
                  class="flex-1"
                  @keydown.enter.prevent="addYoutubeLink"
                />
                <Button variant="outline" size="sm" class="h-9" @click="addYoutubeLink">
                  <Icon name="lucide:plus" class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Items -->
        <div v-if="currentStep === 2" class="flex flex-col gap-5 p-6">
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">
                  Upsell Items
                </p>
                <p class="text-xs text-muted-foreground">
                  Drag to reorder. Click an item to edit.
                </p>
              </div>
              <Button variant="outline" size="sm" class="h-8" @click="openAddItemModal">
                <Icon name="lucide:plus" class="mr-1 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            <draggable
              v-model="formItems"
              item-key="id"
              handle=".drag-handle"
              ghost-class="opacity-40"
              animation="150"
            >
              <template #item="{ element: item }">
                <div
                  class="group flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                  @click="openEditItemModal(item)"
                >
                  <div class="drag-handle cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing">
                    <Icon name="lucide:grip-vertical" class="h-4 w-4" />
                  </div>
                  <div v-if="item.image" class="h-10 w-10 shrink-0 overflow-hidden rounded-md border">
                    <img :src="item.image" :alt="item.name" class="h-full w-full object-cover">
                  </div>
                  <div v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                    <Icon name="lucide:image" class="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                      {{ item.name }}
                    </p>
                    <p v-if="item.description" class="truncate text-xs text-muted-foreground">
                      {{ item.description }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="text-sm font-medium text-muted-foreground">
                      {{ item.price.toLocaleString() }} {{ formCurrency }}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7 text-muted-foreground hover:text-destructive"
                      @click.stop="removeItem(item.id)"
                    >
                      <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </template>
            </draggable>

            <div
              v-if="formItems.length === 0"
              class="flex flex-col items-center gap-2 rounded-md border border-dashed p-6"
            >
              <Icon name="lucide:package" class="h-8 w-8 text-muted-foreground" />
              <p class="text-sm text-muted-foreground">
                No items yet
              </p>
              <Button variant="outline" size="sm" @click="openAddItemModal">
                <Icon name="lucide:plus" class="mr-1 h-3.5 w-3.5" />
                Add your first item
              </Button>
            </div>
          </div>
        </div>

        <!-- Step 3: Listings & Availability -->
        <div v-if="currentStep === 3" class="flex flex-col gap-5 p-6">
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <Label>Assigned Listings</Label>
              <div class="flex gap-2">
                <Button variant="ghost" size="sm" class="h-7 text-xs" @click="selectAllListings">
                  Select all
                </Button>
                <Button variant="ghost" size="sm" class="h-7 text-xs" @click="clearAllListings">
                  Clear
                </Button>
              </div>
            </div>
            <div class="max-h-64 overflow-y-auto rounded-md border">
              <label
                v-for="listing in BALI_LISTINGS"
                :key="listing"
                class="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
              >
                <Checkbox
                  :checked="formListings.includes(listing)"
                  @update:checked="toggleListing(listing)"
                />
                <span class="text-sm">{{ listing }}</span>
              </label>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ formListings.length }} of {{ BALI_LISTINGS.length }} listings selected
            </p>
          </div>

          <Separator />

          <div class="flex flex-col gap-3">
            <Label>Availability</Label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                class="flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
                :class="formAvailability === 'always' ? 'border-primary bg-primary/5' : 'border-border'"
                @click="formAvailability = 'always'"
              >
                <div class="flex items-center gap-2">
                  <Icon name="lucide:shopping-cart" class="h-4 w-4" />
                  <span class="text-sm font-medium">Always Available</span>
                </div>
                <span class="text-xs text-muted-foreground">Guests can order anytime</span>
              </button>
              <button
                type="button"
                class="flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
                :class="formAvailability === 'by_request' ? 'border-primary bg-primary/5' : 'border-border'"
                @click="formAvailability = 'by_request'"
              >
                <div class="flex items-center gap-2">
                  <Icon name="lucide:clock" class="h-4 w-4" />
                  <span class="text-sm font-medium">By Request</span>
                </div>
                <span class="text-xs text-muted-foreground">Requires confirmation first</span>
              </button>
            </div>
          </div>

          <Separator />

          <!-- Smart lock access granted by this service -->
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-4">
              <div class="flex flex-col gap-0.5">
                <Label class="flex items-center gap-2">
                  <Icon name="lucide:key-round" class="h-4 w-4 text-amber-600" />
                  Smart Lock Access
                </Label>
                <p class="text-xs text-muted-foreground">
                  Issue the guest a door code automatically the moment this service is paid.
                </p>
              </div>
              <Switch
                :model-value="formLockAccess.enabled"
                @update:model-value="(v: boolean) => formLockAccess = { ...formLockAccess, enabled: v }"
              />
            </div>

            <template v-if="formLockAccess.enabled">
              <div v-if="!smartLock.isConnected.value" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Smart Lock is not connected.
                <NuxtLink to="/settings/integrations" class="text-primary underline">
                  Connect it in Integrations
                </NuxtLink>
                to pick a lock.
              </div>

              <template v-else>
                <div v-if="lockNameOptions.length === 0" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No locks are paired at the {{ scopedListingCount }} selected
                  {{ scopedListingCount === 1 ? 'listing' : 'listings' }} yet. Pair one in the
                  listing's Settings tab, then come back.
                </div>

                <div v-else class="overflow-hidden rounded-md border">
                  <div
                    v-for="option in lockNameOptions"
                    :key="option.name"
                    class="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                    @click="toggleLockName(option.name)"
                  >
                    <div
                      class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                      :class="isLockNameSelected(option.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                    >
                      <Icon v-if="isLockNameSelected(option.name)" name="lucide:check" class="size-3" />
                    </div>
                    <span class="text-sm">{{ option.name }}</span>
                    <span class="ml-auto text-xs text-muted-foreground">
                      Paired at {{ option.coveredListings }} of {{ scopedListingCount }}
                    </span>
                  </div>
                </div>

                <div
                  v-if="strandedLockNames.length > 0"
                  class="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs"
                >
                  <Icon name="lucide:triangle-alert" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div class="flex flex-col gap-1">
                    <span>
                      No lock named {{ strandedLockNames.join(', ') }} is paired at the selected
                      listings any more. Guests buying this service there get no code.
                    </span>
                    <button type="button" class="w-fit text-primary underline" @click="dropStrandedLockNames">
                      Remove {{ strandedLockNames.length === 1 ? 'it' : 'them' }}
                    </button>
                  </div>
                </div>

                <p class="text-xs text-muted-foreground">
                  Locks are matched by name, so this keeps working when a device is swapped or
                  re-paired. The code is valid from payment until noon on the check-out day.
                </p>

                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs font-normal text-muted-foreground">Instructions for the guest</Label>
                  <Textarea
                    :model-value="formLockAccess.instructions ?? ''"
                    rows="2"
                    placeholder="e.g. The gate is on the left of the pool deck."
                    @update:model-value="(v: string | number) => formLockAccess = { ...formLockAccess, instructions: String(v) }"
                  />
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- Step 4: Visibility -->
        <div v-if="currentStep === 4" class="flex flex-col gap-5 p-6">
          <!-- Match mode selector -->
          <div class="flex flex-col gap-2 rounded-md border p-4">
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                :class="formVisibilityMatchMode === 'all'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted/50'"
                @click="formVisibilityMatchMode = 'all'"
              >
                <Icon name="lucide:circle-check" class="mr-2 inline h-4 w-4" />
                All conditions met
                <span class="ml-1 text-xs opacity-70">(AND)</span>
              </button>
              <button
                type="button"
                class="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                :class="formVisibilityMatchMode === 'any'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted/50'"
                @click="formVisibilityMatchMode = 'any'"
              >
                <Icon name="lucide:circle-dot" class="mr-2 inline h-4 w-4" />
                Any condition met
                <span class="ml-1 text-xs opacity-70">(OR)</span>
              </button>
            </div>
            <p class="text-xs text-muted-foreground">
              Choose how multiple rules combine. Unset conditions are ignored.
            </p>
          </div>

          <!-- Condition cards container -->
          <div class="flex flex-col gap-3">
            <!-- Time before Check-in -->
            <div class="flex flex-col gap-2 rounded-md border p-3" :class="isConditionEnabled('hoursBeforeCheckIn') ? 'border-primary/30 bg-primary/5' : 'border-border'">
              <div class="flex items-center justify-between">
                <h4 id="visibility-hours-before-check-in" class="text-sm font-medium">Time before Check-in</h4>
                <Switch
                  aria-labelledby="visibility-hours-before-check-in"
                  :model-value="isConditionEnabled('hoursBeforeCheckIn')"
                  @update:model-value="toggleCondition('hoursBeforeCheckIn')"
                />
              </div>
              <p v-if="!isConditionEnabled('hoursBeforeCheckIn')" class="text-xs text-muted-foreground">Off — condition ignored</p>
              <div v-else class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <Input
                    :model-value="formVisibility.hoursBeforeCheckIn ?? undefined"
                    type="number"
                    min="0"
                    class="flex-1"
                    aria-describedby="visibility-hours-before-check-in-help"
                    @update:model-value="(v) => formVisibility = { ...formVisibility, hoursBeforeCheckIn: Number(v) }"
                  />
                  <span class="text-sm text-muted-foreground">hours</span>
                </div>
                <p id="visibility-hours-before-check-in-help" class="text-xs text-muted-foreground">Show only within the window from N hours before check-in up to check-in. Set 0 for "show anytime up to check-in".</p>
              </div>
            </div>

            <!-- Time before Check-out -->
            <div class="flex flex-col gap-2 rounded-md border p-3" :class="isConditionEnabled('hoursBeforeCheckOut') ? 'border-primary/30 bg-primary/5' : 'border-border'">
              <div class="flex items-center justify-between">
                <h4 id="visibility-hours-before-check-out" class="text-sm font-medium">Time before Check-out</h4>
                <Switch
                  aria-labelledby="visibility-hours-before-check-out"
                  :model-value="isConditionEnabled('hoursBeforeCheckOut')"
                  @update:model-value="toggleCondition('hoursBeforeCheckOut')"
                />
              </div>
              <p v-if="!isConditionEnabled('hoursBeforeCheckOut')" class="text-xs text-muted-foreground">Off — condition ignored</p>
              <div v-else class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <Input
                    :model-value="formVisibility.hoursBeforeCheckOut ?? undefined"
                    type="number"
                    min="0"
                    class="flex-1"
                    aria-describedby="visibility-hours-before-check-out-help"
                    @update:model-value="(v) => formVisibility = { ...formVisibility, hoursBeforeCheckOut: Number(v) }"
                  />
                  <span class="text-sm text-muted-foreground">hours</span>
                </div>
                <p id="visibility-hours-before-check-out-help" class="text-xs text-muted-foreground">Show only within the window from N hours before check-out up to check-out.</p>
              </div>
            </div>

            <!-- Guest Count -->
            <div class="flex flex-col gap-2 rounded-md border p-3" :class="(isConditionEnabled('guestCountMin') || isConditionEnabled('guestCountMax')) ? 'border-primary/30 bg-primary/5' : 'border-border'">
              <div class="flex items-center justify-between">
                <h4 id="visibility-guest-count" class="text-sm font-medium">Guest Count</h4>
                <Switch
                  aria-labelledby="visibility-guest-count"
                  :model-value="isConditionEnabled('guestCountMin') || isConditionEnabled('guestCountMax')"
                  @update:model-value="(v) => { toggleCondition('guestCountMin'); toggleCondition('guestCountMax') }"
                />
              </div>
              <p v-if="!isConditionEnabled('guestCountMin') && !isConditionEnabled('guestCountMax')" class="text-xs text-muted-foreground">Off — condition ignored</p>
              <div v-else class="flex flex-col gap-1">
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs font-normal text-muted-foreground">Min guests</Label>
                    <Input
                      :model-value="formVisibility.guestCountMin ?? undefined"
                      type="number"
                      min="1"
                      aria-describedby="visibility-guest-count-help"
                      @update:model-value="(v) => formVisibility = { ...formVisibility, guestCountMin: Number(v) }"
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs font-normal text-muted-foreground">Max guests</Label>
                    <Input
                      :model-value="formVisibility.guestCountMax ?? undefined"
                      type="number"
                      min="1"
                      aria-describedby="visibility-guest-count-help"
                      @update:model-value="(v) => formVisibility = { ...formVisibility, guestCountMax: Number(v) }"
                    />
                  </div>
                </div>
                <p v-if="formVisibility.guestCountMin !== null && formVisibility.guestCountMax !== null && formVisibility.guestCountMin > formVisibility.guestCountMax" class="text-xs text-destructive">
                  Min is greater than max.
                </p>
                <p id="visibility-guest-count-help" class="text-xs text-muted-foreground">Show only when guest count is within this range.</p>
              </div>
            </div>

            <!-- Length of Stay -->
            <div class="flex flex-col gap-2 rounded-md border p-3" :class="(isConditionEnabled('lengthOfStayMin') || isConditionEnabled('lengthOfStayMax')) ? 'border-primary/30 bg-primary/5' : 'border-border'">
              <div class="flex items-center justify-between">
                <h4 id="visibility-length-of-stay" class="text-sm font-medium">Length of Stay</h4>
                <Switch
                  aria-labelledby="visibility-length-of-stay"
                  :model-value="isConditionEnabled('lengthOfStayMin') || isConditionEnabled('lengthOfStayMax')"
                  @update:model-value="(v) => { toggleCondition('lengthOfStayMin'); toggleCondition('lengthOfStayMax') }"
                />
              </div>
              <p v-if="!isConditionEnabled('lengthOfStayMin') && !isConditionEnabled('lengthOfStayMax')" class="text-xs text-muted-foreground">Off — condition ignored</p>
              <div v-else class="flex flex-col gap-1">
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs font-normal text-muted-foreground">Min nights</Label>
                    <Input
                      :model-value="formVisibility.lengthOfStayMin ?? undefined"
                      type="number"
                      min="1"
                      aria-describedby="visibility-length-of-stay-help"
                      @update:model-value="(v) => formVisibility = { ...formVisibility, lengthOfStayMin: Number(v) }"
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs font-normal text-muted-foreground">Max nights</Label>
                    <Input
                      :model-value="formVisibility.lengthOfStayMax ?? undefined"
                      type="number"
                      min="1"
                      aria-describedby="visibility-length-of-stay-help"
                      @update:model-value="(v) => formVisibility = { ...formVisibility, lengthOfStayMax: Number(v) }"
                    />
                  </div>
                </div>
                <p v-if="formVisibility.lengthOfStayMin !== null && formVisibility.lengthOfStayMax !== null && formVisibility.lengthOfStayMin > formVisibility.lengthOfStayMax" class="text-xs text-destructive">
                  Min is greater than max.
                </p>
                <p id="visibility-length-of-stay-help" class="text-xs text-muted-foreground">Show only when stay length (nights) is within this range.</p>
              </div>
            </div>

            <!-- Booking Status -->
            <div class="flex flex-col gap-2 rounded-md border p-3" :class="isConditionEnabled('bookingStatuses') ? 'border-primary/30 bg-primary/5' : 'border-border'">
              <div class="flex items-center justify-between">
                <h4 id="visibility-booking-status" class="text-sm font-medium">Booking Status</h4>
                <Switch
                  aria-labelledby="visibility-booking-status"
                  :model-value="isConditionEnabled('bookingStatuses')"
                  @update:model-value="toggleCondition('bookingStatuses')"
                />
              </div>
              <p v-if="!isConditionEnabled('bookingStatuses')" class="text-xs text-muted-foreground">Off — condition ignored</p>
              <div v-else class="flex flex-col gap-1">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in [
                      { value: 'inquiry', label: 'Inquiry' },
                      { value: 'confirmed', label: 'Confirmed' },
                      { value: 'checked_in', label: 'Checked-in' },
                      { value: 'checked_out', label: 'Checked-out' },
                      { value: 'cancelled', label: 'Cancelled' },
                    ]"
                    :key="opt.value"
                    type="button"
                    class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    :class="isBookingStatusSelected(opt.value as BookingStatusFilter)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted/50'"
                    :aria-pressed="isBookingStatusSelected(opt.value as BookingStatusFilter)"
                    @click="toggleBookingStatus(opt.value as BookingStatusFilter)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
                <p class="text-xs text-muted-foreground">Show only when the booking is in one of these statuses.</p>
              </div>
            </div>

            <!-- Related Upsell -->
            <div class="flex flex-col gap-2 rounded-md border p-3" :class="isConditionEnabled('excludeIfUpsellPurchased') ? 'border-primary/30 bg-primary/5' : 'border-border'">
              <div class="flex items-center justify-between">
                <h4 id="visibility-related-upsell" class="text-sm font-medium">Related Upsell</h4>
                <Switch
                  aria-labelledby="visibility-related-upsell"
                  :model-value="isConditionEnabled('excludeIfUpsellPurchased')"
                  @update:model-value="toggleCondition('excludeIfUpsellPurchased')"
                />
              </div>
              <p v-if="!isConditionEnabled('excludeIfUpsellPurchased')" class="text-xs text-muted-foreground">Off — condition ignored</p>
              <div v-else class="flex flex-col gap-1">
                <p v-if="otherUpsellServices.length === 0" class="text-xs text-muted-foreground">No other upsells to relate to.</p>
                <div v-else class="flex flex-wrap gap-2">
                  <button
                    v-for="svc in otherUpsellServices"
                    :key="svc.id"
                    type="button"
                    class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    :class="isRelatedUpsellSelected(svc.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted/50'"
                    :aria-pressed="isRelatedUpsellSelected(svc.id)"
                    @click="toggleRelatedUpsell(svc.id)"
                  >
                    {{ svc.name }}
                  </button>
                </div>
                <p class="text-xs text-muted-foreground">Hide this upsell if any of the selected services were already purchased.</p>
              </div>
            </div>

            <!-- Channels -->
            <div class="flex flex-col gap-2 rounded-md border p-3" :class="isConditionEnabled('channels') ? 'border-primary/30 bg-primary/5' : 'border-border'">
              <div class="flex items-center justify-between">
                <h4 id="visibility-channels" class="text-sm font-medium">Channels</h4>
                <Switch
                  aria-labelledby="visibility-channels"
                  :model-value="isConditionEnabled('channels')"
                  @update:model-value="toggleCondition('channels')"
                />
              </div>
              <p v-if="!isConditionEnabled('channels')" class="text-xs text-muted-foreground">Off — condition ignored</p>
              <div v-else class="flex flex-col gap-1">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="opt in [
                      { value: 'airbnb', label: 'Airbnb' },
                      { value: 'booking_com', label: 'Booking.com' },
                      { value: 'direct', label: 'Direct' },
                      { value: 'agoda', label: 'Agoda' },
                      { value: 'vrbo', label: 'VRBO' },
                      { value: 'expedia', label: 'Expedia' },
                    ]"
                    :key="opt.value"
                    type="button"
                    class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    :class="isChannelSelected(opt.value as OtaChannel)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted/50'"
                    :aria-pressed="isChannelSelected(opt.value as OtaChannel)"
                    @click="toggleChannel(opt.value as OtaChannel)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
                <p class="text-xs text-muted-foreground">Show only on these booking channels.</p>
              </div>
            </div>
          </div>

          <!-- Summary banner -->
          <div class="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Icon name="lucide:info" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{{ summaryText }}</span>
          </div>
        </div>

        <!-- Step 5: Settings -->
        <div v-if="currentStep === 5" class="flex flex-col gap-5 p-6">
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <Label>Tax and Service</Label>
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">
                  {{ formPricingEnabled ? 'On' : 'Off' }}
                </span>
                <Switch :model-value="formPricingEnabled" @update:model-value="formPricingEnabled = $event" />
              </div>
            </div>
            <div v-if="formPricingEnabled" class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <Label class="text-xs font-normal text-muted-foreground">Tax</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="formTaxPercent" type="number" min="0" max="100" class="flex-1" />
                  <span class="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <Label class="text-xs font-normal text-muted-foreground">Service</Label>
                <div class="flex items-center gap-2">
                  <Input v-model.number="formServicePercent" type="number" min="0" max="100" class="flex-1" />
                  <span class="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <Label>Add Users to Receive WhatsApp Notification</Label>
            <div v-if="formNotificationUsers.length === 0" class="rounded-md border border-dashed p-4 text-center">
              <p class="text-sm text-muted-foreground">
                No users have been added yet
              </p>
              <p class="text-xs text-muted-foreground">
                Add users to receive notifications.
              </p>
            </div>
            <div v-else class="flex flex-col gap-1.5">
              <div
                v-for="(user, idx) in formNotificationUsers"
                :key="idx"
                class="flex items-center justify-between rounded-md border px-3 py-1.5"
              >
                <div class="flex items-center gap-2">
                  <Icon name="lucide:user" class="h-3.5 w-3.5 text-muted-foreground" />
                  <span class="text-sm">{{ user }}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-muted-foreground hover:text-destructive"
                  @click="removeNotificationUser(idx)"
                >
                  <Icon name="lucide:x" class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Input
                v-model="formNewNotificationUser"
                placeholder="User name"
                class="flex-1"
                @keydown.enter.prevent="addNotificationUser"
              />
              <Button variant="outline" size="sm" class="h-9" @click="addNotificationUser">
                <Icon name="lucide:plus" class="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <Label>Internal Notes</Label>
            <Textarea
              v-model="formInternalNotes"
              placeholder="Add any internal notes or instructions relevant to this upsell"
              rows="2"
            />
          </div>

          <Separator />

          <div class="flex items-center justify-between">
            <Label>Status</Label>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">
                {{ formStatus === 'active' ? 'Active' : 'Inactive' }}
              </span>
              <Switch
                :checked="formStatus === 'active'"
                @update:checked="formStatus = $event ? 'active' : 'inactive'"
              />
            </div>
          </div>
        </div>
      </ScrollArea>

      <div class="border-t shrink-0 px-6 py-4">
        <div class="flex items-center gap-2">
          <Button
            v-if="currentStep > 1"
            variant="outline"
            @click="prevStep"
          >
            <Icon name="lucide:chevron-left" class="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button
            v-else
            variant="outline"
            @click="onOpenChange(false)"
          >
            Cancel
          </Button>
          <Button class="flex-1" @click="currentStep < 5 ? nextStep() : handleSave()">
            <template v-if="currentStep < 5">
              Next
              <Icon name="lucide:chevron-right" class="ml-1 h-4 w-4" />
            </template>
            <template v-else>
              {{ isEditing ? 'Save Changes' : 'Create Service' }}
            </template>
          </Button>
        </div>
        <div v-if="isEditing" class="mt-3">
          <AlertDialog v-model:open="showDeleteConfirm">
            <AlertDialogTrigger as-child>
              <Button variant="destructive" class="w-full" size="sm">
                <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                Delete Service
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this service?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove "{{ props.service?.name }}" from your catalog. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="handleDelete">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SheetContent>

    <!-- Item Modal -->
    <Dialog v-model:open="showItemModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingItemId ? 'Edit Item' : 'Add Item' }}</DialogTitle>
          <DialogDescription>
            Define an option guests can choose from within this service.
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-2">
            <Label>Name <span class="text-destructive">*</span></Label>
            <Input v-model="itemFormName" placeholder="e.g., Standard Sedan, Scooter" />
          </div>
          <div class="flex flex-col gap-2">
            <Label>Description</Label>
            <Textarea v-model="itemFormDescription" placeholder="Describe this option..." rows="2" />
          </div>
          <div class="flex flex-col gap-2">
            <Label>Price</Label>
            <div class="flex items-center gap-2">
              <Input v-model.number="itemFormPrice" type="number" min="0" placeholder="0" class="flex-1" />
              <span class="text-sm text-muted-foreground">{{ formCurrency }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <Label>Image</Label>
            <input
              ref="itemImageInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleItemImageUpload"
            >
            <div v-if="itemFormImage" class="relative">
              <img
                :src="itemFormImage"
                :alt="itemFormName"
                class="h-32 w-full rounded-md border object-cover"
              >
              <Button
                variant="destructive"
                size="icon"
                class="absolute right-2 top-2 h-7 w-7"
                @click="itemFormImage = undefined"
              >
                <Icon name="lucide:x" class="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              v-else
              variant="outline"
              class="w-full"
              @click="itemImageInputRef?.click()"
            >
              <Icon name="lucide:upload" class="mr-2 h-4 w-4" />
              Upload Image
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showItemModal = false">
            Cancel
          </Button>
          <Button @click="saveItemModal">
            {{ editingItemId ? 'Save Changes' : 'Add Item' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Sheet>
</template>
