<script setup lang="ts">
import type { ListingInventoryEntry } from '@/components/inventory/data/listing-entries'
import type { InventoryTimelineEvent } from '@/components/inventory/data/timeline-events'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { BALI_LISTINGS } from '@/components/upsells/data/upsell-services'
import { useInventoryCatalog } from '@/composables/useInventoryCatalog'
import { useInventoryListings } from '@/composables/useInventoryListings'
import { useInventoryTimeline } from '@/composables/useInventoryTimeline'

const props = defineProps<{
  open: boolean
  entry?: ListingInventoryEntry | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { items, getItemById } = useInventoryCatalog()
const { addEntry, updateEntry } = useInventoryListings()
const { events } = useInventoryTimeline()

const isOpen = computed({
  get: () => props.open,
  set: val => emit('update:open', val),
})

const isEditing = computed(() => !!props.entry)
const activeTab = ref('details')

const entryEvents = computed<InventoryTimelineEvent[]>(() =>
  events.value
    .filter(e => e.entryId === (props.entry?.id ?? ''))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
)

// ── Form state ─────────────────────────────────────────────
const selectedItemId = ref('')
const selectedListing = ref('')
const quantity = ref(1)
const condition = ref<ListingInventoryEntry['condition']>('good')
const stockLevel = ref<number | undefined>(undefined)
const notes = ref('')
const itemSearch = ref('')
const itemPickerOpen = ref(false)

const selectedItem = computed(() => {
  if (!selectedItemId.value)
    return null
  return getItemById(selectedItemId.value)
})

const isConsumable = computed(() => selectedItem.value?.type === 'consumable')

const filteredItems = computed(() => {
  if (!itemSearch.value)
    return items.value
  return items.value.filter(i =>
    i.name.toLowerCase().includes(itemSearch.value.toLowerCase()),
  )
})

function resetForm() {
  selectedItemId.value = ''
  selectedListing.value = ''
  quantity.value = 1
  condition.value = 'good'
  stockLevel.value = undefined
  notes.value = ''
  itemSearch.value = ''
  itemPickerOpen.value = false
  activeTab.value = 'details'
}

function populateForm(entry: ListingInventoryEntry) {
  selectedItemId.value = entry.itemId
  selectedListing.value = entry.listingName
  quantity.value = entry.quantity
  condition.value = entry.condition
  stockLevel.value = entry.stockLevel
  notes.value = entry.notes ?? ''
}

watch(() => props.open, (val) => {
  if (val) {
    activeTab.value = 'details'
    if (props.entry)
      populateForm(props.entry)
    else resetForm()
  }
})

function handleSave() {
  if (!selectedItemId.value || !selectedListing.value)
    return

  const payload: Omit<ListingInventoryEntry, 'id' | 'lastUpdated'> = {
    itemId: selectedItemId.value,
    listingName: selectedListing.value,
    quantity: quantity.value,
    condition: condition.value,
    stockLevel: isConsumable.value ? stockLevel.value : undefined,
    notes: notes.value.trim() || undefined,
  }

  if (isEditing.value && props.entry) {
    updateEntry(props.entry.id, payload)
    toast.success('Entry updated')
  }
  else {
    addEntry(payload)
    toast.success('Item added to listing')
  }
  isOpen.value = false
}

// ── Timeline helpers ────────────────────────────────────────
function eventIcon(event: InventoryTimelineEvent): string {
  switch (event.type) {
    case 'entry_created': return 'lucide:plus-circle'
    case 'condition_changed':
      if (event.details.to === 'good')
        return 'lucide:check-circle-2'
      if (event.details.to === 'damaged' || event.details.to === 'missing')
        return 'lucide:alert-circle'
      return 'lucide:refresh-cw'
    case 'quantity_changed': return 'lucide:package'
    case 'stock_changed': return 'lucide:boxes'
    case 'task_linked': return 'lucide:sparkles'
    case 'task_completed': return 'lucide:check-circle-2'
    case 'task_canceled': return 'lucide:x-circle'
    case 'note_updated': return 'lucide:file-text'
    default: return 'lucide:circle'
  }
}

function eventIconClass(event: InventoryTimelineEvent): string {
  switch (event.type) {
    case 'entry_created': return 'text-blue-500 border-blue-200'
    case 'condition_changed':
      if (event.details.to === 'good')
        return 'text-green-600 border-green-200'
      if (event.details.to === 'damaged' || event.details.to === 'missing')
        return 'text-destructive border-destructive/20'
      return 'text-amber-600 border-amber-200'
    case 'quantity_changed': return 'text-blue-500 border-blue-200'
    case 'stock_changed':
      return Number(event.details.to) < Number(event.details.from)
        ? 'text-orange-500 border-orange-200'
        : 'text-green-600 border-green-200'
    case 'task_linked': return 'text-[#C8A84B] border-[#C8A84B]/30'
    case 'task_completed': return 'text-green-600 border-green-200'
    case 'task_canceled': return 'text-muted-foreground border-border'
    case 'note_updated': return 'text-muted-foreground border-border'
    default: return 'text-muted-foreground border-border'
  }
}

function eventDescription(event: InventoryTimelineEvent): string {
  switch (event.type) {
    case 'entry_created': return 'Entry added to listing'
    case 'condition_changed': return `Condition: ${event.details.from} → ${event.details.to}`
    case 'quantity_changed': return `Quantity: ${event.details.from} → ${event.details.to}`
    case 'stock_changed': return `Stock level: ${event.details.from} → ${event.details.to}`
    case 'task_linked': return `Task linked: "${event.details.taskTitle}"`
    case 'task_completed': return `Task completed — condition → Good`
    case 'task_canceled': return `Task canceled — condition reverted`
    case 'note_updated': return 'Notes updated'
    default: return ''
  }
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
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent class="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{{ isEditing ? 'Edit Entry' : 'Add Item to Listing' }}</SheetTitle>
        <SheetDescription>
          {{ isEditing ? 'Update inventory entry for this listing.' : 'Assign a catalog item to a specific listing.' }}
        </SheetDescription>
      </SheetHeader>

      <Tabs v-model="activeTab" class="mt-2">
        <TabsList class="mx-4">
          <TabsTrigger value="details">
            Details
          </TabsTrigger>
          <TabsTrigger v-if="isEditing" value="timeline">
            Timeline
            <Badge
              v-if="entryEvents.length > 0"
              variant="secondary"
              class="ml-1.5 h-4 min-w-4 px-1 text-xs"
            >
              {{ entryEvents.length }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <!-- Details Tab -->
        <TabsContent value="details">
          <div class="flex flex-col gap-4 px-4 py-4">
            <div class="flex flex-col gap-1.5">
              <Label>Item <span class="text-destructive">*</span></Label>
              <Popover v-model:open="itemPickerOpen">
                <PopoverTrigger as-child>
                  <Button variant="outline" class="justify-between w-full font-normal">
                    {{ selectedItem ? selectedItem.name : 'Select item from catalog...' }}
                    <Icon name="lucide:chevrons-up-down" class="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-72 p-0">
                  <Command>
                    <CommandInput v-model="itemSearch" placeholder="Search items..." />
                    <CommandList>
                      <CommandEmpty>No items found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          v-for="item in filteredItems"
                          :key="item.id"
                          :value="item.id"
                          @select="() => { selectedItemId = item.id; itemPickerOpen = false }"
                        >
                          <Icon
                            name="lucide:check"
                            class="mr-2 h-4 w-4"
                            :class="selectedItemId === item.id ? 'opacity-100' : 'opacity-0'"
                          />
                          <div class="flex flex-col">
                            <span class="text-sm">{{ item.name }}</span>
                            <span class="text-xs text-muted-foreground">{{ item.category }} · {{ item.unit }}</span>
                          </div>
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Listing <span class="text-destructive">*</span></Label>
              <Select v-model="selectedListing">
                <SelectTrigger>
                  <SelectValue placeholder="Select listing..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="listing in BALI_LISTINGS" :key="listing" :value="listing">
                    {{ listing }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Quantity ({{ selectedItem?.unit || 'pcs' }})</Label>
              <Input v-model.number="quantity" type="number" min="1" />
            </div>

            <div v-if="!isConsumable" class="flex flex-col gap-1.5">
              <Label>Condition</Label>
              <RadioGroup v-model="condition" class="flex flex-wrap gap-3">
                <div v-for="cond in ['good', 'fair', 'damaged', 'missing']" :key="cond" class="flex items-center gap-2">
                  <RadioGroupItem :id="`cond-${cond}`" :value="cond" />
                  <Label :for="`cond-${cond}`" class="capitalize">{{ cond }}</Label>
                </div>
              </RadioGroup>
            </div>

            <div v-if="isConsumable" class="flex flex-col gap-1.5">
              <Label>Current Stock ({{ selectedItem?.unit || 'pcs' }})</Label>
              <Input v-model.number="stockLevel" type="number" min="0" placeholder="0" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea v-model="notes" placeholder="Condition details, location in property, etc." rows="3" />
            </div>
          </div>
        </TabsContent>

        <!-- Timeline Tab -->
        <TabsContent value="timeline" class="px-4 py-4">
          <div v-if="entryEvents.length === 0" class="text-center text-sm text-muted-foreground py-8">
            No activity recorded yet.
          </div>
          <div v-else class="relative flex flex-col">
            <div
              v-for="(event, index) in entryEvents"
              :key="event.id"
              class="flex gap-3"
            >
              <!-- Icon + connecting line -->
              <div class="flex flex-col items-center">
                <div
                  class="h-8 w-8 rounded-full border-2 flex items-center justify-center shrink-0 bg-background z-10"
                  :class="eventIconClass(event)"
                >
                  <Icon :name="eventIcon(event)" class="h-3.5 w-3.5" />
                </div>
                <div v-if="index < entryEvents.length - 1" class="w-px flex-1 bg-border mt-1 mb-1" />
              </div>

              <!-- Content -->
              <div class="flex flex-col gap-0.5 pb-5 flex-1 min-w-0">
                <p class="text-sm font-medium leading-snug">
                  {{ eventDescription(event) }}
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
        <Button :disabled="!selectedItemId || !selectedListing" @click="handleSave">
          {{ isEditing ? 'Save Changes' : 'Add Entry' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
