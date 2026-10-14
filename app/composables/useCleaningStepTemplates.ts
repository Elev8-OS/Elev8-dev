import type { CleaningChecklistLibrary, CleaningStepTemplate, CleaningTemplateType, CleaningTypeDefaults } from '~/components/cleaning/data/cleaning-step-templates'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { computed } from 'vue'
import {
  CLEANING_STEP_TEMPLATES_STORAGE_KEY,
  CLEANING_TEMPLATE_TYPES,
  CLEANING_TYPE_DEFAULTS_STORAGE_KEY,
  completeTypeDefaults,
  listingChecklistOverrides,
  SEED_CLEANING_STEP_TEMPLATES,
  SEED_CLEANING_TYPE_DEFAULTS,
} from '~/components/cleaning/data/cleaning-step-templates'
import { cloneCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'

/** Drops the retired `isDefault` and `cleaningTypes` fields from a stored template. */
function withoutRetiredFields(template: CleaningStepTemplate & { isDefault?: boolean, cleaningTypes?: unknown }): CleaningStepTemplate {
  const { isDefault: _default, cleaningTypes: _types, ...rest } = template
  return rest
}

function readStorage<T>(key: string): T | null {
  if (typeof localStorage === 'undefined')
    return null
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
  }
  catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof localStorage === 'undefined')
    return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    // Quota or unavailable storage: the in-memory state still works.
  }
}

function loadInitialTemplates(): CleaningStepTemplate[] {
  const parsed = readStorage<CleaningStepTemplate[]>(CLEANING_STEP_TEMPLATES_STORAGE_KEY)
  if (Array.isArray(parsed) && parsed.length > 0)
    return parsed.map(withoutRetiredFields)
  return JSON.parse(JSON.stringify(SEED_CLEANING_STEP_TEMPLATES))
}

function newTemplateId() {
  return `cst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Listings whose effective overrides name the template, for any type. */
function listingsOverriding(id: string, templates: readonly CleaningStepTemplate[]) {
  return listings.value.filter(l => Object.values(listingChecklistOverrides(l.maintenance, templates)).includes(id))
}

/**
 * The tenant's cleaning step templates (Settings > Cleaning) and the
 * company default per cleaning type. Every type always has a default while any
 * template exists (`completeTypeDefaults`), and a new tenant starts with
 * `SEED_CLEANING_TYPE_DEFAULTS`, active at once. The last template cannot be
 * deleted; one still in use needs a replacement.
 */
export function useCleaningStepTemplates() {
  const templates = useState<CleaningStepTemplate[]>('cleaning-step-templates', () => loadInitialTemplates())
  const typeDefaults = useState<CleaningTypeDefaults>('cleaning-type-defaults', () =>
    completeTypeDefaults(readStorage<CleaningTypeDefaults>(CLEANING_TYPE_DEFAULTS_STORAGE_KEY) ?? SEED_CLEANING_TYPE_DEFAULTS, templates.value))

  function persist() {
    writeStorage(CLEANING_STEP_TEMPLATES_STORAGE_KEY, templates.value)
    writeStorage(CLEANING_TYPE_DEFAULTS_STORAGE_KEY, typeDefaults.value)
  }

  const library = computed<CleaningChecklistLibrary>(() => ({ templates: templates.value, typeDefaults: typeDefaults.value }))

  /** By name. */
  const sortedTemplates = computed(() => [...templates.value].sort((a, b) => a.name.localeCompare(b.name)))

  function getTemplate(id: string) {
    return templates.value.find(t => t.id === id)
  }

  /** The company default for a type. */
  function defaultFor(type: CleaningTemplateType): CleaningStepTemplate | null {
    return getTemplate(typeDefaults.value[type] ?? '') ?? null
  }

  /** What a listing editor offers first ("Use …"): the check-out default. */
  const defaultTemplate = computed(() => defaultFor('check_out') ?? sortedTemplates.value[0] ?? null)

  /** The types a template is the company default for, in canonical order. */
  function defaultTypesOf(id: string): CleaningTemplateType[] {
    return CLEANING_TEMPLATE_TYPES.filter(type => typeDefaults.value[type] === id)
  }

  /** How many listings override a type with the template. */
  function listingUsageOf(id: string): number {
    return listingsOverriding(id, templates.value).length
  }

  function setTypeDefault(type: CleaningTemplateType, id: string) {
    if (!getTemplate(id))
      return
    typeDefaults.value = { ...typeDefaults.value, [type]: id }
    persist()
  }

  function createTemplate(input: { name: string, description?: string, sections: CleaningStepSection[] }): CleaningStepTemplate {
    const now = new Date().toISOString()
    const template: CleaningStepTemplate = {
      id: newTemplateId(),
      name: input.name.trim() || 'Untitled template',
      description: input.description?.trim() || undefined,
      sections: cloneCleaningSteps(input.sections),
      createdAt: now,
      updatedAt: now,
    }
    templates.value = [...templates.value, template]
    // The first template ever becomes every type's default.
    typeDefaults.value = completeTypeDefaults(typeDefaults.value, templates.value)
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

  function duplicateTemplate(id: string): CleaningStepTemplate | null {
    const source = getTemplate(id)
    if (!source)
      return null
    return createTemplate({ name: `${source.name} (copy)`, description: source.description, sections: source.sections })
  }

  /** In use as a company default or by a listing override: deleting needs a replacement. */
  function isTemplateInUse(id: string): boolean {
    return defaultTypesOf(id).length > 0 || listingUsageOf(id) > 0
  }

  /**
   * Deletes a template. One in use moves every default and listing override
   * that names it onto `replacementId`, so no type is left without a checklist.
   * False, deleting nothing, for the last template, or one in use with no
   * valid replacement.
   */
  function deleteTemplate(id: string, replacementId?: string): boolean {
    if (!getTemplate(id) || templates.value.length <= 1)
      return false
    if (isTemplateInUse(id)) {
      if (!replacementId || replacementId === id || !getTemplate(replacementId))
        return false
      typeDefaults.value = Object.fromEntries(
        Object.entries(typeDefaults.value).map(([type, tid]) => [type, tid === id ? replacementId : tid]),
      ) as CleaningTypeDefaults
      const using = new Set(listingsOverriding(id, templates.value).map(l => l.id))
      listings.value = listings.value.map((l) => {
        if (!using.has(l.id))
          return l
        const overrides = listingChecklistOverrides(l.maintenance, templates.value)
        const cleaningTemplates = Object.fromEntries(
          Object.entries(overrides).map(([type, value]) => [type, value === id ? replacementId : value]),
        )
        return { ...l, maintenance: { ...l.maintenance, cleaningTemplates } }
      })
    }
    templates.value = templates.value.filter(t => t.id !== id)
    typeDefaults.value = completeTypeDefaults(typeDefaults.value, templates.value)
    persist()
    return true
  }

  return {
    templates,
    sortedTemplates,
    typeDefaults,
    library,
    defaultTemplate,
    defaultFor,
    defaultTypesOf,
    listingUsageOf,
    isTemplateInUse,
    getTemplate,
    setTypeDefault,
    createTemplate,
    updateTemplate,
    duplicateTemplate,
    deleteTemplate,
  }
}
