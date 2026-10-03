import type { CleaningGuidance, GuidanceVideo } from '~/components/cleaning/data/cleaning-guidance'
import { computed } from 'vue'
import { CLEANING_GUIDANCE_STORAGE_KEY, SEED_CLEANING_GUIDANCE } from '~/components/cleaning/data/cleaning-guidance'

function loadInitialGuidance(): CleaningGuidance[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const parsed = JSON.parse(localStorage.getItem(CLEANING_GUIDANCE_STORAGE_KEY) ?? 'null')
      if (Array.isArray(parsed))
        return parsed
    }
    catch {
      // Unreadable storage: fall back to the seed.
    }
  }
  return JSON.parse(JSON.stringify(SEED_CLEANING_GUIDANCE))
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export type GuidanceInput = Pick<CleaningGuidance, 'title' | 'body'> & { thumbnailUrl?: string, videos: Array<Omit<GuidanceVideo, 'id'> & { id?: string }> }

/** The tenant's housekeeping guidance library (Settings > Operations > Guidance). */
export function useCleaningGuidance() {
  const guidance = useState<CleaningGuidance[]>('cleaning-guidance', () => loadInitialGuidance())

  function persist() {
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(CLEANING_GUIDANCE_STORAGE_KEY, JSON.stringify(guidance.value))
    }
    catch {
      // Quota or unavailable storage: the in-memory list still works.
    }
  }

  const sortedGuidance = computed(() => [...guidance.value].sort((a, b) => a.title.localeCompare(b.title)))

  function getGuidance(id: string) {
    return guidance.value.find(g => g.id === id)
  }

  /** The guidance for a step's ids, in the step's order; unknown (deleted) ids are dropped. */
  function resolveGuidance(ids: string[] | undefined): CleaningGuidance[] {
    return (ids ?? []).map(getGuidance).filter((g): g is CleaningGuidance => Boolean(g))
  }

  function normalise(input: GuidanceInput) {
    return {
      title: input.title.trim() || 'Untitled guidance',
      body: input.body.trim(),
      thumbnailUrl: input.thumbnailUrl || undefined,
      videos: input.videos.map(v => ({ ...v, id: v.id ?? newId('vid'), title: v.title?.trim() || undefined })),
    }
  }

  function createGuidance(input: GuidanceInput): CleaningGuidance {
    const now = new Date().toISOString()
    const item: CleaningGuidance = { id: newId('gd'), ...normalise(input), createdAt: now, updatedAt: now }
    guidance.value = [...guidance.value, item]
    persist()
    return item
  }

  function updateGuidance(id: string, input: GuidanceInput) {
    const now = new Date().toISOString()
    guidance.value = guidance.value.map(g => g.id === id ? { ...g, ...normalise(input), updatedAt: now } : g)
    persist()
  }

  function deleteGuidance(id: string) {
    guidance.value = guidance.value.filter(g => g.id !== id)
    persist()
  }

  return { guidance, sortedGuidance, getGuidance, resolveGuidance, createGuidance, updateGuidance, deleteGuidance }
}
