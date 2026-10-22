<script setup lang="ts">
import type { PropertyPickerOption } from '~/components/shared/PropertyPicker.vue'
import { computed, ref, watch } from 'vue'
import { listings } from '~/components/listings/data/listings'
import PropertyPicker from '~/components/shared/PropertyPicker.vue'

/** Pick listings to copy a part of this listing's channel pricing to. What the copy replaces is named before it runs. */
const props = defineProps<{ listingId: string, what: string }>()
const emit = defineEmits<{ copy: [listingIds: string[]] }>()

const open = defineModel<boolean>('open', { default: false })

const picked = ref<string[]>([])
watch(open, (value) => {
  if (value)
    picked.value = []
})

const options = computed<PropertyPickerOption[]>(() => listings.value
  .filter(l => l.id !== props.listingId)
  .map(l => ({ id: l.id, name: l.name, city: l.location, region: '' })))

function copy() {
  emit('copy', picked.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Copy {{ what }} to listings</DialogTitle>
        <DialogDescription>
          The {{ what }} of the listings you pick are replaced with this listing's.
        </DialogDescription>
      </DialogHeader>
      <PropertyPicker v-model="picked" :options="options" fill />
      <p v-if="picked.length" class="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
        <Icon name="lucide:triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Replaces the {{ what }} of {{ picked.length }} {{ picked.length === 1 ? 'listing' : 'listings' }}.
      </p>
      <DialogFooter>
        <Button variant="ghost" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="picked.length === 0" data-testid="copy-confirm" @click="copy">
          Copy to {{ picked.length || '' }} {{ picked.length === 1 ? 'listing' : 'listings' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
