<script setup lang="ts">
import type { PropertyPickerOption } from '~/components/shared/PropertyPicker.vue'
import { listings } from '~/components/listings/data/listings'
import SetupSelectBox from '~/components/listings/setup/SetupSelectBox.vue'
import PropertyPicker from '~/components/shared/PropertyPicker.vue'

/**
 * Select all, and Copy to listings / Delete for the selected items of a
 * Listing Setup section (SOPs, Topics to Avoid). The parent does the work.
 */
const props = defineProps<{
  /** The listing being edited; it is left out of the copy targets. */
  listingId: string
  selectedCount: number
  total: number
  /** Singular noun, e.g. "SOP" or "topic". */
  noun: string
  /** What copying does to the picked listings. */
  copyNote: string
  /** What deleting does. */
  deleteNote: string
  /** Show a select-all tick in the bar (a list with no sections, e.g. topics). */
  selectAll?: boolean
}>()
const emit = defineEmits<{ toggleAll: [], copy: [targetIds: string[]], delete: [] }>()
/** Select mode. Off: just a Select button. Leaving it clears the selection (the parent watches this). */
const selecting = defineModel<boolean>('selecting', { default: false })

const plural = (n: number) => `${n} ${props.noun}${n === 1 ? '' : 's'}`

const copyOpen = ref(false)
const copyTargets = ref<string[]>([])
const copyOptions = computed<PropertyPickerOption[]>(() =>
  listings.value
    .filter(l => l.id !== props.listingId)
    .map(l => ({ id: l.id, name: l.name, city: l.location, region: '' })),
)
function openCopy() {
  copyTargets.value = []
  copyOpen.value = true
}
function applyCopy() {
  emit('copy', [...copyTargets.value])
  copyOpen.value = false
  selecting.value = false
}

const deleteOpen = ref(false)
</script>

<template>
  <div v-if="!selecting" class="flex justify-end">
    <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="!total" data-testid="bulk-select" @click="selecting = true">
      <Icon name="lucide:list-checks" class="size-3.5" />
      Select
    </Button>
  </div>
  <div v-else class="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5" data-testid="setup-bulk-bar">
    <SetupSelectBox
      v-if="selectAll"
      :checked="total > 0 && selectedCount === total"
      :indeterminate="selectedCount > 0 && selectedCount < total"
      :label="selectedCount === total ? 'Clear selection' : 'Select all'"
      @toggle="emit('toggleAll')"
    />
    <span class="flex-1 text-sm text-muted-foreground">
      {{ selectedCount ? `${plural(selectedCount)} selected` : `Select ${noun}s to copy or delete them` }}
    </span>
    <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="!selectedCount" data-testid="bulk-copy" @click="openCopy">
      <Icon name="lucide:copy" class="size-3.5" />
      Copy to listings
    </Button>
    <Button variant="outline" size="sm" class="h-8 gap-1.5 text-destructive hover:text-destructive" :disabled="!selectedCount" data-testid="bulk-delete" @click="deleteOpen = true">
      <Icon name="lucide:trash-2" class="size-3.5" />
      Delete
    </Button>
    <Button variant="ghost" size="sm" class="h-8" data-testid="bulk-cancel" @click="selecting = false">
      Cancel
    </Button>
  </div>

  <Dialog v-model:open="copyOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Copy {{ plural(selectedCount) }} to other listings</DialogTitle>
        <DialogDescription>{{ copyNote }}</DialogDescription>
      </DialogHeader>
      <div class="py-1">
        <PropertyPicker v-model="copyTargets" :options="copyOptions" />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="copyOpen = false">
          Cancel
        </Button>
        <Button :disabled="!copyTargets.length" data-testid="bulk-copy-apply" @click="applyCopy">
          Copy to {{ copyTargets.length }} {{ copyTargets.length === 1 ? 'listing' : 'listings' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog v-model:open="deleteOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {{ plural(selectedCount) }}?</AlertDialogTitle>
        <AlertDialogDescription>{{ deleteNote }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" data-testid="bulk-delete-confirm" @click="emit('delete'); selecting = false">
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
