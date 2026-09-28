> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Tenant billing (Elev8 billing the property manager)

**Page:** `/settings/billing` (`app/pages/settings/billing.vue` wrapping `settings/BillingPanel.vue`), listed
under Account in `settings/SidebarNav.vue`. The platform-console "Upgrade plan" banner points here.

Four parts, top to bottom:
1. **A failed subscription charge** (when `useSubscriptionBilling().needsPaymentUpdate`), with the days
   left before suspension and **Update card** (the same `BillingUpdatePaymentDialog` as the header bar).
2. **Package** and **Payment method** side by side. The package reads `packageView()`
   (`billing/data/billing-overview.ts`, framework-free, figures from the plan catalog in
   `onboarding.ts`): plan, PMS model, pricing model and cycle, **active units against the package
   range** (bar), rate, billed units (the floor applies), the 12-month contract end, and the damage
   waiver add-on. The card is `billing.paymentMethod` (brand, last four, expiry, stated as Expired
   when past).
3. **Next invoices**: the subscription (`nextSubscriptionInvoice()`: one cycle after the last invoice
   issued, else after activation, for the units active now) and, when the waiver is active, the
   damage waiver invoice on the 1st so far (`useWaiverBilling().upcoming`), with **Run the 1st billing
   now (demo)**. This is the only damage waiver billing surface (the old `/damage-protection` tab is gone).
4. **Billing history**: subscription and damage waiver invoices in one list, newest first. ⚠️ **Type
   (Invoice) and status (Paid, Payment failed) are separate columns**, an Elev8 billing UI rule.
   Every row downloads its PDF; a failed damage waiver row also has **Retry charge**
   (`useWaiverBilling().retryCharge`).

- ⚠️ **A unit is a room**, and on Per Unit the package counts the rooms the tenant has **activated**
  (`subscription.unitCount`), never a count of listings: activation is the billing event, and
  activating past the package maximum opens the upgrade paywall (not built here). The demo portfolio
  has 27 rooms; 16 are activated.
- **Per Booking** shows the quota left and the rate, and says there is no scheduled invoice (it
  refills at 10 percent). Deductions are not listed yet.
- **Subscription invoice history** is `useSubscriptionBilling().invoices` (`SubscriptionInvoice`,
  storage `elev8-subscription-invoices-v1`), seeded by `createSeedInvoiceHistory` from the failed
  invoice plus the three paid months before it, dates relative to it. Updating the card or retrying
  marks the failed invoice **paid** (`markFailedInvoicePaid`); `simulatePaymentFailure` reseeds.
- ⚠️ **The demo package is one amount everywhere**: `DEMO_PLAN` (16 units, Growth, USD 59) matches the
  onboarding demo seed, so the failed invoice, the header banner, the history and the next invoice all
  read **USD 944.00**. It used to say USD 899 with no link to the plan.
- **PDFs** share one frame, `app/lib/elev8-invoice-pdf-kit.ts` (`InvoiceDoc`: header, section, row,
  line table with a repeating header, note, footer; ASCII only). `subscription-invoice-pdf.ts` and
  `waiver-invoice-pdf.ts` are drawn in it. The issuer is `ELEV8_BILLING_ENTITY`.
- **Bill to** is `useTenantBillTo()`: the onboarding profile when filled in, else the default invoice
  template's company (with its VAT number). Every invoice freezes it when issued.
- **Not implemented:** real Stripe invoices or charges, the upgrade paywall and proration, plan
  switching, per-booking deductions in the history, tax lines, emailing invoices.
- Tests: `tests/components/settings/BillingPanel.spec.ts` (6), `tests/lib/billing-overview.spec.ts` (8),
  `tests/lib/subscription-invoice-pdf.spec.ts` (3).
