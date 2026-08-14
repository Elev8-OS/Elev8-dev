import { describe, expect, it } from 'vitest'
import { useEmailIntegration } from '~/composables/useEmailIntegration'
import { useInbox } from '~/composables/useInbox'
import { useNotifications } from '~/composables/useNotifications'

describe('useEmailIntegration', () => {
  it('initializes disconnected with a synthesized default address', () => {
    const { isConnected, activeAccount, hasPendingCustom } = useEmailIntegration()
    expect(isConnected.value).toBe(false)
    // The default account is always resolvable as the fallback sender.
    expect(activeAccount.value.mode).toBe('default')
    expect(activeAccount.value.address).toMatch(/@mail\.elev8-suite\.com$/)
    expect(hasPendingCustom.value).toBe(false)
  })

  it('connectDefault creates a verified zero-setup address from the tenant slug', () => {
    const { connectDefault, activeAccount, isVerified } = useEmailIntegration()
    const result = connectDefault()
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.account.mode).toBe('default')
    expect(result.account.address).toBe('acme-inc@mail.elev8-suite.com')
    expect(result.account.status).toBe('verified')
    expect(result.account.verifiedAt).not.toBeNull()
    expect(result.account.dnsRecords).toHaveLength(0)
    expect(activeAccount.value.address).toBe(result.account.address)
    expect(isVerified.value).toBe(true)
  })

  it('connectCustom rejects invalid domains and prefixes', () => {
    const { connectCustom } = useEmailIntegration()
    expect(connectCustom('', 'stay').success).toBe(false)
    expect(connectCustom('notadomain', 'stay').success).toBe(false)
    expect(connectCustom('villacanggu.com', '').success).toBe(false)
    expect(connectCustom('villacanggu.com', 'with space').success).toBe(false)
    expect(connectCustom('villacanggu.com', 'stay@').success).toBe(true)
  })

  it('connectCustom builds address, token, 4 DNS records, and keeps the default active while pending', () => {
    const { connectCustom, activeAccount, defaultAccount, hasPendingCustom } = useEmailIntegration()
    const result = connectCustom('VillaCanggu.com', 'stay@')
    expect(result.success).toBe(true)
    if (!result.success)
      return
    const account = result.account
    expect(account.mode).toBe('custom')
    expect(account.address).toBe('stay@villacanggu.com')
    expect(account.status).toBe('pending')
    expect(account.verifiedAt).toBeNull()
    expect(account.verificationToken).toMatch(/^elev8-verify-/)
    // SPF + DKIM + TXT + optional MX
    expect(account.dnsRecords).toHaveLength(4)
    const types = account.dnsRecords.map(r => r.type)
    expect(types).toEqual(['SPF', 'DKIM', 'TXT', 'MX'])
    const txt = account.dnsRecords.find(r => r.type === 'TXT')
    expect(txt?.value).toContain(account.verificationToken)
    const mx = account.dnsRecords.find(r => r.type === 'MX')
    expect(mx?.optional).toBe(true)
    // While pending, the default address is still the active sender (no downtime)
    expect(hasPendingCustom.value).toBe(true)
    expect(activeAccount.value.address).toBe(defaultAccount.value.address)
  })

  it('verifyDomain promotes the custom address to active sender', async () => {
    const { connectCustom, verifyDomain, activeAccount, hasPendingCustom, isVerified } = useEmailIntegration()
    connectCustom('villacanggu.com', 'stay')
    expect(hasPendingCustom.value).toBe(true)
    const result = await verifyDomain()
    expect(result.success).toBe(true)
    expect(hasPendingCustom.value).toBe(false)
    expect(activeAccount.value.mode).toBe('custom')
    expect(activeAccount.value.address).toBe('stay@villacanggu.com')
    expect(activeAccount.value.status).toBe('verified')
    expect(isVerified.value).toBe(true)
  })

  it('disconnect clears the connected state', () => {
    const { connectDefault, disconnect, isConnected } = useEmailIntegration()
    connectDefault()
    expect(isConnected.value).toBe(true)
    disconnect()
    expect(isConnected.value).toBe(false)
  })

  it('simulateInboundEmail matches a known guest email and creates pop + alert', async () => {
    const email = useEmailIntegration()
    email.connectDefault()
    const inbox = useInbox()

    const before = inbox.conversations.value.length
    const result = await email.simulateInboundEmail({
      from: 'sofia.m@email.com',
      to: 'acme-inc@mail.elev8-suite.com',
      subject: 'Re: Check-in details',
      content: 'Hi, we land at 2 PM tomorrow.',
    })

    expect(result.matched).toBe(true)
    expect(result.conversationId).toBeTruthy()
    // Conversation already existed → no new conversation, message appended.
    expect(inbox.conversations.value.length).toBe(before)

    // Pop-up was created
    expect(email.getActiveEmailPop()).toBeTruthy()
    expect(email.getActiveEmailPop()?.guestName).toBeTruthy()

    // Notification Center alert was created
    const notifications = useNotifications()
    const replyAlert = notifications.alerts.value.find(a => a.type === 'EMAIL_REPLY_RECEIVED')
    expect(replyAlert).toBeTruthy()
  })

  it('simulateInboundEmail with unknown sender creates an unmatched conversation + alert', async () => {
    const email = useEmailIntegration()
    email.connectDefault()
    const inbox = useInbox()

    const before = inbox.conversations.value.length
    const unknownEmail = `new.guest${Date.now()}@gmail.com`
    const result = await email.simulateInboundEmail({
      from: unknownEmail,
      to: 'acme-inc@mail.elev8-suite.com',
      subject: 'New inquiry',
      content: 'Hi, is the villa available next month?',
    })

    expect(result.matched).toBe(false)
    expect(result.conversationId).toBeTruthy()
    // New unmatched conversation created
    expect(inbox.conversations.value.length).toBe(before + 1)
    const newConv = inbox.conversations.value.find(c => c.id === result.conversationId)
    expect(newConv?.stayStatus).toBe('unmatched')
    expect(newConv?.otaSource).toBe('Email')

    expect(email.getActiveEmailPop()?.conversationId).toBe(result.conversationId)

    const notifications = useNotifications()
    const replyAlert = notifications.alerts.value.find(a => a.type === 'EMAIL_REPLY_RECEIVED')
    expect(replyAlert).toBeTruthy()
  })
})
