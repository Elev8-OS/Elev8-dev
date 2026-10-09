<script setup lang="ts">
import type { Listing, Unit } from '~/components/listings/data/listings'
import type { PricingPolicy } from '~/components/revenue/data/revenue-policy'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { clonePolicy, policiesEqual, revenueRooms, validatePolicy } from '~/components/revenue/data/revenue-policy'
import { effectiveAutonomy } from '~/components/revenue/data/revenue-settings'
import PolicyDemandRules from '~/components/revenue/policy/PolicyDemandRules.vue'
import PolicyEssentials from '~/components/revenue/policy/PolicyEssentials.vue'
import PolicyPreview from '~/components/revenue/policy/PolicyPreview.vue'
import PolicySeasons from '~/components/revenue/policy/PolicySeasons.vue'
import PolicyStayParty from '~/components/revenue/policy/PolicyStayParty.vue'
import RoomCostModelCard from '~/components/revenue/policy/RoomCostModelCard.vue'
import SeasonCopyDialog from '~/components/revenue/policy/SeasonCopyDialog.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { usePriceLabs } from '~/composables/usePriceLabs'
import { useRevenuePolicy } from '~/composables/useRevenuePolicy'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

/**
 * Listing detail > Revenue: the revenue settings of one room (spec §15.5),
 * ordered simple to advanced. The policy is edited as a draft; Save writes a
 * new version. The cost model saves on its own, straight away.
 */
const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()

const policyStore = useRevenuePolicy()
const revenueSettings = useRevenueSettings()
const pl = usePriceLabs()

onMounted(() => {
  policyStore.hydrate()
  revenueSettings.hydrate()
})

const allRooms = computed(() => revenueRooms(listings.value))
const rooms = computed(() => allRooms.value.filter(r => r.listingId === props.listing.id))

const roomKey = ref<string>('')
// The hero's room switch picks the room; the page remounts the tabs when it changes.
watch(() => props.activeUnit?.id, (unitId) => {
  roomKey.value = (rooms.value.find(r => r.unitId === unitId) ?? rooms.value[0])?.key ?? ''
}, { immediate: true })

const room = computed(() => rooms.value.find(r => r.key === roomKey.value) ?? rooms.value[0] ?? null)
const otherRooms = computed(() => allRooms.value.filter(r => r.key !== room.value?.key))

// ── Draft ────────────────────────────────────────────────────────────
const saved = computed<PricingPolicy | null>(() => room.value ? policyStore.policyFor(room.value) : null)
const draft = ref<PricingPolicy | null>(null)
const dirty = computed(() => !!draft.value && !!saved.value && !policiesEqual(draft.value, saved.value))

watch([() => room.value?.key, saved], ([key], [oldKey, oldSaved]) => {
  // Reset on a room switch, or when the stored policy changes under a draft
  // nobody has touched (a save, a restore, the store loading). Keep real edits.
  if (!saved.value)
    draft.value = null
  else if (key !== oldKey || !draft.value || !oldSaved || policiesEqual(draft.value, oldSaved))
    draft.value = clonePolicy(saved.value)
}, { immediate: true })

const issues = computed(() => draft.value ? validatePolicy(draft.value) : [])
const version = computed(() => room.value ? policyStore.currentVersion(room.value.key) : null)
const versions = computed(() => room.value ? [...policyStore.versionsFor(room.value.key)].reverse() : [])

function save() {
  if (!room.value || !draft.value || issues.value.length)
    return
  const v = policyStore.savePolicy(room.value.key, draft.value)
  toast.success(`Saved as version ${v.version}`, {
    description: pl.isConnected.value ? 'The pricing engine is updated on the next sync.' : undefined,
  })
}

function discard() {
  if (saved.value)
    draft.value = clonePolicy(saved.value)
}

const historyOpen = ref(false)

function restore(versionNumber: number) {
  if (!room.value)
    return
  const v = policyStore.restoreVersion(room.value.key, versionNumber)
  historyOpen.value = false
  if (v)
    toast.success(`Version ${versionNumber} restored as version ${v.version}`)
}

// ── Seasons copy ─────────────────────────────────────────────────────
const copyOpen = ref(false)

function openCopy() {
  if (dirty.value) {
    toast.info('Save this room first, then copy its seasons.')
    return
  }
  copyOpen.value = true
}

function copySeasons(keys: string[]) {
  if (!room.value || !saved.value)
    return
  policyStore.copySeasons(room.value, saved.value, allRooms.value.filter(r => keys.includes(r.key)))
  toast.success(`Seasons copied to ${keys.length} room${keys.length === 1 ? '' : 's'}`)
}

// ── Engine context ───────────────────────────────────────────────────
const autonomy = computed(() => room.value ? effectiveAutonomy(revenueSettings.settings.value.autonomy, room.value) : null)

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div v-if="room && draft" class="flex flex-col gap-4" data-testid="listing-revenue-tab">
    <!-- Room + version bar -->
    <Card class="flex-row flex-wrap items-center gap-3 p-4">
      <div class="flex min-w-0 items-center gap-2">
        <Icon name="lucide:door-open" class="size-4 shrink-0 text-muted-foreground" />
        <Select v-if="rooms.length > 1" v-model="roomKey">
          <SelectTrigger class="h-8 w-56 max-w-full" aria-label="Room">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="r in rooms" :key="r.key" :value="r.key">
              {{ r.unitName ?? r.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <span v-else class="truncate text-sm font-medium">{{ room.name }}</span>
      </div>

      <Popover v-model:open="historyOpen">
        <PopoverTrigger as-child>
          <button type="button" class="text-xs text-muted-foreground hover:text-foreground" data-testid="version-trigger">
            <template v-if="version">
              Version {{ version.version }} · {{ formatDate(version.savedAt) }} · {{ version.savedBy }}
            </template>
            <template v-else>
              Not saved yet · starting from the base rate plan
            </template>
          </button>
        </PopoverTrigger>
        <PopoverContent v-if="versions.length" class="w-80 p-0" align="start">
          <p class="border-b px-3 py-2 text-xs font-medium">
            Versions
          </p>
          <ul class="max-h-72 overflow-y-auto">
            <li v-for="v in versions" :key="v.version" class="flex items-center gap-2 border-b px-3 py-2 last:border-0">
              <div class="min-w-0 flex-1">
                <p class="text-sm">
                  Version {{ v.version }}
                  <Badge v-if="v.version === version?.version" variant="secondary" class="ml-1 text-[10px]">
                    Current
                  </Badge>
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ v.note }} · {{ formatDate(v.savedAt) }} · {{ v.savedBy }}
                </p>
              </div>
              <Button v-if="v.version !== version?.version" size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="restore(v.version)">
                Restore
              </Button>
            </li>
          </ul>
        </PopoverContent>
      </Popover>

      <div class="ml-auto flex items-center gap-2">
        <Badge v-if="dirty" variant="outline" class="border-warning/60 text-[11px] font-normal" data-testid="unsaved-badge">
          Unsaved changes
        </Badge>
        <Button v-if="dirty" variant="ghost" size="sm" @click="discard">
          Discard
        </Button>
        <Button size="sm" :disabled="!dirty || issues.length > 0" data-testid="save-policy" @click="save">
          Save
        </Button>
      </div>
    </Card>

    <!-- Engine context -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
      <span class="flex items-center gap-1.5">
        <Icon :name="pl.isConnected.value ? 'lucide:plug-zap' : 'lucide:plug'" class="size-3.5" />
        {{ pl.isConnected.value ? 'Pricing engine connected: these settings are written to it.' : 'No pricing engine connected: Elev8 prices from these settings itself.' }}
      </span>
      <span v-if="autonomy" class="flex items-center gap-1.5">
        <Icon name="lucide:gauge" class="size-3.5" />
        {{ autonomy.mode === 'review' ? 'Every recommendation waits for review' : `Auto-apply up to ±${autonomy.maxBandPct}% once earned` }}
      </span>
      <NuxtLink to="/revenue/settings?tab=engine" class="font-medium text-foreground hover:underline">
        Revenue settings
      </NuxtLink>
    </div>

    <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div class="flex min-w-0 flex-col gap-4">
        <PolicyEssentials v-model:policy="draft" :issues="issues" />
        <PolicyDemandRules v-model:policy="draft" :issues="issues" />
        <PolicySeasons v-model:policy="draft" :issues="issues" :can-copy="otherRooms.length > 0" @copy="openCopy" />
        <PolicyStayParty v-model:policy="draft" :issues="issues" />
        <RoomCostModelCard :room="room" :currency="draft.currency" :base-price="draft.base.price" />
      </div>
      <div class="lg:sticky lg:top-4">
        <PolicyPreview :policy="draft" :valid="issues.length === 0" />
      </div>
    </div>

    <SeasonCopyDialog v-model:open="copyOpen" :rooms="otherRooms" :season-count="saved?.seasons.length ?? 0" @copy="copySeasons" />
  </div>
</template>
