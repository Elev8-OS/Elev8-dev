> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

## 📁 File Structure Reference

```
app/
├── app.config.ts              # App config (shadcn-vue)
├── app.vue                    # Root app with Sonner/Toaster
├── assets/
│   └── css/
│       ├── tailwind.css       # Tailwind entry
│       └── themes.css         # Theme tokens (light/dark)
├── components/
│   ├── ui/                    ← shadcn-vue components (338 files)
│   ├── AppSettings.vue
│   ├── airbnb-reviews/           ← Airbnb Review Automation
│   │   ├── PreviewDialog.vue        # Editable preview with ratings, text, regenerate
│   │   └── data/
│   │       └── reviews.ts           # Types, mock data, config
│   ├── DarkToggle.vue
│   ├── PasswordInput.vue
│   ├── Search.vue
│   ├── ThemeCustomize.vue
│   ├── auth/
│   │   ├── ForgotPassword.vue
│   │   ├── OTPForm.vue
│   │   ├── OTPForm1.vue
│   │   ├── OTPForm2.vue
│   │   ├── SignIn.vue
│   │   └── SignUp.vue
│   ├── base/
│   │   ├── BreadcrumbCustom.vue
│   │   └── DateRangePicker.vue
│   ├── dashboard/
│   │   └── TotalVisitors.vue
│   ├── listings/
│   │   ├── data/
│   │   │   └── listings.ts        ← Listing type (unitType, stats, pricing, bookings, reviews, maintenance, resources), AiSchedule, Unit, UnitType (with aiStatus), RatePlan, RatePlanOffering, LengthOfStayDiscount, Fee, ListingResources, FieldConfig, ReservationStage, ref<Listing[]>, allTags/allLocations/allProperties/allOtas
│   │   ├── ListingHeroCompact.vue ← Compact hero: photo manager, unit switcher, editable name+tags, AI schedule Sheet, accepts openSchedule prop
│   │   ├── ListingOverviewTab.vue ← Stats cards + upcoming bookings + recent reviews
│   │   ├── ListingPricingTab.vue  ← Base pricing, discounts, seasonal rates
│   │   ├── ListingCalendarTab.vue ← Bookings list + blocked dates
│   │   ├── ListingReviewsTab.vue  ← Rating summary + filter + reviews with host reply
│   │   ├── ListingMaintenanceTab.vue ← Cleaning schedule + tasks + add-task dialog
│   │   ├── ListingSettingsTab.vue ← Property details form + amenities + distribution channels
│   │   ├── ListingFloatingMenu.vue ← Fixed floating pill bar (Listing Setup / Test AI / AI Schedule)
│   │   ├── ListingSetupOverlay.vue ← Full-screen overlay shell (Property/Rooms tabs + two-panel)
│   │   ├── ListingSetupFieldPanel.vue ← Left panel: 6 tabs + pencil config icons per field
│   │   ├── ListingSetupResourcePanel.vue ← Right panel: documents (incl. AI Generate) + Elev8 AI + auto-fill + copy
│   │   ├── LockRow.vue            ← Reusable per-lock row: brand pill, name (inline rename), battery, Unlock/Swap/Unpair actions
│   │   ├── RoomsPanel.vue         ← Rooms tab: sidebar of rooms grouped by type + room editor (reuses FieldPanel)
│   │   ├── UnitTypeManager.vue    ← Room type card with Details + Pricing tabs (multi-rate-plan supported)
│   │   ├── FieldConfigDialog.vue  ← Per-field: reservation stages + copy to properties
│   │   ├── ListingTestAIDialog.vue ← Guest chat simulation
│   │   ├── ListingAiStatusCell.vue ← AI Status table cell; aggregates from unitTypes for multi-unit
│   │   ├── ListingOtaCell.vue     ← OTA logos table cell
│   │   ├── ListingExpandRow.vue   ← Multi-unit expand panel: per-unit-type AI toggle + per-unit Switch
│   │   ├── ListingSingleToggle.vue ← Per-row status Switch (single + multi-unit logic)
│   │   └── ListingRowActions.vue  ← Dropdown menu (View Detail, Deactivate, Toggle AI)
│   ├── finance/
│   │   ├── BexioIntegration.vue  ← Bexio mapping UI, locks Jurnal-mapped listings
│   │   ├── CostDetailDrawer.vue  ← Shows linked material/task entries in drawer
│   │   ├── CostFilters.vue       ← Includes integration filter select
│   │   ├── CostTable.vue         ← Multi-currency, Acctg. Amount col, integration badge
│   │   ├── CostsTab.vue
│   │   ├── DatevExportSettings.vue ← Sheet body: guided setup when unconfigured, flat form after
│   │   ├── DatevExportTab.vue    ← Exports tab: setup card / generator / review / history
│   │   ├── DatevSetupWizard.vue  ← 3-step first-run setup + success panel
│   │   ├── DatevFieldsAdvisor.vue   ← Shared fields: Berater, Mandant, fiscal-year start
│   │   ├── DatevFieldsAccounts.vue  ← Shared fields: SKR picker, Debitor/Erlös, channel accounts
│   │   ├── DatevFieldsHandover.vue  ← Shared fields: include-cancelled, advisor e-mail
│   │   ├── DatevPreview.vue      ← Reviewable file: header facts + posting rows
│   │   ├── IntegrationsTab.vue
│   │   ├── JurnalIntegration.vue ← Locks Bexio-mapped listings
│   │   ├── OverviewTab.vue
│   │   ├── ReservationsTab.vue   ← Smart push label, integration filter, Acctg. Amount
│   │   ├── RevenueTab.vue        ← Sub-tabs wrapper (Reservations + Upsell)
│   │   ├── UpsellDetailDrawer.vue ← Guest avatar, type badge, sync info, invoice download
│   │   ├── UpsellTab.vue         ← Always Paid, integration filter, Acctg. Amount, detail drawer
│   │   └── data/
│   │       ├── bexio.ts          ← Bexio listing data (Swiss properties)
│   │       ├── costs.ts          ← CostEntry interface (linkedTaskId), mockCosts (IDR + CHF)
│   │       ├── datev.ts          ← DatevSettings, SKR defaults, setup steps + per-step validation, exampleDatevSettings
│   │       ├── integrations.ts
│   │       ├── jurnal.ts
│   │       ├── overview.ts
│   │       ├── revenue.ts        ← ReservationEntry, ReservationStatus, recentReservations
│   │       └── upsells.ts        ← UpsellEntry (no status), mockUpsells
│   ├── inbox/
│   │   ├── ActionCard.vue
│   │   ├── GuestSentiment.vue
│   │   ├── HostbuddySuggestion.vue
│   │   ├── Layout.vue
│   │   ├── List.vue
│   │   ├── ListItem.vue
│   │   ├── Nav.vue
│   │   ├── ReplyBox.vue            ← Upsell button next to channel dropdown
│   │   ├── ReservationActivity.vue
│   │   ├── ReservationGuest.vue
│   │   ├── ReservationListing.vue
│   │   ├── ReservationPanel.vue    ← Upsell + Smart Lock tabs
│   │   ├── ReservationSmartLocks.vue ← Smart Lock tab: paired locks, active codes, generate/copy/revoke
│   │   ├── ReservationSummary.vue
│   │   ├── ReservationTasks.vue
│   │   ├── ReservationUpsells.vue  ← Linked upsell orders from conversation
│   │   ├── Thread.vue              ← Phone tab + UpsellOfferCard in messages
│   │   ├── UpsellOfferCard.vue     ← Upsell offer UI in chat (status, pricing, actions)
│   │   ├── UpsellOrderCreator.vue  ← Mini drawer for creating orders from chat
│   │   ├── WhatsAppSendModal.vue   ← Template picker + live preview (window-expired fallback)
│   │   └── data/
│   │       └── conversations.ts    ← UpsellOffer type, linkedUpsellOrderIds, conv-21
│   ├── notifications/          ← Notification Center (new)
│   │   ├── NotificationCenter.vue
│   │   ├── NotificationItem.vue
│   │   └── data/
│   │       └── alerts.ts       ← Alert types + mock data
│   ├── upsells/
│   │   ├── data/
│   │   │   ├── upsell-services.ts  ← UpsellItem (desc/image), UpsellService (availability)
│   │   │   ├── upsell-orders.ts    ← UpsellOrder (serviceDate, source, cancellation)
│   │   │   ├── upsell-notifications.ts ← 7 notification types + templates
│   │   │   └── cancellation-policies.ts ← Per-service refund calculator
│   │   ├── UpsellFilterBar.vue
│   │   ├── UpsellTable.vue
│   │   ├── UpsellDrawer.vue        ← 2-tab: Details + Items (modal + drag-sort)
│   │   ├── UpsellOrderTable.vue
│   │   ├── UpsellOrderDrawer.vue   ← Order detail with cancel + notification log
│   │   ├── UpsellNotificationList.vue
│   │   └── UpsellCancelModal.vue
│   ├── kanban/
│   │   └── KanbanBoard.vue
│   ├── layout/
│   │   ├── AppSidebar.vue
│   │   ├── Auth.vue
│   │   ├── Header.vue
│   │   ├── HeaderUserMenu.vue
│   │   ├── LanguageSelector.vue    ← Mockup language switcher (circle-flags)
│   │   ├── SidebarNavFooter.vue
│   │   ├── SidebarNavGroup.vue
│   │   ├── SidebarNavHeader.vue
│   │   └── SidebarNavLink.vue
│   ├── mail/
│   │   ├── AccountSwitcher.vue
│   │   ├── Display.vue
│   │   ├── Layout.vue
│   │   ├── List.vue
│   │   ├── Nav.vue
│   │   └── data/
│   │       └── mails.ts
│   ├── navigation-menu/
│   │   └── DemoItem.vue
│   ├── settings/
│   │   ├── AccountForm.vue
│   │   ├── AppearanceForm.vue
│   │   ├── DisplayForm.vue
│   │   ├── Layout.vue
│   │   ├── NotificationsForm.vue
│   │   ├── ProfileForm.vue
│   │   ├── SidebarNav.vue
│   │   ├── BrandingAssetField.vue     ← Branding settings: per-kind upload field (logo/favicon/invoice)
│   │   ├── BrandingForm.vue           ← Branding settings: form + draft preview + Reset/Save
│   │   ├── BrandingPreview.vue        ← Branding settings: 3-tab live preview (Dashboard/Guide/Invoice)
│   │   ├── data/branding.ts           ← TenantBranding, BrandingAsset, GuestGuideBrandColors, validators, defaults
│   │   ├── WhatsAppIntegration.vue  ← Connection card (disconnected/connected states)
│   │   ├── WhatsAppRoutingRules.vue ← Routing rules (not currently used in UI)
│   │   ├── ThreeCxIntegration.vue   ← 3CX PBX connection + extension mapping
│   │   ├── SmartLockIntegration.vue ← Smart lock connection + webhook URL + device preview
│   │   ├── MinutIntegration.vue      ← Minut noise/sensor connection + sync + 6 mock devices
│   │   ├── SettingsIntegrationsOverview.vue ← Integrations hub tile grid (WhatsApp / 3CX / Smart Lock / Payout / Minut)
│   │   ├── PayoutGatewayPanel.vue   ← Payout gateway configuration
│   │   └── AirbnbReviewConfig.vue   ← Review automation settings (language, tone, auto-post)
│   └── tasks/
│       ├── components/
│       │   ├── columns.ts
│       │   ├── DataTable.vue
│       │   ├── DataTableColumnHeader.vue
│       │   ├── DataTableFacetedFilter.vue
│       │   ├── DataTablePagination.vue
│       │   ├── DataTableRowActions.vue
│       │   ├── DataTableToolbar.vue
│       │   └── DataTableViewOptions.vue
│       └── data/
│           ├── data.ts
│           └── schema.ts
├── composables/
│   ├── defineShortcuts.ts
│   ├── useActiveIntegration.ts  ← showConvertedColumn, getAccountingAmount, getCostAccountingAmount
│   ├── useAppSettings.ts
│   ├── useBexio.ts              ← Bexio connection + CHF accounting
│   ├── useCosts.ts              ← Costs filters, markSynced, totalThisMonth
│   ├── useInbox.ts
│   ├── useJurnal.ts             ← Jurnal connection + IDR accounting + push actions
│   ├── useKanban.ts
│   ├── useListingMappings.ts    ← Per-listing integration mapping (shared useState)
│   ├── useNotifications.ts      ← Notification Center state
│   ├── useReservations.ts       ← pushReservations(), pushSelected(), isPushingSelected
│   ├── useShortcuts.ts
│   ├── useUpsells.ts
│   ├── useUpsellServices.ts       ← Catalog CRUD
│   ├── useUpsellOrders.ts         ← Orders CRUD + cancelOrder()
│   ├── useUpsellNotifications.ts  ← Notification state + createNotification()
│   ├── useAirbnbReviews.ts        ← Airbnb Review state + config + generation
│   ├── useWhatsApp.ts             ← WhatsApp connection state (connect/disconnect)
│   ├── useWhatsAppRules.ts        ← Routing rules CRUD
│   ├── useWhatsAppTemplates.ts    ← Template messages (booking_confirmation, etc.)
│   ├── useSmartLock.ts            ← Smart lock connection + per-listing/room lock assignment + access codes
│   ├── useMinut.ts                ← Minut noise/sensor connection + 6 mock devices + event generation (LocalStorage)
│   ├── useTenantBranding.ts       ← Tenant logo/favicon/Guest Guide color state (LocalStorage + sync API)
├── layouts/
│   ├── blank.vue              # Auth pages
│   └── default.vue            # Main app layout
├── lib/
│   ├── branding-assets.ts       # Per-kind asset rules, validation, FileReader → data URL + image decode
│   ├── branding-colors.ts       # Hex↔HSL, WCAG contrast, readable foreground, scoped CSS variables builder
│   └── utils.ts               # cn(), formatDate(), etc.
└── pages/
    ├── (auth)/
    │   ├── forgot-password.vue
    │   ├── login-basic.vue
    │   ├── login.vue
    │   ├── otp-1.vue
    │   ├── otp-2.vue
    │   ├── otp.vue
    │   └── register.vue
    ├── (error)/
    │   ├── 401.vue
    │   ├── 403.vue
    │   ├── 404.vue
    │   ├── 500.vue
    │   └── 503.vue
    ├── changelog.vue
    ├── components/            # Component demo pages
    │   ├── accordion.vue
    │   ├── alert-dialog.vue
    │   ├── alert.vue
    │   ├── ... (all shadcn demos)
    │   └── tooltip.vue
    ├── email.vue
    ├── finance/
    │   └── index.vue           # Finance page (Overview/Revenue/Costs/Integrations tabs)
    ├── inbox.vue
    ├── index.vue               # Dashboard home
    ├── kanban.vue
    ├── listings/
    │   ├── index.vue           # Listings table (TanStack Table + search/tag/AI filters)
    │   └── [id].vue            # Listing detail page (HeroCompact + Overview/Pricing/Calendar/Reviews/Maintenance/Settings tabs)
    ├── reviews.vue             # Airbnb Reviews dashboard (queue, filters, generate/preview/edit)
    ├── settings/
    │   ├── account.vue
    │   ├── appearance.vue
    │   ├── display.vue
    │   ├── integrations.vue        ← WhatsApp connection + Airbnb review automation settings
    │   ├── notifications.vue
    │   ├── profile.vue
    │   └── branding.vue            ← Tenant branding settings page (wraps BrandingForm)
    └── tasks.vue
```

### Guide app (`guide-app/`) + server (`server/`) — branding surface

```
guide-app/
└── app/
    ├── assets/css/main.css                 ← Minimal additions for scoped CSS variables
    ├── components/
    │   └── BrandHeader.vue                 ← Renders primaryLogo at the top of public guides
    └── pages/
        └── [token].vue                     ← Applies scoped CSS variables + reactive favicon from branding

server/
├── api/
│   ├── tenant-branding/
│   │   └── index.put.ts                    ← PUT /api/tenant-branding (validates + writes in-memory store)
│   └── guest-guides/by-token/
│       └── [token].get.ts                  ← Adds top-level `branding` payload (logo, favicon, colors, cssVariables)
└── utils/
    └── tenant-branding-store.ts            ← In-process singleton (getTenantBranding / setTenantBranding / reset)
```
