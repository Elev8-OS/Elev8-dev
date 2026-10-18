import { describe, expect, it } from 'vitest'
import { checkinStepsLeadHours, clampCheckinStepsHours, describeCheckinStepsVisibility, listingCheckinStepsVisibility } from '~/components/listings/data/checkin-steps-visibility'

describe('check-in steps visibility', () => {
  it('defaults to 24 hours before check-in', () => {
    const v = listingCheckinStepsVisibility({})
    expect(v).toEqual({ mode: 'hours_before', hoursBefore: 24 })
    expect(checkinStepsLeadHours(v)).toBe(24)
  })

  it('reads always and a custom number of hours', () => {
    expect(checkinStepsLeadHours({ mode: 'always', hoursBefore: 24 })).toBeNull()
    expect(listingCheckinStepsVisibility({ checkinStepsVisibility: { hoursBefore: 48 } }).hoursBefore).toBe(48)
    expect(describeCheckinStepsVisibility({ mode: 'hours_before', hoursBefore: 48 })).toBe('Guests see the check-in steps 48 hours before check-in.')
    expect(describeCheckinStepsVisibility({ mode: 'hours_before', hoursBefore: 1 })).toContain('1 hour before')
  })

  it('keeps hours between 1 and 720', () => {
    expect(clampCheckinStepsHours(0)).toBe(1)
    expect(clampCheckinStepsHours(5000)).toBe(720)
    expect(clampCheckinStepsHours(Number.NaN)).toBe(24)
  })
})
