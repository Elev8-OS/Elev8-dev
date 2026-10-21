<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import { guestVerificationShortLabel, listingGuestVerification } from '~/components/listings/data/guest-verification'
import { listings } from '~/components/listings/data/listings'

/**
 * Import the guest verification from ONE other listing. It is a setting, not
 * a list, so the import replaces this listing's own; the dialog says so and
 * the button names it.
 */
const props = defineProps<{ listingId: string }>()
const emit = defineEmits<{ import: [source: Listing] }>()
const open = defineModel<boolean>('open', { default: false })

const label = 'guest verification'

const search = ref('')
const sourceId = ref('')
watch(open, (isOpen) => {
  if (!isOpen)
    return
  search.value = ''
  sourceId.value = ''
}, { immediate: true })

/** One line of what the listing has, so the choice is not blind. */
function summary(l: Listing) {
  return guestVerificationShortLabel(listingGuestVerification(l).mode)
}

const sources = computed(() => listings.value
  .filter(l => l.id !== props.listingId && l.name.toLowerCase().includes(search.value.trim().toLowerCase()))
  .map(l => ({ id: l.id, name: l.name, summary: summary(l) })))

const source = computed(() => listings.value.find(l => l.id === sourceId.value))

function apply() {
  if (!source.value)
    return
  emit('import', source.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Import {{ label }} from a listing</DialogTitle>
        <DialogDescription>
          Pick one listing. Its {{ label }} replace this listing's; the other listing keeps its own.
        </DialogDescription>
      </DialogHeader>

      <BaseSearchInput v-model="search" placeholder="Search listing..." />

      <ScrollArea class="h-64 rounded-md border">
        <div class="flex flex-col gap-1 p-2" role="radiogroup" :aria-label="`Listing to import ${label} from`" data-testid="guide-verification-import-sources">
          <div
            v-for="s in sources"
            :key="s.id"
            role="radio"
            tabindex="0"
            :aria-checked="sourceId === s.id"
            class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors"
            :class="sourceId === s.id ? 'border-foreground bg-muted/50' : 'hover:bg-muted/50'"
            @click="sourceId = s.id"
            @keydown.space.prevent="sourceId = s.id"
            @keydown.enter.prevent="sourceId = s.id"
          >
            <span class="flex size-4 shrink-0 items-center justify-center rounded-full border" :class="sourceId === s.id ? 'border-foreground' : 'border-input'">
              <span v-if="sourceId === s.id" class="size-2 rounded-full bg-foreground" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ s.name }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ s.summary }}</span>
          </div>
          <p v-if="!sources.length" class="px-3 py-6 text-center text-sm text-muted-foreground">
            No other listing found.
          </p>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!source" data-testid="guide-verification-import-apply" @click="apply">
          Replace with these
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
