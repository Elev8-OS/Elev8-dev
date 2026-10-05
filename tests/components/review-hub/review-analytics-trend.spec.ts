import { describe, expect, it } from 'vitest'
import { useReviewAnalytics } from '~/composables/useReviewAnalytics'

describe('review analytics trend points', () => {
  it('keys both series by the selected window\'s weeks', () => {
    const a = useReviewAnalytics()
    a.periodPreset.value = 'custom'
    a.comparisonMode.value = 'previous_year'
    a.dateFrom.value = '2026-06-01'
    a.dateTo.value = '2026-07-31'

    const points = a.trendPoints.value
    expect(points.length).toBeGreaterThan(0)
    // No week from a year earlier on the axis: every point is inside the window.
    expect(points.every(p => p.period >= '2026-06-01' && p.period <= '2026-07-31')).toBe(true)
    // Both lines have values on the same weeks (the seed covers Jun 2025 to Aug 2026).
    expect(points.some(p => p.averageScore !== null && p.averageScoreComparison !== null)).toBe(true)
    expect(points.map(p => p.period)).toEqual([...points.map(p => p.period)].sort())
  })

  it('previous period comparison stays on the window\'s weeks too', () => {
    const a = useReviewAnalytics()
    a.periodPreset.value = 'custom'
    a.comparisonMode.value = 'previous_period'
    a.dateFrom.value = '2026-05-04'
    a.dateTo.value = '2026-06-02'
    const points = a.trendPoints.value
    expect(points.every(p => p.period >= '2026-05-04' && p.period <= '2026-06-02')).toBe(true)
    expect(points.some(p => p.averageScoreComparison !== null)).toBe(true)
  })
})
