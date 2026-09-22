<script setup lang="ts">
import type { AssetStatus, InventoryDocument, InventoryItem, InventoryItemType } from '@/components/inventory/data/catalog'
import type { InventoryTimelineEvent } from '@/components/inventory/data/timeline-events'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { DEFAULT_USEFUL_LIFE, INVENTORY_CATEGORIES } from '@/components/inventory/data/catalog'
import { useInventoryCatalog } from '@/composables/useInventoryCatalog'
import { useInventoryTimeline } from '@/composables/useInventoryTimeline'

const props = defineProps<{
  open: boolean
  item?: InventoryItem | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { addItem, updateItem, getBookValue, markServiced, addMaintenanceSchedule, removeMaintenanceSchedule } = useInventoryCatalog()
const { events } = useInventoryTimeline()

const isOpen = computed({
  get: () => props.open,
  set: val => emit('update:open', val),
})

const isEditing = computed(() => !!props.item)
const activeTab = ref('details')

// ── Form state ──────────────────────────────────────────────
const name = ref('')
const category = ref<InventoryItem['category']>('Furniture')
const type = ref<InventoryItemType>('permanent')
const unit = ref('')
const photo = ref<string | undefined>(undefined)
const purchaseValue = ref<number | undefined>(undefined)
const purchaseDate = ref<string | undefined>(undefined)
const warrantyExpiry = ref<string | undefined>(undefined)
const supplierName = ref('')
const supplierContact = ref('')
const notes = ref('')
const documents = ref<InventoryDocument[]>([])

// Asset management
const assetStatus = ref<AssetStatus>('active')
const usefulLifeYears = ref<number | undefined>(undefined)
const salvageValue = ref<number | undefined>(undefined)

// New maintenance schedule form
const newScheduleName = ref('')
const newScheduleInterval = ref<number>(90)
const showAddSchedule = ref(false)

const liveBookValue = computed(() => {
  if (!purchaseValue.value || !purchaseDate.value || !usefulLifeYears.value)
    return undefined
  const yearsOwned = (Date.now() - new Date(purchaseDate.value).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const salvage = salvageValue.value ?? 0
  const annual = (purchaseValue.value - salvage) / usefulLifeYears.value
  return Math.max(salvage, Math.round(purchaseValue.value - annual * yearsOwned))
})

const liveDepreciationPct = computed(() => {
  if (!purchaseValue.value || liveBookValue.value === undefined)
    return undefined
  return Math.round(((purchaseValue.value - liveBookValue.value) / purchaseValue.value) * 100)
})

// Current item's maintenance schedules (reactive from state)
const currentItem = computed(() => props.item)

const itemHistory = computed<InventoryTimelineEvent[]>(() =>
  props.item
    ? events.value
        .filter(e => e.itemId === props.item!.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [],
)

function resetForm() {
  name.value = ''
  category.value = 'Furniture'
  type.value = 'permanent'
  unit.value = ''
  photo.value = undefined
  purchaseValue.value = undefined
  purchaseDate.value = undefined
  warrantyExpiry.value = undefined
  supplierName.value = ''
  supplierContact.value = ''
  notes.value = ''
  documents.value = []
  assetStatus.value = 'active'
  usefulLifeYears.value = undefined
  salvageValue.value = undefined
  showAddSchedule.value = false
  newScheduleName.value = ''
  newScheduleInterval.value = 90
}

function populateForm(item: InventoryItem) {
  name.value = item.name
  category.value = item.category
  type.value = item.type
  unit.value = item.unit
  photo.value = item.photo
  purchaseValue.value = item.purchaseValue
  purchaseDate.value = item.purchaseDate
  warrantyExpiry.value = item.warrantyExpiry
  supplierName.value = item.supplier?.name ?? ''
  supplierContact.value = item.supplier?.contact ?? ''
  notes.value = item.notes ?? ''
  documents.value = item.documents ? [...item.documents] : []
  assetStatus.value = item.assetStatus ?? 'active'
  usefulLifeYears.value = item.usefulLifeYears
  salvageValue.value = item.salvageValue
  showAddSchedule.value = false
  newScheduleName.value = ''
  newScheduleInterval.value = 90
}

watch(() => props.open, (val) => {
  if (val) {
    activeTab.value = 'details'
    if (props.item)
      populateForm(props.item)
    else resetForm()
  }
})

watch(category, (cat) => {
  if (!isEditing.value && !usefulLifeYears.value) {
    usefulLifeYears.value = DEFAULT_USEFUL_LIFE[cat]
  }
})

function handlePhotoUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = (evt) => { photo.value = evt.target?.result as string }
  reader.readAsDataURL(file)
}

function handleDocumentUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = (evt) => {
    documents.value = [
      ...documents.value,
      { name: file.name, url: evt.target?.result as string, type: 'other' },
    ]
  }
  reader.readAsDataURL(file)
}

function updateDocType(index: number, docType: InventoryDocument['type']) {
  documents.value = documents.value.map((d, i) => i === index ? { ...d, type: docType } : d)
}

function removeDocument(index: number) {
  documents.value = documents.value.filter((_, i) => i !== index)
}

function handleMarkServiced(scheduleId: string, scheduleName: string) {
  if (!props.item)
    return
  markServiced(props.item.id, scheduleId)
  toast.success(`"${scheduleName}" marked as serviced`)
}

function handleAddSchedule() {
  if (!props.item || !newScheduleName.value.trim())
    return
  addMaintenanceSchedule(props.item.id, {
    name: newScheduleName.value.trim(),
    intervalDays: newScheduleInterval.value,
  })
  newScheduleName.value = ''
  newScheduleInterval.value = 90
  showAddSchedule.value = false
  toast.success('Maintenance schedule added')
}

function handleRemoveSchedule(scheduleId: string) {
  if (!props.item)
    return
  removeMaintenanceSchedule(props.item.id, scheduleId)
}

function getNextDueDate(schedule: { intervalDays: number, lastServicedDate?: string }): Date | null {
  if (!schedule.lastServicedDate)
    return null
  return new Date(new Date(schedule.lastServicedDate).getTime() + schedule.intervalDays * 86400000)
}

function getScheduleStatus(schedule: { intervalDays: number, lastServicedDate?: string }): 'overdue' | 'due_soon' | 'ok' | 'unset' {
  if (!schedule.lastServicedDate)
    return 'unset'
  const next = getNextDueDate(schedule)!
  const diff = next.getTime() - Date.now()
  if (diff < 0)
    return 'overdue'
  if (diff <= 14 * 86400000)
    return 'due_soon'
  return 'ok'
}

function formatDate(d?: string | Date) {
  if (!d)
    return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatIDR(val?: number) {
  if (val === undefined || val === null)
    return '—'
  return `IDR ${val.toLocaleString('id-ID')}`
}

function formatRelativeDate(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0)
    return 'Today'
  if (diff === 1)
    return 'Yesterday'
  if (diff < 7)
    return `${diff} days ago`
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function historyEventIcon(event: InventoryTimelineEvent) {
  switch (event.type) {
    case 'status_changed': return 'lucide:activity'
    case 'maintenance_completed': return 'lucide:wrench'
    default: return 'lucide:circle'
  }
}

function historyEventClass(event: InventoryTimelineEvent) {
  switch (event.type) {
    case 'status_changed':
      return event.details.to === 'active' ? 'text-green-600 border-green-200' : 'text-amber-600 border-amber-200'
    case 'maintenance_completed': return 'text-blue-500 border-blue-200'
    default: return 'text-muted-foreground border-border'
  }
}

function historyEventDescription(event: InventoryTimelineEvent) {
  switch (event.type) {
    case 'status_changed':
      return `Status: ${event.details.from} → ${event.details.to}${event.details.taskTitle ? ` (${event.details.taskTitle})` : ''}`
    case 'maintenance_completed':
      return `Maintenance completed: ${event.details.scheduleName}`
    default: return ''
  }
}

const ASSET_STATUS_OPTIONS: { value: AssetStatus, label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'replaced', label: 'Replaced' },
]

function handleSave() {
  if (!name.value.trim())
    return

  const payload: Omit<InventoryItem, 'id'> = {
    name: name.value.trim(),
    category: category.value,
    type: type.value,
    unit: unit.value.trim(),
    photo: photo.value,
    purchaseValue: purchaseValue.value,
    purchaseDate: purchaseDate.value,
    warrantyExpiry: warrantyExpiry.value,
    documents: documents.value.length > 0 ? documents.value : undefined,
    supplier: supplierName.value.trim()
      ? { name: supplierName.value.trim(), contact: supplierContact.value.trim() }
      : undefined,
    notes: notes.value.trim() || undefined,
    assetStatus: type.value === 'permanent' ? assetStatus.value : undefined,
    usefulLifeYears: type.value === 'permanent' ? usefulLifeYears.value : undefined,
    salvageValue: type.value === 'permanent' ? salvageValue.value : undefined,
    maintenanceSchedules: props.item?.maintenanceSchedules,
  }

  if (isEditing.value && props.item) {
    updateItem(props.item.id, payload)
    toast.success('Item updated')
  }
  else {
    addItem(payload)
    toast.success('Item added to catalog')
  }
  isOpen.value = false
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent class="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{{ isEditing ? 'Edit Item' : 'Add Item' }}</SheetTitle>
        <SheetDescription>
          {{ isEditing ? 'Update item details in the catalog.' : 'Add a new item to the master catalog.' }}
        </SheetDescription>
      </SheetHeader>

      <Tabs v-model="activeTab" class="mt-2">
        <TabsList class="mx-4">
          <TabsTrigger value="details">
            Details
          </TabsTrigger>
          <TabsTrigger v-if="isEditing" value="history">
            History
            <Badge
              v-if="itemHistory.length > 0"
              variant="secondary"
              class="ml-1.5 h-4 min-w-4 px-1 text-xs"
            >
              {{ itemHistory.length }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <!-- Details Tab -->
        <TabsContent value="details">
          <div class="flex flex-col gap-4 px-4 py-4">
            <div class="flex flex-col gap-1.5">
              <Label for="item-name">Item Name <span class="text-destructive">*</span></Label>
              <Input id="item-name" v-model="name" placeholder="e.g. King Bed, Shampoo" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select v-model="category">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="cat in INVENTORY_CATEGORIES" :key="cat" :value="cat">
                      {{ cat }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Unit</Label>
                <Input v-model="unit" placeholder="pcs / bottle / set" />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Type</Label>
              <RadioGroup v-model="type" class="flex gap-4">
                <div class="flex items-center gap-2">
                  <RadioGroupItem id="type-permanent" value="permanent" />
                  <Label for="type-permanent">Permanent</Label>
                </div>
                <div class="flex items-center gap-2">
                  <RadioGroupItem id="type-consumable" value="consumable" />
                  <Label for="type-consumable">Consumable</Label>
                </div>
              </RadioGroup>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Photo</Label>
              <div v-if="photo" class="relative w-24 h-24 rounded-md overflow-hidden border">
                <img :src="photo" alt="item photo" class="w-full h-full object-cover">
                <button
                  class="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                  @click="photo = undefined"
                >
                  <Icon name="lucide:x" class="h-3 w-3" />
                </button>
              </div>
              <label v-else class="flex items-center gap-2 cursor-pointer w-fit">
                <Button variant="outline" size="sm" as="span">
                  <Icon name="lucide:upload" class="mr-2 h-4 w-4" />
                  Upload Photo
                </Button>
                <input type="file" accept="image/*" class="hidden" @change="handlePhotoUpload">
              </label>
            </div>

            <Separator />

            <!-- Purchase Information -->
            <div class="flex flex-col gap-3">
              <p class="text-sm font-medium">
                Purchase Information
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label>Purchase Value (IDR)</Label>
                  <Input v-model.number="purchaseValue" type="number" placeholder="0" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label>Purchase Date</Label>
                  <Input v-model="purchaseDate" type="date" />
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Warranty Expiry</Label>
                <Input v-model="warrantyExpiry" type="date" />
              </div>
            </div>

            <!-- Asset Management (permanent items only) -->
            <template v-if="type === 'permanent'">
              <Separator />

              <div class="flex flex-col gap-3">
                <p class="text-sm font-medium">
                  Lifecycle
                </p>
                <div class="flex flex-col gap-1.5">
                  <Label>Asset Status</Label>
                  <Select v-model="assetStatus">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in ASSET_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div class="flex flex-col gap-3">
                <p class="text-sm font-medium">
                  Depreciation
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <Label>Useful Life (years)</Label>
                    <Input v-model.number="usefulLifeYears" type="number" min="1" placeholder="e.g. 10" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label>Salvage Value (IDR)</Label>
                    <Input v-model.number="salvageValue" type="number" min="0" placeholder="0" />
                  </div>
                </div>
                <div v-if="liveBookValue !== undefined" class="rounded-md bg-muted/50 border p-3 flex items-center justify-between gap-2">
                  <div>
                    <p class="text-xs text-muted-foreground">
                      Current Book Value
                    </p>
                    <p class="text-sm font-semibold">
                      {{ formatIDR(liveBookValue) }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-muted-foreground">
                      Depreciated
                    </p>
                    <p class="text-sm font-semibold text-muted-foreground">
                      {{ liveDepreciationPct }}%
                    </p>
                  </div>
                </div>
              </div>

              <!-- Maintenance Schedules -->
              <Separator />

              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">
                    Maintenance Schedules
                  </p>
                  <Button
                    v-if="isEditing"
                    variant="outline"
                    size="sm"
                    class="h-7 text-xs"
                    @click="showAddSchedule = !showAddSchedule"
                  >
                    <Icon name="lucide:plus" class="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </div>

                <div v-if="showAddSchedule && isEditing" class="rounded-md border p-3 flex flex-col gap-2 bg-muted/30">
                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs">Schedule Name</Label>
                    <Input v-model="newScheduleName" placeholder="e.g. Annual Cleaning" class="h-8 text-sm" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <Label class="text-xs">Interval (days)</Label>
                    <Input v-model.number="newScheduleInterval" type="number" min="1" class="h-8 text-sm" />
                  </div>
                  <div class="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" class="h-7 text-xs" @click="showAddSchedule = false">
                      Cancel
                    </Button>
                    <Button size="sm" class="h-7 text-xs" :disabled="!newScheduleName.trim()" @click="handleAddSchedule">
                      Add Schedule
                    </Button>
                  </div>
                </div>

                <div v-if="currentItem?.maintenanceSchedules?.length" class="flex flex-col gap-2">
                  <div
                    v-for="schedule in currentItem.maintenanceSchedules"
                    :key="schedule.id"
                    class="rounded-md border p-3"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium">
                          {{ schedule.name }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          Every {{ schedule.intervalDays }} days
                        </p>
                        <div class="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span class="text-xs text-muted-foreground">
                            Last: {{ schedule.lastServicedDate ? formatDate(schedule.lastServicedDate) : 'Never' }}
                          </span>
                          <Badge
                            v-if="getScheduleStatus(schedule) === 'overdue'"
                            variant="destructive"
                            class="text-xs h-4 px-1"
                          >
                            Overdue
                          </Badge>
                          <Badge
                            v-else-if="getScheduleStatus(schedule) === 'due_soon'"
                            class="bg-amber-100 text-amber-700 border-amber-200 text-xs h-4 px-1"
                            variant="outline"
                          >
                            Due Soon
                          </Badge>
                          <template v-else-if="getScheduleStatus(schedule) === 'ok' && getNextDueDate(schedule)">
                            <span class="text-xs text-muted-foreground">
                              Next: {{ formatDate(getNextDueDate(schedule)!) }}
                            </span>
                          </template>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          class="h-7 text-xs"
                          @click="handleMarkServiced(schedule.id, schedule.name)"
                        >
                          <Icon name="lucide:check" class="mr-1 h-3 w-3" />
                          Done
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-7 w-7"
                          @click="handleRemoveSchedule(schedule.id)"
                        >
                          <Icon name="lucide:trash-2" class="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <p v-else-if="isEditing" class="text-xs text-muted-foreground">
                  No schedules yet. Add one to track maintenance intervals.
                </p>
                <p v-else class="text-xs text-muted-foreground">
                  Save the item first to add maintenance schedules.
                </p>
              </div>
            </template>

            <Separator />

            <!-- Supplier -->
            <div class="flex flex-col gap-3">
              <p class="text-sm font-medium">
                Supplier / Vendor
              </p>
              <div class="flex flex-col gap-1.5">
                <Label>Supplier Name</Label>
                <Input v-model="supplierName" placeholder="e.g. Ace Hardware Bali" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Contact</Label>
                <Input v-model="supplierContact" placeholder="Phone number or email" />
              </div>
            </div>

            <Separator />

            <!-- Documents -->
            <div class="flex flex-col gap-3">
              <p class="text-sm font-medium">
                Documents
              </p>
              <div v-if="documents.length > 0" class="flex flex-col gap-2">
                <div
                  v-for="(doc, i) in documents"
                  :key="i"
                  class="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
                >
                  <Icon name="lucide:file" class="h-4 w-4 text-muted-foreground shrink-0" />
                  <span class="text-sm truncate flex-1">{{ doc.name }}</span>
                  <Select :model-value="doc.type" @update:model-value="(val) => updateDocType(i, val as InventoryDocument['type'])">
                    <SelectTrigger class="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warranty">
                        Warranty
                      </SelectItem>
                      <SelectItem value="receipt">
                        Receipt
                      </SelectItem>
                      <SelectItem value="invoice">
                        Invoice
                      </SelectItem>
                      <SelectItem value="other">
                        Other
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" class="h-7 w-7" @click="removeDocument(i)">
                    <Icon name="lucide:x" class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <label class="flex items-center gap-2 cursor-pointer w-fit">
                <Button variant="outline" size="sm" as="span">
                  <Icon name="lucide:paperclip" class="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" class="hidden" @change="handleDocumentUpload">
              </label>
            </div>

            <Separator />

            <div class="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea v-model="notes" placeholder="Additional notes about this item..." rows="3" />
            </div>
          </div>
        </TabsContent>

        <!-- History Tab -->
        <TabsContent value="history" class="px-4 py-4">
          <div v-if="itemHistory.length === 0" class="text-center text-sm text-muted-foreground py-8">
            No history recorded yet.
          </div>
          <div v-else class="relative flex flex-col">
            <div
              v-for="(event, index) in itemHistory"
              :key="event.id"
              class="flex gap-3"
            >
              <div class="flex flex-col items-center">
                <div
                  class="h-8 w-8 rounded-full border-2 flex items-center justify-center shrink-0 bg-background z-10"
                  :class="historyEventClass(event)"
                >
                  <Icon :name="historyEventIcon(event)" class="h-3.5 w-3.5" />
                </div>
                <div v-if="index < itemHistory.length - 1" class="w-px flex-1 bg-border mt-1 mb-1" />
              </div>
              <div class="flex flex-col gap-0.5 pb-5 flex-1 min-w-0">
                <p class="text-sm font-medium leading-snug">
                  {{ historyEventDescription(event) }}
                </p>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{{ formatRelativeDate(event.timestamp) }}</span>
                  <span
                    v-if="event.actor === 'hostbuddy'"
                    class="inline-flex items-center gap-1 text-xs font-medium text-[#C8A84B]"
                  >
                    <Icon name="lucide:sparkles" class="h-2.5 w-2.5" />
                    HostBuddy
                  </span>
                  <span v-else class="text-xs text-muted-foreground">Staff</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <SheetFooter v-if="activeTab === 'details'">
        <Button variant="outline" @click="isOpen = false">
          Cancel
        </Button>
        <Button :disabled="!name.trim()" @click="handleSave">
          {{ isEditing ? 'Save Changes' : 'Add Item' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
