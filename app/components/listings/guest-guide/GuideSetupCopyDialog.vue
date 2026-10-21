<script setup lang="ts">
import type { GuideSetupPart, GuideSetupResult } from '~/components/listings/data/guide-bulk'
import type { Listing } from '~/components/listings/data/listings'
import type { PropertyPickerOption } from '~/components/shared/PropertyPicker.vue'
import { copyGuideSetupToListings, GUIDE_PER_LISTING, GUIDE_SETUP_PARTS } from '~/components/listings/data/guide-bulk'
import { listings } from '~/components/listings/data/listings'
import { isPetPackageOffered } from '~/components/listings/data/pet-policy'
import PropertyPicker from '~/components/shared/PropertyPicker.vue'
import { useGuestGuides } from '~/composables/useGuestGuides'
import { useUpsellServices } from '~/composables/useUpsellServices'

/**
 * Copy this listing's guest guide setup to other listings: the content (with
 * the check-in steps timing), guest verification and pets, and the assigned
 * guide once `GUIDE_PER_LISTING` is on (each can be left out). Three steps:
 * pick, confirm what gets replaced, then the result per listing. A room's own
 * items are not copied; the other listings' rooms differ.
 */
const props = defineProps<{ listing: Listing }>()
const open = defineModel<boolean>('open', { default: false })

const { guides, updateGuide } = useGuestGuides()
const { services } = useUpsellServices()
const sourceGuide = computed(() => guides.value.find(g => g.assignedListingIds.includes(props.listing.id)))

const setupParts = GUIDE_SETUP_PARTS.filter(p => GUIDE_PER_LISTING || p.value !== 'guide')
const step = ref<'pick' | 'confirm' | 'done'>('pick')
const parts = ref<GuideSetupPart[]>([])
const targets = ref<string[]>([])
const results = ref<GuideSetupResult[]>([])
watch(open, (isOpen) => {
  if (!isOpen)
    return
  step.value = 'pick'
  targets.value = []
  results.value = []
  parts.value = setupParts.map(p => p.value).filter(p => p !== 'guide' || sourceGuide.value)
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

const pickedParts = computed(() => setupParts.filter(p => parts.value.includes(p.value)))

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
  results.value = copyGuideSetupToListings(props.listing, ids, parts.value, (id, name) => isPetPackageOffered(services.value, id, name))
  if (GUIDE_PER_LISTING && parts.value.includes('guide'))
    assignGuideTo(ids)
  step.value = 'done'
}

function packageName(id: string) {
  return services.value.find(s => s.id === id)?.name ?? id
}

const skipped = computed(() => results.value.filter(r => r.skippedPackageIds.length))
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <template v-if="step === 'pick'">
        <DialogHeader>
          <DialogTitle>Copy guest guide to other listings</DialogTitle>
          <DialogDescription>
            The listings you pick get these settings from {{ listing.name }}. What is only for one of its rooms is not copied.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-2" role="group" aria-label="What to copy" data-testid="guide-copy-parts">
          <div
            v-for="part in setupParts"
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
          <Button :disabled="!targets.length || !parts.length" data-testid="guide-copy-next" @click="step = 'confirm'">
            Copy to {{ targets.length }} {{ targets.length === 1 ? 'listing' : 'listings' }}
          </Button>
        </DialogFooter>
      </template>

      <template v-else-if="step === 'confirm'">
        <DialogHeader>
          <DialogTitle>Replace on {{ targets.length }} {{ targets.length === 1 ? 'listing' : 'listings' }}?</DialogTitle>
          <DialogDescription>
            These replace what the listings have now. The listings keep nothing of their own for these parts.
          </DialogDescription>
        </DialogHeader>
        <ul class="flex flex-col gap-1.5 text-sm" data-testid="guide-copy-confirm-parts">
          <li v-for="part in pickedParts" :key="part.value" class="flex items-center gap-2">
            <Icon name="lucide:replace" class="size-3.5 shrink-0 text-muted-foreground" />
            {{ part.label }}
          </li>
        </ul>
        <DialogFooter>
          <Button variant="outline" @click="step = 'pick'">
            Back
          </Button>
          <Button data-testid="guide-copy-apply" @click="apply">
            Replace on {{ targets.length }} {{ targets.length === 1 ? 'listing' : 'listings' }}
          </Button>
        </DialogFooter>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>Copied to {{ results.length }} {{ results.length === 1 ? 'listing' : 'listings' }}</DialogTitle>
          <DialogDescription>
            <template v-if="skipped.length">
              {{ results.length - skipped.length }} got everything. {{ skipped.length }} did not get all the pet packages.
            </template>
            <template v-else>
              Every listing got everything you picked.
            </template>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea class="max-h-64 rounded-md border">
          <ul class="flex flex-col divide-y" data-testid="guide-copy-results">
            <li v-for="r in results" :key="r.listingId" class="flex flex-col gap-0.5 px-3 py-2.5">
              <span class="flex items-center gap-2 text-sm font-medium">
                <Icon :name="r.skippedPackageIds.length ? 'lucide:triangle-alert' : 'lucide:check'" class="size-3.5 shrink-0" :class="r.skippedPackageIds.length ? 'text-amber-600' : 'text-green-600'" />
                <span class="min-w-0 truncate">{{ r.listingName }}</span>
              </span>
              <span v-if="r.skippedPackageIds.length" class="pl-5.5 text-xs text-amber-700 dark:text-amber-300">
                Not offered there, so left out: {{ r.skippedPackageIds.map(packageName).join(', ') }}.
              </span>
            </li>
          </ul>
        </ScrollArea>
        <DialogFooter>
          <Button data-testid="guide-copy-done" @click="open = false">
            Done
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
