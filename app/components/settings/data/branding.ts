export type BrandingAssetKind = 'primaryLogo' | 'favicon' | 'invoiceLogo'

export interface BrandingAsset {
  name: string
  type: string
  size: number
  dataUrl: string
}

export interface GuestGuideBrandColors {
  primary: string
  background: string
  text: string
}

export interface TenantBranding {
  primaryLogo: BrandingAsset | null
  favicon: BrandingAsset | null
  invoiceLogo: BrandingAsset | null
  guestGuideColors: GuestGuideBrandColors
  /** Color of the main action buttons. Optional so branding saved before it existed stays valid. */
  buttonColor?: string
  updatedAt: string
}

export interface PublicGuestGuideBranding {
  primaryLogo: BrandingAsset | null
  favicon: BrandingAsset | null
  guestGuideColors: GuestGuideBrandColors
  cssVariables: Record<string, string>
}

export const BRANDING_STORAGE_KEY = 'elev8-tenant-branding-v1'
export const DEFAULT_GUEST_GUIDE_COLORS: GuestGuideBrandColors = {
  primary: '#F6BB12',
  background: '#FFFFFF',
  text: '#18181B',
}

export const DEFAULT_BUTTON_COLOR = '#F6BB12'

export function resolveButtonColor(branding: Pick<TenantBranding, 'buttonColor'>): string {
  return isHexColor(branding.buttonColor) ? normalizeHex(branding.buttonColor) : DEFAULT_BUTTON_COLOR
}

export function createDefaultTenantBranding(): TenantBranding {
  return {
    primaryLogo: null,
    favicon: null,
    invoiceLogo: null,
    guestGuideColors: { ...DEFAULT_GUEST_GUIDE_COLORS },
    buttonColor: DEFAULT_BUTTON_COLOR,
    updatedAt: '',
  }
}

export function cloneTenantBranding(value: TenantBranding): TenantBranding {
  return {
    primaryLogo: value.primaryLogo ? { ...value.primaryLogo } : null,
    favicon: value.favicon ? { ...value.favicon } : null,
    invoiceLogo: value.invoiceLogo ? { ...value.invoiceLogo } : null,
    guestGuideColors: { ...value.guestGuideColors },
    buttonColor: resolveButtonColor(value),
    updatedAt: value.updatedAt,
  }
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value)
}

export function normalizeHex(value: string): string {
  return value.toUpperCase()
}

function isBrandingAsset(
  value: unknown,
  allowedTypes: string[],
  maxSize: number,
): value is BrandingAsset {
  if (!value || typeof value !== 'object')
    return false
  const asset = value as Record<string, unknown>
  return typeof asset.name === 'string'
    && typeof asset.type === 'string'
    && allowedTypes.includes(asset.type)
    && typeof asset.size === 'number'
    && asset.size >= 0
    && asset.size <= maxSize
    && typeof asset.dataUrl === 'string'
    && asset.dataUrl.startsWith(`data:${asset.type};base64,`)
}

export function isTenantBranding(value: unknown): value is TenantBranding {
  if (!value || typeof value !== 'object')
    return false
  const branding = value as Record<string, any>
  const colors = branding.guestGuideColors
  const logoTypes = ['image/png', 'image/jpeg', 'image/webp']
  const faviconTypes = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon']
  return (branding.primaryLogo === null || isBrandingAsset(branding.primaryLogo, logoTypes, 1024 * 1024))
    && (branding.favicon === null || isBrandingAsset(branding.favicon, faviconTypes, 512 * 1024))
    && (branding.invoiceLogo === null || isBrandingAsset(branding.invoiceLogo, logoTypes, 1024 * 1024))
    && !!colors
    && isHexColor(colors.primary)
    && isHexColor(colors.background)
    && isHexColor(colors.text)
    && (branding.buttonColor === undefined || isHexColor(branding.buttonColor))
    && typeof branding.updatedAt === 'string'
}

export function resolveInvoiceLogo(branding: TenantBranding): BrandingAsset | null {
  return branding.invoiceLogo ?? branding.primaryLogo
}

export function getBrandingFaviconHref(
  branding?: Pick<TenantBranding, 'favicon'> | null,
): string {
  return branding?.favicon?.dataUrl ?? '/favicon.ico'
}
