/**
 * The real adapter. Not wired up: `useRevenueSource` returns the mock until
 * these endpoints exist. Kept compiling so the contract cannot drift from a
 * plausible implementation.
 */
import type {
  ApplyAccepted,
  ApplyRequest,
  ApplyStatus,
  DismissRequest,
  HealthFinding,
  PortfolioQuery,
  PortfolioResponse,
  RecheckAccepted,
  RecheckRequest,
  RevenueDataSource,
  RoomDiagnosis,
} from './contract'

const BASE = '/api/revenue'

export function createHttpRevenueSource(): RevenueDataSource {
  return {
    getPortfolio: (query: PortfolioQuery) =>
      $fetch<PortfolioResponse>(`${BASE}/portfolio`, { query }),

    getRoomDiagnosis: (roomId: string) =>
      $fetch<RoomDiagnosis | null>(`${BASE}/rooms/${encodeURIComponent(roomId)}/diagnosis`),

    getFinding: (findingId: string) =>
      $fetch<HealthFinding | null>(`${BASE}/findings/${encodeURIComponent(findingId)}`),

    applyFinding: (req: ApplyRequest) =>
      $fetch<ApplyAccepted>(`${BASE}/findings/${encodeURIComponent(req.findingId)}/apply`, {
        method: 'POST',
        // `scenario` is a mock-only affordance (see ApplyRequest in
        // contract.ts) — a real backend receives and ignores it.
        body: { fieldLabels: req.fieldLabels ?? [], basis: req.basis, scenario: req.scenario },
      }),

    getApplyStatus: (applyId: string) =>
      $fetch<ApplyStatus>(`${BASE}/applies/${encodeURIComponent(applyId)}`),

    revertApply: (applyId: string) =>
      $fetch<void>(`${BASE}/applies/${encodeURIComponent(applyId)}/revert`, { method: 'POST' }),

    dismissFinding: (req: DismissRequest) =>
      $fetch<void>(`${BASE}/findings/${encodeURIComponent(req.findingId)}/dismiss`, {
        method: 'POST',
        body: { reason: req.reason, suppressForDays: req.suppressForDays },
      }),

    recheck: (req: RecheckRequest) =>
      $fetch<RecheckAccepted>(`${BASE}/recheck`, { method: 'POST', body: req }),
  }
}
