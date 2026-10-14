import { beforeEach, describe, expect, it } from 'vitest'
import { CLEANING_STEP_TEMPLATES_STORAGE_KEY, CLEANING_TYPE_DEFAULTS_STORAGE_KEY, SEED_CLEANING_STEP_TEMPLATES, SEED_CLEANING_TYPE_DEFAULTS } from '~/components/cleaning/data/cleaning-step-templates'
import { listings } from '~/components/listings/data/listings'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

const sections = [{ id: 's', title: 'Pool', steps: [{ id: '1', label: 'Skim pool' }] }]

const seededListings = listings.value

beforeEach(() => {
  localStorage.clear()
  listings.value = seededListings
})

describe('useCleaningStepTemplates', () => {
  it('starts a new tenant with a default for every cleaning type, active at once', () => {
    const { typeDefaults, defaultFor } = useCleaningStepTemplates()
    expect(typeDefaults.value).toEqual(SEED_CLEANING_TYPE_DEFAULTS)
    expect(defaultFor('check_out')!.name).toBe('Villa standard')
    expect(defaultFor('daily')!.name).toBe('Daily refresh')
  })

  it('creates a template with its own copy of the steps, and saves it', () => {
    const { createTemplate, templates } = useCleaningStepTemplates()
    const created = createTemplate({ name: '  Pool villa ', sections })
    expect(created.name).toBe('Pool villa')
    expect(created.sections[0]!.id).not.toBe('s')
    expect(templates.value.at(-1)!.id).toBe(created.id)
    expect(localStorage.getItem(CLEANING_STEP_TEMPLATES_STORAGE_KEY)).toContain('Pool villa')
  })

  it('changes one type\'s default and saves it', () => {
    const { setTypeDefault, defaultFor, defaultTypesOf } = useCleaningStepTemplates()
    setTypeDefault('check_out', 'cst-deep')
    expect(defaultFor('check_out')!.id).toBe('cst-deep')
    expect(defaultTypesOf('cst-deep')).toEqual(['check_out', 'custom'])
    expect(JSON.parse(localStorage.getItem(CLEANING_TYPE_DEFAULTS_STORAGE_KEY)!).check_out).toBe('cst-deep')
  })

  it('refuses to delete a template in use without a replacement, and moves its defaults and overrides onto one', () => {
    const { deleteTemplate, getTemplate, defaultFor } = useCleaningStepTemplates()
    expect(deleteTemplate('cst-daily')).toBe(false)
    expect(getTemplate('cst-daily')).toBeTruthy()
    // lst-1 overrides check-out with Deep clean (seed).
    expect(deleteTemplate('cst-deep', 'cst-studio')).toBe(true)
    expect(defaultFor('custom')!.id).toBe('cst-studio')
    expect(listings.value.find(l => l.id === 'lst-1')!.maintenance.cleaningTemplates?.check_out).toBe('cst-studio')
  })

  it('deletes a template nobody uses, and never the last one', () => {
    const { templates, deleteTemplate, createTemplate } = useCleaningStepTemplates()
    const unused = createTemplate({ name: 'Unused', sections })
    expect(deleteTemplate(unused.id)).toBe(true)
    while (templates.value.length > 1) {
      const [first, second] = templates.value
      deleteTemplate(first!.id, second!.id)
    }
    expect(deleteTemplate(templates.value[0]!.id)).toBe(false)
    expect(templates.value).toHaveLength(1)
  })

  it('duplicates as a copy no type defaults to', () => {
    const { duplicateTemplate, defaultTypesOf } = useCleaningStepTemplates()
    const copy = duplicateTemplate('cst-villa')!
    expect(copy.name).toBe('Villa standard (copy)')
    expect(defaultTypesOf(copy.id)).toEqual([])
  })

  it('drops the retired cleaning types and default flag from stored templates', () => {
    const seed = SEED_CLEANING_STEP_TEMPLATES.find(t => t.id === 'cst-daily')!
    localStorage.setItem(CLEANING_STEP_TEMPLATES_STORAGE_KEY, JSON.stringify([
      { ...seed, cleaningTypes: ['daily', 'mid_stay'], isDefault: true },
    ]))
    const stored = useCleaningStepTemplates().getTemplate('cst-daily')!
    expect('cleaningTypes' in stored).toBe(false)
    expect('isDefault' in stored).toBe(false)
  })

  it('fills every type\'s default from what is left when the stored defaults are gone', () => {
    const seed = SEED_CLEANING_STEP_TEMPLATES.find(t => t.id === 'cst-studio')!
    localStorage.setItem(CLEANING_STEP_TEMPLATES_STORAGE_KEY, JSON.stringify([seed]))
    expect(useCleaningStepTemplates().typeDefaults.value).toEqual({ check_out: 'cst-studio', daily: 'cst-studio', mid_stay: 'cst-studio', vacant: 'cst-studio', custom: 'cst-studio' })
  })
})
