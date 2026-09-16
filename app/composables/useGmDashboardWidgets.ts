export type GmWidgetId
  = | 'kpis'
    | 'occupancy_flow'
    | 'sentiment_panel'
    | 'revenue_trend'
    | 'bookings_panel'
    | 'operations_summary'
    | 'quick_actions'

export type GmWidgetSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export const ALL_GM_WIDGET_SPANS: GmWidgetSpan[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export interface GmWidgetMeta {
  id: GmWidgetId
  title: string
  description: string
  icon: string
  category: 'kpi' | 'analytics' | 'operations' | 'guest_relations'
  defaultSpan: GmWidgetSpan
  minSpan?: GmWidgetSpan
  allowedSpans: GmWidgetSpan[]
}

export interface GmWidgetItem {
  id: GmWidgetId
  enabled: boolean
  colSpan: GmWidgetSpan
  height?: number
}

export const GM_WIDGET_HEIGHT_PRESETS = [280, 360, 460, 560] as const
export const DEFAULT_GM_WIDGET_HEIGHT = 360
export const MIN_GM_WIDGET_HEIGHT = 240
export const MAX_GM_WIDGET_HEIGHT = 720

export const GM_WIDGET_CATALOG: GmWidgetMeta[] = [
  {
    id: 'kpis',
    title: 'Key Performance Indicators',
    description: 'Core portfolio metrics: Occupancy tonight, ADR, RevPAR, and 30-day Room Revenue.',
    icon: 'lucide:layout-grid',
    category: 'kpi',
    defaultSpan: 12,
    minSpan: 3,
    allowedSpans: ALL_GM_WIDGET_SPANS,
  },
  {
    id: 'occupancy_flow',
    title: 'Occupancy Flow',
    description: '14-day bidirectional occupancy trajectory with arrivals and departures.',
    icon: 'lucide:bed-double',
    category: 'analytics',
    defaultSpan: 8,
    minSpan: 4,
    allowedSpans: ALL_GM_WIDGET_SPANS,
  },
  {
    id: 'sentiment_panel',
    title: 'Guest Sentiment',
    description: 'Unhappy guest conversations requiring prompt host response from inbox.',
    icon: 'lucide:message-square-warning',
    category: 'guest_relations',
    defaultSpan: 4,
    minSpan: 3,
    allowedSpans: ALL_GM_WIDGET_SPANS,
  },
  {
    id: 'revenue_trend',
    title: 'Revenue Trend',
    description: 'Daily room revenue performance over 14 or 30 days with comparison metrics.',
    icon: 'lucide:trending-up',
    category: 'analytics',
    defaultSpan: 8,
    minSpan: 4,
    allowedSpans: ALL_GM_WIDGET_SPANS,
  },
  {
    id: 'bookings_panel',
    title: 'Daily Bookings',
    description: 'Today\'s arrivals, departures, and staying-on guests with a 7-day date strip.',
    icon: 'lucide:calendar-clock',
    category: 'operations',
    defaultSpan: 4,
    minSpan: 4,
    allowedSpans: ALL_GM_WIDGET_SPANS,
  },
  {
    id: 'operations_summary',
    title: 'Operations Summary',
    description: 'In-house guests count, occupied units ratio, and unverified arrival alerts.',
    icon: 'lucide:clipboard-check',
    category: 'operations',
    defaultSpan: 4,
    minSpan: 3,
    allowedSpans: ALL_GM_WIDGET_SPANS,
  },
  {
    id: 'quick_actions',
    title: 'Quick Navigation',
    description: 'Manager shortcuts to Operations Calendar, Guest Inbox, Rates, and Key Management.',
    icon: 'lucide:compass',
    category: 'operations',
    defaultSpan: 4,
    minSpan: 3,
    allowedSpans: ALL_GM_WIDGET_SPANS,
  },
]

export const DEFAULT_GM_WIDGETS: GmWidgetItem[] = [
  { id: 'kpis', enabled: true, colSpan: 12, height: 360 },
  { id: 'occupancy_flow', enabled: true, colSpan: 8, height: 360 },
  { id: 'sentiment_panel', enabled: true, colSpan: 4, height: 360 },
  { id: 'revenue_trend', enabled: true, colSpan: 8, height: 360 },
  { id: 'bookings_panel', enabled: true, colSpan: 4, height: 360 },
  { id: 'operations_summary', enabled: false, colSpan: 4, height: 360 },
  { id: 'quick_actions', enabled: false, colSpan: 4, height: 360 },
]

export const STORAGE_KEY_GM_WIDGETS = 'elev8-gm-dashboard-widgets'

const SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-1 @3xl/main:col-span-1 @5xl/main:col-span-1',
  2: 'col-span-1 @3xl/main:col-span-2 @5xl/main:col-span-2',
  3: 'col-span-1 @3xl/main:col-span-2 @5xl/main:col-span-3',
  4: 'col-span-1 @3xl/main:col-span-3 @5xl/main:col-span-4',
  5: 'col-span-1 @3xl/main:col-span-3 @5xl/main:col-span-5',
  6: 'col-span-1 @3xl/main:col-span-3 @5xl/main:col-span-6',
  7: 'col-span-1 @3xl/main:col-span-4 @5xl/main:col-span-7',
  8: 'col-span-1 @3xl/main:col-span-4 @5xl/main:col-span-8',
  9: 'col-span-1 @3xl/main:col-span-5 @5xl/main:col-span-9',
  10: 'col-span-1 @3xl/main:col-span-5 @5xl/main:col-span-10',
  11: 'col-span-1 @3xl/main:col-span-6 @5xl/main:col-span-11',
  12: 'col-span-1 @3xl/main:col-span-6 @5xl/main:col-span-12',
}

export function getWidgetSpanClass(span: GmWidgetSpan): string {
  return SPAN_CLASSES[span] ?? 'col-span-1 @3xl/main:col-span-3 @5xl/main:col-span-4'
}

const ROW_SPAN_CLASSES: Record<number, string> = {
  1: 'row-span-1',
  2: 'row-span-2',
  3: 'row-span-3',
  4: 'row-span-4',
}

export function getWidgetRowSpan(id: GmWidgetId, height?: number, colSpan?: number): number {
  if (id === 'kpis') {
    const span = colSpan ?? 12
    if (span >= 7) {
      return 1
    }
    if (span === 6) {
      const h = height ?? 360
      if (h <= 300)
        return 2
      if (h <= 400)
        return 2
      if (h <= 500)
        return 3
      return 4
    }
    // span <= 5: 1 column downward
    const h = height ?? 460
    if (h <= 300)
      return 2
    if (h <= 500)
      return 3
    return 4
  }
  const h = height ?? 360
  if (h <= 300)
    return 1
  if (h <= 400)
    return 2
  if (h <= 500)
    return 3
  return 4
}

export function getWidgetRowSpanClass(id: GmWidgetId, height?: number, colSpan?: number): string {
  const span = getWidgetRowSpan(id, height, colSpan)
  return ROW_SPAN_CLASSES[span] ?? 'row-span-2'
}

export function useGmDashboardWidgets() {
  const isEditMode = useState<boolean>('gm-widgets-edit-mode', () => false)
  const isCustomizeModalOpen = useState<boolean>('gm-widgets-customize-modal', () => false)

  // Initialize widgets from localStorage if available on client
  const widgets = useState<GmWidgetItem[]>('gm-dashboard-widgets-state', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY_GM_WIDGETS)
        if (saved) {
          const parsed = JSON.parse(saved) as GmWidgetItem[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Ensure all catalog widgets are present and minimum span/height is populated
            const sanitized = parsed.map((p) => {
              const meta = GM_WIDGET_CATALOG.find(m => m.id === p.id)
              const minSpan = meta?.minSpan ?? 3
              return {
                ...p,
                colSpan: Math.max(minSpan, Math.min(12, p.colSpan)) as GmWidgetSpan,
                height: p.height ?? DEFAULT_GM_WIDGET_HEIGHT,
              }
            })
            const existingIds = new Set(sanitized.map(p => p.id))
            const missing = DEFAULT_GM_WIDGETS.filter(d => !existingIds.has(d.id))
            return [...sanitized, ...missing]
          }
        }
      }
      catch {
        // Ignore parse error and fall back
      }
    }
    return DEFAULT_GM_WIDGETS.map(w => ({ ...w }))
  })

  function saveToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_GM_WIDGETS, JSON.stringify(widgets.value))
      }
      catch {
        // Ignore storage error
      }
    }
  }

  const activeWidgets = computed(() =>
    widgets.value.filter(widget => widget.enabled),
  )

  const activeWidgetIds = computed(() =>
    new Set(activeWidgets.value.map(w => w.id)),
  )

  const availableWidgets = computed(() =>
    GM_WIDGET_CATALOG.filter(meta => !activeWidgetIds.value.has(meta.id)),
  )

  function getWidgetMeta(id: GmWidgetId): GmWidgetMeta | undefined {
    return GM_WIDGET_CATALOG.find(w => w.id === id)
  }

  function isWidgetActive(id: GmWidgetId): boolean {
    return activeWidgetIds.value.has(id)
  }

  function toggleWidget(id: GmWidgetId, enabled?: boolean) {
    const idx = widgets.value.findIndex(w => w.id === id)
    if (idx !== -1) {
      const nextState = enabled !== undefined ? enabled : !widgets.value[idx]!.enabled
      widgets.value[idx]!.enabled = nextState
    }
    else {
      const meta = getWidgetMeta(id)
      widgets.value.push({
        id,
        enabled: enabled !== undefined ? enabled : true,
        colSpan: meta?.defaultSpan ?? 4,
        height: DEFAULT_GM_WIDGET_HEIGHT,
      })
    }
    widgets.value = [...widgets.value]
    saveToStorage()
  }

  function addWidget(id: GmWidgetId) {
    toggleWidget(id, true)
  }

  function removeWidget(id: GmWidgetId) {
    toggleWidget(id, false)
  }

  function setWidgetSpan(id: GmWidgetId, span: GmWidgetSpan) {
    const widget = widgets.value.find(w => w.id === id)
    if (widget) {
      widget.colSpan = span
      widgets.value = [...widgets.value]
      saveToStorage()
    }
  }

  function setWidgetHeight(id: GmWidgetId, height: number) {
    const clamped = Math.max(MIN_GM_WIDGET_HEIGHT, Math.min(MAX_GM_WIDGET_HEIGHT, Math.round(height)))
    const widget = widgets.value.find(w => w.id === id)
    if (widget) {
      widget.height = clamped
      widgets.value = [...widgets.value]
      saveToStorage()
    }
  }

  function setRowHeight(ids: GmWidgetId[], height: number) {
    const clamped = Math.max(MIN_GM_WIDGET_HEIGHT, Math.min(MAX_GM_WIDGET_HEIGHT, Math.round(height)))
    let updated = false
    for (const id of ids) {
      const widget = widgets.value.find(w => w.id === id)
      if (widget) {
        widget.height = clamped
        updated = true
      }
    }
    if (updated) {
      widgets.value = [...widgets.value]
      saveToStorage()
    }
  }

  function reorderActiveWidgets(activeIds: GmWidgetId[]) {
    const activeMap = new Map(activeWidgets.value.map(w => [w.id, w]))
    const newActiveList: GmWidgetItem[] = []

    for (const id of activeIds) {
      const item = activeMap.get(id)
      if (item) {
        newActiveList.push(item)
        activeMap.delete(id)
      }
    }
    for (const remaining of activeMap.values()) {
      newActiveList.push(remaining)
    }

    const inactiveList = widgets.value.filter(w => !w.enabled)
    widgets.value = [...newActiveList, ...inactiveList]
    saveToStorage()
  }

  function moveWidget(id: GmWidgetId, direction: 'up' | 'down') {
    // We reorder active widgets
    const activeList = [...activeWidgets.value]
    const activeIdx = activeList.findIndex(w => w.id === id)
    if (activeIdx === -1)
      return

    const targetIdx = direction === 'up' ? activeIdx - 1 : activeIdx + 1
    if (targetIdx < 0 || targetIdx >= activeList.length)
      return

    // Swap in active list
    const currentItem = activeList[activeIdx]!
    const targetItem = activeList[targetIdx]!
    activeList[activeIdx] = targetItem
    activeList[targetIdx] = currentItem

    // Rebuild full widgets array: preserve active order, keep inactive at the end
    const inactiveList = widgets.value.filter(w => !w.enabled)
    widgets.value = [...activeList, ...inactiveList]
    saveToStorage()
  }

  function resetToDefaults() {
    widgets.value = DEFAULT_GM_WIDGETS.map(w => ({ ...w }))
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY_GM_WIDGETS)
      }
      catch {
        // Ignore
      }
    }
  }

  const isCustomized = computed(() => {
    if (widgets.value.length !== DEFAULT_GM_WIDGETS.length)
      return true
    return widgets.value.some((w, i) => {
      const def = DEFAULT_GM_WIDGETS[i]
      return (
        !def
        || def.id !== w.id
        || def.enabled !== w.enabled
        || def.colSpan !== w.colSpan
        || (def.height ?? DEFAULT_GM_WIDGET_HEIGHT) !== (w.height ?? DEFAULT_GM_WIDGET_HEIGHT)
      )
    })
  })

  function openCustomizeModal() {
    isCustomizeModalOpen.value = true
  }

  function closeCustomizeModal() {
    isCustomizeModalOpen.value = false
  }

  return {
    widgets,
    activeWidgets,
    availableWidgets,
    isEditMode,
    isCustomizeModalOpen,
    openCustomizeModal,
    closeCustomizeModal,
    isCustomized,
    getWidgetMeta,
    isWidgetActive,
    toggleWidget,
    addWidget,
    removeWidget,
    setWidgetSpan,
    setWidgetHeight,
    setRowHeight,
    reorderActiveWidgets,
    moveWidget,
    resetToDefaults,
  }
}
