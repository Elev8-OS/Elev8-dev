import type { Message } from '~/components/inbox/data/conversations'
import type {
  ForwardedRef,
  InternalMessage,
  InternalReplyRef,
  InternalRoom,
  RoomPreview,
} from '~/components/inbox/data/internal'
import type { User } from '~/components/users/data/users'
import { toast } from 'vue-sonner'
import {
  buildRoomGroups,
  buildSeedMessages,
  filterRoomGroups,
  forwardRefFromGuestMessage,
  forwardRefFromInternalMessage,
  INTERNAL_LOAD_MS,
  isRoomMember,
  previewLineFor,
  sendLatencyFor,
  shouldSendFail,
  tagsForGroups,
  tasksForRoom,
  unreadCountFor,
  visibleListingIdsFor,
} from '~/components/inbox/data/internal'
import { listings } from '~/components/listings/data/listings'
import { useCurrentDashboardUser } from './useCurrentDashboardUser'
import { useRoles } from './useRoles'
import { useTaskStore } from './useTaskStore'
import { useUsers } from './useUsers'

/**
 * Staff talking to each other, addressed by listing and role. See
 * `app/components/inbox/data/internal.ts` for why rooms are derived rather
 * than managed.
 */
export function useInternalInbox() {
  const { users } = useUsers()
  const { roles } = useRoles()
  const { currentUser } = useCurrentDashboardUser()
  const { tasks } = useTaskStore()

  const messagesByRoom = useState<Record<string, InternalMessage[]>>(
    'internal-inbox-messages',
    () => buildSeedMessages(),
  )
  const lastReadAt = useState<Record<string, string>>('internal-inbox-last-read', () => ({}))
  const selectedRoomId = useState<string | undefined>('internal-inbox-selected-room', () => undefined)
  const roomSearch = useState<string>('internal-inbox-room-search', () => '')
  /**
   * The one listing the room list is scoped to. Single-select on purpose: it
   * reads as picking a property, and it is what lets the room list drop its
   * group headers, since every row then belongs to the same listing.
   */
  const scopedListingId = useState<string | undefined>('internal-inbox-scoped-listing', () => undefined)
  const activeTagFilters = useState<string[]>('internal-inbox-tag-filters', () => [])
  const replyDraft = useState<InternalReplyRef | null>('internal-inbox-reply-draft', () => null)
  /**
   * The simulated first fetch of the room tree.
   *
   * ⚠️ Starts FALSE, not true. A default of "loading" would put every mounted
   * component, and every existing test, into a skeleton it never leaves unless
   * something advances a timer. `beginLoad()` is the explicit start, and it
   * runs once per session: a second visit to the view reads from what was
   * already fetched, so re-running it would be a lie about where the data
   * comes from. Reload the page to see it again.
   */
  const isLoading = useState<boolean>('internal-inbox-loading', () => false)
  const hasLoaded = useState<boolean>('internal-inbox-has-loaded', () => false)
  const selectedMessageIds = useState<string[]>('internal-inbox-selected-messages', () => [])

  const visibleListingIds = computed(() =>
    visibleListingIdsFor(currentUser.value, listings.value),
  )

  const roomGroups = computed(() =>
    buildRoomGroups(listings.value, users.value, roles.value, visibleListingIds.value),
  )

  const allRooms = computed<InternalRoom[]>(() =>
    roomGroups.value.flatMap(g => g.rooms),
  )

  function beginLoad() {
    if (hasLoaded.value || isLoading.value)
      return
    isLoading.value = true
    setTimeout(() => {
      isLoading.value = false
      hasLoaded.value = true
    }, INTERNAL_LOAD_MS)
  }

  function messagesFor(roomId: string): InternalMessage[] {
    return messagesByRoom.value[roomId] ?? []
  }

  function unreadFor(roomId: string): number {
    return unreadCountFor(messagesFor(roomId), lastReadAt.value[roomId], currentUser.value?.id)
  }

  const totalUnread = computed(() =>
    allRooms.value.reduce((sum, room) => sum + unreadFor(room.id), 0),
  )

  function baseFilter() {
    return {
      search: roomSearch.value,
      tags: activeTagFilters.value,
    }
  }

  /**
   * What the nav's listing cards show. Deliberately NOT scoped to the picked
   * listing: hiding the others the moment one is picked would leave no way to
   * switch to another.
   */
  const listingCardGroups = computed(() =>
    filterRoomGroups(roomGroups.value, baseFilter()),
  )

  /**
   * ⚠️ Exactly one listing is always open. There is no "all listings" state:
   * the room list is a list of roles at a property, and rooms from four
   * properties interleaved read as noise.
   *
   * It is derived rather than stored so the view can never point at nothing.
   * Nothing picked yet means the first listing, and a pick that a tag or
   * search has since filtered away falls back to the first that survived,
   * instead of leaving the room list empty with a listing selected.
   */
  const activeListingId = computed<string | undefined>(() => {
    const cards = listingCardGroups.value
    if (cards.length === 0)
      return undefined
    const picked = scopedListingId.value
    if (picked && cards.some(g => g.listingId === picked))
      return picked
    return cards[0]!.listingId
  })

  const filteredRoomGroups = computed(() =>
    filterRoomGroups(roomGroups.value, { ...baseFilter(), listingId: activeListingId.value }),
  )

  const activeListing = computed(() =>
    roomGroups.value.find(g => g.listingId === activeListingId.value),
  )

  /** The rooms of the open listing, already flat: there is only ever one. */
  const activeRooms = computed(() => filteredRoomGroups.value[0]?.rooms ?? [])

  /**
   * Tags drawn from every listing in scope, not just the filtered ones, so
   * narrowing to one tag never empties the list you narrow with.
   */
  const availableTags = computed(() => tagsForGroups(roomGroups.value))

  function toggleTagFilter(tag: string) {
    activeTagFilters.value = activeTagFilters.value.includes(tag)
      ? activeTagFilters.value.filter(t => t !== tag)
      : [...activeTagFilters.value, tag]
  }

  function clearTagFilters() {
    activeTagFilters.value = []
  }

  function clearRoomFilters() {
    roomSearch.value = ''
    activeTagFilters.value = []
  }

  /** Unread across every room of a listing, for the badge on its nav card. */
  function unreadForListing(listingId: string): number {
    const group = roomGroups.value.find(g => g.listingId === listingId)
    if (!group)
      return 0
    return group.rooms.reduce((sum, room) => sum + unreadFor(room.id), 0)
  }

  /**
   * Every room of the open listing, unfiltered. `activeRooms` is what the room
   * LIST shows and is narrowed by the search; this is what the thread resolves
   * against, so searching for another room does not blank the one you are
   * reading.
   */
  const activeListingRooms = computed(() =>
    roomGroups.value.find(g => g.listingId === activeListingId.value)?.rooms ?? [],
  )

  /**
   * ⚠️ Resolved within the OPEN listing, never across the whole portfolio.
   * Switching listing used to leave the thread and the Room panel showing a
   * room from the listing you had just left, so the three right-hand panels
   * disagreed about which property you were looking at.
   */
  const selectedRoom = computed(() =>
    activeListingRooms.value.find(r => r.id === selectedRoomId.value),
  )

  const selectedRoomMessages = computed(() =>
    selectedRoom.value ? messagesFor(selectedRoom.value.id) : [],
  )

  function roomById(roomId: string): InternalRoom | undefined {
    return allRooms.value.find(r => r.id === roomId)
  }

  /** The tasks the open room is answerable for. See `tasksForRoom`. */
  const roomTasks = computed(() =>
    selectedRoom.value ? tasksForRoom(tasks.value, selectedRoom.value) : [],
  )

  function membersOf(room: InternalRoom | undefined): User[] {
    if (!room)
      return []
    return room.memberIds
      .map(id => users.value.find(u => u.id === id))
      .filter((u): u is User => !!u)
  }

  function lastMessagePreview(roomId: string): RoomPreview {
    const msgs = messagesFor(roomId)
    return previewLineFor(msgs[msgs.length - 1])
  }

  function lastMessageAt(roomId: string): string | undefined {
    const msgs = messagesFor(roomId)
    return msgs[msgs.length - 1]?.createdAt
  }

  function markRoomRead(roomId: string) {
    lastReadAt.value = { ...lastReadAt.value, [roomId]: new Date().toISOString() }
  }

  /**
   * Puts a room in the thread. A draft reply and a selection belong to the
   * room they were made in, so both are dropped.
   *
   * ⚠️ `markRead` is what separates OPENING a room from LANDING on one.
   * Clicking a room in the list is reading it; being carried into one by a
   * listing switch is not, and marking it read there would silently clear an
   * unread badge for messages nobody has looked at.
   */
  function focusRoom(roomId: string, options?: { markRead?: boolean }) {
    selectedRoomId.value = roomId
    replyDraft.value = null
    selectedMessageIds.value = []
    if (options?.markRead !== false)
      markRoomRead(roomId)
  }

  function selectRoom(roomId: string) {
    focusRoom(roomId)
  }

  /**
   * Opens a listing. Not a toggle: one listing is always open.
   *
   * The room travels with you: the same ROLE at the new property if it staffs
   * one, otherwise its General room. Switching from Housekeeping at one villa
   * almost always means you want Housekeeping at the next, and landing on an
   * empty "Select a room" every time you change property is a click you should
   * not have to make.
   *
   * ⚠️ Only on an explicit pick. `activeListingId` also moves on its own when
   * a tag or a search filters the open listing away, and auto-opening there
   * would mark a room read on every keystroke that changed which listing
   * survived.
   */
  function selectListing(listingId: string) {
    if (scopedListingId.value === listingId)
      return
    // Read before the scope moves: `selectedRoom` resolves against it.
    const previousKey = selectedRoom.value?.roomKey
    scopedListingId.value = listingId

    const rooms = roomGroups.value.find(g => g.listingId === listingId)?.rooms ?? []
    const next = (previousKey && rooms.find(r => r.roomKey === previousKey)) ?? rooms[0]
    if (next)
      focusRoom(next.id, { markRead: false })
    else
      selectedRoomId.value = undefined
  }

  function appendMessage(roomId: string, message: InternalMessage) {
    const existing = messagesByRoom.value[roomId] ?? []
    messagesByRoom.value = { ...messagesByRoom.value, [roomId]: [...existing, message] }
  }

  function nextMessageId(): string {
    return `imsg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  }

  function authorFields() {
    const me = currentUser.value
    const role = roles.value.find(r => r.id === me?.roleId)
    return {
      authorId: me?.id ?? 'unknown',
      authorName: me?.name ?? 'Unknown',
      authorInitials: me?.initials ?? '?',
      authorRole: role?.name ?? '',
    }
  }

  /**
   * Posts into a room. A message with no text is still valid when it carries
   * a forward or a photo: handing a message over without commentary is the
   * common case, and a photo of a broken tap says more than a caption would.
   */
  function sendInternalMessage(
    roomId: string,
    content: string,
    extra?: {
      replyTo?: InternalReplyRef | null
      forwarded?: ForwardedRef[]
      mediaUrl?: string | null
      mediaDims?: string | null
    },
  ): InternalMessage | undefined {
    const text = content.trim()
    const forwarded = extra?.forwarded ?? []
    const mediaUrl = extra?.mediaUrl ?? undefined
    if (!text && forwarded.length === 0 && !mediaUrl)
      return undefined

    const message: InternalMessage = {
      id: nextMessageId(),
      roomId,
      ...authorFields(),
      content: text,
      createdAt: new Date().toISOString(),
      sendStatus: 'sending',
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(extra?.mediaDims ? { mediaDims: extra.mediaDims } : {}),
      // Copied, never referenced: a forward is a snapshot, so the caller's
      // array must not be able to rewrite what the room was asked to act on.
      ...(forwarded.length ? { forwarded: forwarded.map(f => ({ ...f })) } : {}),
      ...(extra?.replyTo ? { replyTo: extra.replyTo } : {}),
    }
    appendMessage(roomId, message)
    // Posting into a room is also reading it, otherwise your own message
    // leaves the room you are looking at marked unread.
    markRoomRead(roomId)
    scheduleDelivery(roomId, message.id, text, !!mediaUrl)
    return message
  }

  function patchMessage(roomId: string, messageId: string, patch: Partial<InternalMessage>) {
    const existing = messagesByRoom.value[roomId]
    if (!existing)
      return
    messagesByRoom.value = {
      ...messagesByRoom.value,
      [roomId]: existing.map(m => (m.id === messageId ? { ...m, ...patch } : m)),
    }
  }

  /**
   * The mock delivery round trip. A photo takes longer, since the state exists
   * to cover the upload. On failure the message STAYS in the room, marked
   * failed: dropping it would lose what the sender typed, and a photo picked
   * from a file dialog cannot be recovered by retyping.
   */
  function scheduleDelivery(roomId: string, messageId: string, text: string, hasPhoto: boolean) {
    setTimeout(() => {
      const failed = shouldSendFail(text, Math.random())
      patchMessage(roomId, messageId, { sendStatus: failed ? 'failed' : 'sent' })
      if (failed)
        toast.error('Message failed to send.')
    }, sendLatencyFor(hasPhoto))
  }

  /** Puts a failed message back on the wire, unchanged. */
  function retryInternalMessage(roomId: string, messageId: string) {
    const message = messagesFor(roomId).find(m => m.id === messageId)
    if (!message || message.sendStatus !== 'failed')
      return
    patchMessage(roomId, messageId, { sendStatus: 'sending' })
    scheduleDelivery(roomId, messageId, message.content, !!message.mediaUrl)
  }

  /**
   * Discards a message that never landed. ⚠️ Only a failed one: a delivered
   * message is not deletable, and removing one mid-flight would leave its
   * timer patching a message that no longer exists.
   */
  function discardFailedMessage(roomId: string, messageId: string) {
    const message = messagesFor(roomId).find(m => m.id === messageId)
    if (!message || message.sendStatus !== 'failed')
      return
    const existing = messagesByRoom.value[roomId] ?? []
    messagesByRoom.value = {
      ...messagesByRoom.value,
      [roomId]: existing.filter(m => m.id !== messageId),
    }
  }

  /**
   * Forwards a snapshot into one or more rooms. Each room gets its own
   * message, so a later reply in one room cannot bleed into another.
   */
  function forwardToRooms(roomIds: string[], refs: ForwardedRef[], note: string): number {
    if (roomIds.length === 0 || refs.length === 0)
      return 0
    for (const roomId of roomIds)
      sendInternalMessage(roomId, note, { forwarded: refs })
    return roomIds.length
  }

  function postTaskNotice(roomId: string, task: { id: string, title: string }) {
    appendMessage(roomId, {
      id: nextMessageId(),
      roomId,
      ...authorFields(),
      content: '',
      createdAt: new Date().toISOString(),
      systemKind: 'task_created',
      taskRef: task,
    })
    markRoomRead(roomId)
  }

  // ── Message selection inside a room ────────────────────────────────────
  function toggleMessageSelection(id: string) {
    selectedMessageIds.value = selectedMessageIds.value.includes(id)
      ? selectedMessageIds.value.filter(m => m !== id)
      : [...selectedMessageIds.value, id]
  }

  function clearMessageSelection() {
    selectedMessageIds.value = []
  }

  const selectedMessages = computed(() =>
    selectedRoomMessages.value.filter(m => selectedMessageIds.value.includes(m.id)),
  )

  function isMine(room: InternalRoom): boolean {
    return isRoomMember(room, currentUser.value?.id)
  }

  /**
   * Best-effort listing lookup for a guest conversation, which keys its
   * property by NAME. Only some mock conversations resolve, so the forward
   * dialog must cope with `undefined` rather than assume a room.
   */
  function listingIdForName(listingName: string | undefined): string | undefined {
    if (!listingName)
      return undefined
    return listings.value.find(l => l.name === listingName)?.id
  }

  function refsFromGuestMessages(
    msgs: Message[],
    context: { guestName: string, listingName: string },
  ): ForwardedRef[] {
    return msgs.map(m => forwardRefFromGuestMessage(m, context))
  }

  function refsFromInternalMessages(msgs: InternalMessage[], room: InternalRoom): ForwardedRef[] {
    return msgs.map(m => forwardRefFromInternalMessage(m, room))
  }

  return {
    // state
    selectedRoomId,
    roomSearch,
    scopedListingId,
    activeTagFilters,
    replyDraft,
    selectedMessageIds,
    isLoading,
    hasLoaded,
    beginLoad,
    // derived
    roomGroups,
    listingCardGroups,
    filteredRoomGroups,
    activeListingId,
    activeListing,
    activeRooms,
    activeListingRooms,
    availableTags,
    allRooms,
    selectedRoom,
    selectedRoomMessages,
    selectedMessages,
    roomTasks,
    totalUnread,
    // lookups
    messagesFor,
    unreadFor,
    roomById,
    membersOf,
    lastMessagePreview,
    lastMessageAt,
    unreadForListing,
    isMine,
    listingIdForName,
    // actions
    selectRoom,
    focusRoom,
    selectListing,
    toggleTagFilter,
    clearTagFilters,
    clearRoomFilters,
    markRoomRead,
    sendInternalMessage,
    retryInternalMessage,
    discardFailedMessage,
    forwardToRooms,
    postTaskNotice,
    toggleMessageSelection,
    clearMessageSelection,
    refsFromGuestMessages,
    refsFromInternalMessages,
  }
}
