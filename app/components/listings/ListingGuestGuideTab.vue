<script setup lang="ts">
import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'
import type { GuestVerificationSettings } from '~/components/listings/data/guest-verification'
import type { RoomGuideKind } from '~/components/listings/data/listing-room-overrides'
import type { Listing } from '~/components/listings/data/listings'
import type { PetPolicy } from '~/components/listings/data/pet-policy'
import { toast } from 'vue-sonner'
import GuideStatusBadge from '~/components/guest-guides/GuideStatusBadge.vue'
import { GUIDE_CONTENT_KINDS, GUIDE_CONTENT_META, listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { guestVerificationShortLabel, listingGuestVerification } from '~/components/listings/data/guest-verification'
import { copyGuideItemsToListings, removeGuideItems } from '~/components/listings/data/guide-bulk'
import { isRoomGuideKind, roomGuideItems, setRoomGuideItems } from '~/components/listings/data/listing-room-overrides'
import { listingPetPolicy } from '~/components/listings/data/pet-policy'
import GuestVerificationSettingsCard from '~/components/listings/guest-guide/GuestVerificationSettingsCard.vue'
import GuideItemRows from '~/components/listings/guest-guide/GuideItemRows.vue'
import GuideSetupCopyDialog from '~/components/listings/guest-guide/GuideSetupCopyDialog.vue'
import ListingGuideContentSheet from '~/components/listings/guest-guide/ListingGuideContentSheet.vue'
import PetPolicySettingsCard from '~/components/listings/guest-guide/PetPolicySettingsCard.vue'
import GuideAssignPopover from '~/components/listings/GuideAssignPopover.vue'
import SetupBulkBar from '~/components/listings/setup/SetupBulkBar.vue'
import { useGuestGuides } from '~/composables/useGuestGuides'

/**
 * The listing's guest guide content: which guide it uses, and the content the
 * listing owns (check-in/out steps, house rules, Good to Know). The guide only
 * shows or hides these sections; ElevAI and the house-rules agreement read the
 * same content (`guest-guide-content.ts`).
 */
const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const { guides } = useGuestGuides()
/** "Copy to listings": this listing's whole guest guide setup. */
const copyAllOpen = ref(false)
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

// --- Rooms: a multi-unit listing's rooms each add their own check-in steps and
// Good to Know after the property's (`listing-room-overrides.ts`). Null = the property.
const rooms = computed(() => props.listing.unitType === 'multi'
  ? (props.listing.unitTypes ?? []).flatMap(ut => ut.units.map(u => ({ id: u.id, name: u.name, typeName: ut.name })))
  : [])
const roomId = ref<string | null>(null)
const room = computed(() => rooms.value.find(r => r.id === roomId.value))
const roomCanAdd = computed(() => isRoomGuideKind(selectedKind.value))
const roomItems = computed(() => room.value && roomCanAdd.value
  ? roomGuideItems(props.listing, room.value.id, selectedKind.value as RoomGuideKind)
  : [])

function countOf(kind: GuideContentKind) {
  const own = room.value && isRoomGuideKind(kind) ? roomGuideItems(props.listing, room.value.id, kind).length : 0
  return listingGuideItems(props.listing, kind).length + own
}

const editingKind = ref<GuideContentKind | null>(null)
/** Whether the sheet edits the property's items or the selected room's own. */
const editingRoom = ref(false)
const sheetOpen = ref(false)
const editingItems = computed(() => {
  if (!editingKind.value)
    return []
  return editingRoom.value && room.value && isRoomGuideKind(editingKind.value)
    ? roomGuideItems(props.listing, room.value.id, editingKind.value)
    : listingGuideItems(props.listing, editingKind.value)
})

function edit(kind: GuideContentKind, forRoom = false) {
  editingKind.value = kind
  editingRoom.value = forRoom
  sheetOpen.value = true
}

function save(items: GuideContentItem[]) {
  const kind = editingKind.value
  if (!kind)
    return
  if (editingRoom.value && room.value && isRoomGuideKind(kind)) {
    emit('update', setRoomGuideItems(props.listing, room.value.id, kind, items))
    toast.success(`${GUIDE_CONTENT_META[kind].label} for ${room.value.name} saved`)
    return
  }
  emit('update', { ...props.listing, guestGuide: { ...props.listing.guestGuide, [kind]: items } })
  toast.success(`${GUIDE_CONTENT_META[kind].label} saved`)
}

// --- Select mode: the list being edited (the property's, or the room's own).
const selecting = ref(false)
const selectedIds = ref<string[]>([])
watch([selected, roomId], () => { selecting.value = false })
watch(selecting, (on) => {
  if (!on)
    selectedIds.value = []
})
const editableItems = computed(() => room.value ? roomItems.value : selectedItems.value)

function deleteSelected() {
  const kind = selectedKind.value
  const n = selectedIds.value.length
  if (room.value && isRoomGuideKind(kind))
    emit('update', setRoomGuideItems(props.listing, room.value.id, kind, roomItems.value.filter(i => !selectedIds.value.includes(i.id))))
  else
    emit('update', removeGuideItems(props.listing, kind, selectedIds.value))
  toast.success(`${n} ${n === 1 ? GUIDE_CONTENT_META[kind].noun : `${GUIDE_CONTENT_META[kind].noun}s`} deleted`)
}

function copySelected(targetIds: string[]) {
  const kind = selectedKind.value
  const items = editableItems.value.filter(i => selectedIds.value.includes(i.id))
  const count = copyGuideItemsToListings(props.listing.id, kind, items, targetIds)
  toast.success(`${items.length} ${items.length === 1 ? GUIDE_CONTENT_META[kind].noun : `${GUIDE_CONTENT_META[kind].noun}s`} copied to ${count} ${count === 1 ? 'listing' : 'listings'}`)
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
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="gap-1.5" data-testid="guide-copy-all" @click="copyAllOpen = true">
            <Icon name="lucide:copy" class="size-3.5" />
            Copy to listings
          </Button>
          <GuideAssignPopover :listing-id="listing.id" :listing-name="listing.name" />
        </div>
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

    <!-- Multi-unit: show the property's content, or one room (property items + that room's own). -->
    <div v-if="rooms.length" class="flex flex-wrap items-center gap-3" data-testid="guide-room-picker">
      <span class="text-sm font-medium">Showing</span>
      <Select :model-value="roomId ?? 'property'" @update:model-value="(v) => roomId = v === 'property' ? null : String(v)">
        <SelectTrigger class="h-9 w-64" aria-label="Property or room">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="property">
            Property (every room)
          </SelectItem>
          <SelectItem v-for="r in rooms" :key="r.id" :value="r.id">
            {{ r.name }} · {{ r.typeName }}
          </SelectItem>
        </SelectContent>
      </Select>
      <span class="text-xs text-muted-foreground">
        {{ room ? `Guests in ${room.name} see the property's items, then the ones only for ${room.name}.` : 'Every room gets these. Pick a room to add what is only for it.' }}
      </span>
    </div>

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
          <div v-if="!room" class="flex shrink-0 items-center gap-2">
            <Button
              v-if="selectedItems.length && !selecting"
              variant="outline"
              size="sm"
              class="gap-1.5"
              data-testid="guide-select"
              @click="selecting = true"
            >
              <Icon name="lucide:list-checks" class="size-3.5" />
              Select
            </Button>
            <Button
              :variant="selectedItems.length ? 'outline' : 'default'"
              size="sm"
              class="gap-1.5"
              :data-testid="`guide-edit-${selectedKind}`"
              @click="edit(selectedKind)"
            >
              <Icon :name="selectedItems.length ? 'lucide:pencil' : 'lucide:plus'" class="size-3.5" />
              {{ selectedItems.length ? 'Edit' : 'Set up' }}
            </Button>
          </div>
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

        <!-- Property view: the property's items, editable, with Select mode. -->
        <template v-if="!room">
          <SetupBulkBar
            v-model:selecting="selecting"
            select-all
            :listing-id="listing.id"
            :selected-count="selectedIds.length"
            :total="selectedItems.length"
            :noun="selectedMeta.noun"
            :copy-note="`Copies go to the end of the ${selectedMeta.label.toLowerCase()} of the listings you pick.`"
            :delete-note="`The selected ${selectedMeta.noun}s are removed from this listing's guest guide.`"
            @toggle-all="selectedIds = selectedIds.length === selectedItems.length ? [] : selectedItems.map(i => i.id)"
            @copy="copySelected"
            @delete="deleteSelected"
          />
          <GuideItemRows v-if="selectedItems.length" v-model:selected="selectedIds" :items="selectedItems" :meta="selectedMeta" :selecting="selecting" />
          <div v-else class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
            <Icon :name="selectedMeta.icon" class="size-8 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">
              No {{ selectedMeta.label.toLowerCase() }} yet. Guests see this section empty until you set it up.
            </p>
          </div>
        </template>

        <!-- Room view: the property's items (read-only), then the room's own. -->
        <template v-else>
          <div class="flex flex-col gap-2" data-testid="guide-room-inherited">
            <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon name="lucide:link" class="size-3.5" />
              From the property ({{ selectedItems.length }})
            </span>
            <GuideItemRows v-if="selectedItems.length" :items="selectedItems" :meta="selectedMeta" muted />
            <p v-else class="rounded-lg border border-dashed px-4 py-4 text-center text-xs text-muted-foreground">
              The property has none yet.
            </p>
          </div>

          <div v-if="roomCanAdd" class="flex flex-col gap-2" data-testid="guide-room-own">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="flex items-center gap-1.5 text-xs font-medium">
                <Icon name="lucide:door-closed" class="size-3.5 text-muted-foreground" />
                Only in {{ room.name }} ({{ roomItems.length }})
              </span>
              <div class="flex items-center gap-2">
                <Button
                  v-if="roomItems.length && !selecting"
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5"
                  data-testid="guide-select"
                  @click="selecting = true"
                >
                  <Icon name="lucide:list-checks" class="size-3.5" />
                  Select
                </Button>
                <Button :variant="roomItems.length ? 'outline' : 'default'" size="sm" class="h-8 gap-1.5" data-testid="guide-room-edit" @click="edit(selectedKind, true)">
                  <Icon :name="roomItems.length ? 'lucide:pencil' : 'lucide:plus'" class="size-3.5" />
                  {{ roomItems.length ? 'Edit' : `Add for ${room.name}` }}
                </Button>
              </div>
            </div>
            <SetupBulkBar
              v-model:selecting="selecting"
              select-all
              :listing-id="listing.id"
              :selected-count="selectedIds.length"
              :total="roomItems.length"
              :noun="selectedMeta.noun"
              :copy-note="`Copies go to the end of the ${selectedMeta.label.toLowerCase()} of the listings you pick (their property content).`"
              :delete-note="`The selected ${selectedMeta.noun}s are removed from ${room.name}.`"
              @toggle-all="selectedIds = selectedIds.length === roomItems.length ? [] : roomItems.map(i => i.id)"
              @copy="copySelected"
              @delete="deleteSelected"
            />
            <GuideItemRows v-if="roomItems.length" v-model:selected="selectedIds" :items="roomItems" :meta="selectedMeta" :start-at="selectedItems.length" :selecting="selecting" />
            <p v-else class="rounded-lg border border-dashed px-4 py-4 text-center text-xs text-muted-foreground">
              Nothing only for {{ room.name }} yet. Guests in this room see the property's {{ selectedMeta.label.toLowerCase() }}.
            </p>
          </div>
          <p v-else class="flex items-center gap-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground" data-testid="guide-room-same">
            <Icon name="lucide:info" class="size-3.5 shrink-0" />
            {{ selectedMeta.label }} are the same for every room. Edit them under Property.
          </p>
        </template>
      </Card>
    </div>

    <GuideSetupCopyDialog v-model:open="copyAllOpen" :listing="listing" />

    <ListingGuideContentSheet
      v-if="editingKind"
      v-model:open="sheetOpen"
      :kind="editingKind"
      :items="editingItems"
      :listing-id="listing.id"
      :listing-name="listing.name"
      @save="save"
    />
  </div>
</template>
