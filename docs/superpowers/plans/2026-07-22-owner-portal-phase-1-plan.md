# Owner Portal Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive, isolated Owner Portal with tenant-side owner management, deterministic monthly statements, field permissions, owner self-stays, mock magic-link authentication, and branded owner-facing pages.

**Architecture:** A shared typed Owner domain feeds two UI surfaces: tenant staff routes under `/owners` and `/owner-statements`, and a separately laid-out owner realm under `/owner-portal`. Focused composables own business rules and expose owner-scoped selectors; all integration boundaries remain explicit mocks.

**Tech Stack:** Nuxt 3/4, Vue 3, TypeScript, shadcn-vue/Reka UI, Tailwind CSS v4, vue-sonner, Vitest, Vue Test Utils, pnpm.

---

## File Structure

### Create

```text
app/components/owners/data/owners.ts
app/components/owners/data/commission-rules.ts
app/components/owners/data/owner-permissions.ts
app/components/owners/data/owner-statements.ts
app/components/owners/data/owner-stays.ts
app/components/owners/data/owner-ledger.ts
app/components/owners/data/index.ts
app/components/owners/OwnersKpis.vue
app/components/owners/OwnerFilters.vue
app/components/owners/OwnersTable.vue
app/components/owners/OwnerOnboardingDialog.vue
app/components/owners/OwnerOnboardingBasics.vue
app/components/owners/OwnerOnboardingAssignments.vue
app/components/owners/OwnerOnboardingPermissions.vue
app/components/owners/OwnerDetailSheet.vue
app/components/owners/OwnerPermissionMatrix.vue
app/components/owners/CommissionRuleEditor.vue
app/components/owner-statements/StatementsKpis.vue
app/components/owner-statements/StatementFilters.vue
app/components/owner-statements/StatementsTable.vue
app/components/owner-statements/StatementDetailSheet.vue
app/components/owner-statements/StatementPublishDialog.vue
app/components/owner-statements/GenerateDraftsButton.vue
app/components/owner-portal/PortalSidebar.vue
app/components/owner-portal/PortalHeader.vue
app/components/owner-portal/PortalMagicLinkForm.vue
app/components/owner-portal/PortalPropertyPicker.vue
app/components/owner-portal/PortalDashboard.vue
app/components/owner-portal/PortalStatementsArchive.vue
app/components/owner-portal/PortalStatementDetail.vue
app/components/owner-portal/PortalRaiseIssueDialog.vue
app/components/owner-portal/PortalStays.vue
app/components/owner-portal/PortalStayDialog.vue
app/components/owner-portal/PortalSyncStatus.vue
app/composables/useOwners.ts
app/composables/useOwnerPermissions.ts
app/composables/useOwnerStatements.ts
app/composables/useOwnerStays.ts
app/composables/useOwnerAuth.ts
app/composables/useOwnerPortal.ts
app/layouts/owner-portal.vue
app/middleware/owner-portal.global.ts
app/pages/owners/index.vue
app/pages/owner-statements/index.vue
app/pages/owner-portal/login.vue
app/pages/owner-portal/index.vue
app/pages/owner-portal/statements/index.vue
app/pages/owner-portal/statements/[id].vue
app/pages/owner-portal/stays.vue
tests/lib/owner-commissions.spec.ts
tests/lib/owner-ledger.spec.ts
tests/composables/useOwners.spec.ts
tests/composables/useOwnerPermissions.spec.ts
tests/composables/useOwnerStatements.spec.ts
tests/composables/useOwnerStays.spec.ts
tests/composables/useOwnerAuth.spec.ts
tests/composables/useOwnerPortal.spec.ts
tests/components/owners/OwnerOnboardingDialog.spec.ts
tests/components/owner-statements/StatementPublishDialog.spec.ts
tests/components/owner-portal/PortalMagicLinkForm.spec.ts
tests/components/owner-portal/PortalStatementDetail.spec.ts
tests/components/owner-portal/PortalStayDialog.spec.ts
```

### Modify

```text
app/constants/menus.ts
app/components/notifications/data/alerts.ts
app/components/operations-calendar/data/operations-calendar.ts
CLAUDE.md
```

Do not modify `app/components/users/data/roles.ts`: the existing `role-owner` is an internal staff role and must remain separate from external portal owners.

---

### Task 1: Define the Owner domain and deterministic fixtures

**Files:**
- Create: `app/components/owners/data/owners.ts`
- Create: `app/components/owners/data/commission-rules.ts`
- Create: `app/components/owners/data/owner-permissions.ts`
- Create: `app/components/owners/data/owner-statements.ts`
- Create: `app/components/owners/data/owner-stays.ts`
- Create: `app/components/owners/data/owner-ledger.ts`
- Create: `app/components/owners/data/index.ts`

- [ ] **Step 1: Define external-owner types and seeds**

Use independent external owner records and mappings:

```ts
export type OwnerStatus = 'draft' | 'invited' | 'active' | 'inactive'
export type OwnerLanguage = 'en' | 'id'
export type StatementCurrency = 'IDR' | 'USD' | 'AUD' | 'SGD' | 'EUR'

export interface Owner {
  id: string
  name: string
  email: string
  phone: string
  language: OwnerLanguage
  statementCurrency: StatementCurrency
  status: OwnerStatus
  annualOwnerUseNightCap?: number
  invitedAt?: string
  activatedAt?: string
  createdAt: string
  updatedAt: string
}

export interface OwnerPropertyMapping {
  id: string
  ownerId: string
  listingId: string
  unitId?: string
  ownershipPercentage: number
  commissionRuleId: string
  effectiveFrom: string
  effectiveTo?: string
}
```

Seed at least three owners:

- one active single-property owner
- one active multi-property owner
- one invited co-owner sharing a property with the first owner

Keep ownership totals at or below 100% and include one owner-use cap.

- [ ] **Step 2: Define commission, permission, statement, stay, and ledger contracts**

```ts
export interface CommissionTier {
  upTo: number | null
  rate: number
}

export type CommissionRule =
  | { id: string; ownerId: string; listingId: string; name: string; type: 'flat'; rate: number; effectiveFrom: string; effectiveTo?: string }
  | { id: string; ownerId: string; listingId: string; name: string; type: 'tiered'; tiers: CommissionTier[]; effectiveFrom: string; effectiveTo?: string }
  | { id: string; ownerId: string; listingId: string; name: string; type: 'hybrid'; fixedAmount: number; rate: number; effectiveFrom: string; effectiveTo?: string }

export type OwnerDashboardField = 'grossRevenue' | 'netRevenue' | 'occupancy' | 'adr' | 'bookingSources' | 'upcomingReservations' | 'guestRatings'
export type OwnerStatementField = 'revenueLines' | 'expenseDetails' | 'commissionDetails' | 'taxesAndFees' | 'adjustments' | 'netPayout'

export interface OwnerPermissionConfig {
  ownerId: string
  templateId: 'full_transparency' | 'financial_summary' | 'custom'
  dashboard: Record<OwnerDashboardField, boolean>
  statement: Record<OwnerStatementField, boolean>
  updatedAt: string
}
```

Define statements with draft/published status, categorized lines, frozen publication snapshot, and optional issue records. Define stays with `active | cancelled` and three sync states (`cockpit`, `channex`, `notifications`) using `pending | synced | failed`.

- [ ] **Step 3: Add deterministic ledger fixtures**

Store monthly entries by owner, listing, and `YYYY-MM` period with gross revenue, expenses, taxes, booking sources, occupied nights, available nights, ADR inputs, ratings, and upcoming reservations. Include one prior-period adjustment fixture.

- [ ] **Step 4: Add barrel exports and run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS with no new TypeScript errors.

- [ ] **Step 5: Commit the domain foundation**

```bash
git add app/components/owners/data
git commit -m "feat(owner-portal): add owner domain models"
```

---

### Task 2: Implement pure commission and statement calculations with TDD

**Files:**
- Create: `tests/lib/owner-commissions.spec.ts`
- Create: `tests/lib/owner-ledger.spec.ts`
- Modify: `app/components/owners/data/commission-rules.ts`
- Modify: `app/components/owners/data/owner-statements.ts`
- Modify: `app/components/owners/data/owner-ledger.ts`

- [ ] **Step 1: Write failing commission tests**

Cover flat, progressive tiered, hybrid, effective dates, and ownership share:

```ts
import { describe, expect, it } from 'vitest'
import { calculateCommission, findEffectiveCommissionRule } from '@/components/owners/data/commission-rules'

it('calculates flat commission', () => {
  expect(calculateCommission({ type: 'flat', rate: 15 }, 10_000)).toBe(1_500)
})

it('calculates progressive tiers', () => {
  const rule = {
    type: 'tiered' as const,
    tiers: [
      { upTo: 10_000, rate: 10 },
      { upTo: 20_000, rate: 15 },
      { upTo: null, rate: 20 },
    ],
  }
  expect(calculateCommission(rule, 25_000)).toBe(3_750)
})

it('calculates hybrid commission', () => {
  expect(calculateCommission({ type: 'hybrid', fixedAmount: 500, rate: 10 }, 10_000)).toBe(1_500)
})
```

- [ ] **Step 2: Run tests and verify red state**

Run:

```bash
pnpm vitest run tests/lib/owner-commissions.spec.ts
```

Expected: FAIL because calculation exports do not exist.

- [ ] **Step 3: Implement pure commission helpers**

```ts
export type CommissionCalculationRule =
  | Pick<Extract<CommissionRule, { type: 'flat' }>, 'type' | 'rate'>
  | Pick<Extract<CommissionRule, { type: 'tiered' }>, 'type' | 'tiers'>
  | Pick<Extract<CommissionRule, { type: 'hybrid' }>, 'type' | 'fixedAmount' | 'rate'>

export function calculateCommission(rule: CommissionCalculationRule, revenue: number): number {
  if (rule.type === 'flat') return revenue * rule.rate
  if (rule.type === 'hybrid') return rule.fixedAmount + revenue * rule.rate

  let remaining = revenue
  let lowerBound = 0
  let total = 0

  for (const tier of rule.tiers) {
    const band = tier.upTo === null ? remaining : Math.min(remaining, tier.upTo - lowerBound)
    total += Math.max(0, band) * tier.rate
    remaining -= Math.max(0, band)
    if (tier.upTo !== null) lowerBound = tier.upTo
    if (remaining <= 0) break
  }

  return total
}
```

Implement `findEffectiveCommissionRule(rules, ownerId, listingId, period)` by choosing the rule whose effective interval contains the period end.

- [ ] **Step 4: Write failing ledger tests**

Test calculation order:

```ts
expect(calculateStatementTotals({
  grossRevenue: 10_000,
  operatingExpenses: 1_000,
  commission: 1_500,
  taxesAndFees: 500,
  adjustments: -250,
})).toEqual({
  grossRevenue: 10_000,
  operatingExpenses: 1_000,
  commission: 1_500,
  taxesAndFees: 500,
  adjustments: -250,
  netPayout: 6_750,
})
```

Also assert that a 40% ownership share applies to all property amounts before owner totals.

- [ ] **Step 5: Run ledger tests and verify red state**

```bash
pnpm vitest run tests/lib/owner-ledger.spec.ts
```

Expected: FAIL because ledger calculation helpers do not exist.

- [ ] **Step 6: Implement statement total helpers**

Use pure functions for `applyOwnershipShare`, `calculateStatementTotals`, and `buildStatementLines`. Round currency to two decimals at the domain boundary.

- [ ] **Step 7: Run focused tests**

```bash
pnpm vitest run tests/lib/owner-commissions.spec.ts tests/lib/owner-ledger.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Commit calculations**

```bash
git add app/components/owners/data tests/lib
git commit -m "feat(owner-portal): add statement calculations"
```

Review fixes may add a follow-up commit; each fix must rerun the focused tests before the task reviewer re-checks the complete task diff.

---

### Task 3: Implement owner CRUD and ownership guardrails with TDD

**Files:**
- Create: `tests/composables/useOwners.spec.ts`
- Create: `app/composables/useOwners.ts`

- [ ] **Step 1: Write failing composable tests**

Test:

- seeded owner summaries
- duplicate email detection is case-insensitive
- owner creation uses replacement mutation
- assignment is rejected when active ownership exceeds 100%
- assignment succeeds at exactly 100%
- invite, activate, deactivate, and reactivate transitions
- search, status, and property filters

Use the repository test setup to reset the shared `useState` map before each test.

- [ ] **Step 2: Run the failing test**

```bash
pnpm vitest run tests/composables/useOwners.spec.ts
```

Expected: FAIL because `useOwners` does not exist.

- [ ] **Step 3: Implement the composable API**

```ts
export interface SaveOwnerInput {
  owner: Omit<Owner, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  mappings: Omit<OwnerPropertyMapping, 'id' | 'ownerId'>[]
  commissionRules: Omit<CommissionRule, 'id' | 'ownerId'>[]
  permissions: OwnerPermissionConfig
  inviteNow: boolean
}

export function useOwners() {
  const owners = useState<Owner[]>('elev8-tenant-owners', () => structuredClone(seedOwners))
  const mappings = useState<OwnerPropertyMapping[]>('elev8-owner-property-mappings', () => structuredClone(seedOwnerMappings))
  const commissionRules = useState<CommissionRule[]>('elev8-owner-commission-rules', () => structuredClone(seedCommissionRules))
  const search = useState('elev8-owner-search', () => '')
  const statusFilter = useState<OwnerStatus | 'all'>('elev8-owner-status-filter', () => 'all')
  const propertyFilter = useState<string>('elev8-owner-property-filter', () => 'all')

  function validateOwnership(mapping: Omit<OwnerPropertyMapping, 'id'>, excludeMappingId?: string) {
    const allocated = mappings.value
      .filter(item => item.listingId === mapping.listingId && item.unitId === mapping.unitId && item.id !== excludeMappingId)
      .reduce((sum, item) => sum + item.ownershipPercentage, 0)
    return { valid: allocated + mapping.ownershipPercentage <= 100, allocated }
  }

  return { owners, mappings, commissionRules, search, statusFilter, propertyFilter, validateOwnership }
}
```

Complete CRUD and computed filters using spread replacement, not direct mutation.

- [ ] **Step 4: Run focused tests**

```bash
pnpm vitest run tests/composables/useOwners.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit owner state**

```bash
git add app/composables/useOwners.ts tests/composables/useOwners.spec.ts
git commit -m "feat(owner-portal): add owner management state"
```

---

### Task 4: Implement permission templates and snapshots with TDD

**Files:**
- Create: `tests/composables/useOwnerPermissions.spec.ts`
- Create: `app/composables/useOwnerPermissions.ts`

- [ ] **Step 1: Write failing tests**

Assert:

- Full Transparency enables all fields.
- Financial Summary enables only net revenue, occupancy, ADR, commission summary, and net payout.
- Applying a template creates a copied owner config.
- Editing a template object later does not mutate existing owner configs.
- A custom field update changes only the target owner.

- [ ] **Step 2: Verify tests fail**

```bash
pnpm vitest run tests/composables/useOwnerPermissions.spec.ts
```

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement snapshot semantics**

```ts
export function useOwnerPermissions() {
  const configs = useState<OwnerPermissionConfig[]>('elev8-owner-permissions', () => structuredClone(seedOwnerPermissions))

  function applyTemplate(ownerId: string, templateId: OwnerPermissionTemplateId) {
    const template = permissionTemplates.find(item => item.id === templateId)
    if (!template) throw new Error('Permission template not found')

    const next: OwnerPermissionConfig = {
      ownerId,
      templateId,
      dashboard: { ...template.dashboard },
      statement: { ...template.statement },
      updatedAt: new Date().toISOString(),
    }
    configs.value = [...configs.value.filter(item => item.ownerId !== ownerId), next]
    return next
  }

  function canViewDashboardField(ownerId: string, field: OwnerDashboardField) {
    return configs.value.find(item => item.ownerId === ownerId)?.dashboard[field] ?? false
  }

  function canViewStatementField(ownerId: string, field: OwnerStatementField) {
    return configs.value.find(item => item.ownerId === ownerId)?.statement[field] ?? false
  }

  return { configs, applyTemplate, canViewDashboardField, canViewStatementField }
}
```

Add custom update functions that copy nested records.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run tests/composables/useOwnerPermissions.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit permission behavior**

```bash
git add app/composables/useOwnerPermissions.ts tests/composables/useOwnerPermissions.spec.ts
git commit -m "feat(owner-portal): add owner field permissions"
```

---

### Task 5: Implement statement lifecycle, adjustments, issues, and mock exports with TDD

**Files:**
- Create: `tests/composables/useOwnerStatements.spec.ts`
- Create: `app/composables/useOwnerStatements.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Cover:

- monthly generation creates one draft per owner/property mapping
- repeated generation for the same period is idempotent
- mixed commission rules produce deterministic totals
- publishing deep-copies a snapshot and sets publication metadata
- published financial values cannot be edited
- post-publication correction creates next-period adjustment
- one open issue per statement line
- mock PDF/XLSX export records activity and returns success after loading

- [ ] **Step 2: Run failing tests**

```bash
pnpm vitest run tests/composables/useOwnerStatements.spec.ts
```

Expected: FAIL because `useOwnerStatements` does not exist.

- [ ] **Step 3: Implement lifecycle API**

```ts
export function useOwnerStatements() {
  const statements = useState<OwnerStatement[]>('elev8-owner-statements', () => structuredClone(seedOwnerStatements))
  const issues = useState<OwnerStatementIssue[]>('elev8-owner-statement-issues', () => structuredClone(seedOwnerStatementIssues))
  const adjustments = useState<OwnerStatementAdjustment[]>('elev8-owner-statement-adjustments', () => structuredClone(seedOwnerAdjustments))
  const exportActivity = useState<OwnerExportActivity[]>('elev8-owner-export-activity', () => [])

  function generateForPeriod(period: string) {
    // Validate YYYY-MM, map active owner assignments, select effective rules,
    // build deterministic lines, and skip existing owner/listing/period tuples.
  }

  function publish(statementId: string, publishedBy: string) {
    const current = statements.value.find(item => item.id === statementId)
    if (!current || current.status !== 'draft') return { ok: false, reason: 'not_publishable' as const }
    const snapshot = structuredClone({ lines: current.lines, totals: current.totals })
    statements.value = statements.value.map(item => item.id === statementId
      ? { ...item, status: 'published', snapshot, publishedAt: new Date().toISOString(), publishedBy }
      : item)
    return { ok: true as const }
  }

  return { statements, issues, adjustments, exportActivity, generateForPeriod, publish }
}
```

Implement immutable update guards by rejecting financial edits unless status is `draft`. `raiseIssue` returns the existing open issue for duplicates. `mockExport` uses a short timeout and records format, owner, statement, actor, and timestamp.

- [ ] **Step 4: Wire notifications through `useNotifications().createAlert`**

Generating creates `OWNER_STATEMENT_DRAFT_READY`; publishing creates `OWNER_STATEMENT_PUBLISHED`; raising an issue creates `OWNER_ISSUE_RAISED`.

- [ ] **Step 5: Run statement tests**

```bash
pnpm vitest run tests/composables/useOwnerStatements.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit statement lifecycle**

```bash
git add app/composables/useOwnerStatements.ts tests/composables/useOwnerStatements.spec.ts
git commit -m "feat(owner-portal): add owner statement lifecycle"
```

---

### Task 6: Implement owner-stay conflicts, cap warnings, and sync states with TDD

**Files:**
- Create: `tests/composables/useOwnerStays.spec.ts`
- Create: `app/composables/useOwnerStays.ts`

- [ ] **Step 1: Write failing date and lifecycle tests**

Test:

- `[checkIn, checkOut)` overlap logic
- same-day turnover does not conflict
- guest reservation, blocked date, and active owner stay conflicts
- cancelled stays are ignored
- modify excludes the current stay
- create is blocked by conflict
- cap exceedance warns but still creates
- mock sync failure preserves the stay and exposes retry
- cancellation releases dates

- [ ] **Step 2: Verify red state**

```bash
pnpm vitest run tests/composables/useOwnerStays.spec.ts
```

Expected: FAIL because `useOwnerStays` does not exist.

- [ ] **Step 3: Implement pure overlap and conflict helpers**

```ts
export function dateRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd
}

export function countNights(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00Z`)
  const end = Date.parse(`${checkOut}T00:00:00Z`)
  return Math.max(0, Math.round((end - start) / 86_400_000))
}
```

- [ ] **Step 4: Implement composable operations**

Expose:

```ts
{
  stays,
  detectConflicts,
  createStay,
  updateStay,
  cancelStay,
  retrySync,
  ownerUseNightsForYear,
  getCapWarning,
}
```

Every operation replaces the array. Mock downstream sync saves three independent statuses. On a mocked failure, keep the stay and set the failed integration only.

- [ ] **Step 5: Emit owner stay notifications**

- confirmed create/modify → `OWNER_STAY_CONFIRMED`
- conflict → `OWNER_STAY_CONFLICT`
- cap exceeded → `OWNER_USE_CAP_EXCEEDED`

- [ ] **Step 6: Run stay tests**

```bash
pnpm vitest run tests/composables/useOwnerStays.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit stay domain**

```bash
git add app/composables/useOwnerStays.ts tests/composables/useOwnerStays.spec.ts
git commit -m "feat(owner-portal): add owner stay management"
```

---

### Task 7: Implement mock owner auth and owner-scoped selectors with TDD

**Files:**
- Create: `tests/composables/useOwnerAuth.spec.ts`
- Create: `tests/composables/useOwnerPortal.spec.ts`
- Create: `app/composables/useOwnerAuth.ts`
- Create: `app/composables/useOwnerPortal.ts`

- [ ] **Step 1: Write failing auth tests**

Test generic link-sent response, seeded-owner secure-link acceptance, invalid token rejection, reactive session, and logout.

- [ ] **Step 2: Write failing isolation tests**

Seed two owners who co-own one property. Authenticate Owner A and assert that selectors expose only Owner A’s mappings, commission rules, statements, issues, and stays. Assert that the returned API does not contain `allOwners`, `allMappings`, `allStatements`, or `allIssues`.

- [ ] **Step 3: Verify red state**

```bash
pnpm vitest run tests/composables/useOwnerAuth.spec.ts tests/composables/useOwnerPortal.spec.ts
```

Expected: FAIL because both composables are missing.

- [ ] **Step 4: Implement the mock auth API**

```ts
export function useOwnerAuth() {
  const session = useState<OwnerSession | null>('elev8-owner-portal-session', () => null)
  const pendingEmail = useState<string | null>('elev8-owner-pending-email', () => null)
  const isAuthenticated = computed(() => Boolean(session.value?.ownerId))

  async function requestMagicLink(email: string) {
    pendingEmail.value = email.trim().toLowerCase()
    await new Promise(resolve => setTimeout(resolve, 500))
    return { sent: true as const }
  }

  function acceptDemoLink() {
    const owner = seedOwners.find(item => item.email.toLowerCase() === pendingEmail.value && item.status !== 'inactive')
    if (!owner) return { ok: false as const }
    session.value = { ownerId: owner.id, authenticatedAt: new Date().toISOString() }
    return { ok: true as const, ownerId: owner.id }
  }

  function logout() {
    session.value = null
    pendingEmail.value = null
  }

  return { session, pendingEmail, isAuthenticated, requestMagicLink, acceptDemoLink, logout }
}
```

The displayed response remains generic even when the email is not seeded.

- [ ] **Step 5: Implement owner-scoped selectors**

`useOwnerPortal` reads `session.ownerId` internally and returns only:

```ts
{
  currentOwner,
  assignedMappings,
  assignedProperties,
  commissionRules,
  visibleStatements,
  myStays,
  myIssues,
  dashboardMetrics,
  canViewDashboardField,
  canViewStatementField,
}
```

Apply owner filtering before property and period filters.

- [ ] **Step 6: Run auth and isolation tests**

```bash
pnpm vitest run tests/composables/useOwnerAuth.spec.ts tests/composables/useOwnerPortal.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the owner realm state**

```bash
git add app/composables/useOwnerAuth.ts app/composables/useOwnerPortal.ts tests/composables/useOwnerAuth.spec.ts tests/composables/useOwnerPortal.spec.ts
git commit -m "feat(owner-portal): isolate owner portal data"
```

---

### Task 8: Add notification types and operations-calendar owner events

**Files:**
- Modify: `app/components/notifications/data/alerts.ts`
- Modify: `app/components/operations-calendar/data/operations-calendar.ts`
- Test: `tests/composables/useOwnerStatements.spec.ts`
- Test: `tests/composables/useOwnerStays.spec.ts`

- [ ] **Step 1: Extend notification contracts**

Add:

```ts
| 'OWNER_STATEMENT_DRAFT_READY'
| 'OWNER_STATEMENT_PUBLISHED'
| 'OWNER_STAY_CONFIRMED'
| 'OWNER_STAY_CONFLICT'
| 'OWNER_ISSUE_RAISED'
| 'OWNER_USE_CAP_EXCEEDED'
```

Add display labels, icons, routes, and descriptions. Staff-facing routes are `/owner-statements` or `/owners`; portal-side actions use `/owner-portal/statements` or `/owner-portal/stays` through alert context.

- [ ] **Step 2: Add owner stay calendar event type**

Extend `CalendarEventType` with `'owner_stay'`. Add label and tone entries and a pure `buildOwnerStayEvents(stays)` helper that maps active stays to all-day events without including cancelled records.

- [ ] **Step 3: Add focused assertions to existing tests**

Verify that publish, issue, conflict, confirmation, and cap actions append the correct alert type and that cancelled stays do not become calendar events.

- [ ] **Step 4: Run affected tests**

```bash
pnpm vitest run tests/composables/useOwnerStatements.spec.ts tests/composables/useOwnerStays.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit integration wiring**

```bash
git add app/components/notifications/data/alerts.ts app/components/operations-calendar/data/operations-calendar.ts tests/composables/useOwnerStatements.spec.ts tests/composables/useOwnerStays.spec.ts
git commit -m "feat(owner-portal): wire owner notifications and calendar"
```

---

### Task 9: Build tenant-side Owner directory and onboarding

**Files:**
- Create: `app/components/owners/OwnersKpis.vue`
- Create: `app/components/owners/OwnerFilters.vue`
- Create: `app/components/owners/OwnersTable.vue`
- Create: `app/components/owners/OwnerOnboardingDialog.vue`
- Create: `app/components/owners/OwnerOnboardingBasics.vue`
- Create: `app/components/owners/OwnerOnboardingAssignments.vue`
- Create: `app/components/owners/OwnerOnboardingPermissions.vue`
- Create: `app/components/owners/CommissionRuleEditor.vue`
- Create: `app/components/owners/OwnerPermissionMatrix.vue`
- Create: `app/components/owners/OwnerDetailSheet.vue`
- Create: `app/pages/owners/index.vue`
- Create: `tests/components/owners/OwnerOnboardingDialog.spec.ts`

- [ ] **Step 1: Write failing onboarding component tests**

Mount the dialog with seeded composables and verify:

- Step 1 blocks missing/duplicate email.
- Step 2 blocks ownership above 100%.
- Step 2 validates flat, tiered, and hybrid inputs.
- Step 3 applies a template, supports field customization, and submits with invite-now status.
- Cancel resets the draft.

- [ ] **Step 2: Run the test and verify failure**

```bash
pnpm vitest run tests/components/owners/OwnerOnboardingDialog.spec.ts
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Build the three-step dialog**

Use shadcn `Dialog`, `Stepper`, `Input`, `Select`, `Switch`, `Button`, `Badge`, `ScrollArea`, and `Separator`. Keep the body as `flex-1 min-h-0`. Use `model-value` and `@update:model-value` for Reka controls.

The parent owns one typed draft:

```ts
interface OwnerOnboardingDraft {
  basics: {
    name: string
    email: string
    phone: string
    language: OwnerLanguage
    statementCurrency: StatementCurrency
  }
  mappings: OwnerMappingDraft[]
  permissionTemplateId: OwnerPermissionTemplateId
  permissionOverrides: OwnerPermissionConfig
  inviteNow: boolean
}
```

Child steps emit copied updates rather than mutating props.

- [ ] **Step 4: Build owner list, KPIs, filters, and detail sheet**

The page displays Total Owners, Active, Invited, and Properties Assigned. The table shows owner identity, properties, ownership, commission type, currency, status, and actions. The detail sheet includes Overview, Properties & Commission, Permissions, and Statements tabs.

- [ ] **Step 5: Run component test and typecheck**

```bash
pnpm vitest run tests/components/owners/OwnerOnboardingDialog.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit tenant owner management UI**

```bash
git add app/components/owners app/pages/owners tests/components/owners
git commit -m "feat(owner-portal): add owner onboarding interface"
```

---

### Task 10: Build tenant-side statement review and publication

**Files:**
- Create: `app/components/owner-statements/StatementsKpis.vue`
- Create: `app/components/owner-statements/StatementFilters.vue`
- Create: `app/components/owner-statements/StatementsTable.vue`
- Create: `app/components/owner-statements/StatementDetailSheet.vue`
- Create: `app/components/owner-statements/StatementPublishDialog.vue`
- Create: `app/components/owner-statements/GenerateDraftsButton.vue`
- Create: `app/pages/owner-statements/index.vue`
- Create: `tests/components/owner-statements/StatementPublishDialog.spec.ts`

- [ ] **Step 1: Write failing publication dialog tests**

Assert:

- a draft displays calculated lines and totals
- confirmation is required
- duplicate clicks are disabled while publishing
- successful publish closes the dialog, locks values, and emits a toast
- a published statement has no editable controls

- [ ] **Step 2: Verify failure**

```bash
pnpm vitest run tests/components/owner-statements/StatementPublishDialog.spec.ts
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Build the statement page and components**

Use period, status, owner, and property filters. Tabs separate Draft and Published. `GenerateDraftsButton` calls `generateForPeriod`; the table opens `StatementDetailSheet`; publish uses `AlertDialog` or a confirmation `Dialog`.

Render calculation in this order:

```text
Gross booking revenue
Operating expenses
Management commission
Taxes and fees
Prior-period adjustments
Net owner payout
```

Show open issue badges on both table and detail.

- [ ] **Step 4: Run tests and typecheck**

```bash
pnpm vitest run tests/components/owner-statements/StatementPublishDialog.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit statement staff UI**

```bash
git add app/components/owner-statements app/pages/owner-statements tests/components/owner-statements
git commit -m "feat(owner-portal): add statement review interface"
```

---

### Task 11: Build branded portal layout, route guard, and magic-link login

**Files:**
- Create: `app/components/owner-portal/PortalSidebar.vue`
- Create: `app/components/owner-portal/PortalHeader.vue`
- Create: `app/components/owner-portal/PortalMagicLinkForm.vue`
- Create: `app/layouts/owner-portal.vue`
- Create: `app/middleware/owner-portal.global.ts`
- Create: `app/pages/owner-portal/login.vue`
- Create: `tests/components/owner-portal/PortalMagicLinkForm.spec.ts`

- [ ] **Step 1: Write failing login tests**

Assert the generic link-sent state, loading guard, seeded demo secure-link success, invalid demo email behavior without account enumeration, and logout session clearing.

- [ ] **Step 2: Verify failure**

```bash
pnpm vitest run tests/components/owner-portal/PortalMagicLinkForm.spec.ts
```

Expected: FAIL because the portal login component does not exist.

- [ ] **Step 3: Implement global route guard**

```ts
export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/owner-portal')) return
  if (to.path === '/owner-portal/login') return

  const { isAuthenticated } = useOwnerAuth()
  if (!isAuthenticated.value) return navigateTo('/owner-portal/login')
})
```

- [ ] **Step 4: Build the owner layout**

Use `useTenantBranding()` for logo and favicon. Apply scoped CSS variables derived from `branding.guestGuideColors`. Sidebar links: Overview, Statements, My Stays. Header includes current owner name and Sign out. The login page uses the same layout without sidebar navigation.

- [ ] **Step 5: Build the magic-link form**

Use email input, loading state, generic success copy, and demo Open Secure Link action. On successful acceptance, navigate to `/owner-portal`.

- [ ] **Step 6: Run login tests and typecheck**

```bash
pnpm vitest run tests/components/owner-portal/PortalMagicLinkForm.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit portal shell and auth**

```bash
git add app/components/owner-portal/PortalSidebar.vue app/components/owner-portal/PortalHeader.vue app/components/owner-portal/PortalMagicLinkForm.vue app/layouts/owner-portal.vue app/middleware/owner-portal.global.ts app/pages/owner-portal/login.vue tests/components/owner-portal/PortalMagicLinkForm.spec.ts
git commit -m "feat(owner-portal): add branded owner login"
```

---

### Task 12: Build owner dashboard with property and permission scoping

**Files:**
- Create: `app/components/owner-portal/PortalPropertyPicker.vue`
- Create: `app/components/owner-portal/PortalDashboard.vue`
- Create: `app/pages/owner-portal/index.vue`
- Modify: `tests/composables/useOwnerPortal.spec.ts`

- [ ] **Step 1: Add failing dashboard-selector tests**

Assert:

- selector appears only with more than one mapped property
- selecting a property narrows all metrics
- co-owned revenue is multiplied by ownership percentage
- owner-use nights remain separate
- hidden fields are absent from the metric output

- [ ] **Step 2: Verify failure**

```bash
pnpm vitest run tests/composables/useOwnerPortal.spec.ts
```

Expected: FAIL on the new dashboard assertions.

- [ ] **Step 3: Implement dashboard metric selectors**

Return a list of permitted metric descriptors rather than raw data:

```ts
interface OwnerDashboardMetric {
  key: OwnerDashboardField
  label: string
  value: string
  change?: string
}
```

Compute booking sources, upcoming reservations, and ratings from the deterministic owner ledger. Do not include hidden keys.

- [ ] **Step 4: Build the dashboard UI**

Use responsive KPI cards, a booking-source summary, upcoming reservations, ratings, and a distinct Owner-Use Nights card. Use `PortalPropertyPicker` only for multi-property owners.

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm vitest run tests/composables/useOwnerPortal.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit owner dashboard**

```bash
git add app/components/owner-portal/PortalPropertyPicker.vue app/components/owner-portal/PortalDashboard.vue app/pages/owner-portal/index.vue tests/composables/useOwnerPortal.spec.ts
git commit -m "feat(owner-portal): add scoped owner dashboard"
```

---

### Task 13: Build owner statement archive, detail, mock exports, and issue flag

**Files:**
- Create: `app/components/owner-portal/PortalStatementsArchive.vue`
- Create: `app/components/owner-portal/PortalStatementDetail.vue`
- Create: `app/components/owner-portal/PortalRaiseIssueDialog.vue`
- Create: `app/pages/owner-portal/statements/index.vue`
- Create: `app/pages/owner-portal/statements/[id].vue`
- Create: `tests/components/owner-portal/PortalStatementDetail.spec.ts`

- [ ] **Step 1: Write failing portal statement tests**

Assert:

- only current owner’s published statements render
- hidden field groups are not in the DOM
- published values are read-only
- PDF/XLSX actions show loading and success feedback without downloading files
- Raise Issue creates one open issue for the selected line
- a duplicate issue opens the existing issue state

- [ ] **Step 2: Verify failure**

```bash
pnpm vitest run tests/components/owner-portal/PortalStatementDetail.spec.ts
```

Expected: FAIL because portal statement components do not exist.

- [ ] **Step 3: Build archive and detail pages**

Archive columns respect field permissions. The detail page resolves the statement through `useOwnerPortal`; if the ID is not visible to the current owner, display a 404-style empty state rather than searching global state.

- [ ] **Step 4: Build mock exports and issue dialog**

Two buttons call `mockExport(statementId, 'pdf' | 'xlsx')`, show a spinner, then toast success. The issue dialog requires a line and note and uses `raiseIssue`.

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm vitest run tests/components/owner-portal/PortalStatementDetail.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit owner statements UI**

```bash
git add app/components/owner-portal/PortalStatementsArchive.vue app/components/owner-portal/PortalStatementDetail.vue app/components/owner-portal/PortalRaiseIssueDialog.vue app/pages/owner-portal/statements tests/components/owner-portal/PortalStatementDetail.spec.ts
git commit -m "feat(owner-portal): add owner statement archive"
```

---

### Task 14: Build My Stays calendar/list and stay dialog

**Files:**
- Create: `app/components/owner-portal/PortalStays.vue`
- Create: `app/components/owner-portal/PortalStayDialog.vue`
- Create: `app/components/owner-portal/PortalSyncStatus.vue`
- Create: `app/pages/owner-portal/stays.vue`
- Create: `tests/components/owner-portal/PortalStayDialog.spec.ts`

- [ ] **Step 1: Write failing stay dialog tests**

Assert:

- selected dates are validated before confirmation
- conflict details block create
- same-day turnover succeeds
- cap warning permits confirmation
- successful create shows Cockpit/Channex/notification statuses
- modify reruns conflict check
- cancel releases dates
- failed sync exposes Retry

- [ ] **Step 2: Verify failure**

```bash
pnpm vitest run tests/components/owner-portal/PortalStayDialog.spec.ts
```

Expected: FAIL because stay UI components do not exist.

- [ ] **Step 3: Build stay calendar/list view**

Show owner-scoped active and cancelled stays. Use existing calendar/date primitives and map active owner stays to `owner_stay` events. Provide create, edit, cancel, and retry actions.

- [ ] **Step 4: Build the create/edit dialog**

Fields: property/room, check-in, check-out, notes. Run `detectConflicts` before save. Render destructive conflict details or a warning cap banner. Keep confirmation disabled during save/sync.

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm vitest run tests/components/owner-portal/PortalStayDialog.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit My Stays UI**

```bash
git add app/components/owner-portal/PortalStays.vue app/components/owner-portal/PortalStayDialog.vue app/components/owner-portal/PortalSyncStatus.vue app/pages/owner-portal/stays.vue tests/components/owner-portal/PortalStayDialog.spec.ts
git commit -m "feat(owner-portal): add owner self-stays"
```

---

### Task 15: Add staff navigation and final module documentation

**Files:**
- Modify: `app/constants/menus.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add staff navigation entries**

Under Team, add:

```ts
{ title: 'Owners', icon: 'i-lucide-building-2', link: '/owners', new: true },
{ title: 'Owner Statements', icon: 'i-lucide-file-chart-column', link: '/owner-statements', new: true },
```

Do not add owner portal pages to the regular staff sidebar. Expose the demo portal through a clearly labeled action on `/owners` instead.

- [ ] **Step 2: Update project documentation**

Add an Owner Portal module section to `CLAUDE.md` covering:

- external-owner separation from `role-owner`
- routes and layout
- data types
- composables
- statement lifecycle and formula
- field-permission snapshots
- stay conflict rules
- notification types
- mock integration boundaries
- owner isolation requirement

Update File Structure and Composables Reference entries.

- [ ] **Step 3: Run static checks**

```bash
pnpm typecheck
pnpm lint
```

Expected: both PASS.

- [ ] **Step 4: Commit navigation and docs**

```bash
git add app/constants/menus.ts CLAUDE.md
git commit -m "docs(owner-portal): document phase 1 module"
```

---

### Task 16: Run full verification and review

**Files:**
- Modify only files required to fix verified failures.

- [ ] **Step 1: Run the complete automated suite**

```bash
pnpm vitest run
```

Expected: all tests PASS with no unhandled errors.

- [ ] **Step 2: Run typecheck and lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: both PASS.

- [ ] **Step 3: Launch the app**

```bash
pnpm dev
```

Expected: Nuxt starts successfully at the configured dashboard base URL.

- [ ] **Step 4: Verify the tenant staff flow end to end**

Exercise:

1. Open `/owners`.
2. Create an invited owner through all three steps.
3. Confirm ownership >100% is blocked.
4. Edit permissions and commission rules.
5. Open `/owner-statements`.
6. Generate a monthly draft.
7. Review and publish it.
8. Confirm it is locked and notification state updates.

- [ ] **Step 5: Verify the owner flow end to end**

Exercise:

1. Open `/owner-portal/login`.
2. Request a link for a seeded owner.
3. Open the demo secure link.
4. Verify branded layout and owner-only data.
5. Switch property for a multi-property owner.
6. Confirm hidden fields are absent.
7. Open a published statement, run both mock exports, and raise an issue.
8. Create a conflict-free owner stay.
9. Verify a conflicting stay is blocked.
10. Modify and cancel a stay.
11. Sign out and confirm guarded routes return to login.

- [ ] **Step 6: Run code review and simplification**

Invoke the project’s `requesting-code-review` skill, fix confirmed findings, rerun affected tests, then use the `verify` skill to exercise the runtime flow.

- [ ] **Step 7: Confirm clean branch state**

```bash
git status --short --branch
git log --oneline --decorate -15
```

Expected: branch `feat/owner-portal-phase-1` contains the design and implementation commits with no unintended changes.
