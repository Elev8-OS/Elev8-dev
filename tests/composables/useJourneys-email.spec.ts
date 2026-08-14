import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the toast module so we can assert on it
const toastInfo = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('vue-sonner', () => ({
  toast: {
    info: toastInfo,
    success: toastSuccess,
    error: toastError,
  },
}))

const { useJourneys } = await import('~/composables/useJourneys')

describe('useJourneys.onEmailReceived', () => {
  beforeEach(() => {
    toastInfo.mockClear()
  })

  it('does nothing when no journeys have the email_received trigger', () => {
    const { onEmailReceived, journeys } = useJourneys()
    // Default mock journeys have no email triggers
    const before = journeys.value.length
    onEmailReceived({ from: 'guest@example.com', to: 'stay@villacanggu.com', subject: 'Re: stay', content: 'Hi!' })
    expect(journeys.value.length).toBe(before)
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('fires an active journey with email_received trigger and listing scope', () => {
    const { onEmailReceived, saveJourney } = useJourneys()
    saveJourney({
      id: 'j-email-1',
      name: 'Email Auto-Reply Villa',
      status: 'active',
      triggerType: 'email_received',
      lastModified: '2026-08-14',
      properties: ['guest@example.com'],
      steps: [
        {
          id: 's-email-1',
          type: 'trigger',
          name: 'Email Received',
          triggers: [{ type: 'email_received', settings: { triggerImmediately: true } }],
          properties: ['guest@example.com'],
        },
      ],
    })
    onEmailReceived({ from: 'guest@example.com', to: 'stay@villacanggu.com', subject: 'Re: stay', content: 'Hi!' })
    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringContaining('Email Auto-Reply Villa'),
      expect.any(Object),
    )
  })

  it('does NOT fire when journey is inactive', () => {
    const { onEmailReceived, saveJourney } = useJourneys()
    saveJourney({
      id: 'j-email-2',
      name: 'Inactive Email Journey',
      status: 'inactive',
      triggerType: 'email_received',
      lastModified: '2026-08-14',
      properties: ['All Properties'],
      steps: [
        {
          id: 's-email-2',
          type: 'trigger',
          name: 'Email Received',
          triggers: [{ type: 'email_received', settings: { triggerImmediately: true } }],
          properties: ['All Properties'],
        },
      ],
    })
    onEmailReceived({ from: 'guest@example.com', to: 'stay@villacanggu.com', content: 'Hi!' })
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('does NOT fire when sender is not in journey.properties', () => {
    const { onEmailReceived, saveJourney } = useJourneys()
    saveJourney({
      id: 'j-email-3',
      name: 'Scoped Email Journey',
      status: 'active',
      triggerType: 'email_received',
      lastModified: '2026-08-14',
      properties: ['other@example.com'],
      steps: [
        {
          id: 's-email-3',
          type: 'trigger',
          name: 'Email Received',
          triggers: [{ type: 'email_received', settings: { triggerImmediately: true } }],
          properties: ['other@example.com'],
        },
      ],
    })
    onEmailReceived({ from: 'guest@example.com', to: 'stay@villacanggu.com', content: 'Hi!' })
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('fires when journey.properties includes "All Properties" regardless of sender', () => {
    const { onEmailReceived, saveJourney } = useJourneys()
    saveJourney({
      id: 'j-email-4',
      name: 'All Properties Email',
      status: 'active',
      triggerType: 'email_received',
      lastModified: '2026-08-14',
      properties: ['All Properties'],
      steps: [
        {
          id: 's-email-4',
          type: 'trigger',
          name: 'Email Received',
          triggers: [{ type: 'email_received', settings: { triggerImmediately: true } }],
          properties: ['All Properties'],
        },
      ],
    })
    onEmailReceived({ from: 'random@gmail.com', to: 'stay@villacanggu.com', subject: 'Inquiry', content: 'Is it available?' })
    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringContaining('All Properties Email'),
      expect.any(Object),
    )
  })
})
