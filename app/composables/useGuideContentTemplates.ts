import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'
import type { GuideContentTemplate } from '~/components/listings/data/guide-content-templates'
import { computed } from 'vue'
import { cloneGuideItems } from '~/components/listings/data/guest-guide-content'
import { GUIDE_CONTENT_TEMPLATES_STORAGE_KEY, SEED_GUIDE_CONTENT_TEMPLATES } from '~/components/listings/data/guide-content-templates'

function loadInitialTemplates(): GuideContentTemplate[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const parsed = JSON.parse(localStorage.getItem(GUIDE_CONTENT_TEMPLATES_STORAGE_KEY) ?? 'null')
      if (Array.isArray(parsed))
        return parsed
    }
    catch {
      // Unreadable storage: fall back to the seed.
    }
  }
  return JSON.parse(JSON.stringify(SEED_GUIDE_CONTENT_TEMPLATES))
}

function newTemplateId() {
  return `gct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Guest guide content templates, per kind. Each kind keeps exactly one
 * default while it has any template: setting one clears the rest of that kind,
 * deleting the default promotes the next of the same kind.
 */
export function useGuideContentTemplates() {
  const templates = useState<GuideContentTemplate[]>('guide-content-templates', () => loadInitialTemplates())

  function persist() {
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(GUIDE_CONTENT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates.value))
    }
    catch {
      // Quota or unavailable storage: the in-memory list still works.
    }
  }

  /** One kind's templates, default first, then by name. */
  function templatesOf(kind: GuideContentKind): GuideContentTemplate[] {
    return templates.value
      .filter(t => t.kind === kind)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
  }

  function defaultTemplateOf(kind: GuideContentKind): GuideContentTemplate | null {
    return templatesOf(kind)[0] ?? null
  }

  const count = computed(() => templates.value.length)

  function getTemplate(id: string) {
    return templates.value.find(t => t.id === id)
  }

  function createTemplate(input: { kind: GuideContentKind, name: string, items: GuideContentItem[], isDefault?: boolean }): GuideContentTemplate {
    const now = new Date().toISOString()
    const isDefault = Boolean(input.isDefault) || templatesOf(input.kind).length === 0
    const created: GuideContentTemplate = {
      id: newTemplateId(),
      kind: input.kind,
      name: input.name.trim() || 'Untitled template',
      isDefault,
      items: cloneGuideItems(input.items),
      createdAt: now,
      updatedAt: now,
    }
    const rest = isDefault ? templates.value.map(t => t.kind === input.kind ? { ...t, isDefault: false } : t) : templates.value
    templates.value = [...rest, created]
    persist()
    return created
  }

  function updateTemplate(id: string, patch: { name?: string, items?: GuideContentItem[] }) {
    const now = new Date().toISOString()
    templates.value = templates.value.map(t => t.id === id
      ? { ...t, ...patch, name: patch.name !== undefined ? (patch.name.trim() || 'Untitled template') : t.name, updatedAt: now }
      : t)
    persist()
  }

  function setDefaultTemplate(id: string) {
    const target = getTemplate(id)
    if (!target)
      return
    templates.value = templates.value.map(t => t.kind === target.kind ? { ...t, isDefault: t.id === id } : t)
    persist()
  }

  function duplicateTemplate(id: string): GuideContentTemplate | null {
    const source = getTemplate(id)
    if (!source)
      return null
    return createTemplate({ kind: source.kind, name: `${source.name} (copy)`, items: source.items })
  }

  function deleteTemplate(id: string) {
    const target = getTemplate(id)
    if (!target)
      return
    const next = templates.value.filter(t => t.id !== id)
    if (target.isDefault) {
      const heir = next.find(t => t.kind === target.kind)
      templates.value = heir ? next.map(t => t.id === heir.id ? { ...t, isDefault: true } : t) : next
    }
    else {
      templates.value = next
    }
    persist()
  }

  return { templates, count, templatesOf, defaultTemplateOf, getTemplate, createTemplate, updateTemplate, setDefaultTemplate, duplicateTemplate, deleteTemplate }
}
