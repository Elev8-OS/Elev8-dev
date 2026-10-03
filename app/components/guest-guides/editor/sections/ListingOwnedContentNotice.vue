<script setup lang="ts">
import type { Ref } from 'vue'
import type { GuideContentKind } from '~/components/listings/data/guest-guide-content'
import { computed, inject, ref } from 'vue'
import { GUIDE_CONTENT_META, listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { listings } from '~/components/listings/data/listings'

/**
 * Check-in/out steps, house rules and Good to Know belong to each LISTING
 * (`guest-guide-content.ts`); the guide only shows or hides the section. This
 * panel says so, and lists the guide's listings with what each one has, linking
 * to the listing's Guest Guide tab where it is edited.
 */
const props = defineProps<{ kind: GuideContentKind }>()

const assignedListingIds = inject<Ref<string[]>>('assignedListingIds', ref([]))
const meta = computed(() => GUIDE_CONTENT_META[props.kind])

const rows = computed(() => listings.value
  .filter(l => assignedListingIds.value.includes(l.id))
  .map(l => ({ id: l.id, name: l.name, count: listingGuideItems(l, props.kind).length })))
</script>

<template>
  <div class="space-y-3" data-testid="listing-owned-content">
    <div class="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
      <Icon name="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
      <span>
        {{ meta.label }} come from each listing, so every property shows its own. Edit them in the listing's Guest Guide tab. Here you only show or hide the section.
      </span>
    </div>
    <p v-if="!rows.length" class="text-xs text-muted-foreground">
      Assign this guide to a listing to see its {{ meta.label.toLowerCase() }}.
    </p>
    <div v-else class="flex flex-col divide-y rounded-md border">
      <NuxtLink
        v-for="row in rows"
        :key="row.id"
        :to="`/listings/${row.id}?tab=guest-guide`"
        class="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/50"
        data-testid="listing-owned-row"
      >
        <span class="truncate">{{ row.name }}</span>
        <span class="flex shrink-0 items-center gap-1 text-xs" :class="row.count ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300'">
          {{ row.count ? `${row.count} ${meta.noun}${row.count === 1 ? '' : 's'}` : 'Not set up' }}
          <Icon name="lucide:chevron-right" class="size-3.5" />
        </span>
      </NuxtLink>
    </div>
    <slot />
  </div>
</template>
