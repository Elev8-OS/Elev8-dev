import { beforeEach, describe, expect, it } from 'vitest'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'

describe('useInvoiceTemplates', () => {
  beforeEach(() => {
    const { resetToSeeds } = useInvoiceTemplates()
    resetToSeeds()
  })

  it('initializes with seed templates', () => {
    const { templates, getDefaultTemplate } = useInvoiceTemplates()
    expect(templates.value.length).toBeGreaterThanOrEqual(2)
    const def = getDefaultTemplate()
    expect(def.isDefault).toBe(true)
    expect(def.company.companyName).toBe('Elevate Schweiz GmbH')
  })

  it('finds template for assigned listing', () => {
    const { getTemplateForListing } = useInvoiceTemplates()
    const tmpl = getTemplateForListing('listing-1')
    expect(tmpl.company.companyName).toBe('Elevate Schweiz GmbH')

    const baliTmpl = getTemplateForListing('listing-11')
    expect(baliTmpl.company.companyName).toBe('PT Elev8 Bali Mandiri')
  })

  it('falls back to default template for unassigned listing', () => {
    const { getTemplateForListing, getDefaultTemplate } = useInvoiceTemplates()
    const tmpl = getTemplateForListing('listing-999-unassigned')
    expect(tmpl.id).toBe(getDefaultTemplate().id)
  })

  it('creates new template and removes assigned listings from previous templates', () => {
    const { createTemplate, getTemplateForListing, getTemplateById } = useInvoiceTemplates()
    const created = createTemplate({
      name: 'Special Entity',
      isDefault: false,
      headerMessage: 'Header test',
      footerMessage: 'Footer test',
      company: {
        companyName: 'Special Entity AG',
        address: 'Zurich Strasse 10',
      },
      bank: {
        bankName: 'UBS',
        accountHolder: 'Special Entity AG',
      },
      assignedListingIds: ['listing-1'], // previously on Schweiz GmbH
    })

    expect(created.id).toBeTruthy()
    expect(getTemplateForListing('listing-1').id).toBe(created.id)

    // Old template should not have listing-1 anymore
    const old = getTemplateById('tmpl-schweiz')
    expect(old?.assignedListingIds.includes('listing-1')).toBe(false)
  })

  it('sets new default template', () => {
    const { setDefaultTemplate, getTemplateById, getDefaultTemplate } = useInvoiceTemplates()
    setDefaultTemplate('tmpl-bali-local')
    expect(getDefaultTemplate().id).toBe('tmpl-bali-local')
    expect(getTemplateById('tmpl-schweiz')?.isDefault).toBe(false)
  })

  it('duplicates template with empty listings and copy suffix', () => {
    const { duplicateTemplate, templates } = useInvoiceTemplates()
    const initialCount = templates.value.length
    const copy = duplicateTemplate('tmpl-schweiz')
    expect(copy).toBeTruthy()
    expect(copy?.name).toContain('(Copy)')
    expect(copy?.assignedListingIds).toEqual([])
    expect(copy?.isDefault).toBe(false)
    expect(templates.value.length).toBe(initialCount + 1)
  })

  it('cannot delete the last template', () => {
    const { deleteTemplate, templates } = useInvoiceTemplates()
    templates.value = [templates.value[0]]
    const success = deleteTemplate(templates.value[0].id)
    expect(success).toBe(false)
    expect(templates.value.length).toBe(1)
  })
})
