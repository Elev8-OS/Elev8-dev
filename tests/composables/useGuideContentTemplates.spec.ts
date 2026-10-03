import { beforeEach, describe, expect, it } from 'vitest'
import { GUIDE_CONTENT_KINDS } from '~/components/listings/data/guest-guide-content'
import { useGuideContentTemplates } from '~/composables/useGuideContentTemplates'

beforeEach(() => localStorage.clear())

describe('useGuideContentTemplates', () => {
  it('seeds one default per kind', () => {
    const { templatesOf } = useGuideContentTemplates()
    for (const kind of GUIDE_CONTENT_KINDS)
      expect(templatesOf(kind).filter(t => t.isDefault), kind).toHaveLength(1)
  })

  it('sets a default within its kind only', () => {
    const { templatesOf, setDefaultTemplate, defaultTemplateOf } = useGuideContentTemplates()
    const other = templatesOf('checkin').find(t => !t.isDefault)!
    const checkoutDefault = defaultTemplateOf('checkout')!.id
    setDefaultTemplate(other.id)
    expect(defaultTemplateOf('checkin')!.id).toBe(other.id)
    expect(templatesOf('checkin').filter(t => t.isDefault)).toHaveLength(1)
    expect(defaultTemplateOf('checkout')!.id).toBe(checkoutDefault)
  })

  it('makes the first template of a kind its default, and promotes another when the default is deleted', () => {
    const { createTemplate, templatesOf, deleteTemplate, defaultTemplateOf } = useGuideContentTemplates()
    for (const t of templatesOf('good_to_know'))
      deleteTemplate(t.id)
    const first = createTemplate({ kind: 'good_to_know', name: 'A', items: [{ id: 'x', title: 'Pool' }] })
    expect(first.isDefault).toBe(true)
    const second = createTemplate({ kind: 'good_to_know', name: 'B', items: [{ id: 'y', title: 'Power' }] })
    deleteTemplate(first.id)
    expect(defaultTemplateOf('good_to_know')!.id).toBe(second.id)
  })
})
