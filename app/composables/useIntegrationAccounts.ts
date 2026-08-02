import type { MappingIntegration } from '@/composables/useListingMappings'

// ── Account type validation prefixes ───────────────────────────────────────
export const ACCOUNT_PREFIXES = {
  asset: '1',
  liability: '2',
  revenue: '4',
  expense: '5',
} as const

// ── Transaction type definitions per PRD ───────────────────────────────────
export interface BookingRevenueLine {
  debit: string // account ID for debit side
  credit: string // account ID for credit side
}

export interface BookingRevenueAccounts {
  accommodation: BookingRevenueLine
  platformFee: BookingRevenueLine
  fee: BookingRevenueLine
  tax: BookingRevenueLine
}

export interface UpsellRevenueAccounts {
  default: BookingRevenueLine // debit/credit pair
}

export interface CostAccounts {
  default: BookingRevenueLine
}

export interface CityTaxAccounts {
  collectionMode: 'elev8' | 'ota'
  taxCollected: string // 2-xxx liability
  taxRemitted: string // 2-xxx liability (or 1-xxx bank)
}

export interface DefaultAccounts {
  bookingRevenue: BookingRevenueAccounts
  upsellRevenue: UpsellRevenueAccounts
  costs: CostAccounts
  cityTax: CityTaxAccounts
}

// ── Initial defaults ───────────────────────────────────────────────────────
const initialDefaults: Record<MappingIntegration, DefaultAccounts> = {
  jurnal: {
    bookingRevenue: {
      accommodation: { debit: 'ja-1100', credit: 'ja-4100' },
      platformFee: { debit: 'ja-6100', credit: 'ja-1100' },
      fee: { debit: 'ja-5100', credit: 'ja-1100' },
      tax: { debit: 'ja-1100', credit: 'ja-2200' },
    },
    upsellRevenue: {
      default: { debit: 'ja-1100', credit: 'ja-4300' },
    },
    costs: {
      default: { debit: 'ja-5400', credit: 'ja-1100' },
    },
    cityTax: {
      collectionMode: 'elev8',
      taxCollected: 'ja-2200',
      taxRemitted: 'ja-2200',
    },
  },
  bexio: {
    bookingRevenue: {
      accommodation: { debit: 'ba-1100', credit: 'ba-3000' },
      platformFee: { debit: 'ba-6100', credit: 'ba-1100' },
      fee: { debit: 'ba-4000', credit: 'ba-1100' },
      tax: { debit: 'ba-1100', credit: 'ba-2200' },
    },
    upsellRevenue: {
      default: { debit: 'ba-1100', credit: 'ba-3200' },
    },
    costs: {
      default: { debit: 'ba-5000', credit: 'ba-1100' },
    },
    cityTax: {
      collectionMode: 'elev8',
      taxCollected: 'ba-2200',
      taxRemitted: 'ba-2200',
    },
  },
  lexware: {
    bookingRevenue: {
      accommodation: { debit: 'la-1200', credit: 'la-8210' },
      platformFee: { debit: 'la-4500', credit: 'la-1200' },
      fee: { debit: 'la-4600', credit: 'la-1200' },
      tax: { debit: 'la-1200', credit: 'la-3810' },
    },
    upsellRevenue: {
      default: { debit: 'la-1200', credit: 'la-8400' },
    },
    costs: {
      default: { debit: 'la-4200', credit: 'la-1200' },
    },
    cityTax: {
      collectionMode: 'elev8',
      taxCollected: 'la-2200',
      taxRemitted: 'la-2200',
    },
  },
}

// ── Tab definitions for UI ─────────────────────────────────────────────────
export type MappingTab = 'booking' | 'upsell' | 'costs' | 'tax'

export const mappingTabs: { key: MappingTab, label: string, icon: string }[] = [
  { key: 'booking', label: 'Booking Revenue', icon: 'i-lucide-calendar-check' },
  { key: 'upsell', label: 'Upsell Revenue', icon: 'i-lucide-plus-circle' },
  { key: 'costs', label: 'Costs', icon: 'i-lucide-receipt' },
  { key: 'tax', label: 'City Tax', icon: 'i-lucide-receipt' },
]

// ── Validation helpers ─────────────────────────────────────────────────────
export function isValidAccountType(accountCode: string, requiredPrefix: string): boolean {
  return accountCode.startsWith(requiredPrefix)
}

export function getAccountTypeLabel(prefix: string): string {
  const labels: Record<string, string> = {
    1: 'Asset (1-xxx)',
    2: 'Liability (2-xxx)',
    4: 'Revenue (4-xxx)',
    5: 'Expense (5-xxx)',
  }
  return labels[prefix] || 'Unknown'
}

// ── Composable ─────────────────────────────────────────────────────────────
export function useIntegrationAccounts() {
  const defaults = useState<Record<MappingIntegration, DefaultAccounts>>(
    'integration-default-accounts',
    () => JSON.parse(JSON.stringify(initialDefaults)),
  )

  function getDefaults(integration: MappingIntegration): DefaultAccounts {
    return defaults.value[integration]
  }

  function setBookingRevenueLine(integration: MappingIntegration, line: keyof BookingRevenueAccounts, side: 'debit' | 'credit', value: string) {
    defaults.value = {
      ...defaults.value,
      [integration]: {
        ...defaults.value[integration],
        bookingRevenue: {
          ...defaults.value[integration].bookingRevenue,
          [line]: {
            ...defaults.value[integration].bookingRevenue[line],
            [side]: value,
          },
        },
      },
    }
  }

  function setUpsellRevenueLine(integration: MappingIntegration, side: 'debit' | 'credit', value: string) {
    defaults.value = {
      ...defaults.value,
      [integration]: {
        ...defaults.value[integration],
        upsellRevenue: {
          default: {
            ...defaults.value[integration].upsellRevenue.default,
            [side]: value,
          },
        },
      },
    }
  }

  function setCostsLine(integration: MappingIntegration, side: 'debit' | 'credit', value: string) {
    defaults.value = {
      ...defaults.value,
      [integration]: {
        ...defaults.value[integration],
        costs: {
          default: {
            ...defaults.value[integration].costs.default,
            [side]: value,
          },
        },
      },
    }
  }

  function setCityTax(integration: MappingIntegration, field: keyof CityTaxAccounts, value: string) {
    defaults.value = {
      ...defaults.value,
      [integration]: {
        ...defaults.value[integration],
        cityTax: {
          ...defaults.value[integration].cityTax,
          [field]: value,
        },
      },
    }
  }

  return {
    defaults,
    getDefaults,
    setBookingRevenueLine,
    setUpsellRevenueLine,
    setCostsLine,
    setCityTax,
    mappingTabs,
    isValidAccountType,
    getAccountTypeLabel,
  }
}
