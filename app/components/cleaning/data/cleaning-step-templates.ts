import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { cleaningStepTemplate } from '~/components/cleaning/data/cleaning-steps'

/**
 * A reusable set of cleaning steps, kept tenant-wide in Settings > Cleaning
 * Templates. A listing takes a COPY when its steps are set up from one
 * (`cloneCleaningSteps`); editing the template later never changes a listing.
 * Exactly one template is the default: the one offered first when a listing
 * has no steps yet.
 */
export interface CleaningStepTemplate {
  id: string
  name: string
  description?: string
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
    isDefault: true,
    sections: cleaningStepTemplate(),
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: 'cst-studio',
    name: 'Studio / apartment',
    description: 'Short turnover for a one-room unit.',
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
]
