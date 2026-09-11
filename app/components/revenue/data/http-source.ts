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
      $fetch<RoomDiagnosis | null>(`${BASE}/rooms/${roomId}/diagnosis`),

    getFinding: (findingId: string) =>
      $fetch<HealthFinding | null>(`${BASE}/findings/${findingId}`),

    applyFinding: (req: ApplyRequest) =>
      $fetch<ApplyAccepted>(`${BASE}/findings/${req.findingId}/apply`, {
        method: 'POST',
        body: { fieldLabels: req.fieldLabels ?? [], basis: req.basis },
      }),

    getApplyStatus: (applyId: string) =>
      $fetch<ApplyStatus>(`${BASE}/applies/${applyId}`),

    revertApply: (applyId: string) =>
      $fetch<void>(`${BASE}/applies/${applyId}/revert`, { method: 'POST' }),

    dismissFinding: (req: DismissRequest) =>
      $fetch<void>(`${BASE}/findings/${req.findingId}/dismiss`, {
        method: 'POST',
        body: { reason: req.reason, suppressForDays: req.suppressForDays },
      }),

    recheck: (req: RecheckRequest) =>
      $fetch<RecheckAccepted>(`${BASE}/recheck`, { method: 'POST', body: req }),
  }
}
