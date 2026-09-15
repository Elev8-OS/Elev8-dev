import type { InvoiceTemplate } from '~/components/settings/data/invoice-templates'
import {
  INVOICE_TEMPLATES_STORAGE_KEY,
  SEED_INVOICE_TEMPLATES,
} from '~/components/settings/data/invoice-templates'

function loadInitialTemplates(): InvoiceTemplate[] {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(INVOICE_TEMPLATES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    }
    catch {
      // Ignore storage errors and fall back to seed
    }
  }
  return JSON.parse(JSON.stringify(SEED_INVOICE_TEMPLATES))
}

export function useInvoiceTemplates() {
  const templates = useState<InvoiceTemplate[]>('invoice-templates', () => loadInitialTemplates())

  function persist(): void {
    if (import.meta.client) {
      try {
        localStorage.setItem(INVOICE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates.value))
      }
      catch {
        // LocalStorage quota or unavailable
      }
    }
  }

  function getTemplateById(id: string): InvoiceTemplate | undefined {
    return templates.value.find(t => t.id === id)
  }

  function getDefaultTemplate(): InvoiceTemplate {
    return templates.value.find(t => t.isDefault) || templates.value[0] || SEED_INVOICE_TEMPLATES[0]
  }

  function getTemplateForListing(listingId: string): InvoiceTemplate {
    if (!listingId)
      return getDefaultTemplate()
    const matched = templates.value.find(t => t.assignedListingIds && t.assignedListingIds.includes(listingId))
    return matched || getDefaultTemplate()
  }

  function createTemplate(draft: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>): InvoiceTemplate {
    const now = new Date().toISOString()
    const id = `tmpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

    let nextTemplates = [...templates.value]

    // If marked as default or is first template, clear other defaults
    const isDefault = draft.isDefault || nextTemplates.length === 0
    if (isDefault) {
      nextTemplates = nextTemplates.map(t => ({ ...t, isDefault: false }))
    }

    // Strip assigned listings from any other template to avoid overlaps
    const assigned = draft.assignedListingIds || []
    if (assigned.length > 0) {
      nextTemplates = nextTemplates.map(t => ({
        ...t,
        assignedListingIds: t.assignedListingIds.filter(lid => !assigned.includes(lid)),
      }))
    }

    const newTemplate: InvoiceTemplate = {
      ...draft,
      id,
      isDefault,
      assignedListingIds: assigned,
      createdAt: now,
      updatedAt: now,
    }

    nextTemplates.push(newTemplate)
    templates.value = nextTemplates
    persist()
    return newTemplate
  }

  function updateTemplate(id: string, patch: Partial<InvoiceTemplate>): void {
    const now = new Date().toISOString()
    let next = [...templates.value]

    if (patch.isDefault) {
      next = next.map(t => (t.id === id ? t : { ...t, isDefault: false }))
    }

    if (patch.assignedListingIds) {
      const assigned = patch.assignedListingIds
      next = next.map((t) => {
        if (t.id === id)
          return t
        return {
          ...t,
          assignedListingIds: t.assignedListingIds.filter(lid => !assigned.includes(lid)),
        }
      })
    }

    templates.value = next.map(t => (t.id === id ? { ...t, ...patch, updatedAt: now } : t))
    persist()
  }

  function deleteTemplate(id: string): boolean {
    const target = templates.value.find(t => t.id === id)
    if (!target)
      return false

    // Cannot delete the only remaining template
    if (templates.value.length <= 1)
      return false

    const next = templates.value.filter(t => t.id !== id)

    // If the deleted one was default, make the first remaining default
    if (target.isDefault && next.length > 0) {
      next[0] = { ...next[0], isDefault: true }
    }

    templates.value = next
    persist()
    return true
  }

  function setDefaultTemplate(id: string): void {
    templates.value = templates.value.map(t => ({
      ...t,
      isDefault: t.id === id,
      updatedAt: t.id === id ? new Date().toISOString() : t.updatedAt,
    }))
    persist()
  }

  function assignListings(templateId: string, listingIds: string[]): void {
    updateTemplate(templateId, { assignedListingIds: listingIds })
  }

  function duplicateTemplate(id: string): InvoiceTemplate | null {
    const source = getTemplateById(id)
    if (!source)
      return null

    const now = new Date().toISOString()
    const newId = `tmpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const copy: InvoiceTemplate = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: `${source.name} (Copy)`,
      isDefault: false,
      assignedListingIds: [], // Start with empty listings so no conflict
      createdAt: now,
      updatedAt: now,
    }

    templates.value = [...templates.value, copy]
    persist()
    return copy
  }

  function resetToSeeds(): void {
    templates.value = JSON.parse(JSON.stringify(SEED_INVOICE_TEMPLATES))
    persist()
  }

  return {
    templates,
    getTemplateById,
    getDefaultTemplate,
    getTemplateForListing,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    assignListings,
    duplicateTemplate,
    resetToSeeds,
  }
}
