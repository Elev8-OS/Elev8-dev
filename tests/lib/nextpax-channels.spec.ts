import type { NextPaxPropertyChannel } from '~/components/channels/data/nextpax'
import { describe, expect, it } from 'vitest'
import {
  authorisationAge,
  deriveMappingStatus,
  propertiesNeedingAttention,
} from '~/components/channels/data/nextpax'

function enabled(extra: Partial<NextPaxPropertyChannel> = {}): NextPaxPropertyChannel {
  return {
    channelId: 'AIR298',
    channelStatus: 'enabled',
    ...extra,
  }
}

describe('deriveMappingStatus', () => {
  it('is off without a row or when the channel is disabled', () => {
    expect(deriveMappingStatus(undefined).state).toBe('off')
    expect(deriveMappingStatus(enabled({ channelStatus: 'disabled' })).state).toBe('off')
  })

  it('is syncing while the build or a flow has not finished', () => {
    expect(deriveMappingStatus(enabled({ buildStatus: { isFinished: false, lastJobStatus: 'running' } })).state).toBe('syncing')
    expect(deriveMappingStatus(enabled({
      buildStatus: { isFinished: true, lastJobStatus: 'ok' },
      exportFlowStatuses: [{ channelFlow: 'update-property-images', isFinished: false, lastJobStatus: 'running' }],
    })).state).toBe('syncing')
  })

  it('is live once everything finished without an error', () => {
    expect(deriveMappingStatus(enabled({
      buildStatus: { isFinished: true, lastJobStatus: 'ok' },
      exportFlowStatuses: [{ channelFlow: 'publish-property', isFinished: true, lastJobStatus: 'ok' }],
    })).state).toBe('active')
  })

  it('reports NextPax\'s own error text, build first then flows', () => {
    const fromBuild = deriveMappingStatus(enabled({ buildStatus: { isFinished: true, lastJobStatus: 'failed', lastJobError: 'Missing 5 photos' } }))
    expect(fromBuild).toEqual({ state: 'error', error: 'Missing 5 photos' })

    const fromFlow = deriveMappingStatus(enabled({
      exportFlowStatuses: [{ channelFlow: 'update-property-address', isFinished: true, lastJobStatus: 'failed', lastJobError: 'Address incomplete' }],
    }))
    expect(fromFlow.error).toBe('Address incomplete')
  })

  it('names the flow when it failed without a message', () => {
    const status = deriveMappingStatus(enabled({
      exportFlowStatuses: [{ channelFlow: 'publish-property', isFinished: true, lastJobStatus: 'failed' }],
    }))
    expect(status.error).toBe('publish-property failed')
  })

  it('treats a connect warning as needs attention even when the row looks finished', () => {
    const status = deriveMappingStatus(enabled({ buildStatus: { isFinished: true, lastJobStatus: 'ok' } }), ['property must have rate plan created specifically for Booking.com'])
    expect(status.state).toBe('attention')
    expect(status.error).toContain('rate plan')
  })

  it('lets a failed job outrank a warning', () => {
    const status = deriveMappingStatus(enabled({ buildStatus: { isFinished: true, lastJobStatus: 'failed', lastJobError: 'Missing address' } }), ['rate plan'])
    expect(status).toEqual({ state: 'error', error: 'Missing address' })
  })
})

describe('authorisationAge', () => {
  const now = new Date('2026-10-22T12:00:00')

  it('counts whole days', () => {
    expect(authorisationAge('2026-10-22T08:00:00', now)).toMatchObject({ days: 0, label: 'Saved today' })
    expect(authorisationAge('2026-10-21T08:00:00', now).label).toBe('Saved 1 day ago')
    expect(authorisationAge('2026-10-17T08:00:00', now).label).toBe('Saved 5 days ago')
  })

  it('is stale only past 14 days', () => {
    expect(authorisationAge('2026-10-08T12:00:00', now).stale).toBe(false)
    expect(authorisationAge('2026-10-07T12:00:00', now).stale).toBe(true)
  })

  it('does not guess without a usable date', () => {
    expect(authorisationAge(null, now)).toMatchObject({ days: null, stale: false })
    expect(authorisationAge('not a date', now)).toMatchObject({ days: null, stale: false })
  })
})

describe('connect result helpers', () => {
  it('flags rejected properties and accepted ones with warnings', () => {
    const attention = propertiesNeedingAttention({
      channel_id: 'BOO142',
      enabled: 2,
      failed: 1,
      properties: [
        { property_id: 'a', is_parent: false, enabled: true },
        { property_id: 'b', is_parent: false, enabled: true, warnings: ['channel dropped'] },
        { property_id: 'c', is_parent: false, enabled: false, error: 'rejected' },
      ],
    })
    expect(attention.map(p => p.property_id)).toEqual(['b', 'c'])
  })
})
