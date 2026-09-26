> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Owner Statement Corrections (`app/composables/useOwnerStatements.ts` + `useOwnerStatementDetail.ts`)

Correcting a statement the owner has already been shown. Publishing freezes a statement
(`publishedSnapshot`), so a correction is never an edit: `recordAdjustment()` files an
`OwnerStatementAdjustment` against the published source, and `generateForPeriod()` folds it into a
later draft as its own line.

- **Pending is picked up by period, not by an exact match.** Generation folds in every unapplied
  adjustment for that (owner, listing) whose `nextPeriod <= period` being drawn. `=== nextPeriod`
  would strand a correction filed after its own next period was already published.
- ⚠️ **`appliedToStatementId` is the double-apply guard**, stamped only after the drafts are
  committed, and never cleared. `appliedInPeriod` records which statement carried the money.
- ⚠️ **No currency conversion, ever.** `OwnerStatementAdjustment.currency` is copied from the
  source statement; a correction in another currency stays pending rather than being blended into
  the statement being drawn. Same rule as city tax and the reservation folio.
- **One statement line per correction** (`Correction for <period>`, carrying `adjustmentId`), not
  the single aggregate `line-adjustment` from `buildStatementLines` (which is filtered out). Line
  amounts are rounded first and the statement total is derived from those rounded values, so the
  breakdown always sums to the total.
- **A period with no ledger activity still draws an adjustment-only statement** when a correction
  is owed. A property that stops producing revenue must still be able to receive money it was
  over- or under-paid.
- **The portal shows the same correction twice, on purpose**, via two lists on
  `OwnerStatementDetail`: `adjustments` (money inside THIS statement, what the card totals) and
  `relatedAdjustments` (filed against this statement, paid out in a later one, excluded from the
  total). `PortalStatementAdjustments.vue` renders them as two groups. Do not merge them: summing
  a related row would claim a payout this statement never carried.
- Ledger-derived rows (`isPriorPeriodAdjustment` entries in `owner-ledger.ts`) keep their original
  meaning and still land in `adjustments`; they have no `appliesInPeriod`.

#### Disputes (the flow that produces most corrections)

An owner raises an issue on one statement **line** from the portal
(`PortalRaiseIssueDialog.vue`, one open issue per line). Staff answer and close it from the
**Issues** tab on `/owner-statements`.

- **`StatementIssuesPanel.vue`** is the worklist (Open / Resolved, open list sorted oldest first
  so the most neglected dispute is on top). **`StatementIssueDrawer.vue`** is where it is answered.
- ⚠️ **Resolving as `adjusted` files the adjustment in the same handler that writes the
  resolution** (`StatementIssueDrawer.resolve()`), so a dispute can never be closed as "adjusted"
  with no correction behind it. `resolution.adjustmentId` is what links the two.
- ⚠️ **`adjusted` is offered only on a published statement.** A draft's numbers can still be
  edited directly, and `recordAdjustment` refuses a draft anyway.
- **The resolution note is posted to the thread as well as stored on the resolution.** The thread
  is what the owner reads and what emits `OWNER_ISSUE_RESPONDED`; the resolution field is the
  audit record. Resolution itself emits no alert, which is why the note is posted first.
- The portal dialog is two-faced: with an open issue it is the conversation (description, thread,
  owner reply box) and the new-issue form is withheld, which is what enforces one-open-issue-per-
  line in the UI; with none it shows resolved history above the form.

#### PDF export (owner portal)

The portal's **PDF** button generates a real file with `buildOwnerStatementPdf`
(`app/lib/owner-statement-pdf.ts`, jsPDF) and downloads it. It used to call `window.print()`,
which produced no file and left the result to whatever the browser's Save as PDF did.

**The design is the guest invoice's** (`folio-invoice-pdf.ts`), deliberately: clean white page,
company block top-left, logo and title top-right, a "Statement For" block, grey-header tables
(`175,178,183`), and a two-column closing section where the invoice puts its payment block. It
even resolves the company letterhead from the **same** `useInvoiceTemplates().getTemplateForListing`,
so a tenant configures its address, registration and VAT once for both documents. Keep the two
files' palette, column anchors and type scale in step; a change to one that is not mirrored is
what makes a tenant's paperwork look like two different companies.

- ⚠️ **Never `−` (U+2212) in a PDF string.** jsPDF's built-in Helvetica is WinAnsi and renders it
  as a stray quote mark. Every deduction on a statement is negative, so the wrong glyph showed on
  every line until it became an ASCII hyphen. `folio-invoice-pdf.ts` still carries the same
  U+2212 in its `fmtCurrency`; it is invisible there only because invoice amounts are rarely
  negative.
- ⚠️ **The file prints the frozen `publishedSnapshot`**, falling back to the live lines only when
  a statement has no snapshot. What the owner was told is what the file must say.
- ⚠️ **It prints only what the owner may see.** `PortalExportButtons.vue` filters the lines
  through `ownerStatementFieldForLineCategory` (in `owner-permissions.ts` — shared with
  `PortalStatementDetail.vue`, do not re-inline it) and passes `showPayout` from
  `canViewStatementField('netPayout')`. Reservations and adjustments arrive already gated by
  `useOwnerStatementDetail`. A leak here outlives the session, so the builder never re-derives
  visibility: it prints the `lines` it is handed and nothing else.
- **Each figure appears once.** The totals live only in the closing Payout block (category
  subtotals, then the hero NET PAYOUT); the items table closes with a rule and nothing else. An
  earlier pass printed gross/deductions under the table *and* by category in the block, so the
  reader met the same number twice.
- **Layout order mirrors the invoice**: *Statement For* (owner, their address, the property) and
  *Statement Details* (period, owner split, cost share, published date) sit side by side at the
  top, and the closing section is **Payout Account** on the left.
- ⚠️ **That block is the OWNER's account, never the manager's.** It answers "where does my money
  land", so printing the company's remittance account there would read as an instruction to pay
  us. With nothing on file the file says so in as many words (`No payout account on file`) and
  points at the portal; it never falls back to `template.bank`.
- ⚠️ **There is no statement document number, so none is printed.** `statement.id` is an internal
  id; putting "Statement # STMT-2" in the header dressed it up as a reference an owner could
  quote back. The issue date is gone too — `Published` in Statement Details is the real one.
- **Adjustment details** restate the reason per correction, never a second amount: an applied
  correction is already one of the items above, so its row reads "Included in the items above",
  while a related one names the statement that carries the money.
- ⚠️ **The closing block is measured before it is drawn.** It grows a row per category and ends
  in a 16pt figure, so a fixed height guess pushed the hero number straight through the footer.
  `closingHeight` mirrors the drawing arithmetic; change one and change the other.
- **Branding** uses `useTenantBranding().branding.primaryLogo`, falling back to the template's
  own `company.logoDataUrl` and then to the invoice's E8 mark. jsPDF decodes PNG and JPEG only,
  so a WebP logo, or one that fails to decode, falls back rather than throwing.
- **Pagination** is real: every block calls `ensure()` first, the booking table repeats its
  column headers on each page, and the footer is stamped per page with `Page n of m` once there
  is more than one.
- The download is recorded through `mockExport({ format: 'pdf' })` **after** the file is handed
  over, so a failed activity row can never read as a failed export.
- ⚠️ The on-screen `PortalStatementSummary` card does **not** gate its "Net revenue" figure,
  while the PDF gates the payout on `netPayout`. Both built-in templates have that field on, so
  nothing differs today; if a custom config turns it off, the card is the one that is wrong.
  Occupancy and ADR are hardcoded `0` in that card and are deliberately absent from the PDF
  rather than printed as zeros.

**Tests:** `tests/lib/owner-statement-pdf.spec.ts` (12 — jsPDF is replaced with a recorder, so
the assertions are about what lands on the page: snapshot over live figures, only the given
lines, payout gating, the adjustment notes, pagination and repeated headers, logo embed and both
fallbacks, filename). ⚠️ Money assertions build their expected string with the same
`toLocaleString('de-CH')` the writer uses — hardcoding `25'180'000` pins the test to one ICU
version, which groups with a typographic apostrophe on modern Node. A recorder cannot catch a
layout regression, so render a real PDF and look at it (`pdftoppm -png`) after changing the
geometry.

**Tests:** `tests/composables/useOwnerStatements.spec.ts` (folding, no double-apply,
adjustment-only statement, currency guard), `tests/composables/useOwnerStatementDetail.spec.ts`
(pending vs applied, cross-owner isolation), `tests/components/owner-portal/PortalStatementDetail.spec.ts`
(both card groups), `tests/components/owners/StatementIssues.spec.ts` (reply, both resolutions, the
draft refusal, worklist filtering). ⚠️ `tests/setup.ts` clears the `useState` store before every
test, so each case builds its own generate/publish/record chain. ⚠️ A `Button` stub must not
re-emit `click` (the parent handler already falls through onto the stub root), and the `Sheet` stub
must honour `open` or a closed drawer still renders its slot.

**NOT implemented (intentionally out of scope):** no approval step on a correction (the required
reason is the audit trail); no settlement of the payout itself (no paid status, transfer date, or
payout integration, only `netPayout` as a figure); no delete or edit of a recorded adjustment; no
reopening a resolved issue (the owner raises a new one on the same line).
