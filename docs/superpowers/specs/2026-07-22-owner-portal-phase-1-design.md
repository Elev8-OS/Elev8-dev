# Owner Portal Phase 1 Design

**Date:** 2026-07-22  
**Status:** Approved  
**Source:** `Elev8_Owner_Portal_PRD_Phase1_v2.docx`  
**Implementation mode:** Interactive mock  
**Branch:** `feat/owner-portal-phase-1`

## 1. Purpose

Build Phase 1 of a dedicated, white-labeled Owner Portal for external property owners. The feature adds owner onboarding and management for tenant staff, monthly owner statements, owner self-stays, field-level visibility controls, and a separate branded owner experience.

Owners are a new external client type. They are not staff users and must not reuse the existing internal `role-owner` role.

## 2. Scope

### Included

- Tenant-side owner directory, onboarding, profile management, assignments, ownership shares, and commission rules
- Permission templates and per-owner field visibility
- Deterministic owner statement calculation using a dedicated mock ledger
- Monthly Draft → Published workflow, archive, immutable published snapshots, and next-period adjustments
- Simple owner issue flag on one statement line item
- Separate `/owner-portal` realm with mock email magic-link login
- Branded owner dashboard with property-scoped KPIs
- Published statement archive and read-only statement detail
- Mock PDF/XLSX export actions with loading and success feedback
- Owner self-stay create, modify, cancel, conflict checking, owner-use cap warnings, and mock downstream sync states
- Staff and owner notifications for statement, stay, conflict, issue, and cap events
- Automated domain, isolation, composable, route-guard, and high-risk component tests

### Excluded

- Real email delivery or authentication provider
- Database persistence or production server authorization
- Real Cockpit or Channex API calls
- Real scheduled jobs
- Actual PDF/XLSX file generation
- Payout execution
- Cross-tenant owner account switching
- Threaded dispute conversations
- Custom date-range statements
- Phase 2/3 messaging, documents, operations transparency, and AI narratives

## 3. Architectural Approach

Use one shared Owner domain with two isolated UI surfaces.

### Tenant staff surface

- `/owners` — owner directory and management
- `/owner-statements` — monthly draft queue, review, publication, archive, and issue visibility
- Existing dashboard layout, navigation, role checks, theme, and interaction patterns

### Owner surface

- `/owner-portal/login`
- `/owner-portal`
- `/owner-portal/statements`
- `/owner-portal/statements/[id]`
- `/owner-portal/stays`
- Dedicated `owner-portal` layout using tenant logo, favicon, and existing branding color variables

### Shared domain layer

The two surfaces share types, seeded data, deterministic domain functions, and focused composables. Owner-facing code may only query data through owner-scoped selectors. It must not receive the complete owner directory or unfiltered statements, stays, mappings, commission rules, or issues.

The existing internal `role-owner` remains unchanged. External owners are stored in a separate dataset and use a separate mocked session.

## 4. Domain Model

### Owner

Represents an external property owner.

Key fields:

- `id`
- `name`
- `email`
- `phone`
- `language: 'en' | 'id'`
- `statementCurrency: 'IDR' | 'USD' | 'AUD' | 'SGD' | 'EUR'`
- `status: 'draft' | 'invited' | 'active' | 'inactive'`
- `annualOwnerUseNightCap?: number`
- invitation and activity timestamps

### OwnerPropertyMapping

Represents an owner assignment to a property or optional room.

Key fields:

- `ownerId`
- `listingId`
- `unitId?`
- `ownershipPercentage`
- `commissionRuleId`
- effective dates

Invariant: active ownership percentages across all owners of one scope must total no more than 100%.

### CommissionRule

Supports:

- `flat` — percentage of the configured revenue basis
- `tiered` — progressive revenue bands
- `hybrid` — fixed monthly amount plus a revenue percentage

Rules include effective dates and may differ by owner and property.

### OwnerPermissionConfig

Stores explicit field visibility for one owner. It is initialized from a template and then becomes an owner-specific snapshot.

Dashboard fields:

- gross revenue
- net revenue
- occupancy
- ADR
- booking sources
- upcoming reservations
- guest ratings

Statement fields:

- revenue lines
- expense details
- commission details
- taxes and fees
- adjustments
- net payout

Default templates:

- Full Transparency
- Financial Summary

Changing a template does not silently update existing owners. Staff must explicitly reapply it or customize individual fields.

### OwnerStatement and OwnerStatementLine

A monthly statement contains:

- owner, property, and period references
- `status: 'draft' | 'published'`
- ledger lines and categorized totals
- calculation snapshot
- publication metadata
- optional open line-item issues
- links to prior-period adjustments

Published financial values are immutable.

### OwnerStay

Represents owner-use occupancy.

Key fields:

- owner and property references
- optional room reference
- check-in and check-out dates
- notes
- `status: 'active' | 'cancelled'`
- downstream sync state
- cap-warning state
- created, modified, and cancelled metadata

Owner-use nights are tracked separately from revenue occupancy and do not affect ADR.

### OwnerSession

Represents the mocked owner authentication state. It is separate from dashboard staff identity and stores only the authenticated owner ID plus demo session timestamps.

## 5. Composable Boundaries

### `useOwners`

- owner CRUD
- onboarding submission
- invitation and activation state
- property/room assignment
- filters and summaries
- duplicate-email validation
- ownership-percentage guardrail

### `useOwnerAuth`

- request mock magic link
- accept demo secure link
- current owner session
- logout
- portal route access checks

### `useOwnerPermissions`

- template definitions
- template application
- per-owner customization
- dashboard and statement visibility checks

### `useOwnerStatements`

- deterministic statement generation
- period filtering and archive
- draft review and publication
- immutable publication snapshots
- next-period adjustments
- line-item issue flags
- mock export activity

### `useOwnerStays`

- conflict detection
- create, modify, and cancel
- owner-use cap calculation
- downstream sync status
- retry failed mock sync
- internal notifications

### `useOwnerPortal`

- current-owner-only selectors
- assigned properties
- permitted analytics fields
- visible published statements
- current owner’s stays and issues

This composable does not expose unfiltered source arrays.

## 6. Tenant-Side Screens

## 6.1 Owner Directory

`/owners` contains:

- KPI cards: Total Owners, Active, Invited, Properties Assigned
- search
- status filter
- property filter
- owner table with identity, assignments, ownership share, commission type, currency, status, and row actions
- Add Owner action

Row actions:

- view details
- edit
- resend invite
- deactivate or reactivate

## 6.2 Owner Onboarding

A three-step dialog:

1. **Owner details**
   - name
   - email
   - phone
   - language
   - statement currency
2. **Properties and commission**
   - property or room assignment
   - ownership percentage
   - flat, tiered, or hybrid commission rule
3. **Permissions and review**
   - permission template
   - optional custom field visibility
   - invite-now toggle
   - final summary

Submission is blocked for duplicate email, missing required data, invalid commission configuration, or ownership totals over 100%.

## 6.3 Owner Detail

A sheet with tabs:

- Overview
- Properties & Commission
- Permissions
- Statements

It supports editing owner details, assignments, effective commission rules, field visibility, invitation state, and account status.

## 6.4 Owner Statements

`/owner-statements` contains:

- period selector
- owner, property, and status filters
- summary KPIs
- Draft and Published tabs
- Generate Monthly Drafts action
- statement detail
- publish confirmation
- issue visibility

The generation action simulates the day-one scheduled job. Publishing locks financial values, creates notifications, and exposes the statement to the owner portal.

## 7. Owner Portal Screens

## 7.1 Login

The mock email magic-link flow:

1. Owner enters an email.
2. The UI displays a generic link-sent state without revealing whether arbitrary emails exist.
3. A demo-only Open Secure Link action creates an owner session for a seeded owner.
4. The owner enters the branded portal.

Unauthenticated access to owner routes redirects to `/owner-portal/login`.

## 7.2 Portal Layout

Navigation is intentionally limited to:

- Overview
- Statements
- My Stays
- Sign out

The layout uses the tenant primary logo, favicon, and existing branding colors without changing the dashboard theme.

## 7.3 Dashboard

The dashboard shows permitted, owner-scoped information:

- gross or net revenue
- occupancy
- ADR
- booking sources
- upcoming reservations
- guest ratings
- owner-use nights

A property selector appears only when the owner has more than one assignment. Co-owned financial values are multiplied by the owner’s ownership percentage. Hidden fields are omitted rather than rendered as disabled cards.

## 7.4 Statements

The archive shows published statements only. Columns and detail sections respect owner field permissions.

Statement detail is read-only and contains visible ledger sections, totals, mocked PDF/XLSX actions, and a Raise an Issue action.

An owner may create one open issue per line item by selecting the line and adding a note. Finance sees the issue and receives a notification. Phase 1 does not include a threaded discussion.

## 7.5 My Stays

The page combines calendar and list views across assigned properties.

Create flow:

1. choose property or room
2. choose dates
3. add optional notes
4. run mandatory conflict check
5. confirm when clear

Modification reruns the same conflict check. Cancellation releases dates and records a cancellation event.

A successful operation produces distinct mock statuses for:

- Elev8/Cockpit update
- Channex availability sync
- internal notification delivery

A failed downstream sync does not discard the saved owner stay. The record is marked `sync_failed` and exposes a Retry action.

## 8. Statement Calculation

Use a dedicated deterministic mock ledger rather than coupling Phase 1 to incomplete Finance cost data.

Calculation order:

```text
Gross booking revenue
− operating expenses
− management commission
− taxes and fees
± prior-period adjustments
= net owner payout
```

Ownership share is applied to property financials before owner totals are produced.

### Flat commission

A configured percentage of the applicable revenue basis.

### Tiered commission

Progressive revenue bands. Each band applies only to the portion of revenue within that band.

### Hybrid commission

A fixed monthly amount plus a percentage of the applicable revenue basis.

The rule active for the statement period is selected using effective dates. Calculation functions remain pure and independently testable.

Post-publication refunds, cancellations, and corrections become linked adjustment lines in the next monthly draft. Published statement values are never recalculated in place.

## 9. Isolation and Permissions

Owner isolation is enforced in two layers:

1. Portal code uses only selectors scoped to `currentOwner.id`.
2. Every selector filters by owner mapping before property, period, status, or search filters are applied.

An owner must never access another owner’s:

- profile
- mapping
- ownership share
- commission rule
- statement
- statement issue
- stay

Co-ownership of the same property does not weaken this isolation.

Field permissions are applied after owner scoping. They control presentation, not ownership boundaries.

## 10. Stay Conflict Rules

Date intervals are interpreted as `[checkIn, checkOut)`. A stay ending on another reservation’s check-in date does not conflict.

Conflict sources:

- guest reservations
- active owner stays
- blocked dates

Cancelled records are ignored. Modification excludes the stay currently being edited.

A conflict blocks confirmation and identifies the conflicting reservation or blocked date. There is no staff approval override in Phase 1.

An annual owner-use night cap is advisory. Exceeding it displays a warning and notifies staff but does not block the stay.

## 11. Notifications

Add owner-related notification types for:

- statement draft ready
- statement published
- owner stay confirmed
- owner stay conflict
- owner issue raised
- owner-use cap exceeded

Notifications use the existing generic notification creator and route to the appropriate staff or portal surface.

## 12. Validation and Error Handling

- Duplicate owner email: inline error
- Ownership total above 100%: block save and display current allocation
- Invalid commission bands or missing hybrid values: inline rule-builder errors
- Missing ledger data: prevent draft generation and show actionable error state
- Publishing: confirmation, loading state, and duplicate-click guard
- Hidden field: omit it from owner UI
- Stay conflict: destructive alert with conflicting dates and source
- Cap exceeded: warning only
- Duplicate open issue: show existing issue instead of creating another
- Mock export: loading state, success toast, and activity entry
- Downstream sync failure: preserve saved operation, show failed status, offer Retry

Use existing shadcn-vue components, theme tokens, and `vue-sonner`. All icon-only controls require accessible labels.

## 13. Responsive and Accessibility Requirements

- Desktop-first but responsive for mobile browser use
- Tables use horizontal overflow or compact card presentation where needed
- Dialog and sheet bodies follow the `flex-1 min-h-0` scrolling pattern
- Form fields have labels, descriptions, and inline errors
- Keyboard-accessible dialogs, sheets, menus, tabs, and actions
- Status is communicated with text and iconography, not color alone
- Portal branding remains readable with derived foreground colors

## 14. Testing Strategy

### Domain tests

- flat commission
- progressive tiered commission
- hybrid commission
- effective-date rule selection
- ownership share calculation
- ownership total guardrail
- monthly statement totals
- next-period adjustments
- published statement immutability
- permission template snapshot behavior
- conflict date boundaries
- modification excludes current stay
- cancelled records do not conflict
- owner-use cap warns without blocking

### Isolation tests

- Owner A cannot query Owner B statements
- Owner A cannot query Owner B stays
- Owner A cannot query Owner B mappings
- Owner A cannot query Owner B issues
- Owner A cannot query Owner B commission rules
- Co-owned property data remains owner-isolated

### Composable and route tests

- valid mock link creates the correct owner session
- invalid or absent session cannot enter owner routes
- sign-out clears the session
- generating monthly drafts is deterministic and idempotent for a period
- publishing creates a locked snapshot and notification
- issue creation allows one open issue per line
- downstream sync failure preserves owner stay

### Component tests

- three-step onboarding validation and submission
- ownership-over-100% error
- draft publication confirmation and locked UI
- Raise an Issue flow
- conflicting versus successful stay confirmation
- field-hidden dashboard and statement sections

### Verification

Run the application and exercise both staff and owner surfaces end to end. Verify responsive behavior, route guards, seeded edge cases, notifications, state transitions, and mock sync feedback. Then run code review before completion.

## 15. Delivery Structure

Expected module groups:

- `app/components/owners/`
- `app/components/owners/data/`
- `app/components/owner-portal/`
- `app/components/owner-statements/`
- `app/components/owner-stays/`
- `app/composables/useOwners.ts`
- `app/composables/useOwnerAuth.ts`
- `app/composables/useOwnerPermissions.ts`
- `app/composables/useOwnerStatements.ts`
- `app/composables/useOwnerStays.ts`
- `app/composables/useOwnerPortal.ts`
- `app/layouts/owner-portal.vue`
- `app/pages/owners/`
- `app/pages/owner-statements/`
- `app/pages/owner-portal/`

Existing files likely modified:

- `app/constants/menus.ts`
- user role/permission data for tenant-side access
- notification types and routes
- tenant branding consumers
- operations calendar event data for owner stays
- test configuration and fixtures
- `CLAUDE.md` module documentation after implementation

## 16. Success Criteria

Phase 1 is complete when:

- staff can onboard and manage external owners without adding them to staff users
- ownership totals and commission rules validate correctly
- staff can generate, review, publish, and archive monthly statements
- published statements are immutable and corrections flow to the next period
- owners can enter a branded separate portal through the mock magic-link flow
- owners see only assigned properties and permitted fields
- no owner can access another owner’s private data, including on co-owned properties
- owners can create, modify, and cancel conflict-free owner stays
- owner-use nights remain separate from revenue ADR and occupancy
- notifications and mock integration statuses reflect all critical actions
- automated tests and end-to-end verification pass
