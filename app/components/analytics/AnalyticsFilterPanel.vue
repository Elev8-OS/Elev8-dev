<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import type { AnalyticsCompareMode, AnalyticsPeriodPreset } from '~/components/analytics/data/analytics'
import type { RevenueBasis } from '~/components/analytics/data/revenue-basis'
import type { FilterOption, ScopeKey } from '~/composables/useAnalytics'
import { parseDate } from '@internationalized/date'
import { ANALYTICS_COMPARE_MODES, ANALYTICS_PERIODS, earliestRangeStart } from '~/components/analytics/data/analytics'
import { REVENUE_BASES } from '~/components/analytics/data/revenue-basis'

// Every Analytics filter, stacked. Rendered in the right-hand sidebar on wide
// screens and in a Sheet below that; both read the same `useAnalytics` state.

const emit = defineEmits<{ close: [] }>()

const {
  anchorDate,
  filters,
  regionOptions,
  listingOptions,
  tagOptions,
  channelOptions,
  countryOptions,
  currency,
  currencyOptions,
  span,
  activeChips,
  setPeriod,
  setCustomRange,
  setCompare,
  setCurrency,
  setRevenueBasis,
  basisMeta,
  contractedListings,
  units,
  setScope,
  toggleScope,
  setIncludeRetired,
  retiredCounts,
  resetAll,
} = useAnalytics()

const RETIRED_SWITCHES = [
  { kind: 'inactive' as const, label: 'Include inactive listings', hint: 'Deactivated' },
  { kind: 'deleted' as const, label: 'Include deleted listings', hint: 'Removed, history kept' },
]

/* Custom range: the picker speaks CalendarDate, the composable ISO strings. */
const minDate = computed(() => parseDate(earliestRangeStart(anchorDate.value)))
const maxDate = computed(() => parseDate(anchorDate.value))
const pickerRange = computed<DateRange>({
  get: () => ({ start: parseDate(span.value.start), end: parseDate(span.value.end) }),
  set: (range) => {
    // The calendar emits a half range while the second day is being picked.
    if (range.start && range.end)
      setCustomRange({ start: range.start.toString(), end: range.end.toString() })
  },
})

interface ScopeSection {
  key: ScopeKey
  label: string
  icon: string
  options: FilterOption[]
  note?: string
}

const sections = computed<ScopeSection[]>(() => [
  { key: 'regions', label: 'Region', icon: 'lucide:map-pin', options: regionOptions.value },
  { key: 'channels', label: 'Channels', icon: 'lucide:share-2', options: channelOptions },
  { key: 'listingIds', label: 'Listings', icon: 'lucide:house', options: listingOptions.value },
  { key: 'tags', label: 'Tags', icon: 'lucide:tag', options: tagOptions.value, note: 'Listings must have every selected tag.' },
  { key: 'countries', label: 'Guest market', icon: 'lucide:globe', options: countryOptions.value },
])

/** Short lists start open; long ones open once something in them is picked. */
const openSections = ref<Record<string, boolean>>(Object.fromEntries(
  sections.value.map(s => [s.key, s.options.length < 7 || filters.value[s.key].length > 0]),
))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center justify-between gap-2 border-b px-4 py-3">
      <div class="flex items-center gap-2">
        <Icon name="lucide:sliders-horizontal" class="size-4" />
        <span class="text-sm font-semibold">Filters</span>
        <Badge v-if="activeChips.length" variant="default" class="h-4 min-w-4 rounded-full px-1 text-[9px]">
          {{ activeChips.length }}
        </Badge>
      </div>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-muted-foreground" data-testid="analytics-reset" @click="resetAll">
          Reset all
        </Button>
        <Button variant="ghost" size="icon" class="size-7" aria-label="Hide filters" @click="emit('close')">
          <Icon name="lucide:panel-right-close" class="size-4" />
        </Button>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
      <!-- Time -->
      <section class="flex flex-col gap-2">
        <Label class="text-xs font-medium text-muted-foreground">Period</Label>
        <Select :model-value="filters.period" @update:model-value="(v) => setPeriod(v as AnalyticsPeriodPreset)">
          <SelectTrigger size="sm" class="h-9 w-full" aria-label="Period">
            <Icon name="lucide:calendar" class="size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in ANALYTICS_PERIODS" :key="p.value" :value="p.value">
              {{ p.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <BaseDateRangePicker
          v-if="filters.period === 'custom'"
          v-model="pickerRange"
          :min-value="minDate"
          :max-value="maxDate"
          :number-of-months="1"
          class="[&_button]:h-9 [&_button]:text-xs"
          data-testid="analytics-custom-range"
        />
      </section>

      <section class="flex flex-col gap-2">
        <Label class="text-xs font-medium text-muted-foreground">Compare with</Label>
        <RadioGroup
          :model-value="filters.compare"
          class="gap-1.5"
          aria-label="Compare with"
          @update:model-value="(v) => setCompare(v as AnalyticsCompareMode)"
        >
          <div v-for="m in ANALYTICS_COMPARE_MODES" :key="m.value" class="flex items-center gap-2">
            <RadioGroupItem :id="`analytics-compare-${m.value}`" :value="m.value" />
            <Label :for="`analytics-compare-${m.value}`" class="cursor-pointer text-sm font-normal">{{ m.label }}</Label>
          </div>
        </RadioGroup>
      </section>

      <!-- Not a filter: the same bookings, valued differently. -->
      <section class="flex flex-col gap-2">
        <Label class="text-xs font-medium text-muted-foreground">Revenue basis</Label>
        <ToggleGroup
          :model-value="filters.revenueBasis"
          type="single"
          variant="outline"
          size="sm"
          class="w-full"
          aria-label="Revenue basis"
          data-testid="analytics-revenue-basis"
          @update:model-value="(v) => v && setRevenueBasis(v as RevenueBasis)"
        >
          <ToggleGroupItem v-for="b in REVENUE_BASES" :key="b.value" :value="b.value" class="flex-1 text-xs">
            {{ b.label }}
          </ToggleGroupItem>
        </ToggleGroup>
        <p class="text-[11px] text-muted-foreground">
          {{ basisMeta.hint }}
          <template v-if="filters.revenueBasis === 'owner_net'">
            {{ contractedListings }} of {{ units.length }} listings have an owner contract; the others pay no commission, so they show net.
          </template>
        </p>
      </section>

      <!-- Revenue is never converted, so money figures read one currency at a time. -->
      <section v-if="currencyOptions.length > 1" class="flex flex-col gap-2">
        <Label class="text-xs font-medium text-muted-foreground">Revenue currency</Label>
        <ToggleGroup
          :model-value="currency"
          type="single"
          variant="outline"
          size="sm"
          class="w-full"
          aria-label="Revenue currency"
          @update:model-value="(v) => v && setCurrency(String(v))"
        >
          <ToggleGroupItem v-for="c in currencyOptions" :key="c" :value="c" class="flex-1 text-xs">
            {{ c }}
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <Separator />

      <!-- Retired listings: their past stays count, their nights after closing are not available. -->
      <section class="flex flex-col gap-3">
        <Label class="text-xs font-medium text-muted-foreground">Listing status</Label>
        <div v-for="r in RETIRED_SWITCHES" :key="r.kind" class="flex items-start justify-between gap-3">
          <Label :for="`analytics-include-${r.kind}`" class="flex cursor-pointer flex-col items-start gap-0.5 font-normal">
            <span class="text-sm">{{ r.label }}</span>
            <span class="text-[11px] text-muted-foreground">
              {{ r.hint }} · {{ retiredCounts[r.kind] }} {{ retiredCounts[r.kind] === 1 ? 'listing' : 'listings' }}
            </span>
          </Label>
          <Switch
            :id="`analytics-include-${r.kind}`"
            :model-value="filters.includeRetired.includes(r.kind)"
            :disabled="retiredCounts[r.kind] === 0"
            :data-testid="`analytics-include-${r.kind}`"
            @update:model-value="(on: boolean) => setIncludeRetired(r.kind, on)"
          />
        </div>
      </section>

      <Separator />

      <!-- Scope -->
      <Collapsible
        v-for="s in sections"
        :key="s.key"
        v-model:open="openSections[s.key]"
        class="flex flex-col gap-2"
      >
        <div class="flex items-center justify-between gap-2">
          <CollapsibleTrigger class="flex flex-1 items-center gap-2 text-left text-sm font-medium" :data-testid="`analytics-section-${s.key}`">
            <Icon :name="s.icon" class="size-3.5 text-muted-foreground" />
            {{ s.label }}
            <Badge v-if="filters[s.key].length" variant="default" class="h-4 min-w-4 rounded-full px-1 text-[9px]">
              {{ filters[s.key].length }}
            </Badge>
            <Icon
              name="lucide:chevron-down"
              class="ml-auto size-4 text-muted-foreground transition-transform"
              :class="openSections[s.key] ? 'rotate-180' : ''"
            />
          </CollapsibleTrigger>
          <Button
            v-if="filters[s.key].length"
            variant="ghost"
            size="sm"
            class="h-6 px-1.5 text-[11px] text-muted-foreground"
            @click="setScope(s.key, [])"
          >
            Clear
          </Button>
        </div>
        <CollapsibleContent class="flex flex-col gap-1.5">
          <p v-if="s.note" class="text-[11px] text-muted-foreground">
            {{ s.note }}
          </p>
          <AnalyticsFilterCheckList
            :name="s.label"
            :options="s.options"
            :selected="filters[s.key]"
            @toggle="(value) => toggleScope(s.key, value)"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</template>
