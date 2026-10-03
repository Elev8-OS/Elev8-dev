/**
 * A listing's cleaning steps: what housekeeping works through on every clean
 * of that property, in sections ("Kitchen", "Bathroom"). The housekeeping app
 * turns them into the checklist a cleaner answers OK or Problem
 * (`CleaningChecklistGroup` in `cleaning-jobs.ts` is that filled-in report).
 *
 * ⚠️ A listing with no steps gets no cleaning: no new job, no default cleaning
 * for new bookings. The gate is `listingHasCleaningSteps` in `useCleaningJobs`,
 * which `createJob` and `applyReservationSchedule` enforce, so the automatic
 * paths (a new booking, a checkout, an owner stay) are held to it too.
 *
 * Kept free of imports from the listings data so `listings.ts` can seed from
 * the template below without an import cycle.
 */

export interface CleaningStep {
  id: string
  label: string
  /** Guidance attached to the step (`cleaning-guidance.ts`), shown to housekeeping beside it. */
  guidanceIds?: string[]
}

export interface CleaningStepSection {
  id: string
  title: string
  steps: CleaningStep[]
}

export const CLEANING_STEPS_REQUIRED_MESSAGE = 'Add cleaning steps to this listing before scheduling cleanings.'

/** Steps across every section; empty sections do not count. */
export function countCleaningSteps(sections: CleaningStepSection[] | null | undefined): number {
  return (sections ?? []).reduce((sum, section) => sum + section.steps.filter(s => s.label.trim()).length, 0)
}

export function hasCleaningSteps(listing: { maintenance?: { cleaningSteps?: CleaningStepSection[] } } | null | undefined): boolean {
  return countCleaningSteps(listing?.maintenance?.cleaningSteps) > 0
}

/** Drops blank steps and sections left with none, so a saved list never holds empty rows. */
export function cleanCleaningSteps(sections: CleaningStepSection[]): CleaningStepSection[] {
  return sections
    .map(section => ({
      ...section,
      title: section.title.trim() || 'Untitled section',
      steps: section.steps
        .map((step) => {
          const guidanceIds = [...new Set(step.guidanceIds ?? [])]
          return guidanceIds.length
            ? { id: step.id, label: step.label.trim(), guidanceIds }
            : { id: step.id, label: step.label.trim() }
        })
        .filter(step => step.label),
    }))
    .filter(section => section.steps.length > 0)
}

let idCounter = 0
export function newCleaningStepId(prefix: 'sec' | 'step'): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

/** A starting point for a villa, fresh objects on every call so listings never share one. */
export function cleaningStepTemplate(): CleaningStepSection[] {
  const section = (id: string, title: string, labels: string[]): CleaningStepSection => ({
    id,
    title,
    steps: labels.map((label, i) => ({ id: `${id}-${i + 1}`, label })),
  })
  return [
    section('start', 'Start', [
      'Open all windows and strip every bed',
      'Collect dirty laundry and take it to the laundry cart',
    ]),
    section('kitchen', 'Kitchen', [
      'Empty and clean the fridge and freezer',
      'Clean the sink strainer and check the water drains',
      'Check drawers, pots and cutlery; wash anything left dirty',
    ]),
    section('bathrooms', 'Bathrooms', [
      'Clean toilet, shower, basin and mirrors',
      'Replace towels, toilet paper and amenities',
    ]),
    section('bedrooms', 'Bedrooms', [
      'Make beds with fresh linen',
      'Dust surfaces and check under the beds',
    ]),
    section('finish', 'Finish', [
      'Sweep and mop all floors',
      'Close windows, switch off lights and AC, lock up',
    ]),
  ]
}

/** A deep copy with fresh ids, so steps copied or imported never share objects or ids with their source. */
export function cloneCleaningSteps(sections: CleaningStepSection[]): CleaningStepSection[] {
  return sections.map(section => ({
    id: newCleaningStepId('sec'),
    title: section.title,
    steps: section.steps.map(step => step.guidanceIds?.length
      ? { id: newCleaningStepId('step'), label: step.label, guidanceIds: [...step.guidanceIds] }
      : { id: newCleaningStepId('step'), label: step.label }),
  }))
}

/** One CSV line split into cells, honouring double quotes ("a, b" and "" escapes). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      }
      else if (ch === '"') {
        quoted = false
      }
      else {
        cell += ch
      }
    }
    else if (ch === '"') {
      quoted = true
    }
    else if (ch === ',' || ch === ';') {
      cells.push(cell)
      cell = ''
    }
    else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells.map(c => c.trim())
}

export type CleaningStepsParseResult = { sections: CleaningStepSection[] } | { error: string }

/**
 * Reads cleaning steps from an imported file.
 *
 * - **CSV** (`.csv`): one row per step, `Section,Step`. A header row naming
 *   those columns is skipped. Rows of the same section are grouped in order.
 * - **Text** (anything else): a line ending in `:` or starting with `#` opens a
 *   section; every other non-empty line is a step (a leading `-`, `*` or
 *   `1.` is dropped). Steps before any section go under "General".
 */
export function parseCleaningStepsFile(text: string, fileName: string): CleaningStepsParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length)
    return { error: 'The file is empty.' }

  const sections: CleaningStepSection[] = []
  const sectionNamed = (title: string) => {
    const existing = sections.find(s => s.title.toLowerCase() === title.toLowerCase())
    if (existing)
      return existing
    const created: CleaningStepSection = { id: newCleaningStepId('sec'), title, steps: [] }
    sections.push(created)
    return created
  }

  if (fileName.toLowerCase().endsWith('.csv')) {
    for (const [index, line] of lines.entries()) {
      const [section = '', step = ''] = splitCsvLine(line)
      if (index === 0 && section.toLowerCase() === 'section' && step.toLowerCase() === 'step')
        continue
      if (!step)
        continue
      sectionNamed(section || 'General').steps.push({ id: newCleaningStepId('step'), label: step })
    }
  }
  else {
    let current: CleaningStepSection | null = null
    for (const line of lines) {
      if (line.startsWith('#') || line.endsWith(':')) {
        current = sectionNamed(line.replace(/^#+\s*/, '').replace(/:$/, '').trim() || 'General')
        continue
      }
      const label = line.replace(/^(?:[-*•]|\d+[.)])\s*/, '').trim()
      if (label)
        (current ?? (current = sectionNamed('General'))).steps.push({ id: newCleaningStepId('step'), label })
    }
  }

  const cleaned = cleanCleaningSteps(sections)
  return cleaned.length ? { sections: cleaned } : { error: 'No steps found. Use one row per step: Section,Step.' }
}
