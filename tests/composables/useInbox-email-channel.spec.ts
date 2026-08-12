import { describe, expect, it } from 'vitest'
import { useInbox } from '~/composables/useInbox'

describe('useInbox email channel', () => {
  it('exposes Email as a channel option derived from seeded conversations', () => {
    const { channelOptions } = useInbox()
    const email = channelOptions.value.find(c => c.channel === 'Email')
    expect(email).toBeDefined()
    expect(email!.count).toBeGreaterThanOrEqual(1)
  })

  it('filters conversations by the Email channel', () => {
    const { activeChannelFilter, filteredConversations } = useInbox()
    activeChannelFilter.value = 'Email'
    const emails = filteredConversations.value.filter(c => c.otaSource === 'Email')
    expect(emails.length).toBeGreaterThanOrEqual(1)
    // Every filtered conversation is Email (showActionNeeded default true still applies)
    expect(filteredConversations.value.every(c => c.otaSource === 'Email')).toBe(true)
  })

  it('findConversationByEmail matches a seeded email conversation by guest email', () => {
    const { findConversationByEmail } = useInbox()
    expect(findConversationByEmail('sofia.m@email.com')).toBe('conv-em-1')
    expect(findConversationByEmail('SOFIA.M@EMAIL.COM')).toBe('conv-em-1') // case-insensitive
    expect(findConversationByEmail('hannah.lee@email.com')).toBe('conv-em-3')
    expect(findConversationByEmail('nobody@nowhere.com')).toBeUndefined()
  })

  it('simulateInboundEmail appends a matched message and bumps action_needed + unread', () => {
    const { simulateInboundEmail, conversations } = useInbox()
    const before = conversations.value.find(c => c.id === 'conv-em-1')!
    expect(before.unreadCount).toBeGreaterThanOrEqual(1)
    expect(before.status).toBe('action_needed')

    const result = simulateInboundEmail({
      from: 'sofia.m@email.com',
      to: 'stay@villacanggu.com',
      subject: 'WiFi',
      content: 'Could you confirm the WiFi password?',
    })
    expect(result.matched).toBe(true)
    expect(result.conversationId).toBe('conv-em-1')

    const conv = conversations.value.find(c => c.id === 'conv-em-1')!
    expect(conv.lastMessage).toContain('WiFi password')
    expect(conv.unreadCount).toBeGreaterThanOrEqual(1)
  })

  it('simulateInboundEmail creates an unmatched conversation for unknown senders', () => {
    const { simulateInboundEmail, conversations, messages } = useInbox()
    const before = conversations.value.length
    const result = simulateInboundEmail({
      from: 'new.guest@example.com',
      to: 'stay@villacanggu.com',
      content: 'Hi, is the villa available next month?',
    })
    expect(result.matched).toBe(false)
    expect(conversations.value.length).toBe(before + 1)
    const unmatched = conversations.value.find(c => c.labels.includes('unmatched') && c.otaSource === 'Email')
    expect(unmatched).toBeDefined()
    expect(unmatched!.guestEmail).toBe('new.guest@example.com')
    expect(messages.value[unmatched!.id]!.length).toBe(1)
  })
})
