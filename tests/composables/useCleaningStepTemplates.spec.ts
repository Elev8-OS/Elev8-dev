import { beforeEach, describe, expect, it } from 'vitest'
import { CLEANING_STEP_TEMPLATES_STORAGE_KEY, SEED_CLEANING_STEP_TEMPLATES } from '~/components/cleaning/data/cleaning-step-templates'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

const sections = [{ id: 's', title: 'Pool', steps: [{ id: '1', label: 'Skim pool' }] }]

beforeEach(() => {
  localStorage.clear()
})

describe('useCleaningStepTemplates', () => {
  it('seeds several templates with exactly one default', () => {
    const { templates, defaultTemplate } = useCleaningStepTemplates()
    expect(templates.value.length).toBeGreaterThan(1)
    expect(templates.value.filter(t => t.isDefault)).toHaveLength(1)
    expect(defaultTemplate.value?.isDefault).toBe(true)
  })

  it('creates a template with its own copy of the steps, and saves it', () => {
    const { createTemplate, templates } = useCleaningStepTemplates()
    const created = createTemplate({ name: '  Pool villa ', sections })
    expect(created.name).toBe('Pool villa')
    expect(created.sections[0]!.id).not.toBe('s')
    expect(templates.value.at(-1)!.id).toBe(created.id)
    expect(localStorage.getItem(CLEANING_STEP_TEMPLATES_STORAGE_KEY)).toContain('Pool villa')
  })

  it('keeps exactly one default when another is set', () => {
    const { templates, setDefaultTemplate, defaultTemplate } = useCleaningStepTemplates()
    const other = templates.value.find(t => !t.isDefault)!
    setDefaultTemplate(other.id)
    expect(defaultTemplate.value?.id).toBe(other.id)
    expect(templates.value.filter(t => t.isDefault)).toHaveLength(1)
  })

  it('creating a default template clears the old default', () => {
    const { createTemplate, templates } = useCleaningStepTemplates()
    const created = createTemplate({ name: 'New default', sections, isDefault: true })
    expect(templates.value.filter(t => t.isDefault).map(t => t.id)).toEqual([created.id])
  })

  it('promotes another template when the default is deleted, and never deletes the last one', () => {
    const { templates, deleteTemplate, defaultTemplate } = useCleaningStepTemplates()
    const oldDefault = defaultTemplate.value!
    expect(deleteTemplate(oldDefault.id)).toBe(true)
    expect(templates.value.filter(t => t.isDefault)).toHaveLength(1)
    while (templates.value.length > 1)
      deleteTemplate(templates.value[0]!.id)
    expect(deleteTemplate(templates.value[0]!.id)).toBe(false)
    expect(templates.value).toHaveLength(1)
  })

  it('duplicates as a non-default copy', () => {
    const { defaultTemplate, duplicateTemplate } = useCleaningStepTemplates()
    const copy = duplicateTemplate(defaultTemplate.value!.id)!
    expect(copy.name).toBe(`${defaultTemplate.value!.name} (copy)`)
    expect(copy.isDefault).toBe(false)
  })

  it('stores cleaning types in canonical order, falling back to check-out', () => {
    const { createTemplate, updateTemplate, getTemplate } = useCleaningStepTemplates()
    const daily = createTemplate({ name: 'Daily', sections, cleaningTypes: ['mid_stay', 'daily', 'daily'] })
    expect(daily.cleaningTypes).toEqual(['daily', 'mid_stay'])
    expect(createTemplate({ name: 'No type', sections }).cleaningTypes).toEqual(['check_out'])
    updateTemplate(daily.id, { cleaningTypes: [] })
    expect(getTemplate(daily.id)!.cleaningTypes).toEqual(['daily', 'mid_stay'])
    updateTemplate(daily.id, { cleaningTypes: ['custom'] })
    expect(getTemplate(daily.id)!.cleaningTypes).toEqual(['custom'])
  })

  it('gives templates saved before cleaning types existed a type on load', () => {
    const { cleaningTypes: _drop, ...legacySeed } = SEED_CLEANING_STEP_TEMPLATES.find(t => t.id === 'cst-daily')!
    localStorage.setItem(CLEANING_STEP_TEMPLATES_STORAGE_KEY, JSON.stringify([
      legacySeed,
      { ...legacySeed, id: 'cst-own', isDefault: false },
    ]))
    const { getTemplate } = useCleaningStepTemplates()
    expect(getTemplate('cst-daily')!.cleaningTypes).toEqual(['daily', 'mid_stay'])
    expect(getTemplate('cst-own')!.cleaningTypes).toEqual(['check_out'])
  })

  it('copies cleaning types when duplicating', () => {
    const { duplicateTemplate } = useCleaningStepTemplates()
    expect(duplicateTemplate('cst-daily')!.cleaningTypes).toEqual(['daily', 'mid_stay'])
  })
})
