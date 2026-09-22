import { computed } from 'vue'
import type { PhoneCall, PhoneCallStatus, TranscriptionState } from '~/components/inbox/data/conversations'
import { conversations as conversationsData, phoneCalls as phoneCallsData, reservations } from '~/components/inbox/data/conversations'
import type { UnmatchedCall } from './useThreeCX'

const STORAGE_KEY = 'elev8-threecx-phone-calls'

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
    } catch { /* ignore */ }
  }
}

function normalizePhone(input: string): string {
  return input.replace(/\D/g, '')
}

function findConversationByPhone(phone: string): string | undefined {
  const target = normalizePhone(phone)
  if (!target)
    return undefined

  for (const conv of conversationsData) {
    const res = reservations[conv.reservationId]
    const guestPhone = res?.guestDetails?.phone
    if (guestPhone && normalizePhone(guestPhone).endsWith(target.slice(-9))) {
      return conv.id
    }
  }
  return undefined
}

const MOCK_TRANSCRIPT_SAMPLES: string[] = [
  'Guest: Hi, I wanted to confirm the check-in time for tomorrow.\nKomang: Of course! Check-in is at 15:00, but we can arrange early check-in if the room is ready.\nGuest: That would be great, thank you.\nKomang: I will let the housekeeping team know. We will message you once it is ready.',
  'Guest: Hello, is the airport pickup still scheduled for Friday?\nKomang: Yes, the driver will meet you at the arrivals hall at 14:00 with a sign with your name.\nGuest: Perfect, thank you so much.',
  'Komang: Hi, I am calling to follow up on the WiFi issue you reported.\nGuest: Yes, it has been working much better since the reset, thank you.\nKomang: Wonderful, glad to hear it. Have a great rest of your stay.',
]

const MOCK_SUMMARY_SAMPLES: string[] = [
  'Komang menghubungi guest untuk konfirmasi detail check-in. Early check-in mungkin di-atur tergantung kesiapan kamar. Guest puas dengan respons cepat.',
  'Guest mengkonfirmasi airport pickup untuk hari Jumat. Driver akan jemput di terminal kedatangan jam 14:00 dengan papan nama. Sudah di-koordinasikan dengan vendor.',
  'Komang melakukan follow-up masalah WiFi. Issue sudah resolved setelah router di-reset. Guest tidak punya complaint tambahan.',
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export interface ScreenPopNotification {
  id: string
  callId: string
  conversationId: string
  guestName: string
  listingName: string
  fromNumber: string
  staffId: string | null
  timestamp: string
  dismissed: boolean
}

export function useThreeCxCalls() {
  const threeCX = useThreeCX()
  const inbox = useInbox()

  const phoneCalls = useState<Record<string, PhoneCall[]>>('threecx-phone-calls', () => {
    const stored = loadFromStorage<Record<string, PhoneCall[]> | null>(STORAGE_KEY, null)
    if (stored)
      return stored
    return JSON.parse(JSON.stringify(phoneCallsData))
  })

  const screenPops = useState<ScreenPopNotification[]>('threecx-screen-pops', () => [])

  watch(phoneCalls, (val) => {
    saveToStorage(STORAGE_KEY, val)
  }, { deep: true })

  const allCalls = computed<PhoneCall[]>(() => {
    const merged: PhoneCall[] = []
    for (const list of Object.values(phoneCalls.value)) {
      merged.push(...list)
    }
    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  })

  function getCallById(callId: string): PhoneCall | undefined {
    for (const list of Object.values(phoneCalls.value)) {
      const found = list.find(c => c.id === callId)
      if (found)
        return found
    }
    const unmatched = threeCX.unmatchedCalls.value.find(c => c.id === callId)
    if (unmatched) {
      return {
        id: unmatched.id,
        conversationId: '',
        direction: 'inbound',
        status: unmatched.status,
        duration: unmatched.duration,
        timestamp: unmatched.timestamp,
        from: unmatched.fromNumber,
        to: `Ext ${unmatched.toExtension}`,
        recording_url: unmatched.recording_url,
      }
    }
    return undefined
  }

  function getCallsForConversation(conversationId: string): PhoneCall[] {
    return phoneCalls.value[conversationId] ?? []
  }

  function upsertCall(conversationId: string, call: PhoneCall) {
    const existing = phoneCalls.value[conversationId] ?? []
    const idx = existing.findIndex(c => c.id === call.id)
    let updated: PhoneCall[]
    if (idx >= 0) {
      updated = [...existing]
      updated[idx] = { ...existing[idx], ...call }
    }
    else {
      updated = [call, ...existing]
    }
    phoneCalls.value = { ...phoneCalls.value, [conversationId]: updated }
  }

  function markActionNeededForMissed(conversationId: string) {
    const conv = inbox.conversations.value.find(c => c.id === conversationId)
    if (!conv)
      return
    inbox.conversations.value = inbox.conversations.value.map(c =>
      c.id === conversationId
        ? { ...c, status: 'action_needed', unreadCount: Math.max(c.unreadCount, 1) }
        : c,
    )
  }

  function getExtensionForStaff(staffId: string): string | undefined {
    return threeCX.getExtensionForStaff(staffId)
  }

  function startScreenPop(call: PhoneCall, conversationId: string) {
    const conv = inbox.conversations.value.find(c => c.id === conversationId)
    if (!conv)
      return
    const staffId = threeCX.getStaffForExtension(call.to)
    const pop: ScreenPopNotification = {
      id: `pop-${call.id}`,
      callId: call.id,
      conversationId,
      guestName: conv.guestName,
      listingName: conv.listingName,
      fromNumber: call.from,
      staffId: staffId ?? null,
      timestamp: call.timestamp,
      dismissed: false,
    }
    screenPops.value = [...screenPops.value, pop]
  }

  function dismissScreenPop(id: string) {
    screenPops.value = screenPops.value.filter(p => p.id !== id)
  }

  function clearAllScreenPops() {
    screenPops.value = []
  }

  function getActiveScreenPopForCurrentUser(): ScreenPopNotification | undefined {
    const me = 'staff-2'
    return screenPops.value.find(p => !p.dismissed && (p.staffId === me || p.staffId === null))
  }

  async function simulateInboundCall(opts: {
    fromNumber: string
    toExtension: string
    outcome: 'completed' | 'missed' | 'voicemail'
  }): Promise<{ callId: string, matched: boolean, conversationId?: string }> {
    const conversationId = findConversationByPhone(opts.fromNumber)

    if (!conversationId) {
      const unmatched: UnmatchedCall = {
        id: `uc-${Date.now()}`,
        fromNumber: opts.fromNumber,
        toExtension: opts.toExtension,
        timestamp: new Date().toISOString(),
        status: opts.outcome,
        duration: opts.outcome === 'completed' ? Math.floor(Math.random() * 240) + 30 : 0,
        recording_url: opts.outcome === 'completed' ? `https://example.com/recordings/${Date.now()}.mp3` : undefined,
      }
      threeCX.addUnmatchedCall(unmatched)
      return { callId: unmatched.id, matched: false }
    }

    const callId = `call-live-${Date.now()}`
    const ringingCall: PhoneCall = {
      id: callId,
      conversationId,
      direction: 'inbound',
      status: opts.outcome,
      duration: 0,
      timestamp: new Date().toISOString(),
      from: opts.fromNumber,
      to: opts.toExtension,
      extensionNumber: opts.toExtension,
      transcriptionState: 'idle',
    }

    upsertCall(conversationId, ringingCall)

    if (opts.outcome === 'missed' || opts.outcome === 'voicemail') {
      markActionNeededForMissed(conversationId)
    }
    else {
      startScreenPop(ringingCall, conversationId)
    }

    if (opts.outcome === 'completed') {
      runTranscriptionJob(conversationId, callId, ringingCall.recording_url !== undefined)
    }

    return { callId, matched: true, conversationId }
  }

  async function simulateOutboundCall(opts: {
    fromExtension: string
    toNumber: string
    staffId: string
    conversationId: string
  }): Promise<{ callId: string }> {
    const callId = `call-out-${Date.now()}`
    const duration = Math.floor(Math.random() * 200) + 20
    const call: PhoneCall = {
      id: callId,
      conversationId: opts.conversationId,
      direction: 'outbound',
      status: 'completed',
      duration,
      timestamp: new Date().toISOString(),
      from: opts.fromExtension,
      to: opts.toNumber,
      extensionNumber: opts.fromExtension,
      staffId: opts.staffId,
      recording_url: `https://example.com/recordings/${callId}.mp3`,
      transcriptionState: 'idle',
    }
    upsertCall(opts.conversationId, call)
    runTranscriptionJob(opts.conversationId, callId, true)
    return { callId }
  }

  function runTranscriptionJob(conversationId: string, callId: string, hasRecording: boolean) {
    if (!hasRecording) {
      const call = getCallById(callId)
      if (call)
        upsertCall(conversationId, { ...call, transcriptionState: 'idle' })
      return
    }
    const call = getCallById(callId)
    if (!call)
      return
    upsertCall(conversationId, { ...call, transcriptionState: 'processing' })

    const targetMs = Math.min(call.duration * 2000, 10 * 60 * 1000)
    setTimeout(() => {
      const shouldFail = Math.random() < 0.08
      const current = getCallById(callId)
      if (!current)
        return
      if (shouldFail) {
        upsertCall(conversationId, {
          ...current,
          transcriptionState: 'failed',
          transcriptionError: 'Audio file could not be processed. Try again.',
        })
        return
      }
      const transcript = pickRandom(MOCK_TRANSCRIPT_SAMPLES)
      const summary = pickRandom(MOCK_SUMMARY_SAMPLES)
      upsertCall(conversationId, {
        ...current,
        transcript,
        summary,
        transcriptionState: 'done',
      })
    }, Math.max(1500, targetMs))
  }

  function retryTranscription(conversationId: string, callId: string) {
    runTranscriptionJob(conversationId, callId, true)
  }

  function clearCallHistory() {
    phoneCalls.value = {}
  }

  function getStatusColor(status: PhoneCallStatus): string {
    if (status === 'completed')
      return 'green'
    if (status === 'missed')
      return 'red'
    if (status === 'voicemail')
      return 'purple'
    return 'gray'
  }

  function getTranscriptionLabel(state: TranscriptionState | undefined): string {
    if (state === 'processing')
      return 'Processing'
    if (state === 'failed')
      return 'Transcription failed'
    if (state === 'done')
      return 'AI summary'
    return ''
  }

  return {
    phoneCalls,
    allCalls,
    screenPops,
    getCallById,
    getCallsForConversation,
    simulateInboundCall,
    simulateOutboundCall,
    startScreenPop,
    dismissScreenPop,
    clearAllScreenPops,
    getActiveScreenPopForCurrentUser,
    retryTranscription,
    clearCallHistory,
    getExtensionForStaff,
    getStatusColor,
    getTranscriptionLabel,
  }
}
