<script setup lang="ts">
import type { ListingChoice, ListingMode } from './data/channel-setup'
import { computed, ref } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { useChannelSetup } from '~/composables/useChannelSetup'
import { channelRatePlans } from './data/channel-pricing'
import { choiceIssues, listingLevelSettings, settingLabel } from './data/channel-setup'
import { channelSlug } from './data/channels'

/**
 * Step 3: for every listing not on the channel yet, create it new, link it to
 * the one the host already runs there, or skip it. Settings that can differ per
 * listing (e.g. the contracting legal entity) are set on the row.
 */
const props = defineProps<{ channelName: string, only?: string[] }>()

const setup = useChannelSetup(props.channelName, props.only)
const spec = setup.spec
const perListing = listingLevelSettings(spec)

const search = ref('')
const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return setup.pendingListings.value
    .filter(l => !q || l.name.toLowerCase().includes(q) || l.location.toLowerCase().includes(q))
    .map(l => ({ listing: l, choice: setup.choiceFor(l.id), photos: l.photos.length }))
})
// Scoped to one listing, the rest of the portfolio is not this step's business.
const alreadyOn = computed(() => props.only ? 0 : listings.value.length - setup.pendingListings.value.length)
const short = computed(() => rows.value.filter(r => r.choice.mode !== 'skip' && r.photos < spec.minPhotos).length)

// Rows whose listing-level settings are open. Opened by default when a value is already set.
const expanded = ref<Set<string>>(new Set(setup.pendingListings.value
  .filter(l => Object.values(setup.choiceFor(l.id).overrides).some(v => v.trim()))
  .map(l => l.id)))

function toggleExpanded(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  expanded.value = next
}

function setMode(id: string, value: unknown) {
  if (value === 'new' || value === 'link' || value === 'skip')
    setup.setChoice(id, { mode: value })
}

function setOverride(id: string, choice: ListingChoice, name: string, value: string) {
  setup.setChoice(id, { overrides: { ...choice.overrides, [name]: value } })
}

function bulk(mode: ListingMode) {
  setup.setMode(rows.value.map(r => r.listing.id), mode)
}

// Reka's Select refuses an empty value, so "no override" needs its own.
const ACCOUNT_VALUE = '__account'

const MODES: { value: ListingMode, label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'link', label: 'Link' },
  { value: 'skip', label: 'Skip' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-base font-semibold">
        Which listings go on {{ channelName }}
      </h2>
      <p class="text-sm text-muted-foreground">
        <strong class="font-medium text-foreground">New</strong> creates the listing on {{ channelName }} from your Elev8 content.
        <template v-if="spec.linkIds">
          <strong class="font-medium text-foreground">Link</strong> takes over one you already run there, keeping its reviews.
        </template>
      </p>
    </div>

    <div v-if="setup.pendingListings.value.length === 0" class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
      <Icon name="lucide:circle-check" class="size-6 text-green-600 dark:text-green-400" aria-hidden="true" />
      <p class="text-sm text-muted-foreground">
        Every listing is already on {{ channelName }}.
      </p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <BaseSearchInput v-model="search" placeholder="Search listings..." />
        <div class="flex items-center gap-1">
          <span class="mr-1 text-xs text-muted-foreground">Set all to</span>
          <Button size="sm" variant="outline" @click="bulk('new')">
            New
          </Button>
          <Button size="sm" variant="outline" @click="bulk('skip')">
            Skip
          </Button>
        </div>
      </div>

      <p class="text-xs text-muted-foreground" aria-live="polite">
        {{ setup.plan.value.create.length }} new, {{ setup.plan.value.link.length }} linked, {{ setup.plan.value.skip.length }} skipped
        <template v-if="alreadyOn > 0">
          · {{ alreadyOn }} already on {{ channelName }}
          (<NuxtLink :to="`/channels/${channelSlug(channelName)}`" class="text-primary hover:underline">
            see them
          </NuxtLink>)
        </template>
        <template v-if="short > 0">
          · <span class="text-amber-700 dark:text-amber-400">{{ short }} with fewer than {{ spec.minPhotos }} photos</span>
        </template>
      </p>

      <ul class="flex flex-col divide-y rounded-lg border">
        <li v-for="row in rows" :key="row.listing.id" class="flex flex-col gap-3 p-3" :class="row.choice.mode === 'skip' ? 'bg-muted/40' : ''">
          <div class="flex flex-wrap items-center gap-3">
            <img
              v-if="row.listing.photos[0]"
              :src="row.listing.photos[0]"
              alt=""
              class="size-10 shrink-0 rounded-md object-cover"
              :class="row.choice.mode === 'skip' ? 'opacity-50' : ''"
            >
            <div class="min-w-[160px] flex-1">
              <p class="text-sm font-medium" :class="row.choice.mode === 'skip' ? 'text-muted-foreground' : ''">
                {{ row.listing.name }}
              </p>
              <p class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {{ row.listing.location }}
                <span
                  v-if="row.choice.mode !== 'skip' && row.photos < spec.minPhotos"
                  class="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"
                >
                  <Icon name="lucide:triangle-alert" class="size-3" aria-hidden="true" />
                  {{ row.photos }} of {{ spec.minPhotos }} photos
                </span>
              </p>
            </div>
            <Button
              v-if="perListing.length && row.choice.mode !== 'skip'"
              variant="ghost"
              size="sm"
              class="text-xs"
              :aria-expanded="expanded.has(row.listing.id)"
              @click="toggleExpanded(row.listing.id)"
            >
              <Icon name="lucide:settings-2" class="mr-1 size-3.5" aria-hidden="true" />
              {{ perListing.length === 1 ? settingLabel(perListing[0]!.settingName) : 'Listing settings' }}
            </Button>
            <ToggleGroup
              :model-value="row.choice.mode"
              type="single"
              variant="outline"
              size="sm"
              :aria-label="`How ${row.listing.name} goes on ${channelName}`"
              @update:model-value="v => setMode(row.listing.id, v)"
            >
              <ToggleGroupItem
                v-for="mode in MODES"
                :key="mode.value"
                :value="mode.value"
                :disabled="mode.value === 'link' && !spec.linkIds"
                class="flex-none px-3"
              >
                {{ mode.label }}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div v-if="row.choice.mode === 'link' && spec.linkIds" class="flex flex-col gap-3 rounded-md bg-muted/40 p-3 sm:ml-13">
            <div class="flex flex-wrap gap-3">
              <div class="flex w-full flex-col gap-1.5 sm:w-44">
                <Label :for="`link-property-${row.listing.id}`" class="text-xs">{{ spec.linkIds.property }}</Label>
                <Input
                  :id="`link-property-${row.listing.id}`"
                  :model-value="row.choice.propertyId"
                  inputmode="numeric"
                  @update:model-value="v => setup.setChoice(row.listing.id, { propertyId: String(v) })"
                />
              </div>
              <div v-if="spec.linkIds.room" class="flex w-full flex-col gap-1.5 sm:w-44">
                <Label :for="`link-room-${row.listing.id}`" class="text-xs">{{ spec.linkIds.room }}</Label>
                <Input
                  :id="`link-room-${row.listing.id}`"
                  :model-value="row.choice.roomId"
                  inputmode="numeric"
                  @update:model-value="v => setup.setChoice(row.listing.id, { roomId: String(v) })"
                />
              </div>
              <div v-if="spec.linkIds.host" class="flex w-full flex-col gap-1.5 sm:w-44">
                <Label :for="`link-host-${row.listing.id}`" class="text-xs">{{ spec.linkIds.host }}</Label>
                <Input
                  :id="`link-host-${row.listing.id}`"
                  :model-value="row.choice.hostId"
                  inputmode="numeric"
                  @update:model-value="v => setup.setChoice(row.listing.id, { hostId: String(v) })"
                />
              </div>
            </div>
            <div
              role="checkbox"
              tabindex="0"
              :aria-checked="row.choice.importContent"
              class="flex w-fit cursor-pointer items-center gap-2 text-sm"
              @click="setup.setChoice(row.listing.id, { importContent: !row.choice.importContent })"
              @keydown.space.prevent="setup.setChoice(row.listing.id, { importContent: !row.choice.importContent })"
            >
              <div
                class="flex size-4 items-center justify-center rounded-[4px] border"
                :class="row.choice.importContent ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
              >
                <Icon v-if="row.choice.importContent" name="lucide:check" class="size-3" />
              </div>
              <span>Copy photos, descriptions and fees from {{ channelName }} into Elev8</span>
            </div>
            <fieldset v-if="spec.ratePlanPairs" class="flex flex-col gap-2">
              <legend class="text-xs font-medium">
                Rate plans already on {{ channelName }} <span class="font-normal text-muted-foreground">(optional)</span>
              </legend>
              <p v-if="channelRatePlans(row.listing, channelName).length === 0" class="text-xs text-muted-foreground">
                This listing has no rate plan that sells on {{ channelName }}. Add one in its Pricing tab, or {{ channelName }} gets a new one.
              </p>
              <div v-for="plan in channelRatePlans(row.listing, channelName)" :key="plan.code" class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <Label :for="`rate-plan-${plan.code}-${row.listing.id}`" class="text-sm font-normal sm:w-44">
                  {{ plan.name }}
                </Label>
                <Input
                  :id="`rate-plan-${plan.code}-${row.listing.id}`"
                  :model-value="row.choice.ratePlans[plan.code] ?? ''"
                  :placeholder="`${channelName} rate plan ID`"
                  inputmode="numeric"
                  class="sm:w-44"
                  @update:model-value="v => setup.setChoice(row.listing.id, { ratePlans: { ...row.choice.ratePlans, [plan.code]: String(v) } })"
                />
              </div>
              <p class="text-xs text-muted-foreground">
                Elev8 sends prices into the plan you name. Leave one empty and {{ channelName }} gets a new rate plan for it.
              </p>
            </fieldset>
            <p v-if="choiceIssues(spec, row.choice).length" class="text-xs text-destructive">
              Needed to link: {{ choiceIssues(spec, row.choice).join(', ') }}
            </p>
          </div>

          <div v-if="expanded.has(row.listing.id) && row.choice.mode !== 'skip'" class="flex flex-wrap gap-3 sm:ml-13">
            <div v-for="def in perListing" :key="def.settingName" class="flex w-full flex-col gap-1.5 sm:w-60">
              <Label :for="`override-${def.settingName}-${row.listing.id}`" class="text-xs">
                {{ settingLabel(def.settingName) }} for this listing
              </Label>
              <Select
                v-if="def.settingType === 'select'"
                :model-value="row.choice.overrides[def.settingName] || ACCOUNT_VALUE"
                @update:model-value="v => setOverride(row.listing.id, row.choice, def.settingName, v === ACCOUNT_VALUE ? '' : String(v ?? ''))"
              >
                <SelectTrigger :id="`override-${def.settingName}-${row.listing.id}`" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="ACCOUNT_VALUE">
                    Account value{{ setup.state.value.settings[def.settingName] ? ` (${setup.state.value.settings[def.settingName]})` : '' }}
                  </SelectItem>
                  <SelectItem v-for="option in def.settingOptions" :key="option" :value="option">
                    {{ option }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-else
                :id="`override-${def.settingName}-${row.listing.id}`"
                :model-value="row.choice.overrides[def.settingName] ?? ''"
                :placeholder="setup.state.value.settings[def.settingName] ? `Account: ${setup.state.value.settings[def.settingName]}` : ''"
                @update:model-value="v => setOverride(row.listing.id, row.choice, def.settingName, String(v))"
              />
            </div>
            <p class="w-full text-xs text-muted-foreground">
              Leave empty to use the account value. Set it when another owner contracts this listing with {{ channelName }}.
            </p>
          </div>
        </li>
        <li v-if="rows.length === 0" class="p-6 text-center text-sm text-muted-foreground">
          No listing matches.
        </li>
      </ul>
    </template>
  </div>
</template>
