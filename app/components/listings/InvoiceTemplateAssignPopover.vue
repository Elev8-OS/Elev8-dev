<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { ScrollArea } from '~/components/ui/scroll-area'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'

const props = defineProps<{
  listingId: string
  listingName?: string
}>()

const { templates, getTemplateForListing, getTemplateById, assignListings } = useInvoiceTemplates()

const currentTemplate = computed(() => getTemplateForListing(props.listingId))

const popoverOpen = ref(false)
const search = ref('')

const filteredTemplates = computed(() => {
  const all = templates.value
  const q = search.value.trim().toLowerCase()
  if (!q)
    return all
  return all.filter(t =>
    t.name.toLowerCase().includes(q)
    || t.company.companyName.toLowerCase().includes(q)
    || (t.company.vatNumber && t.company.vatNumber.toLowerCase().includes(q)),
  )
})

function selectTemplate(templateId: string) {
  const target = getTemplateById(templateId)
  if (!target)
    return

  // Unassign listing from other templates and assign to target
  assignListings(templateId, [...target.assignedListingIds.filter(id => id !== props.listingId), props.listingId])
  toast.success(`Assigned "${target.name}" to ${props.listingName || 'this listing'}`)
  popoverOpen.value = false
}
</script>

<template>
  <Popover v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm">
        <Icon name="lucide:repeat" class="mr-1 size-3.5" />
        {{ currentTemplate ? 'Change Template' : 'Assign Template' }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-80 p-0" align="end">
      <div class="p-2 border-b">
        <Input v-model="search" placeholder="Search templates..." class="h-8" />
      </div>
      <ScrollArea class="h-72">
        <div class="p-1 space-y-1">
          <div
            v-for="tmpl in filteredTemplates"
            :key="tmpl.id"
            class="flex items-start justify-between p-2 rounded-md hover:bg-muted/60 cursor-pointer transition-colors text-xs"
            :class="tmpl.assignedListingIds.includes(listingId) ? 'bg-primary/5 border border-primary/20' : ''"
            @click="selectTemplate(tmpl.id)"
          >
            <div class="space-y-0.5 min-w-0 pr-2">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-foreground">{{ tmpl.name }}</span>
                <Badge v-if="tmpl.isDefault" variant="secondary" class="text-[9px] h-4">
                  Default
                </Badge>
              </div>
              <p class="text-muted-foreground truncate">
                {{ tmpl.company.companyName }}
              </p>
              <p v-if="tmpl.company.vatNumber" class="text-[10px] text-muted-foreground/80">
                {{ tmpl.company.vatNumber }}
              </p>
            </div>

            <Icon
              v-if="tmpl.assignedListingIds.includes(listingId)"
              name="lucide:check"
              class="size-4 text-primary shrink-0 mt-1"
            />
          </div>
        </div>
      </ScrollArea>
    </PopoverContent>
  </Popover>
</template>
