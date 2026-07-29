import type { Journey, JourneyGroup, JourneyStatus } from '~/components/journeys/data/journeys'
import { toast } from 'vue-sonner'
import { mockGroups, mockJourneys } from '~/components/journeys/data/journeys'

export function useJourneys() {
  const journeys = useState<Journey[]>('journeys', () => mockJourneys)
  const groups = useState<JourneyGroup[]>('journey-groups', () => mockGroups)

  function toggleStatus(id: string) {
    journeys.value = journeys.value.map(j =>
      j.id === id
        ? { ...j, status: (j.status === 'active' ? 'inactive' : 'active') as JourneyStatus }
        : j,
    )
  }

  function saveJourney(journey: Journey) {
    const exists = journeys.value.find(j => j.id === journey.id)
    if (exists) {
      journeys.value = journeys.value.map(j =>
        j.id === journey.id
          ? { ...journey, lastModified: new Date().toISOString().split('T')[0] }
          : j,
      )
    }
    else {
      journeys.value = [
        ...journeys.value,
        { ...journey, lastModified: new Date().toISOString().split('T')[0] },
      ]
    }
  }

  function deleteJourney(id: string) {
    journeys.value = journeys.value.filter(j => j.id !== id)
    groups.value = groups.value.map(g => ({
      ...g,
      journeyIds: g.journeyIds.filter(jid => jid !== id),
    }))
  }

  function duplicateJourney(id: string) {
    const original = journeys.value.find(j => j.id === id)
    if (!original)
      return
    const newId = `j-${Date.now()}`
    const copy: Journey = JSON.parse(JSON.stringify(original))
    copy.id = newId
    copy.name = `${original.name} (Copy)`
    copy.status = 'inactive'
    copy.lastModified = new Date().toISOString().split('T')[0]
    copy.steps = copy.steps.map((s, i) => ({ ...s, id: `${newId}-s${i}` }))
    journeys.value = [...journeys.value, copy]
  }

  // --- Group management ---

  function createGroup(name: string, journeyIds: string[] = []) {
    const id = `g-${Date.now()}`
    if (journeyIds.length > 0) {
      groups.value = groups.value.map(g => ({
        ...g,
        journeyIds: g.journeyIds.filter(jid => !journeyIds.includes(jid)),
      }))
    }
    groups.value = [...groups.value, { id, name, journeyIds: [...journeyIds], collapsed: false }]
  }

  function deleteGroup(id: string) {
    groups.value = groups.value.filter(g => g.id !== id)
  }

  function renameGroup(id: string, name: string) {
    groups.value = groups.value.map(g => g.id === id ? { ...g, name } : g)
  }

  function toggleGroupCollapse(id: string) {
    groups.value = groups.value.map(g => g.id === id ? { ...g, collapsed: !g.collapsed } : g)
  }

  function moveJourneyToGroup(journeyId: string, groupId: string | null) {
    groups.value = groups.value.map(g => ({
      ...g,
      journeyIds: g.journeyIds.filter(jid => jid !== journeyId),
    }))
    if (groupId) {
      groups.value = groups.value.map(g =>
        g.id === groupId ? { ...g, journeyIds: [...g.journeyIds, journeyId] } : g,
      )
    }
  }

  function addJourneysToGroup(groupId: string, journeyIds: string[]) {
    groups.value = groups.value.map(g => ({
      ...g,
      journeyIds: g.journeyIds.filter(jid => !journeyIds.includes(jid)),
    }))
    groups.value = groups.value.map(g =>
      g.id === groupId ? { ...g, journeyIds: [...g.journeyIds, ...journeyIds] } : g,
    )
  }

  function onMinutEvent(event: { type: string, deviceId: string, listingId: string }) {
    const minutType = `minut_${event.type}` as const
    for (const journey of journeys.value) {
      if (journey.status !== 'active')
        continue
      const triggerStep = journey.steps.find(s => s.type === 'trigger') as any
      if (!triggerStep)
        continue
      const matches = (triggerStep.triggers ?? []).some((t: any) => t.type === minutType)
      if (!matches)
        continue
      const inScope = triggerStep.properties?.includes('All Properties')
        || triggerStep.properties?.includes(event.listingId)
      if (!inScope)
        continue
      toast.info(`Journey "${journey.name}" triggered by Minut ${event.type}`, {
        description: `Device ${event.deviceId} at listing ${event.listingId}`,
      })
    }
  }

  return {
    journeys,
    toggleStatus,
    saveJourney,
    deleteJourney,
    duplicateJourney,
    groups,
    createGroup,
    deleteGroup,
    renameGroup,
    toggleGroupCollapse,
    moveJourneyToGroup,
    addJourneysToGroup,
    onMinutEvent,
  }
}
