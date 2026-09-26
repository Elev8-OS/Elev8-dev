> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Branding Settings Module (`app/components/settings/` + `app/composables/useTenantBranding.ts`)

Tenant-level mock branding at `/settings/branding`:
- Primary logo → dashboard sidebar + public Guest Guide; invoice fallback
- Favicon → dashboard + public Guest Guide browser tabs
- Invoice logo → invoice preview/future invoice renderers only
- Guest Guide colors → primary, background, and text; never change dashboard colors
- `useTenantBranding` persists `TenantBranding` to `elev8-tenant-branding-v1` in LocalStorage and syncs to `PUT /api/tenant-branding`
- Calling `useTenantBranding()` registers a client-only `onMounted` hook that hydrates LocalStorage and resyncs the mock server after dashboard startup.
- Public `GET /api/guest-guides/by-token/:token` includes top-level `branding`; guide-app applies scoped CSS variables
- Invoice renderer/PDF generation and real file storage remain out of scope

#### Data + Types (`app/components/settings/data/branding.ts`)
- `BrandingAsset` — `{ name, type, size, dataUrl }` (data URL only; no remote storage)
- `BrandingAssetKind = 'primaryLogo' | 'favicon' | 'invoiceLogo'`
- `GuestGuideBrandColors` — `{ primary, background, text }` (all 6-digit hex)
- `TenantBranding` — `{ primaryLogo, favicon, invoiceLogo, guestGuideColors, updatedAt }`
- `PublicGuestGuideBranding` — `{ primaryLogo, favicon, guestGuideColors, cssVariables }` (no `invoiceLogo`, adds scoped CSS variables)
- `BRANDING_STORAGE_KEY = 'elev8-tenant-branding-v1'` (LocalStorage key)
- `DEFAULT_GUEST_GUIDE_COLORS = { primary: '#F6BB12', background: '#FFFFFF', text: '#18181B' }`
- Helpers: `createDefaultTenantBranding`, `cloneTenantBranding`, `isHexColor`, `normalizeHex`, `isTenantBranding` (full runtime validator: MIME-type allowlist + 1MB/512KB size caps + hex validation), `resolveInvoiceLogo` (invoice → primary fallback), `getBrandingFaviconHref` (custom → `/favicon.ico` fallback)

#### Asset rules (`app/lib/branding-assets.ts`)
- `BRANDING_ASSET_RULES` — per-kind allowlist of MIME types, extensions, max sizes, and copy for inline errors
  - Primary logo / Invoice logo: PNG/JPEG/WebP up to 1 MB
  - Favicon: PNG/ICO up to 512 KB
- `validateBrandingFile(file, kind)` — returns the inline error message or `null`
- `fileToBrandingAsset(file, kind, decode?)` — validates, reads via FileReader → data URL, runs an image decode (`Image.onload`) to reject corrupted files, normalizes `.ico` MIME type when FileReader reports `application/octet-stream`
- `decodeImageDataUrl(dataUrl)` — pluggable image decoder (default uses `new Image()`)
- `formatBrandingFileSize(bytes)` — KB / MB human-readable

#### Color helpers (`app/lib/branding-colors.ts`)
- `hexToHslChannels(hex)` → `"H S% L%"` (Tailwind HSL channel format consumed by shadcn tokens)
- `contrastRatio(a, b)` — WCAG relative luminance ratio
- `getReadableForeground(background)` — picks `#000000` or `#FFFFFF` based on contrast (auto primary-foreground)
- `mixHex(fg, bg, weight)` — alpha-style blend used to derive muted/border variants
- `buildGuestGuideCssVariables(colors)` — returns the scoped Tailwind CSS variable map for `--primary`, `--primary-foreground`, `--background`, `--card`, `--foreground`, `--card-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`

#### Composable (`app/composables/useTenantBranding.ts`)
- `branding: Ref<TenantBranding>` — `useState('tenant-branding')` with `createDefaultTenantBranding` initial value
- `isHydrated: Ref<boolean>` — flips `true` after first `hydrateBranding()` call (SSR-safe gate)
- `lastSyncError: Ref<string | null>` — populated when `PUT /api/tenant-branding` fails
- `resolvedInvoiceLogo` — computed (`invoiceLogo ?? primaryLogo`)
- `faviconHref` — computed (`custom favicon ?? '/favicon.ico'`)
- `hydrateBranding()` — reads LocalStorage on mount, validates with `isTenantBranding`, replaces `branding.value`, and fires `syncGuestGuideBranding()`. Idempotent (`isHydrated` gate)
- `saveBranding(draft)` — validates, writes LocalStorage, replaces state, syncs server. Returns `{ saved, synced, error? }`
- `syncGuestGuideBranding()` — `PUT /api/tenant-branding` via `$fetch`; swallows errors into `lastSyncError`

#### Settings components
- **`BrandingAssetField.vue`** — Per-kind upload field with native file picker, MIME + size validation via `BRANDING_ASSET_RULES`, image decode check, inline error line, replace/remove buttons, size readout, and validation-change emit for the form's disabled state
- **`BrandingForm.vue`** — Settings page form: draft state (clone of `branding`), three color pickers with WCAG ratio warning when text vs. background falls below 4.5:1, three asset fields, live preview, Reset button (rebuilds draft from defaults), Save (calls `saveBranding` → toast `success` / `error` for sync failure). Reactive preview binds to `draft.value`, not saved `branding.value`
- **`BrandingPreview.vue`** — 3-tab preview (Dashboard / Guest Guide / Invoice). Renders a faux sidebar header with the primary logo + favicon tab mock, a Guest Guide card with scoped CSS variables, and an invoice preview that prefers `resolvedInvoiceLogo` (invoice → primary → none)

#### Page (`app/pages/settings/branding.vue`)
- Thin wrapper that mounts `<SettingsLayout wide>` and embeds `<SettingsBrandingForm />`. Reachable from Settings sidebar and top-level user menu (`constants/menus.ts`)

#### Dashboard integration
- **`SidebarNavHeader.vue`** — Renders `<img>` for `branding.primaryLogo.dataUrl` when present, otherwise the static Elev8 wordmark. Logo swaps reactively after Save
- **`app.vue`** — `useHead()` reactive favicon link bound to `faviconHref` (custom data URL or `/favicon.ico`). Hydration-safe via the `isHydrated` gate — LocalStorage hydration runs only in `onMounted`, so SSR renders the default `/favicon.ico`; client hydration swaps to the custom data URL post-mount

#### Server (`server/`)
- **`server/utils/tenant-branding-store.ts`** — In-process singleton (`currentBranding`) with `getTenantBranding()` / `setTenantBranding(value)` / `resetTenantBranding()`. Stores deep clones; no persistence layer
- **`server/api/tenant-branding/index.put.ts`** — `PUT /api/tenant-branding` validates the body with `isTenantBranding` (returns 400 on invalid payload) and writes via the store
- **`server/api/guest-guides/by-token/[token].get.ts`** — Existing public Guest Guide endpoint now also returns a top-level `branding` object (`primaryLogo`, `favicon`, `guestGuideColors`, `cssVariables`) sourced from `getTenantBranding()` and `buildGuestGuideCssVariables(...)`. `invoiceLogo` is never exposed publicly

#### Guide-app (`guide-app/app/`)
- **`guide-app/app/components/BrandHeader.vue`** — Card with property manager logo above the guide sections. Renders only when `branding.primaryLogo` is present; `data-testid="guest-guide-brand-header"` / `data-testid="guest-guide-brand-logo"` for tests
- **`guide-app/app/pages/[token].vue`** — Applies scoped CSS variables to the guide root via `:style="guideBrandStyle"` (consumed from `data.value.branding.cssVariables`). `useHead()` writes the favicon `<link rel="icon">` from the same branding payload. No color is applied to dashboard chrome
- **`guide-app/app/assets/css/main.css`** — Minimal additions to support the scoped CSS variables (no global overrides)

#### Out of scope (intentionally deferred)
- Real cloud storage / signed URLs — assets live entirely as base64 data URLs in LocalStorage + the server's in-memory store
- Multi-tenant server persistence — store is process-local; restarts reset to defaults
- Invoice renderer / PDF generation — only the `BrandingPreview` invoice tab exists; nothing renders a real invoice
- Website Builder branding reuse — only the dashboard and Guest Guide are wired today
