<script setup lang="ts">
import type { GmWidgetItem } from '~/composables/useGmDashboardWidgets'
import { toast } from 'vue-sonner'
import {
  formatCompactMoney,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  formatSignedPoints,
} from '~/components/gm/data/gm-dashboard'
import GmBookingsPanel from '~/components/gm/GmBookingsPanel.vue'
import GmKpiCard from '~/components/gm/GmKpiCard.vue'
import GmOccupancyChart from '~/components/gm/GmOccupancyChart.vue'
import GmOperationsSummaryWidget from '~/components/gm/GmOperationsSummaryWidget.vue'
import GmQuickActionsWidget from '~/components/gm/GmQuickActionsWidget.vue'
import GmRevenueChart from '~/components/gm/GmRevenueChart.vue'
import GmSentimentPanel from '~/components/gm/GmSentimentPanel.vue'
import GmWidgetControls from '~/components/gm/GmWidgetControls.vue'
import { useGmDashboard } from '~/composables/useGmDashboard'
import { useGmDashboardWidgets } from '~/composables/useGmDashboardWidgets'

const props = withDefaults(
  defineProps<{
    widget: GmWidgetItem
    isFirst?: boolean
    isLast?: boolean
    isEditMode: boolean
    height?: number
  }>(),
  {
    isFirst: false,
    isLast: false,
    height: 360,
  },
)

const gm = useGmDashboard()
const { getWidgetMeta, setWidgetSpan, setWidgetHeight, setRowHeight, activeWidgets } = useGmDashboardWidgets()

const meta = computed(() => getWidgetMeta(props.widget.id))
const cardRef = ref<HTMLElement | null>(null)

function getSiblingIdsInSameRow(targetId: GmWidgetId): GmWidgetId[] {
  // If targetId is kpis in 1-row mode (colSpan >= 7), it does not share height with siblings
  if (targetId === 'kpis') {
    const kpiWidget = activeWidgets.value.find(w => w.id === 'kpis')
    if (kpiWidget && kpiWidget.colSpan >= 7) {
      return ['kpis']
    }
  }

  let accum = 0
  let currentRow: GmWidgetId[] = []
  for (const w of activeWidgets.value) {
    if (accum + w.colSpan > 12) {
      if (currentRow.includes(targetId))
        return currentRow.filter(id => !(id === 'kpis' && (activeWidgets.value.find(x => x.id === 'kpis')?.colSpan ?? 12) >= 7))
      currentRow = []
      accum = 0
    }
    currentRow.push(w.id)
    accum += w.colSpan
    if (accum >= 12) {
      if (currentRow.includes(targetId))
        return currentRow.filter(id => !(id === 'kpis' && (activeWidgets.value.find(x => x.id === 'kpis')?.colSpan ?? 12) >= 7))
      currentRow = []
      accum = 0
    }
  }
  if (currentRow.includes(targetId))
    return currentRow.filter(id => !(id === 'kpis' && (activeWidgets.value.find(x => x.id === 'kpis')?.colSpan ?? 12) >= 7))
  return [targetId]
}

const isResizingWidth = ref(false)
const isResizingHeight = ref(false)
const isResizingCorner = ref(false)
const isResizingAny = computed(() => isResizingWidth.value || isResizingHeight.value || isResizingCorner.value)

const currentHeight = ref<number>(props.widget.height ?? props.height ?? 360)
const liveSnapColSpan = ref<GmWidgetSpan>(props.widget.colSpan)

const spanShortLabels: Record<number, string> = {
  1: '1/12',
  2: '2/12',
  3: '1/4',
  4: '1/3',
  5: '5/12',
  6: '1/2',
  7: '7/12',
  8: '2/3',
  9: '3/4',
  10: '10/12',
  11: '11/12',
  12: 'Full',
}

function getRowLabel(h: number): string {
  if (h <= 300)
    return '1 Row'
  if (h <= 400)
    return '2 Rows'
  if (h <= 500)
    return '3 Rows'
  return '4 Rows'
}

const currentRowLabel = computed(() => {
  if (props.widget.id === 'kpis') {
    if (props.widget.colSpan >= 7) {
      return '1 Row'
    }
    if (props.widget.colSpan === 6) {
      return getRowLabel(Math.max(360, currentHeight.value))
    }
    return getRowLabel(Math.max(460, currentHeight.value))
  }
  return getRowLabel(currentHeight.value)
})

watch(
  () => props.widget.height ?? props.height ?? 360,
  (val) => {
    if (!isResizingHeight.value && !isResizingCorner.value) {
      currentHeight.value = val
    }
  },
)

watch(
  () => props.widget.colSpan,
  (val) => {
    if (!isResizingWidth.value && !isResizingCorner.value) {
      liveSnapColSpan.value = val
    }
  },
)

/**
 * Resize columns: Snaps to 12-column grid boundaries respecting widget minSpan
 */
function onHorizontalResizeStart(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isResizingWidth.value = true

  const card = cardRef.value
  if (!card)
    return

  const container = (card.closest('.grid-flow-dense') ?? card.parentElement) as HTMLElement | null
  if (!container)
    return

  const containerRect = container.getBoundingClientRect()
  const colWidth = (containerRect.width - (16 * 11)) / 12
  const cardRect = card.getBoundingClientRect()
  const startLeft = cardRect.left

  function onMouseMove(moveEvent: MouseEvent) {
    const currentMouseX = moveEvent.clientX
    const dragWidth = Math.max(colWidth, currentMouseX - startLeft)
    const rawCols = Math.round((dragWidth + 16) / (colWidth + 16))

    const minSpan = meta.value?.minSpan ?? 3
    const snappedSpan = Math.max(minSpan, Math.min(12, rawCols)) as GmWidgetSpan

    liveSnapColSpan.value = snappedSpan
    if (props.widget.colSpan !== snappedSpan) {
      setWidgetSpan(props.widget.id, snappedSpan)
    }
  }

  function onMouseUp() {
    isResizingWidth.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    toast.success(`"${meta.value?.title}": Snapped to ${props.widget.colSpan}/12 Columns (${spanShortLabels[props.widget.colSpan] ?? `${props.widget.colSpan}/12`})`)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

/**
 * Resize row height: Snaps to 280, 360, 460, 560px
 */
function onVerticalResizeStart(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isResizingHeight.value = true
  const startY = e.clientY
  const startHeight = currentHeight.value

  function onMouseMove(moveEvent: MouseEvent) {
    const deltaY = moveEvent.clientY - startY
    const targetHeight = startHeight + deltaY

    let snappedHeight = 360
    if (targetHeight < 320) {
      snappedHeight = 280
    }
    else if (targetHeight < 410) {
      snappedHeight = 360
    }
    else if (targetHeight < 510) {
      snappedHeight = 460
    }
    else {
      snappedHeight = 560
    }

    if (currentHeight.value !== snappedHeight) {
      currentHeight.value = snappedHeight
      setWidgetHeight(props.widget.id, snappedHeight)
    }
  }

  function onMouseUp() {
    isResizingHeight.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    toast.success(`"${meta.value?.title}": Snapped to ${getRowLabel(currentHeight.value)}`)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

/**
 * Corner resize: Snaps columns and rows simultaneously respecting minSpan
 */
function onCornerResizeStart(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isResizingCorner.value = true

  const card = cardRef.value
  if (!card)
    return
  const container = (card.closest('.grid-flow-dense') ?? card.parentElement) as HTMLElement | null
  if (!container)
    return

  const containerRect = container.getBoundingClientRect()
  const colWidth = (containerRect.width - (16 * 11)) / 12
  const cardRect = card.getBoundingClientRect()
  const startLeft = cardRect.left
  const startY = e.clientY
  const startHeight = currentHeight.value

  function onMouseMove(moveEvent: MouseEvent) {
    // Width snapping respecting minSpan
    const currentMouseX = moveEvent.clientX
    const dragWidth = Math.max(colWidth, currentMouseX - startLeft)
    const rawCols = Math.round((dragWidth + 16) / (colWidth + 16))
    const minSpan = meta.value?.minSpan ?? 3
    const snappedSpan = Math.max(minSpan, Math.min(12, rawCols)) as GmWidgetSpan

    liveSnapColSpan.value = snappedSpan
    if (props.widget.colSpan !== snappedSpan) {
      setWidgetSpan(props.widget.id, snappedSpan)
    }

    // Height snapping
    const deltaY = moveEvent.clientY - startY
    const targetHeight = startHeight + deltaY
    let snappedHeight = 360
    if (targetHeight < 320)
      snappedHeight = 280
    else if (targetHeight < 410)
      snappedHeight = 360
    else if (targetHeight < 510)
      snappedHeight = 460
    else snappedHeight = 560

    if (currentHeight.value !== snappedHeight) {
      currentHeight.value = snappedHeight
      setWidgetHeight(props.widget.id, snappedHeight)
    }
  }

  function onMouseUp() {
    isResizingCorner.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    toast.success(`"${meta.value?.title}": Snapped to ${props.widget.colSpan}/12 Columns · ${getRowLabel(currentHeight.value)}`)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const regionLabel = computed(() =>
  gm.regionOptions.find(option => option.value === gm.region.value)?.label ?? 'All regions')

function handleSentimentHandled(conversationId: string) {
  const conversation = gm.negativeConversations.value.find(c => c.id === conversationId)
  gm.markHandled(conversationId)
  toast.success(`Marked ${conversation?.guestName ?? 'conversation'} as handled`)
}

const kpiCards = computed(() => {
  const kpi = gm.kpis.value
  return [
    {
      key: 'occupancy',
      label: 'Occupancy tonight',
      icon: 'lucide:bed-double',
      value: formatPercent(kpi.occupancyTonight),
      delta: formatSignedPoints(kpi.occupancyDelta),
      trend: kpi.occupancyDelta >= 0 ? 'up' as const : 'down' as const,
      hint: `${kpi.inHouseUnits} of ${kpi.unitCount} properties · ${kpi.inHouseGuests} guests in house`,
    },
    {
      key: 'adr',
      label: 'ADR',
      icon: 'lucide:tag',
      value: formatMoney(kpi.adr),
      delta: formatSignedPercent(kpi.adrDelta),
      trend: kpi.adrDelta >= 0 ? 'up' as const : 'down' as const,
      hint: 'Average nightly rate, last 30 nights',
    },
    {
      key: 'revpar',
      label: 'RevPAR',
      icon: 'lucide:gauge',
      value: formatMoney(kpi.revpar),
      delta: formatSignedPercent(kpi.revparDelta),
      trend: kpi.revparDelta >= 0 ? 'up' as const : 'down' as const,
      hint: 'Revenue per available night',
    },
    {
      key: 'revenue',
      label: 'Room revenue',
      icon: 'lucide:wallet',
      value: formatCompactMoney(kpi.revenue30d),
      delta: formatSignedPercent(kpi.revenue30dDelta),
      trend: kpi.revenue30dDelta >= 0 ? 'up' as const : 'down' as const,
      hint: 'Nights sold in the last 30 days',
    },
  ]
})
</script>

<template>
  <div
    ref="cardRef"
    class="group/widget relative flex w-full flex-col transition-all h-full"
    :class="[
      props.isEditMode
        ? 'rounded-xl border-2 border-sky-400/70 dark:border-sky-500/60 bg-background/95 p-2 pt-3 shadow-xs'
        : '',
      isResizingAny ? 'ring-2 ring-sky-500/50 shadow-md select-none' : '',
    ]"
  >
    <!-- Direct Widget Controls (pinned toolbar in edit mode, or discreet hover dropdown) -->
    <div
      class="flex items-center"
      :class="[
        props.isEditMode
          ? 'absolute -top-3.5 left-3 right-3 z-20'
          : 'absolute right-3 top-3 z-10',
      ]"
    >
      <GmWidgetControls
        :widget-id="props.widget.id"
        :col-span="props.widget.colSpan"
        :height="currentHeight"
        :is-first="props.isFirst"
        :is-last="props.isLast"
        :is-edit-mode="props.isEditMode"
        class="w-full"
      />
    </div>

    <!-- 1. Right Edge Handle: Resize column width -->
    <div
      v-if="props.isEditMode"
      class="group/resize-x absolute -right-2.5 top-3 bottom-3 z-30 flex w-5 cursor-ew-resize items-center justify-center select-none"
      title="Drag to resize columns"
      aria-label="Resize column width"
      @mousedown="onHorizontalResizeStart"
    >
      <div
        class="flex h-12 w-3.5 items-center justify-center rounded-full border border-sky-400/90 bg-background/95 shadow-xs backdrop-blur-xs transition-all"
        :class="[
          isResizingWidth || isResizingCorner
            ? 'border-sky-600 bg-sky-600 text-white scale-110 shadow-md ring-2 ring-sky-400/50'
            : 'hover:border-sky-500 hover:bg-sky-500 hover:text-white',
        ]"
      >
        <Icon name="lucide:grip-vertical" class="size-3 opacity-90" />
      </div>
      <!-- Floating badge showing live stick column -->
      <div
        v-if="isResizingWidth"
        class="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md z-40"
      >
        Snap: {{ liveSnapColSpan }}/12 Columns ({{ spanShortLabels[liveSnapColSpan] }})
      </div>
    </div>

    <!-- 2. Bottom Edge Handle: Resize row block height -->
    <div
      v-if="props.isEditMode && !(props.widget.id === 'kpis' && props.widget.colSpan >= 7)"
      class="group/resize-y absolute -bottom-2.5 left-3 right-3 z-30 flex h-5 cursor-ns-resize items-center justify-center select-none"
      title="Drag to snap row height"
      aria-label="Resize row block height"
      @mousedown="onVerticalResizeStart"
    >
      <div
        class="flex items-center gap-1 rounded-full border border-sky-400/90 bg-background/95 px-2.5 py-0.5 shadow-xs backdrop-blur-xs transition-all"
        :class="[
          isResizingHeight || isResizingCorner
            ? 'border-sky-600 bg-sky-600 text-white scale-105 shadow-md ring-2 ring-sky-400/50'
            : 'hover:border-sky-500 hover:bg-sky-500 hover:text-white',
        ]"
      >
        <Icon name="lucide:grip-horizontal" class="size-3 opacity-90" />
        <span class="text-[10px] font-semibold tabular-nums">
          {{ currentRowLabel }}
        </span>
      </div>
      <!-- Floating badge showing live stick row -->
      <div
        v-if="isResizingHeight"
        class="pointer-events-none absolute -bottom-7 whitespace-nowrap rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md z-40"
      >
        Snap: {{ currentRowLabel }}
      </div>
    </div>

    <!-- 3. Bottom-Right Corner Handle: Resize width & row simultaneously -->
    <div
      v-if="props.isEditMode && !(props.widget.id === 'kpis' && props.widget.colSpan >= 7)"
      class="group/resize-corner absolute -bottom-2.5 -right-2.5 z-30 flex size-5 cursor-nwse-resize items-center justify-center rounded-br-lg rounded-tl-sm border border-sky-400/90 bg-background/95 text-sky-600 shadow-xs backdrop-blur-xs transition-all select-none"
      :class="[
        isResizingCorner
          ? 'border-sky-600 bg-sky-600 text-white scale-110 shadow-md ring-2 ring-sky-400/50'
          : 'hover:border-sky-500 hover:bg-sky-500 hover:text-white',
      ]"
      title="Drag corner to resize columns and rows"
      aria-label="Resize corner"
      @mousedown="onCornerResizeStart"
    >
      <Icon name="lucide:arrow-down-right" class="size-3" />
      <div
        v-if="isResizingCorner"
        class="pointer-events-none absolute -bottom-8 right-0 whitespace-nowrap rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md z-40"
      >
        Snap: {{ liveSnapColSpan }}/12 Columns · {{ currentRowLabel }}
      </div>
    </div>

    <!-- Widget Component Rendering -->
    <div class="flex-1 min-h-0 w-full flex flex-col">
      <template v-if="props.widget.id === 'kpis'">
        <div class="@container/kpis w-full">
          <div
            class="grid gap-3"
            :class="[
              props.widget.colSpan >= 7
                ? 'grid-cols-2 @lg/kpis:grid-cols-4'
                : props.widget.colSpan === 6
                  ? 'grid-cols-2'
                  : 'grid-cols-1',
            ]"
          >
            <GmKpiCard
              v-for="card in kpiCards"
              :key="card.key"
              :label="card.label"
              :icon="card.icon"
              :value="card.value"
              :delta="card.delta"
              :trend="card.trend"
              :hint="card.hint"
              :compact="props.widget.colSpan <= 5"
            />
          </div>
        </div>
      </template>

      <template v-else-if="props.widget.id === 'occupancy_flow'">
        <GmOccupancyChart :days="gm.dayFlow.value" :anchor-date="gm.anchorDate.value" :height="currentHeight" />
      </template>

      <template v-else-if="props.widget.id === 'revenue_trend'">
        <GmRevenueChart
          v-model:range="gm.revenueRange.value"
          :series="gm.revenueSeries.value"
          :metrics="gm.revenueRangeMetrics.value"
          :height="currentHeight"
        />
      </template>

      <template v-else-if="props.widget.id === 'sentiment_panel'">
        <GmSentimentPanel
          :rows="gm.visibleNegative.value"
          :hidden-count="gm.hiddenNegativeCount.value"
          :summary="gm.sentimentSummary.value"
          :region-label="regionLabel"
          @open="gm.openConversation"
          @handled="handleSentimentHandled"
        />
      </template>

      <template v-else-if="props.widget.id === 'bookings_panel'">
        <GmBookingsPanel
          class="h-full"
          :strip-days="gm.stripDays.value"
          :strip-occupancy="gm.stripOccupancy.value"
          :selected-date="gm.selectedDate.value"
          :anchor-date="gm.anchorDate.value"
          :bookings="gm.selectedBookings.value"
          @select="gm.setSelectedDate"
          @shift="gm.shiftStrip"
          @today="gm.goToToday"
        />
      </template>

      <template v-else-if="props.widget.id === 'operations_summary'">
        <GmOperationsSummaryWidget
          :kpis="gm.kpis.value"
          :unit-count="gm.unitCount.value"
        />
      </template>

      <template v-else-if="props.widget.id === 'quick_actions'">
        <GmQuickActionsWidget />
      </template>
    </div>
  </div>
</template>
