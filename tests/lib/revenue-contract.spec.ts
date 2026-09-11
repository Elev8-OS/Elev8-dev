import { describe, expect, it } from 'vitest'
import {
  APPLY_PIPELINE,
  applyStepIndex,
  emptyPortfolioQuery,
  failedStepIndex,
  isTerminalApplyState,
  REVENUE_ENDPOINTS,
} from '~/components/revenue/data/contract'

describe('apply pipeline order', () => {
  it('runs snapshot first, because it is the undo and the measurement baseline', () => {
    expect(APPLY_PIPELINE[0]).toBe('snapshot')
    expect(APPLY_PIPELINE).toEqual([
      'snapshot',
      'saved',
      'written',
      'verified',
      'recomputed',
      'live',
    ])
  })

  it('reports progress as an index, and -1 before anything starts', () => {
    expect(applyStepIndex('idle')).toBe(-1)
    expect(applyStepIndex('snapshot')).toBe(0)
    expect(applyStepIndex('live')).toBe(5)
  })

  it('places a failure at the step that failed, not the last one reached', () => {
    // The recompute could not run, so 'recomputed' (index 4) is the failed step.
    expect(failedStepIndex('recompute_unavailable')).toBe(4)
    // The channel manager rejected the push, so 'live' (index 5) failed.
    expect(failedStepIndex('push_failed')).toBe(5)
    // Signals went stale before the write, so nothing past 'snapshot' ran.
    expect(failedStepIndex('stale')).toBe(0)
    expect(failedStepIndex('live')).toBeNull()
    expect(failedStepIndex('idle')).toBeNull()
  })

  it('treats live and every failure as terminal, and progress states as not', () => {
    expect(isTerminalApplyState('live')).toBe(true)
    expect(isTerminalApplyState('push_failed')).toBe(true)
    expect(isTerminalApplyState('recompute_unavailable')).toBe(true)
    expect(isTerminalApplyState('stale')).toBe(true)
    expect(isTerminalApplyState('written')).toBe(false)
    expect(isTerminalApplyState('idle')).toBe(false)
  })
})

describe('contract defaults', () => {
  it('defaults a portfolio query to revenue basis with no filters applied', () => {
    expect(emptyPortfolioQuery()).toEqual({
      basis: 'revenue',
      search: '',
      domain: 'all',
      minSeverity: 'all',
      gate: 'all',
    })
  })

  it('names one endpoint per port method, so the doc and the code cannot drift', () => {
    expect(REVENUE_ENDPOINTS).toEqual({
      getPortfolio: 'GET /api/revenue/portfolio',
      getRoomDiagnosis: 'GET /api/revenue/rooms/:roomId/diagnosis',
      getFinding: 'GET /api/revenue/findings/:findingId',
      applyFinding: 'POST /api/revenue/findings/:findingId/apply',
      getApplyStatus: 'GET /api/revenue/applies/:applyId',
      revertApply: 'POST /api/revenue/applies/:applyId/revert',
      dismissFinding: 'POST /api/revenue/findings/:findingId/dismiss',
      recheck: 'POST /api/revenue/recheck',
    })
  })
})
