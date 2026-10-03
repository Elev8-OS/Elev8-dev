import { describe, expect, it } from 'vitest'
import { cloneCleaningSteps, parseCleaningStepsFile } from '~/components/cleaning/data/cleaning-steps'

function titles(result: ReturnType<typeof parseCleaningStepsFile>) {
  if ('error' in result)
    throw new Error(result.error)
  return result.sections.map(s => [s.title, s.steps.map(st => st.label)])
}

describe('parseCleaningStepsFile', () => {
  it('reads CSV rows, skipping the header and grouping by section in order', () => {
    const csv = 'Section,Step\nKitchen,Clean fridge\nBathroom,Scrub shower\nKitchen,"Wipe counters, stove"\n'
    expect(titles(parseCleaningStepsFile(csv, 'steps.csv'))).toEqual([
      ['Kitchen', ['Clean fridge', 'Wipe counters, stove']],
      ['Bathroom', ['Scrub shower']],
    ])
  })

  it('accepts semicolons and a BOM, and files rows without a section under General', () => {
    expect(titles(parseCleaningStepsFile('﻿;Open windows\nPool;Skim pool', 'x.CSV'))).toEqual([
      ['General', ['Open windows']],
      ['Pool', ['Skim pool']],
    ])
  })

  it('reads text with "Section:" or "# Section" headings and bullet steps', () => {
    const text = 'Start:\n- Open windows\n\n# Kitchen\n1. Clean fridge\n* Mop floor\n'
    expect(titles(parseCleaningStepsFile(text, 'steps.txt'))).toEqual([
      ['Start', ['Open windows']],
      ['Kitchen', ['Clean fridge', 'Mop floor']],
    ])
  })

  it('reports an empty file or one with no steps', () => {
    expect(parseCleaningStepsFile('  \n', 'a.csv')).toEqual({ error: 'The file is empty.' })
    expect('error' in parseCleaningStepsFile('Section,Step\nKitchen,', 'a.csv')).toBe(true)
  })
})

describe('cloneCleaningSteps', () => {
  it('copies labels with fresh ids', () => {
    const source = [{ id: 's', title: 'A', steps: [{ id: '1', label: 'Mop' }] }]
    const copy = cloneCleaningSteps(source)
    expect(copy[0]!.title).toBe('A')
    expect(copy[0]!.steps[0]!.label).toBe('Mop')
    expect(copy[0]!.id).not.toBe('s')
    expect(copy[0]!.steps[0]!.id).not.toBe('1')
  })
})
