import { describe, expect, it } from 'vitest'
import { useUpsellServices } from '~/composables/useUpsellServices'

describe('useUpsellServices filters', () => {
  // The filter bar and the table each call the composable: a filter set in one
  // must narrow the list the other renders.
  it('shares filters between separate callers', () => {
    const bar = useUpsellServices()
    const table = useUpsellServices()
    const all = table.filteredServices.value.length

    bar.filterCategory.value = 'Miscellaneous'

    expect(table.filteredServices.value.length).toBeGreaterThan(0)
    expect(table.filteredServices.value.length).toBeLessThan(all)
    expect(table.filteredServices.value.every(s => s.category === 'Miscellaneous')).toBe(true)

    table.clearFilters()
    expect(bar.filterCategory.value).toBe('all')
    expect(bar.filteredServices.value.length).toBe(all)
  })
})

describe('useUpsellServices search', () => {
  it('matches service names, item names and description text, case-insensitive', () => {
    const { searchQuery, filteredServices, clearFilters } = useUpsellServices()

    searchQuery.value = 'FLOATING'
    expect(filteredServices.value.map(s => s.id).sort()).toEqual(['svc-013', 'svc-014'])

    searchQuery.value = 'large dog'
    expect(filteredServices.value.map(s => s.id)).toEqual(['svc-pet-stay'])

    searchQuery.value = 'canggu kitchen'
    expect(filteredServices.value.map(s => s.id)).toEqual(['svc-013'])

    clearFilters()
    expect(searchQuery.value).toBe('')
  })
})
