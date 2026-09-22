import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GENERAL_ROOM_KEY, INTERNAL_LOAD_MS, roomIdFor, SEND_LATENCY_MS, SEND_LATENCY_WITH_PHOTO_MS } from '~/components/inbox/data/internal'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useInternalInbox } from '~/composables/useInternalInbox'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const HOUSEKEEPING_LST1 = roomIdFor('lst-1', 'role-housekeeping')
const GENERAL_LST1 = roomIdFor('lst-1', GENERAL_ROOM_KEY)

beforeEach(() => {
  // The seeded dashboard user is Komang (Guest Experience Manager on lst-1…4).
  useCurrentDashboardUser().setCurrentUserId('user-1')
})

describe('room tree', () => {
  it('shows rooms only on the listings the current user is scoped to', () => {
    const { roomGroups } = useInternalInbox()
    expect(roomGroups.value.map(g => g.listingId)).toEqual(['lst-1', 'lst-2', 'lst-3', 'lst-4'])
  })

  it('opens every listing to a user with no scope of their own', () => {
    // user-5 is the General Manager, seeded with `listingIds: []`.
    useCurrentDashboardUser().setCurrentUserId('user-5')
    const { roomGroups } = useInternalInbox()
    expect(roomGroups.value.length).toBeGreaterThan(4)
    expect(roomGroups.value.map(g => g.listingId)).toContain('lst-9')
  })

  it('lets a guest-relations agent see a housekeeping room without joining it', () => {
    const { roomById, isMine } = useInternalInbox()
    const room = roomById(HOUSEKEEPING_LST1)
    expect(room).toBeDefined()
    expect(isMine(room!)).toBe(false)
  })

  it('marks the room matching the current user role as theirs', () => {
    const { roomById, isMine } = useInternalInbox()
    const own = roomById(roomIdFor('lst-1', 'role-guest-experience-manager'))!
    expect(isMine(own)).toBe(true)
  })
})

describe('sending', () => {
  it('posts as the current user', () => {
    const { sendInternalMessage, messagesFor } = useInternalInbox()
    sendInternalMessage(GENERAL_LST1, 'Pump is being serviced tomorrow.')
    const last = messagesFor(GENERAL_LST1).at(-1)!
    expect(last).toMatchObject({
      authorId: 'user-1',
      authorName: 'Komang Juliantara',
      authorRole: 'Guest Experience Manager',
      content: 'Pump is being serviced tomorrow.',
    })
  })

  it('refuses an empty message with nothing attached', () => {
    const { sendInternalMessage, messagesFor } = useInternalInbox()
    const before = messagesFor(GENERAL_LST1).length
    expect(sendInternalMessage(GENERAL_LST1, '   ')).toBeUndefined()
    expect(messagesFor(GENERAL_LST1)).toHaveLength(before)
  })

  it('accepts a forward with no note, because handing a message over is the common case', () => {
    const { sendInternalMessage, messagesFor } = useInternalInbox()
    const sent = sendInternalMessage(GENERAL_LST1, '', {
      forwarded: [{
        sourceId: 'msg-1',
        sourceKind: 'guest',
        conversationId: 'conv-1',
        contextLabel: 'Anna · Villa',
        senderName: 'Anna',
        senderLabel: 'Guest',
        content: 'The AC is broken.',
        timestamp: '2026-09-20T10:00:00Z',
      }],
    })
    expect(sent).toBeDefined()
    expect(messagesFor(GENERAL_LST1).at(-1)!.forwarded).toHaveLength(1)
  })

  it('accepts a photo with no caption, which often says more than one would', () => {
    const { sendInternalMessage, messagesFor } = useInternalInbox()
    const sent = sendInternalMessage(GENERAL_LST1, '', {
      mediaUrl: 'blob:leaking-tap',
      mediaDims: '1280 × 960',
    })
    expect(sent).toBeDefined()
    expect(messagesFor(GENERAL_LST1).at(-1)).toMatchObject({
      content: '',
      mediaUrl: 'blob:leaking-tap',
      mediaDims: '1280 × 960',
    })
  })

  it('keeps the caption alongside the photo', () => {
    const { sendInternalMessage, messagesFor } = useInternalInbox()
    sendInternalMessage(GENERAL_LST1, 'Tap in room 3', { mediaUrl: 'blob:tap' })
    expect(messagesFor(GENERAL_LST1).at(-1)).toMatchObject({
      content: 'Tap in room 3',
      mediaUrl: 'blob:tap',
    })
  })

  it('still refuses a message with no text, no photo and no forward', () => {
    const { sendInternalMessage, messagesFor } = useInternalInbox()
    const before = messagesFor(GENERAL_LST1).length
    expect(sendInternalMessage(GENERAL_LST1, '  ', { mediaUrl: null })).toBeUndefined()
    expect(messagesFor(GENERAL_LST1)).toHaveLength(before)
  })

  it('leaves the media fields off a message that has no photo', () => {
    const { sendInternalMessage, messagesFor } = useInternalInbox()
    sendInternalMessage(GENERAL_LST1, 'Just text')
    const last = messagesFor(GENERAL_LST1).at(-1)!
    expect(last.mediaUrl).toBeUndefined()
    expect(last.mediaDims).toBeUndefined()
  })

  it('carries a reply quote onto the message', () => {
    const { sendInternalMessage, messagesFor } = useInternalInbox()
    sendInternalMessage(GENERAL_LST1, 'Agreed.', {
      replyTo: { messageId: 'imsg-seed-3', senderName: 'Made Surya', excerpt: 'Water pump…' },
    })
    expect(messagesFor(GENERAL_LST1).at(-1)!.replyTo?.senderName).toBe('Made Surya')
  })
})

describe('forwarding', () => {
  const refs = [{
    sourceId: 'msg-1',
    sourceKind: 'guest' as const,
    conversationId: 'conv-1',
    contextLabel: 'Anna · Villa One',
    senderName: 'Anna',
    senderLabel: 'Guest',
    content: 'The AC is blowing warm air.',
    timestamp: '2026-09-20T10:00:00Z',
  }]

  it('gives each target room its own message, so a reply in one cannot bleed into another', () => {
    const { forwardToRooms, messagesFor } = useInternalInbox()
    const beforeA = messagesFor(GENERAL_LST1).length
    const beforeB = messagesFor(HOUSEKEEPING_LST1).length

    expect(forwardToRooms([GENERAL_LST1, HOUSEKEEPING_LST1], refs, 'Please look at this.')).toBe(2)

    expect(messagesFor(GENERAL_LST1)).toHaveLength(beforeA + 1)
    expect(messagesFor(HOUSEKEEPING_LST1)).toHaveLength(beforeB + 1)
    expect(messagesFor(GENERAL_LST1).at(-1)!.id)
      .not
      .toBe(messagesFor(HOUSEKEEPING_LST1).at(-1)!.id)
  })

  it('does nothing without a target or without anything to forward', () => {
    const { forwardToRooms } = useInternalInbox()
    expect(forwardToRooms([], refs, '')).toBe(0)
    expect(forwardToRooms([GENERAL_LST1], [], '')).toBe(0)
  })

  it('freezes the forwarded content rather than reading it back from the source', () => {
    const { forwardToRooms, messagesFor } = useInternalInbox()
    const mutable = [{ ...refs[0]! }]
    forwardToRooms([GENERAL_LST1], mutable, '')
    mutable[0]!.content = 'edited afterwards'
    expect(messagesFor(GENERAL_LST1).at(-1)!.forwarded![0]!.content)
      .toBe('The AC is blowing warm air.')
  })
})

describe('unread', () => {
  it('counts a colleague message in a room never opened', () => {
    const { unreadFor } = useInternalInbox()
    // Seeded by `buildSeedMessages`, authored by other people: two from the
    // housekeepers plus Made Surya's forward.
    expect(unreadFor(HOUSEKEEPING_LST1)).toBe(3)
  })

  it('clears once the room is opened', () => {
    const { selectRoom, unreadFor } = useInternalInbox()
    selectRoom(HOUSEKEEPING_LST1)
    expect(unreadFor(HOUSEKEEPING_LST1)).toBe(0)
  })

  it('does not count your own message, so sending into a quiet room leaves it read', () => {
    const { sendInternalMessage, unreadFor } = useInternalInbox()
    const quiet = roomIdFor('lst-3', GENERAL_ROOM_KEY)
    expect(unreadFor(quiet)).toBe(0)
    sendInternalMessage(quiet, 'Anyone around?')
    expect(unreadFor(quiet)).toBe(0)
  })

  it('totals unread across every visible room', () => {
    const { totalUnread, selectRoom } = useInternalInbox()
    const before = totalUnread.value
    expect(before).toBeGreaterThan(0)
    selectRoom(HOUSEKEEPING_LST1)
    expect(totalUnread.value).toBe(before - 3)
  })
})

describe('selection and filters', () => {
  it('clears the selection and any draft reply when moving rooms', () => {
    const { selectRoom, toggleMessageSelection, selectedMessageIds, replyDraft } = useInternalInbox()
    selectRoom(HOUSEKEEPING_LST1)
    toggleMessageSelection('imsg-seed-1')
    replyDraft.value = { messageId: 'imsg-seed-1', senderName: 'Ni Putu Sari', excerpt: 'Checkout…' }
    expect(selectedMessageIds.value).toHaveLength(1)

    selectRoom(GENERAL_LST1)
    expect(selectedMessageIds.value).toEqual([])
    expect(replyDraft.value).toBeNull()
  })

  it('resolves the selection to messages in the open room only', () => {
    const { selectRoom, toggleMessageSelection, selectedMessages } = useInternalInbox()
    selectRoom(HOUSEKEEPING_LST1)
    toggleMessageSelection('imsg-seed-1')
    toggleMessageSelection('imsg-seed-2')
    expect(selectedMessages.value.map(m => m.id)).toEqual(['imsg-seed-1', 'imsg-seed-2'])
    toggleMessageSelection('imsg-seed-1')
    expect(selectedMessages.value.map(m => m.id)).toEqual(['imsg-seed-2'])
  })

  it('searches by listing and by room name', () => {
    const internal = useInternalInbox()
    internal.roomSearch.value = 'housekeeping'
    const names = internal.activeRooms.value.map(r => r.name)
    expect(names.length).toBeGreaterThan(0)
    expect(names.every(n => n.includes('Housekeeping'))).toBe(true)

    // A listing name matches too, and keeps all of that listing's rooms.
    internal.roomSearch.value = 'merapi'
    expect(internal.activeListingId.value).toBe('lst-4')
    expect(internal.activeRooms.value.length).toBeGreaterThan(1)
    internal.roomSearch.value = ''
  })
})

describe('tasks and lookups', () => {
  it('records a task notice in the room that asked for it', () => {
    const { postTaskNotice, messagesFor } = useInternalInbox()
    postTaskNotice(HOUSEKEEPING_LST1, { id: 'TASK-9001', title: 'Fix the AC' })
    expect(messagesFor(HOUSEKEEPING_LST1).at(-1)).toMatchObject({
      systemKind: 'task_created',
      taskRef: { id: 'TASK-9001', title: 'Fix the AC' },
    })
  })

  it('resolves a conversation listing name to its listing id', () => {
    const { listingIdForName } = useInternalInbox()
    expect(listingIdForName('The R Villa Merapi')).toBe('lst-4')
  })

  it('answers undefined for a listing name nothing matches, rather than guessing a room', () => {
    const { listingIdForName } = useInternalInbox()
    expect(listingIdForName('Somewhere That Was Renamed')).toBeUndefined()
    expect(listingIdForName(undefined)).toBeUndefined()
  })

  it('resolves room members to real users', () => {
    const { roomById, membersOf } = useInternalInbox()
    const names = membersOf(roomById(HOUSEKEEPING_LST1)).map(u => u.name)
    expect(names).toContain('Ketut Antara')
  })
})

describe('the open listing', () => {
  it('opens the first listing before anything is picked, never nothing', () => {
    const { activeListingId, scopedListingId, filteredRoomGroups } = useInternalInbox()
    expect(scopedListingId.value).toBeUndefined()
    expect(activeListingId.value).toBe('lst-1')
    expect(filteredRoomGroups.value.map(g => g.listingId)).toEqual(['lst-1'])
  })

  it('scopes the room list to one listing while the nav cards still show them all', () => {
    const { selectListing, filteredRoomGroups, listingCardGroups } = useInternalInbox()
    selectListing('lst-2')
    expect(filteredRoomGroups.value.map(g => g.listingId)).toEqual(['lst-2'])
    // Hiding the other cards would leave no way to switch listing.
    expect(listingCardGroups.value.length).toBeGreaterThan(1)
  })

  it('stays open on a second click of the same card, since one is always open', () => {
    const { selectListing, activeListingId } = useInternalInbox()
    selectListing('lst-2')
    selectListing('lst-2')
    expect(activeListingId.value).toBe('lst-2')
  })

  it('swaps straight to another listing rather than adding to it', () => {
    const { selectListing, filteredRoomGroups } = useInternalInbox()
    selectListing('lst-1')
    selectListing('lst-2')
    expect(filteredRoomGroups.value.map(g => g.listingId)).toEqual(['lst-2'])
  })

  it('falls back to the first surviving listing when a filter hides the open one', () => {
    const internal = useInternalInbox()
    internal.selectListing('lst-4')
    expect(internal.activeListingId.value).toBe('lst-4')

    // lst-4 is tagged Umalas, so a Canggu filter hides it.
    internal.toggleTagFilter('Canggu')
    expect(internal.activeListingId.value).not.toBe('lst-4')
    expect(internal.filteredRoomGroups.value).toHaveLength(1)
    // The pick itself is remembered, so clearing the filter restores it.
    internal.clearTagFilters()
    expect(internal.activeListingId.value).toBe('lst-4')
  })

  it('reports no open listing when nothing survives the filters', () => {
    const internal = useInternalInbox()
    internal.roomSearch.value = 'nothing matches this at all'
    expect(internal.activeListingId.value).toBeUndefined()
    expect(internal.activeRooms.value).toEqual([])
  })

  it('flattens the open listing rooms, since there is only ever one listing', () => {
    const { selectListing, activeRooms, activeListing } = useInternalInbox()
    selectListing('lst-1')
    expect(activeListing.value?.listingId).toBe('lst-1')
    expect(activeRooms.value.length).toBeGreaterThan(1)
    expect(activeRooms.value.every(r => r.listingId === 'lst-1')).toBe(true)
  })

  it('offers the tags of every listing in scope, not just the filtered ones', () => {
    const { availableTags, toggleTagFilter } = useInternalInbox()
    const all = [...availableTags.value]
    expect(all).toContain('Pool')
    toggleTagFilter('Pool')
    // Narrowing by a tag must not shrink the list you narrow with.
    expect(availableTags.value).toEqual(all)
  })

  it('narrows the cards by tag, ANDed', () => {
    const { toggleTagFilter, listingCardGroups } = useInternalInbox()
    toggleTagFilter('Umalas')
    expect(listingCardGroups.value.map(g => g.listingId)).toEqual(['lst-4'])
    toggleTagFilter('Canggu')
    expect(listingCardGroups.value).toEqual([])
  })

  it('totals unread across a listing rooms for its card badge', () => {
    const { unreadForListing, selectRoom } = useInternalInbox()
    // lst-1 is seeded with 3 unread in Housekeeping and 1 in General.
    expect(unreadForListing('lst-1')).toBe(4)
    selectRoom(HOUSEKEEPING_LST1)
    expect(unreadForListing('lst-1')).toBe(1)
  })

  it('reports no unread for a listing that has none', () => {
    const { unreadForListing } = useInternalInbox()
    expect(unreadForListing('lst-3')).toBe(0)
    expect(unreadForListing('lst-does-not-exist')).toBe(0)
  })

  it('clearRoomFilters drops the search and the tags, but keeps the open listing', () => {
    const internal = useInternalInbox()
    internal.roomSearch.value = 'pool'
    internal.toggleTagFilter('Canggu')
    internal.selectListing('lst-1')

    internal.clearRoomFilters()
    expect(internal.roomSearch.value).toBe('')
    expect(internal.activeTagFilters.value).toEqual([])
    // Clearing a filter is not a reason to throw away which property you were
    // looking at.
    expect(internal.activeListingId.value).toBe('lst-1')
  })

  it('builds a card per listing with a photo, a name and a role count', () => {
    const { listingCardGroups } = useInternalInbox()
    const card = listingCardGroups.value.find(g => g.listingId === 'lst-1')!
    expect(card.listingName).toContain('Villa Luwa')
    expect(card.photo).toBeTruthy()
    // General is not a role, so it is not counted.
    expect(card.roleCount).toBe(card.rooms.length - 1)
  })
})

describe('delivery state', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('posts as sending, then lands as sent', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { sendInternalMessage, messagesFor } = useInternalInbox()

    sendInternalMessage(GENERAL_LST1, 'Pump service tomorrow.')
    expect(messagesFor(GENERAL_LST1).at(-1)!.sendStatus).toBe('sending')

    vi.advanceTimersByTime(SEND_LATENCY_MS)
    expect(messagesFor(GENERAL_LST1).at(-1)!.sendStatus).toBe('sent')
    vi.useRealTimers()
  })

  it('holds a photo in sending for longer than text', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { sendInternalMessage, messagesFor } = useInternalInbox()

    sendInternalMessage(GENERAL_LST1, '', { mediaUrl: 'blob:tap' })
    vi.advanceTimersByTime(SEND_LATENCY_MS)
    // Still uploading at the point a text message would already have landed.
    expect(messagesFor(GENERAL_LST1).at(-1)!.sendStatus).toBe('sending')

    vi.advanceTimersByTime(SEND_LATENCY_WITH_PHOTO_MS - SEND_LATENCY_MS)
    expect(messagesFor(GENERAL_LST1).at(-1)!.sendStatus).toBe('sent')
    vi.useRealTimers()
  })

  it('keeps a failed message in the room rather than losing what was typed', () => {
    vi.useFakeTimers()
    const { sendInternalMessage, messagesFor } = useInternalInbox()

    sendInternalMessage(GENERAL_LST1, 'This will error')
    vi.advanceTimersByTime(SEND_LATENCY_MS)
    const failed = messagesFor(GENERAL_LST1).at(-1)!
    expect(failed.sendStatus).toBe('failed')
    expect(failed.content).toBe('This will error')
    vi.useRealTimers()
  })

  it('retries a failed message unchanged, and can land it', () => {
    vi.useFakeTimers()
    const internal = useInternalInbox()

    internal.sendInternalMessage(GENERAL_LST1, 'This will error', { mediaUrl: 'blob:tap' })
    vi.advanceTimersByTime(SEND_LATENCY_WITH_PHOTO_MS)
    const id = internal.messagesFor(GENERAL_LST1).at(-1)!.id
    expect(internal.messagesFor(GENERAL_LST1).at(-1)!.sendStatus).toBe('failed')

    // The content still forces a failure, so the retry must go back to sending.
    internal.retryInternalMessage(GENERAL_LST1, id)
    expect(internal.messagesFor(GENERAL_LST1).at(-1)!.sendStatus).toBe('sending')
    expect(internal.messagesFor(GENERAL_LST1).at(-1)!.mediaUrl).toBe('blob:tap')

    vi.advanceTimersByTime(SEND_LATENCY_WITH_PHOTO_MS)
    expect(internal.messagesFor(GENERAL_LST1).at(-1)!.sendStatus).toBe('failed')
    vi.useRealTimers()
  })

  it('refuses to retry anything that is not failed', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const internal = useInternalInbox()

    internal.sendInternalMessage(GENERAL_LST1, 'Fine message')
    vi.advanceTimersByTime(SEND_LATENCY_MS)
    const id = internal.messagesFor(GENERAL_LST1).at(-1)!.id

    internal.retryInternalMessage(GENERAL_LST1, id)
    expect(internal.messagesFor(GENERAL_LST1).at(-1)!.sendStatus).toBe('sent')
    vi.useRealTimers()
  })

  it('discards a failed message, and only a failed one', () => {
    vi.useFakeTimers()
    const internal = useInternalInbox()

    internal.sendInternalMessage(GENERAL_LST1, 'This will error')
    vi.advanceTimersByTime(SEND_LATENCY_MS)
    const failedId = internal.messagesFor(GENERAL_LST1).at(-1)!.id
    const count = internal.messagesFor(GENERAL_LST1).length

    // A delivered message is not discardable.
    internal.discardFailedMessage(GENERAL_LST1, 'imsg-seed-3')
    expect(internal.messagesFor(GENERAL_LST1)).toHaveLength(count)

    internal.discardFailedMessage(GENERAL_LST1, failedId)
    expect(internal.messagesFor(GENERAL_LST1)).toHaveLength(count - 1)
    vi.useRealTimers()
  })

  it('leaves the seeded messages with no status, so nothing reads as in flight', () => {
    const { messagesFor } = useInternalInbox()
    expect(messagesFor(HOUSEKEEPING_LST1).every(m => m.sendStatus === undefined)).toBe(true)
  })
})

describe('the open room follows the open listing', () => {
  it('carries the same role across to the new listing', () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    expect(internal.selectedRoom.value?.roomKey).toBe('role-housekeeping')

    // lst-2 also staffs Housekeeping.
    internal.selectListing('lst-2')
    expect(internal.selectedRoom.value?.listingId).toBe('lst-2')
    expect(internal.selectedRoom.value?.roomKey).toBe('role-housekeeping')
  })

  it('falls back to General when the new listing has no room for that role', () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)

    // lst-4 has no Housekeeping room.
    internal.selectListing('lst-4')
    expect(internal.selectedRoom.value?.listingId).toBe('lst-4')
    expect(internal.selectedRoom.value?.roomKey).toBe(GENERAL_ROOM_KEY)
  })

  it('never leaves the thread showing a room from the listing you just left', () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    internal.selectListing('lst-4')
    expect(internal.selectedRoom.value?.listingId).not.toBe('lst-1')
    expect(internal.selectedRoomMessages.value)
      .not
      .toEqual(internal.messagesFor(HOUSEKEEPING_LST1))
  })

  it('clears the draft reply and the selection on the way across', () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    internal.toggleMessageSelection('imsg-seed-1')
    internal.replyDraft.value = { messageId: 'imsg-seed-1', senderName: 'Ni Putu Sari', excerpt: 'Checkout' }

    internal.selectListing('lst-2')
    expect(internal.selectedMessageIds.value).toEqual([])
    expect(internal.replyDraft.value).toBeNull()
  })

  it('does not mark the room it lands on as read: landing is not reading', () => {
    const internal = useInternalInbox()
    const target = roomIdFor('lst-2', GENERAL_ROOM_KEY)
    const unreadBefore = internal.unreadFor(target)
    expect(unreadBefore).toBeGreaterThan(0)

    internal.selectListing('lst-2')
    expect(internal.selectedRoom.value?.id).toBe(target)
    // On screen, still unread: nobody has looked at it.
    expect(internal.unreadFor(target)).toBe(unreadBefore)
  })

  it('marks it read once you click the room itself', () => {
    const internal = useInternalInbox()
    const target = roomIdFor('lst-2', GENERAL_ROOM_KEY)
    internal.selectListing('lst-2')
    expect(internal.unreadFor(target)).toBeGreaterThan(0)

    internal.selectRoom(target)
    expect(internal.unreadFor(target)).toBe(0)
  })

  it('marks it read when you post into it, since you are plainly there', () => {
    const internal = useInternalInbox()
    const target = roomIdFor('lst-2', GENERAL_ROOM_KEY)
    internal.selectListing('lst-2')
    internal.sendInternalMessage(target, 'Noted.')
    expect(internal.unreadFor(target)).toBe(0)
  })

  it('does nothing when the listing is already open, so re-clicking keeps your room', () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    internal.selectListing('lst-1')
    expect(internal.selectedRoom.value?.id).toBe(HOUSEKEEPING_LST1)
  })

  it('blanks the thread rather than auto-opening when a filter moves the listing', () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    const readBefore = internal.unreadFor(roomIdFor('lst-4', GENERAL_ROOM_KEY))

    // A tag that only lst-4 carries pushes the open listing away on its own.
    internal.toggleTagFilter('Umalas')
    expect(internal.activeListingId.value).toBe('lst-4')
    expect(internal.selectedRoom.value).toBeUndefined()
    // Nothing was opened, so nothing was silently marked read.
    expect(internal.unreadFor(roomIdFor('lst-4', GENERAL_ROOM_KEY))).toBe(readBefore)
  })

  it('keeps the thread on a room the room-list search has filtered out of view', () => {
    const internal = useInternalInbox()
    internal.selectRoom(GENERAL_LST1)
    internal.roomSearch.value = 'housekeeping'

    // General is gone from the list, but you are still reading it.
    expect(internal.activeRooms.value.some(r => r.id === GENERAL_LST1)).toBe(false)
    expect(internal.selectedRoom.value?.id).toBe(GENERAL_LST1)
    internal.roomSearch.value = ''
  })
})

describe('the simulated first load', () => {
  it('starts loaded, so nothing mounts into a skeleton it never leaves', () => {
    const { isLoading, hasLoaded } = useInternalInbox()
    expect(isLoading.value).toBe(false)
    expect(hasLoaded.value).toBe(false)
  })

  it('shows the skeleton for the load window, then the rooms', () => {
    vi.useFakeTimers()
    const { beginLoad, isLoading, hasLoaded } = useInternalInbox()

    beginLoad()
    expect(isLoading.value).toBe(true)

    vi.advanceTimersByTime(INTERNAL_LOAD_MS - 1)
    expect(isLoading.value).toBe(true)

    vi.advanceTimersByTime(1)
    expect(isLoading.value).toBe(false)
    expect(hasLoaded.value).toBe(true)
    vi.useRealTimers()
  })

  it('runs once: going back to the view reads what was already fetched', () => {
    vi.useFakeTimers()
    const { beginLoad, isLoading } = useInternalInbox()
    beginLoad()
    vi.advanceTimersByTime(INTERNAL_LOAD_MS)
    expect(isLoading.value).toBe(false)

    beginLoad()
    expect(isLoading.value).toBe(false)
    vi.useRealTimers()
  })

  it('a second call mid-flight does not restart the clock', () => {
    vi.useFakeTimers()
    const { beginLoad, isLoading } = useInternalInbox()
    beginLoad()
    vi.advanceTimersByTime(INTERNAL_LOAD_MS - 100)
    beginLoad()
    vi.advanceTimersByTime(100)
    expect(isLoading.value).toBe(false)
    vi.useRealTimers()
  })
})
