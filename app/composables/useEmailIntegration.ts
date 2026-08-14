import { computed } from 'vue'
import { useNotifications } from '~/composables/useNotifications'
import { useInbox } from '~/composables/useInbox'

export type EmailDnsRecordType = 'SPF' | 'DKIM' | 'TXT' | 'MX'
export interface EmailDnsRecord {
  type: EmailDnsRecordType
  host: string
  value: string
  purpose: string
  optional?: boolean
}

export type EmailVerificationStatus = 'pending' | 'verified'

export interface EmailAccount {
  id: string
  mode: 'default' | 'custom'
  domain: string
  prefix: string
  address: string
  status: EmailVerificationStatus
  dnsRecords: EmailDnsRecord[]
  verificationToken: string
  connectedAt: string
  verifiedAt: string | null
}

export interface EmailInboxPop {
  id: string
  conversationId: string
  guestName: string
  listingName: string
  from: string
  subject: string
  timestamp: string
  dismissed: boolean
}

const STORAGE_KEY = 'elev8-email-accounts'

// Tenant slug used for the shared default address — mirrors Guesty's
// `@user.guesty.com` pattern (one default per tenant, zero setup).
const TENANT_SLUG = 'acme-inc'
const DEFAULT_DOMAIN = 'mail.elev8-suite.com'

function loadFromStorage<T>(key: string, fallback: T): T {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(key)
      if (raw)
        return JSON.parse(raw) as T
    }
    catch { /* ignore */ }
  }
  return fallback
}

function saveToStorage<T>(key: string, value: T) {
  if (import.meta.client) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    }
    catch { /* ignore */ }
  }
}

function buildDefaultAccount(): EmailAccount {
  return {
    id: `email-default`,
    mode: 'default',
    domain: DEFAULT_DOMAIN,
    prefix: TENANT_SLUG,
    address: `${TENANT_SLUG}@${DEFAULT_DOMAIN}`,
    status: 'verified',
    dnsRecords: [],
    verificationToken: '',
    connectedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
  }
}

export function useEmailIntegration() {
  const accounts = useState<EmailAccount[]>('email-accounts', () => loadFromStorage<EmailAccount[]>(STORAGE_KEY, []))

  watch(accounts, (val) => {
    saveToStorage(STORAGE_KEY, val)
  }, { deep: true })

  // The active sending address: verified custom domain if present, else the
  // default shared address. A pending custom domain never breaks sending —
  // the default stays active until DNS verification passes (no downtime).
  const defaultAccount = computed<EmailAccount>(() => accounts.value.find(a => a.mode === 'default') ?? buildDefaultAccount())
  const customAccount = computed<EmailAccount | undefined>(() => accounts.value.find(a => a.mode === 'custom'))
  const verifiedCustomAccount = computed<EmailAccount | undefined>(() => customAccount.value?.status === 'verified' ? customAccount.value : undefined)

  const activeAccount = computed<EmailAccount>(() => verifiedCustomAccount.value ?? defaultAccount.value)
  const isConnected = computed(() => accounts.value.length > 0)
  const isVerified = computed(() => activeAccount.value.status === 'verified')
  const hasPendingCustom = computed(() => customAccount.value?.status === 'pending')

  const emailInboxPops = useState<EmailInboxPop[]>('email-inbox-pops', () => [])

  function connectDefault(): { success: true, account: EmailAccount } | { success: false, error: string } {
    const account = buildDefaultAccount()
    accounts.value = [account]
    return { success: true, account }
  }

  function connectCustom(domain: string, prefix: string): { success: true, account: EmailAccount } | { success: false, error: string } {
    const cleanDomain = domain.trim().toLowerCase()
    const cleanPrefix = prefix.trim().toLowerCase().replace(/^@+|@+$/g, '')

    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(cleanDomain))
      return { success: false, error: 'Enter a valid domain (e.g. villacanggu.com).' }
    if (!cleanPrefix)
      return { success: false, error: 'Prefix is required.' }
    if (!/^[\w.-]+$/.test(cleanPrefix))
      return { success: false, error: 'Prefix can only contain letters, numbers, dots, dashes, and underscores.' }

    const address = `${cleanPrefix}@${cleanDomain}`
    const verificationToken = `elev8-verify-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
    const dnsRecords: EmailDnsRecord[] = [
      {
        type: 'SPF',
        host: `@`,
        value: `"v=spf1 include:send.elev8suite.com ~all"`,
        purpose: 'Authorizes Elev8 to send from your domain',
      },
      {
        type: 'DKIM',
        host: `${cleanPrefix}._domainkey.${cleanDomain}`,
        value: `"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..."`,
        purpose: 'Signs and authenticates outbound messages',
      },
      {
        type: 'TXT',
        host: `@`,
        value: `"${verificationToken}"`,
        purpose: 'Proves domain ownership to Elev8',
      },
      {
        type: 'MX',
        host: `@`,
        value: `10 mx.send.elev8suite.com`,
        purpose: 'Routes incoming replies to this address into the Unified Inbox',
        optional: true,
      },
    ]

    const account: EmailAccount = {
      id: `email-${Date.now()}`,
      mode: 'custom',
      domain: cleanDomain,
      prefix: cleanPrefix,
      address,
      status: 'pending',
      dnsRecords,
      verificationToken,
      connectedAt: new Date().toISOString(),
      verifiedAt: null,
    }

    // Keep the default account so sending keeps working while DNS propagates.
    const current = accounts.value
    accounts.value = [account, ...current.filter(a => a.mode !== 'custom')]
    return { success: true, account }
  }

  async function verifyDomain(): Promise<{ success: true, account: EmailAccount } | { success: false, error: string }> {
    const current = customAccount.value
    if (!current)
      return { success: false, error: 'No custom domain connected.' }

    // Mock DNS propagation check — mirrors the mock-async patterns used by 3CX/WhatsApp.
    await new Promise(resolve => setTimeout(resolve, 1200))

    const updated: EmailAccount = {
      ...current,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
    }
    accounts.value = accounts.value.map(a => a.id === updated.id ? updated : a)

    const notifications = useNotifications()
    notifications.createAlert('EMAIL_DOMAIN_VERIFIED', 'INFO', {
      address: updated.address,
      domain: updated.domain,
      mode: updated.mode,
    })

    return { success: true, account: updated }
  }

  function disconnect() {
    accounts.value = []
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // ── Inbound replies (mirrors the 3CX inbound-call pipeline) ─────────────
  function getActiveEmailPop(): EmailInboxPop | undefined {
    return emailInboxPops.value.find(p => !p.dismissed)
  }

  function dismissEmailPop(id: string) {
    emailInboxPops.value = emailInboxPops.value.map(p => p.id === id ? { ...p, dismissed: true } : p)
  }

  async function simulateInboundEmail(opts: {
    from: string
    to: string
    subject?: string
    content: string
  }): Promise<{ messageId: string, matched: boolean, conversationId?: string }> {
    const inbox = useInbox()
    const notifications = useNotifications()

    const result = inbox.simulateInboundEmail(opts)

    // Pop-up notification (mirrors 3CX screen-pop) + Notification Center alert.
    const conv = result.conversationId
      ? inbox.conversations.value.find(c => c.id === result.conversationId)
      : undefined
    const pop: EmailInboxPop = {
      id: `email-pop-${Date.now()}`,
      conversationId: result.conversationId ?? '',
      guestName: conv?.guestName ?? (opts.from.split('@')[0] || opts.from),
      listingName: conv?.listingName ?? 'Unknown',
      from: opts.from,
      subject: opts.subject ?? '',
      timestamp: new Date().toISOString(),
      dismissed: false,
    }
    emailInboxPops.value = [...emailInboxPops.value, pop]

    notifications.createEmailReplyAlert({
      guestName: pop.guestName,
      from: opts.from,
      subject: opts.subject ?? '',
      conversationId: result.conversationId ?? null,
      matched: result.matched,
    })

    return result
  }

  return {
    accounts,
    defaultAccount,
    customAccount,
    activeAccount,
    isConnected,
    isVerified,
    hasPendingCustom,
    emailInboxPops,
    connectDefault,
    connectCustom,
    verifyDomain,
    disconnect,
    simulateInboundEmail,
    dismissEmailPop,
    getActiveEmailPop,
  }
}

// Single source of truth for the outbound email sender across every surface
// (Unified Inbox replies, Guest Guide sends, Dynamic Templates, receipts).
// Returns null when email has not been connected yet.
export function getActiveEmailAddress(): string | null {
  if (!import.meta.client)
    return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return null
    const accounts = JSON.parse(raw) as EmailAccount[]
    const verifiedCustom = accounts.find(a => a.mode === 'custom' && a.status === 'verified')
    if (verifiedCustom)
      return verifiedCustom.address
    const def = accounts.find(a => a.mode === 'default')
    if (def)
      return def.address
    return null
  }
  catch {
    return null
  }
}
