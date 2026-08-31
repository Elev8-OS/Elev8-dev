<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { CancellationPolicyConfig } from '~/components/listings/data/listings'
import { createCancellationPolicyConfig, cancellationPolicySummary } from '~/components/listings/data/listings'
import { listings } from '~/components/listings/data/listings'
import CancellationPolicyEditor from '~/components/listings/CancellationPolicyEditor.vue'
import { useCancellationPolicies } from '~/composables/useCancellationPolicies'

const {
  defaultConfig,
  overrides,
  setOverride,
  clearOverride,
  effectiveConfigForListing,
} = useCancellationPolicies()

const showDefaultSheet = ref(false)
const defaultDraft = ref<CancellationPolicyConfig>(createCancellationPolicyConfig('flexible'))
const showOverrideListingPicker = ref(false)

function openEditDefault() {
  defaultDraft.value = JSON.parse(JSON.stringify(defaultConfig.value))
  showDefaultSheet.value = true
}

function saveDefault() {
  defaultConfig.value = JSON.parse(JSON.stringify(defaultDraft.value))
  showDefaultSheet.value = false
  toast.success('Default cancellation policy updated')
}

// ── Override dialog ─────────────────────────────────────────────────────
const showOverrideSheet = ref(false)
const overrideTargetId = ref<string | null>(null)
const overrideDraft = ref<CancellationPolicyConfig>(createCancellationPolicyConfig('flexible'))

const listingOptions = computed(() =>
  listings.value.map(l => ({ id: l.id, name: l.name, location: l.location, tags: l.tags })),
)

const overrideListings = computed(() =>
  listingOptions.value.filter(l => l.id in overrides.value),
)

const availableListingsForOverride = computed(() =>
  listingOptions.value.filter(l => !(l.id in overrides.value)),
)

// Rate-plan-level overrides stored inline on each listing's rate plans.
const ratePlanOverrides = computed(() => {
  const entries: {
    id: string
    listingId: string
    listingName: string
    unitTypeName: string
    ratePlanName: string
    isBase: boolean
    summary: string
  }[] = []
  for (const listing of listings.value) {
    for (const ut of listing.unitTypes ?? []) {
      for (const rp of ut.pricing.ratePlans) {
        if (rp.inheritCancellationPolicy === false) {
          entries.push({
            id: rp.id,
            listingId: listing.id,
            listingName: listing.name,
            unitTypeName: ut.name,
            ratePlanName: rp.name,
            isBase: rp.isBase,
            summary: cancellationPolicySummary(rp.cancellationPolicyConfig),
          })
        }
      }
    }
  }
  return entries
})

function openAddOverride(listingId: string) {
  overrideTargetId.value = listingId
  overrideDraft.value = JSON.parse(JSON.stringify(effectiveConfigForListing(listingId)))
  showOverrideSheet.value = true
}

function saveOverride() {
  if (!overrideTargetId.value)
    return
  setOverride(overrideTargetId.value, JSON.parse(JSON.stringify(overrideDraft.value)))
  showOverrideSheet.value = false
  toast.success('Listing override saved')
}

function removeOverride(listingId: string) {
  clearOverride(listingId)
  toast.success('Override removed')
}

function getListingName(id: string): string {
  return listings.value.find(l => l.id === id)?.name ?? id
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">Cancellation Policies</h3>
        <p class="text-sm text-muted-foreground">Set one default policy for every listing, then override it per listing when needed.</p>
      </div>
    </div>

    <!-- Default policy -->
    <div class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/30">
            <Icon name="lucide:calendar-x-2" class="size-4 text-muted-foreground" />
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">Default Policy</span>
              <Badge variant="secondary" class="text-[10px] px-1.5 shrink-0">All listings</Badge>
            </div>
            <span class="text-xs text-muted-foreground">{{ cancellationPolicySummary(defaultConfig) }}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="openEditDefault">
          <Icon name="lucide:pencil" class="size-3.5" />
          Edit
        </Button>
      </div>
    </div>

    <!-- Listing overrides -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium">Listing Overrides</h4>
        <Button v-if="overrideListings.length > 0" variant="outline" size="sm" class="h-8 gap-1" @click="showOverrideListingPicker = true">
          <Icon name="lucide:plus" class="size-3.5" />
          Add
        </Button>
        <span v-else class="text-xs text-muted-foreground">{{ overrideListings.length }} listing{{ overrideListings.length !== 1 ? 's' : '' }} with custom policy</span>
      </div>

      <div v-if="overrideListings.length === 0" class="border border-dashed bg-card/40 p-10 text-center">
        <p class="mb-3 text-sm text-muted-foreground">No overrides yet. Every listing uses the default policy.</p>
        <Button size="sm" @click="showOverrideListingPicker = true">
          <Icon name="lucide:plus" class="mr-1.5 size-3.5" />
          Add Listing Override
        </Button>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="listing in overrideListings"
          :key="listing.id"
          class="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
        >
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-medium truncate">{{ listing.name }}</span>
            <span class="text-xs text-muted-foreground">{{ listing.location }}</span>
            <span class="text-xs text-muted-foreground">{{ cancellationPolicySummary(overrides[listing.id]) }}</span>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="openAddOverride(listing.id)">
              <Icon name="lucide:pencil" class="size-3.5" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-destructive" @click="removeOverride(listing.id)">
              <Icon name="lucide:trash-2" class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Rate plan overrides -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium">Rate Plan Overrides</h4>
        <span class="text-xs text-muted-foreground">{{ ratePlanOverrides.length }} rate plan{{ ratePlanOverrides.length !== 1 ? 's' : '' }} with custom policy</span>
      </div>

      <div v-if="ratePlanOverrides.length === 0" class="rounded-lg border bg-card/40 p-6 text-center">
        <p class="text-sm text-muted-foreground">No rate plan overrides. All rate plans inherit the listing or account policy.</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="rp in ratePlanOverrides"
          :key="rp.id"
          class="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/30">
              <Icon name="lucide:tag" class="size-4 text-muted-foreground" />
            </div>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium truncate">{{ rp.ratePlanName }}</span>
                <Badge v-if="rp.isBase" variant="default" class="text-[10px] px-1.5 shrink-0">
                  Base
                </Badge>
                <Badge variant="secondary" class="text-[10px] px-1.5 shrink-0">Override</Badge>
              </div>
              <span class="text-xs text-muted-foreground truncate">{{ rp.listingName }} · {{ rp.unitTypeName }}</span>
              <span class="text-xs text-muted-foreground">{{ rp.summary }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Default policy sheet -->
    <Sheet v-model:open="showDefaultSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>Default Cancellation Policy</SheetTitle>
          <SheetDescription>This policy applies to every listing unless it has its own override.</SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <CancellationPolicyEditor v-model:config="defaultDraft" />
        </div>

        <SheetFooter class="border-t">
          <Button variant="outline" size="sm" @click="showDefaultSheet = false">Cancel</Button>
          <Button size="sm" @click="saveDefault">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Override sheet -->
    <Sheet v-model:open="showOverrideSheet">
      <SheetContent class="w-full sm:max-w-md p-0">
        <SheetHeader>
          <SheetTitle>Override for {{ overrideTargetId ? getListingName(overrideTargetId) : '' }}</SheetTitle>
          <SheetDescription>This listing will use this policy instead of the default.</SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <CancellationPolicyEditor v-model:config="overrideDraft" />
        </div>

        <SheetFooter class="border-t">
          <Button variant="outline" size="sm" @click="showOverrideSheet = false">Cancel</Button>
          <Button size="sm" @click="saveOverride">
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Add listing override dialog -->
    <Dialog v-model:open="showOverrideListingPicker">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Listing Override</DialogTitle>
          <DialogDescription>Choose a listing to create a custom cancellation policy for.</DialogDescription>
        </DialogHeader>

        <div class="space-y-2 max-h-[360px] overflow-auto">
          <button
            v-for="listing in availableListingsForOverride"
            :key="listing.id"
            type="button"
            class="w-full flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left text-sm hover:bg-accent"
            @click="openAddOverride(listing.id); showOverrideListingPicker = false"
          >
            <span class="font-medium">{{ listing.name }}</span>
            <span class="text-xs text-muted-foreground">{{ listing.location }}</span>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showOverrideListingPicker = false">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
