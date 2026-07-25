// Owner Portal visibility permissions — what each owner is allowed to see
// inside their own portal. Two built-in templates ("full_transparency" and
// "financial_summary") cover most cases; "custom" lets staff flip individual
// fields per owner.
//
// This file is the SINGLE CANONICAL SOURCE for both the strict template
// field maps AND the seed normalization. Both `useOwners` and
// `useOwnerPermissions` read from it, so initialization order can never
// introduce drift between the two composables (the key `'elev8-owner-permissions'`
// is shared, but whichever composable runs first seeds storage with the
// same strict canonical view).

export type OwnerDashboardField
  = | 'grossRevenue'
    | 'netRevenue'
    | 'occupancy'
    | 'adr'
    | 'bookingSources'
    | 'upcomingReservations'
    | 'guestRatings'

export type OwnerStatementField
  = | 'revenueLines'
    | 'expenseDetails'
    | 'commissionDetails'
    | 'taxesAndFees'
    | 'adjustments'
    | 'netPayout'

export type OwnerPermissionTemplateId = 'full_transparency' | 'financial_summary' | 'custom'

export interface OwnerPermissionConfig {
  ownerId: string
  templateId: OwnerPermissionTemplateId
  dashboard: Record<OwnerDashboardField, boolean>
  statement: Record<OwnerStatementField, boolean>
  updatedAt: string
}

export const ownerDashboardFieldLabels: Record<OwnerDashboardField, string> = {
  grossRevenue: 'Gross Revenue',
  netRevenue: 'Net Revenue',
  occupancy: 'Occupancy',
  adr: 'ADR',
  bookingSources: 'Booking Sources',
  upcomingReservations: 'Upcoming Reservations',
  guestRatings: 'Guest Ratings',
}

export const ownerStatementFieldLabels: Record<OwnerStatementField, string> = {
  revenueLines: 'Revenue Lines',
  expenseDetails: 'Expense Details',
  commissionDetails: 'Commission Details',
  taxesAndFees: 'Taxes & Fees',
  adjustments: 'Adjustments',
  netPayout: 'Net Payout',
}

// --- Built-in permission templates -----------------------------------------
//
// These are the source-of-truth field maps that BOTH the `useState`
// initializer (via `normalizePermissionsSeed`) AND `applyTemplate` resolve
// from. Tests may mutate them in place to prove snapshot independence;
// the source-of-truth for "what does this template mean?" lives here.

interface OwnerPermissionTemplate {
  id: Exclude<OwnerPermissionTemplateId, 'custom'>
  dashboard: Record<OwnerDashboardField, boolean>
  statement: Record<OwnerStatementField, boolean>
}

const allDashboardFieldsOn: Record<OwnerDashboardField, boolean> = {
  grossRevenue: true,
  netRevenue: true,
  occupancy: true,
  adr: true,
  bookingSources: true,
  upcomingReservations: true,
  guestRatings: true,
}

const allStatementFieldsOn: Record<OwnerStatementField, boolean> = {
  revenueLines: true,
  expenseDetails: true,
  commissionDetails: true,
  taxesAndFees: true,
  adjustments: true,
  netPayout: true,
}

/**
 * Financial-summary template — strict per the brief: ONLY
 *   dashboard.netRevenue, dashboard.occupancy, dashboard.adr,
 *   statement.commissionDetails, statement.netPayout
 * are visible. Every other field is off.
 */
const financialSummaryDashboard: Record<OwnerDashboardField, boolean> = {
  grossRevenue: false,
  netRevenue: true,
  occupancy: true,
  adr: true,
  bookingSources: false,
  upcomingReservations: false,
  guestRatings: false,
}

const financialSummaryStatement: Record<OwnerStatementField, boolean> = {
  revenueLines: false,
  expenseDetails: false,
  commissionDetails: true,
  taxesAndFees: false,
  adjustments: false,
  netPayout: true,
}

export const ownerPermissionTemplates: OwnerPermissionTemplate[] = [
  {
    id: 'full_transparency',
    dashboard: { ...allDashboardFieldsOn },
    statement: { ...allStatementFieldsOn },
  },
  {
    id: 'financial_summary',
    dashboard: { ...financialSummaryDashboard },
    statement: { ...financialSummaryStatement },
  },
] as OwnerPermissionTemplate[] // mutable: tests prove snapshot semantics by mutating in place

// --- Canonical builder + seed normalization -------------------------------

/**
 * Build a fresh `OwnerPermissionConfig` from one of the two built-in
 * templates. `structuredClone` is used for the dashboard and statement
 * records so the resulting object never aliases the source array —
 * subsequent in-place mutations of `ownerPermissionTemplates` cannot leak
 * into already-stored configs.
 *
 * Both `useOwners` and `useOwnerPermissions` (and their tests) call into
 * this helper, so the produced config is identical regardless of call site.
 */
export function buildOwnerPermissionConfig(
  templateId: Exclude<OwnerPermissionTemplateId, 'custom'>,
  ownerId: string,
  updatedAt: string,
): OwnerPermissionConfig {
  const template = ownerPermissionTemplates.find(t => t.id === templateId)
  if (!template) {
    throw new Error(`Built-in permission template "${templateId}" not found.`)
  }
  return {
    ownerId,
    templateId,
    dashboard: structuredClone(template.dashboard),
    statement: structuredClone(template.statement),
    updatedAt,
  }
}

/**
 * Normalize a list of seed permission configs through the canonical
 * templates.
 *
 *   - Built-in template ids (`full_transparency`, `financial_summary`) are
 *     REPLACED with the strict canonical field map. This guards against the
 *     seed drifting — a looser data-layer row would still be tightened
 *     before it lands in storage.
 *   - `'custom'` template ids pass through unchanged (deep-cloned so the
 *     input array is not aliased).
 *
 * Both `useOwners.permissions` and `useOwnerPermissions.configs` call into
 * the same helper so the first writer of the shared `useState` key
 * (`'elev8-owner-permissions'`) seeds it with strict canonical configs.
 * Init-order drift is impossible.
 */
export function normalizePermissionsSeed(
  seeds: OwnerPermissionConfig[],
): OwnerPermissionConfig[] {
  return seeds.map((seed) => {
    if (seed.templateId === 'custom') {
      return structuredClone(seed)
    }
    return buildOwnerPermissionConfig(seed.templateId, seed.ownerId, seed.updatedAt)
  })
}

// --- Public factory retained for callers that don't need normalization -----

export function buildOwnerPermissionTemplate(
  templateId: OwnerPermissionTemplateId,
  ownerId: string,
  updatedAt: string,
): OwnerPermissionConfig {
  if (templateId === 'custom') {
    // 'custom' — start from the strict financial_summary as a sensible default.
    return buildOwnerPermissionConfig('financial_summary', ownerId, updatedAt)
  }
  return buildOwnerPermissionConfig(templateId, ownerId, updatedAt)
}

// --- Seed fixtures ----------------------------------------------------------

export const mockOwnerPermissions: OwnerPermissionConfig[] = [
  // Wayan opted into full transparency — sees everything.
  buildOwnerPermissionConfig('full_transparency', 'own-1', '2026-01-15T08:00:00.000Z'),
  // I Putu has the strict financial summary template.
  buildOwnerPermissionConfig('financial_summary', 'own-2', '2025-12-01T08:00:00.000Z'),
  // Ni Kadek is still invited; defaults to strict financial summary until she accepts.
  buildOwnerPermissionConfig('financial_summary', 'own-3', '2026-07-01T08:00:00.000Z'),
]
