import { describe, expect, it } from 'vitest'
import {
  alertDisplayLabels,
  alertIcons,
  alertRouteMap,
  getDescription,
} from '~/components/notifications/data/alerts'
import { notificationCategories } from '~/components/notifications/data/notification-settings'

const CITY_TAX_TYPES = [
  'CITY_TAX_COLLECTION_UPCOMING',
  'CITY_TAX_COLLECTION_DUE',
  'CITY_TAX_COLLECTION_MISSED',
] as const

describe('city tax alert metadata', () => {
  it.each(CITY_TAX_TYPES)('%s has a label, an icon and a route', (type) => {
    expect(alertDisplayLabels[type]).toBeTruthy()
    expect(alertIcons[type]).toBeTruthy()
    expect(alertRouteMap[type]).toBe('/city-tax')
  })

  it('describes the collection with the guest, the property and the amount', () => {
    const description = getDescription('CITY_TAX_COLLECTION_DUE', {
      guest_name: 'Anna Schmidt',
      listing_name: 'Villa Merapi',
      amount_label: 'EUR 24.00',
    })
    expect(description).toContain('Anna Schmidt')
    expect(description).toContain('Villa Merapi')
    expect(description).toContain('EUR 24.00')
  })

  it.each(CITY_TAX_TYPES)('%s sits in a notification category, or it is invisible in the bell', (type) => {
    const covered = notificationCategories.some(category => category.alertTypes.includes(type))
    expect(covered).toBe(true)
  })
})
