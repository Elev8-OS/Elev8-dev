<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import type { AnalyticsChannelFilter, AnalyticsComparisonMode, AnalyticsPeriodPreset } from '~/types/review-analytics'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { computed, ref, watch } from 'vue'
import SavedViewsDropdown from '~/components/listings/SavedViewsDropdown.vue'
import { channelLabels } from '~/components/review-hub/data/types'

const {
  channelFilter,
  listingFilter,
  dateFrom,
  dateTo,
  periodPreset,
  applyPeriodPreset,
  comparisonMode,
  uniqueListings,
  clearFilters,
  savedViews,
  activeView,
  isDirty,
  canUpdateActiveView,
  pendingViewId,
  isLoading,
  fetchViews,
  saveCurrentAs,
  loadView,
  confirmLoadView,
  updateActiveView,
  deleteView,
  renameView,
  resetToDefault,
} = useReviewAnalytics()

const periodOptions: { value: AnalyticsPeriodPreset, label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
]

const comparisonOptions: { value: AnalyticsComparisonMode, label: string, hint: string }[] = [
  { value: 'previous_year', label: 'vs last year', hint: 'Compare with the same weeks one year earlier' },
  { value: 'previous_period', label: 'vs previous period', hint: 'Compare with the same number of days immediately before the selected period' },
]

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

function parseDateToCalendarDate(date: string | null) {
  if (!date)
    return undefined
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d)
    return undefined
  return new CalendarDate(y, m, d)
}

function calendarDateToString(date: CalendarDate | undefined): string | null {
  if (!date)
    return null
  return date.toString()
}

const datePopoverOpen = ref(false)
const dateRange = ref<DateRange>({
  start: parseDateToCalendarDate(dateFrom.value),
  end: parseDateToCalendarDate(dateTo.value),
})

watch(dateRange, (val) => {
  if (val.start || val.end) {
    periodPreset.value = 'custom'
    dateFrom.value = calendarDateToString(val.start)
    dateTo.value = calendarDateToString(val.end)
  }
}, { deep: true })

// Sync from filters when the popover opens
watch(datePopoverOpen, (open) => {
  if (open) {
    dateRange.value = {
      start: parseDateToCalendarDate(dateFrom.value),
      end: parseDateToCalendarDate(dateTo.value),
    }
  }
})

function clearDateFilter() {
  dateFrom.value = null
  dateTo.value = null
  dateRange.value = { start: undefined, end: undefined }
}

const dateFilterLabel = computed(() => {
  if (!dateFrom.value && !dateTo.value)
    return 'Date range'
  if (dateFrom.value === dateTo.value)
    return df.format(parseDateToCalendarDate(dateFrom.value)!.toDate(getLocalTimeZone()))
  const start = parseDateToCalendarDate(dateFrom.value)
  const end = parseDateToCalendarDate(dateTo.value)
  if (start && end)
    return `${df.format(start.toDate(getLocalTimeZone()))} – ${df.format(end.toDate(getLocalTimeZone()))}`
  return 'Date range'
})

const hasActiveFilters = computed(() => {
  const hasListing = listingFilter.value.length > 0 && !listingFilter.value.includes('All Properties')
  return channelFilter.value !== 'all' || hasListing || !!dateFrom.value || !!dateTo.value
})

// --- Saved views wiring ---
onMounted(async () => {
  await fetchViews()
  if (activeView.value) {
    applyViewState(activeView.value)
    // Re-apply the period preset so the date range is derived from the preset
    // (saved views store the preset, not absolute dates)
    applyPeriodPreset(periodPreset.value === 'custom' ? '30d' : periodPreset.value)
    updateCurrentState()
  }
  else {
    // No active view — default 30-day range
    applyPeriodPreset('30d')
  }
})

function getCurrentViewState() {
  return {
    channel: channelFilter.value,
    listings: listingFilter.value,
    dateFrom: dateFrom.value,
    dateTo: dateTo.value,
    period: periodPreset.value,
    comparison: comparisonMode.value,
  }
}

function applyViewState(state: { channel: AnalyticsChannelFilter, listings: string[], dateFrom: string | null, dateTo: string | null, period: AnalyticsPeriodPreset, comparison: AnalyticsComparisonMode }) {
  channelFilter.value = state.channel
  listingFilter.value = state.listings
  periodPreset.value = state.period
  comparisonMode.value = state.comparison
  dateFrom.value = state.dateFrom
  dateTo.value = state.dateTo
  dateRange.value = {
    start: parseDateToCalendarDate(state.dateFrom),
    end: parseDateToCalendarDate(state.dateTo),
  }
}

function updateCurrentState() {
  // The composable owns currentState via its own watch; here we just ensure it's synced
  // by calling the composable's internal updater indirectly through the exposed filters.
  // (currentState is updated by the composable's deep watch on the filter refs.)
}

async function handleLoadView(viewId: string) {
  const view = await loadView(viewId)
  if (view && !pendingViewId.value) {
    applyViewState({ channel: view.channel, listings: view.listings, dateFrom: view.dateFrom, dateTo: view.dateTo, period: view.period, comparison: view.comparison })
  }
}

function handleConfirmLoadView() {
  if (pendingViewId.value) {
    const viewId = pendingViewId.value
    const view = savedViews.value.find(v => v.id === viewId)
    if (view) {
      confirmLoadView(viewId)
      applyViewState({ channel: view.channel, listings: view.listings, dateFrom: view.dateFrom, dateTo: view.dateTo, period: view.period, comparison: view.comparison })
    }
  }
}

function handleSaveAs(name: string) {
  saveCurrentAs(name, getCurrentViewState())
}

function handleUpdateView() {
  updateActiveView(getCurrentViewState())
}

function handleResetView() {
  resetToDefault()
  // Re-apply default to the filter refs so UI reflects it
  channelFilter.value = 'all'
  listingFilter.value = []
  dateFrom.value = null
  dateTo.value = null
  periodPreset.value = '30d'
  comparisonMode.value = 'previous_year'
  dateRange.value = { start: undefined, end: undefined }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- Saved views -->
    <SavedViewsDropdown
      :saved-views="savedViews"
      :active-view="activeView"
      :is-dirty="isDirty"
      :is-loading="isLoading"
      :can-update-active-view="canUpdateActiveView"
      :pending-view-id="pendingViewId"
      @load-view="handleLoadView"
      @save-as="handleSaveAs"
      @update="handleUpdateView"
      @delete="deleteView"
      @rename="renameView"
      @reset="handleResetView"
      @confirm-load="handleConfirmLoadView"
    />

    <!-- Channel -->
    <Select v-model="channelFilter">
      <SelectTrigger class="h-9 w-[170px]">
        <SelectValue placeholder="All Channels" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          All Channels
        </SelectItem>
        <SelectItem v-for="(label, key) in channelLabels" :key="key" :value="key">
          {{ label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- Listing picker (multi-select with tag button) -->
    <SharedPropertyPicker v-model="listingFilter" :options="uniqueListings" />

    <!-- Period preset -->
    <Select :model-value="periodPreset" @update:model-value="(v: string) => applyPeriodPreset(v as AnalyticsPeriodPreset)">
      <SelectTrigger class="h-9 w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- Comparison -->
    <Select v-model="comparisonMode">
      <SelectTrigger class="h-9 w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in comparisonOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
        <div class="border-t px-3 py-2 text-xs text-muted-foreground">
          {{ comparisonOptions.find(o => o.value === comparisonMode)?.hint }}
        </div>
      </SelectContent>
    </Select>

    <!-- Clear filters -->
    <Button v-if="hasActiveFilters" variant="ghost" size="sm" class="h-9 gap-1.5 text-xs" @click="clearFilters">
      <Icon name="lucide:x" class="size-3.5" />
      Clear
    </Button>

    <!-- Date range (link-style, pushed to the far right) -->
    <div class="ml-auto">
      <Popover v-model:open="datePopoverOpen">
        <PopoverTrigger as-child>
          <Button
            variant="link"
            class="h-9 gap-1.5 px-2 text-sm font-normal text-foreground"
          >
            <Icon name="lucide:calendar" class="size-4" />
            <span class="max-w-[160px] truncate">{{ dateFilterLabel }}</span>
            <Icon name="lucide:chevron-down" class="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="end">
          <RangeCalendar
            v-model="dateRange"
            weekday-format="short"
            :number-of-months="2"
            initial-focus
            @update:start-value="(startDate: any) => dateRange.start = startDate"
          />
          <div class="flex items-center justify-between border-t px-3 py-2">
            <span class="text-xs text-muted-foreground">
              {{ dateFrom && dateTo ? 'Range selected' : 'Select a date range' }}
            </span>
            <Button v-if="dateFrom || dateTo" variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="clearDateFilter">
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  </div>
</template>
