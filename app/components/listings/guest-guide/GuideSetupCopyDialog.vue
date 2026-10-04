<script setup lang="ts">
import type { GuideSetupPart } from '~/components/listings/data/guide-bulk'
import type { Listing } from '~/components/listings/data/listings'
import type { PropertyPickerOption } from '~/components/shared/PropertyPicker.vue'
import { toast } from 'vue-sonner'
import { copyGuideSetupToListings, GUIDE_SETUP_PARTS } from '~/components/listings/data/guide-bulk'
import { listings } from '~/components/listings/data/listings'
import PropertyPicker from '~/components/shared/PropertyPicker.vue'
import { useGuestGuides } from '~/composables/useGuestGuides'

/**
 * Copy this listing's guest guide setup to other listings: the assigned guide,
 * the content, guest verification and pets (each can be left out). A room's
 * own items are not copied; the other listings' rooms differ.
 */
const props = defineProps<{ listing: Listing }>()
const open = defineModel<boolean>('open', { default: false })

const { guides, updateGuide } = useGuestGuides()
const sourceGuide = computed(() => guides.value.find(g => g.assignedListingIds.includes(props.listing.id)))

const parts = ref<GuideSetupPart[]>([])
const targets = ref<string[]>([])
watch(open, (isOpen) => {
  if (!isOpen)
    return
  targets.value = []
  parts.value = GUIDE_SETUP_PARTS.map(p => p.value).filter(p => p !== 'guide' || sourceGuide.value)
}, { immediate: true })

function togglePart(part: GuideSetupPart) {
  if (part === 'guide' && !sourceGuide.value)
    return
  parts.value = parts.value.includes(part) ? parts.value.filter(p => p !== part) : [...parts.value, part]
}

const options = computed<PropertyPickerOption[]>(() =>
  listings.value
    .filter(l => l.id !== props.listing.id)
    .map(l => ({ id: l.id, name: l.name, city: l.location, region: '' })),
)

/** Moves the picked listings onto this listing's guide (a listing has one guide). */
function assignGuideTo(targetIds: string[]) {
  const guide = sourceGuide.value
  if (!guide)
    return
  for (const g of guides.value) {
    if (g.id !== guide.id && g.assignedListingIds.some(id => targetIds.includes(id)))
      updateGuide(g.id, { assignedListingIds: g.assignedListingIds.filter(id => !targetIds.includes(id)) })
  }
  updateGuide(guide.id, { assignedListingIds: [...new Set([...guide.assignedListingIds, ...targetIds])] })
}

function apply() {
  const ids = targets.value.filter(id => id !== props.listing.id)
  const count = copyGuideSetupToListings(props.listing, ids, parts.value)
  if (parts.value.includes('guide'))
    assignGuideTo(ids)
  toast.success(`Guest guide settings copied to ${count} ${count === 1 ? 'listing' : 'listings'}`)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Copy guest guide to other listings</DialogTitle>
        <DialogDescription>
          The listings you pick get these settings from {{ listing.name }}. What is only for one of its rooms is not copied.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-2" role="group" aria-label="What to copy" data-testid="guide-copy-parts">
        <div
          v-for="part in GUIDE_SETUP_PARTS"
          :key="part.value"
          role="checkbox"
          tabindex="0"
          :aria-checked="parts.includes(part.value)"
          :aria-disabled="part.value === 'guide' && !sourceGuide"
          class="flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors"
          :class="part.value === 'guide' && !sourceGuide ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50'"
          @click="togglePart(part.value)"
          @keydown.space.prevent="togglePart(part.value)"
          @keydown.enter.prevent="togglePart(part.value)"
        >
          <span
            class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
            :class="parts.includes(part.value) ? 'border-foreground bg-foreground text-background' : 'border-input'"
          >
            <Icon v-if="parts.includes(part.value)" name="lucide:check" class="size-3" />
          </span>
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium">
              {{ part.label }}<template v-if="part.value === 'guide'">: {{ sourceGuide?.title ?? 'none assigned' }}</template>
            </span>
            <span class="text-xs text-muted-foreground">{{ part.description }}</span>
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">Listings</span>
        <PropertyPicker v-model="targets" :options="options" />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!targets.length || !parts.length" data-testid="guide-copy-apply" @click="apply">
          Copy to {{ targets.length }} {{ targets.length === 1 ? 'listing' : 'listings' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
