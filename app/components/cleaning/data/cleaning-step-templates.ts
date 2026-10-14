import type { CleaningJobSource } from '~/components/cleaning/data/cleaning-jobs'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { cleaningStepTemplate, countCleaningSteps } from '~/components/cleaning/data/cleaning-steps'

/**
 * A reusable set of cleaning steps, kept tenant-wide in Settings > Cleaning
 * Templates.
 *
 * Which steps a job gets is decided per cleaning type, most specific first:
 * 1. the listing's override (`ListingMaintenance.cleaningTemplates`): another
 *    template, or `LISTING_CUSTOM_STEPS` for the listing's own `cleaningSteps`;
 * 2. the company default for the type (`CleaningTypeDefaults`, Settings);
 * 3. nothing: that type cannot be scheduled on the listing.
 * Overrides and defaults are LIVE references: a job copies the resolved steps
 * when it is created (`resolveListingChecklist`), so editing a template reaches
 * new jobs only. A new tenant starts with `SEED_CLEANING_TYPE_DEFAULTS`, so
 * every listing can be cleaned from day one.
 *
 * A template carries no cleaning type of its own: any template can be used for
 * any type. (Templates stored with the retired `cleaningTypes` / `isDefault`
 * fields have them dropped on load.)
 */
export type CleaningTemplateType = Exclude<CleaningJobSource, 'manual' | 'checkout'>

export const CLEANING_TEMPLATE_TYPES: CleaningTemplateType[] = ['check_out', 'daily', 'mid_stay', 'vacant', 'custom']

export interface CleaningStepTemplate {
  id: string
  name: string
  description?: string
  sections: CleaningStepSection[]
  createdAt: string
  updatedAt: string
}

export const CLEANING_STEP_TEMPLATES_STORAGE_KEY = 'elev8-cleaning-step-templates-v1'
export const CLEANING_TYPE_DEFAULTS_STORAGE_KEY = 'elev8-cleaning-type-defaults-v1'

/** The company default template per cleaning type (template ids). */
export type CleaningTypeDefaults = Partial<Record<CleaningTemplateType, string>>

/** A listing override meaning "this listing's own steps" instead of a template. */
export const LISTING_CUSTOM_STEPS = 'custom'

/** What a new tenant starts with: active at once, so the first booking is cleaned. */
export const SEED_CLEANING_TYPE_DEFAULTS: Record<CleaningTemplateType, string> = {
  check_out: 'cst-villa',
  daily: 'cst-daily',
  mid_stay: 'cst-daily',
  vacant: 'cst-vacant',
  custom: 'cst-deep',
}

const seededAt = '2026-09-01T00:00:00.000Z'

function steps(id: string, title: string, labels: string[]): CleaningStepSection {
  return { id, title, steps: labels.map((label, i) => ({ id: `${id}-${i + 1}`, label })) }
}

export const SEED_CLEANING_STEP_TEMPLATES: CleaningStepTemplate[] = [
  {
    id: 'cst-villa',
    name: 'Villa standard',
    description: 'Turnover clean for a private pool villa.',
    sections: cleaningStepTemplate(),
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'cst-studio',
    name: 'Studio / apartment',
    description: 'Short turnover for a one-room unit.',
    sections: [
      steps('studio-room', 'Room', ['Strip and make the bed', 'Dust surfaces and empty bins', 'Vacuum and mop the floor']),
      steps('studio-kitchenette', 'Kitchenette', ['Wash dishes and wipe counters', 'Empty and wipe the fridge']),
      steps('studio-bathroom', 'Bathroom', ['Clean toilet, shower and basin', 'Replace towels and amenities']),
    ],
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'cst-deep',
    name: 'Deep clean',
    description: 'Monthly or between long stays.',
    sections: [
      ...cleaningStepTemplate(),
      steps('deep-extra', 'Deep clean extras', [
        'Wash curtains and cushion covers',
        'Clean inside oven, microwave and range hood',
        'Descale kettle, taps and shower heads',
        'Wipe skirting boards, doors and light switches',
      ]),
      steps('deep-outdoor', 'Outdoor', ['Sweep terrace and wipe outdoor furniture', 'Skim the pool and check the pump']),
    ],
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'cst-daily',
    name: 'Daily refresh',
    description: 'Light tidy while guests are in the house.',
    sections: [
      steps('daily-bedrooms', 'Bedrooms', ['Make the beds and fold guest clothes left out', 'Empty bins and replace bin liners']),
      steps('daily-bathrooms', 'Bathrooms', ['Wipe basin, shower and mirror', 'Swap used towels and top up toilet paper']),
      steps('daily-living', 'Living and kitchen', ['Wash dishes left in the sink', 'Sweep floors and wipe the dining table']),
      steps('daily-outdoor', 'Outdoor', ['Skim the pool and straighten sun loungers']),
    ],
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'cst-vacant',
    name: 'Vacant upkeep',
    description: 'Keeps an empty villa guest-ready between stays.',
    sections: [
      steps('vacant-outdoor', 'Outdoor', ['Skim the pool and check the pump', 'Sweep the terrace and clear leaves', 'Water the garden pots']),
      steps('vacant-indoor', 'Indoor', ['Dust surfaces and wipe for ants', 'Air the rooms for 30 minutes, then close up', 'Run taps and flush toilets']),
      steps('vacant-check', 'Checks', ['Test the AC in every room', 'Check fridge, lights and Wi-Fi are on', 'Report anything broken']),
    ],
    createdAt: seededAt,
    updatedAt: seededAt,
  },
]

/** The template type a job source counts as: legacy `manual` is `custom`, `checkout` is `check_out`. */
export function cleaningTemplateTypeFor(source: CleaningJobSource): CleaningTemplateType {
  if (source === 'manual')
    return 'custom'
  if (source === 'checkout')
    return 'check_out'
  return source
}

interface ListingCleaningStepsSource {
  cleaningSteps?: CleaningStepSection[]
  cleaningTemplates?: Partial<Record<CleaningTemplateType, string>>
}

/** The tenant's templates and defaults, what every resolution reads. */
export interface CleaningChecklistLibrary {
  templates: readonly CleaningStepTemplate[]
  typeDefaults: CleaningTypeDefaults
}

/** Where a type's checklist comes from on a listing. */
export type ListingChecklistOrigin = 'default' | 'template' | 'custom'

export interface ResolvedChecklist {
  origin: ListingChecklistOrigin
  /** The template behind it; null for the listing's custom steps. */
  template: CleaningStepTemplate | null
  /** Shown on the job and to housekeeping: the template name, or "Custom steps". */
  name: string
  sections: CleaningStepSection[]
}

export const CUSTOM_STEPS_NAME = 'Custom steps'

function usable(template: CleaningStepTemplate | undefined): template is CleaningStepTemplate {
  return Boolean(template) && countCleaningSteps(template!.sections) > 0
}

function stepsSignature(sections: readonly CleaningStepSection[]): string {
  return JSON.stringify(sections.map(s => [s.title.trim(), s.steps.map(st => st.label.trim())]))
}

/**
 * The listing's overrides per type. ⚠️ Lazy migration: a listing saved before
 * per-type checklists existed (`cleaningTemplates` absent) whose own steps differ
 * from every template keeps using them for every type, so nothing it had
 * changes. Own steps identical to a template (the seeds) follow the defaults.
 * Any later write sets `cleaningTemplates` and ends the migration.
 */
export function listingChecklistOverrides(
  maintenance: ListingCleaningStepsSource | null | undefined,
  templates: readonly CleaningStepTemplate[],
): Partial<Record<CleaningTemplateType, string>> {
  if (maintenance?.cleaningTemplates)
    return maintenance.cleaningTemplates
  const own = maintenance?.cleaningSteps ?? []
  if (!countCleaningSteps(own))
    return {}
  const signature = stepsSignature(own)
  if (templates.some(t => stepsSignature(t.sections) === signature))
    return {}
  return Object.fromEntries(CLEANING_TEMPLATE_TYPES.map(t => [t, LISTING_CUSTOM_STEPS]))
}

/**
 * The listing's overrides with `types` set to `value` (a template id or
 * `LISTING_CUSTOM_STEPS`), or cleared back to the company default when null.
 * Starts from the EFFECTIVE overrides, so a listing on the lazy migration keeps
 * its custom steps on the other types.
 */
export function withListingOverride(
  maintenance: ListingCleaningStepsSource | null | undefined,
  templates: readonly CleaningStepTemplate[],
  types: readonly CleaningTemplateType[],
  value: string | null,
): Partial<Record<CleaningTemplateType, string>> {
  const next: Partial<Record<CleaningTemplateType, string>> = { ...listingChecklistOverrides(maintenance, templates) }
  for (const type of types) {
    if (value)
      next[type] = value
    else
      delete next[type]
  }
  return next
}

/**
 * The checklist a job of `type` uses on the listing: its override, else the
 * company default, else null (the type cannot be scheduled). An override whose
 * template was deleted or is empty, or a custom override with no own steps,
 * falls back to the default.
 */
export function resolveListingChecklist(
  maintenance: ListingCleaningStepsSource | null | undefined,
  type: CleaningTemplateType,
  library: CleaningChecklistLibrary,
): ResolvedChecklist | null {
  const override = listingChecklistOverrides(maintenance, library.templates)[type]
  if (override === LISTING_CUSTOM_STEPS) {
    const own = maintenance?.cleaningSteps ?? []
    if (countCleaningSteps(own))
      return { origin: 'custom', template: null, name: CUSTOM_STEPS_NAME, sections: own }
  }
  else if (override) {
    const template = library.templates.find(t => t.id === override)
    if (usable(template))
      return { origin: 'template', template, name: template.name, sections: template.sections }
  }
  const fallback = library.templates.find(t => t.id === library.typeDefaults[type])
  return usable(fallback)
    ? { origin: 'default', template: fallback, name: fallback.name, sections: fallback.sections }
    : null
}

/**
 * Whether the listing can be cleaned: with a type, whether that type resolves
 * to a checklist; without one, whether ANY type does.
 */
export function listingCanBeCleaned(
  maintenance: ListingCleaningStepsSource | null | undefined,
  library: CleaningChecklistLibrary,
  type?: CleaningTemplateType,
): boolean {
  const types = type ? [type] : CLEANING_TEMPLATE_TYPES
  return types.some(t => resolveListingChecklist(maintenance, t, library) !== null)
}

/**
 * Every type given a usable template: a stored default that still exists, else
 * the seed's default for the type when it still exists, else the first template.
 */
export function completeTypeDefaults(defaults: CleaningTypeDefaults, templates: readonly CleaningStepTemplate[]): CleaningTypeDefaults {
  if (!templates.length)
    return {}
  return Object.fromEntries(CLEANING_TEMPLATE_TYPES.map((type) => {
    const kept = templates.find(t => t.id === defaults[type])
    const picked = kept ?? templates.find(t => t.id === SEED_CLEANING_TYPE_DEFAULTS[type]) ?? templates[0]!
    return [type, picked.id]
  })) as CleaningTypeDefaults
}
