/**
 * `configured` is for file-handoff integrations (DATEV) that have per-tenant
 * settings but no live connection to be "connected" to.
 */
export type IntegrationStatus = 'connected' | 'configured' | 'available' | 'coming_soon'
export type IntegrationCategory = 'Accounting' | 'HR & Payroll' | 'Payments' | 'Operations'

export interface Integration {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  icon: string
  logo?: string
  /**
   * Tailwind sizing for the logo in the tile grid. Defaults to a landscape
   * wordmark; square lockups (DATEV) need more height to stay legible.
   */
  logoClass?: string
  status: IntegrationStatus
  component?: string
  docsUrl?: string
}

export const integrations: Integration[] = [
  {
    id: 'mekari-jurnal',
    name: 'Mekari Jurnal',
    description: 'Push cost and revenue entries to your Jurnal accounting ledger.',
    category: 'Accounting',
    icon: 'i-lucide-book-open',
    logo: 'FinanceJurnalLogo',
    status: 'connected',
    component: 'FinanceJurnalIntegration',
  },
  {
    id: 'bexio',
    name: 'bexio',
    description: 'Sync financial data with bexio for Swiss accounting and invoicing.',
    category: 'Accounting',
    icon: 'i-lucide-file-spreadsheet',
    logo: 'FinanceBexioLogo',
    status: 'available',
    component: 'FinanceBexioIntegration',
  },
  {
    id: 'lexware',
    name: 'Lexware',
    description: 'Push finalized EUR revenue as GoBD-ready drafts to Lexware for German bookkeeping.',
    category: 'Accounting',
    icon: 'i-lucide-landmark',
    logo: 'FinanceLexwareLogo',
    status: 'available',
    component: 'FinanceLexwareIntegration',
  },
  {
    id: 'datev',
    name: 'DATEV',
    description: 'Export a Buchungsstapel (EXTF) your German tax advisor imports in one click.',
    category: 'Accounting',
    icon: 'i-lucide-file-spreadsheet',
    logo: 'FinanceDatevLogo',
    logoClass: 'h-8 w-auto',
    status: 'available',
    component: 'FinanceDatevExportSettings',
    docsUrl: 'https://developer.datev.de/en/file-format/details/datev-format/getting-started',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Connect to Xero for cloud-based accounting and bookkeeping.',
    category: 'Accounting',
    icon: 'i-lucide-circle-dollar-sign',
    status: 'coming_soon',
  },
  {
    id: 'mekari-talenta',
    name: 'Mekari Talenta',
    description: 'Sync staff salary data and push labor costs to Talenta payroll.',
    category: 'HR & Payroll',
    icon: 'i-lucide-users',
    status: 'coming_soon',
  },
]
