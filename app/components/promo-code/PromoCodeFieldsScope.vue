<script setup lang="ts">
import type { PromoCodeFormDraft, PromoCodeFormErrors } from './data/promo-code-form'
import type { PromoCodeChannel } from './data/promo-codes'
import { computed, ref } from 'vue'
import { listings as allListings, allTags } from '~/components/listings/data/listings'
import { getListingIdsForWebsite } from '~/components/website-builder/data/property-listings'
import { websites as allWebsites } from '~/components/website-builder/data/websites'
import { listingIdsForWebsiteSelection } from './data/promo-code-form'

/**
 * Step 2 — where the code works, asked in one direction: channel, then the
 * websites on it, then the listings those websites reach.
 *
 * Each answer constrains the next. A website only covers the listings it
 * markets, so pinning a code to specific sites also pins which properties it
 * can apply to; the listings then decide which upsells step 3 can offer. Ask
 * them in any other order and a later list has to filter a choice already
 * made, or two lists filter each other in a circle.
 *
 * Everything is inline. An earlier version stacked a Popover inside the modal
 * and a second Popover (tags) inside that one, and labelled an empty listing
 * selection "All listings" — which reads the same whether the host chose every
 * property or never touched the control. Scope is now an explicit choice.
 */
const props = defineProps<{
  errors: PromoCodeFormErrors
  idPrefix: string
}>()

const draft = defineModel<PromoCodeFormDraft>({ required: true })

// ─── 1. Channel ─────────────────────────────────────────────────────────────
const isWebsiteChannel = computed(() => draft.value.channel === 'website')

function selectChannel(next: PromoCodeChannel) {
  // Drop website selections when leaving the website channel so stale ids
  // don't ride along into the save, or keep narrowing the listing list.
  draft.value = {
    ...draft.value,
    channel: next,
    websiteIds: next === 'website' ? draft.value.websiteIds : [],
  }
}

// ─── 2. Websites ────────────────────────────────────────────────────────────
const websiteSearch = ref('')

/** Each site with the listings it covers, resolved through its properties. */
const websiteCoverage = computed(() =>
  allWebsites.value.map(website => ({
    website,
    listingIds: getListingIdsForWebsite(website),
  })),
)

const visibleWebsites = computed(() => {
  const q = websiteSearch.value.trim().toLowerCase()
  if (!q)
    return websiteCoverage.value
  // Matches the template too — a host may remember the look, not the name.
  return websiteCoverage.value.filter(({ website }) =>
    `${website.name} ${website.url} ${website.template}`.toLowerCase().includes(q),
  )
})

function toggleWebsite(id: string) {
  const ids = draft.value.websiteIds
  draft.value = {
    ...draft.value,
    websiteIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
  }
}

function clearWebsites() {
  draft.value = { ...draft.value, websiteIds: [] }
}

// ─── 3. Listings, narrowed by the websites above ────────────────────────────
/** `null` when the websites impose no constraint — see the helper. */
const websiteScopedListingIds = computed(() =>
  isWebsiteChannel.value
    ? listingIdsForWebsiteSelection(
        websiteCoverage.value.map(c => ({ id: c.website.id, listingIds: c.listingIds })),
        draft.value.websiteIds,
      )
    : null,
)

const listingsFilteredByWebsite = computed(() => websiteScopedListingIds.value !== null)

/** In website scope, before search and tags — the honest denominator. */
const eligibleListings = computed(() => {
  const ids = websiteScopedListingIds.value
  return ids ? allListings.value.filter(l => ids.includes(l.id)) : allListings.value
})

/** Remembers that "Specific" was picked while the selection is still empty. */
const specificChosen = ref(false)

/**
 * Derived rather than stored: the persisted shape is still "empty list = all
 * listings". Making it an explicit radio only changes what the host sees, not
 * what `PromoCode.listingIds` means.
 */
const scopeMode = computed<'all' | 'specific'>(() =>
  draft.value.listingIds.length > 0 || specificChosen.value ? 'specific' : 'all',
)

function selectScopeMode(mode: 'all' | 'specific') {
  specificChosen.value = mode === 'specific'
  if (mode === 'all')
    draft.value = { ...draft.value, listingIds: [] }
}

const listingSearch = ref('')
const listingTagsFilter = ref<string[]>([])
const tagFilterOpen = ref(false)
const tagSearch = ref('')

const filteredTags = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  return q ? allTags.value.filter(t => t.toLowerCase().includes(q)) : allTags.value
})

const filteredListings = computed(() => {
  let result = eligibleListings.value

  // AND logic: a listing must carry every selected tag.
  if (listingTagsFilter.value.length > 0)
    result = result.filter(l => listingTagsFilter.value.every(t => l.tags.includes(t)))

  const query = listingSearch.value.trim().toLowerCase()
  if (query)
    result = result.filter(l => `${l.name} ${l.location ?? ''}`.toLowerCase().includes(query))

  return result
})

const hasListFilters = computed(() =>
  listingSearch.value.trim() !== '' || listingTagsFilter.value.length > 0,
)

function toggleListing(id: string) {
  const ids = draft.value.listingIds
  draft.value = {
    ...draft.value,
    listingIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
  }
}

/** Adds only what is currently visible, so a filter doubles as a bulk picker. */
function selectVisible() {
  const visible = filteredListings.value.map(l => l.id)
  draft.value = { ...draft.value, listingIds: [...new Set([...draft.value.listingIds, ...visible])] }
}

function clearListings() {
  draft.value = { ...draft.value, listingIds: [] }
}

const allVisibleSelected = computed(() =>
  filteredListings.value.length > 0
  && filteredListings.value.every(l => draft.value.listingIds.includes(l.id)),
)

function toggleTag(tag: string) {
  listingTagsFilter.value = listingTagsFilter.value.includes(tag)
    ? listingTagsFilter.value.filter(x => x !== tag)
    : [...listingTagsFilter.value, tag]
}

function clearFilters() {
  listingSearch.value = ''
  listingTagsFilter.value = []
  tagSearch.value = ''
}

/**
 * Listings picked before the website selection narrowed under them. Surfaced
 * rather than silently dropped — the host decides.
 */
const strandedListings = computed(() => {
  const ids = websiteScopedListingIds.value
  if (!ids)
    return []
  return allListings.value.filter(l => draft.value.listingIds.includes(l.id) && !ids.includes(l.id))
})

function dropStrandedListings() {
  const stale = new Set(strandedListings.value.map(l => l.id))
  draft.value = { ...draft.value, listingIds: draft.value.listingIds.filter(id => !stale.has(id)) }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- ── 1. Channel ───────────────────────────────────────────────────── -->
    <fieldset class="space-y-2">
      <legend class="text-sm font-medium">
        Redemption channel
      </legend>
      <p class="mb-2 text-xs text-muted-foreground">
        A code lives on one surface. Pick where guests can enter it.
      </p>
      <RadioGroup
        :model-value="draft.channel"
        class="grid grid-cols-1 gap-2 sm:grid-cols-2"
        @update:model-value="(v: string) => selectChannel(v as PromoCodeChannel)"
      >
        <label
          class="flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/40"
          :class="draft.channel === 'widget' ? 'border-primary bg-primary/5' : ''"
        >
          <RadioGroupItem :id="`${props.idPrefix}-channel-widget`" value="widget" class="mt-0.5" />
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-sm font-medium">
              <Icon name="lucide:code-2" class="size-3.5 text-muted-foreground" aria-hidden="true" />
              Widget only
            </p>
            <p class="text-xs text-muted-foreground">
              Embedded booking widgets on partner sites.
            </p>
          </div>
        </label>
        <label
          class="flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/40"
          :class="draft.channel === 'website' ? 'border-primary bg-primary/5' : ''"
        >
          <RadioGroupItem :id="`${props.idPrefix}-channel-website`" value="website" class="mt-0.5" />
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-sm font-medium">
              <Icon name="lucide:globe" class="size-3.5 text-muted-foreground" aria-hidden="true" />
              Website only
            </p>
            <p class="text-xs text-muted-foreground">
              Property websites built with the Website Builder.
            </p>
          </div>
        </label>
      </RadioGroup>
    </fieldset>

    <!-- ── 2. Websites ──────────────────────────────────────────────────── -->
    <fieldset v-if="isWebsiteChannel" class="space-y-2 rounded-md border p-3">
      <div class="flex items-center justify-between gap-2">
        <legend class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Which websites
        </legend>
        <Button
          v-if="draft.websiteIds.length > 0"
          type="button"
          variant="ghost"
          size="sm"
          class="h-6 text-xs"
          @click="clearWebsites"
        >
          Clear
        </Button>
      </div>

      <div class="relative">
        <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          :id="`${props.idPrefix}-website-search`"
          v-model="websiteSearch"
          placeholder="Search websites..."
          class="h-8 pl-7 text-sm"
          aria-label="Search websites"
        />
      </div>

      <p v-if="websiteSearch.trim()" class="text-xs text-muted-foreground" aria-live="polite">
        Showing {{ visibleWebsites.length }} of {{ websiteCoverage.length }}
        <button
          type="button"
          class="ml-1 underline underline-offset-2 hover:text-foreground"
          @click="websiteSearch = ''"
        >
          Reset
        </button>
      </p>

      <ul class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <li v-for="entry in visibleWebsites" :key="entry.website.id">
          <button
            type="button"
            class="flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors hover:bg-muted/40"
            :class="draft.websiteIds.includes(entry.website.id) ? 'border-primary bg-primary/5' : ''"
            role="checkbox"
            :aria-checked="draft.websiteIds.includes(entry.website.id) ? 'true' : 'false'"
            @click="toggleWebsite(entry.website.id)"
          >
            <span
              class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
              :class="draft.websiteIds.includes(entry.website.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              aria-hidden="true"
            >
              <Icon v-if="draft.websiteIds.includes(entry.website.id)" name="lucide:check" class="size-3" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ entry.website.name }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{ entry.website.url }}</span>
              <span class="block truncate text-xs text-muted-foreground">
                {{ entry.listingIds.length > 0
                  ? `Covers ${entry.listingIds.length} listing${entry.listingIds.length === 1 ? '' : 's'}`
                  : 'Coverage not recorded' }}
              </span>
            </span>
          </button>
        </li>
        <li
          v-if="visibleWebsites.length === 0"
          class="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground sm:col-span-2"
        >
          No websites match "{{ websiteSearch }}".
        </li>
      </ul>

      <p v-if="!websiteSearch.trim()" class="text-xs text-muted-foreground" aria-live="polite">
        {{ draft.websiteIds.length === 0
          ? `Nothing picked — the code works on all ${websiteCoverage.length} websites.`
          : `Limited to ${draft.websiteIds.length} website${draft.websiteIds.length === 1 ? '' : 's'}.` }}
      </p>
    </fieldset>

    <!-- ── 3. Listings, narrowed by the websites above ──────────────────── -->
    <fieldset class="space-y-2">
      <legend class="text-sm font-medium">
        Which listings
      </legend>

      <p
        v-if="listingsFilteredByWebsite"
        class="mb-2 flex items-start gap-1.5 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground"
      >
        <Icon name="lucide:globe" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          The website{{ draft.websiteIds.length === 1 ? '' : 's' }} you picked cover
          <span class="font-medium text-foreground">{{ eligibleListings.length }}</span>
          propert{{ eligibleListings.length === 1 ? 'y' : 'ies' }}, so the code can only apply to those.
        </span>
      </p>

      <RadioGroup
        :model-value="scopeMode"
        class="grid grid-cols-1 gap-2 sm:grid-cols-2"
        @update:model-value="(v: string) => selectScopeMode(v as 'all' | 'specific')"
      >
        <label
          class="flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/40"
          :class="scopeMode === 'all' ? 'border-primary bg-primary/5' : ''"
        >
          <RadioGroupItem :id="`${props.idPrefix}-scope-all`" value="all" class="mt-0.5" />
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ listingsFilteredByWebsite ? 'Every listing these websites cover' : 'All listings' }}
            </p>
            <p class="text-xs text-muted-foreground">
              Includes properties you add later.
            </p>
          </div>
        </label>
        <label
          class="flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/40"
          :class="scopeMode === 'specific' ? 'border-primary bg-primary/5' : ''"
        >
          <RadioGroupItem :id="`${props.idPrefix}-scope-specific`" value="specific" class="mt-0.5" />
          <div class="min-w-0">
            <p class="text-sm font-medium">
              Pick specific listings
            </p>
            <p class="text-xs text-muted-foreground">
              {{ draft.listingIds.length > 0 ? `${draft.listingIds.length} chosen` : 'Choose them below.' }}
            </p>
          </div>
        </label>
      </RadioGroup>

      <div v-if="scopeMode === 'specific'" class="space-y-2 rounded-md border p-3">
        <div class="flex items-center gap-1.5">
          <div class="relative flex-1">
            <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              :id="`${props.idPrefix}-listing-search`"
              v-model="listingSearch"
              placeholder="Search listings..."
              class="h-8 pl-7 text-sm"
              aria-label="Search listings"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-8 shrink-0"
            :class="listingTagsFilter.length > 0 ? 'border-primary bg-primary/5' : ''"
            :aria-expanded="tagFilterOpen ? 'true' : 'false'"
            @click="tagFilterOpen = !tagFilterOpen"
          >
            <Icon name="lucide:tag" class="size-3.5" aria-hidden="true" />
            Tags
            <span v-if="listingTagsFilter.length > 0" class="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {{ listingTagsFilter.length }}
            </span>
          </Button>
        </div>

        <div v-if="tagFilterOpen" class="space-y-2 rounded-md border bg-muted/30 p-2">
          <Input v-model="tagSearch" placeholder="Search tags..." class="h-7 text-xs" aria-label="Search tags" />
          <div class="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
            <button
              v-for="tag in filteredTags"
              :key="tag"
              type="button"
              class="rounded-full border px-2 py-0.5 text-xs transition-colors"
              :class="listingTagsFilter.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'"
              role="checkbox"
              :aria-checked="listingTagsFilter.includes(tag) ? 'true' : 'false'"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </button>
            <p v-if="filteredTags.length === 0" class="px-1 py-2 text-xs text-muted-foreground">
              No tags match "{{ tagSearch }}".
            </p>
          </div>
          <p class="text-[11px] text-muted-foreground">
            A listing must carry every selected tag.
          </p>
        </div>

        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-muted-foreground" aria-live="polite">
            Showing {{ filteredListings.length }} of {{ eligibleListings.length }}
            <button
              v-if="hasListFilters"
              type="button"
              class="ml-1 underline underline-offset-2 hover:text-foreground"
              @click="clearFilters"
            >
              Reset filters
            </button>
          </span>
          <div class="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-6 text-xs"
              :disabled="filteredListings.length === 0 || allVisibleSelected"
              @click="selectVisible"
            >
              Select {{ hasListFilters ? 'these' : 'all' }} ({{ filteredListings.length }})
            </Button>
            <Button
              v-if="draft.listingIds.length > 0"
              type="button"
              variant="ghost"
              size="sm"
              class="h-6 text-xs"
              @click="clearListings"
            >
              Clear
            </Button>
          </div>
        </div>

        <ul class="max-h-64 space-y-1 overflow-y-auto">
          <li v-for="listing in filteredListings" :key="listing.id">
            <button
              type="button"
              class="flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors hover:bg-muted/40"
              :class="draft.listingIds.includes(listing.id) ? 'border-primary bg-primary/5' : ''"
              role="checkbox"
              :aria-checked="draft.listingIds.includes(listing.id) ? 'true' : 'false'"
              @click="toggleListing(listing.id)"
            >
              <span
                class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                :class="draft.listingIds.includes(listing.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                aria-hidden="true"
              >
                <Icon v-if="draft.listingIds.includes(listing.id)" name="lucide:check" class="size-3" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ listing.name }}</span>
                <span v-if="listing.location" class="block truncate text-xs text-muted-foreground">{{ listing.location }}</span>
              </span>
            </button>
          </li>
          <li v-if="filteredListings.length === 0" class="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
            No listings match these filters.
          </li>
        </ul>

        <p v-if="draft.listingIds.length === 0" class="text-xs text-muted-foreground">
          Nothing picked yet — the code would apply to every listing above. Choose at least one to limit it.
        </p>
      </div>

      <!-- Listings stranded by a later website change -->
      <div
        v-if="strandedListings.length > 0"
        class="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs"
      >
        <Icon name="lucide:triangle-alert" class="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
        <div class="flex-1">
          <p>
            {{ strandedListings.length }} selected propert{{ strandedListings.length === 1 ? 'y is' : 'ies are' }}
            not covered by the websites you picked: {{ strandedListings.map(l => l.name).join(', ') }}.
          </p>
          <Button type="button" variant="ghost" size="sm" class="mt-1 h-6 px-2 text-xs" @click="dropStrandedListings">
            Remove {{ strandedListings.length === 1 ? 'it' : 'them' }}
          </Button>
        </div>
      </div>
    </fieldset>
  </div>
</template>
