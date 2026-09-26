> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Owner Payout Details (`app/components/owners/data/owner-payout-details.ts` + `useOwnerPayoutDetails.ts`)

Where an owner's money goes, and the postal address their statement is addressed to. Entered by
the owner at **Bank Details** in the portal (`/owner-portal/payout`).

- **Its own store keyed by ownerId**, not fields on `Owner` — the same shape permissions and
  operational fees use. Seed owners need no migration, and "no record yet" is a real state the
  statement PDF has to be able to report.
- ⚠️ **`saveForCurrentOwner(draft)` takes the owner id from the portal session, never from its
  caller.** That is the whole access model: a portal page cannot be talked into writing another
  owner's account, because it never names one. Staff read it and never write it
  (`OwnerDetailSheet.vue` → Financials tab, read-only), so a wrong account number is always the
  owner's own entry rather than a transcription error made on their behalf.
- ⚠️ **IBANs are checked with the ISO 13616 mod-97 checksum**, not just length and shape: a
  transposed pair of digits passes every structural rule and still sends the money nowhere. The
  expansion overflows `Number.MAX_SAFE_INTEGER`, so the remainder is taken digit by digit.
- ⚠️ **Either an IBAN or a local account number is required, never an IBAN specifically.**
  Indonesian banks issue none, and requiring one would lock out the owners this product was
  built for.
- `payoutAddressLines()` / `payoutBankLines()` are the one formatting of these fields; the portal
  page, the staff sheet and the statement PDF all print what they return, so the owner reads the
  same account everywhere.
- Persisted to LocalStorage (`elev8-owner-payout-details-v1`), guarded on storage availability
  rather than `import.meta.client`, which Vitest does not substitute.
- **The first-login agreement says so.** `OWNER_CONTRACT_PAYOUT_CLAUSE` (in `owner-contracts.ts`)
  is rendered on the signing screen and written into the signed contract PDF, so the promise
  about where payouts go reads identically in the document the owner keeps and the screen they
  clicked through. It is one constant for exactly that reason.

**Tests:** `tests/lib/owner-payout-details.spec.ts` (20 — the mod-97 checksum including a
transposed-digit IBAN that every structural rule accepts, the IBAN-or-account-number rule, draft
round-trip, printed lines), `tests/components/owner-portal/PortalPayout.spec.ts` (5 — hydration,
the empty state, saving against the session owner without touching another's record, the rejected
IBAN, and the no-session guard), `tests/lib/owner-contract-pdf.spec.ts` (1 — the clause reaches
the signed copy).

**NOT implemented (intentionally out of scope):** no verification of the account (no micro-deposit,
no name match against the owner record); no change history or approval when an owner edits the
account; no notification to staff that it changed; and nothing actually transfers money — see the
settlement gap noted under Owner Statement Corrections.
