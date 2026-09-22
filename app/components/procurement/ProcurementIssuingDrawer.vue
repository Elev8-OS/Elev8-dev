<script setup lang="ts">
import type { Issuing, IssueItem } from '@/components/procurement/data/issuings'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { BALI_LISTINGS } from '@/components/upsells/data/upsell-services'
import { staffMembers } from '@/components/inbox/data/conversations'
import { useIssuings } from '@/composables/useIssuings'
import { useInventoryCatalog } from '@/composables/useInventoryCatalog'

const props = defineProps<{
  open: boolean
  issuing?: Issuing | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { updateIssuing, completeIssuing } = useIssuings()
const { items: catalogItems, getItemById } = useInventoryCatalog()

const isOpen = computed({
  get: () => props.open,
  set: val => emit('update:open', val),
})

const issuedBy = ref('staff-2')
const lineItems = ref<(IssueItem & { itemName?: string })[]>([])

// Item picker
const itemPickerOpen = ref(false)
const itemSearchValue = ref('')

const filteredCatalogItems = computed(() => {
  if (!itemSearchValue.value)
    return catalogItems.value
  const q = itemSearchValue.value.toLowerCase()
  return catalogItems.value.filter(i => i.name.toLowerCase().includes(q))
})

function resetForm() {
  issuedBy.value = 'staff-2'
  lineItems.value = []
}

function populateForm(iss: Issuing) {
  issuedBy.value = iss.issuedBy
  lineItems.value = iss.items.map(i => ({
    ...i,
    itemName: getItemById(i.itemId)?.name ?? i.itemId,
  }))
}

watch(() => props.open, (val) => {
  if (val) {
    if (props.issuing)
      populateForm(props.issuing)
    else resetForm()
  }
})

function addItem() {
  lineItems.value = [
    ...lineItems.value,
    {
      id: `issi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: '',
      quantity: 1,
      toListing: '',
      itemName: '',
    },
  ]
}

function removeLineItem(index: number) {
  lineItems.value = lineItems.value.filter((_, i) => i !== index)
}

function selectItem(idx: number, item: { id: string, name: string }) {
  lineItems.value = lineItems.value.map((l, i) => i === idx ? { ...l, itemId: item.id, itemName: item.name } : l)
  itemPickerOpen.value = false
  itemSearchValue.value = ''
}

function updateLineQty(idx: number, qty: number) {
  lineItems.value = lineItems.value.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, qty) } : l)
}

function updateLineListing(idx: number, listing: string) {
  lineItems.value = lineItems.value.map((l, i) => i === idx ? { ...l, toListing: listing } : l)
}

function getStaffName(staffId: string): string {
  return staffMembers.find(s => s.id === staffId)?.name ?? staffId
}

function handleSave(asDraft: boolean) {
  if (lineItems.value.length === 0)
    return
  if (lineItems.value.some(l => !l.itemId || !l.toListing))
    return

  const payload = {
    status: (asDraft ? 'draft' : 'completed') as 'draft' | 'completed',
    issuedBy: issuedBy.value,
    items: lineItems.value.map(l => ({
      id: l.id,
      itemId: l.itemId,
      quantity: l.quantity,
      toListing: l.toListing,
      notes: l.notes,
    })),
    issuedAt: new Date().toISOString(),
  }

  if (props.issuing) {
    updateIssuing(props.issuing.id, payload)
    if (!asDraft)
      completeIssuing(props.issuing.id)
    toast.success(asDraft ? 'Issuing updated' : 'Items issued to listings')
  }
  else {
    const { addIssuing } = useIssuings()
    const newId = addIssuing(payload)
    if (!asDraft)
      completeIssuing(newId)
    toast.success(asDraft ? 'Issuing saved as draft' : 'Items issued to listings')
  }
  isOpen.value = false
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent class="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{{ issuing?.issueNumber ?? 'New Issue' }}</SheetTitle>
        <SheetDescription>
          {{ issuing ? 'View issuing details.' : 'Distribute received items to listings.' }}
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-4 px-4 py-4">
        <!-- Header info -->
        <div v-if="issuing" class="rounded-md bg-muted/50 border p-3">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-xs text-muted-foreground">
                Issued By
              </p>
              <p class="text-sm font-medium">
                {{ getStaffName(issuing.issuedBy) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                Date
              </p>
              <p class="text-sm font-medium">
                {{ new Date(issuing.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }}
              </p>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col gap-1.5">
          <Label>Issued By</Label>
          <Select v-model="issuedBy">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="s in staffMembers" :key="s.id" :value="s.id">
                {{ s.name }} ({{ s.role }})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <!-- Line Items -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">
              Items <span class="text-destructive">*</span>
            </p>
            <Button v-if="!issuing || issuing.status === 'draft'" variant="outline" size="sm" class="h-7 text-xs" @click="addItem">
              <Icon name="lucide:plus" class="mr-1 h-3 w-3" />
              Add Item
            </Button>
          </div>

          <div v-if="lineItems.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No items added yet.
          </div>

          <div v-for="(line, idx) in lineItems" :key="line.id" class="rounded-md border p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium">
                  {{ line.itemName || 'Select item...' }}
                </p>
              </div>
              <Button v-if="!issuing || issuing.status === 'draft'" variant="ghost" size="icon" class="h-6 w-6 shrink-0" @click="removeLineItem(idx)">
                <Icon name="lucide:x" class="h-3.5 w-3.5" />
              </Button>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-2">
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Item</Label>
                <Popover v-if="!issuing || issuing.status === 'draft'">
                  <PopoverTrigger as-child>
                    <Button variant="outline" size="sm" class="h-8 justify-start text-xs font-normal">
                      {{ line.itemName || 'Pick item...' }}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-72 p-0" align="start">
                    <Command>
                      <CommandInput v-model="itemSearchValue" placeholder="Search..." />
                      <CommandEmpty>No items found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          v-for="item in filteredCatalogItems"
                          :key="item.id"
                          :value="item.id"
                          @select="selectItem(idx, { id: item.id, name: item.name })"
                        >
                          {{ item.name }}
                        </CommandItem>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p v-else class="text-sm">
                  {{ line.itemName }}
                </p>
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Quantity</Label>
                <Input
                  :model-value="line.quantity"
                  type="number"
                  min="1"
                  class="h-8 text-sm"
                  :disabled="!!issuing && issuing.status === 'completed'"
                  @update:model-value="(v: string) => updateLineQty(idx, Number(v))"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1 mt-2">
              <Label class="text-xs">Destination Listing</Label>
              <Select
                :model-value="line.toListing"
                :disabled="!!issuing && issuing.status === 'completed'"
                @update:model-value="(v: string) => updateLineListing(idx, v)"
              >
                <SelectTrigger class="h-8 text-sm w-full">
                  <SelectValue placeholder="Select listing..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="listing in BALI_LISTINGS" :key="listing" :value="listing">
                    {{ listing }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <SheetFooter>
        <Button variant="outline" @click="isOpen = false">
          Close
        </Button>
        <template v-if="!issuing || issuing.status === 'draft'">
          <Button
            variant="secondary"
            :disabled="lineItems.length === 0 || lineItems.some(l => !l.itemId || !l.toListing)"
            @click="handleSave(true)"
          >
            Save Draft
          </Button>
          <Button
            :disabled="lineItems.length === 0 || lineItems.some(l => !l.itemId || !l.toListing)"
            @click="handleSave(false)"
          >
            <Icon name="lucide:check" class="mr-2 h-4 w-4" />
            Complete Issue
          </Button>
        </template>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
