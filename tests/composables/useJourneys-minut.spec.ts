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

// Stub useMinut so onMinutEvent doesn't depend on real device seeding
const { useJourneys } = await import('~/composables/useJourneys')

describe('useJourneys.onMinutEvent', () => {
  beforeEach(() => {
    toastInfo.mockClear()
  })

  it('does nothing when no journeys match the event type', () => {
    const { onMinutEvent, journeys } = useJourneys()
    // Default mock journeys have no Minut triggers
    const before = journeys.value.length
    onMinutEvent({ id: 'evt-1', type: 'noise', deviceId: 'dev-001', listingId: 'lst-1', timestamp: new Date().toISOString(), dbLevel: 85 })
    expect(journeys.value.length).toBe(before)
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('fires an active journey with matching Minut trigger and listing scope', () => {
    const { onMinutEvent, saveJourney } = useJourneys()
    saveJourney({
      id: 'j-test-1',
      name: 'Noise Alert Villa Kastila',
      status: 'active',
      triggerType: 'minut_noise',
      lastModified: '2026-07-29',
      properties: ['lst-1'],
      steps: [
        {
          id: 's-test-1',
          type: 'trigger',
          name: 'Minut Noise',
          triggers: [{ type: 'minut_noise', settings: { triggerImmediately: true } }],
          properties: ['lst-1'],
        },
      ],
    })
    onMinutEvent({ id: 'evt-2', type: 'noise', deviceId: 'dev-001', listingId: 'lst-1', timestamp: new Date().toISOString(), dbLevel: 95 })
    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringContaining('Noise Alert Villa Kastila'),
      expect.any(Object),
    )
  })

  it('does NOT fire when journey is inactive', () => {
    const { onMinutEvent, saveJourney } = useJourneys()
    saveJourney({
      id: 'j-test-2',
      name: 'Inactive Journey',
      status: 'inactive',
      triggerType: 'minut_smoke',
      lastModified: '2026-07-29',
      properties: ['All Properties'],
      steps: [
        {
          id: 's-test-2',
          type: 'trigger',
          name: 'Smoke',
          triggers: [{ type: 'minut_smoke', settings: { triggerImmediately: true } }],
          properties: ['All Properties'],
        },
      ],
    })
    onMinutEvent({ id: 'evt-3', type: 'smoke', deviceId: 'dev-001', listingId: 'lst-1', timestamp: new Date().toISOString() })
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('does NOT fire when event listingId is not in journey.properties', () => {
    const { onMinutEvent, saveJourney } = useJourneys()
    saveJourney({
      id: 'j-test-3',
      name: 'Scoped Journey',
      status: 'active',
      triggerType: 'minut_noise',
      lastModified: '2026-07-29',
      properties: ['lst-99'], // not lst-1
      steps: [
        {
          id: 's-test-3',
          type: 'trigger',
          name: 'Noise',
          triggers: [{ type: 'minut_noise', settings: { triggerImmediately: true } }],
          properties: ['lst-99'],
        },
      ],
    })
    onMinutEvent({ id: 'evt-4', type: 'noise', deviceId: 'dev-001', listingId: 'lst-1', timestamp: new Date().toISOString(), dbLevel: 90 })
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('fires when journey.properties includes "All Properties" regardless of listingId', () => {
    const { onMinutEvent, saveJourney } = useJourneys()
    saveJourney({
      id: 'j-test-4',
      name: 'All Properties Smoke',
      status: 'active',
      triggerType: 'minut_smoke',
      lastModified: '2026-07-29',
      properties: ['All Properties'],
      steps: [
        {
          id: 's-test-4',
          type: 'trigger',
          name: 'Smoke',
          triggers: [{ type: 'minut_smoke', settings: { triggerImmediately: true } }],
          properties: ['All Properties'],
        },
      ],
    })
    onMinutEvent({ id: 'evt-5', type: 'smoke', deviceId: 'dev-001', listingId: 'lst-7', timestamp: new Date().toISOString() })
    expect(toastInfo).toHaveBeenCalledWith(
      expect.stringContaining('All Properties Smoke'),
      expect.any(Object),
    )
  })
})
