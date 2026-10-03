import type { CleaningStepTemplate } from '~/components/cleaning/data/cleaning-step-templates'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { computed } from 'vue'
import { CLEANING_STEP_TEMPLATES_STORAGE_KEY, SEED_CLEANING_STEP_TEMPLATES } from '~/components/cleaning/data/cleaning-step-templates'
import { cloneCleaningSteps } from '~/components/cleaning/data/cleaning-steps'

function loadInitialTemplates(): CleaningStepTemplate[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const parsed = JSON.parse(localStorage.getItem(CLEANING_STEP_TEMPLATES_STORAGE_KEY) ?? 'null')
      if (Array.isArray(parsed) && parsed.length > 0)
        return parsed
    }
    catch {
      // Unreadable storage: fall back to the seed.
    }
  }
  return JSON.parse(JSON.stringify(SEED_CLEANING_STEP_TEMPLATES))
}

function newTemplateId() {
  return `cst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * The tenant's cleaning step templates (Settings > Cleaning Templates).
 * Exactly one is the default whenever any exist: setting one clears the rest,
 * deleting the default promotes the first remaining. The last template cannot
 * be deleted, so there is always a default to offer.
 */
export function useCleaningStepTemplates() {
  const templates = useState<CleaningStepTemplate[]>('cleaning-step-templates', () => loadInitialTemplates())

  function persist() {
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(CLEANING_STEP_TEMPLATES_STORAGE_KEY, JSON.stringify(templates.value))
    }
    catch {
      // Quota or unavailable storage: the in-memory list still works.
    }
  }

  const defaultTemplate = computed(() => templates.value.find(t => t.isDefault) ?? templates.value[0] ?? null)

  /** Default first, then by name. */
  const sortedTemplates = computed(() =>
    [...templates.value].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name)),
  )

  function getTemplate(id: string) {
    return templates.value.find(t => t.id === id)
  }

  function createTemplate(input: { name: string, description?: string, sections: CleaningStepSection[], isDefault?: boolean }): CleaningStepTemplate {
    const now = new Date().toISOString()
    const isDefault = Boolean(input.isDefault) || templates.value.length === 0
    const template: CleaningStepTemplate = {
      id: newTemplateId(),
      name: input.name.trim() || 'Untitled template',
      description: input.description?.trim() || undefined,
      isDefault,
      sections: cloneCleaningSteps(input.sections),
      createdAt: now,
      updatedAt: now,
    }
    const rest = isDefault ? templates.value.map(t => ({ ...t, isDefault: false })) : templates.value
    templates.value = [...rest, template]
    persist()
    return template
  }

  function updateTemplate(id: string, patch: Partial<Pick<CleaningStepTemplate, 'name' | 'description' | 'sections'>>) {
    const now = new Date().toISOString()
    templates.value = templates.value.map(t => t.id === id
      ? {
          ...t,
          ...patch,
          name: patch.name !== undefined ? (patch.name.trim() || 'Untitled template') : t.name,
          description: patch.description !== undefined ? (patch.description.trim() || undefined) : t.description,
          updatedAt: now,
        }
      : t)
    persist()
  }

  function setDefaultTemplate(id: string) {
    if (!getTemplate(id))
      return
    templates.value = templates.value.map(t => ({ ...t, isDefault: t.id === id }))
    persist()
  }

  function duplicateTemplate(id: string): CleaningStepTemplate | null {
    const source = getTemplate(id)
    if (!source)
      return null
    return createTemplate({ name: `${source.name} (copy)`, description: source.description, sections: source.sections })
  }

  /** False, deleting nothing, for the last remaining template. */
  function deleteTemplate(id: string): boolean {
    const target = getTemplate(id)
    if (!target || templates.value.length <= 1)
      return false
    const next = templates.value.filter(t => t.id !== id)
    templates.value = target.isDefault ? next.map((t, i) => ({ ...t, isDefault: i === 0 })) : next
    persist()
    return true
  }

  return {
    templates,
    sortedTemplates,
    defaultTemplate,
    getTemplate,
    createTemplate,
    updateTemplate,
    setDefaultTemplate,
    duplicateTemplate,
    deleteTemplate,
  }
}
