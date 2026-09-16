import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GM_WIDGETS,
  getWidgetSpanClass,
  STORAGE_KEY_GM_WIDGETS,
  useGmDashboardWidgets,
} from '~/composables/useGmDashboardWidgets'

describe('useGmDashboardWidgets', () => {
  beforeEach(() => {
    // Reset any localStorage mocks
    localStorage.clear()
    const { resetToDefaults } = useGmDashboardWidgets()
    resetToDefaults()
  })

  it('initializes with default widgets active in the expected order', () => {
    const { activeWidgets, availableWidgets, isCustomized } = useGmDashboardWidgets()

    expect(isCustomized.value).toBe(false)
    expect(activeWidgets.value.map(w => w.id)).toEqual([
      'kpis',
      'occupancy_flow',
      'sentiment_panel',
      'revenue_trend',
      'bookings_panel',
    ])

    // Operations summary and quick actions are in catalog and available to add
    expect(availableWidgets.value.map(w => w.id)).toContain('operations_summary')
    expect(availableWidgets.value.map(w => w.id)).toContain('quick_actions')
  })

  it('maps spans to correct responsive CSS grid classes', () => {
    expect(getWidgetSpanClass(12)).toContain('col-span-12')
    expect(getWidgetSpanClass(8)).toContain('col-span-8')
    expect(getWidgetSpanClass(6)).toContain('col-span-6')
    expect(getWidgetSpanClass(4)).toContain('col-span-4')
  })

  it('can remove an active widget', () => {
    const { activeWidgets, removeWidget, isCustomized, availableWidgets } = useGmDashboardWidgets()

    expect(activeWidgets.value.some(w => w.id === 'sentiment_panel')).toBe(true)

    removeWidget('sentiment_panel')

    expect(activeWidgets.value.some(w => w.id === 'sentiment_panel')).toBe(false)
    expect(availableWidgets.value.some(w => w.id === 'sentiment_panel')).toBe(true)
    expect(isCustomized.value).toBe(true)
  })

  it('can add an available widget to the dashboard', () => {
    const { activeWidgets, addWidget, availableWidgets } = useGmDashboardWidgets()

    expect(availableWidgets.value.some(w => w.id === 'operations_summary')).toBe(true)

    addWidget('operations_summary')

    expect(activeWidgets.value.some(w => w.id === 'operations_summary')).toBe(true)
    expect(availableWidgets.value.some(w => w.id === 'operations_summary')).toBe(false)
  })

  it('can adjust the column span of a widget', () => {
    const { activeWidgets, setWidgetSpan, isCustomized } = useGmDashboardWidgets()

    const occupancy = activeWidgets.value.find(w => w.id === 'occupancy_flow')
    expect(occupancy?.colSpan).toBe(8)

    setWidgetSpan('occupancy_flow', 12)

    const updated = activeWidgets.value.find(w => w.id === 'occupancy_flow')
    expect(updated?.colSpan).toBe(12)
    expect(isCustomized.value).toBe(true)
  })

  it('allows KPI cards widget to be set to 2/3 width (span 8) as well as full width', () => {
    const { activeWidgets, setWidgetSpan, getWidgetMeta } = useGmDashboardWidgets()

    const kpiMeta = getWidgetMeta('kpis')
    expect(kpiMeta?.allowedSpans).toContain(8)
    expect(kpiMeta?.allowedSpans).toContain(12)

    const kpis = activeWidgets.value.find(w => w.id === 'kpis')
    expect(kpis?.colSpan).toBe(12)

    // Set KPIs to 2/3 width (span 8)
    setWidgetSpan('kpis', 8)

    const updated = activeWidgets.value.find(w => w.id === 'kpis')
    expect(updated?.colSpan).toBe(8)
  })

  it('allows widgets to freely resize to all 1-12 columns', () => {
    const { activeWidgets, setWidgetSpan, getWidgetMeta } = useGmDashboardWidgets()

    const occupancyMeta = getWidgetMeta('occupancy_flow')
    expect(occupancyMeta?.allowedSpans).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    // Test setting various column spans across 1 to 12
    for (const span of [1, 2, 3, 5, 7, 9, 10, 11] as const) {
      setWidgetSpan('occupancy_flow', span)
      const updated = activeWidgets.value.find(w => w.id === 'occupancy_flow')
      expect(updated?.colSpan).toBe(span)
      expect(getWidgetSpanClass(span)).toContain(`col-span-${span}`)
    }
  })

  it('can reorder widgets up and down', () => {
    const { activeWidgets, moveWidget } = useGmDashboardWidgets()

    const initialOrder = activeWidgets.value.map(w => w.id)
    expect(initialOrder[1]).toBe('occupancy_flow')
    expect(initialOrder[2]).toBe('sentiment_panel')

    // Move sentiment_panel up
    moveWidget('sentiment_panel', 'up')

    const newOrder = activeWidgets.value.map(w => w.id)
    expect(newOrder[1]).toBe('sentiment_panel')
    expect(newOrder[2]).toBe('occupancy_flow')

    // Moving up when already at top does nothing
    moveWidget(newOrder[0]!, 'up')
    expect(activeWidgets.value.map(w => w.id)[0]).toBe(newOrder[0])
  })

  it('can reorder active widgets directly via reorderActiveWidgets', () => {
    const { activeWidgets, reorderActiveWidgets } = useGmDashboardWidgets()

    const newOrder: ('kpis' | 'sentiment_panel' | 'occupancy_flow' | 'bookings_panel' | 'revenue_trend')[] = [
      'sentiment_panel',
      'kpis',
      'bookings_panel',
      'occupancy_flow',
      'revenue_trend',
    ]

    reorderActiveWidgets(newOrder)

    expect(activeWidgets.value.map(w => w.id)).toEqual(newOrder)
  })

  it('can set widget height with min/max clamping', () => {
    const { activeWidgets, setWidgetHeight, isCustomized } = useGmDashboardWidgets()

    setWidgetHeight('occupancy_flow', 480)
    const updated = activeWidgets.value.find(w => w.id === 'occupancy_flow')
    expect(updated?.height).toBe(480)
    expect(isCustomized.value).toBe(true)

    // Clamps below min (240)
    setWidgetHeight('occupancy_flow', 100)
    expect(activeWidgets.value.find(w => w.id === 'occupancy_flow')?.height).toBe(240)

    // Clamps above max (720)
    setWidgetHeight('occupancy_flow', 999)
    expect(activeWidgets.value.find(w => w.id === 'occupancy_flow')?.height).toBe(720)
  })

  it('can synchronize row height across multiple widgets', () => {
    const { activeWidgets, setRowHeight } = useGmDashboardWidgets()

    setRowHeight(['occupancy_flow', 'sentiment_panel'], 460)

    expect(activeWidgets.value.find(w => w.id === 'occupancy_flow')?.height).toBe(460)
    expect(activeWidgets.value.find(w => w.id === 'sentiment_panel')?.height).toBe(460)
  })

  it('resets layout to defaults on request', () => {
    const { activeWidgets, removeWidget, resetToDefaults, isCustomized } = useGmDashboardWidgets()

    removeWidget('revenue_trend')
    expect(isCustomized.value).toBe(true)

    resetToDefaults()

    expect(isCustomized.value).toBe(false)
    expect(activeWidgets.value.map(w => w.id)).toEqual(
      DEFAULT_GM_WIDGETS.filter(w => w.enabled).map(w => w.id),
    )
  })

  it('persists changes to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const { addWidget } = useGmDashboardWidgets()

    addWidget('quick_actions')

    expect(setItemSpy).toHaveBeenCalledWith(
      STORAGE_KEY_GM_WIDGETS,
      expect.stringContaining('quick_actions'),
    )
    setItemSpy.mockRestore()
  })
})
