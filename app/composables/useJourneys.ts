import type { Journey, JourneyGroup, JourneyStatus, MessageStep, TriggerEntry, TriggerStep } from '~/components/journeys/data/journeys'
import type { MinutEvent } from '~/composables/useMinut'
import { toast } from 'vue-sonner'
import { mockGroups, mockJourneys } from '~/components/journeys/data/journeys'
import { useWhatsApp } from '~/composables/useWhatsApp'

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

  function onMinutEvent(event: Pick<MinutEvent, 'type' | 'deviceId' | 'listingId'>) {
    for (const journey of journeys.value) {
      if (journey.status !== 'active')
        continue
      const triggerStep = journey.steps.find((s): s is TriggerStep => s.type === 'trigger')
      if (!triggerStep)
        continue
      const matches = triggerStep.triggers.some((t: TriggerEntry) => t.type === 'minut_event')
      if (!matches)
        continue
      // Devices must be mapped to a listing before their events can scope to a journey.
      if (!event.listingId)
        continue
      const inScope = triggerStep.properties.includes('All Properties')
        || triggerStep.properties.includes(event.listingId)
      if (!inScope)
        continue
      toast.info(`Journey "${journey.name}" triggered by Minut ${event.type}`, {
        description: `Device ${event.deviceId} at listing ${event.listingId}`,
      })
    }
  }

  function onEmailReceived(opts: { from: string, to: string, subject?: string, content: string }) {
    for (const journey of journeys.value) {
      if (journey.status !== 'active')
        continue
      const triggerStep = journey.steps.find((s): s is TriggerStep => s.type === 'trigger')
      if (!triggerStep)
        continue
      const matches = triggerStep.triggers.some((t: TriggerEntry) => t.type === 'email_received')
      if (!matches)
        continue
      const inScope = triggerStep.properties.includes('All Properties')
        || triggerStep.properties.includes(opts.from)
      if (!inScope)
        continue
      toast.info(`Journey "${journey.name}" triggered by email`, {
        description: opts.subject ? `${opts.from} · ${opts.subject}` : `From ${opts.from}`,
      })
    }
  }

  /**
   * Resolve whether a WhatsApp message step should fire for a given listing.
   * A step is skippable only when it targets WhatsApp — an uncovered listing
   * (no connected WhatsApp account assigned) yields a non-blocking skip; the
   * journey continues. A covered listing yields the resolved account.
   */
  function resolveWhatsAppStep(step: MessageStep, listingId: string): { fire: boolean, reason?: string, accountId?: string } {
    if (step.channel !== 'whatsapp')
      return { fire: false, reason: 'not_whatsapp' }
    const { getConnectedAccountForListing } = useWhatsApp()
    const account = getConnectedAccountForListing(listingId)
    if (!account)
      return { fire: false, reason: 'uncovered' }
    return { fire: true, accountId: account.id }
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
    onEmailReceived,
    resolveWhatsAppStep,
  }
}
