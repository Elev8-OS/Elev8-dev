import { beforeEach, describe, expect, it } from 'vitest'
import type { MessageStep } from '~/components/journeys/data/journeys'

const { useWhatsApp } = await import('~/composables/useWhatsApp')
const { useJourneys } = await import('~/composables/useJourneys')

function waStep(): MessageStep {
  return {
    id: 's-wa',
    type: 'message',
    name: 'Send WhatsApp',
    messageMode: 'template',
    channel: 'whatsapp',
    templateText: '',
    directive: '',
    contextCheckEnabled: false,
    contextCheckInstruction: '',
    fallback: 'skip',
    fallbackText: '',
    whatsappTemplateId: 'wt-welcome-message',
  }
}

describe('useJourneys.resolveWhatsAppStep', () => {
  beforeEach(() => {
    // Ensure a clean connection state between tests.
    const { disconnect } = useWhatsApp()
    disconnect()
  })

  it('fires for a listing assigned to a connected WhatsApp account', () => {
    const { addAccount } = useWhatsApp()
    addAccount({
      id: 'wa-1',
      businessName: 'Elev8 Bali Office',
      displayPhoneNumber: '+62 811 2345 6789',
      phoneNumberId: 'pn-1',
      wabaId: 'waba-1',
      accessToken: 'tok',
      webhookToken: 'whk',
      status: 'connected',
      connectedAt: '2026-08-26',
      listingIds: ['lst-1'],
    })

    const { resolveWhatsAppStep } = useJourneys()
    expect(resolveWhatsAppStep(waStep(), 'lst-1')).toEqual({ fire: true, accountId: 'wa-1' })
  })

  it('skips (uncovered) for a listing with no connected WhatsApp account', () => {
    const { addAccount } = useWhatsApp()
    addAccount({
      id: 'wa-1',
      businessName: 'Elev8 Bali Office',
      displayPhoneNumber: '+62 811 2345 6789',
      phoneNumberId: 'pn-1',
      wabaId: 'waba-1',
      accessToken: 'tok',
      webhookToken: 'whk',
      status: 'connected',
      connectedAt: '2026-08-26',
      listingIds: ['lst-1'],
    })

    const { resolveWhatsAppStep } = useJourneys()
    // lst-2 is NOT in wa-1.listingIds
    expect(resolveWhatsAppStep(waStep(), 'lst-2')).toEqual({ fire: false, reason: 'uncovered' })
  })

  it('returns not_whatsapp for a non-WhatsApp message step', () => {
    const otaStep: MessageStep = {
      ...waStep(),
      channel: 'ota',
    }

    const { resolveWhatsAppStep } = useJourneys()
    expect(resolveWhatsAppStep(otaStep, 'lst-1')).toEqual({ fire: false, reason: 'not_whatsapp' })
  })

  it('skips every listing when no WhatsApp account is connected at all', () => {
    const { resolveWhatsAppStep } = useJourneys()
    expect(resolveWhatsAppStep(waStep(), 'lst-1')).toEqual({ fire: false, reason: 'uncovered' })
  })
})

describe('useWhatsApp.resolveWhatsAppCoverage', () => {
  beforeEach(() => {
    const { disconnect } = useWhatsApp()
    disconnect()
  })

  it('splits a listing set into covered and uncovered', () => {
    const { addAccount } = useWhatsApp()
    addAccount({
      id: 'wa-1',
      businessName: 'Elev8 Bali Office',
      displayPhoneNumber: '+62 811 2345 6789',
      phoneNumberId: 'pn-1',
      wabaId: 'waba-1',
      accessToken: 'tok',
      webhookToken: 'whk',
      status: 'connected',
      connectedAt: '2026-08-26',
      listingIds: ['lst-1', 'lst-3'],
    })

    const { resolveWhatsAppCoverage } = useWhatsApp()
    expect(resolveWhatsAppCoverage(['lst-1', 'lst-2', 'lst-3'])).toEqual({
      covered: ['lst-1', 'lst-3'],
      uncovered: ['lst-2'],
    })
  })

  it('does not treat a disconnected or pending account as covered', () => {
    const { addAccount } = useWhatsApp()
    addAccount({
      id: 'wa-1',
      businessName: 'Elev8 Bali Office',
      displayPhoneNumber: '+62 811 2345 6789',
      phoneNumberId: 'pn-1',
      wabaId: 'waba-1',
      accessToken: 'tok',
      webhookToken: 'whk',
      status: 'pending',
      connectedAt: '',
      listingIds: ['lst-1'],
    })

    const { resolveWhatsAppCoverage } = useWhatsApp()
    expect(resolveWhatsAppCoverage(['lst-1'])).toEqual({
      covered: [],
      uncovered: ['lst-1'],
    })
  })
})
