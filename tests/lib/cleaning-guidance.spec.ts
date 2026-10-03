import { beforeEach, describe, expect, it } from 'vitest'
import { parseYouTubeId } from '~/components/cleaning/data/cleaning-guidance'
import { cleanCleaningSteps, cloneCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { useCleaningGuidance } from '~/composables/useCleaningGuidance'

const ID = 'aBcDeFgHiJ1'

describe('parseYouTubeId', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=xyz`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `youtube.com/watch?v=${ID}`,
    ID,
  ])('reads %s', (url) => {
    expect(parseYouTubeId(url)).toBe(ID)
  })

  it.each(['https://vimeo.com/12345', 'https://www.youtube.com/channel/UCabc', 'not a link', 'https://youtu.be/short'])('rejects %s', (url) => {
    expect(parseYouTubeId(url)).toBeNull()
  })
})

describe('guidance on steps', () => {
  it('keeps guidance ids through save and copy, without duplicates', () => {
    const sections = [{ id: 's', title: 'Beds', steps: [{ id: '1', label: ' Make beds ', guidanceIds: ['gd-bed', 'gd-bed'] }, { id: '2', label: 'Mop', guidanceIds: [] }] }]
    const cleaned = cleanCleaningSteps(sections)
    expect(cleaned[0]!.steps[0]).toEqual({ id: '1', label: 'Make beds', guidanceIds: ['gd-bed'] })
    expect(cleaned[0]!.steps[1]).toEqual({ id: '2', label: 'Mop' })
    expect(cloneCleaningSteps(cleaned)[0]!.steps[0]!.guidanceIds).toEqual(['gd-bed'])
  })
})

describe('useCleaningGuidance', () => {
  beforeEach(() => localStorage.clear())

  it('creates, updates and deletes, dropping deleted ids when resolving', () => {
    const { createGuidance, updateGuidance, deleteGuidance, resolveGuidance } = useCleaningGuidance()
    const g = createGuidance({ title: ' Pool ', body: 'Skim first.', videos: [{ url: `https://youtu.be/${ID}`, youtubeId: ID }] })
    expect(g.title).toBe('Pool')
    expect(g.videos[0]!.id).toBeTruthy()
    updateGuidance(g.id, { title: 'Pool care', body: 'Skim first.', videos: [] })
    expect(resolveGuidance([g.id, 'missing']).map(x => x.title)).toEqual(['Pool care'])
    deleteGuidance(g.id)
    expect(resolveGuidance([g.id])).toEqual([])
  })
})
