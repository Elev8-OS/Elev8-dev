<script setup lang="ts">
import type { ListingInfoPart } from '~/components/listings/data/listing-info-copy'
import type { Listing } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { copyListingInfoToListings, GUEST_GUIDE_INFO_PARTS, LISTING_INFO_PARTS, listingInfoPartCount } from '~/components/listings/data/listing-info-copy'
import { listings } from '~/components/listings/data/listings'

/**
 * Copy this listing's info to other listings, choosing which parts. A part the
 * listing has nothing for is disabled. Name, address, photos, rooms and pricing
 * are never copied.
 */
const props = defineProps<{ listing: Listing }>()
const open = defineModel<boolean>('open', { default: false })

const ALL_PARTS = [...LISTING_INFO_PARTS, ...GUEST_GUIDE_INFO_PARTS]
const counts = computed(() => Object.fromEntries(ALL_PARTS.map(p => [p.value, listingInfoPartCount(props.listing, p.value)])) as Record<ListingInfoPart, number>)
const available = computed(() => ALL_PARTS.filter(p => counts.value[p.value] > 0).map(p => p.value))

const parts = ref<ListingInfoPart[]>([])
const search = ref('')
const tagFilter = ref<string[]>([])
const tagSearch = ref('')
const guideParts = GUEST_GUIDE_INFO_PARTS.map(p => p.value)
const guideAvailable = computed(() => guideParts.filter(p => counts.value[p] > 0))
const guideSelected = computed(() => guideAvailable.value.filter(p => parts.value.includes(p)))
const guideState = computed<boolean | 'indeterminate'>(() =>
  !guideSelected.value.length ? false : guideSelected.value.length === guideAvailable.value.length ? true : 'indeterminate')
const guideOpen = ref(false)
/** 1: what to copy, 2: which listings. */
const step = ref<1 | 2>(1)
const confirmOpen = ref(false)

/** Parts that replace what the target has, rather than add to it or fill gaps. */
const REPLACING: ListingInfoPart[] = ['amenities', 'guide_checkin', 'guide_checkout', 'guide_house_rules', 'guide_good_to_know', 'guide_verification', 'guide_pets', 'guide_checkin_visibility']
const partLabels = computed(() => parts.value.map(p => ALL_PARTS.find(a => a.value === p)?.label).filter(Boolean) as string[])
const replacedLabels = computed(() => parts.value.filter(p => REPLACING.includes(p)).map(p => ALL_PARTS.find(a => a.value === p)?.label).filter(Boolean) as string[])

function toggleGuide() {
  const rest = parts.value.filter(p => !guideParts.includes(p as never))
  parts.value = guideState.value === true ? rest : [...rest, ...guideAvailable.value]
}

const targets = ref<string[]>([])
watch(open, (isOpen) => {
  if (!isOpen)
    return
  targets.value = []
  parts.value = [...available.value]
  guideOpen.value = false
  step.value = 1
  search.value = ''
  tagFilter.value = []
  tagSearch.value = ''
}, { immediate: true })

function togglePart(part: ListingInfoPart) {
  if (!counts.value[part])
    return
  parts.value = parts.value.includes(part) ? parts.value.filter(p => p !== part) : [...parts.value, part]
}

const allSelected = computed(() => available.value.length > 0 && parts.value.length === available.value.length)
function toggleAll() {
  parts.value = allSelected.value ? [] : [...available.value]
}

const options = computed(() =>
  listings.value
    .filter(l => l.id !== props.listing.id)
    .map(l => ({ id: l.id, name: l.name, location: l.location, tags: l.tags })),
)

/** Tag filter: a listing must have every picked tag (AND), like the Listings page. */
const tagOpen = ref(false)
const tagOptions = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  return [...new Set(options.value.flatMap(o => o.tags))].sort().filter(t => !q || t.toLowerCase().includes(q))
})
function toggleTag(tag: string) {
  tagFilter.value = tagFilter.value.includes(tag) ? tagFilter.value.filter(t => t !== tag) : [...tagFilter.value, tag]
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return options.value
    .filter(o => tagFilter.value.every(t => o.tags.includes(t)))
    .filter(o => !q || `${o.name} ${o.location}`.toLowerCase().includes(q))
})
const filteredAllPicked = computed(() => filtered.value.length > 0 && filtered.value.every(o => targets.value.includes(o.id)))

function toggleTarget(id: string) {
  targets.value = targets.value.includes(id) ? targets.value.filter(t => t !== id) : [...targets.value, id]
}

/** Select all / clear all act on what the search shows. */
function toggleAllTargets() {
  const ids = filtered.value.map(o => o.id)
  targets.value = filteredAllPicked.value
    ? targets.value.filter(t => !ids.includes(t))
    : [...new Set([...targets.value, ...ids])]
}

const targetNames = computed(() => options.value.filter(o => targets.value.includes(o.id)).map(o => o.name))

const allTargets = computed(() => options.value.length > 0 && targets.value.length === options.value.length)
const allParts = computed(() => available.value.length > 0 && parts.value.length === available.value.length)
const targetCount = (n: number) => `${n} ${n === 1 ? 'listing' : 'listings'}`
const targetsSummary = computed(() => {
  if (allTargets.value)
    return `All ${targetCount(options.value.length)}`
  const shown = targetNames.value.slice(0, 3).join(', ')
  return targetNames.value.length > 3 ? `${shown} and ${targetNames.value.length - 3} more` : shown
})

function apply() {
  confirmOpen.value = false
  const count = copyListingInfoToListings(props.listing, targets.value, parts.value)
  const n = parts.value.length
  toast.success(`${n} ${n === 1 ? 'part' : 'parts'} copied to ${count} ${count === 1 ? 'listing' : 'listings'}`)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Copy info to other listings</DialogTitle>
        <DialogDescription data-testid="info-copy-step">
          <template v-if="step === 1">
            Step 1 of 2: choose what to copy from {{ listing.name }}. Name, address, photos, rooms and pricing are not copied.
          </template>
          <template v-else>
            Step 2 of 2: choose the listings that get {{ parts.length }} {{ parts.length === 1 ? 'part' : 'parts' }} from {{ listing.name }}.
          </template>
        </DialogDescription>
      </DialogHeader>

      <div v-if="step === 1" class="flex flex-col gap-2" role="group" aria-label="What to copy" data-testid="info-copy-parts">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">What to copy</span>
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" data-testid="info-copy-toggle-all" @click="toggleAll">
            {{ allSelected ? 'Clear all' : 'Select all' }}
          </Button>
        </div>
        <ScrollArea class="max-h-72">
          <div class="flex flex-col gap-2 pr-3">
            <div
              v-for="part in LISTING_INFO_PARTS"
              :key="part.value"
              role="checkbox"
              tabindex="0"
              :aria-checked="parts.includes(part.value)"
              :aria-disabled="!counts[part.value]"
              :data-testid="`info-copy-${part.value}`"
              class="flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors"
              :class="counts[part.value] ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed opacity-50'"
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
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="flex items-center gap-2 text-sm font-medium">
                  <Icon :name="part.icon" class="size-3.5 text-muted-foreground" />
                  {{ part.label }}
                  <span class="text-xs font-normal text-muted-foreground">{{ counts[part.value] || 'Nothing to copy' }}</span>
                </span>
                <span class="text-xs text-muted-foreground">{{ part.description }}</span>
              </span>
            </div>

            <!-- Guest guide: one row that expands into its own parts. -->
            <div class="rounded-md border" data-testid="info-copy-guest_guide">
              <div class="flex items-start gap-3 px-3 py-2.5" :class="guideAvailable.length ? '' : 'opacity-50'">
                <span
                  role="checkbox"
                  tabindex="0"
                  :aria-checked="guideState === 'indeterminate' ? 'mixed' : guideState"
                  :aria-disabled="!guideAvailable.length"
                  aria-label="Guest guide content"
                  class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                  :class="[guideState ? 'border-foreground bg-foreground text-background' : 'border-input', guideAvailable.length ? 'cursor-pointer' : 'cursor-not-allowed']"
                  data-testid="info-copy-guide-all"
                  @click="guideAvailable.length && toggleGuide()"
                  @keydown.space.prevent="guideAvailable.length && toggleGuide()"
                  @keydown.enter.prevent="guideAvailable.length && toggleGuide()"
                >
                  <Icon v-if="guideState === true" name="lucide:check" class="size-3" />
                  <Icon v-else-if="guideState === 'indeterminate'" name="lucide:minus" class="size-3" />
                </span>
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-start gap-2 text-left"
                  :aria-expanded="guideOpen"
                  data-testid="info-copy-guide-toggle"
                  @click="guideOpen = !guideOpen"
                >
                  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span class="flex items-center gap-2 text-sm font-medium">
                      <Icon name="lucide:book-open" class="size-3.5 text-muted-foreground" />
                      Guest guide content
                      <span class="text-xs font-normal text-muted-foreground">{{ guideSelected.length }} of {{ guideParts.length }}</span>
                    </span>
                    <span class="text-xs text-muted-foreground">Steps, house rules, Good to know, verification, pets. Replaces theirs.</span>
                  </span>
                  <Icon name="lucide:chevron-down" class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform" :class="guideOpen ? 'rotate-180' : ''" />
                </button>
              </div>
              <div v-if="guideOpen" class="flex flex-col gap-1.5 border-t bg-muted/20 p-2 pl-9">
                <div
                  v-for="part in GUEST_GUIDE_INFO_PARTS"
                  :key="part.value"
                  role="checkbox"
                  tabindex="0"
                  :aria-checked="parts.includes(part.value)"
                  :aria-disabled="!counts[part.value]"
                  :data-testid="`info-copy-${part.value}`"
                  class="flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors"
                  :class="counts[part.value] ? 'cursor-pointer hover:bg-muted/60' : 'cursor-not-allowed opacity-50'"
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
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="flex items-center gap-2 text-sm">
                      <Icon :name="part.icon" class="size-3.5 text-muted-foreground" />
                      {{ part.label }}
                      <span v-if="part.value === 'guide_checkin' || part.value === 'guide_checkout' || part.value === 'guide_house_rules' || part.value === 'guide_good_to_know'" class="text-xs text-muted-foreground">{{ counts[part.value] || 'Nothing to copy' }}</span>
                    </span>
                    <span class="text-xs text-muted-foreground">{{ part.description }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      <div v-else class="flex flex-col gap-2" data-testid="info-copy-listings">
        <div class="flex items-center gap-2">
          <BaseSearchInput v-model="search" placeholder="Search listings..." class="sm:max-w-none" />
          <Popover v-model:open="tagOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm" class="h-9 shrink-0 gap-1.5 text-xs" :class="tagFilter.length ? 'border-primary text-primary' : ''" data-testid="info-copy-tags">
                <Icon name="lucide:tag" class="size-3.5" />
                Tags
                <Badge v-if="tagFilter.length" variant="default" class="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[9px]">
                  {{ tagFilter.length }}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-56 p-0" align="end" :side-offset="4">
              <div class="p-2">
                <Input v-model="tagSearch" placeholder="Search tags..." aria-label="Search tags" class="h-7 text-xs" />
              </div>
              <ScrollArea class="h-48 overflow-hidden">
                <div class="space-y-1">
                  <div
                    v-for="tag in tagOptions"
                    :key="tag"
                    class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    :data-testid="`info-copy-tag-${tag}`"
                    @click="toggleTag(tag)"
                  >
                    <div class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="tagFilter.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
                      <Icon v-if="tagFilter.includes(tag)" name="lucide:check" class="size-3" />
                    </div>
                    <span class="flex-1">{{ tag }}</span>
                  </div>
                  <p v-if="!tagOptions.length" class="px-2 py-1.5 text-xs text-muted-foreground">
                    No tags found.
                  </p>
                </div>
              </ScrollArea>
              <div v-if="tagFilter.length" class="border-t px-2 py-2">
                <Button variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="tagFilter = []">
                  Clear all tags
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <ScrollArea class="h-72 rounded-md border">
          <div class="flex flex-col p-1" role="group" aria-label="Listings">
            <div
              v-for="o in filtered"
              :key="o.id"
              role="checkbox"
              tabindex="0"
              :aria-checked="targets.includes(o.id)"
              :data-testid="`info-copy-target-${o.id}`"
              class="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-muted/50"
              @click="toggleTarget(o.id)"
              @keydown.space.prevent="toggleTarget(o.id)"
              @keydown.enter.prevent="toggleTarget(o.id)"
            >
              <span
                class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="targets.includes(o.id) ? 'border-foreground bg-foreground text-background' : 'border-input'"
              >
                <Icon v-if="targets.includes(o.id)" name="lucide:check" class="size-3" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ o.name }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ o.location }}</span>
              </span>
            </div>
            <p v-if="!filtered.length" class="px-2 py-6 text-center text-sm text-muted-foreground">
              No listings found.
            </p>
          </div>
        </ScrollArea>
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-muted-foreground" data-testid="info-copy-selected-count">{{ targets.length }} of {{ options.length }} selected</span>
          <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" data-testid="info-copy-targets-all" :disabled="!filtered.length" @click="toggleAllTargets">
            {{ filteredAllPicked ? 'Clear all' : 'Select all' }}{{ filtered.length !== options.length ? ` (${filtered.length})` : '' }}
          </Button>
        </div>
      </div>

      <DialogFooter>
        <template v-if="step === 1">
          <Button variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button :disabled="!parts.length" data-testid="info-copy-next" @click="step = 2">
            Next
          </Button>
        </template>
        <template v-else>
          <Button variant="outline" data-testid="info-copy-back" @click="step = 1">
            Back
          </Button>
          <Button :disabled="!targets.length || !parts.length" data-testid="info-copy-apply" @click="confirmOpen = true">
            Copy to {{ targets.length }} {{ targets.length === 1 ? 'listing' : 'listings' }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog v-model:open="confirmOpen">
    <AlertDialogContent class="max-h-[85vh] overflow-y-auto">
      <AlertDialogHeader>
        <AlertDialogTitle>Copy to {{ allTargets ? `all ${targetCount(targets.length)}` : targetCount(targets.length) }}?</AlertDialogTitle>
        <AlertDialogDescription as-child>
          <div class="flex flex-col gap-3 text-sm text-muted-foreground" data-testid="info-copy-confirm">
            <p class="break-words">
              From <span class="font-medium text-foreground">{{ listing.name }}</span>:
              <template v-if="allParts">
                everything ({{ parts.length }} parts).
              </template>
              <template v-else>
                {{ partLabels.join(', ') }}.
              </template>
            </p>
            <p class="break-words" data-testid="info-copy-confirm-targets">
              To: <span class="font-medium text-foreground">{{ targetsSummary }}</span><template v-if="!allTargets && targets.length > 3">
                ({{ targetCount(targets.length) }})
              </template>.
            </p>
            <p v-if="replacedLabels.length" class="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" data-testid="info-copy-replace-warning">
              <Icon name="lucide:triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
              <span>These replace what the listings have now: {{ replacedLabels.join(', ') }}. This cannot be undone.</span>
            </p>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Back</AlertDialogCancel>
        <AlertDialogAction data-testid="info-copy-confirm-apply" @click="apply">
          Copy
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
