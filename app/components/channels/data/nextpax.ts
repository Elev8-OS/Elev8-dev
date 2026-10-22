/**
 * NextPax shapes and the pure rules the Channels UI derives from them. Mock
 * only: the prototype never calls NextPax, but its fixtures use these shapes so
 * the real client can replace them. Spec: `docs/claude/nextpax-channels.md`.
 * Imports only types, so anything can import it without a cycle.
 */
import type { ChannelMappingStatus } from './channels'

/** NextPax's internal booking channel. Always on, never an OTA the host connects. */
export const NEXTPAX_INTERNAL_CHANNEL = 'MAK346'

/** An authorisation link older than this is worth replacing. A product choice, not a channel rule. */
export const AUTHORISATION_STALE_DAYS = 14

/**
 * NextPax code per Elev8 channel name. Only the four codes the backend names;
 * the rest are resolved from `GET /constants/channel-codes` at runtime, so they
 * stay out of here rather than being guessed.
 */
const NEXTPAX_CODES: Record<string, string> = {
  'Airbnb': 'AIR298',
  'Booking.com': 'BOO142',
  'Vrbo': 'HOM143',
  'Expedia': 'EXP270',
}

export const nextPaxCode = (channelName: string): string | undefined => NEXTPAX_CODES[channelName]

export interface NextPaxExportFlow {
  channelFlow: string
  isFinished: boolean
  lastJobStatus: string
  lastJobTime?: string
  lastJobError?: string
}

/** One channel on one property, as `GET /properties/:id/channel-status` returns it. */
export interface NextPaxPropertyChannel {
  channelId: string
  channelStatus: 'enabled' | 'disabled'
  contentStatus?: string
  channelPropertyStatus?: string
  channelPropertyId?: string
  channelRoomId?: string
  channelHostId?: string
  channelPropertyUrl?: string
  propertyStatusNote?: string
  buildStatus?: { isFinished: boolean, lastJobStatus: string, lastJobError?: string }
  exportFlowStatuses?: NextPaxExportFlow[]
}

export type NextPaxMappingState = ChannelMappingStatus | 'off'

export interface NextPaxMappingStatus {
  state: NextPaxMappingState
  /** NextPax's own words, or the connect warning. Never a generic message. */
  error?: string
}

/**
 * Live, syncing, needs attention or error for one property on one channel. A
 * failed job is an error. A connect warning is "needs attention" even when the
 * row looks finished: Booking.com answers 200 and drops the channel, and the
 * warning is the only trace. `channelPropertyStatus` is not read because its
 * values are undocumented.
 */
export function deriveMappingStatus(row: NextPaxPropertyChannel | undefined, warnings: string[] = []): NextPaxMappingStatus {
  if (!row || row.channelStatus !== 'enabled')
    return { state: 'off' }

  const flows = row.exportFlowStatuses ?? []
  const failedFlow = flows.find(f => f.lastJobError || f.lastJobStatus === 'failed')
  const error = row.buildStatus?.lastJobError
    ?? failedFlow?.lastJobError
    ?? (failedFlow ? `${failedFlow.channelFlow} failed` : undefined)
  if (error)
    return { state: 'error', error }
  if (warnings[0])
    return { state: 'attention', error: warnings[0] }

  const finished = (row.buildStatus?.isFinished ?? true) && flows.every(f => f.isFinished)
  return { state: finished ? 'active' : 'syncing' }
}

/** Days since the host saved an authorisation link, and whether it is old enough to replace. */
export function authorisationAge(setAt: string | null | undefined, now: Date = new Date()) {
  if (!setAt)
    return { days: null, stale: false, label: 'Link saved' }
  const saved = new Date(setAt).getTime()
  if (Number.isNaN(saved))
    return { days: null, stale: false, label: 'Link saved' }
  const days = Math.max(0, Math.floor((now.getTime() - saved) / 86_400_000))
  const label = days === 0 ? 'Saved today' : days === 1 ? 'Saved 1 day ago' : `Saved ${days} days ago`
  return { days, stale: days > AUTHORISATION_STALE_DAYS, label }
}

export interface ConnectResultProperty {
  property_id: string
  is_parent: boolean
  enabled: boolean
  error?: string
  warnings?: string[]
}

export interface ConnectResult {
  channel_id: string
  enabled: number
  failed: number
  properties: ConnectResultProperty[]
}

/** Properties the host must look at: rejected ones and accepted ones that carry a warning. */
export function propertiesNeedingAttention(result: ConnectResult) {
  return result.properties.filter(p => !p.enabled || (p.warnings?.length ?? 0) > 0)
}
