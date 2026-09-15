<script setup lang="ts">
import type { InvoiceTemplate } from '~/components/settings/data/invoice-templates'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { ScrollArea } from '~/components/ui/scroll-area'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'

const props = defineProps<{
  open: boolean
  template: InvoiceTemplate | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [template: InvoiceTemplate]
}>()

const { templates, assignListings } = useInvoiceTemplates()

const selectedIds = ref<string[]>([])
const search = ref('')

watch(() => props.open, (isOpen) => {
  if (!isOpen || !props.template)
    return
  selectedIds.value = [...props.template.assignedListingIds]
  search.value = ''
})

const otherTemplateAssignments = computed(() => {
  const map: Record<string, string> = {}
  for (const t of templates.value) {
    if (props.template && t.id === props.template.id)
      continue
    for (const lid of t.assignedListingIds) {
      map[lid] = t.name
    }
  }
  return map
})

const filteredListings = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return listings.value
  return listings.value.filter(l =>
    l.name.toLowerCase().includes(q)
    || l.location.toLowerCase().includes(q)
    || (l.tags && l.tags.some(t => t.toLowerCase().includes(q))),
  )
})

function toggle(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(i => i !== id)
  }
  else {
    selectedIds.value = [...selectedIds.value, id]
  }
}

function selectAll() {
  const add = filteredListings.value.map(l => l.id)
  selectedIds.value = Array.from(new Set([...selectedIds.value, ...add]))
}

function clearAll() {
  const remove = new Set(filteredListings.value.map(l => l.id))
  selectedIds.value = selectedIds.value.filter(id => !remove.has(id))
}

function handleSave() {
  if (!props.template)
    return
  assignListings(props.template.id, selectedIds.value)
  const updated = templates.value.find(t => t.id === props.template?.id)
  if (updated)
    emit('saved', updated)
  toast.success(`Updated listing assignments for ${props.template.name}`)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="max-w-xl p-0 gap-0 overflow-hidden">
      <DialogHeader class="p-6 pb-4 border-b">
        <DialogTitle class="text-lg">
          Assign Listings to {{ template?.name }}
        </DialogTitle>
        <DialogDescription>
          Select the properties that will issue tax invoices using <span class="font-medium text-foreground">{{ template?.company.companyName }}</span>.
        </DialogDescription>
      </DialogHeader>

      <div class="p-6 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="relative flex-1">
            <Icon name="lucide:search" class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              v-model="search"
              placeholder="Search listings..."
              class="pl-9 h-9"
            />
          </div>
          <div class="flex gap-2">
            <Button type="button" variant="outline" size="sm" @click="selectAll">
              Select All
            </Button>
            <Button type="button" variant="ghost" size="sm" @click="clearAll">
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea class="h-80 border rounded-lg p-2">
          <div class="space-y-1">
            <div
              v-for="listing in filteredListings"
              :key="listing.id"
              class="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              :class="selectedIds.includes(listing.id) ? 'bg-primary/5 border border-primary/20' : ''"
              @click="toggle(listing.id)"
            >
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(listing.id)"
                  class="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                  @click.stop="toggle(listing.id)"
                >
                <img
                  v-if="listing.photos?.[0]"
                  :src="listing.photos[0]"
                  class="size-8 rounded object-cover"
                  alt=""
                >
                <div>
                  <p class="text-sm font-medium leading-none">
                    {{ listing.name }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    {{ listing.location }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <Badge
                  v-if="otherTemplateAssignments[listing.id]"
                  variant="outline"
                  class="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300"
                >
                  On: {{ otherTemplateAssignments[listing.id] }}
                </Badge>
                <Badge
                  v-if="selectedIds.includes(listing.id)"
                  class="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px]"
                >
                  Assigned
                </Badge>
              </div>
            </div>
          </div>
        </ScrollArea>

        <p class="text-xs text-muted-foreground">
          Currently assigned: <span class="font-bold text-foreground">{{ selectedIds.length }}</span> listings.
        </p>
      </div>

      <DialogFooter class="p-4 border-t bg-muted/20 flex sm:justify-end gap-2">
        <Button type="button" variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button type="button" @click="handleSave">
          Save Assignments
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
