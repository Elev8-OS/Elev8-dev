import type { Conversation, Message, Note, PhoneCall, Reservation, StayStatus, UnmatchedMessage } from '~/components/inbox/data/conversations'
import type { UpsellOrder } from '~/components/upsells/data/upsell-orders'
import { conversations as conversationsData, messages as messagesData, phoneCalls as phoneCallsData, reservations, resolveConversationTenantId, staffMembers, unmatchedMessages as unmatchedData } from '~/components/inbox/data/conversations'
import { useUpsellOrders } from './useUpsellOrders'
import { useGroScope } from './useGroScope'
import { useCurrentDashboardUser } from './useCurrentDashboardUser'

export type SortOption = 'newest' | 'oldest' | 'unread'

export function useInbox() {
  const conversations = useState<Conversation[]>('inbox-conversations', () => conversationsData)

  // Ensure newly added seed conversations are always present
  for (const seed of conversationsData) {
    if (!conversations.value.find(c => c.id === seed.id)) {
      conversations.value = [...conversations.value, seed]
    }
  }
  const selectedConversationId = useState<string | undefined>('inbox-selected-conversation', () => undefined)
  const messages = useState<Record<string, Message[]>>('inbox-messages', () => JSON.parse(JSON.stringify(messagesData)))

  // Ensure any newly added seed messages (e.g. conv-um-*) are always present
  for (const key of Object.keys(messagesData)) {
    if (!messages.value[key]) {
      messages.value = { ...messages.value, [key]: JSON.parse(JSON.stringify((messagesData as Record<string, Message[]>)[key])) }
    }
  }

  const selectedMessages = ref<Message[]>([])

  watch(
    [selectedConversationId, messages],
    ([id]) => {
      if (!id) {
        selectedMessages.value = []
        return
      }
      const msgs = messages.value[id]
      selectedMessages.value = msgs ? [...msgs] : []
    },
    { immediate: true },
  )

  watch(
    messages,
    () => {
      const id = selectedConversationId.value
      if (!id)
        return
      const msgs = messages.value[id]
      if (msgs) {
        selectedMessages.value = [...msgs]
      }
    },
    { deep: true },
  )

  const inboxView = useState<'conversations' | 'integrations' | 'calls'>('inbox-view', () => 'conversations')
  const showActionNeeded = useState<boolean>('inbox-show-action-needed', () => true)
  const assignedToMeFilter = useState<boolean>('inbox-assigned-to-me-filter', () => false)
  const unreadFilter = useState<boolean>('inbox-unread-filter', () => false)
  const activeStayFilter = useState<StayStatus | 'all'>('inbox-active-stay-filter', () => 'all')
  const activeListingFilter = useState<string[]>('inbox-active-listing-filter', () => [])
  const activeTagFilters = useState<string[]>('inbox-active-tag-filters', () => [])
  const activeChannelFilter = useState<string | null>('inbox-active-channel-filter', () => null)
  const activeStaffFilter = useState<string[]>('inbox-active-staff-filter', () => [])
  const activeDateFilter = useState<string | null>('inbox-active-date-filter', () => null)
  const listingSearchText = useState<string>('inbox-listing-search-text', () => '')
  interface ElevaiConvState { on: boolean, pausedUntil?: number }
  const elevaiState = useState<Record<string, ElevaiConvState>>('inbox-elevai-state', () => ({}))
  const searchValue = useState<string>('inbox-search-value', () => '')
  const rightPanelCollapsed = useState<boolean>('inbox-right-panel-collapsed', () => false)
  const autoTranslate = useState<boolean>('inbox-auto-translate', () => true)

  const { isGro, activeTenantId } = useGroScope()
  const { currentUser } = useCurrentDashboardUser()

  const visibleConversations = computed(() => {
    if (!isGro.value || activeTenantId.value === 'all')
      return conversations.value
    return conversations.value.filter(c => resolveConversationTenantId(c) === activeTenantId.value)
  })

  const mockTranslations: Record<string, string> = {
    'Hi! We\'re arriving tomorrow and wanted to confirm the check-in process.': 'Halo! Kami tiba besok dan ingin mengonfirmasi proses check-in.',
    'What time is check-in? We arrive at 3 PM.': 'Jam berapa check-in? Kami tiba jam 3 sore.',
    'Thanks for the info! I\'ll confirm soon.': 'Terima kasih infonya! Saya akan konfirmasi segera.',
    'Is there parking available at the property?': 'Apakah ada parkir di properti?',
    'Thank you so much! Really looking forward to our stay.': 'Terima kasih banyak! Sangat menantikan masa tinggal kami.',
    'Could you recommend any good restaurants nearby?': 'Bisa rekomendasikan restoran bagus di sekitar sini?',
    'Hello! We had a great time at your place. Thank you!': 'Halo! Kami senang sekali di tempat Anda. Terima kasih!',
    'We had an issue with the AC. Can someone come fix it?': 'Kami ada masalah dengan AC. Bisa kirim orang untuk memperbaiki?',
    'What\'s the WiFi password?': 'Password WiFi-nya apa?',
    'Thanks for the wonderful stay! We\'ll definitely be back.': 'Terima kasih untuk masa tinggal yang menyenangkan! Kami pasti akan kembali.',
    'Is early check-in possible? Our flight arrives at 10 AM.': 'Apakah early check-in memungkinkan? Penerbangan kami tiba jam 10 pagi.',
    'Can we extend our stay by one night?': 'Bisa memperpanjang masa tinggal kami satu malam?',
    'The hot water isn\'t working properly.': 'Air panas tidak berfungsi dengan baik.',
    'Do you provide airport transfer service?': 'Apakah Anda menyediakan layanan transfer bandara?',
    'Everything was great, thank you!': 'Semuanya bagus, terima kasih!',
    'Hi, is your place available for a 2-night stay next weekend?': 'Halo, apakah tempat Anda tersedia untuk menginap 2 malam akhir pekan depan?',
    'Thanks! We\'d love to book it.': 'Terima kasih! Kami ingin sekali memesannya.',
    'What\'s the earliest we can check in?': 'Jam berapa paling awal kami bisa check-in?',
    'That sounds perfect, thank you!': 'Kedengarannya sempurna, terima kasih!',
    'We\'d also like to arrange airport pickup if possible.': 'Kami juga ingin mengatur penjemputan bandara jika memungkinkan.',
    'How far is the villa from the beach?': 'Seberapa jauh vila dari pantai?',
    'We have a late flight on checkout day, can we stay until 6 PM?': 'Kami ada penerbangan malam saat checkout, bisa tinggal sampai jam 6 sore?',
    'Is the pool heated?': 'Apakah kolam renangnya dipanaskan?',
    'Can you help us book a scooter?': 'Bisa bantu kami pesan scooter?',
    'We\'re celebrating our anniversary, any special arrangements?': 'Kami merayakan anniversary, ada pengaturan khusus?',
    'The bathroom drain seems to be clogged.': 'Saluran kamar mandi sepertinya tersumbat.',
    'Is there a washing machine we can use?': 'Apakah ada mesin cuci yang bisa kami pakai?',
  }

  async function mockTranslate(text: string, _targetLang: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 500))
    return mockTranslations[text] ?? `[Diterjemahkan] ${text}`
  }

  function toggleRightPanel() {
    rightPanelCollapsed.value = !rightPanelCollapsed.value
  }
  const sortBy = useState<SortOption>('inbox-sort-by', () => 'newest')
  const pendingSuggestion = useState<string>('inbox-pending-suggestion', () => '')

  const notes = useState<Record<string, Note[]>>('inbox-notes', () => ({}))

  const unmatchedMessages = useState<UnmatchedMessage[]>('inbox-unmatched', () => unmatchedData)

  function dismissUnmatched(id: string) {
    // id is a conversation id for unmatched conversations
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (selectedConversationId.value === id)
      selectedConversationId.value = undefined
  }

  function matchUnmatched(unmatchedConvId: string, targetConvId: string) {
    const umMsgs = (messages.value[unmatchedConvId] ?? []).map(m => ({ ...m, conversationId: targetConvId }))
    const existing = messages.value[targetConvId] ?? []
    messages.value = { ...messages.value, [targetConvId]: [...existing, ...umMsgs] }
    const lastMsg = umMsgs[umMsgs.length - 1]
    if (lastMsg) {
      conversations.value = conversations.value.map(c =>
        c.id === targetConvId
          ? { ...c, lastMessage: lastMsg.content, lastMessageAt: lastMsg.timestamp, unreadCount: c.unreadCount + 1 }
          : c,
      )
    }
    conversations.value = conversations.value.filter(c => c.id !== unmatchedConvId)
    selectedConversationId.value = targetConvId
  }

  function createFromUnmatched(unmatchedConvId: string) {
    const um = conversations.value.find(c => c.id === unmatchedConvId)
    if (!um)
      return
    const umMsgs = messages.value[unmatchedConvId] ?? []
    const newId = `conv-wa-new-${Date.now()}`
    const newConv: Conversation = {
      ...um,
      id: newId,
      stayStatus: 'inquiry',
      status: 'action_needed',
      labels: [],
    }
    conversations.value = [newConv, ...conversations.value.filter(c => c.id !== unmatchedConvId)]
    messages.value = { ...messages.value, [newId]: umMsgs.map(m => ({ ...m, conversationId: newId })) }
    selectedConversationId.value = newId
  }

  // ── Inbound email (mirrors the 3CX inbound-call pipeline) ──────────────
  function findConversationByEmail(email: string): string | undefined {
    const clean = email.trim().toLowerCase()
    if (!clean)
      return undefined
    // 1) direct conversation match (guestEmail on an Email conversation)
    const byGuestEmail = conversations.value.find(c =>
      c.otaSource === 'Email'
      && c.guestEmail
      && c.guestEmail.toLowerCase() === clean,
    )
    if (byGuestEmail)
      return byGuestEmail.id
    // 2) reservation guest email match (thread to the matching reservation)
    const resId = Object.keys(reservations).find((id) => {
      const email = reservations[id]?.guestDetails?.email
      return email && email.toLowerCase() === clean
    })
    if (resId) {
      const conv = conversations.value.find(c => c.reservationId === resId && c.otaSource === 'Email')
      return conv?.id
    }
    return undefined
  }

  function simulateInboundEmail(opts: {
    from: string
    to: string
    subject?: string
    content: string
  }): { messageId: string, matched: boolean, conversationId?: string } {
    const conversationId = findConversationByEmail(opts.from)

    // Unmatched sender → create a new unmatched email conversation (mirrors
    // the WhatsApp unmatched pattern), so the email always lands somewhere
    // visible instead of being silently dropped.
    if (!conversationId) {
      const newId = `conv-em-new-${Date.now()}`
      const guestName = opts.from.split('@')[0] || opts.from
      const newConv: Conversation = {
        id: newId,
        guestName: opts.from,
        guestInitials: guestName.slice(0, 2).toUpperCase() || '?',
        listingName: 'Unknown',
        propertyName: 'Unknown',
        otaSource: 'Email',
        reservationId: '',
        guestEmail: opts.from.toLowerCase(),
        status: 'action_needed',
        lastMessage: opts.content,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 1,
        isAssignedToMe: false,
        assignedTo: null,
        tags: [],
        labels: ['unmatched'],
        sentiment: 'neutral',
        sentimentNote: 'Unmatched sender, no reservation linked',
        stayStatus: 'unmatched',
        checkIn: '',
        checkOut: '',
        cleaningStatus: 'cleaning_finished',
        linkedUpsellOrderIds: [],
      }
      const msg: Message = {
        id: `msg-em-live-${Date.now()}`,
        conversationId: newId,
        sender: 'guest',
        senderName: opts.from,
        content: opts.content,
        channel: 'Email',
        timestamp: new Date().toISOString(),
        fromAddress: opts.from,
        toAddress: opts.to,
        messageId: `em-${Date.now()}`,
      }
      conversations.value = [newConv, ...conversations.value]
      messages.value = { ...messages.value, [newId]: [msg] }
      return { messageId: msg.id!, matched: false, conversationId: newId }
    }

    // Matched → append the inbound message to the existing conversation.
    const msg: Message = {
      id: `msg-em-live-${Date.now()}`,
      conversationId,
      sender: 'guest',
      senderName: conversations.value.find(c => c.id === conversationId)?.guestName || opts.from,
      content: opts.content,
      channel: 'Email',
      timestamp: new Date().toISOString(),
      fromAddress: opts.from,
      toAddress: opts.to,
      messageId: `em-${Date.now()}`,
    }
    const currentMessages = messages.value[conversationId] ?? []
    messages.value = { ...messages.value, [conversationId]: [...currentMessages, msg] }

    // Bump to action_needed + unread (mirrors markActionNeededForMissed).
    conversations.value = conversations.value.map(c =>
      c.id === conversationId
        ? {
            ...c,
            status: 'action_needed',
            unreadCount: Math.max(c.unreadCount, 1),
            lastMessage: msg.content,
            lastMessageAt: msg.timestamp,
          }
        : c,
    )

    return { messageId: msg.id!, matched: true, conversationId }
  }

  const filteredConversations = computed(() => {
    let result = visibleConversations.value

    if (showActionNeeded.value) {
      result = result.filter(c => c.status === 'action_needed')
    }

    if (assignedToMeFilter.value) {
      result = result.filter(c => c.isAssignedToMe)
    }

    if (unreadFilter.value) {
      result = result.filter(c => c.unreadCount > 0)
    }

    if (activeStayFilter.value !== 'all') {
      result = result.filter(c => c.stayStatus === activeStayFilter.value)
    }

    if (activeDateFilter.value && activeStayFilter.value !== 'all') {
      const now = new Date()
      now.setHours(0, 0, 0, 0)

      const getDateRange = (filter: string): [Date, Date] => {
        const start = new Date(now)
        const end = new Date(now)
        if (filter === 'today') {
          end.setHours(23, 59, 59, 999)
        }
        else if (filter === 'next-3-days') {
          end.setDate(end.getDate() + 2)
          end.setHours(23, 59, 59, 999)
        }
        else if (filter === 'next-week') {
          end.setDate(end.getDate() + 6)
          end.setHours(23, 59, 59, 999)
        }
        return [start, end]
      }

      const [rangeStart, rangeEnd] = getDateRange(activeDateFilter.value)

      result = result.filter((c) => {
        const dateField = activeStayFilter.value === 'future' ? c.checkIn : c.checkOut
        if (!dateField)
          return false
        const date = new Date(dateField)
        return date >= rangeStart && date <= rangeEnd
      })
    }

    if (activeListingFilter.value.length > 0) {
      result = result.filter(c => activeListingFilter.value.includes(c.listingName))
    }

    if (activeChannelFilter.value) {
      result = result.filter(c => c.otaSource === activeChannelFilter.value)
    }

    if (activeStaffFilter.value.length > 0) {
      result = result.filter((c) => {
        if (activeStaffFilter.value.includes('unassigned')) {
          if (!c.assignedTo)
            return true
        }
        return activeStaffFilter.value.some(id => id !== 'unassigned' && c.assignedTo === id)
      })
    }

    if (searchValue.value) {
      const q = searchValue.value.toLowerCase()
      result = result.filter(
        c =>
          c.guestName.toLowerCase().includes(q)
          || c.listingName.toLowerCase().includes(q)
          || c.propertyName.toLowerCase().includes(q)
          || c.lastMessage.toLowerCase().includes(q)
          || c.labels.some(l => l.toLowerCase().includes(q))
          || c.tags.some(t => t.toLowerCase().includes(q))
          || c.stayStatus.toLowerCase().includes(q)
          || c.otaSource.toLowerCase().includes(q),
      )
    }

    return result.sort((a, b) => {
      if (sortBy.value === 'newest') {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      }
      if (sortBy.value === 'oldest') {
        return new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime()
      }
      if (sortBy.value === 'unread') {
        if (a.unreadCount > 0 && b.unreadCount === 0)
          return -1
        if (a.unreadCount === 0 && b.unreadCount > 0)
          return 1
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      }
      return 0
    })
  })

  const selectedConversation = computed<Conversation | undefined>(() => {
    if (!selectedConversationId.value)
      return undefined
    return conversations.value.find(c => c.id === selectedConversationId.value)
  })

  watch(selectedConversationId, (id) => {
    if (!id)
      return
    const index = conversations.value.findIndex(c => c.id === id)
    if (index !== -1 && conversations.value[index].unreadCount > 0) {
      conversations.value[index] = { ...conversations.value[index], unreadCount: 0 }
    }
  })

  const selectedReservation = computed<Reservation | undefined>(() => {
    const conv = selectedConversation.value
    if (!conv)
      return undefined
    return reservations[conv.reservationId]
  })

  const selectedHasAISuggestion = computed<boolean>(() => {
    return selectedMessages.value.some(m => m.isAISuggestion)
  })

  function isElevaiEnabled(conversationId: string): boolean {
    const s = elevaiState.value[conversationId]
    if (!s)
      return true
    if (s.pausedUntil !== undefined)
      return Date.now() > s.pausedUntil
    return s.on
  }

  function getElevaiState(conversationId: string) {
    return elevaiState.value[conversationId] ?? { on: true }
  }

  function enableElevai(conversationId: string) {
    elevaiState.value = { ...elevaiState.value, [conversationId]: { on: true } }
  }

  function pauseElevai(conversationId: string, minutes: number) {
    elevaiState.value = {
      ...elevaiState.value,
      [conversationId]: { on: false, pausedUntil: Date.now() + minutes * 60 * 1000 },
    }
  }

  function disableElevai(conversationId: string) {
    elevaiState.value = { ...elevaiState.value, [conversationId]: { on: false } }
  }

  function markAsHandled(conversationId: string) {
    const index = conversations.value.findIndex(c => c.id === conversationId)
    if (index !== -1) {
      conversations.value[index] = { ...conversations.value[index], status: null }
      const conv = conversations.value[index]
      if (conv.reservationId && reservations[conv.reservationId]) {
        reservations[conv.reservationId].smartActions = []
      }
    }
  }

  function markAsUnread(conversationId: string) {
    const index = conversations.value.findIndex(c => c.id === conversationId)
    if (index !== -1 && conversations.value[index].unreadCount === 0)
      conversations.value[index] = { ...conversations.value[index], unreadCount: 1 }
  }

  function assignTo(conversationId: string, staffId: string | null) {
    const index = conversations.value.findIndex(c => c.id === conversationId)
    if (index !== -1) {
      conversations.value[index] = {
        ...conversations.value[index],
        assignedTo: staffId,
        isAssignedToMe: staffId === 'staff-2',
      }
    }
  }

  function getAssignedStaff(conv: Conversation) {
    if (!conv.assignedTo)
      return null
    return staffMembers.find(s => s.id === conv.assignedTo) ?? null
  }

  function getNotes(conversationId: string): Note[] {
    const convNotes = notes.value[conversationId]
    if (convNotes)
      return convNotes
    const conv = conversations.value.find(c => c.id === conversationId)
    if (!conv)
      return []
    const resId = conv.reservationId
    const res = reservations[resId]
    const guestNotes = res?.guestDetails?.notes
    if (!guestNotes)
      return []
    const initial: Note[] = [{
      id: `note-guest-${conversationId}`,
      content: guestNotes,
      authorId: 'guest',
      authorName: conv.guestName,
      createdAt: conv.lastMessageAt,
      visibleToAI: true,
    }]
    notes.value = { ...notes.value, [conversationId]: initial }
    return initial
  }

  function addNote(conversationId: string, content: string, visibleToAI: boolean) {
    const convNotes = getNotes(conversationId)
    const newNote: Note = {
      id: `note-${Date.now()}`,
      content,
      authorId: currentUser.value?.id ?? 'staff-2',
      authorName: currentUser.value?.name ?? 'Komang Juliantara',
      createdAt: new Date().toISOString(),
      visibleToAI,
    }
    notes.value = { ...notes.value, [conversationId]: [...convNotes, newNote] }
  }

  function editNote(conversationId: string, noteId: string, content: string, visibleToAI?: boolean) {
    const convNotes = notes.value[conversationId] ?? []
    notes.value = {
      ...notes.value,
      [conversationId]: convNotes.map(n => n.id === noteId ? { ...n, content, ...(visibleToAI !== undefined ? { visibleToAI } : {}) } : n),
    }
  }

  function deleteNote(conversationId: string, noteId: string) {
    const convNotes = notes.value[conversationId] ?? []
    notes.value = {
      ...notes.value,
      [conversationId]: convNotes.filter(n => n.id !== noteId),
    }
  }

  function actionNeededCount(): number {
    return visibleConversations.value.filter(c => c.status === 'action_needed').length
  }

  function assignedToMeCount(): number {
    return visibleConversations.value.filter(c => c.isAssignedToMe).length
  }

  function totalCount(): number {
    return visibleConversations.value.length
  }

  function stayCountByStatus(status: StayStatus): number {
    return visibleConversations.value.filter(c => c.stayStatus === status).length
  }

  const allListingOptions = computed(() => {
    const map = new Map<string, number>()
    for (const c of visibleConversations.value) {
      map.set(c.listingName, (map.get(c.listingName) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  })

  const listingOptions = computed(() => {
    let convs = visibleConversations.value

    if (activeTagFilters.value.length > 0) {
      convs = convs.filter(c =>
        activeTagFilters.value.every(tag => c.tags.includes(tag)),
      )
    }

    if (listingSearchText.value) {
      const q = listingSearchText.value.toLowerCase()
      convs = convs.filter(c =>
        c.listingName.toLowerCase().includes(q),
      )
    }

    const map = new Map<string, number>()
    for (const c of convs) {
      map.set(c.listingName, (map.get(c.listingName) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  })

  const listingTags = computed(() => {
    const map = new Map<string, number>()
    for (const c of visibleConversations.value) {
      for (const tag of c.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  })

  const channelOptions = computed(() => {
    const map = new Map<string, number>()
    for (const c of visibleConversations.value) {
      map.set(c.otaSource, (map.get(c.otaSource) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)
  })

  function toggleListingFilter(name: string) {
    const current = [...activeListingFilter.value]
    const idx = current.indexOf(name)
    if (idx !== -1) {
      current.splice(idx, 1)
    }
    else {
      current.push(name)
    }
    activeListingFilter.value = current
  }

  function clearListingFilters() {
    activeListingFilter.value = []
  }

  function toggleTagFilter(tag: string) {
    const current = [...activeTagFilters.value]
    const idx = current.indexOf(tag)
    if (idx !== -1) {
      current.splice(idx, 1)
    }
    else {
      current.push(tag)
    }
    activeTagFilters.value = current
  }

  function clearTagFilters() {
    activeTagFilters.value = []
  }

  function setChannelFilter(channel: string | null) {
    activeChannelFilter.value = channel
  }

  function clearChannelFilter() {
    activeChannelFilter.value = null
  }

  function toggleStaffFilter(staffId: string) {
    const current = [...activeStaffFilter.value]
    const idx = current.indexOf(staffId)
    if (idx !== -1) {
      current.splice(idx, 1)
    }
    else {
      current.push(staffId)
    }
    activeStaffFilter.value = current
  }

  function clearStaffFilter() {
    activeStaffFilter.value = []
  }

  function clearDateFilter() {
    activeDateFilter.value = null
  }

  watch(activeStayFilter, () => {
    activeDateFilter.value = null
  })

  function clearAllListingFilters() {
    activeListingFilter.value = []
    activeTagFilters.value = []
    activeChannelFilter.value = null
    activeStaffFilter.value = []
    listingSearchText.value = ''
  }

  function useSuggestion(content: string) {
    pendingSuggestion.value = content
  }

  function sendMessage(conversationId: string, content: string, channel: string, upsellOffer?: Message['upsellOffer'], mediaUrl?: string, mediaDims?: string, fromAddress?: string) {
    const conv = conversations.value.find(c => c.id === conversationId)
    if (!conv || (!content.trim() && !mediaUrl))
      return

    const tempId = `msg-${conversationId}-${Date.now()}`
    const newMessage: Message = {
      id: tempId,
      conversationId,
      sender: 'host',
      senderName: currentUser.value?.name ?? 'Komang Juliantara',
      senderRole: 'Guest Relations',
      content: content.trim(),
      channel,
      timestamp: new Date().toISOString(),
      sendStatus: 'sending',
      upsellOffer,
      ...(fromAddress ? { fromAddress } : {}),
      ...(mediaUrl ? { mediaUrl, mediaDims } : {}),
    }

    const currentMessages = messages.value[conversationId] ?? []
    messages.value = { ...messages.value, [conversationId]: [...currentMessages, newMessage] }

    setTimeout(() => {
      const msgs = messages.value[conversationId] ?? []
      const msgIndex = msgs.findIndex(m => m.id === tempId)
      if (msgIndex === -1)
        return

      const shouldFail = content.toLowerCase().includes('error') || Math.random() < 0.1
      const updatedMsg = { ...msgs[msgIndex], sendStatus: shouldFail ? 'failed' as const : 'sent' as const }
      const updatedMessages = [...msgs]
      updatedMessages[msgIndex] = updatedMsg
      messages.value = { ...messages.value, [conversationId]: updatedMessages }

      if (shouldFail) {
        toast.error('Failed to send message. Please try again.')
      }
    }, 1000)

    const convIndex = conversations.value.findIndex(c => c.id === conversationId)
    if (convIndex !== -1) {
      conversations.value[convIndex] = {
        ...conversations.value[convIndex],
        lastMessage: newMessage.content || (mediaUrl ? '📷 Photo' : ''),
        lastMessageAt: newMessage.timestamp,
        status: null,
      }
    }
  }

  function retryMessage(conversationId: string, messageId: string) {
    const msgs = messages.value[conversationId] ?? []
    const msgIndex = msgs.findIndex(m => m.id === messageId)
    if (msgIndex === -1)
      return
    const msg = msgs[msgIndex]
    if (!msg || msg.sendStatus !== 'failed')
      return

    const updatedMsg = { ...msg, sendStatus: 'sending' as const }
    const updatedMessages = [...msgs]
    updatedMessages[msgIndex] = updatedMsg
    messages.value = { ...messages.value, [conversationId]: updatedMessages }

    setTimeout(() => {
      const currentMsgs = messages.value[conversationId] ?? []
      const currentMsgIndex = currentMsgs.findIndex(m => m.id === messageId)
      if (currentMsgIndex === -1)
        return
      const shouldFail = Math.random() < 0.1
      const retriedMsg = { ...currentMsgs[currentMsgIndex], sendStatus: shouldFail ? 'failed' as const : 'sent' as const }
      const retriedMessages = [...currentMsgs]
      retriedMessages[currentMsgIndex] = retriedMsg
      messages.value = { ...messages.value, [conversationId]: retriedMessages }

      if (shouldFail) {
        toast.error('Failed to send message. Please try again.')
      }
    }, 1000)
  }

  function clearSuggestion() {
    pendingSuggestion.value = ''
  }

  function getPhoneCalls(conversationId: string): PhoneCall[] {
    return phoneCallsData[conversationId] ?? []
  }

  function getLinkedOrders(conversationId: string): UpsellOrder[] {
    const { orders } = useUpsellOrders()
    const conv = conversations.value.find(c => c.id === conversationId)
    if (!conv?.linkedUpsellOrderIds?.length)
      return []
    return orders.value.filter(o => conv.linkedUpsellOrderIds!.includes(o.id))
  }

  function linkOrderToConversation(conversationId: string, orderId: string) {
    conversations.value = conversations.value.map(c =>
      c.id === conversationId
        ? { ...c, linkedUpsellOrderIds: [...(c.linkedUpsellOrderIds || []), orderId] }
        : c,
    )
  }

  return {
    selectedConversationId,
    inboxView,
    showActionNeeded,
    assignedToMeFilter,
    unreadFilter,
    activeStayFilter,
    activeDateFilter,
    activeListingFilter,
    activeTagFilters,
    activeChannelFilter,
    activeStaffFilter,
    listingSearchText,
    searchValue,
    rightPanelCollapsed,
    toggleRightPanel,
    autoTranslate,
    mockTranslate,
    sortBy,
    pendingSuggestion,
    filteredConversations,
    conversations,
    visibleConversations,
    selectedConversation,
    selectedMessages,
    selectedReservation,
    selectedHasAISuggestion,
    isElevaiEnabled,
    getElevaiState,
    enableElevai,
    pauseElevai,
    disableElevai,
    markAsHandled,
    markAsUnread,
    assignTo,
    getAssignedStaff,
    actionNeededCount,
    assignedToMeCount,
    totalCount,
    stayCountByStatus,
    allListingOptions,
    listingOptions,
    listingTags,
    channelOptions,
    toggleListingFilter,
    clearListingFilters,
    toggleTagFilter,
    clearTagFilters,
    setChannelFilter,
    clearChannelFilter,
    toggleStaffFilter,
    clearStaffFilter,
    staffMembers,
    clearDateFilter,
    clearAllListingFilters,
    useSuggestion,
    clearSuggestion,
    getNotes,
    addNote,
    editNote,
    deleteNote,
    sendMessage,
    retryMessage,
    getPhoneCalls,
    getLinkedOrders,
    linkOrderToConversation,
    unmatchedMessages,
    dismissUnmatched,
    matchUnmatched,
    createFromUnmatched,
    findConversationByEmail,
    simulateInboundEmail,
    messages,
  }
}
