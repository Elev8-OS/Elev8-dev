import { describe, expect, it } from 'vitest'
import { useCockpitLog } from '~/composables/useCockpitLog'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'

describe('useCockpitLog', () => {
  it('records each change newest first, with the signed-in user and the time', () => {
    const { entries, logChange } = useCockpitLog()
    const before = Date.now()
    logChange({ kind: 'block', title: 'Nights blocked', detail: 'Garden Unit, 10 Oct to 12 Oct 2026, 2 nights. Reason: Maintenance.' })
    logChange({ kind: 'override', title: 'Override saved', detail: 'Stop Sell.', listingName: 'Villa Lumbung' })

    expect(entries.value.map(e => e.title)).toEqual(['Override saved', 'Nights blocked'])
    const name = useCurrentDashboardUser().currentUser.value?.name
    expect(name).toBeTruthy()
    expect(entries.value[0]).toMatchObject({ kind: 'override', actor: name, listingName: 'Villa Lumbung' })
    expect(new Date(entries.value[0]!.at).getTime()).toBeGreaterThanOrEqual(before)
    expect(new Set(entries.value.map(e => e.id)).size).toBe(2)
  })
})
