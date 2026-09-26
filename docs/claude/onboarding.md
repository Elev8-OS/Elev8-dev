> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Tenant Onboarding Module (`app/components/onboarding/` + `app/composables/useOnboarding.ts`)

Register through to an activated dashboard: account, a three step wizard, then
data activation routed by the PMS model the tenant bought. Mock only, but the promo
rules genuinely run on the server.

**Three PMS models**, chosen at the wizard's third step and decisive for everything after it:

| Code | Meaning | Endstate |
|---|---|---|
| `PMS_CM` | Elev8 as PMS plus Channel Manager | Every module, channels connect from Elev8 |
| `PMS_ONLY` | Elev8 as PMS, synced to another system | Cockpit, Website Builder, Review Hub and Integrations are **hidden** |
| `MIGRATION` | Move onto Elev8 | Same endstate as `PMS_CM`, plus a one time import and a manual channel reconnect |

`hasChannelManager(model)` is the single place that says `MIGRATION` prices and gates like
`PMS_CM`. Do not re-derive that per call site.

#### `data/onboarding.ts` (framework free)
The single home for the rules. The composable owns reactive state and calls in; the promo
endpoint imports the same catalog, so the price shown and the price validated cannot drift.
- Types for every PRD table: `TenantProfile`, `TenantSubscription`, `OnboardingPromoCode`,
  `PmsConnection`, `ImportJob`, `ChecklistItem`, all under one `OnboardingState`
- **Plan catalog**: `PER_UNIT_PLANS` (Starter/Growth/Pro/Enterprise, USD per unit per month,
  yearly is `monthly * 11 / 12`) and `PER_BOOKING_PLANS` (Starter 50 / Growth 250 /
  Enterprise 1000, two price columns). `perUnitPlanForUnits` picks the tier from the unit
  count, `billableUnits` applies the **package floor** (2 units on Growth still bills 5),
  `perBookingRate(plan, model)` picks the column
- **`buildOrderSummary`** produces subtotal, discount and total as three separate numbers,
  plus `nextPeriodAmount`. A `first_invoice` promo (the default) leaves that at the **normal**
  price, which is what the summary must state
- **`validatePromoCode`** returns a typed `PromoRejectionReason` and a message that **names the
  reason**. Never collapse these into "invalid code": the PRD calls out expired, exhausted,
  wrong model and wrong pricing model as distinct, actionable failures
- **State machine**: `canAdvance` only moves forward, with the single exception of
  `payment_failed` returning to `payment_pending`. `stepForStatus` is what resumes a tenant who
  closed the browser
- ⚠️ `billingCurrency` is the literal `'USD'` and `operatingCurrency` is the tenant's own.
  They are separate fields on purpose and must never fall back to one another

#### `useOnboarding.ts`
`useState` plus LocalStorage (`elev8-tenant-onboarding-v1`), same shape as `useDatev`. Guards
persistence on `typeof localStorage` rather than `import.meta.client`, which Vitest does not
substitute.
- **The default state is a finished, actively subscribed tenant**, so the existing demo
  dashboard is untouched. `startTenant(email)` is what resets to `registered`. ⚠️ Seeding the
  default subscription as `pending` paints the red "plan not active" banner across every page
  of the demo; `createDefaultOnboardingState` seeds it `active` for that reason
- `submitPayment()` always stores a `stripePaymentMethodId`, **including the zero total path**.
  A subscription can never be `active` without one. Zero total sets
  `activationSource: 'promo_full_discount'`
- `redemptionCount` is incremented by a call to `/api/onboarding/promo/redeem` **only after the
  subscription is active**, so an abandoned checkout never burns a redemption
- `startImport()` is deliberately not awaited: leaving the progress screen must not cancel it.
  Stages run listings, then reservations, then guests, because each references the one before
- `activeBanner` is the **only** thing that decides which banner shows. One per page, ranked
  plan inactive, import failed, importing, reconnect channels

#### Server (promo validation is not a client decision)
- `server/utils/onboarding-promo-store.ts` holds the catalog and the failed attempt counters
- `POST /api/onboarding/promo/validate` validates and rate limits (10 failures per hour, keyed
  by **both** tenant and IP). ⚠️ A rejected attempt returns `promo: null`: returning the record
  would hand a guesser its discount value and remaining redemptions
- `POST /api/onboarding/promo/redeem` increments the counter, called only at activation

#### Components + page
`Stepper`, `StepProfile`, `StepBranding`, `StepSelectModel`, `StepSelectPlan`, `StepPayment`,
`ConnectChannels`, `ConnectPms`, `ImportProgress`, `ReconnectChannels`, `ChecklistCard`,
`StatusBanner`. `app/pages/onboarding/index.vue` hosts all of them and picks the screen from
`step`, so resume is free. A local `viewStep` lets the tenant walk backwards without rewinding
the saved status.
- `StepBranding` writes through `useTenantBranding`, so the logo it uploads is the same asset
  Settings shows. Skipping records `brandingSkipped`, it does not silently pass
- `StepSelectPlan` states the package floor, both rates, and the **one year contract** on the
  step itself. `StepPayment` states the next period amount whenever the discount is first
  invoice only
- `ConnectPms` and `StepPayment` each carry a visible "simulate a failure" switch, because the
  declined card and failed Calry auth paths are specified and otherwise unreachable in a mock

#### Wiring
- `AuthSignUp` calls `startTenant(email)`; `AuthOTPForm` calls `markEmailVerified()` and routes
  to `/onboarding`
- `app/layouts/default.vue` mounts `<OnboardingStatusBanner>` once, which is what keeps the
  one banner per page rule true
- `app/pages/index.vue` mounts `<OnboardingChecklistCard>`. Note it sits in the non GRO branch:
  the GRO persona is cross tenant staff and gets `GroDashboard` instead
- `LayoutAppSidebar` filters `navMenu` through `moduleAvailable(item.title)`, so a `PMS_ONLY`
  tenant loses four entries. A `NavSectionTitle` has no `title` and is never gated

#### Tests
`tests/lib/onboarding.spec.ts` (40, pricing, promo rejection reasons, state machine, checklist),
`tests/composables/useOnboarding.spec.ts` (35, the flow: resume, promo revalidation on plan
change, both payment paths, import staging and retry, banner priority),
`tests/server/utils/onboarding-promo-store.spec.ts` (11, rate limit windows and redemption caps),
`tests/components/onboarding/OnboardingSurfaces.spec.ts` (11, checklist and banner rendering).
⚠️ The mock delays make real timers cost seconds per assertion. `settle(() => call())` in the
composable spec fakes timers **before** the call, which is the only ordering that works.
`tests/setup.ts` exposes `useOnboarding` globally, since components resolve it as an auto import.

#### NOT implemented (mock boundaries)
- **Real Stripe.** No Checkout redirect, no webhooks, no idempotency. `submitPayment` is a
  1.5s timer that writes `pm_mock_*` ids
- **Real Calry.** The provider catalog is static and auth is a 1.6s timer
- **Email.** No 6 digit code is sent, no reminder at 24 hours or 7 days. `MOCK_OTP_CODE` is
  `123456` and shown on screen
- **A queue.** Import runs in the browser tab, so a reload restarts it rather than resuming
- **Auto refill, quota decrement, invoicing.** Stated in the UI, not enforced
- **Internal admin promo panel**, and per item import retry from Settings (the composable has
  `retryImportItem`, no Settings surface calls it yet)
