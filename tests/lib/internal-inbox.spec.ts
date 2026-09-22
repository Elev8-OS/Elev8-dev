import type { Message } from '~/components/inbox/data/conversations'
import type { InternalMessage, RoomListingLike, RoomRoleLike } from '~/components/inbox/data/internal'
import type { User } from '~/components/users/data/users'
import { describe, expect, it } from 'vitest'
import {
  buildRoomGroups,
  buildRoomsForListing,
  filterRoomGroups,
  forwardRefFromGuestMessage,
  forwardRefFromInternalMessage,
  GENERAL_ROOM_KEY,
  isRoomMember,
  isTaskOpen,
  previewLineFor,
  replyRefFrom,
  SEND_FAILURE_RATE,
  SEND_LATENCY_MS,
  SEND_LATENCY_WITH_PHOTO_MS,
  sendLatencyFor,
  shouldSendFail,
  tagsForGroups,
  taskAssigneeForRoom,
  taskSeedFromRefs,
  tasksForRoom,
  unreadCountFor,
  visibleListingIdsFor,
} from '~/components/inbox/data/internal'

const LISTINGS: RoomListingLike[] = [
  { id: 'lst-1', name: 'Villa One', photos: ['one.jpg'], tags: ['Canggu', 'Pool'] },
  { id: 'lst-2', name: 'Villa Two', tags: ['Seminyak', 'Pool'] },
  { id: 'lst-3', name: 'Villa Three', photos: ['three.jpg'], tags: ['Ubud'] },
]

const ROLES: RoomRoleLike[] = [
  { id: 'role-listing-manager', name: 'Listing Manager' },
  { id: 'role-housekeeping', name: 'Housekeeping' },
]

function user(patch: Partial<User> & { id: string }): User {
  return {
    name: 'Someone',
    phone: '',
    preferredLanguage: 'en',
    email: '',
    employeeNumber: '',
    monthlySalaryAmount: 0,
    workingDaysPerMonth: 26,
    hoursPerDay: 8,
    roleId: 'role-housekeeping',
    listingIds: [],
    status: 'active',
    initials: 'SO',
    createdAt: '',
    updatedAt: '',
    ...patch,
  }
}

const USERS: User[] = [
  user({ id: 'u-lm', name: 'Made Surya', roleId: 'role-listing-manager', listingIds: ['lst-1', 'lst-2'] }),
  user({ id: 'u-hk1', name: 'Ketut Antara', roleId: 'role-housekeeping', listingIds: ['lst-1'] }),
  user({ id: 'u-hk2', name: 'Wayan Sri', roleId: 'role-housekeeping', listingIds: ['lst-1'] }),
  user({ id: 'u-off', name: 'Former Staff', roleId: 'role-housekeeping', listingIds: ['lst-1'], status: 'inactive' }),
]

describe('room derivation', () => {
  it('opens a role room only where someone with that role is assigned', () => {
    const rooms = buildRoomsForListing(LISTINGS[0]!, USERS, ROLES)
    expect(rooms.map(r => r.roomKey)).toEqual([
      GENERAL_ROOM_KEY,
      'role-listing-manager',
      'role-housekeeping',
    ])
  })

  it('leaves a listing with nobody assigned without any room at all', () => {
    expect(buildRoomsForListing(LISTINGS[2]!, USERS, ROLES)).toEqual([])
  })

  it('opens the General room but no role room where only one role is present', () => {
    const rooms = buildRoomsForListing(LISTINGS[1]!, USERS, ROLES)
    expect(rooms.map(r => r.roomKey)).toEqual([GENERAL_ROOM_KEY, 'role-listing-manager'])
  })

  it('leaves an inactive user out of every room', () => {
    const rooms = buildRoomsForListing(LISTINGS[0]!, USERS, ROLES)
    const housekeeping = rooms.find(r => r.roomKey === 'role-housekeeping')!
    expect(housekeeping.memberIds).toEqual(['u-hk1', 'u-hk2'])
    expect(rooms[0]!.memberIds).not.toContain('u-off')
  })

  it('orders role rooms by the roles list, not by who was seeded first', () => {
    const reversed = [...ROLES].reverse()
    const rooms = buildRoomsForListing(LISTINGS[0]!, USERS, reversed)
    expect(rooms.map(r => r.roomKey)).toEqual([
      GENERAL_ROOM_KEY,
      'role-housekeeping',
      'role-listing-manager',
    ])
  })

  it('drops listings with no rooms from the grouped tree', () => {
    const groups = buildRoomGroups(LISTINGS, USERS, ROLES, ['lst-1', 'lst-2', 'lst-3'])
    expect(groups.map(g => g.listingId)).toEqual(['lst-1', 'lst-2'])
  })
})

describe('visibility and membership', () => {
  it('reads an empty listing scope as the whole portfolio, never as none of it', () => {
    expect(visibleListingIdsFor(user({ id: 'admin' }), LISTINGS)).toEqual(['lst-1', 'lst-2', 'lst-3'])
  })

  it('narrows to the scoped listings when a user has one', () => {
    const scoped = user({ id: 'u', listingIds: ['lst-2'] })
    expect(visibleListingIdsFor(scoped, LISTINGS)).toEqual(['lst-2'])
  })

  it('ignores a scoped listing that no longer exists', () => {
    const scoped = user({ id: 'u', listingIds: ['lst-2', 'lst-gone'] })
    expect(visibleListingIdsFor(scoped, LISTINGS)).toEqual(['lst-2'])
  })

  it('separates membership from visibility: a visible room is not automatically yours', () => {
    const rooms = buildRoomsForListing(LISTINGS[0]!, USERS, ROLES)
    const housekeeping = rooms.find(r => r.roomKey === 'role-housekeeping')!
    // The listing manager can see the housekeeping room (it is on their
    // listing) but is not a member of it.
    expect(isRoomMember(housekeeping, 'u-lm')).toBe(false)
    expect(isRoomMember(housekeeping, 'u-hk1')).toBe(true)
  })

  it('treats a missing user id as a member of nothing', () => {
    const rooms = buildRoomsForListing(LISTINGS[0]!, USERS, ROLES)
    expect(isRoomMember(rooms[0]!, undefined)).toBe(false)
  })
})

describe('filterRoomGroups', () => {
  const groups = buildRoomGroups(LISTINGS, USERS, ROLES, ['lst-1', 'lst-2'])
  const base = { search: '' }

  it('keeps every room of a listing whose name matches', () => {
    const out = filterRoomGroups(groups, { ...base, search: 'villa one' })
    expect(out).toHaveLength(1)
    expect(out[0]!.rooms).toHaveLength(3)
  })

  it('matches on room name across listings', () => {
    const out = filterRoomGroups(groups, { ...base, search: 'housekeeping' })
    expect(out.map(g => g.listingId)).toEqual(['lst-1'])
    expect(out[0]!.rooms.map(r => r.name)).toEqual(['Housekeeping'])
  })

  it('never leaves an empty listing header behind', () => {
    expect(filterRoomGroups(groups, { ...base, search: 'nothing matches' })).toEqual([])
  })
})

describe('forward snapshots', () => {
  const guestMessage: Message = {
    id: 'msg-1',
    conversationId: 'conv-1',
    sender: 'guest',
    senderName: 'Anna Schmidt',
    content: 'The AC is blowing warm air.',
    channel: 'WhatsApp',
    timestamp: '2026-09-20T10:00:00Z',
  }

  it('labels a guest message with the guest and the property', () => {
    const ref = forwardRefFromGuestMessage(guestMessage, {
      guestName: 'Anna Schmidt',
      listingName: 'Villa One',
    })
    expect(ref).toMatchObject({
      sourceKind: 'guest',
      conversationId: 'conv-1',
      contextLabel: 'Anna Schmidt · Villa One',
      senderLabel: 'Guest',
      channel: 'WhatsApp',
    })
  })

  it('credits an AI-written reply to ElevAI rather than the staff account it posted under', () => {
    const ref = forwardRefFromGuestMessage(
      { ...guestMessage, sender: 'host', senderName: 'Komang', aiWritten: true },
      { guestName: 'Anna', listingName: 'Villa One' },
    )
    expect(ref.senderName).toBe('ElevAI')
    expect(ref.senderLabel).toBe('ElevAI')
  })

  it('prefers the sender role over the generic sender type for a staff message', () => {
    const ref = forwardRefFromGuestMessage(
      { ...guestMessage, sender: 'host', senderName: 'Komang', senderRole: 'Guest Relations' },
      { guestName: 'Anna', listingName: 'Villa One' },
    )
    expect(ref.senderLabel).toBe('Guest Relations')
  })

  it('names the room a message is lifted out of, not the original guest thread', () => {
    const internal: InternalMessage = {
      id: 'imsg-1',
      roomId: 'room-lst-1-role-housekeeping',
      authorId: 'u-hk1',
      authorName: 'Ketut Antara',
      authorInitials: 'KA',
      authorRole: 'Housekeeping',
      content: 'Needs a technician.',
      createdAt: '2026-09-20T11:00:00Z',
    }
    const ref = forwardRefFromInternalMessage(internal, {
      id: 'room-lst-1-role-housekeeping',
      name: 'Housekeeping',
      listingName: 'Villa One',
    })
    expect(ref).toMatchObject({
      sourceKind: 'internal',
      roomId: 'room-lst-1-role-housekeeping',
      contextLabel: 'Housekeeping · Villa One',
      senderLabel: 'Housekeeping',
    })
    expect(ref.conversationId).toBeUndefined()
  })

  it('carries an attached photo into the forward, which is often the point of it', () => {
    const internal: InternalMessage = {
      id: 'imsg-2',
      roomId: 'room-lst-1-role-housekeeping',
      authorId: 'u-hk1',
      authorName: 'Ketut Antara',
      authorInitials: 'KA',
      authorRole: 'Housekeeping',
      content: '',
      createdAt: '2026-09-20T11:00:00Z',
      mediaUrl: 'blob:leaking-tap',
    }
    const ref = forwardRefFromInternalMessage(internal, {
      id: 'room-lst-1-role-housekeeping',
      name: 'Housekeeping',
      listingName: 'Villa One',
    })
    expect(ref.mediaUrl).toBe('blob:leaking-tap')
  })
})

describe('reply excerpt and preview line', () => {
  function msg(patch: Partial<InternalMessage>): InternalMessage {
    return {
      id: 'imsg',
      roomId: 'room',
      authorId: 'u',
      authorName: 'Someone',
      authorInitials: 'SO',
      authorRole: 'Housekeeping',
      content: '',
      createdAt: '2026-09-20T10:00:00Z',
      ...patch,
    }
  }

  it('flattens and truncates a long quote', () => {
    const long = 'a'.repeat(200)
    const ref = replyRefFrom(msg({ content: long }))
    expect(ref.excerpt).toHaveLength(118)
    expect(ref.excerpt.endsWith('…')).toBe(true)
  })

  it('collapses newlines in a quote', () => {
    expect(replyRefFrom(msg({ content: 'one\n\ntwo' })).excerpt).toBe('one two')
  })

  it('names a photo with an ICON, never an emoji: emoji are not icons', () => {
    expect(previewLineFor(msg({ mediaUrl: 'blob:photo' })))
      .toEqual({ text: 'Photo', icon: 'lucide:camera' })
  })

  it('describes a note-less forward rather than rendering a blank row', () => {
    const forwarded = msg({
      forwarded: [{
        sourceId: 's1',
        sourceKind: 'guest',
        contextLabel: 'Anna · Villa One',
        senderName: 'Anna',
        senderLabel: 'Guest',
        content: 'The AC is broken.',
        timestamp: '2026-09-20T10:00:00Z',
      }],
    })
    expect(previewLineFor(forwarded))
      .toEqual({ text: 'Forwarded: The AC is broken.', icon: 'lucide:forward' })
  })

  it('counts a multi-message forward instead of quoting the first', () => {
    const item = {
      sourceId: 's',
      sourceKind: 'guest' as const,
      contextLabel: 'c',
      senderName: 'n',
      senderLabel: 'Guest',
      content: 'x',
      timestamp: '2026-09-20T10:00:00Z',
    }
    expect(previewLineFor(msg({ forwarded: [item, { ...item, sourceId: 's2' }] })))
      .toEqual({ text: 'Forwarded 2 messages', icon: 'lucide:forward' })
  })

  it('describes a task notice', () => {
    expect(previewLineFor(msg({ systemKind: 'task_created', taskRef: { id: 'TASK-1', title: 'Fix AC' } })))
      .toEqual({ text: 'Task opened: Fix AC', icon: 'lucide:list-checks' })
  })

  it('has nothing to say about no message', () => {
    expect(previewLineFor(undefined)).toEqual({ text: '' })
  })

  it('prefers the caption over the photo when there is one', () => {
    expect(previewLineFor(msg({ content: 'Tap is leaking', mediaUrl: 'blob:photo' })))
      .toEqual({ text: 'Tap is leaking' })
  })
})

describe('unreadCountFor', () => {
  const messages: InternalMessage[] = [
    { id: 'a', roomId: 'r', authorId: 'u-other', authorName: '', authorInitials: '', authorRole: '', content: '1', createdAt: '2026-09-20T09:00:00Z' },
    { id: 'b', roomId: 'r', authorId: 'me', authorName: '', authorInitials: '', authorRole: '', content: '2', createdAt: '2026-09-20T11:00:00Z' },
    { id: 'c', roomId: 'r', authorId: 'u-other', authorName: '', authorInitials: '', authorRole: '', content: '3', createdAt: '2026-09-20T12:00:00Z' },
  ]

  it('counts everything from other people in a room never opened', () => {
    expect(unreadCountFor(messages, undefined, 'me')).toBe(2)
  })

  it('counts only what arrived after the last read', () => {
    expect(unreadCountFor(messages, '2026-09-20T10:00:00Z', 'me')).toBe(1)
  })

  it('never counts your own messages, so sending cannot light up your own badge', () => {
    expect(unreadCountFor(messages, '2026-09-20T10:30:00Z', 'me')).toBe(1)
    expect(unreadCountFor([messages[1]!], undefined, 'me')).toBe(0)
  })
})

describe('task seeding', () => {
  const refs = [
    {
      sourceId: 's1',
      sourceKind: 'guest' as const,
      contextLabel: 'Anna · Villa One',
      senderName: 'Anna',
      senderLabel: 'Guest',
      content: 'The AC is blowing warm air in the main bedroom.',
      timestamp: '2026-09-20T10:00:00Z',
    },
    {
      sourceId: 's2',
      sourceKind: 'guest' as const,
      contextLabel: 'Anna · Villa One',
      senderName: 'Komang',
      senderLabel: 'Guest Relations',
      content: 'Sending someone over.',
      timestamp: '2026-09-20T10:05:00Z',
    },
  ]

  it('titles the task from the first message and keeps every message in the body', () => {
    const seed = taskSeedFromRefs(refs)
    expect(seed.title).toBe('The AC is blowing warm air in the main bedroom.')
    expect(seed.description).toContain('Anna (Guest)')
    expect(seed.description).toContain('Komang (Guest Relations)')
    expect(seed.description).toContain('Sending someone over.')
  })

  it('truncates a title that would not fit a table row', () => {
    const seed = taskSeedFromRefs([{ ...refs[0]!, content: 'x'.repeat(200) }])
    expect(seed.title).toHaveLength(78)
    expect(seed.title.endsWith('…')).toBe(true)
  })

  it('returns nothing to seed from nothing', () => {
    expect(taskSeedFromRefs([])).toEqual({ title: '', description: '' })
  })
})

describe('taskAssigneeForRoom', () => {
  it('maps the operational roles onto the Tasks module vocabulary', () => {
    expect(taskAssigneeForRoom('role-housekeeping')).toBe('housekeeping')
    expect(taskAssigneeForRoom('role-laundry')).toBe('housekeeping')
    expect(taskAssigneeForRoom('role-electrician')).toBe('maintenance')
    expect(taskAssigneeForRoom('role-pool')).toBe('maintenance')
    expect(taskAssigneeForRoom('role-guest-experience-manager')).toBe('guest-relations')
  })

  it('leaves the task unassigned rather than guessing', () => {
    expect(taskAssigneeForRoom(GENERAL_ROOM_KEY)).toBe('')
    expect(taskAssigneeForRoom('role-owner')).toBe('')
  })
})

describe('listing cards', () => {
  const groups = buildRoomGroups(LISTINGS, USERS, ROLES, ['lst-1', 'lst-2'])

  it('carries the cover photo and the listing tags onto the group', () => {
    expect(groups[0]).toMatchObject({ photo: 'one.jpg', tags: ['Canggu', 'Pool'] })
  })

  it('leaves the photo undefined rather than inventing one', () => {
    expect(groups[1]!.photo).toBeUndefined()
  })

  it('counts ROLES, which excludes the General room', () => {
    // lst-1 opens General + Listing Manager + Housekeeping.
    expect(groups[0]!.rooms).toHaveLength(3)
    expect(groups[0]!.roleCount).toBe(2)
    // lst-2 opens General + Listing Manager.
    expect(groups[1]!.roleCount).toBe(1)
  })

  it('reads an untagged listing as no tags, never as undefined', () => {
    const untagged = buildRoomGroups([{ id: 'lst-1', name: 'Villa One' }], USERS, ROLES, ['lst-1'])
    expect(untagged[0]!.tags).toEqual([])
  })

  it('collects every tag in play, sorted and deduped', () => {
    expect(tagsForGroups(groups)).toEqual(['Canggu', 'Pool', 'Seminyak'])
  })
})

describe('tag and listing scope filters', () => {
  const groups = buildRoomGroups(LISTINGS, USERS, ROLES, ['lst-1', 'lst-2'])
  const base = { search: '' }

  it('aNDs the tags: a listing must carry every one of them', () => {
    expect(filterRoomGroups(groups, { ...base, tags: ['Pool'] }).map(g => g.listingId))
      .toEqual(['lst-1', 'lst-2'])
    expect(filterRoomGroups(groups, { ...base, tags: ['Pool', 'Canggu'] }).map(g => g.listingId))
      .toEqual(['lst-1'])
    // No listing carries both, so ANDing empties the list rather than ORing.
    expect(filterRoomGroups(groups, { ...base, tags: ['Canggu', 'Seminyak'] })).toEqual([])
  })

  it('scopes to a single listing', () => {
    const out = filterRoomGroups(groups, { ...base, listingId: 'lst-2' })
    expect(out.map(g => g.listingId)).toEqual(['lst-2'])
  })

  it('reads an unknown scope as nothing, not as everything', () => {
    expect(filterRoomGroups(groups, { ...base, listingId: 'lst-gone' })).toEqual([])
  })

  it('combines a tag with a search without either widening the other', () => {
    const out = filterRoomGroups(groups, { ...base, tags: ['Pool'], search: 'housekeeping' })
    expect(out.map(g => g.listingId)).toEqual(['lst-1'])
    expect(out[0]!.rooms.map(r => r.name)).toEqual(['Housekeeping'])
  })
})

describe('member count on a listing card', () => {
  const groups = buildRoomGroups(LISTINGS, USERS, ROLES, ['lst-1', 'lst-2'])

  it('counts each person once, not once per room they sit in', () => {
    // lst-1 holds the listing manager plus two housekeepers, and every one of
    // them is also in General, so summing the rooms would give 6.
    expect(groups[0]!.rooms.reduce((n, r) => n + r.memberIds.length, 0)).toBe(6)
    expect(groups[0]!.memberCount).toBe(3)
  })

  it('counts an inactive user in neither the rooms nor the total', () => {
    // u-off is assigned to lst-1 but inactive.
    expect(groups[0]!.memberCount).toBe(3)
  })

  it('counts a lone member', () => {
    expect(groups[1]!.memberCount).toBe(1)
  })
})

describe('tasksForRoom', () => {
  const HOUSEKEEPING = { roomKey: 'role-housekeeping' as const, listingName: 'Villa One' }
  const GENERAL = { roomKey: GENERAL_ROOM_KEY, listingName: 'Villa One' }

  const TASKS = [
    { id: 'T-1', title: 'Deep clean the pool villa', status: 'todo', listing: 'Villa One', assignee: 'housekeeping', assigneeType: 'role' as const, dueDate: '2026-09-25' },
    { id: 'T-2', title: 'Fix the AC', status: 'in progress', listing: 'Villa One', assignee: 'maintenance', assigneeType: 'role' as const },
    { id: 'T-3', title: 'Restock towels', status: 'done', listing: 'Villa One', assignee: 'housekeeping', assigneeType: 'role' as const, dueDate: '2026-09-20' },
    { id: 'T-4', title: 'Clean the other villa', status: 'todo', listing: 'Villa Two', assignee: 'housekeeping', assigneeType: 'role' as const },
    { id: 'T-5', title: 'Personal errand', status: 'todo', listing: 'Villa One', assignee: 'komang-juliantara', assigneeType: 'person' as const },
    { id: 'T-6', title: 'Undated housekeeping job', status: 'todo', listing: 'Villa One', assignee: 'housekeeping', assigneeType: 'role' as const },
  ]

  it('answers with the tasks that fall to the room role, at its listing', () => {
    expect(tasksForRoom(TASKS, HOUSEKEEPING).map(t => t.id)).toEqual(['T-1', 'T-6', 'T-3'])
  })

  it('never borrows another role work', () => {
    expect(tasksForRoom(TASKS, HOUSEKEEPING).map(t => t.id)).not.toContain('T-2')
  })

  it('never reaches into another listing', () => {
    expect(tasksForRoom(TASKS, HOUSEKEEPING).map(t => t.id)).not.toContain('T-4')
  })

  it('leaves a task assigned to a person out of a role room', () => {
    expect(tasksForRoom(TASKS, HOUSEKEEPING).map(t => t.id)).not.toContain('T-5')
  })

  it('puts open tasks first, then the soonest due, with undated ones last', () => {
    const ids = tasksForRoom(TASKS, HOUSEKEEPING).map(t => t.id)
    // T-1 is due and open, T-6 is open and undated, T-3 is done.
    expect(ids).toEqual(['T-1', 'T-6', 'T-3'])
  })

  it('shows every task at the listing in the General room, which everybody is in', () => {
    expect(tasksForRoom(TASKS, GENERAL).map(t => t.id).sort())
      .toEqual(['T-1', 'T-2', 'T-3', 'T-5', 'T-6'])
  })

  it('answers with nothing rather than guessing for a role the Tasks module does not know', () => {
    expect(tasksForRoom(TASKS, { roomKey: 'role-owner', listingName: 'Villa One' })).toEqual([])
  })

  it('does not mutate the tasks it is handed', () => {
    const before = TASKS.map(t => t.id)
    tasksForRoom(TASKS, HOUSEKEEPING)
    expect(TASKS.map(t => t.id)).toEqual(before)
  })

  it('reads done and cancelled as closed, whichever spelling', () => {
    expect(isTaskOpen({ id: 'x', title: '', status: 'todo' })).toBe(true)
    expect(isTaskOpen({ id: 'x', title: '', status: 'In Progress' })).toBe(true)
    expect(isTaskOpen({ id: 'x', title: '', status: 'done' })).toBe(false)
    expect(isTaskOpen({ id: 'x', title: '', status: 'canceled' })).toBe(false)
    expect(isTaskOpen({ id: 'x', title: '', status: 'cancelled' })).toBe(false)
  })
})

describe('mock delivery', () => {
  it('gives a photo visibly longer than text, because that is what the state covers', () => {
    expect(sendLatencyFor(false)).toBe(SEND_LATENCY_MS)
    expect(sendLatencyFor(true)).toBe(SEND_LATENCY_WITH_PHOTO_MS)
    expect(SEND_LATENCY_WITH_PHOTO_MS).toBeGreaterThan(SEND_LATENCY_MS)
  })

  it('fails on the roll below the rate, and succeeds on or above it', () => {
    expect(shouldSendFail('hello', 0)).toBe(true)
    expect(shouldSendFail('hello', SEND_FAILURE_RATE - 0.001)).toBe(true)
    expect(shouldSendFail('hello', SEND_FAILURE_RATE)).toBe(false)
    expect(shouldSendFail('hello', 0.99)).toBe(false)
  })

  it('lets "error" force a failure, the only way to demonstrate it on purpose', () => {
    expect(shouldSendFail('this will error', 0.99)).toBe(true)
    expect(shouldSendFail('THIS WILL ERROR', 0.99)).toBe(true)
  })
})
