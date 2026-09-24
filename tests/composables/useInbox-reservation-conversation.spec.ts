import { describe, expect, it } from 'vitest'
import { useInbox } from '~/composables/useInbox'

function day(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STAY = {
  id: 'res-no-thread',
  guestName: 'Priya Raman',
  guestEmail: 'priya@example.com',
  listingName: '5BR Pool the R Villa Luwa – Serene near Canggu',
  checkIn: day(-5),
  checkOut: day(0),
}

describe('ensureConversationForReservation', () => {
  it('returns the reservation\'s existing thread and opens nothing new', () => {
    const inbox = useInbox()
    const existing = inbox.conversations.value.find(c => c.reservationId)!
    const before = inbox.conversations.value.length
    const id = inbox.ensureConversationForReservation({ ...STAY, id: existing.reservationId })
    expect(id).toBe(existing.id)
    expect(inbox.conversations.value).toHaveLength(before)
  })

  it('opens an email conversation on the guest\'s address when the reservation has none', () => {
    const inbox = useInbox()
    const id = inbox.ensureConversationForReservation(STAY)!
    const conversation = inbox.conversations.value.find(c => c.id === id)!
    expect(conversation).toMatchObject({
      otaSource: 'Email',
      reservationId: 'res-no-thread',
      guestEmail: 'priya@example.com',
      guestName: 'Priya Raman',
      guestInitials: 'PR',
      stayStatus: 'past',
    })
    expect(inbox.messages.value[id]).toEqual([])
  })

  it('opens it once: a second message goes to the same thread', () => {
    const inbox = useInbox()
    const first = inbox.ensureConversationForReservation(STAY)
    const second = inbox.ensureConversationForReservation(STAY)
    expect(second).toBe(first)
    expect(inbox.conversations.value.filter(c => c.reservationId === 'res-no-thread')).toHaveLength(1)
  })

  it('returns null when there is no thread and no email address to open one on', () => {
    const inbox = useInbox()
    expect(inbox.ensureConversationForReservation({ ...STAY, guestEmail: '  ' })).toBeNull()
    expect(inbox.conversations.value.some(c => c.reservationId === 'res-no-thread')).toBe(false)
  })

  it('reads the stay as current or future from its dates', () => {
    const inbox = useInbox()
    const current = inbox.ensureConversationForReservation({ ...STAY, id: 'res-now', checkIn: day(-1), checkOut: day(2) })!
    const future = inbox.ensureConversationForReservation({ ...STAY, id: 'res-later', checkIn: day(3), checkOut: day(6) })!
    expect(inbox.conversations.value.find(c => c.id === current)!.stayStatus).toBe('current')
    expect(inbox.conversations.value.find(c => c.id === future)!.stayStatus).toBe('future')
  })
})

describe('openForReservation', () => {
  it('selects the reservation\'s existing conversation and says nothing was created', () => {
    const inbox = useInbox()
    const existing = inbox.conversations.value.find(c => c.reservationId)!
    inbox.inboxView.value = 'calls'
    const opened = inbox.openForReservation({ ...STAY, id: existing.reservationId })
    expect(opened).toEqual({ conversationId: existing.id, created: false })
    expect(inbox.selectedConversationId.value).toBe(existing.id)
    expect(inbox.inboxView.value).toBe('conversations')
  })

  it('opens an email conversation first when there is none, and says so', () => {
    const inbox = useInbox()
    const opened = inbox.openForReservation(STAY)!
    expect(opened.created).toBe(true)
    expect(inbox.selectedConversationId.value).toBe(opened.conversationId)
    expect(inbox.conversations.value.find(c => c.id === opened.conversationId)!.otaSource).toBe('Email')
  })

  it('returns null and selects nothing when the guest cannot be reached', () => {
    const inbox = useInbox()
    const before = inbox.selectedConversationId.value
    expect(inbox.openForReservation({ ...STAY, guestEmail: '' })).toBeNull()
    expect(inbox.selectedConversationId.value).toBe(before)
  })
})
