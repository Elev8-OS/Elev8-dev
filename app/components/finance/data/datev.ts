/**
 * DATEV Buchungsstapel export — per-tenant settings, chart-of-accounts
 * defaults, and the first-run setup steps.
 *
 * Every account number here is a *default suggestion*. The authoritative values
 * always come from the tenant's tax advisor, which is why they are editable
 * per-tenant and never hardcoded into the export itself.
 */

export type SkrChart = 'SKR03' | 'SKR04'

/** Booking channels that get their own revenue account. */
export const DATEV_CHANNELS = ['Airbnb', 'Booking.com', 'Direct', 'Ctrip'] as const
export type DatevChannel = (typeof DATEV_CHANNELS)[number]

export interface DatevSettings {
  /** Tax advisor's DATEV ID, up to 7 digits. Header field 11. */
  beraternummer: string
  /** Tenant's client number at that advisor, 1-5 digits. Header field 12. */
  mandantennummer: string
  /** Chart of accounts. Drives all default account numbers. */
  skr: SkrChart
  /** Fiscal year start, stored as day + month (the year comes from the period). */
  fiscalYearStartDay: number
  fiscalYearStartMonth: number
  /** Collective receivables account posted against revenue. */
  debitorenkonto: string
  /** Fallback revenue account for channels without their own. */
  erloeskonto: string
  /** Per-channel revenue accounts, so the advisor sees revenue split by source. */
  channelAccounts: Record<string, string>
  /** Whether cancelled reservations appear in the export (as reversals). */
  includeCancelled: boolean
  /** Recipient of the prefilled e-mail draft. */
  advisorEmail: string
}

interface SkrDefaults {
  label: string
  description: string
  debitorenkonto: string
  erloeskonto: string
  /** The reduced-rate account, shown as a hint for accommodation revenue. */
  reducedRateAccount: string
  channelAccounts: Record<DatevChannel, string>
}

/**
 * SKR03 numbers revenue in the 8xxx range, SKR04 in the 4xxx range — the single
 * most common source of a rejected import is using the wrong family here.
 */
export const SKR_DEFAULTS: Record<SkrChart, SkrDefaults> = {
  SKR03: {
    label: 'SKR03',
    description: 'Prozessgliederungsprinzip — revenue in 8xxx, the most widely used chart.',
    debitorenkonto: '10000',
    erloeskonto: '8400',
    reducedRateAccount: '8300',
    channelAccounts: {
      'Airbnb': '8401',
      'Booking.com': '8402',
      'Direct': '8403',
      'Ctrip': '8404',
    },
  },
  SKR04: {
    label: 'SKR04',
    description: 'Abschlussgliederungsprinzip — revenue in 4xxx, ordered like the balance sheet.',
    debitorenkonto: '10000',
    erloeskonto: '4400',
    reducedRateAccount: '4300',
    channelAccounts: {
      'Airbnb': '4401',
      'Booking.com': '4402',
      'Direct': '4403',
      'Ctrip': '4404',
    },
  },
}

export const DATEV_STORAGE_KEY = 'elev8-datev-settings-v1'
export const DATEV_HISTORY_STORAGE_KEY = 'elev8-datev-history-v1'

/**
 * Settings start empty for the two numbers only the advisor can supply, so the
 * UI can tell "not set up yet" from "set up with defaults".
 */
export function createDefaultDatevSettings(skr: SkrChart = 'SKR03'): DatevSettings {
  const defaults = SKR_DEFAULTS[skr]
  return {
    beraternummer: '',
    mandantennummer: '',
    skr,
    fiscalYearStartDay: 1,
    fiscalYearStartMonth: 1,
    debitorenkonto: defaults.debitorenkonto,
    erloeskonto: defaults.erloeskonto,
    channelAccounts: { ...defaults.channelAccounts },
    includeCancelled: false,
    advisorEmail: '',
  }
}

/** Re-seeds every account field from the given chart, keeping identity fields. */
export function applySkrDefaults(settings: DatevSettings, skr: SkrChart): DatevSettings {
  const defaults = SKR_DEFAULTS[skr]
  return {
    ...settings,
    skr,
    debitorenkonto: defaults.debitorenkonto,
    erloeskonto: defaults.erloeskonto,
    channelAccounts: { ...defaults.channelAccounts },
  }
}

export function isDatevConfigured(settings: DatevSettings): boolean {
  return (
    /^\d{1,7}$/.test(settings.beraternummer)
    && /^\d{1,5}$/.test(settings.mandantennummer)
    && /^\d{4,8}$/.test(settings.debitorenkonto)
    && /^\d{4,8}$/.test(settings.erloeskonto)
  )
}

/** Field-level validation surfaced inline in the settings form. */
export function validateDatevSettings(settings: DatevSettings): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!settings.beraternummer)
    errors.beraternummer = 'Required — your tax advisor provides this.'
  else if (!/^\d{1,7}$/.test(settings.beraternummer))
    errors.beraternummer = 'Must be 1-7 digits.'

  if (!settings.mandantennummer)
    errors.mandantennummer = 'Required — your client number at the advisor.'
  else if (!/^\d{1,5}$/.test(settings.mandantennummer))
    errors.mandantennummer = 'Must be 1-5 digits.'

  if (!/^\d{4,8}$/.test(settings.debitorenkonto))
    errors.debitorenkonto = 'Must be 4-8 digits.'

  if (!/^\d{4,8}$/.test(settings.erloeskonto))
    errors.erloeskonto = 'Must be 4-8 digits.'

  for (const [channel, account] of Object.entries(settings.channelAccounts)) {
    if (account && !/^\d{4,8}$/.test(account))
      errors[`channel:${channel}`] = 'Must be 4-8 digits.'
  }

  if (settings.advisorEmail && !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(settings.advisorEmail))
    errors.advisorEmail = 'Enter a valid e-mail address.'

  return errors
}

/**
 * First-run setup, split into the three questions a tenant has to answer.
 * A new tenant starts unconfigured, so this is the path they actually walk;
 * the flat form is the "come back and change one number" surface.
 */
export const DATEV_SETUP_STEPS = [
  {
    id: 'advisor',
    title: 'Advisor & client',
    description: 'The two numbers that route the batch to your file at the Kanzlei.',
  },
  {
    id: 'accounts',
    title: 'Kontenrahmen & accounts',
    description: 'Which chart your advisor books on, and where revenue lands.',
  },
  {
    id: 'handover',
    title: 'Handover',
    description: 'How cancellations are posted and who receives the file.',
  },
] as const

export type DatevSetupStepId = (typeof DATEV_SETUP_STEPS)[number]['id']

/** Which validation keys belong to which step, so a step gates on its own fields. */
const SETUP_STEP_FIELDS: Record<DatevSetupStepId, (key: string) => boolean> = {
  advisor: key => key === 'beraternummer' || key === 'mandantennummer',
  accounts: key => key === 'debitorenkonto' || key === 'erloeskonto' || key.startsWith('channel:'),
  handover: key => key === 'advisorEmail',
}

/**
 * Errors for one wizard step only. Validating the whole object per step would
 * light up fields the tenant has not reached yet.
 */
export function validateDatevSetupStep(
  settings: DatevSettings,
  step: DatevSetupStepId,
): Record<string, string> {
  const belongsToStep = SETUP_STEP_FIELDS[step]
  return Object.fromEntries(
    Object.entries(validateDatevSettings(settings)).filter(([key]) => belongsToStep(key)),
  )
}

/** One generated file, kept so a period can be re-downloaded and audited. */
export interface DatevExportRecord {
  id: string
  periodFrom: string
  periodTo: string
  generatedAt: string
  generatedBy: string
  recordCount: number
  totalAmount: number
  currency: string
  filename: string
  /** Full EXTF text, so re-download does not re-derive from changed data. */
  content: string
  beraternummer: string
  mandantennummer: string
  skr: SkrChart
  /** True once the tenant used the e-mail draft for this export. */
  emailed: boolean
}

/**
 * A fully configured example, kept as a fixture for tests and as the shape the
 * setup flow produces. The app itself never seeds this — `useDatev` starts a
 * tenant on `createDefaultDatevSettings()` so "not set up yet" is a real state.
 */
export const exampleDatevSettings: DatevSettings = {
  beraternummer: '1234567',
  mandantennummer: '10234',
  skr: 'SKR03',
  fiscalYearStartDay: 1,
  fiscalYearStartMonth: 1,
  debitorenkonto: '10000',
  erloeskonto: '8400',
  channelAccounts: { ...SKR_DEFAULTS.SKR03.channelAccounts },
  includeCancelled: false,
  advisorEmail: 'kanzlei@steuerberater-mueller.de',
}

export function formatFiscalYearStart(settings: DatevSettings): string {
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${pad(settings.fiscalYearStartDay)}.${pad(settings.fiscalYearStartMonth)}.`
}
