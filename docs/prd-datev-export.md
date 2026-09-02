# PRD: DATEV Buchungsstapel Export (simple, dev-facing)

**Jira:** [PP-385](https://elev8software.atlassian.net/browse/PP-385) · children [PP-386](https://elev8software.atlassian.net/browse/PP-386) (auth), [PP-387](https://elev8software.atlassian.net/browse/PP-387) (reservation source), [PP-388](https://elev8software.atlassian.net/browse/PP-388) (settings persistence), [PP-389](https://elev8software.atlassian.net/browse/PP-389) (direct e-mail)
**Status:** Prototype complete in the dashboard (mock data, client-side builder) · production wiring open
**Owner:** Finance (Product) · **Dev:** dimas
**Module:** Finance → Exports + Finance → Integrations
**Last updated:** 2026-09-02

---

## TL;DR (developer quickstart)

**What is this?** German tax advisors work in DATEV. Tenants do not. So Elev8 writes the advisor's
import file for them: pick a period → review it → download it or open a prefilled e-mail draft.

**What it is NOT:** a connection. No API, no OAuth, no per-row sync state. It is a **file handoff**.
Never wire it into the "Unsynced Entries" KPI and never use Connect/Connected wording — the tile
status is `Not set up` / `Configured`.

**Where it lives** (the alpha prototype linked on PP-385):

| Surface | Route | File |
|---|---|---|
| Action (generate, review, history) | `/finance?tab=exports` | `app/components/finance/DatevExportTab.vue` |
| Settings + first-run setup | `/finance?tab=integrations&integration=datev` | `DatevExportSettings.vue` → `DatevSetupWizard.vue` |
| Shared setting fields | — | `DatevFieldsAdvisor / DatevFieldsAccounts / DatevFieldsHandover.vue` |
| Reviewable file | — | `DatevPreview.vue` |
| Manual export of picked rows | `/finance?tab=revenue` | `ReservationsTab.vue` ("Export N to DATEV") |
| State, scope, generation | — | `app/composables/useDatev.ts` |
| Settings + setup steps | — | `app/components/finance/data/datev.ts` |
| **EXTF writer (the part that must not regress)** | — | `app/lib/datev-extf.ts` |
| Tests | — | `tests/lib/datev-extf.spec.ts` (28), `tests/composables/useDatev.spec.ts` (36), `tests/components/finance/Datev*.spec.ts` |

**Mocked today:** generation runs client-side with a 900 ms fake latency; settings and history persist
to LocalStorage (`elev8-datev-settings-v1`, `elev8-datev-history-v1`); reservations come from
`useReservations()` seed data. There is no `/api/datev/*` route in this repo.

---

## 1. Problem

German property managers must hand booking revenue to their Steuerberater every month, today as PDFs
and Excel. The advisor re-keys it. Elev8 emits the standard **EXTF "Buchungsstapel"** (format 700,
record version 13) so the advisor imports it in one click. Which account numbers apply is not
universal — it depends on the tenant's chart of accounts and how the advisor set up the client, so
every account is a **per-tenant setting, never hardcoded**.

## 2. Roles & access (PP-386)

| Role | Access |
|---|---|
| Admin, General Manager, Finance/HR | Set up DATEV, generate, download, e-mail, view history |
| Housekeeping / operational roles | No access — `403` |
| Unauthenticated | `401` |

## 3. Scope

**In scope (V1)**
- Per-tenant settings: Beraternummer, Mandantennummer, SKR03/04, fiscal-year start, Debitorenkonto, default Erlöskonto, per-channel revenue accounts, include-cancelled toggle, advisor e-mail
- Guided **first-run setup** (3 steps) for a tenant that has never configured DATEV
- Period export: month shortcuts + free date range → review → download / e-mail draft
- Manual export of a hand-picked reservation selection from Revenue → Reservations
- Export history with re-download and a duplicate-period warning

**Out of scope (V1)**
- BU-Schlüssel / VAT keys — intentionally empty, `Festschreibung=0`; the advisor assigns them on import
- Per-guest or per-OTA debtor numbers (one collective Debitorenkonto only)
- Kostenstellen (KOST1) per listing — the field exists in `DatevPostingRecord`, nothing populates it
- Sachkontenlänge configuration (assume 4–8 digits, validated as such)
- Upsells and costs as posting lines — reservations only
- Direct e-mail with attachment → PP-389

## 4. Per-tenant settings

| Setting | Goes to | Validation | Default |
|---|---|---|---|
| Beraternummer | header | 1–7 digits, **required** | empty |
| Mandantennummer | header | 1–5 digits, **required** | empty |
| Kontenrahmen (SKR03/04) | header (`03`/`04`) | one of two | SKR03 |
| Wirtschaftsjahresbeginn | header | day + month | 01.01. |
| Debitorenkonto | every posting line (`konto`) | 4–8 digits | 10000 |
| Erlöskonto (default) | fallback `gegenkonto` | 4–8 digits | SKR03 8400 / SKR04 4400 |
| Per-channel revenue accounts | `gegenkonto` per channel | 4–8 digits, optional | 8401–8404 / 4401–4404 |
| Include cancelled bookings | scope filter | boolean | off |
| Tax advisor e-mail | mailto recipient | e-mail, optional | empty |

Switching SKR **re-seeds every account** (`applySkrDefaults`) — SKR03 revenue is 8xxx, SKR04 is 4xxx.
Getting this family wrong is the single most common cause of a rejected import.

## 5. Format rules — do not regress

- `;` separator, CRLF line endings, **CP1252** encoding, exactly **125 fields** per record
- Text fields always quoted (empty → `""`); numeric/date fields never quoted (empty → bare). Quoting an empty numeric field raises one DATEV-checker message **per field**
- Amounts: decimal comma, always positive — the sign lives in the S/H flag
- Belegdatum `TTMM`; Leistungsdatum `DDMMYYYY`; header dates `YYYYMMDD`
- Cancellations post as **Generalumkehr** (field 118 = 1), not as a second revenue line
- Download must write CP1252 **bytes**, never a UTF-8 string

Reference: the July 2026 file passed the official DATEV validation tool with **0 messages**.

## 6. Posting line mapping

One reservation = one Buchungssatz.

| EXTF field | Source |
|---|---|
| `umsatz` | `reservation.amount` (gross, positive) |
| `sollHaben` | always `S` (receivable debited) |
| `konto` | `settings.debitorenkonto` |
| `gegenkonto` | `settings.channelAccounts[channel]` → falls back to `settings.erloeskonto` |
| `belegdatum` / `leistungsdatum` | reservation check-out (**decision Q1**) |
| `belegfeld1` | `reservation.invoice`, or the reservation id when the invoice is `pending` |
| `buchungstext` | `"{guest} / {listing}"`, truncated to 60 chars |
| `generalumkehr` | `status === 'Cancelled'` |
| `waehrung` | `EUR` |

**Scope gate:** only EUR bookings on EUR-tagged listings (`getEurListings()`, shared with Lexware so
both German-market surfaces agree). Everything dropped is shown as a grouped digest with a reason —
never silently. A manual selection passes the same gate, so hand-picking cannot smuggle a CHF booking
into a German batch.

## 7. Flow

**First run (tenant has nothing configured)**
1. `Finance → Exports` shows the setup card: *Set up DATEV → Pick a period → Hand the file over*. No history table yet.
2. **Set up DATEV** opens the Integrations sheet on a 3-step wizard: Advisor & client → Kontenrahmen & accounts → Handover (with a review block).
3. Each step validates only its own fields (`validateDatevSetupStep`). Finish saves once; a success panel offers **Go to Exports**.
4. The tile flips to `Configured`; the generator and the Revenue selection button appear.

**Every month after**
1. Pick a period (month shortcut or free range). Scope line shows eligible count, EUR total, cancelled count, and the excluded digest.
2. If the period was already exported, a warning names the date and record count before you generate again.
3. **Create DATEV file** → review (header facts + posting table + raw view).
4. **Download** (CP1252 bytes) or **e-mail draft** (`mailto:` cannot attach, so it downloads first, then opens the draft). Either action commits the file to history.

## 8. Production wiring (the actual dev work)

The prototype's builder and UX are done. What is left is replacing the mocks. Reto's standalone
module (`elev8-datev-export.zip`) carries server-side equivalents — **reconcile, do not fork** (decision Q4).

| Ticket | Replace | Acceptance |
|---|---|---|
| **PP-386** auth | `requireTenant` stub | unauthenticated → 401; operational roles → 403; all data tenant-scoped |
| **PP-387** reservations | seed data from `useReservations()` | July 2026 for the reference tenant returns the validated figures; **all** statuses returned, the builder filters by `includeCancelled` |
| **PP-388** settings | LocalStorage + in-memory repo | one record per tenant, survives restarts, isolated per tenant, `DEFAULT_SETTINGS` when empty |
| **PP-389** direct send (optional) | `mailto:` draft | advisor receives the CSV attached, requester CC'd, file opens clean in the DATEV checker |

Server endpoints per PP-385: `POST /api/datev/generate`, `GET/PUT /api/datev/settings`
(+ `POST /api/datev/send` for PP-389).

## 9. Acceptance criteria

- A tenant with no settings sees the setup card, not a generator. `generate()` and
  `generateFromSelection()` return nothing, the Revenue "Export N to DATEV" button is hidden, and the
  integration tile reads **Not set up**
- Finishing the wizard flips the tile to **Configured** and unlocks both export paths
- Each wizard step blocks on its own invalid fields only; nothing is saved until Finish
- Every generated record has exactly 125 fields; text fields quoted, numeric/date fields bare
- A period export and a manual export over the same rows are **byte-identical** in their posting lines
- A cancelled booking (with the toggle on) posts as Generalumkehr, not as a second revenue line
- A non-EUR booking never reaches the file and always appears in the excluded digest with a reason
- Re-exporting an already-exported period warns first; history keeps the file so it can be
  re-downloaded rather than rebuilt
- Downloaded bytes are CP1252 and the file opens in the DATEV checker with 0 messages
- `npm run typecheck`, `npm run lint`, and the DATEV specs pass

## 10. Decisions

Answers below, with the reasoning that produced them. **Q1** and **Q5** still need a human
sign-off (Finance for the first, Legal/Finance for the retention period); the rest are settled.

### Q1 — Scope by check-out, not check-in · *needs Finance sign-off*

**Decision: check-out.** PP-387's check-in rule breaks the file's internal consistency. The EXTF
header declares the batch period (`Datum von`/`Datum bis`) and the filename repeats it, while each
posting carries its own Belegdatum. Date by check-out but scope by check-in and the two disagree for
any stay that crosses a month boundary.

The seed data has exactly one such booking, `lex-res-006` (Villa Luwa, in 28.07., out 02.08.).
Building the July batch under the check-in rule produces:

```
header  Datum von/bis  20260701 / 20260731
        filename       EXTF_Buchungsstapel_2026-07.csv
posting Belegdatum     0208          ← 2 August
        Leistungsdatum 02082026      ← 2 August
```

A July file containing an August posting is wrong twice over: it lands the revenue in the wrong VAT
month, and it hands the advisor a record dated outside the period the batch claims to cover.
Check-out also matches how accommodation revenue is recognised — the service is complete when the
guest leaves.

*One refinement for later:* Belegdatum is strictly the **invoice** date and Leistungsdatum the
**service** date. Both are check-out today because reservations carry no separate invoice date. When
one exists, Belegdatum should follow it and Leistungsdatum stay on check-out.

### Q2 — EUR only; the CHF figure cannot be the acceptance number

**Decision: keep the EUR gate.** A Buchungsstapel for a German advisor is a EUR batch. Two things
follow:

1. **Restate PP-387's acceptance criterion in EUR**, regenerated from a German tenant. The CHF
   115,344.39 / 159-booking run proves the *format* is valid — it cannot prove the *scope* is,
   because those bookings would never pass the EUR gate.
2. **Do not widen the gate to admit CHF.** `toPosting` writes `waehrung: 'EUR'` unconditionally, so
   a CHF booking that slipped through would be labelled EUR — right number, wrong currency, silently.
   Real foreign-currency postings need WKZ + Kurs + Basis-Umsatz (fields 3–6), which V1 leaves empty
   on purpose. A Swiss tenant exporting to DATEV is a separate story, not a gate change.

### Q3 — Keep the Exports tab; no standalone page

**Decision: Finance → Exports for the action, the Integrations sheet for settings.** The story's own
note ("New tab export and on Integration") describes exactly this, and it is what the linked
prototype ships. It also keeps DATEV beside Jurnal, Bexio and Lexware, where a finance user already
looks for accounting handoffs, and the deep-link (`?tab=integrations&integration=datev`) already
works from both the setup card and the notification routes. A standalone `pages/datev.vue` would add
a second Finance information architecture for one file export. Drop it from the scope.

### Q4 — `app/lib/datev-extf.ts` is canonical; verify once, then delete the other

**Decision: promote this repo's writer.** It has **zero imports** — no Nuxt, no framework, nothing —
so it already runs unchanged inside a Nitro route, and it carries 28 tests against the format rules
versus 7 in the zip. Migration:

1. Move it to `shared/datev/extf.ts` (or keep the path and import it server-side) so the client
   preview and `POST /api/datev/generate` build from one module. Byte-identical output from both
   surfaces is then structural, not a promise.
2. Before deleting the zip's writer, run **its** July dataset through **our** writer and put the
   output through the official DATEV checker. Ours must also come back with 0 messages.
3. Only then delete the duplicate. Two writers will drift on section 05, and the drift will surface
   as a rejected import at a tenant's advisor, not in CI.

### Q5 — Yes, persist history server-side · *retention period needs sign-off*

**Decision: history belongs in the database.** LocalStorage makes it per-browser, which quietly
breaks the control it exists for: the duplicate-period guard reads the same store, so a second admin
on a different laptop sees an empty history and re-exports a period that was already handed over —
the exact double-posting the warning is meant to prevent. Re-download has the same problem.

Store per tenant: period, generated-at, generated-by, record count, total, filename, and the EXTF
content (or an object-storage reference). Two further points:

- **Make the rows immutable.** The history table currently has a trash button (`deleteExport`) that
  hard-deletes an entry. That is fine against a LocalStorage scratchpad and wrong against an audit
  log — a record of what was sent to the tax advisor should not be removable from the UI. Change it
  to hide rather than delete, or remove the action.
- **Retention: propose 10 years**, aligning with the German retention duty for accounting records
  (§ 147 AO / GoBD). Our copy is a convenience archive, not the tenant's statutory one, so confirm
  with Legal/Finance whether we carry the full period or something shorter.
