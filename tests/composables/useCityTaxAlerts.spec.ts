import { describe, expect, it } from 'vitest'
import {
  alertDisplayLabels,
  alertIcons,
  alertRouteMap,
  getDescription,
} from '~/components/notifications/data/alerts'
import { notificationCategories } from '~/components/notifications/data/notification-settings'
import { parseCityTaxFilter } from '~/composables/useCityTax'

const CITY_TAX_TYPES = [
  'CITY_TAX_COLLECTION_UPCOMING',
  'CITY_TAX_COLLECTION_DUE',
  'CITY_TAX_COLLECTION_MISSED',
] as const

/** Each alert opens the Reservations list on the City tax filter that holds its stay. */
const ALERT_ROUTES = {
  CITY_TAX_COLLECTION_UPCOMING: '/reservations?cityTax=upcoming',
  CITY_TAX_COLLECTION_DUE: '/reservations?cityTax=due_today',
  CITY_TAX_COLLECTION_MISSED: '/reservations?cityTax=overdue',
} as const

describe('city tax alert metadata', () => {
  it.each(CITY_TAX_TYPES)('%s has a label, an icon and a route', (type) => {
    expect(alertDisplayLabels[type]).toBeTruthy()
    expect(alertIcons[type]).toBeTruthy()
    expect(alertRouteMap[type]).toBe(ALERT_ROUTES[type])
  })

  it.each(CITY_TAX_TYPES)('%s links to a filter the Reservations page understands', (type) => {
    const filter = new URL(alertRouteMap[type]!, 'http://localhost').searchParams.get('cityTax')
    expect(parseCityTaxFilter(filter)).not.toBe('all')
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
