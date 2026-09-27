import type { InternalMessage } from '~/components/inbox/data/internal'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'
import { roomIdFor, SEND_LATENCY_MS, SIMULATED_REPLY_MIN_MS, SIMULATED_REPLY_SPREAD_MS } from '~/components/inbox/data/internal'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useInboxView } from '~/composables/useInbox'
import { useInternalInbox } from '~/composables/useInternalInbox'
import { useInternalNotifications } from '~/composables/useInternalNotifications'

// ⚠️ Not `vi.mock('vue-sonner')`: `tests/setup.ts` imports the room store
// before a spec's mocks register, so the composables hold the REAL toast.
// Spy on that instead.
let toastInfo: ReturnType<typeof vi.spyOn>

const HOUSEKEEPING_LST1 = roomIdFor('lst-1', 'role-housekeeping')
const LISTING_MANAGER_LST1 = roomIdFor('lst-1', 'role-listing-manager')

beforeEach(() => {
  // The seeded dashboard user is Komang (Guest Experience Manager on lst-1…4).
  useCurrentDashboardUser().setCurrentUserId('user-1')
  toastInfo = vi.spyOn(toast, 'info').mockImplementation(() => 'toast-id')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a colleague writes, in real time', () => {
  // Ketut Antara is Housekeeping on lst-1; Komang (the current user) is not.
  function incoming(patch: Partial<InternalMessage> = {}): InternalMessage {
    return {
      id: `imsg-in-${Math.random().toString(36).slice(2, 7)}`,
      roomId: HOUSEKEEPING_LST1,
      authorId: 'user-7',
      authorName: 'Ketut Antara',
      authorInitials: 'KA',
      authorRole: 'Housekeeping',
      content: 'Towels restocked.',
      createdAt: new Date().toISOString(),
      ...patch,
    }
  }

  class FakeNotification {
    static permission: NotificationPermission = 'granted'
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
    static instances: FakeNotification[] = []
    onclick: (() => void) | null = null
    close = vi.fn()
    constructor(public title: string, public options: NotificationOptions) {
      FakeNotification.instances.push(this)
    }
  }

  function setTabVisible(visible: boolean) {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (visible ? 'visible' : 'hidden'),
    })
  }

  beforeEach(() => {
    FakeNotification.instances = []
    FakeNotification.permission = 'granted'
    vi.stubGlobal('Notification', FakeNotification)
    vi.stubGlobal('navigateTo', vi.fn())
    setTabVisible(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setTabVisible(true)
    vi.useRealTimers()
  })

  it('lands in the room at once and counts as unread until you look', () => {
    const internal = useInternalInbox()
    const before = internal.unreadFor(HOUSEKEEPING_LST1)
    const message = incoming()
    internal.receiveInternalMessage(message)
    expect(internal.messagesFor(HOUSEKEEPING_LST1).at(-1)!.id).toBe(message.id)
    expect(internal.unreadFor(HOUSEKEEPING_LST1)).toBe(before + 1)
  })

  it('toasts anywhere else in the dashboard, for a room you can see but are not in', () => {
    const internal = useInternalInbox()
    expect(internal.isMine(internal.roomById(HOUSEKEEPING_LST1)!)).toBe(false)
    internal.receiveInternalMessage(incoming())
    expect(toastInfo).toHaveBeenCalledTimes(1)
    const [title, options] = toastInfo.mock.calls[0]!
    // The room already had 3 unread, so the toast rolls them up.
    expect(title).toBe('4 new messages in Housekeeping')
    expect(options).toMatchObject({ id: `internal-${HOUSEKEEPING_LST1}` })
    expect(options.description).toContain('Villa Luwa')
    expect(options.action.label).toBe('Open')
  })

  it('never writes to the notification bell, only the toast', () => {
    const internal = useInternalInbox()
    internal.receiveInternalMessage(incoming())
    expect(FakeNotification.instances).toHaveLength(0)
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('reads it in place when that room is open in front of you, and adds no toast', () => {
    const internal = useInternalInbox()
    useInternalNotifications().internalViewOpen.value = true
    internal.selectRoom(HOUSEKEEPING_LST1)
    internal.receiveInternalMessage(incoming())
    expect(internal.unreadFor(HOUSEKEEPING_LST1)).toBe(0)
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('only moves the badges while the Internal view is open on another room', () => {
    const internal = useInternalInbox()
    useInternalNotifications().internalViewOpen.value = true
    internal.selectRoom(LISTING_MANAGER_LST1)
    const before = internal.unreadFor(HOUSEKEEPING_LST1)
    internal.receiveInternalMessage(incoming())
    expect(internal.unreadFor(HOUSEKEEPING_LST1)).toBe(before + 1)
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('goes native while the tab is in the background, and leaves the room unread', () => {
    const internal = useInternalInbox()
    useInternalNotifications().internalViewOpen.value = true
    internal.selectRoom(HOUSEKEEPING_LST1)
    setTabVisible(false)

    // A second after the room was opened, so it is not stamped in the same
    // millisecond as that read and silently counted as seen.
    internal.receiveInternalMessage(incoming({ createdAt: new Date(Date.now() + 1000).toISOString() }))
    expect(FakeNotification.instances).toHaveLength(1)
    const native = FakeNotification.instances[0]!
    expect(native.title).toBe('Ketut Antara in Housekeeping')
    expect(native.options.tag).toBe(`internal-${HOUSEKEEPING_LST1}`)
    expect(native.options.body).toContain('Towels restocked.')
    // Open on screen, but nobody is looking at it.
    expect(internal.unreadFor(HOUSEKEEPING_LST1)).toBe(1)
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('falls back to a toast in a background tab when desktop alerts are not allowed', () => {
    FakeNotification.permission = 'default'
    const internal = useInternalInbox()
    setTabVisible(false)
    internal.receiveInternalMessage(incoming())
    expect(FakeNotification.instances).toHaveLength(0)
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('opens the room from a native notification: Internal view, that listing, that room, read', () => {
    const internal = useInternalInbox()
    internal.selectListing('lst-4')
    internal.toggleTagFilter('Umalas')
    setTabVisible(false)
    internal.receiveInternalMessage(incoming())

    FakeNotification.instances[0]!.onclick!()
    expect(useInboxView().value).toBe('internal')
    expect(internal.activeTagFilters.value).toEqual([])
    expect(internal.activeListingId.value).toBe('lst-1')
    expect(internal.selectedRoom.value?.id).toBe(HOUSEKEEPING_LST1)
    expect(internal.unreadFor(HOUSEKEEPING_LST1)).toBe(0)
    expect(navigateTo).toHaveBeenCalledWith('/inbox')
    expect(FakeNotification.instances[0]!.close).toHaveBeenCalled()
  })

  it('opens the room from the toast action the same way', () => {
    const internal = useInternalInbox()
    internal.receiveInternalMessage(incoming())
    toastInfo.mock.calls[0]![1].action.onClick()
    expect(internal.selectedRoom.value?.id).toBe(HOUSEKEEPING_LST1)
    expect(navigateTo).toHaveBeenCalledWith('/inbox')
  })

  it('stays quiet for your own message', () => {
    const internal = useInternalInbox()
    internal.receiveInternalMessage(incoming({ authorId: 'user-1', authorName: 'Komang Juliantara' }))
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('ignores a room outside your scope entirely', () => {
    const internal = useInternalInbox()
    const outside = roomIdFor('lst-9', 'role-listing-manager')
    internal.receiveInternalMessage(incoming({ roomId: outside }))
    expect(internal.messagesFor(outside)).toEqual([])
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('asks the browser for permission and remembers the answer', async () => {
    FakeNotification.permission = 'default'
    const notify = useInternalNotifications()
    expect(notify.permission.value).toBe('default')
    await notify.requestPermission()
    expect(FakeNotification.requestPermission).toHaveBeenCalled()
    expect(notify.permission.value).toBe('granted')
  })

  it('reports unsupported where the browser has no Notification API', () => {
    vi.stubGlobal('Notification', undefined)
    expect(useInternalNotifications().permission.value).toBe('unsupported')
  })
})

describe('mock colleague replies', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const REPLY_WINDOW = SIMULATED_REPLY_MIN_MS + SIMULATED_REPLY_SPREAD_MS

  it('has somebody else in the room answer what you posted, quoting it', () => {
    const internal = useInternalInbox()
    internal.simulateReplies.value = true
    const sent = internal.sendInternalMessage(HOUSEKEEPING_LST1, 'Can someone check the pool pump?')!
    vi.advanceTimersByTime(SEND_LATENCY_MS)
    vi.advanceTimersByTime(REPLY_WINDOW)

    const reply = internal.messagesFor(HOUSEKEEPING_LST1).at(-1)!
    expect(reply.authorId).not.toBe('user-1')
    expect(internal.roomById(HOUSEKEEPING_LST1)!.memberIds).toContain(reply.authorId)
    expect(reply.replyTo?.messageId).toBe(sent.id)
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('answers once per room however many messages went in', () => {
    const internal = useInternalInbox()
    internal.simulateReplies.value = true
    internal.sendInternalMessage(HOUSEKEEPING_LST1, 'One')
    internal.sendInternalMessage(HOUSEKEEPING_LST1, 'Two')
    vi.advanceTimersByTime(SEND_LATENCY_MS + REPLY_WINDOW)
    const others = internal.messagesFor(HOUSEKEEPING_LST1).filter(m => m.replyTo && m.authorId !== 'user-1')
    expect(others).toHaveLength(1)
  })

  it('stays silent in a room where nobody else sits', () => {
    const internal = useInternalInbox()
    internal.simulateReplies.value = true
    // Komang is the only Guest Experience Manager on lst-1.
    const own = roomIdFor('lst-1', 'role-guest-experience-manager')
    internal.sendInternalMessage(own, 'Note to self')
    vi.advanceTimersByTime(SEND_LATENCY_MS + REPLY_WINDOW)
    expect(internal.messagesFor(own).every(m => m.authorId === 'user-1')).toBe(true)
  })

  it('is off unless switched on, so specs never meet a stranger', () => {
    const internal = useInternalInbox()
    internal.sendInternalMessage(HOUSEKEEPING_LST1, 'Quiet')
    vi.advanceTimersByTime(SEND_LATENCY_MS + REPLY_WINDOW)
    expect(internal.messagesFor(HOUSEKEEPING_LST1).at(-1)!.content).toBe('Quiet')
  })
})
