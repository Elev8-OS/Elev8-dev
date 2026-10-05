import type { CleaningStepTemplate, CleaningTemplateType } from '~/components/cleaning/data/cleaning-step-templates'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { computed } from 'vue'
import { CLEANING_STEP_TEMPLATES_STORAGE_KEY, normalizeCleaningTypes, SEED_CLEANING_STEP_TEMPLATES } from '~/components/cleaning/data/cleaning-step-templates'
import { cloneCleaningSteps } from '~/components/cleaning/data/cleaning-steps'

/**
 * Templates saved before cleaning types existed have none: a seed gets its
 * seeded types back, any other a check-out clean (what every template was).
 */
function withCleaningTypes(template: CleaningStepTemplate): CleaningStepTemplate {
  const types = normalizeCleaningTypes(template.cleaningTypes)
  if (types.length)
    return { ...template, cleaningTypes: types }
  const seed = SEED_CLEANING_STEP_TEMPLATES.find(t => t.id === template.id)
  return { ...template, cleaningTypes: seed ? [...seed.cleaningTypes] : ['check_out'] }
}

function loadInitialTemplates(): CleaningStepTemplate[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const parsed = JSON.parse(localStorage.getItem(CLEANING_STEP_TEMPLATES_STORAGE_KEY) ?? 'null')
      if (Array.isArray(parsed) && parsed.length > 0)
        return parsed.map(withCleaningTypes)
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

  function createTemplate(input: { name: string, description?: string, cleaningTypes?: CleaningTemplateType[], sections: CleaningStepSection[], isDefault?: boolean }): CleaningStepTemplate {
    const cleaningTypes = normalizeCleaningTypes(input.cleaningTypes)
    const now = new Date().toISOString()
    const isDefault = Boolean(input.isDefault) || templates.value.length === 0
    const template: CleaningStepTemplate = {
      id: newTemplateId(),
      name: input.name.trim() || 'Untitled template',
      description: input.description?.trim() || undefined,
      cleaningTypes: cleaningTypes.length ? cleaningTypes : ['check_out'],
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

  function updateTemplate(id: string, patch: Partial<Pick<CleaningStepTemplate, 'name' | 'description' | 'cleaningTypes' | 'sections'>>) {
    const now = new Date().toISOString()
    templates.value = templates.value.map(t => t.id === id
      ? {
          ...t,
          ...patch,
          name: patch.name !== undefined ? (patch.name.trim() || 'Untitled template') : t.name,
          description: patch.description !== undefined ? (patch.description.trim() || undefined) : t.description,
          // An empty pick keeps what the template had: at least one type, always.
          cleaningTypes: normalizeCleaningTypes(patch.cleaningTypes).length ? normalizeCleaningTypes(patch.cleaningTypes) : t.cleaningTypes,
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
    return createTemplate({ name: `${source.name} (copy)`, description: source.description, cleaningTypes: source.cleaningTypes, sections: source.sections })
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
