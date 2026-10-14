import { describe, expect, it } from 'vitest'
import { describeListingCleaning } from '~/components/reservations/data/cleaning-schedule'

describe('describeListingCleaning', () => {
  it('describes a daily schedule as the daily routine: every day, booked or not', () => {
    expect(describeListingCleaning({ type: 'daily', time: '11:00', startOffset: 'check_in' }))
      .toBe('Cleaned at 11:00: daily cleaning with guests in, check-out cleaning when they leave, vacant upkeep every Mon and Thu while empty.')
  })

  it('describes a check-out cleaning', () => {
    expect(describeListingCleaning({ type: 'checkout', time: '11:00' }))
      .toBe('Cleaned once on check-out day at 11:00.')
  })

  it('describes a day interval and chosen weekdays', () => {
    expect(describeListingCleaning({ type: 'custom', time: '09:00', custom: { frequency: 'day', dayInterval: 3 } }))
      .toBe('Cleaned every 3 days at 09:00, from check-in day.')
    expect(describeListingCleaning({ type: 'custom', time: '09:00', custom: { frequency: 'week', weekDays: ['monday', 'thursday', 'friday'] } }))
      .toBe('Cleaned every Mon, Thu and Fri at 09:00, from check-in day.')
  })

  it('leaves the time out when none is set', () => {
    expect(describeListingCleaning({ type: 'checkout' })).toBe('Cleaned once on check-out day.')
  })
})
