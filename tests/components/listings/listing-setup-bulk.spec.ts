import type { AvoidTopic } from '~/components/listings/data/listing-avoid-topics'
import type { Listing } from '~/components/listings/data/listings'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { applyAvoidTopics, copyAvoidTopicsToListings, listingAvoidTopics, removeAvoidTopics } from '~/components/listings/data/listing-avoid-topics'
import { listingSetupProgress } from '~/components/listings/data/listing-setup-progress'
import { addCustomSop, applySops, copySopsToListings, customSopCounts, customSopSelectionId, customSopsIn, deleteSops, removedSopFieldsIn, restoreSopGroup, selectableSopIds, updateCustomSop, visibleSopGroups } from '~/components/listings/data/listing-sops'
import { listings } from '~/components/listings/data/listings'

// `listings` is a module-level ref, not reset by tests/setup.ts.
let snapshot: Listing[]
beforeEach(() => { snapshot = structuredClone(toRaw(listings.value)) })
afterEach(() => { listings.value = snapshot })

const byId = (id: string) => listings.value.find(l => l.id === id)!
const clone = (id: string): Listing => structuredClone(toRaw(byId(id)))

function withSops(l: Listing): Listing {
  let next: Listing = { ...l, sops: { checkInProcedure: 'Meet at the gate', emergencyProcedure: 'Call 112' }, resources: { ...l.resources, sops: '' } }
  next = addCustomSop(next)
  return updateCustomSop(next, next.sops!.custom![0]!.id, { title: 'Pool', text: 'Clean daily' })
}

describe('sop bulk actions', () => {
  it('every default question (answered or not), General procedures and custom SOPs are selectable', () => {
    const l = withSops(clone('lst-1'))
    const ids = selectableSopIds(l)
    expect(ids).toHaveLength(9 + 1)
    expect(ids).toContain('sop:checkOutProcedure')
    expect(ids).toContain('sops')
    expect(ids).toContain(customSopSelectionId(l.sops!.custom![0]!.id))
  })

  it('copying skips a selected question with no answer, keeping the target\'s', () => {
    const source = withSops(clone('lst-1'))
    const target: Listing = { ...clone('lst-2'), sops: { complaints: 'Keep me' } }
    expect(applySops(source, target, ['sop:complaints']).sops?.complaints).toBe('Keep me')
  })

  it('delete clears the selected answers and removes the selected custom SOPs', () => {
    const l = withSops(clone('lst-1'))
    const next = deleteSops(l, ['sop:checkInProcedure', customSopSelectionId(l.sops!.custom![0]!.id)])
    expect(next.sops).toMatchObject({ checkInProcedure: '', emergencyProcedure: 'Call 112', custom: [] })
  })

  it('applying replaces the target\'s answers and adds custom SOPs with fresh ids', () => {
    const source = withSops(clone('lst-1'))
    const target: Listing = { ...clone('lst-2'), sops: { checkInProcedure: 'Old', complaints: 'Keep me' } }
    const customId = customSopSelectionId(source.sops!.custom![0]!.id)
    const next = applySops(source, target, ['sop:checkInProcedure', customId])
    expect(next.sops).toMatchObject({ checkInProcedure: 'Meet at the gate', complaints: 'Keep me' })
    expect(next.sops?.emergencyProcedure).toBeUndefined()
    expect(next.sops!.custom).toHaveLength(1)
    expect(next.sops!.custom![0]).toMatchObject({ title: 'Pool', text: 'Clean daily' })
    expect(next.sops!.custom![0]!.id).not.toBe(source.sops!.custom![0]!.id)
  })

  it('copies to the picked listings only, never back to the source', () => {
    const source = withSops(clone('lst-1'))
    const count = copySopsToListings(source, ['sop:emergencyProcedure'], ['lst-2', 'lst-3', 'lst-1'])
    expect(count).toBe(2)
    expect(byId('lst-2').sops?.emergencyProcedure).toBe('Call 112')
    expect(byId('lst-3').sops?.emergencyProcedure).toBe('Call 112')
    expect(byId('lst-4').sops?.emergencyProcedure).toBeUndefined()
  })
})

describe('deleting default SOP questions', () => {
  it('removes the questions but keeps their group, with 0 fields', () => {
    const l = deleteSops(clone('lst-1'), ['sop:checkInProcedure', 'sop:checkOutProcedure'])
    const group = visibleSopGroups(l).find(g => g.key === 'check-in-out')!
    expect(group.fields).toHaveLength(0)
    expect(visibleSopGroups(l)).toHaveLength(6)
    expect(selectableSopIds(l)).not.toContain('sop:checkInProcedure')
  })

  it('restore brings a group\'s deleted questions back, empty', () => {
    let l = withSops(clone('lst-1'))
    l = deleteSops(l, ['sop:checkInProcedure'])
    expect(removedSopFieldsIn(l, 'check-in-out').map(f => f.key)).toEqual(['sop:checkInProcedure'])
    l = restoreSopGroup(l, 'check-in-out')
    expect(visibleSopGroups(l).find(g => g.key === 'check-in-out')!.fields).toHaveLength(2)
    expect(l.sops?.checkInProcedure).toBe('')
  })

  it('progress counts only the questions left, and a section with none counts as done', () => {
    const allKeys = visibleSopGroups(clone('lst-1')).flatMap(g => g.fields).map(f => f.key)
    const l = deleteSops({ ...clone('lst-1'), sops: {} }, allKeys)
    const sops = listingSetupProgress(l).sections.find(s => s.key === 'sops')!
    expect(sops).toMatchObject({ done: 0, total: 0, complete: true })
    expect(Number.isNaN(listingSetupProgress(l).percent)).toBe(false)
  })

  it('copying an answer brings the question back on a target that deleted it', () => {
    const source = withSops(clone('lst-1'))
    const target = deleteSops(clone('lst-2'), ['sop:checkInProcedure'])
    const next = applySops(source, target, ['sop:checkInProcedure'])
    expect(next.sops?.checkInProcedure).toBe('Meet at the gate')
    expect(next.sops?.removed).not.toContain('sop:checkInProcedure')
  })
})

describe('custom SOP groups', () => {
  it('a custom SOP without a group belongs to Other', () => {
    const l: Listing = { ...clone('lst-1'), sops: { custom: [{ id: 'a', title: 'Old', text: '' }, { id: 'b', title: 'New', text: '', group: 'rules' }] } }
    expect(customSopsIn(l, 'other').map(s => s.id)).toEqual(['a'])
    expect(customSopsIn(l, 'rules').map(s => s.id)).toEqual(['b'])
    expect(customSopCounts(l)).toMatchObject({ other: 1, rules: 1, emergencies: 0 })
  })

  it('copying keeps a custom SOP in its group', () => {
    const source: Listing = { ...clone('lst-1'), sops: { custom: [{ id: 'b', title: 'Noise', text: 'Quiet after 22:00', group: 'rules' }] } }
    const next = applySops(source, clone('lst-2'), [customSopSelectionId('b')])
    expect(next.sops!.custom![0]).toMatchObject({ title: 'Noise', group: 'rules' })
  })
})

describe('topic bulk actions', () => {
  const topic = (id: string, name: string, action: AvoidTopic['action'] = 'defer_team'): AvoidTopic => ({ id, topic: name, description: '', action })

  it('removes the selected topics', () => {
    const l = clone('lst-1')
    const ids = listingAvoidTopics(l).map(t => t.id)
    expect(listingAvoidTopics(removeAvoidTopics(l, [ids[0]!]))).toHaveLength(ids.length - 1)
  })

  it('adds new topics and replaces one with the same name, keeping the target\'s id', () => {
    const target = { ...clone('lst-2'), resources: { ...clone('lst-2').resources, avoidTopics: [topic('t-old', 'Refund requests')] } }
    const next = applyAvoidTopics(target, [topic('s-1', 'refund requests', 'defer_host'), topic('s-2', 'Parties', 'no_response')])
    const topics = listingAvoidTopics(next)
    expect(topics).toHaveLength(2)
    expect(topics[0]).toMatchObject({ id: 't-old', action: 'defer_host' })
    expect(topics[1]).toMatchObject({ topic: 'Parties', action: 'no_response' })
    expect(topics[1]!.id).not.toBe('s-2')
  })

  it('copies topics into other listings', () => {
    const count = copyAvoidTopicsToListings('lst-1', [topic('s-1', 'Parties', 'no_response')], ['lst-2'])
    expect(count).toBe(1)
    expect(listingAvoidTopics(byId('lst-2')).map(t => t.topic)).toContain('Parties')
  })
})
