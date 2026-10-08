<script setup lang="ts">
import type { LockAccessConfig } from '@/components/upsells/data/lock-access'
import type {
  UpsellCategory,
  UpsellItem,
  UpsellPriceUnit,
  UpsellService,
  VisibilityConditions,
  VisibilityMatchMode,
} from '@/components/upsells/data/upsell-services'
import type { TernTier } from '~/components/reservations/data/tern-products'
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
import {
  BALI_LISTINGS,
  emptyVisibilityConditions,
  PRICE_UNIT_CATEGORIES,
  PRICE_UNIT_OPTIONS,
  priceUnitSuffix,
  PROTECTION_CATEGORY,
  summarizeVisibility,
  UPSELL_CURRENCIES,
} from '@/components/upsells/data/upsell-services'
import { useUpsellServices } from '@/composables/useUpsellServices'
import CoverageBreakdown from '~/components/damage-protection/CoverageBreakdown.vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { TERN_PRODUCTS, ternPriceFor, ternSizeLabel } from '~/components/reservations/data/tern-products'
import RichTextEditor from '~/components/shared/RichTextEditor.vue'
import UpsellVisibilityGroup from '~/components/upsells/UpsellVisibilityGroup.vue'
import { defaultRoles } from '~/components/users/data/roles'
import { computeInitials } from '~/components/users/data/users'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useUsers } from '~/composables/useUsers'
import { hasRichTextTags, plainTextToHtml } from '~/lib/rich-text'

const props = defineProps<{
  service: UpsellService | null
  initialCategory: UpsellCategory | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** After a save, with the service as stored. */
  'saved': [service: UpsellService]
}>()

const { addService, updateService, deleteService } = useUpsellServices()

const isEditing = computed(() => props.service !== null)

const currentStep = ref(1)
const visitedSteps = ref<Set<number>>(new Set([1]))
const nameError = ref(false)

const formCategory = ref<UpsellService['category']>('Airport Transport')
const formCurrency = ref('CHF')
const formPriceUnit = ref<UpsellPriceUnit>('flat')
const formAddToHousekeepingPrep = ref(false)

/**
 * ⚠️ A Damage Protection service is not sold like the others: it sells one
 * Elev8 Cover package, and the tenant picks ONE package for every listing in
 * Settings, Damage protection, so it has no listings step. The guest meets it
 * in the guest guide's Damage protection section, so visibility rules,
 * availability and lock access do not apply and are not shown.
 */
const isProtection = computed(() => formCategory.value === PROTECTION_CATEGORY)
const hasPriceUnit = computed(() => PRICE_UNIT_CATEGORIES.includes(formCategory.value))

/**
 * ⚠️ A Damage Protection upsell sells ONE package: a tier and its guest price,
 * picked here rather than added as items. Bronze and Silver are two upsells.
 */
const packageTier = ref<TernTier>('bronze')
const packagePrice = ref(0)
const packageCover = computed(() => ternPriceFor(packageTier.value, formCurrency.value))
/** What Elev8 charges the tenant for this package, and what is left of the guest price. */
const packageFeeText = computed(() => {
  const cover = packageCover.value
  if (!cover)
    return ''
  const fee = `Elev8 charges you ${formatProtectionAmount(cover.perStayFee, formCurrency.value)} per package (30 nights of a covered stay), billed on the 1st of the month after check-out`
  return packagePrice.value > 0
    ? `${fee}, so you keep ${formatProtectionAmount(packagePrice.value - cover.perStayFee, formCurrency.value)}.`
    : `${fee}.`
})

const steps = computed(() => isProtection.value
  ? [
      { id: 1, label: 'Basic Info' },
      { id: 2, label: 'Package' },
      { id: 5, label: 'Settings' },
    ]
  : [
      { id: 1, label: 'Basic Info' },
      { id: 2, label: 'Items' },
      { id: 3, label: 'Listings' },
      { id: 4, label: 'Visibility' },
      { id: 5, label: 'Settings' },
    ])
const lastStepId = computed(() => steps.value[steps.value.length - 1]!.id)
/** The step badge shows its position, so a skipped step leaves no gap in the numbers. */
function stepNumber(stepId: number) {
  return steps.value.findIndex(step => step.id === stepId) + 1
}

function stepCircleClass(stepId: number) {
  if (currentStep.value === stepId)
    return 'bg-primary text-primary-foreground'
  if (visitedSteps.value.has(stepId))
    return 'bg-primary/20 text-foreground'
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
  const index = steps.value.findIndex(step => step.id === currentStep.value)
  goToStep(steps.value[index + 1]?.id ?? lastStepId.value)
}

function prevStep() {
  const index = steps.value.findIndex(step => step.id === currentStep.value)
  goToStep(steps.value[Math.max(0, index - 1)]!.id)
}

const formName = ref('')
const formDescription = ref('')
const descriptionEditor = ref<InstanceType<typeof RichTextEditor> | null>(null)

const DESCRIPTION_VARIABLES = [
  { token: '<guest_first_name>', label: 'Guest first name' },
  { token: '<guest_last_name>', label: 'Guest last name' },
  { token: '<listing_name>', label: 'Listing name' },
]

/**
 * Descriptions from before the editor are plain text whose variables look like tags
 * (`<guest_first_name>`): open them as escaped paragraphs so the editor keeps them.
 */
function toDescriptionHtml(text: string): string {
  return !text || hasRichTextTags(text) ? text : plainTextToHtml(text)
}

/** Inserts a variable at the cursor as text (never parsed as a tag), caret after it. */
function insertDescriptionVariable(token: string) {
  descriptionEditor.value?.editor?.chain().focus().insertContent({ type: 'text', text: token }).run()
}
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
const formHideVisibility = ref<VisibilityConditions>(emptyVisibilityConditions())
const formHideVisibilityMatchMode = ref<VisibilityMatchMode>('any')

const otherUpsellServices = computed(() => {
  const all = useUpsellServices().services.value
  return props.service ? all.filter(s => s.id !== props.service!.id) : all
})

function describeGroup(conditions: VisibilityConditions, match: VisibilityMatchMode): string {
  return summarizeVisibility(conditions).map(e => e.label).join(match === 'all' ? ' and ' : ' or ')
}

const visibilitySummary = computed(() => {
  const show = describeGroup(formVisibility.value, formVisibilityMatchMode.value)
  const hide = describeGroup(formHideVisibility.value, formHideVisibilityMatchMode.value)
  const showLine = show ? `Shown when ${show}.` : 'Shown to every eligible stay.'
  return hide ? `${showLine} Hidden when ${hide}; hide rules win.` : showLine
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

// Listing picker filters (Listings step), reset on every open.
const listingSearch = ref('')
const listingTagFilter = ref<string[]>([])
const listingTagSearch = ref('')
const listingTagPopoverOpen = ref(false)

watch(() => props.open, (open) => {
  if (open) {
    showDeleteConfirm.value = false
    listingSearch.value = ''
    listingTagFilter.value = []
    if (props.service) {
      currentStep.value = 1
      visitedSteps.value = new Set([1, 2, 3, 4, 5])
      nameError.value = false
      formName.value = props.service.name
      formDescription.value = toDescriptionHtml(props.service.description)
      formCategory.value = props.service.category
      formCurrency.value = props.service.currency
      formPriceUnit.value = props.service.priceUnit ?? 'flat'
      formAddToHousekeepingPrep.value = props.service.addToHousekeepingPrep ?? false
      formImage.value = props.service.image
      formYoutubeLinks.value = [...props.service.youtubeLinks]
      formInternalNotes.value = props.service.internalNotes
      formNotificationUsers.value = [...props.service.notificationUsers]
      formPricingEnabled.value = props.service.pricingEnabled
      formTaxPercent.value = props.service.taxPercent
      formServicePercent.value = props.service.servicePercent
      formItems.value = props.service.items.map(i => ({ ...i }))
      packageTier.value = props.service.items.find(i => i.coverTier)?.coverTier ?? 'bronze'
      packagePrice.value = props.service.items.find(i => i.coverTier)?.price ?? 0
      formListings.value = [...props.service.assignedListings]
      formAvailability.value = props.service.availability
      formLockAccess.value = props.service.lockAccess
        ? { ...props.service.lockAccess, lockNames: [...props.service.lockAccess.lockNames] }
        : createDefaultLockAccessConfig()
      formStatus.value = props.service.status
      formVisibility.value = { ...props.service.visibility }
      formVisibilityMatchMode.value = props.service.visibilityMatchMode
      formHideVisibility.value = { ...(props.service.hideVisibility ?? emptyVisibilityConditions()) }
      formHideVisibilityMatchMode.value = props.service.hideVisibilityMatchMode ?? 'any'
    }
    else {
      formName.value = ''
      formDescription.value = ''
      formCategory.value = props.initialCategory ?? 'Airport Transport'
      // Elev8 Cover is priced in USD only for now (`tern-products.ts`).
      formCurrency.value = formCategory.value === PROTECTION_CATEGORY ? 'USD' : 'CHF'
      formPriceUnit.value = 'flat'
      formAddToHousekeepingPrep.value = false
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
      packageTier.value = 'bronze'
      packagePrice.value = 0
      formListings.value = []
      formAvailability.value = 'always'
      formLockAccess.value = createDefaultLockAccessConfig()
      formStatus.value = 'active'
      formVisibility.value = emptyVisibilityConditions()
      formVisibilityMatchMode.value = 'all'
      formHideVisibility.value = emptyVisibilityConditions()
      formHideVisibilityMatchMode.value = 'any'
      currentStep.value = 1
      visitedSteps.value = new Set([1])
      nameError.value = false
    }
  }
}, { immediate: true })

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

// Notified users are stored by name; the picker offers active staff.
const { activeUsers } = useUsers()
const notifyPickerOpen = ref(false)

function roleName(roleId: string): string {
  return defaultRoles.find(r => r.id === roleId)?.name ?? ''
}

const notifyCandidates = computed(() => {
  const q = formNewNotificationUser.value.trim().toLowerCase()
  return activeUsers.value
    .filter(u => !q || u.name.toLowerCase().includes(q) || roleName(u.roleId).toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
})

/** Selected names with their staff record when there is one (older services may name someone no longer listed). */
const notifySelected = computed(() =>
  formNotificationUsers.value.map((name) => {
    const user = activeUsers.value.find(u => u.name === name)
    return { name, initials: user?.initials ?? computeInitials(name), avatarUrl: user?.avatarUrl, role: user ? roleName(user.roleId) : '' }
  }),
)

function toggleNotificationUser(name: string) {
  formNotificationUsers.value = formNotificationUsers.value.includes(name)
    ? formNotificationUsers.value.filter(n => n !== name)
    : [...formNotificationUsers.value, name]
}

function removeNotificationUser(name: string) {
  formNotificationUsers.value = formNotificationUsers.value.filter(n => n !== name)
}

function toggleListing(listing: string) {
  if (formListings.value.includes(listing)) {
    formListings.value = formListings.value.filter(l => l !== listing)
  }
  else {
    formListings.value = [...formListings.value, listing]
  }
}

// Listing picker: search + tag filter (AND, like the Listings page). Select all / clear act on the visible rows.

function listingTags(name: string): string[] {
  return allListings.value.find(l => l.name === name)?.tags ?? []
}

const listingTagOptions = computed(() =>
  [...new Set(BALI_LISTINGS.flatMap(listingTags))].sort((a, b) => a.localeCompare(b)),
)

const filteredListingTagOptions = computed(() => {
  const q = listingTagSearch.value.trim().toLowerCase()
  return q ? listingTagOptions.value.filter(t => t.toLowerCase().includes(q)) : listingTagOptions.value
})

const visibleListings = computed(() => {
  const q = listingSearch.value.trim().toLowerCase()
  return BALI_LISTINGS.filter((name) => {
    if (q && !name.toLowerCase().includes(q))
      return false
    const tags = listingTags(name)
    return listingTagFilter.value.every(t => tags.includes(t))
  })
})

const visibleSelectedCount = computed(() => visibleListings.value.filter(l => formListings.value.includes(l)).length)
const allVisibleSelected = computed(() => visibleListings.value.length > 0 && visibleSelectedCount.value === visibleListings.value.length)

function toggleListingTag(tag: string) {
  listingTagFilter.value = listingTagFilter.value.includes(tag)
    ? listingTagFilter.value.filter(t => t !== tag)
    : [...listingTagFilter.value, tag]
}

function toggleAllVisibleListings() {
  const visible = new Set(visibleListings.value)
  formListings.value = allVisibleSelected.value
    ? formListings.value.filter(l => !visible.has(l))
    : [...new Set([...formListings.value, ...visibleListings.value])]
}

function clearAllListings() {
  formListings.value = []
}

function tierName(tier: TernTier) {
  return TERN_PRODUCTS.find(product => product.tier === tier)?.name ?? ''
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
  if (isProtection.value) {
    // No currency conversion, ever: a tier Elev8 Cover does not price in this
    // currency would sell a waiver that covers nothing.
    if (!packageCover.value) {
      toast.error(`Elev8 Cover ${tierName(packageTier.value)} is not available in ${formCurrency.value} yet.`)
      goToStep(2)
      return
    }
    if (!(packagePrice.value > 0)) {
      toast.error('Set what the guest pays for the package.')
      goToStep(2)
      return
    }
    const existing = formItems.value[0]
    formItems.value = [{
      ...existing,
      id: existing?.id ?? `itm-${Date.now()}`,
      name: tierName(packageTier.value),
      price: packagePrice.value,
      coverTier: packageTier.value,
    }]
  }
  else if (formItems.value.length === 0) {
    toast.error('At least one item is required.')
    goToStep(2)
    return
  }

  const data = {
    name: formName.value.trim(),
    description: formDescription.value.trim(),
    category: formCategory.value,
    currency: formCurrency.value,
    priceUnit: hasPriceUnit.value ? formPriceUnit.value : undefined,
    addToHousekeepingPrep: isProtection.value ? undefined : formAddToHousekeepingPrep.value,
    image: formImage.value,
    youtubeLinks: formYoutubeLinks.value,
    internalNotes: formInternalNotes.value.trim(),
    notificationUsers: formNotificationUsers.value,
    pricingEnabled: formPricingEnabled.value,
    taxPercent: formTaxPercent.value,
    servicePercent: formServicePercent.value,
    items: formItems.value,
    // A protection package is offered on every listing from Settings: it is assigned to none.
    assignedListings: isProtection.value ? [] : formListings.value,
    availability: formAvailability.value,
    lockAccess: formLockAccess.value.enabled && !isProtection.value
      ? {
          enabled: true,
          lockNames: [...formLockAccess.value.lockNames],
          instructions: formLockAccess.value.instructions?.trim() || undefined,
        }
      : undefined,
    status: formStatus.value,
    visibility: { ...formVisibility.value },
    visibilityMatchMode: formVisibilityMatchMode.value,
    hideVisibility: { ...formHideVisibility.value },
    hideVisibilityMatchMode: formHideVisibilityMatchMode.value,
  }

  let savedId: string
  if (isEditing.value && props.service) {
    updateService(props.service.id, data)
    savedId = props.service.id
    toast.success('Service updated.')
  }
  else {
    savedId = addService(data).id
    toast.success('Service created.')
  }
  if (isProtection.value) {
    // The tenant's package may be this one (its price or status changed): host-paid cover follows now.
    useDamageProtection().syncHostCover()
  }
  const saved = useUpsellServices().services.value.find(s => s.id === savedId)
  if (saved)
    emit('saved', saved)
  emit('update:open', false)
}

function handleDelete() {
  if (props.service) {
    const wasProtection = props.service.category === PROTECTION_CATEGORY
    deleteService(props.service.id)
    toast.success('Service deleted.')
    if (wasProtection)
      useDamageProtection().syncHostCover()
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
                <span v-else class="text-xs font-medium">{{ stepNumber(step.id) }}</span>
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
            <RichTextEditor
              ref="descriptionEditor"
              v-model="formDescription"
              aria-label="Description"
              placeholder="Describe the service guests will see..."
              content-class="min-h-24 text-sm"
              class="overflow-hidden"
            >
              <template #footer>
                <div class="flex flex-wrap items-center gap-1.5 border-t bg-muted/40 px-3 py-2">
                  <span class="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon name="lucide:braces" class="size-3.5" />
                    Insert variable
                  </span>
                  <button
                    v-for="v in DESCRIPTION_VARIABLES"
                    :key="v.token"
                    type="button"
                    :title="v.token"
                    class="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    @click="insertDescriptionVariable(v.token)"
                  >
                    <Icon name="lucide:plus" class="size-3" />
                    {{ v.label }}
                  </button>
                </div>
              </template>
            </RichTextEditor>
            <p class="text-xs text-muted-foreground">
              Variables are replaced with the guest's and listing's details when the upsell is shown.
            </p>
          </div>

          <div v-if="!isProtection" class="flex flex-col gap-2">
            <Label>Currency</Label>
            <Select v-model="formCurrency">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="code in UPSELL_CURRENCIES" :key="code" :value="code">
                  {{ code }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              Item prices are charged in this currency. Changing it does not convert existing prices.
            </p>
          </div>

          <div v-if="hasPriceUnit" class="flex flex-col gap-2">
            <Label>Unit Price</Label>
            <Select v-model="formPriceUnit">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in PRICE_UNIT_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              Applies to every item in this service.
            </p>
          </div>

          <div v-if="!isProtection" class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-0.5">
              <Label for="upsell-housekeeping-prep">Add order to Housekeeping Preparation</Label>
              <p class="text-xs text-muted-foreground">
                Housekeeping sees this order when preparing the property for the stay.
              </p>
            </div>
            <Switch
              id="upsell-housekeeping-prep"
              :model-value="formAddToHousekeepingPrep"
              @update:model-value="(v: boolean) => formAddToHousekeepingPrep = v"
            />
          </div>

          <p
            v-if="isProtection"
            class="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground"
            data-testid="upsell-protection-note"
          >
            <Icon name="lucide:shield-check" class="mt-0.5 size-4 shrink-0" />
            <span>
              Priced in {{ formCurrency }}, the currency Elev8 Cover is priced in. Choose the package every listing
              offers in Settings, Damage protection; guests buy it in the guest guide, not with the other upsells.
            </span>
          </p>

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

        <!-- Step 2, Damage Protection: the ONE package this upsell sells -->
        <div v-if="currentStep === 2 && isProtection" class="flex flex-col gap-5 p-6" data-testid="upsell-protection-package">
          <div>
            <p class="text-sm font-medium">
              Elev8 Cover tier
            </p>
            <p class="text-xs text-muted-foreground">
              One package per upsell. For another tier, create another Damage Protection upsell.
            </p>
          </div>
          <div class="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Elev8 Cover tier">
            <button
              v-for="product in TERN_PRODUCTS"
              :key="product.tier"
              type="button"
              role="radio"
              :aria-checked="packageTier === product.tier"
              class="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors"
              :class="packageTier === product.tier ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/60'"
              :data-testid="`upsell-tier-${product.tier}`"
              @click="packageTier = product.tier"
            >
              <span class="flex items-center gap-2 text-sm font-medium">
                {{ product.name }}
                <Icon v-if="packageTier === product.tier" name="lucide:check" class="ml-auto size-4 text-primary" />
              </span>
              <span class="text-xs text-muted-foreground">{{ ternSizeLabel(product) }}</span>
              <span class="text-xs text-muted-foreground">
                {{ ternPriceFor(product.tier, formCurrency)
                  ? `Covers up to ${formatProtectionAmount(ternPriceFor(product.tier, formCurrency)!.coverageCap, formCurrency)}`
                  : `Not available in ${formCurrency}` }}
              </span>
              <span
                v-if="ternPriceFor(product.tier, formCurrency)"
                class="text-xs"
                :class="product.tier !== product.baseTier ? 'font-medium text-foreground' : 'text-muted-foreground'"
                :data-testid="`upsell-tier-liability-${product.tier}`"
              >
                Liability up to {{ formatProtectionAmount(ternPriceFor(product.tier, formCurrency)!.coverage.liability.limit, formCurrency) }}
              </span>
              <span
                v-if="ternPriceFor(product.tier, formCurrency)"
                class="text-xs font-medium"
                :data-testid="`upsell-tier-fee-${product.tier}`"
              >
                Elev8 charges you {{ formatProtectionAmount(ternPriceFor(product.tier, formCurrency)!.perStayFee, formCurrency) }}
              </span>
            </button>
          </div>
          <CoverageBreakdown :tier="packageTier" :currency="formCurrency" />
          <div class="flex flex-col gap-2">
            <Label for="upsell-package-price">Guest pays, per 30 nights</Label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{{ formCurrency }}</span>
              <Input id="upsell-package-price" v-model.number="packagePrice" type="number" min="0" class="pl-14" data-testid="upsell-package-price" />
            </div>
            <p v-if="packageFeeText" class="text-xs text-muted-foreground" data-testid="upsell-package-fee">
              {{ packageFeeText }}
            </p>
          </div>
        </div>

        <!-- Step 2: Items -->
        <div v-if="currentStep === 2 && !isProtection" class="flex flex-col gap-5 p-6">
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
                      {{ formCurrency }} {{ item.price.toLocaleString() }}<template v-if="hasPriceUnit && priceUnitSuffix(formPriceUnit)"> {{ priceUnitSuffix(formPriceUnit) }}</template>
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
        <div v-if="currentStep === 3 && !isProtection" class="flex flex-col gap-5 p-6">
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Label>Assigned Listings</Label>
                <Badge variant="secondary" class="font-normal">
                  {{ formListings.length }} of {{ BALI_LISTINGS.length }}
                </Badge>
              </div>
              <Button
                v-if="formListings.length"
                variant="ghost"
                size="sm"
                class="h-7 text-xs text-muted-foreground"
                @click="clearAllListings"
              >
                Clear selection
              </Button>
            </div>

            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <Icon name="lucide:search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input v-model="listingSearch" placeholder="Search listings..." class="h-9 pl-8" />
              </div>
              <Popover v-model:open="listingTagPopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-9 gap-1.5 text-xs"
                    :class="listingTagFilter.length > 0 ? 'border-primary text-primary' : ''"
                  >
                    <Icon name="lucide:tag" class="size-3.5" />
                    Tags
                    <Badge v-if="listingTagFilter.length > 0" variant="default" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[9px]">
                      {{ listingTagFilter.length }}
                    </Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-56 p-0" align="end" :side-offset="4">
                  <div class="p-2">
                    <Input v-model="listingTagSearch" placeholder="Search tags..." class="h-7 text-xs" />
                  </div>
                  <div class="max-h-48 overflow-y-auto px-1 pb-1">
                    <div
                      v-for="tag in filteredListingTagOptions"
                      :key="tag"
                      class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      @click="toggleListingTag(tag)"
                    >
                      <div
                        class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                        :class="listingTagFilter.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                      >
                        <Icon v-if="listingTagFilter.includes(tag)" name="lucide:check" class="size-3" />
                      </div>
                      <span class="flex-1">{{ tag }}</span>
                    </div>
                    <p v-if="filteredListingTagOptions.length === 0" class="px-2 py-1.5 text-xs text-muted-foreground">
                      No tags found.
                    </p>
                  </div>
                  <div v-if="listingTagFilter.length > 0" class="border-t px-2 py-2">
                    <Button variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="listingTagFilter = []">
                      Clear all tags
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div v-if="listingTagFilter.length" class="flex flex-wrap items-center gap-1.5">
              <Badge
                v-for="tag in listingTagFilter"
                :key="tag"
                variant="outline"
                class="cursor-pointer gap-1 font-normal"
                @click="toggleListingTag(tag)"
              >
                {{ tag }}
                <Icon name="lucide:x" class="size-3" />
              </Badge>
            </div>

            <div class="overflow-hidden rounded-md border">
              <div
                v-if="visibleListings.length"
                class="flex cursor-pointer items-center gap-3 border-b bg-muted/40 px-3 py-2"
                @click="toggleAllVisibleListings"
              >
                <div
                  class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                  :class="visibleSelectedCount > 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'"
                >
                  <Icon v-if="allVisibleSelected" name="lucide:check" class="size-3" />
                  <Icon v-else-if="visibleSelectedCount > 0" name="lucide:minus" class="size-3" />
                </div>
                <span class="text-xs font-medium text-muted-foreground">
                  {{ listingSearch || listingTagFilter.length ? `Select all ${visibleListings.length} results` : 'Select all listings' }}
                </span>
              </div>
              <div class="max-h-72 overflow-y-auto">
                <div
                  v-for="listing in visibleListings"
                  :key="listing"
                  class="flex cursor-pointer items-start gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/50"
                  @click="toggleListing(listing)"
                >
                  <div
                    class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                    :class="formListings.includes(listing) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                  >
                    <Icon v-if="formListings.includes(listing)" name="lucide:check" class="size-3" />
                  </div>
                  <div class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="text-sm leading-tight">{{ listing }}</span>
                    <div v-if="listingTags(listing).length" class="flex flex-wrap gap-1">
                      <span
                        v-for="tag in listingTags(listing)"
                        :key="tag"
                        class="rounded px-1.5 py-px text-[10px]"
                        :class="listingTagFilter.includes(tag) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
                      >
                        {{ tag }}
                      </span>
                    </div>
                  </div>
                </div>
                <p v-if="visibleListings.length === 0" class="px-3 py-8 text-center text-sm text-muted-foreground">
                  No listings match your search.
                </p>
              </div>
            </div>
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

        <!-- Step 4: Visibility (show rules, hide rules; hide wins) -->
        <div v-if="currentStep === 4" class="flex flex-col gap-4 p-6">
          <UpsellVisibilityGroup
            v-model="formVisibility"
            v-model:match="formVisibilityMatchMode"
            mode="show"
            :other-services="otherUpsellServices"
          />
          <UpsellVisibilityGroup
            v-model="formHideVisibility"
            v-model:match="formHideVisibilityMatchMode"
            mode="hide"
            :other-services="otherUpsellServices"
          />
          <div class="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground" data-testid="visibility-summary">
            <Icon name="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
            <span>{{ visibilitySummary }}</span>
          </div>
        </div>

        <!-- Step 5: Settings -->
        <div v-if="currentStep === 5" class="flex flex-col gap-5 p-6">
          <div v-if="!isProtection" class="flex flex-col gap-3">
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

          <Separator v-if="!isProtection" />

          <div v-if="!isProtection" class="flex flex-col gap-2">
            <div class="flex flex-col gap-0.5">
              <Label>Notify Users</Label>
              <p class="text-xs text-muted-foreground">
                These users get a notification when a guest orders this service.
              </p>
            </div>

            <div v-if="notifySelected.length" class="flex flex-col divide-y rounded-md border">
              <div
                v-for="user in notifySelected"
                :key="user.name"
                class="flex items-center gap-3 px-3 py-2"
              >
                <Avatar class="size-7">
                  <AvatarImage v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name" />
                  <AvatarFallback class="text-[10px]">
                    {{ user.initials }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ user.name }}
                  </p>
                  <p v-if="user.role" class="truncate text-xs text-muted-foreground">
                    {{ user.role }}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 text-muted-foreground hover:text-destructive"
                  :aria-label="`Remove ${user.name}`"
                  @click="removeNotificationUser(user.name)"
                >
                  <Icon name="lucide:x" class="size-3.5" />
                </Button>
              </div>
            </div>

            <Popover v-model:open="notifyPickerOpen" @update:open="(v: boolean) => { if (!v) formNewNotificationUser = '' }">
              <PopoverTrigger as-child>
                <Button variant="outline" class="w-full justify-start font-normal text-muted-foreground">
                  <Icon name="lucide:user-plus" class="mr-2 size-4" />
                  {{ notifySelected.length ? 'Add more users' : 'Add users' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" class="w-(--reka-popover-trigger-width) p-0">
                <div class="border-b p-2">
                  <Input v-model="formNewNotificationUser" placeholder="Search by name or role" class="h-8 text-sm" />
                </div>
                <div class="max-h-64 overflow-y-auto">
                  <div class="p-1">
                    <div
                      v-for="user in notifyCandidates"
                      :key="user.id"
                      class="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-muted"
                      @click="toggleNotificationUser(user.name)"
                    >
                      <div
                        class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                        :class="formNotificationUsers.includes(user.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                      >
                        <Icon v-if="formNotificationUsers.includes(user.name)" name="lucide:check" class="size-3" />
                      </div>
                      <Avatar class="size-6">
                        <AvatarImage v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name" />
                        <AvatarFallback class="text-[10px]">
                          {{ user.initials }}
                        </AvatarFallback>
                      </Avatar>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm">
                          {{ user.name }}
                        </p>
                        <p class="truncate text-xs text-muted-foreground">
                          {{ roleName(user.roleId) }}
                        </p>
                      </div>
                    </div>
                    <p v-if="notifyCandidates.length === 0" class="px-2 py-6 text-center text-sm text-muted-foreground">
                      No users found.
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Separator v-if="!isProtection" />

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

      <div class="flex shrink-0 items-center gap-2 border-t px-6 py-4">
        <AlertDialog v-if="isEditing" v-model:open="showDeleteConfirm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <AlertDialogTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete service"
                  >
                    <Icon name="lucide:trash-2" class="size-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Delete service</TooltipContent>
            </Tooltip>
          </TooltipProvider>
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

        <div class="ml-auto flex items-center gap-2" :class="isEditing ? '' : 'flex-1'">
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
          <!-- Editing: every step is already filled, so Save is always available and Next is secondary -->
          <template v-if="isEditing">
            <Button v-if="currentStep < lastStepId" variant="outline" @click="nextStep()">
              Next
              <Icon name="lucide:chevron-right" class="ml-1 h-4 w-4" />
            </Button>
            <Button @click="handleSave()">
              Save Changes
            </Button>
          </template>
          <Button v-else class="flex-1" @click="currentStep < lastStepId ? nextStep() : handleSave()">
            <template v-if="currentStep < lastStepId">
              Next
              <Icon name="lucide:chevron-right" class="ml-1 h-4 w-4" />
            </template>
            <template v-else>
              Create Service
            </template>
          </Button>
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
            <Label>Price<template v-if="hasPriceUnit && priceUnitSuffix(formPriceUnit)"> <span class="font-normal text-muted-foreground">({{ priceUnitSuffix(formPriceUnit) }})</span></template></Label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{{ formCurrency }}</span>
              <Input v-model.number="itemFormPrice" type="number" min="0" placeholder="0" class="pl-14" />
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
