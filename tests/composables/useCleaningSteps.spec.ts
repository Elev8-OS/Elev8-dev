import { describe, expect, it } from 'vitest'
import { hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import { useCleaningSteps } from '~/composables/useCleaningSteps'

describe('useCleaningSteps.copyStepsToListings', () => {
  it('replaces the steps of the chosen listings only, each with its own copy', () => {
    const snapshot = listings.value
    try {
      const targets = listings.value.filter(l => !hasCleaningSteps(l)).slice(0, 2).map(l => l.id)
      const untouched = listings.value.find(l => !targets.includes(l.id))!
      const steps = [{ id: 's', title: 'Pool', steps: [{ id: '1', label: 'Skim pool' }] }]
      expect(useCleaningSteps().copyStepsToListings(steps, targets)).toBe(2)
      const [a, b] = targets.map(id => listings.value.find(l => l.id === id)!)
      expect(a!.maintenance.cleaningSteps![0]!.steps[0]!.label).toBe('Skim pool')
      expect(a!.maintenance.cleaningSteps).not.toBe(b!.maintenance.cleaningSteps)
      expect(listings.value.find(l => l.id === untouched.id)).toBe(untouched)
    }
    finally {
      listings.value = snapshot
    }
  })
})
