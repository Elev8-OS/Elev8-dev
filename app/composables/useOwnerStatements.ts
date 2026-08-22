// Owner statement lifecycle composable.
//
// Owns the mutable statement store (drafts → published → frozen snapshot),
// issue log, next-period adjustment ledger, and mock export activity feed.
// Sits on top of the pure calculation helpers in `~/components/owners/data`
// (commission rules, ledger entries, statement totals) and is intentionally
// separate from `useOwners` so statement-side edits cannot accidentally
// mutate the ownership map and vice-versa.
//
// Invariants enforced here:
//   1. Generation is idempotent — calling `generateForPeriod(period)` twice
//      for the same (owner, listing, period) tuple is a no-op on the second
//      call. The seed drafts are honored as already-existing.
//   2. Publication freezes a deep-copy snapshot of the line items into
//      `publishedSnapshot`. Later edits to the live lines do not leak into
//      what the owner was originally shown.
//   3. Published statements are immutable — every financial-edit entry point
//      refuses to run unless `status === 'draft'`. Post-publication
//      corrections land as `OwnerStatementAdjustment` rows that point at the
//      published source instead.
//   4. One open issue per statement line. A second `raiseIssue` on the same
//      line returns the existing open issue (no duplicate row).
//   5. Post-publication corrections land as `OwnerStatementAdjustment` rows
//      pointing at the next period — they NEVER edit the frozen statement.
//      `recordAdjustment` derives `ownerId`, `listingId`, and `period` from
//      the published source so callers cannot point an adjustment at a
//      different tuple than the one they're amending.
//   6. `mockExport` is read-only against statements (it only appends to the
//      `exportActivity` feed) and returns after a short mock delay.
//   7. All generated IDs (statements / issues / adjustments / exports) are
//      collision-free across composable instances. Counters live inside the
//      closure so they never leak across tests, HMR reloads, or concurrent
//      instance use, and every candidate ID is checked against the live
//      store before being returned.
//   8. Every state-mutating entry point derives the "now" timestamp exactly
//      once per call (passed through builders) so related timestamps stay
//      aligned within a single generation / publish pass.
//
// Notifications:
//   * `OWNER_STATEMENT_DRAFT_READY` fires once per fresh draft after
//     `generateForPeriod` creates it.
//   * `OWNER_STATEMENT_PUBLISHED` fires once per `publish` success.
//   * `OWNER_ISSUE_RAISED` fires once per successful `raiseIssue`.

import type { AlertType } from '~/components/notifications/data/alerts'
import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type {
  OwnerLedgerEntry,
  StatementInput,
} from '~/components/owners/data/owner-ledger'
import type {
  OwnerIssueMessage,
  OwnerIssueResolution,
  OwnerStatement,
  OwnerStatementIssue,
  OwnerStatementLine,
} from '~/components/owners/data/owner-statements'
import type { Owner, OwnerPropertyMapping } from '~/components/owners/data/owners'
import { toRaw } from 'vue'
import {
  calculateCommission,
  commissionBasisLabel,
  findEffectiveCommissionRule,
  mockCommissionRules,
} from '~/components/owners/data/commission-rules'
import {
  calculateStatementTotals,
  ledgerEntryToStatementInput,
  mockOwnerLedgerEntries,
  roundCurrency,
} from '~/components/owners/data/owner-ledger'
import {
  buildStatementLines,
  mockOwnerStatements,
} from '~/components/owners/data/owner-statements'
import { mockOwnerPropertyMappings, mockOwners } from '~/components/owners/data/owners'
import { useNotifications } from '~/composables/useNotifications'

// --- Public types ----------------------------------------------------------

export type OwnerExportFormat = 'pdf' | 'xlsx'

export interface OwnerExportActivity {
  id: string
  format: OwnerExportFormat
  statementId: string
  ownerId: string
  ownerName: string
  listingId: string
  period: string
  actor: string
  createdAt: string
}

export interface OwnerStatementAdjustment {
  id: string
  ownerStatementId: string
  ownerId: string
  listingId: string
  /** Period of the published statement the correction refers to. */
  period: string
  /** Period the adjustment will appear against (typically `period + 1 month`). */
  nextPeriod: string
  amount: number
  reason: string
  createdAt: string
}

// --- Result envelopes ------------------------------------------------------

export type GenerateForPeriodResult
  = | { ok: true, created: number, skipped: number }
    | { ok: false, error: string }

export type PublishResult
  = | { ok: true }
    | { ok: false, reason: 'not_publishable' }

export type UpdateStatementLinesResult
  = | { ok: true, totalAmount: number }
    | { ok: false, reason: 'not_editable' }

export interface RaiseIssueInput {
  statementId: string
  lineId: string
  description: string
  amount: number
}

export type RaiseIssueResult
  = | { ok: true, issue: OwnerStatementIssue, existing: boolean }
    | { ok: false, reason: 'statement_not_found' | 'invalid_line' }

// --- Dispute thread (PRD 5.5.6) ------------------------------------------

export type AddIssueMessageResult
  = | { ok: true, issue: OwnerStatementIssue }
    | { ok: false, reason: 'issue_not_found' }

export interface ResolveIssueWithResolutionInput {
  issueId: string
  type: 'explained' | 'adjusted'
  resolvedBy: string
  note?: string
  /** When 'adjusted' and an adjustment record was created. */
  adjustmentId?: string
}

export type ResolveIssueWithResolutionResult
  = | { ok: true, issue: OwnerStatementIssue }
    | { ok: false, reason: 'issue_not_found' | 'already_resolved' }

/**
 * `recordAdjustment` derives `ownerId`, `listingId`, and `period` from the
 * published source statement (the only way to amend a published statement
 * is via that statement's identity), so the input shape is minimal: just
 * the source id, where the correction lands, the amount, and why.
 */
export interface RecordAdjustmentInput {
  ownerStatementId: string
  amount: number
  reason: string
}

export type RecordAdjustmentResult
  = | { ok: true, adjustment: OwnerStatementAdjustment }
    | { ok: false, reason: 'statement_not_found' | 'not_published' }

export interface MockExportInput {
  format: OwnerExportFormat
  statementId: string
  actor: string
}

export type MockExportResult
  = | { ok: true, activity: OwnerExportActivity }
    | { ok: false, reason: 'statement_not_found' }

// --- Constants -------------------------------------------------------------

const YYYY_MM_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/

function periodEndDate(period: string): string {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function nextPeriod(period: string): string {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Mock export delay. Short enough that tests do not hang, long enough to
 *  exercise any loading-state UI hooks the caller wires up.
 */
const MOCK_EXPORT_DELAY_MS = 60

// --- Pure helpers (module-private) -----------------------------------------

/**
 * Schema-safe plain-object clone that preserves structured nested values
 * (Date, Map, Set, ArrayBuffer, ...) while stripping Vue reactive proxies
 * and any function / symbol / computed-only properties that should never
 * leak into a frozen snapshot.
 *
 * Two steps:
 *   1. `toRaw(value)` walks Vue's reactive proxies and returns the raw
 *      underlying object — Date, Map, Set, plain objects, arrays all survive
 *      because Vue's Proxy intercepts property reads but `toRaw` strips it.
 *   2. `structuredClone(rawValue)` produces a fully detached copy that
 *      supports structured-cloneable nested types (Date, Map, Set,
 *      ArrayBuffer, ...) which a plain spread / JSON round-trip would lose.
 *
 * For raw inputs (no proxy) `toRaw` is a no-op — `clonePlain` works the
 * same way in tests (plain fixtures) and in production (Vue ref values).
 * The output is guaranteed to be free of any reactive linkage, so
 * downstream mutations cannot leak back into the input.
 */
function clonePlain<T>(value: T): T {
  // `toRaw` strips Vue's reactive Proxy (safe because Vue 3 returns the
  // underlying target object). It is a no-op for raw inputs, so plain
  // fixtures in tests clonePlain the same way as production ref values.
  return structuredClone(toRaw(value))
}

// --- Notifications --------------------------------------------------------
//
// `useNotifications().createAlert(type, severity, context)` accepts an
// `AlertType` from `~/components/notifications/data/alerts`. This composable
// narrows the owner-portal subset it actually emits.
//
// `useNotifications` is imported normally rather than resolved through
// `globalThis` so this composable behaves like every other composable in
// the repo (auto-imported by Nuxt in production, imported explicitly in
// tests via `vi.mock`). Tests install a spy on the `createAlert` method
// to prove the call path.

type OwnerStatementAlertType
  = | 'OWNER_STATEMENT_DRAFT_READY'
    | 'OWNER_STATEMENT_PUBLISHED'
    | 'OWNER_ISSUE_RAISED'
    | 'OWNER_ISSUE_RESPONDED'

function emitOwnerAlert(
  type: OwnerStatementAlertType,
  severity: 'CRITICAL' | 'WARNING' | 'INFO',
  context: Record<string, any>,
): void {
  const notif = useNotifications()
  notif.createAlert(type as AlertType, severity, context)
}

// --- Composable ------------------------------------------------------------

export function useOwnerStatements() {
  // --- State buckets ------------------------------------------------------
  // Each bucket lives on its own `useState` key so consumers can `useState`
  // directly when they only need one slice. Spread replacement only — never
  // mutate `.value` in place.
  const statements = useState<OwnerStatement[]>(
    'elev8-owner-statements',
    () => structuredClone(mockOwnerStatements),
  )
  const issues = useState<OwnerStatementIssue[]>(
    'elev8-owner-statement-issues',
    () => structuredClone(mockOwnerStatements.flatMap(statement => statement.issues)),
  )
  const adjustments = useState<OwnerStatementAdjustment[]>(
    'elev8-owner-statement-adjustments',
    () => [],
  )
  const exportActivity = useState<OwnerExportActivity[]>(
    'elev8-owner-export-activity',
    () => [],
  )

  // --- Collision-safe ID generator --------------------------------------
  //
  // UUIDs avoid timestamp/counter races when separate composable instances
  // create records concurrently. The live-store check remains as a defensive
  // guard around the generated value.
  function deriveUniqueId(
    prefix: string,
    isTaken: (id: string) => boolean,
  ): string {
    let id = ''
    do {
      id = `${prefix}-${globalThis.crypto.randomUUID()}`
    } while (isTaken(id))
    return id
  }

  function statementIdTaken(id: string): boolean {
    return statements.value.some(s => s.id === id)
  }
  function issueIdTaken(id: string): boolean {
    return issues.value.some(i => i.id === id)
  }
  function adjustmentIdTaken(id: string): boolean {
    return adjustments.value.some(a => a.id === id)
  }
  function exportIdTaken(id: string): boolean {
    return exportActivity.value.some(e => e.id === id)
  }

  function nowIso(): string {
    return new Date().toISOString()
  }

  function findStatement(statementId: string): OwnerStatement | undefined {
    return statements.value.find(s => s.id === statementId)
  }

  // --- Generate monthly drafts ------------------------------------------

  /**
   * Build deterministic draft statements for a `YYYY-MM` period.
   *
   * For every (active owner, listing) mapping whose `commissionRuleId` is
   * effective at the period end AND whose ledger has an entry for the
   * period, a draft statement is created with:
   *   - the owner-scoped ledger currency and amounts,
   *   - the exact commission rule referenced by the effective mapping,
   *   - no second ownership scaling because ledger rows are already keyed and
   *     calculated per owner.
   *
   * Idempotency: an existing (ownerId, listingId, period) statement in any
   * status is left alone — generation is a no-op for that tuple. This is
   * what makes the call safe to invoke from cron / dashboard buttons.
   *
   * All drafts minted by one call share the same `createdAt` timestamp
   * (derived once here and threaded through the builder), so dashboards
   * can rely on a single "month-end" instant rather than chasing ms-drift
   * between rows.
   */
  function generateForPeriod(period: string): GenerateForPeriodResult {
    if (!YYYY_MM_RE.test(period)) {
      return {
        ok: false,
        error: `Invalid period "${period}" — expected YYYY-MM (e.g. "2026-06").`,
      }
    }

    const owners = mockOwners
    const mappings = mockOwnerPropertyMappings
    const rules = mockCommissionRules
    const ledger = mockOwnerLedgerEntries

    const existingKeys = new Set(
      statements.value
        .filter(s => s.period === period)
        .map(s => `${s.ownerId}::${s.listingId}`),
    )
    const periodEnd = periodEndDate(period)

    let created = 0
    let skipped = 0
    const additions: OwnerStatement[] = []
    // Single timestamp for every draft this call produces — keeps
    // related rows aligned and eliminates ms-drift between the seed
    // builder and the alert-emission loop below.
    const createdAt = nowIso()

    for (const owner of owners) {
      if (owner.status !== 'active')
        continue

      const ownerMappings = mappings.filter(m => m.ownerId === owner.id)
      for (const mapping of ownerMappings) {
        const mappingIsEffective = mapping.effectiveFrom <= periodEnd
          && (mapping.effectiveTo === undefined || mapping.effectiveTo >= periodEnd)
        if (!mappingIsEffective) {
          skipped += 1
          continue
        }

        const key = `${owner.id}::${mapping.listingId}`
        if (existingKeys.has(key)) {
          skipped += 1
          continue
        }

        const entry = ledger.find(
          e => e.ownerId === owner.id
            && e.listingId === mapping.listingId
            && e.period === period
            && !e.isPriorPeriodAdjustment,
        )
        if (!entry) {
          // No financial activity for this (owner, listing, period) — nothing to draft.
          skipped += 1
          continue
        }

        const referencedRule = rules.find(candidate => candidate.id === mapping.commissionRuleId)
        const rule = referencedRule
          ? findEffectiveCommissionRule(
              [referencedRule],
              owner.id,
              mapping.listingId,
              period,
            )
          : undefined
        if (!rule) {
          // A mapping without an effective commission rule is a configuration
          // gap — skip rather than emit a draft with a zero commission.
          skipped += 1
          continue
        }

        const draft = buildDraftFromLedger(
          owner,
          mapping,
          entry,
          rule,
          createdAt,
          () => deriveUniqueId('stmt', statementIdTaken),
        )
        additions.push(draft)
        existingKeys.add(key)
        created += 1
      }
    }

    if (additions.length > 0) {
      statements.value = [...statements.value, ...additions]
      for (const draft of additions) {
        emitOwnerAlert('OWNER_STATEMENT_DRAFT_READY', 'INFO', {
          statementId: draft.id,
          ownerId: draft.ownerId,
          listingId: draft.listingId,
          period: draft.period,
          currency: draft.currency,
        })
      }
    }

    return { ok: true, created, skipped }
  }

  // --- Publish -----------------------------------------------------------

  /**
   * Freeze a statement into a published statement (from draft or preview).
   *   Rejects when the statement is missing or already published.
   *   Replaces `lines`/`totalAmount`/`currency` in `publishedSnapshot`
   *     via the schema-safe `clonePlain` helper — mutating the live lines
   *     later cannot leak into what the owner was shown.
   *
   * The publish timestamp is captured once and shared by both the snapshot
   * metadata and the alert context so they refer to the same instant.
   */
  function publish(statementId: string, publishedBy: string): PublishResult {
    const current = findStatement(statementId)
    if (!current || (current.status !== 'draft' && current.status !== 'in_preview')) {
      return { ok: false, reason: 'not_publishable' }
    }

    const snapshot = {
      lines: clonePlain(current.lines),
      totalAmount: current.totalAmount,
      currency: current.currency,
    }
    const publishedAt = nowIso()
    statements.value = statements.value.map(item => item.id === statementId
      ? {
          ...item,
          status: 'published' as const,
          publishedSnapshot: snapshot,
          publishedAt,
          publishedBy,
        }
      : item,
    )

    emitOwnerAlert('OWNER_STATEMENT_PUBLISHED', 'INFO', {
      statementId: current.id,
      ownerId: current.ownerId,
      listingId: current.listingId,
      period: current.period,
      currency: current.currency,
      publishedBy,
    })

    return { ok: true }
  }

  /**
   * Move a draft into preview (PRD 5.5.1). Staff review the statement exactly
   * as the owner will see it, add pre-publish adjustments, then publish.
   */
  function moveToPreview(statementId: string): { ok: boolean } {
    const current = findStatement(statementId)
    if (!current || current.status !== 'draft')
      return { ok: false }
    statements.value = statements.value.map(item => item.id === statementId
      ? { ...item, status: 'in_preview' as const }
      : item)
    return { ok: true }
  }

  /** Back out of preview into draft (adjustment edits only allowed in draft). */
  function backToDraft(statementId: string): { ok: boolean } {
    const current = findStatement(statementId)
    if (!current || current.status !== 'in_preview')
      return { ok: false }
    statements.value = statements.value.map(item => item.id === statementId
      ? { ...item, status: 'draft' as const }
      : item)
    return { ok: true }
  }

  // --- Edit guard --------------------------------------------------------

  /**
   * Replace the line items on a statement. Refuses when the statement is
   * missing or already published — published financial values are immutable.
   * Recomputes `totalAmount` from the signed sum of the new lines.
   */
  function updateStatementLines(
    statementId: string,
    lines: OwnerStatementLine[],
  ): UpdateStatementLinesResult {
    const current = findStatement(statementId)
    if (!current || (current.status !== 'draft' && current.status !== 'in_preview')) {
      return { ok: false, reason: 'not_editable' }
    }
    const clonedLines = lines.map(l => ({ ...l }))
    const totalAmount = roundCurrency(
      clonedLines.reduce((sum, line) => sum + line.amount, 0),
    )
    statements.value = statements.value.map(item => item.id === statementId
      ? { ...item, lines: clonedLines, totalAmount }
      : item,
    )
    return { ok: true, totalAmount }
  }

  // --- Issues ------------------------------------------------------------

  /**
   * Raise an issue against a specific line. Returns the existing open issue
   * for the (statement, line) tuple when one already exists — that is the
   * "one open issue per line" rule the brief calls out.
   */
  function raiseIssue(input: RaiseIssueInput): RaiseIssueResult {
    const statement = findStatement(input.statementId)
    if (!statement) {
      return { ok: false, reason: 'statement_not_found' }
    }

    if (!statement.lines.some(line => line.id === input.lineId)) {
      return { ok: false, reason: 'invalid_line' }
    }

    const existingOpen = issues.value.find(
      i => i.statementId === input.statementId
        && i.lineId === input.lineId
        && !i.resolvedAt,
    )
    if (existingOpen) {
      return { ok: true, issue: existingOpen, existing: true }
    }

    const issue: OwnerStatementIssue = {
      id: deriveUniqueId('sti', issueIdTaken),
      statementId: input.statementId,
      lineId: input.lineId,
      description: input.description,
      amount: input.amount,
      createdAt: nowIso(),
    }
    issues.value = [...issues.value, issue]
    statements.value = statements.value.map(item => item.id === statement.id
      ? { ...item, issues: [...item.issues, issue] }
      : item,
    )

    emitOwnerAlert('OWNER_ISSUE_RAISED', 'WARNING', {
      statementId: issue.statementId,
      lineId: issue.lineId,
      ownerId: statement.ownerId,
      listingId: statement.listingId,
      period: statement.period,
      amount: issue.amount,
    })

    return { ok: true, issue, existing: false }
  }

  /** Stamp `resolvedAt` on an open issue. */
  function resolveIssue(issueId: string): { ok: boolean } {
    const target = issues.value.find(i => i.id === issueId)
    if (!target)
      return { ok: false }

    const resolvedAt = nowIso()
    issues.value = issues.value.map(i => i.id === issueId
      ? { ...i, resolvedAt }
      : i,
    )
    statements.value = statements.value.map(statement => ({
      ...statement,
      issues: statement.issues.map(issue => issue.id === issueId
        ? { ...issue, resolvedAt }
        : issue),
    }))
    return { ok: true }
  }

  // --- Dispute thread (PRD 5.5.6) ---------------------------------------

  /**
   * Append a message to a line-item dispute thread (PRD 5.5.6). The thread
   * stays attached to the issue after resolution — it is never deleted.
   */
  function addIssueMessage(issueId: string, author: 'owner' | 'staff', message: string): AddIssueMessageResult {
    const target = issues.value.find(i => i.id === issueId)
    if (!target)
      return { ok: false, reason: 'issue_not_found' }

    const entry: OwnerIssueMessage = {
      id: deriveUniqueId('ist', issueIdTaken),
      author,
      at: nowIso(),
      message,
    }
    const thread = [...(target.thread ?? []), entry]
    const updated = { ...target, thread }
    issues.value = issues.value.map(i => i.id === issueId ? updated : i)
    statements.value = statements.value.map(statement => ({
      ...statement,
      issues: statement.issues.map(issue => issue.id === issueId
        ? { ...issue, thread }
        : issue),
    }))

    // Notify the other party (PRD 5.5.7) — owner → staff, staff → owner.
    emitOwnerAlert('OWNER_ISSUE_RESPONDED', 'INFO', {
      issueId,
      statementId: target.statementId,
      author,
      message,
    })

    return { ok: true, issue: updated }
  }

  /**
   * Close a dispute with an explicit resolution type (PRD 5.5.6):
   * 'explained' = staff clarified, no amount change; 'adjusted' = the amount
   * was corrected (optionally via an adjustment record).
   */
  function resolveIssueWithResolution(input: ResolveIssueWithResolutionInput): ResolveIssueWithResolutionResult {
    const target = issues.value.find(i => i.id === input.issueId)
    if (!target)
      return { ok: false, reason: 'issue_not_found' }
    if (target.resolvedAt)
      return { ok: false, reason: 'already_resolved' }

    const resolvedAt = nowIso()
    const resolution: OwnerIssueResolution = {
      type: input.type,
      resolvedBy: input.resolvedBy,
      resolvedAt,
      note: input.note,
      adjustmentId: input.adjustmentId,
    }
    const updated = { ...target, resolvedAt, resolution }
    issues.value = issues.value.map(i => i.id === input.issueId ? updated : i)
    statements.value = statements.value.map(statement => ({
      ...statement,
      issues: statement.issues.map(issue => issue.id === input.issueId
        ? { ...issue, resolvedAt, resolution }
        : issue),
    }))
    return { ok: true, issue: updated }
  }

  // --- Next-period adjustments ------------------------------------------

  /**
   * Record an adjustment against an already-published statement. Refuses
   * when the source statement is missing or still a draft — adjustments
   * exist to amend what the owner was *already told*, so they cannot be
   * filed against an unpublished statement.
   *
   * The adjustment's `ownerId`, `listingId`, and `period` are derived from
   * the published source rather than read off caller input — the input
   * shape intentionally does not include those fields, so a caller cannot
   * accidentally point an adjustment at a different (owner, listing,
   * period) tuple than the one they're amending.
   */
  function recordAdjustment(input: RecordAdjustmentInput): RecordAdjustmentResult {
    const source = statements.value.find(s => s.id === input.ownerStatementId)
    if (!source) {
      return { ok: false, reason: 'statement_not_found' }
    }
    if (source.status !== 'published') {
      return { ok: false, reason: 'not_published' }
    }

    // Derive ownerId / listingId / period from the published source. Read
    // directly off the (possibly reactive) proxy — the proxy's get trap
    // returns the underlying value, which for the seed fixtures always
    // includes ownerId / listingId / period.
    const adjustment: OwnerStatementAdjustment = {
      id: deriveUniqueId('osa', adjustmentIdTaken),
      ownerStatementId: source.id,
      ownerId: source.ownerId,
      listingId: source.listingId,
      period: source.period,
      nextPeriod: nextPeriod(source.period),
      amount: input.amount,
      reason: input.reason,
      createdAt: nowIso(),
    }
    adjustments.value = [...adjustments.value, adjustment]
    return { ok: true, adjustment }
  }

  // --- Mock export ------------------------------------------------------

  /**
   * Simulate a PDF / XLSX export. Records an activity entry with the
   * format, statement, actor, owner, listing, and period, then resolves
   * after `MOCK_EXPORT_DELAY_MS`. Read-only — does not mutate statements.
   */
  async function mockExport(input: MockExportInput): Promise<MockExportResult> {
    const statement = findStatement(input.statementId)
    if (!statement) {
      return { ok: false, reason: 'statement_not_found' }
    }

    const owner = mockOwners.find(o => o.id === statement.ownerId)
    const activity: OwnerExportActivity = {
      id: deriveUniqueId('exa', exportIdTaken),
      format: input.format,
      statementId: statement.id,
      ownerId: statement.ownerId,
      ownerName: owner?.name ?? '',
      listingId: statement.listingId,
      period: statement.period,
      actor: input.actor,
      createdAt: nowIso(),
    }

    await new Promise<void>(resolve => setTimeout(resolve, MOCK_EXPORT_DELAY_MS))

    exportActivity.value = [...exportActivity.value, activity]
    return { ok: true, activity }
  }

  // --- Read helpers -----------------------------------------------------

  /**
   * Return all draft statements for dashboard / list views.
   *
   * Sorted by `period` descending (newest month first) with `id` ascending as
   * a tiebreaker for stable ordering across re-renders. Always returns a
   * freshly-sliced array so callers may sort further without aliasing storage.
   */
  function computeDrafts(): OwnerStatement[] {
    return statements.value
      .filter(s => s.status === 'draft' || s.status === 'in_preview')
      .slice()
      .sort((a, b) => {
        if (a.period === b.period)
          return a.id.localeCompare(b.id)
        return b.period.localeCompare(a.period)
      })
  }

  // --- Return -----------------------------------------------------------

  return {
    // State
    statements,
    issues,
    adjustments,
    exportActivity,
    // Lifecycle
    generateForPeriod,
    moveToPreview,
    backToDraft,
    publish,
    updateStatementLines,
    // Issues
    raiseIssue,
    resolveIssue,
    addIssueMessage,
    resolveIssueWithResolution,
    // Corrections
    recordAdjustment,
    // Exports
    mockExport,
    // Reads
    computeDrafts,
  }
}

// --- Pure builder (module-private) -----------------------------------------

/**
 * Compute the lines + totalAmount for one (owner, mapping, ledger, rule)
 * tuple. Shared by `generateForPeriod`; kept module-private so callers
 * outside this file cannot accidentally bypass the public entry points.
 *
 * `createdAt` and `nextStatementId` are threaded in from the caller
 * (rather than captured here) so:
 *   - every draft produced by one generation pass shares the same instant,
 *   - the ID factory stays closure-local to the composable instance.
 *
 * See the "single source of `nowIso` per generation" + "per-instance
 * collision-free IDs" invariants in the composable header.
 */
function buildDraftFromLedger(
  owner: Owner,
  mapping: OwnerPropertyMapping,
  entry: OwnerLedgerEntry,
  rule: CommissionRule,
  createdAt: string,
  nextStatementId: () => string,
): OwnerStatement {
  // PRD 5.1 — commission basis: 'net' rules apply the rate to net revenue
  // (gross − expenses − taxes − platform fees), 'gross' rules to gross.
  // Itemised component amounts let calculateCommission subtract exactly the
  // deductions the rule's checkbox basis selected.
  const netRevenue = entry.grossRevenue - entry.expenses - entry.taxes - entry.platformFees
  const commission = calculateCommission(rule, entry.grossRevenue, {
    netRevenue,
    operatingExpenses: entry.expenses,
    taxes: entry.taxes,
    platformFees: entry.platformFees,
  })
  const input: StatementInput = ledgerEntryToStatementInput(entry, commission)
  const lines = buildStatementLines(input)
  const totals = calculateStatementTotals(input)
  // Round line amounts so what the UI displays is the source of truth.
  const roundedLines: OwnerStatementLine[] = lines.map((line) => {
    // Label the commission line with its basis so the owner never has to
    // ask "20% from what?" (PRD 5.6 correction #1).
    if (line.category === 'commission' && rule.type !== 'tiered') {
      return {
        ...line,
        label: `Management commission (${commissionBasisLabel(rule)})`,
      }
    }
    return { ...line, amount: roundCurrency(line.amount) }
  })
  const totalAmount = roundCurrency(totals.netPayout)
  return {
    id: nextStatementId(),
    ownerId: owner.id,
    listingId: mapping.listingId,
    period: entry.period,
    currency: entry.currency,
    status: 'draft',
    lines: roundedLines,
    totalAmount,
    createdAt,
    issues: [],
  }
}
