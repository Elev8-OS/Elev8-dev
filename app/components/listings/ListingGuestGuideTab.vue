<script setup lang="ts">
import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'
import type { GuestVerificationSettings } from '~/components/listings/data/guest-verification'
import type { Listing } from '~/components/listings/data/listings'
import type { PetPolicy } from '~/components/listings/data/pet-policy'
import { toast } from 'vue-sonner'
import GuideStatusBadge from '~/components/guest-guides/GuideStatusBadge.vue'
import { GUIDE_CONTENT_KINDS, GUIDE_CONTENT_META, listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { guestVerificationShortLabel, listingGuestVerification } from '~/components/listings/data/guest-verification'
import { listingPetPolicy } from '~/components/listings/data/pet-policy'
import GuestVerificationSettingsCard from '~/components/listings/guest-guide/GuestVerificationSettingsCard.vue'
import ListingGuideContentSheet from '~/components/listings/guest-guide/ListingGuideContentSheet.vue'
import PetPolicySettingsCard from '~/components/listings/guest-guide/PetPolicySettingsCard.vue'
import GuideAssignPopover from '~/components/listings/GuideAssignPopover.vue'
import ExpandableText from '~/components/shared/ExpandableText.vue'
import { useGuestGuides } from '~/composables/useGuestGuides'
import { toSafeHtml } from '~/lib/rich-text-sanitize.client'

/**
 * The listing's guest guide content: which guide it uses, and the content the
 * listing owns (check-in/out steps, house rules, Good to Know). The guide only
 * shows or hides these sections; ElevAI and the house-rules agreement read the
 * same content (`guest-guide-content.ts`).
 */
const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const { guides } = useGuestGuides()
const assignedGuide = computed(() => guides.value.find(g => g.assignedListingIds.includes(props.listing.id)))

/**
 * Why a kind will not show in this listing's guide, or null when it will: the
 * guide has no such section, or has it switched off.
 */
function guideGap(kind: GuideContentKind): 'missing' | 'hidden' | null {
  if (!assignedGuide.value)
    return null
  const section = assignedGuide.value.sections.find(s => s.type === kind)
  if (!section)
    return 'missing'
  return section.enabled ? null : 'hidden'
}

/** The section shown on the right: a content kind, or the guest verification settings. */
const selected = ref<GuideContentKind | 'verification' | 'pets'>('checkin')
const selectedKind = computed<GuideContentKind>(() => selected.value === 'verification' || selected.value === 'pets' ? 'checkin' : selected.value)
const selectedMeta = computed(() => GUIDE_CONTENT_META[selectedKind.value])
const selectedItems = computed(() => listingGuideItems(props.listing, selectedKind.value))

const verification = computed(() => listingGuestVerification(props.listing))

const petPolicy = computed(() => listingPetPolicy(props.listing))

function savePetPolicy(policy: PetPolicy) {
  emit('update', { ...props.listing, petPolicy: policy })
  toast.success('Pet settings updated')
}

function saveVerification(settings: GuestVerificationSettings) {
  emit('update', { ...props.listing, guestVerification: settings })
  toast.success('Guest verification updated')
}

function countOf(kind: GuideContentKind) {
  return listingGuideItems(props.listing, kind).length
}

const editingKind = ref<GuideContentKind | null>(null)
const sheetOpen = ref(false)

function edit(kind: GuideContentKind) {
  editingKind.value = kind
  sheetOpen.value = true
}

function save(items: GuideContentItem[]) {
  const kind = editingKind.value
  if (!kind)
    return
  emit('update', { ...props.listing, guestGuide: { ...props.listing.guestGuide, [kind]: items } })
  toast.success(`${GUIDE_CONTENT_META[kind].label} saved`)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card class="gap-3 p-5" data-testid="guide-assignment">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">
            Guest guide
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            The welcome page sent to guests. The guide sets the look and which sections show; the content below comes from this listing.
          </p>
        </div>
        <GuideAssignPopover :listing-id="listing.id" :listing-name="listing.name" />
      </div>
      <div v-if="assignedGuide" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
        <div class="flex items-center gap-2">
          <Icon name="lucide:book-open" class="size-4 text-muted-foreground" />
          <span class="text-sm font-medium">{{ assignedGuide.title }}</span>
          <GuideStatusBadge :status="assignedGuide.status" />
        </div>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" as-child>
            <NuxtLink :to="`/guest-guides/${assignedGuide.id}`">
              Edit layout
            </NuxtLink>
          </Button>
          <Button variant="outline" size="sm" as-child>
            <NuxtLink :to="`/guest-guides/${assignedGuide.id}/preview`">
              Preview
            </NuxtLink>
          </Button>
        </div>
      </div>
      <p v-else class="text-sm text-muted-foreground">
        No guide assigned.
        <NuxtLink to="/guest-guides/new" class="underline">
          Create one
        </NuxtLink>.
      </p>
    </Card>

    <!-- One 4-column grid: the section list in the first column, the selected section across the other three. -->
    <div class="grid gap-4 xl:grid-cols-4">
      <Card class="gap-1 p-2 xl:self-start" data-testid="guide-nav">
        <button
          v-for="kind in GUIDE_CONTENT_KINDS"
          :key="kind"
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors"
          :class="selected === kind ? 'bg-muted font-medium' : 'hover:bg-muted/50'"
          :aria-current="selected === kind ? 'true' : undefined"
          :data-testid="`guide-nav-${kind}`"
          @click="selected = kind"
        >
          <Icon :name="GUIDE_CONTENT_META[kind].icon" class="size-4 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate text-sm">{{ GUIDE_CONTENT_META[kind].label }}</span>
          <Icon
            v-if="guideGap(kind)"
            name="lucide:eye-off"
            class="size-3.5 shrink-0 text-amber-600"
            :aria-label="guideGap(kind) === 'missing' ? 'Not in the guide' : 'Hidden in the guide'"
          />
          <span
            class="shrink-0 rounded-full px-1.5 text-xs"
            :class="countOf(kind) ? 'bg-background text-muted-foreground' : 'text-amber-700 dark:text-amber-300'"
          >{{ countOf(kind) || 'Empty' }}</span>
        </button>
        <div class="mx-3 my-1 border-t" />
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors"
          :class="selected === 'verification' ? 'bg-muted font-medium' : 'hover:bg-muted/50'"
          :aria-current="selected === 'verification' ? 'true' : undefined"
          data-testid="guide-nav-verification"
          @click="selected = 'verification'"
        >
          <Icon name="lucide:shield-check" class="size-4 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate text-sm">Guest verification</span>
          <span class="shrink-0 truncate text-xs text-muted-foreground">{{ guestVerificationShortLabel(verification.mode) }}</span>
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors"
          :class="selected === 'pets' ? 'bg-muted font-medium' : 'hover:bg-muted/50'"
          :aria-current="selected === 'pets' ? 'true' : undefined"
          data-testid="guide-nav-pets"
          @click="selected = 'pets'"
        >
          <Icon name="lucide:paw-print" class="size-4 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate text-sm">Pets</span>
          <span class="shrink-0 text-xs text-muted-foreground">{{ petPolicy.allowed ? 'Allowed' : 'Not allowed' }}</span>
        </button>
      </Card>

      <Card v-if="selected === 'pets'" class="gap-4 p-5 xl:col-span-3" data-testid="guide-content-pets">
        <div>
          <h3 class="flex items-center gap-2 text-base font-semibold">
            <Icon name="lucide:paw-print" class="size-4 text-muted-foreground" />
            Pets
          </h3>
          <p class="mt-0.5 text-sm text-muted-foreground">
            Whether guests can bring pets, and the packages they choose from.
          </p>
        </div>
        <PetPolicySettingsCard :policy="petPolicy" :listing-name="listing.name" @change="savePetPolicy" />
      </Card>

      <Card v-else-if="selected === 'verification'" class="gap-4 p-5 xl:col-span-3" data-testid="guide-content-verification">
        <div>
          <h3 class="flex items-center gap-2 text-base font-semibold">
            <Icon name="lucide:shield-check" class="size-4 text-muted-foreground" />
            Guest Verification
          </h3>
          <p class="mt-0.5 text-sm text-muted-foreground">
            What guests of this listing are asked before arrival.
          </p>
        </div>
        <GuestVerificationSettingsCard :settings="verification" @change="saveVerification" />
      </Card>

      <Card v-else class="gap-4 p-5 xl:col-span-3" :data-testid="`guide-content-${selectedKind}`">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="flex items-center gap-2 text-base font-semibold">
              <Icon :name="selectedMeta.icon" class="size-4 text-muted-foreground" />
              {{ selectedMeta.label }}
            </h3>
            <p class="mt-0.5 text-sm text-muted-foreground">
              {{ selectedMeta.description }}
            </p>
          </div>
          <Button
            :variant="selectedItems.length ? 'outline' : 'default'"
            size="sm"
            class="shrink-0 gap-1.5"
            :data-testid="`guide-edit-${selectedKind}`"
            @click="edit(selectedKind)"
          >
            <Icon :name="selectedItems.length ? 'lucide:pencil' : 'lucide:plus'" class="size-3.5" />
            {{ selectedItems.length ? 'Edit' : 'Set up' }}
          </Button>
        </div>

        <p v-if="guideGap(selectedKind)" class="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" :data-testid="`guide-hidden-${selectedKind}`">
          <Icon name="lucide:eye-off" class="size-3.5 shrink-0" />
          <template v-if="guideGap(selectedKind) === 'missing'">
            Not in {{ assignedGuide?.title }}. Add the section to the guide to display it.
          </template>
          <template v-else>
            Hidden in {{ assignedGuide?.title }}. Turn the section on in the guide to display it.
          </template>
        </p>

        <!--
          Every kind is one row list, so a long item or a photo only grows its own row.
          The marker says what the list is: a number for steps (a sequence), the chosen
          icon for Good to Know, a check for rules. Photos are a fixed thumbnail.
        -->
        <ol v-if="selectedItems.length" class="flex flex-col divide-y rounded-lg border" data-testid="guide-items">
          <li v-for="(item, i) in selectedItems" :key="item.id" class="flex items-start gap-3 p-3">
            <span v-if="selectedMeta.numbered" class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{{ i + 1 }}</span>
            <span v-else-if="selectedMeta.iconPicker" class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon :name="item.icon || 'lucide:info'" class="size-4" />
            </span>
            <Icon v-else name="lucide:check" class="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">
                {{ item.title }}
              </p>
              <ExpandableText v-if="item.text" :html="toSafeHtml(item.text)" class="mt-0.5 text-sm text-muted-foreground" />
            </div>
            <img v-if="item.photoUrl" :src="item.photoUrl" alt="" class="aspect-video w-32 shrink-0 rounded-md border object-cover" data-testid="guide-item-thumb">
          </li>
        </ol>

        <div v-else class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
          <Icon :name="selectedMeta.icon" class="size-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            No {{ selectedMeta.label.toLowerCase() }} yet. Guests see this section empty until you set it up.
          </p>
        </div>
      </Card>
    </div>

    <ListingGuideContentSheet
      v-if="editingKind"
      v-model:open="sheetOpen"
      :kind="editingKind"
      :items="listingGuideItems(listing, editingKind)"
      :listing-id="listing.id"
      :listing-name="listing.name"
      @save="save"
    />
  </div>
</template>
