import type { Message } from './conversations'
import type { RoleId } from '~/components/users/data/roles'
import type { User } from '~/components/users/data/users'

/**
 * Internal staff messaging, one step removed from the guest inbox.
 *
 * The shape of it: a listing holds a room per role, so "the housekeepers on
 * Villa Merapi" is an address a guest message can be forwarded to. Rooms are
 * DERIVED from who is assigned where, never hand-seeded: a room exists
 * because somebody with that role is assigned to that listing, so adding a
 * user to a listing opens the room and removing the last one closes it. There
 * is no room CRUD for exactly that reason.
 *
 * This module is framework-free (the same split as `gm-dashboard.ts` and
 * `promo-code-form.ts`): the composable owns the reactive state and calls in.
 */

/** The role-less room every member of a listing shares. */
export const GENERAL_ROOM_KEY = 'general'

export type RoomKey = RoleId | typeof GENERAL_ROOM_KEY

export interface InternalRoom {
  id: string
  listingId: string
  listingName: string
  /** `general`, or the role whose holders staff this room. */
  roomKey: RoomKey
  /** Room name: the role's name, or `General`. */
  name: string
  /** User ids of the people in the room. */
  memberIds: string[]
}

/**
 * A message lifted out of somewhere else and pinned into a room. Frozen at
 * forward time on purpose: it is a record of what was said, so a later edit
 * to the source must not rewrite what the housekeeper was asked to act on.
 * Same snapshot rule as a folio catalog pick.
 */
export interface ForwardedRef {
  /** Id of the source message, for provenance only. Never a live join. */
  sourceId: string
  sourceKind: 'guest' | 'internal'
  /** Set when `sourceKind === 'guest'`: the conversation it came out of. */
  conversationId?: string
  /** Set when `sourceKind === 'internal'`: the room it came out of. */
  roomId?: string
  /** Guest name for a guest message, listing name for context. */
  contextLabel: string
  senderName: string
  /** `Guest`, `ElevAI`, or the sender's role. */
  senderLabel: string
  content: string
  timestamp: string
  channel?: string
  mediaUrl?: string
}

export interface InternalReplyRef {
  messageId: string
  senderName: string
  /** Trimmed to one line; the full message is still in the room above. */
  excerpt: string
}

export interface InternalMessage {
  id: string
  roomId: string
  authorId: string
  authorName: string
  authorInitials: string
  authorRole: string
  content: string
  createdAt: string
  /** Blob or data URL of an attached image. Same shape as `Message.mediaUrl`. */
  mediaUrl?: string
  /** "1280 × 960", read off the image once it loads. */
  mediaDims?: string
  forwarded?: ForwardedRef[]
  replyTo?: InternalReplyRef
  /**
   * Delivery state of an own message. Absent on anything already delivered,
   * including every seeded and forwarded-in message, so nothing has to be
   * migrated and a read message never renders a status line.
   */
  sendStatus?: 'sending' | 'sent' | 'failed'
  /** A system line rather than a person talking (a task was opened here). */
  systemKind?: 'task_created'
  taskRef?: { id: string, title: string }
}

export interface RoomListingGroup {
  listingId: string
  listingName: string
  rooms: InternalRoom[]
  /** Cover photo for the listing card in the nav. */
  photo?: string
  /** The listing's own tags, which the nav tag filter reads. */
  tags: string[]
  /**
   * How many ROLES staff this listing, which is the room count minus the
   * General room. General is not a role, so counting it would overstate the
   * team by one on every card.
   */
  roleCount: number
  /**
   * How many PEOPLE staff this listing, counted once each. Derived from the
   * union of the rooms rather than summed across them: most staff sit in two
   * rooms (General plus their role), so summing would roughly double it.
   */
  memberCount: number
}

/** Structural stand-in for `Listing`, so the rules stay testable without the store. */
export interface RoomListingLike {
  id: string
  name: string
  status?: 'active' | 'inactive'
  photos?: string[]
  tags?: string[]
}

/** Structural stand-in for `Role`. */
export interface RoomRoleLike {
  id: RoleId
  name: string
}

/**
 * Mock delivery timings. A photo takes visibly longer than text, because the
 * whole point of the state is to cover the upload: an instant spinner tells
 * the sender nothing.
 */
/**
 * How long the Internal view pretends to fetch its rooms on first entry. Long
 * enough to read as a load rather than a flash, short enough not to be in the
 * way. Nothing is actually fetched: the rooms are derived from stores that are
 * already in memory.
 */
export const INTERNAL_LOAD_MS = 900

export const SEND_LATENCY_MS = 700
export const SEND_LATENCY_WITH_PHOTO_MS = 1800
export const SEND_FAILURE_RATE = 0.12

export function sendLatencyFor(hasPhoto: boolean): number {
  return hasPhoto ? SEND_LATENCY_WITH_PHOTO_MS : SEND_LATENCY_MS
}

/**
 * Whether a mock send fails. `roll` is injected rather than read from
 * `Math.random` inside, so the failure path is reachable in a test without
 * stubbing a global.
 *
 * Typing "error" forces it, which is the only way to demonstrate the failed
 * state on purpose: a 12 percent chance is not something you can show someone.
 */
export function shouldSendFail(content: string, roll: number): boolean {
  return content.toLowerCase().includes('error') || roll < SEND_FAILURE_RATE
}

export function roomIdFor(listingId: string, roomKey: RoomKey): string {
  return `room-${listingId}-${roomKey}`
}

/**
 * Which listings a user can see rooms on. An EMPTY `listingIds` means the
 * whole portfolio, not none of it: admins, general managers and owners are
 * seeded with no scope and would otherwise be locked out of a feature they
 * are meant to oversee.
 */
export function visibleListingIdsFor(
  user: Pick<User, 'listingIds'> | undefined,
  listings: RoomListingLike[],
): string[] {
  const all = listings.map(l => l.id)
  if (!user || user.listingIds.length === 0)
    return all
  const scoped = new Set(user.listingIds)
  return all.filter(id => scoped.has(id))
}

/**
 * ⚠️ Visibility and membership are deliberately different things. You SEE
 * every room on a listing you are assigned to, because the point of the
 * feature is a guest-relations agent handing a broken AC to maintenance and
 * reading the answer. You are a MEMBER only of the room matching your role,
 * which is what "Your rooms" filters on and what the member list counts.
 * Collapsing the two would make forwarding impossible for the person who
 * needs it most.
 */
export function isRoomMember(room: InternalRoom, userId: string | undefined): boolean {
  return !!userId && room.memberIds.includes(userId)
}

/**
 * Derives the rooms for one listing. A role room exists only where at least
 * one active user of that role is assigned to the listing; the General room
 * exists wherever anybody is.
 */
export function buildRoomsForListing(
  listing: RoomListingLike,
  users: User[],
  roles: RoomRoleLike[],
): InternalRoom[] {
  const assigned = users.filter(u =>
    u.status === 'active' && u.listingIds.includes(listing.id),
  )
  if (assigned.length === 0)
    return []

  const rooms: InternalRoom[] = [{
    id: roomIdFor(listing.id, GENERAL_ROOM_KEY),
    listingId: listing.id,
    listingName: listing.name,
    roomKey: GENERAL_ROOM_KEY,
    name: 'General',
    memberIds: assigned.map(u => u.id),
  }]

  // Role order follows the roles list, so every listing orders its rooms the
  // same way rather than by whoever happened to be seeded first.
  for (const role of roles) {
    const members = assigned.filter(u => u.roleId === role.id)
    if (members.length === 0)
      continue
    rooms.push({
      id: roomIdFor(listing.id, role.id),
      listingId: listing.id,
      listingName: listing.name,
      roomKey: role.id,
      name: role.name,
      memberIds: members.map(u => u.id),
    })
  }

  return rooms
}

export function buildRoomGroups(
  listings: RoomListingLike[],
  users: User[],
  roles: RoomRoleLike[],
  visibleListingIds: string[],
): RoomListingGroup[] {
  const visible = new Set(visibleListingIds)
  const groups: RoomListingGroup[] = []
  for (const listing of listings) {
    if (!visible.has(listing.id))
      continue
    const rooms = buildRoomsForListing(listing, users, roles)
    if (rooms.length === 0)
      continue
    groups.push({
      listingId: listing.id,
      listingName: listing.name,
      rooms,
      photo: listing.photos?.[0],
      tags: listing.tags ?? [],
      roleCount: rooms.filter(r => r.roomKey !== GENERAL_ROOM_KEY).length,
      memberCount: new Set(rooms.flatMap(r => r.memberIds)).size,
    })
  }
  return groups
}

export interface RoomGroupFilter {
  search: string
  /** Listing tags, ANDed: a listing must carry every one of them. */
  tags?: string[]
  /**
   * The one listing the room list is scoped to. Left undefined for the nav's
   * own listing cards, which must keep showing every listing so the picked
   * one can be swapped for another.
   */
  listingId?: string
}

/**
 * Filters the tree and drops any listing left with no rooms, so a search never
 * leaves an empty listing header behind. A listing whose NAME matches keeps
 * all of its rooms, since searching for a villa is how you find its rooms.
 */
export function filterRoomGroups(
  groups: RoomListingGroup[],
  filter: RoomGroupFilter,
): RoomListingGroup[] {
  const q = filter.search.trim().toLowerCase()
  const out: RoomListingGroup[] = []

  const tags = filter.tags ?? []

  for (const group of groups) {
    if (filter.listingId && group.listingId !== filter.listingId)
      continue
    // ANDed, the same rule as the listing tag filter in Conversations.
    if (tags.length > 0 && !tags.every(t => group.tags.includes(t)))
      continue
    const listingMatches = !q || group.listingName.toLowerCase().includes(q)
    const rooms = group.rooms.filter(room =>
      !q || listingMatches || room.name.toLowerCase().includes(q),
    )
    if (rooms.length > 0)
      out.push({ ...group, rooms })
  }

  return out
}

/** Every tag worn by a listing that has rooms, sorted, for the nav filter. */
export function tagsForGroups(groups: RoomListingGroup[]): string[] {
  return [...new Set(groups.flatMap(g => g.tags))].sort()
}

const SENDER_LABELS: Record<string, string> = {
  guest: 'Guest',
  host: 'Staff',
  system: 'System',
  ai: 'ElevAI',
}

/** Snapshots a guest-thread message into something a room can carry. */
export function forwardRefFromGuestMessage(
  message: Message,
  context: { guestName: string, listingName: string },
): ForwardedRef {
  return {
    sourceId: message.id,
    sourceKind: 'guest',
    conversationId: message.conversationId,
    contextLabel: `${context.guestName} · ${context.listingName}`,
    senderName: message.aiWritten ? 'ElevAI' : message.senderName,
    senderLabel: message.aiWritten
      ? 'ElevAI'
      : (message.senderRole ?? SENDER_LABELS[message.sender] ?? 'Staff'),
    content: message.content,
    timestamp: message.timestamp,
    channel: message.channel,
    mediaUrl: message.mediaUrl,
  }
}

/**
 * Snapshots a room message for forwarding on. A message that was ITSELF a
 * forward carries its own quoted content, so the label names the room it is
 * being lifted out of rather than pretending the original guest said it here.
 */
export function forwardRefFromInternalMessage(
  message: InternalMessage,
  room: Pick<InternalRoom, 'id' | 'name' | 'listingName'>,
): ForwardedRef {
  return {
    sourceId: message.id,
    sourceKind: 'internal',
    roomId: room.id,
    contextLabel: `${room.name} · ${room.listingName}`,
    senderName: message.authorName,
    senderLabel: message.authorRole,
    content: message.content,
    timestamp: message.createdAt,
    // An attached photo travels with the forward; a maintenance photo is
    // usually the whole point of handing the message on.
    mediaUrl: message.mediaUrl,
  }
}

export function replyRefFrom(message: InternalMessage): InternalReplyRef {
  const flat = message.content.replace(/\s+/g, ' ').trim()
  return {
    messageId: message.id,
    senderName: message.authorName,
    excerpt: flat.length > 120 ? `${flat.slice(0, 117)}…` : flat,
  }
}

/** What the room list shows under a room name, plus the icon that stands for it. */
export interface RoomPreview {
  text: string
  /**
   * A lucide name. ⚠️ Never an emoji: emoji are not icons, they render at the
   *  mercy of the platform font and carry no theme colour.
   */
  icon?: string
}

/**
 * The line the room list shows under a room name. A forward or a photo with no
 * note of its own would otherwise render as a blank row.
 */
export function previewLineFor(message: InternalMessage | undefined): RoomPreview {
  if (!message)
    return { text: '' }
  if (message.content.trim())
    return { text: message.content }
  if (message.mediaUrl)
    return { text: 'Photo', icon: 'lucide:camera' }
  if (message.forwarded?.length) {
    return {
      text: message.forwarded.length === 1
        ? `Forwarded: ${message.forwarded[0]!.content}`
        : `Forwarded ${message.forwarded.length} messages`,
      icon: 'lucide:forward',
    }
  }
  if (message.systemKind === 'task_created')
    return { text: `Task opened: ${message.taskRef?.title ?? ''}`, icon: 'lucide:list-checks' }
  return { text: '' }
}

/**
 * Unread is "posted after I last opened the room, by somebody else". Own
 * messages never count, so sending into a quiet room cannot light up its own
 * badge.
 */
export function unreadCountFor(
  messages: InternalMessage[],
  lastReadAt: string | undefined,
  currentUserId: string | undefined,
): number {
  return messages.filter((m) => {
    if (m.authorId === currentUserId)
      return false
    if (!lastReadAt)
      return true
    return m.createdAt > lastReadAt
  }).length
}

/** Seed traffic so the rooms are not empty on a cold load. */
export function buildSeedMessages(): Record<string, InternalMessage[]> {
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString()

  return {
    [roomIdFor('lst-1', 'role-housekeeping')]: [
      {
        id: 'imsg-seed-1',
        roomId: roomIdFor('lst-1', 'role-housekeeping'),
        authorId: 'user-6',
        authorName: 'Ni Putu Sari',
        authorInitials: 'NS',
        authorRole: 'Housekeeping Manager',
        content: 'Checkout at 11:00 today, turnover needs to be done before the 15:00 arrival. Please start with the master bedroom.',
        createdAt: at(6),
      },
      {
        id: 'imsg-seed-2',
        roomId: roomIdFor('lst-1', 'role-housekeeping'),
        authorId: 'user-7',
        authorName: 'Ketut Antara',
        authorInitials: 'KA',
        authorRole: 'Housekeeping',
        content: 'On it. Running low on bath towels, I will take the spare set from the store room.',
        createdAt: at(5),
      },
      // A forward from SOMEBODY ELSE, so the cross-user rendering (avatar and
      // name on the left, muted bubble) is on screen from a cold load without
      // anyone having to stage it. Made Surya is the Listing Manager here: he
      // can see this room and forward into it without being a member of it,
      // which is the visibility-vs-membership split working as intended.
      {
        id: 'imsg-seed-6',
        roomId: roomIdFor('lst-1', 'role-housekeeping'),
        authorId: 'user-2',
        authorName: 'Made Surya',
        authorInitials: 'MS',
        authorRole: 'Listing Manager',
        content: 'Guest flagged this on arrival. Can someone take the pool before the next check-in?',
        createdAt: at(3),
        forwarded: [
          {
            sourceId: 'msg-18-2',
            sourceKind: 'guest',
            conversationId: 'conv-18',
            contextLabel: 'Lucas Müller · 5BR Pool the R Villa Luwa – Serene near Canggu',
            senderName: 'Lucas Müller',
            senderLabel: 'Guest',
            content: 'We just checked in and the pool is dirty. There are leaves everywhere.',
            timestamp: at(4),
            channel: 'Airbnb',
          },
          {
            sourceId: 'msg-18-3',
            sourceKind: 'guest',
            conversationId: 'conv-18',
            contextLabel: 'Lucas Müller · 5BR Pool the R Villa Luwa – Serene near Canggu',
            senderName: 'ElevAI',
            senderLabel: 'ElevAI',
            content: 'I apologize for the pool condition. Scheduling an immediate pool cleaning. The team will be there within 15 minutes.',
            timestamp: at(3.9),
            channel: 'Airbnb',
          },
        ],
      },
    ],
    [roomIdFor('lst-1', GENERAL_ROOM_KEY)]: [
      {
        id: 'imsg-seed-3',
        roomId: roomIdFor('lst-1', GENERAL_ROOM_KEY),
        authorId: 'user-2',
        authorName: 'Made Surya',
        authorInitials: 'MS',
        authorRole: 'Listing Manager',
        content: 'Water pump is being serviced tomorrow between 09:00 and 12:00. Warn any guest who asks about low pressure.',
        createdAt: at(30),
      },
    ],
    [roomIdFor('lst-4', 'role-listing-manager')]: [
      {
        id: 'imsg-seed-4',
        roomId: roomIdFor('lst-4', 'role-listing-manager'),
        authorId: 'user-3',
        authorName: 'Wayan Adi',
        authorInitials: 'WA',
        authorRole: 'Listing Manager',
        content: 'Pool gate battery was replaced this morning, the lock is back online.',
        createdAt: at(2),
      },
    ],
    [roomIdFor('lst-2', GENERAL_ROOM_KEY)]: [
      {
        id: 'imsg-seed-5',
        roomId: roomIdFor('lst-2', GENERAL_ROOM_KEY),
        authorId: 'user-6',
        authorName: 'Ni Putu Sari',
        authorInitials: 'NS',
        authorRole: 'Housekeeping Manager',
        content: 'Reminder: the new linen supplier delivers on Mondays now, not Thursdays.',
        createdAt: new Date(now - 3 * day).toISOString(),
      },
    ],
  }
}

/**
 * Best-effort bridge from a room's role to the Tasks module's own, much
 * shorter, assignee vocabulary (`assigneeRoles` in `tasks/data/data.ts`).
 * ⚠️ Returns `''` rather than guessing when nothing lines up: an unassigned
 * task is a task somebody has to pick up, a wrongly assigned one is a task
 * everybody assumes is handled.
 */
export function taskAssigneeForRoom(roomKey: RoomKey): string {
  switch (roomKey) {
    case 'role-admin':
      return 'admin'
    case 'role-guest-experience-manager':
      return 'guest-relations'
    case 'role-listing-manager':
    case 'role-general-manager':
      return 'listing-manager'
    case 'role-housekeeping':
    case 'role-housekeeping-manager':
    case 'role-laundry':
      return 'housekeeping'
    case 'role-engineering':
    case 'role-electrician':
    case 'role-pool':
    case 'role-gardener':
      return 'maintenance'
    default:
      return ''
  }
}

/**
 * Turns the messages being acted on into a task title and body. The title is
 * the first message, trimmed to something that fits a table row; the body
 * keeps every message in full with its sender, because the person picking the
 * task up was not in the conversation.
 */
export function taskSeedFromRefs(refs: ForwardedRef[]): { title: string, description: string } {
  if (refs.length === 0)
    return { title: '', description: '' }
  const first = refs[0]!
  const flat = first.content.replace(/\s+/g, ' ').trim()
  const title = flat.length > 80 ? `${flat.slice(0, 77)}…` : flat
  const description = refs
    .map(r => `${r.senderName} (${r.senderLabel}), ${r.timestamp}:\n${r.content}`)
    .join('\n\n')
  return { title, description }
}

/**
 * Structural stand-in for the Tasks module's `Task`, so the rules stay
 * testable without the task store (same trick as `RoomListingLike`).
 */
export interface RoomTaskLike {
  id: string
  title: string
  status: string
  priority?: string
  listing?: string
  assignee?: string
  assigneeType?: 'role' | 'person'
  dueDate?: string
}

const CLOSED_TASK_STATUSES = new Set(['done', 'canceled', 'cancelled'])

export function isTaskOpen(task: RoomTaskLike): boolean {
  return !CLOSED_TASK_STATUSES.has(task.status.toLowerCase())
}

/**
 * The tasks a room is answerable for: the ones at its listing that fall to its
 * role. The General room is the exception and shows every task at the listing,
 * because it is the room everybody at the property is in, and a panel that is
 * empty in the room people actually sit in is a panel nobody reads.
 *
 * ⚠️ Matched on `Task.listing`, which stores a listing NAME, and on the Tasks
 * module's own short `assigneeRoles` vocabulary via `taskAssigneeForRoom`. A
 * room whose role has no equivalent there answers with nothing rather than
 * borrowing another role's work.
 *
 * Open tasks first, then by due date, soonest first; a task with no due date
 * sorts after the dated ones rather than jumping the queue.
 */
export function tasksForRoom(
  tasks: RoomTaskLike[],
  room: Pick<InternalRoom, 'roomKey' | 'listingName'>,
): RoomTaskLike[] {
  const atListing = tasks.filter(t => t.listing === room.listingName)

  const scoped = room.roomKey === GENERAL_ROOM_KEY
    ? atListing
    : (() => {
        const role = taskAssigneeForRoom(room.roomKey)
        if (!role)
          return []
        return atListing.filter(t => t.assigneeType !== 'person' && t.assignee === role)
      })()

  return [...scoped].sort((a, b) => {
    const openDiff = Number(isTaskOpen(b)) - Number(isTaskOpen(a))
    if (openDiff !== 0)
      return openDiff
    if (a.dueDate && b.dueDate)
      return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate)
      return -1
    if (b.dueDate)
      return 1
    return 0
  })
}
