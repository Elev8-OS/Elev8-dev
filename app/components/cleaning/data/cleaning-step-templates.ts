import type { CleaningJobSource } from '~/components/cleaning/data/cleaning-jobs'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { cleaningStepTemplate } from '~/components/cleaning/data/cleaning-steps'

/**
 * A reusable set of cleaning steps, kept tenant-wide in Settings > Cleaning
 * Templates. A listing takes a COPY when its steps are set up from one
 * (`cloneCleaningSteps`); editing the template later never changes a listing.
 * Exactly one template is the default: the one offered first when a listing
 * has no steps yet.
 *
 * `cleaningTypes` says which cleanings the template is written for (at least
 * one; the canonical job sources, never the legacy `manual` / `checkout`).
 * ⚠️ A label for now: a listing holds one set of steps, used by every job.
 */
export type CleaningTemplateType = Exclude<CleaningJobSource, 'manual' | 'checkout'>

export const CLEANING_TEMPLATE_TYPES: CleaningTemplateType[] = ['check_out', 'daily', 'mid_stay', 'custom']

export interface CleaningStepTemplate {
  id: string
  name: string
  description?: string
  cleaningTypes: CleaningTemplateType[]
  isDefault: boolean
  sections: CleaningStepSection[]
  createdAt: string
  updatedAt: string
}

export const CLEANING_STEP_TEMPLATES_STORAGE_KEY = 'elev8-cleaning-step-templates-v1'

const seededAt = '2026-09-01T00:00:00.000Z'

function steps(id: string, title: string, labels: string[]): CleaningStepSection {
  return { id, title, steps: labels.map((label, i) => ({ id: `${id}-${i + 1}`, label })) }
}

export const SEED_CLEANING_STEP_TEMPLATES: CleaningStepTemplate[] = [
  {
    id: 'cst-villa',
    name: 'Villa standard',
    description: 'Turnover clean for a private pool villa.',
    cleaningTypes: ['check_out'],
    isDefault: true,
    sections: cleaningStepTemplate(),
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'cst-studio',
    name: 'Studio / apartment',
    description: 'Short turnover for a one-room unit.',
    cleaningTypes: ['check_out'],
    isDefault: false,
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
    cleaningTypes: ['custom'],
    isDefault: false,
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
    cleaningTypes: ['daily', 'mid_stay'],
    isDefault: false,
    sections: [
      steps('daily-bedrooms', 'Bedrooms', ['Make the beds and fold guest clothes left out', 'Empty bins and replace bin liners']),
      steps('daily-bathrooms', 'Bathrooms', ['Wipe basin, shower and mirror', 'Swap used towels and top up toilet paper']),
      steps('daily-living', 'Living and kitchen', ['Wash dishes left in the sink', 'Sweep floors and wipe the dining table']),
      steps('daily-outdoor', 'Outdoor', ['Skim the pool and straighten sun loungers']),
    ],
    createdAt: seededAt,
    updatedAt: seededAt,
  },
]

/** Canonical order, no duplicates, legacy or unknown values dropped. */
export function normalizeCleaningTypes(types: readonly string[] | null | undefined): CleaningTemplateType[] {
  const picked = new Set(types ?? [])
  return CLEANING_TEMPLATE_TYPES.filter(t => picked.has(t))
}
