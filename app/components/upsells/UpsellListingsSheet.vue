<script setup lang="ts">
import type { UpsellService } from '@/components/upsells/data/upsell-services'
import { toast } from 'vue-sonner'
import { useUpsellServices } from '@/composables/useUpsellServices'
import UpsellListingPicker from '~/components/upsells/UpsellListingPicker.vue'

/** Catalog shortcut: assign a service to listings without opening the full drawer. */
const props = defineProps<{
  open: boolean
  service: UpsellService | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { updateService } = useUpsellServices()

// A draft, so Cancel leaves the service untouched.
const draft = ref<string[]>([])

watch(() => props.open, (open) => {
  if (open)
    draft.value = [...(props.service?.assignedListings ?? [])]
}, { immediate: true })

function save() {
  if (!props.service)
    return
  updateService(props.service.id, { assignedListings: [...draft.value] })
  toast.success(`${props.service.name} assigned to ${draft.value.length} ${draft.value.length === 1 ? 'listing' : 'listings'}.`)
  emit('update:open', false)
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" side="right">
      <SheetHeader class="shrink-0 border-b px-6 py-4">
        <SheetTitle>Assigned Listings</SheetTitle>
        <SheetDescription>
          {{ service?.name }} is offered only on the listings you select.
        </SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col p-6">
        <UpsellListingPicker
          v-if="open"
          v-model="draft"
          class="min-h-0 flex-1"
          list-class="min-h-0 flex-1"
        />
      </div>

      <div class="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="save">
          Save Changes
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
