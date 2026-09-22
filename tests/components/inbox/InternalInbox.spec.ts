// Render tests for internal staff messaging. The rules are covered in
// tests/lib/internal-inbox.spec.ts and tests/composables/useInternalInbox.spec.ts;
// what is asserted here is that the room tree, the thread and the forward
// dialog actually render their data and write it back through the composable.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GENERAL_ROOM_KEY, roomIdFor } from '~/components/inbox/data/internal'
import ForwardDialog from '~/components/inbox/ForwardDialog.vue'
import ImageViewer from '~/components/inbox/ImageViewer.vue'
import ForwardedCard from '~/components/inbox/internal/ForwardedCard.vue'
import ListingCard from '~/components/inbox/internal/ListingCard.vue'
import InternalNav from '~/components/inbox/internal/Nav.vue'
import RoomList from '~/components/inbox/internal/RoomList.vue'
import RoomMembers from '~/components/inbox/internal/RoomMembers.vue'
import RoomMessage from '~/components/inbox/internal/RoomMessage.vue'
import RoomThread from '~/components/inbox/internal/RoomThread.vue'
import MessageContextMenu from '~/components/inbox/MessageContextMenu.vue'
import ThreadMessage from '~/components/inbox/ThreadMessage.vue'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Skeleton } from '~/components/ui/skeleton'
import { Textarea } from '~/components/ui/textarea'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useImageViewer } from '~/composables/useImageViewer'
import { useInbox } from '~/composables/useInbox'
import { useInternalInbox } from '~/composables/useInternalInbox'
import { useMessageActions } from '~/composables/useMessageActions'
import { useTaskStore } from '~/composables/useTaskStore'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

const HOUSEKEEPING_LST1 = roomIdFor('lst-1', 'role-housekeeping')
const GENERAL_LST1 = roomIdFor('lst-1', GENERAL_ROOM_KEY)

// The shadcn primitives are registered for real: an unresolved component
// renders as a bare tag, which makes every value assertion pass vacuously.
const components = {
  // Registered under the names Nuxt auto-imports them as. A component that
  // does not resolve renders as a bare tag and drops its slot content, which
  // makes every text assertion below pass vacuously.
  InboxMessageContextMenu: MessageContextMenu,
  InboxInternalForwardedCard: ForwardedCard,
  InboxInternalRoomMessage: RoomMessage,
  InboxInternalListingCard: ListingCard,
  Avatar,
  AvatarFallback,
  Badge,
  Input,
  Label,
  ScrollArea,
  Skeleton,
  Textarea,
}

const stubs = {
  Icon: { props: ['name'], template: '<i :data-icon="name" />' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  // Re-emitting click would double-fire: the parent's own handler already
  // falls through onto the stub's root button.
  Button: { props: ['variant', 'size', 'disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  Separator: true,
  Popover: { template: '<div><slot /></div>' },
  PopoverTrigger: { template: '<div><slot /></div>' },
  PopoverContent: { template: '<div><slot /></div>' },
  // reka-ui's context menu only mounts its content on a real right-click
  // through a portal; the menu's own behaviour is asserted directly.
  ContextMenu: { template: '<div><slot /></div>' },
  ContextMenuTrigger: { template: '<div><slot /></div>' },
  ContextMenuContent: { template: '<div><slot /></div>' },
  ContextMenuItem: { template: '<button @click="$emit(\'select\')"><slot /></button>' },
  ContextMenuSeparator: true,
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2><slot /></h2>' },
  DialogDescription: { template: '<p><slot /></p>' },
  DialogFooter: { template: '<div><slot /></div>' },
}

function mountWith(component: unknown, options: Record<string, unknown> = {}) {
  return mount(component as never, {
    ...options,
    global: { components, stubs, ...(options.global as object ?? {}) },
  })
}

beforeEach(() => {
  useCurrentDashboardUser().setCurrentUserId('user-1')
})

describe('room list', () => {
  it('lists the rooms of the open listing and marks your own', () => {
    const wrapper = mountWith(RoomList)
    expect(wrapper.text()).toContain('Housekeeping')
    expect(wrapper.text()).toContain('General')
    // Komang is a Guest Experience Manager, so that room is theirs.
    expect(wrapper.text()).toContain('Guest Experience Manager')
    expect(wrapper.text()).toContain('You')
  })

  it('marks a photo-only room preview with an icon, never an emoji', async () => {
    const internal = useInternalInbox()
    internal.sendInternalMessage(GENERAL_LST1, '', { mediaUrl: 'blob:tap' })
    const wrapper = mountWith(RoomList)

    const row = wrapper.findAll('button').find(b => b.text().includes('Photo'))!
    expect(row.find('[data-icon="lucide:camera"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('\u{1F4F7}')
  })

  it('shows an unread count for a room with messages from other people', () => {
    const wrapper = mountWith(RoomList)
    // The room's latest message is Made Surya's forward, so that is its preview.
    const row = wrapper.findAll('button').find(b => b.text().includes('take the pool'))!
    expect(row.text()).toContain('3')
  })

  it('selects a room and clears its unread count', async () => {
    const wrapper = mountWith(RoomList)
    const { selectedRoomId, unreadFor } = useInternalInbox()
    const row = wrapper.findAll('button').find(b => b.text().includes('take the pool'))!
    await row.trigger('click')
    expect(selectedRoomId.value).toBe(HOUSEKEEPING_LST1)
    expect(unreadFor(HOUSEKEEPING_LST1)).toBe(0)
  })

  it('names the open listing in its header and shows only that listing rooms', () => {
    const wrapper = mountWith(RoomList)
    expect(wrapper.text()).toContain('Villa Luwa')
    expect(wrapper.text()).not.toContain('Apartments Pool')
  })

  it('moves the thread and the room panel onto the new listing too', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    const thread = mountWith(RoomThread)
    const panel = mountWith(RoomMembers)
    expect(thread.text()).toContain('Villa Luwa')

    internal.selectListing('lst-4')
    await thread.vm.$nextTick()
    await panel.vm.$nextTick()

    // All three panels agree on the property, instead of the thread and the
    // room panel still showing the listing you just left.
    expect(thread.text()).toContain('Merapi')
    expect(thread.text()).not.toContain('Villa Luwa')
    expect(panel.text()).toContain('Merapi')
    expect(panel.text()).not.toContain('Villa Luwa')
  })

  it('follows the nav when another listing is opened', async () => {
    const wrapper = mountWith(RoomList)
    useInternalInbox().selectListing('lst-4')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Merapi')
    expect(wrapper.text()).not.toContain('Villa Luwa')
  })

  it('offers a way out when the filters match nothing', async () => {
    const internal = useInternalInbox()
    internal.roomSearch.value = 'nothing matches this'
    const wrapper = mountWith(RoomList)
    expect(wrapper.text()).toContain('No listings match these filters')
    await wrapper.findAll('button').find(b => b.text() === 'Clear filters')!.trigger('click')
    expect(internal.roomSearch.value).toBe('')
  })
})

describe('room thread', () => {
  it('asks for a room before it shows one', () => {
    expect(mountWith(RoomThread).text()).toContain('Select a room')
  })

  it('renders the room header, its members and its messages', () => {
    useInternalInbox().selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomThread)
    expect(wrapper.text()).toContain('Housekeeping')
    expect(wrapper.text()).toContain('5BR Pool the R Villa Luwa')
    expect(wrapper.text()).toContain('Checkout at 11:00 today')
    expect(wrapper.text()).toContain('Ni Putu Sari')
  })

  it('says out loud that a room is not visible to guests', () => {
    useInternalInbox().selectRoom(GENERAL_LST1)
    expect(mountWith(RoomThread).text()).toContain('Guests never see this')
  })

  it('sends the draft into the open room and clears the composer', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(GENERAL_LST1)
    const wrapper = mountWith(RoomThread)
    const before = internal.messagesFor(GENERAL_LST1).length

    await wrapper.find('textarea').setValue('Pump service tomorrow.')
    await wrapper.findAll('button').find(b => b.text().includes('Send'))!.trigger('click')

    expect(internal.messagesFor(GENERAL_LST1)).toHaveLength(before + 1)
    expect(internal.messagesFor(GENERAL_LST1).at(-1)!.content).toBe('Pump service tomorrow.')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('refuses to send an empty draft', () => {
    useInternalInbox().selectRoom(GENERAL_LST1)
    const wrapper = mountWith(RoomThread)
    const send = wrapper.findAll('button').find(b => b.text().includes('Send'))!
    expect(send.attributes('disabled')).toBeDefined()
  })

  it('shows the selection bar only once something is selected, and opens the forward dialog from it', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomThread)
    expect(wrapper.text()).not.toContain('selected')

    internal.toggleMessageSelection('imsg-seed-1')
    internal.toggleMessageSelection('imsg-seed-2')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('2 selected')

    await wrapper.findAll('button').find(b => b.text().includes('Forward'))!.trigger('click')
    const { forwardRequest } = useMessageActions()
    expect(forwardRequest.value?.refs).toHaveLength(2)
    // A room never offers itself as a forward target.
    expect(forwardRequest.value?.excludeRoomId).toBe(HOUSEKEEPING_LST1)
  })

  it('carries the room listing into a task raised from the selection', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomThread)
    internal.toggleMessageSelection('imsg-seed-1')
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text().includes('Create task'))!.trigger('click')
    const { taskRequest } = useMessageActions()
    expect(taskRequest.value).toMatchObject({
      roomId: HOUSEKEEPING_LST1,
      assignee: 'housekeeping',
    })
    expect(taskRequest.value?.listingName).toContain('Villa Luwa')
  })

  it('attaches a photo, previews it, and can take it back off', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(GENERAL_LST1)
    const wrapper = mountWith(RoomThread)

    expect(wrapper.find('[aria-label="Attach a photo"]').exists()).toBe(true)
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('image/*')
    expect(wrapper.find('[data-testid="composer-photo"]').exists()).toBe(false)

    // Stand in for the file picker: jsdom has no real File to hand over.
    wrapper.vm.attachedImage = 'blob:leaking-tap'
    wrapper.vm.attachedImageDims = '1280 × 960'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="composer-photo"]').attributes('src')).toBe('blob:leaking-tap')
    expect(wrapper.text()).toContain('1280 × 960')

    await wrapper.find('[aria-label="Remove photo"]').trigger('click')
    expect(wrapper.find('[data-testid="composer-photo"]').exists()).toBe(false)
  })

  it('sends a photo with no caption, and clears the composer after', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(GENERAL_LST1)
    const wrapper = mountWith(RoomThread)
    const before = internal.messagesFor(GENERAL_LST1).length

    wrapper.vm.attachedImage = 'blob:leaking-tap'
    wrapper.vm.attachedImageDims = '1280 × 960'
    await wrapper.vm.$nextTick()

    const send = wrapper.findAll('button').find(b => b.text().includes('Send'))!
    expect(send.attributes('disabled')).toBeUndefined()
    await send.trigger('click')

    expect(internal.messagesFor(GENERAL_LST1)).toHaveLength(before + 1)
    expect(internal.messagesFor(GENERAL_LST1).at(-1)).toMatchObject({
      content: '',
      mediaUrl: 'blob:leaking-tap',
      mediaDims: '1280 × 960',
    })
    expect(wrapper.find('[data-testid="composer-photo"]').exists()).toBe(false)
  })

  it('drops an attached photo when the room changes', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(GENERAL_LST1)
    const wrapper = mountWith(RoomThread)
    wrapper.vm.attachedImage = 'blob:leaking-tap'
    await wrapper.vm.$nextTick()

    internal.selectRoom(HOUSEKEEPING_LST1)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="composer-photo"]').exists()).toBe(false)
  })

  it('shows and cancels a draft reply', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomThread)
    internal.replyDraft.value = { messageId: 'imsg-seed-1', senderName: 'Ni Putu Sari', excerpt: 'Checkout at 11:00' }
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Replying to Ni Putu Sari')

    await wrapper.find('[aria-label="Cancel reply"]').trigger('click')
    expect(internal.replyDraft.value).toBeNull()
  })
})

describe('room message', () => {
  const room = {
    id: HOUSEKEEPING_LST1,
    listingId: 'lst-1',
    listingName: 'Villa Luwa',
    roomKey: 'role-housekeeping' as const,
    name: 'Housekeeping',
    memberIds: ['user-7'],
  }

  function message(patch: Record<string, unknown> = {}) {
    return {
      id: 'imsg-x',
      roomId: HOUSEKEEPING_LST1,
      authorId: 'user-7',
      authorName: 'Ketut Antara',
      authorInitials: 'KA',
      authorRole: 'Housekeeping',
      content: 'Towels are low.',
      createdAt: new Date().toISOString(),
      ...patch,
    }
  }

  it('renders the author, their role and the text', () => {
    const wrapper = mountWith(RoomMessage, { props: { message: message(), room } })
    expect(wrapper.text()).toContain('Ketut Antara')
    expect(wrapper.text()).toContain('Housekeeping')
    expect(wrapper.text()).toContain('Towels are low.')
  })

  it('renders a forwarded guest message with its own context, not the room', () => {
    const wrapper = mountWith(RoomMessage, {
      props: {
        room,
        message: message({
          content: '',
          forwarded: [{
            sourceId: 'msg-1',
            sourceKind: 'guest',
            conversationId: 'conv-1',
            contextLabel: 'Anna Schmidt · Villa Luwa',
            senderName: 'Anna Schmidt',
            senderLabel: 'Guest',
            content: 'The AC is blowing warm air.',
            timestamp: '2026-09-20T10:00:00Z',
            channel: 'WhatsApp',
          }],
        }),
      },
    })
    expect(wrapper.text()).toContain('Anna Schmidt')
    expect(wrapper.text()).toContain('The AC is blowing warm air.')
    expect(wrapper.text()).toContain('via WhatsApp')
    expect(wrapper.text()).toContain('Open thread')
  })

  it('renders an attached photo inside the bubble, with its dimensions', () => {
    const wrapper = mountWith(RoomMessage, {
      props: {
        room,
        message: message({ content: '', mediaUrl: 'blob:leaking-tap', mediaDims: '1280 × 960' }),
      },
    })
    expect(wrapper.find('img').attributes('src')).toBe('blob:leaking-tap')
    expect(wrapper.text()).toContain('1280 × 960')
  })

  it('renders a forward from somebody else on the left, with their name and role', () => {
    const wrapper = mountWith(RoomMessage, {
      props: {
        room,
        message: message({
          authorId: 'user-2',
          authorName: 'Made Surya',
          authorInitials: 'MS',
          authorRole: 'Listing Manager',
          content: 'Can someone take the pool before the next check-in?',
          forwarded: [{
            sourceId: 'msg-18-2',
            sourceKind: 'guest',
            conversationId: 'conv-18',
            contextLabel: 'Lucas Müller · Villa Luwa',
            senderName: 'Lucas Müller',
            senderLabel: 'Guest',
            content: 'The pool is dirty.',
            timestamp: '2026-09-20T10:00:00Z',
            channel: 'Airbnb',
          }],
        }),
      },
    })
    // Their name, not "You", and an avatar beside it.
    expect(wrapper.text()).toContain('Made Surya')
    expect(wrapper.text()).toContain('Listing Manager')
    expect(wrapper.text()).not.toContain('You')
    expect(wrapper.find('.justify-start').exists()).toBe(true)
    // The quoted guest keeps their own identity inside it.
    expect(wrapper.text()).toContain('Lucas Müller')
    expect(wrapper.text()).toContain('Guest')
    expect(wrapper.text()).toContain('via Airbnb')
  })

  it('gives the forwarded card its own surface and text colour, not the bubble\'s', () => {
    // `text-primary-foreground` is a near-white in ten of the eleven themes, so
    // a card that inherits it from an own-message bubble is unreadable.
    const wrapper = mountWith(RoomMessage, {
      props: {
        room,
        message: message({
          authorId: 'user-1',
          forwarded: [{
            sourceId: 'msg-1',
            sourceKind: 'guest',
            contextLabel: 'Anna · Villa One',
            senderName: 'Anna',
            senderLabel: 'Guest',
            content: 'The AC is broken.',
            timestamp: '2026-09-20T10:00:00Z',
          }],
        }),
      },
    })
    const card = wrapper.findComponent(ForwardedCard).find('div')
    expect(card.classes()).toContain('bg-card')
    expect(card.classes()).toContain('text-card-foreground')
    expect(card.classes().join(' ')).not.toContain('bg-background/60')
  })

  it('shows a spinner on the photo and an upload line while it is in flight', () => {
    const wrapper = mountWith(RoomMessage, {
      props: {
        room,
        message: message({ content: '', mediaUrl: 'blob:tap', sendStatus: 'sending' }),
      },
    })
    expect(wrapper.find('[data-testid="photo-uploading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Uploading photo')
  })

  it('says Sending for a message with no photo', () => {
    const wrapper = mountWith(RoomMessage, {
      props: { room, message: message({ sendStatus: 'sending' }) },
    })
    expect(wrapper.text()).toContain('Sending')
    expect(wrapper.text()).not.toContain('Uploading photo')
    expect(wrapper.find('[data-testid="photo-uploading"]').exists()).toBe(false)
  })

  /**
   * A real failed message in the store, so Retry and Discard can be asserted
   *  by their effect rather than by spying on a composable the component
   *  resolves for itself.
   */
  function postFailed(mediaUrl?: string) {
    const internal = useInternalInbox()
    vi.useFakeTimers()
    internal.sendInternalMessage(HOUSEKEEPING_LST1, 'This will error', { mediaUrl })
    vi.advanceTimersByTime(3000)
    vi.useRealTimers()
    const posted = internal.messagesFor(HOUSEKEEPING_LST1).at(-1)!
    expect(posted.sendStatus).toBe('failed')
    return { internal, posted, room: internal.roomById(HOUSEKEEPING_LST1)! }
  }

  it('names the photo on a failed photo message', () => {
    const { posted, room: realRoom } = postFailed('blob:tap')
    const wrapper = mountWith(RoomMessage, { props: { room: realRoom, message: posted } })
    expect(wrapper.text()).toContain('Photo failed to send')
  })

  it('puts a failed message back on the wire from Retry', async () => {
    const { internal, posted, room: realRoom } = postFailed('blob:tap')
    const wrapper = mountWith(RoomMessage, { props: { room: realRoom, message: posted } })

    await wrapper.findAll('button').find(b => b.text() === 'Retry')!.trigger('click')
    const after = internal.messagesFor(HOUSEKEEPING_LST1).find(m => m.id === posted.id)!
    expect(after.sendStatus).toBe('sending')
    // The photo survives the retry: it cannot be recovered by retyping.
    expect(after.mediaUrl).toBe('blob:tap')
  })

  it('removes a failed message from the room on Discard', async () => {
    const { internal, posted, room: realRoom } = postFailed()
    const before = internal.messagesFor(HOUSEKEEPING_LST1).length
    const wrapper = mountWith(RoomMessage, { props: { room: realRoom, message: posted } })

    await wrapper.findAll('button').find(b => b.text() === 'Discard')!.trigger('click')
    expect(internal.messagesFor(HOUSEKEEPING_LST1)).toHaveLength(before - 1)
    expect(internal.messagesFor(HOUSEKEEPING_LST1).some(m => m.id === posted.id)).toBe(false)
  })

  it('says Failed to send on a text message, without mentioning a photo', () => {
    const wrapper = mountWith(RoomMessage, {
      props: { room, message: message({ sendStatus: 'failed' }) },
    })
    expect(wrapper.text()).toContain('Failed to send')
    expect(wrapper.text()).not.toContain('Photo failed')
  })

  it('shows no status line at all on a delivered message', () => {
    const wrapper = mountWith(RoomMessage, {
      props: { room, message: message({ sendStatus: 'sent' }) },
    })
    expect(wrapper.text()).not.toContain('Sending')
    expect(wrapper.text()).not.toContain('Failed to send')
  })

  it('replaces a photo that cannot load with a stated placeholder', async () => {
    const wrapper = mountWith(RoomMessage, {
      props: {
        room,
        message: message({ content: '', mediaUrl: 'blob:gone', mediaDims: '1280 × 960' }),
      },
    })
    expect(wrapper.find('[data-testid="photo-unavailable"]').exists()).toBe(false)

    await wrapper.find('img').trigger('error')
    expect(wrapper.find('[data-testid="photo-unavailable"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Photo unavailable')
    // The dimensions of a photo nobody can see are noise.
    expect(wrapper.text()).not.toContain('1280 × 960')
  })

  it('renders a task notice as a record with no context menu around it', () => {
    const wrapper = mountWith(RoomMessage, {
      props: {
        room,
        message: message({
          content: '',
          systemKind: 'task_created',
          taskRef: { id: 'TASK-1234', title: 'Fix the AC' },
        }),
      },
    })
    expect(wrapper.text()).toContain('opened task')
    expect(wrapper.text()).toContain('TASK-1234')
    expect(wrapper.findComponent(MessageContextMenu).exists()).toBe(false)
  })

  it('names the selection checkbox so it is reachable without sight of the tick', async () => {
    const internal = useInternalInbox()
    internal.selectRoom(HOUSEKEEPING_LST1)
    internal.toggleMessageSelection('imsg-x')
    const wrapper = mountWith(RoomMessage, { props: { message: message(), room } })
    expect(wrapper.find('[aria-label="Remove from selection"]').exists()).toBe(true)

    await wrapper.find('[aria-label="Remove from selection"]').trigger('click')
    expect(internal.selectedMessageIds.value).toEqual([])
  })
})

describe('forward dialog', () => {
  const refs = [{
    sourceId: 'msg-1',
    sourceKind: 'guest' as const,
    conversationId: 'conv-1',
    contextLabel: 'Anna Schmidt · Villa Luwa',
    senderName: 'Anna Schmidt',
    senderLabel: 'Guest',
    content: 'The AC is blowing warm air.',
    timestamp: '2026-09-20T10:00:00Z',
  }]

  it('stays shut until something asks to forward', () => {
    expect(mountWith(ForwardDialog).text()).toBe('')
  })

  it('previews what is being forwarded and lists rooms to send it to', async () => {
    const wrapper = mountWith(ForwardDialog)
    useMessageActions().openForward({ refs })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Forward 1 message')
    expect(wrapper.text()).toContain('The AC is blowing warm air.')
    expect(wrapper.text()).toContain('Housekeeping')
  })

  it('puts the source listing first, so the likely answer is not scrolled to', async () => {
    const wrapper = mountWith(ForwardDialog)
    useMessageActions().openForward({ refs, preferListingId: 'lst-4' })
    await wrapper.vm.$nextTick()
    const headers = wrapper.findAll('.uppercase').map(h => h.text())
    expect(headers[0]).toContain('Merapi')
  })

  it('never offers the room the message came from', async () => {
    // Several listings run a Housekeeping room, so the exclusion is counted
    // rather than asserted absent by name.
    const open = mountWith(ForwardDialog)
    const actions = useMessageActions()
    actions.openForward({ refs })
    await open.vm.$nextTick()
    const all = open.findAll('[class*="cursor-pointer"]').length

    actions.closeForward()
    await open.vm.$nextTick()
    actions.openForward({ refs, excludeRoomId: HOUSEKEEPING_LST1 })
    await open.vm.$nextTick()
    expect(open.findAll('[class*="cursor-pointer"]')).toHaveLength(all - 1)
  })

  it('cannot forward to nowhere', async () => {
    const wrapper = mountWith(ForwardDialog)
    useMessageActions().openForward({ refs })
    await wrapper.vm.$nextTick()
    const send = wrapper.findAll('button').find(b => b.text() === 'Forward')!
    expect(send.attributes('disabled')).toBeDefined()
  })

  it('writes one message per picked room and closes', async () => {
    const internal = useInternalInbox()
    const wrapper = mountWith(ForwardDialog)
    const { openForward, forwardRequest } = useMessageActions()
    openForward({ refs })
    await wrapper.vm.$nextTick()

    const before = internal.messagesFor(HOUSEKEEPING_LST1).length
    // lst-1 leads the group order, so its Housekeeping room is the first match.
    const row = wrapper.findAll('[class*="cursor-pointer"]')
      .find(r => r.text().startsWith('Housekeeping') && !r.text().startsWith('Housekeeping Manager'))!
    await row.trigger('click')
    await wrapper.find('textarea').setValue('Please take a look.')
    await wrapper.findAll('button').find(b => b.text() === 'Forward')!.trigger('click')

    expect(internal.messagesFor(HOUSEKEEPING_LST1)).toHaveLength(before + 1)
    const posted = internal.messagesFor(HOUSEKEEPING_LST1).at(-1)!
    expect(posted.content).toBe('Please take a look.')
    expect(posted.forwarded?.[0]!.content).toBe('The AC is blowing warm air.')
    expect(forwardRequest.value).toBeNull()
  })

  it('forgets the previous targets and note when reopened', async () => {
    const wrapper = mountWith(ForwardDialog)
    const { openForward, closeForward } = useMessageActions()
    openForward({ refs })
    await wrapper.vm.$nextTick()
    await wrapper.find('textarea').setValue('first note')
    closeForward()
    await wrapper.vm.$nextTick()

    openForward({ refs })
    await wrapper.vm.$nextTick()
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.text()).toContain('0 selected')
  })
})

describe('room members panel', () => {
  const LISTING = '5BR Pool the R Villa Luwa – Serene near Canggu'

  it('lists the people in the room', () => {
    useInternalInbox().selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomMembers)
    expect(wrapper.text()).toContain('Ketut Antara')
    expect(wrapper.text()).toContain('Housekeeping')
  })

  it('links out to the listing itself', () => {
    useInternalInbox().selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomMembers)
    expect(wrapper.find('a[href="/listings/lst-1"]').exists()).toBe(true)
  })

  it('no longer sends you to the other rooms from here', () => {
    useInternalInbox().selectRoom(HOUSEKEEPING_LST1)
    expect(mountWith(RoomMembers).text()).not.toContain('Other rooms here')
  })

  it('shows only the tasks that fall to the room role', () => {
    const { tasks } = useTaskStore()
    tasks.value = [
      { id: 'T-HK', title: 'Deep clean the villa', status: 'todo', priority: 'high', listing: LISTING, assignee: 'housekeeping', assigneeType: 'role' },
      { id: 'T-MT', title: 'Fix the AC', status: 'todo', priority: 'high', listing: LISTING, assignee: 'maintenance', assigneeType: 'role' },
    ]
    useInternalInbox().selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomMembers)

    expect(wrapper.text()).toContain('Housekeeping tasks')
    expect(wrapper.text()).toContain('Deep clean the villa')
    expect(wrapper.text()).not.toContain('Fix the AC')
    expect(wrapper.text()).toContain('1 open')
  })

  it('shows every task at the listing in General, the room everybody is in', () => {
    const { tasks } = useTaskStore()
    tasks.value = [
      { id: 'T-HK', title: 'Deep clean the villa', status: 'todo', priority: 'high', listing: LISTING, assignee: 'housekeeping', assigneeType: 'role' },
      { id: 'T-MT', title: 'Fix the AC', status: 'todo', priority: 'high', listing: LISTING, assignee: 'maintenance', assigneeType: 'role' },
    ]
    useInternalInbox().selectRoom(GENERAL_LST1)
    const wrapper = mountWith(RoomMembers)

    expect(wrapper.text()).toContain('Tasks at this listing')
    expect(wrapper.text()).toContain('Deep clean the villa')
    expect(wrapper.text()).toContain('Fix the AC')
  })

  it('points at the way to raise one when a role has no tasks', () => {
    useTaskStore().tasks.value = []
    useInternalInbox().selectRoom(HOUSEKEEPING_LST1)
    expect(mountWith(RoomMembers).text()).toContain('No tasks fall to this role')
  })

  it('opens the tasks page from a task row', () => {
    const { tasks } = useTaskStore()
    tasks.value = [
      { id: 'T-HK', title: 'Deep clean the villa', status: 'todo', priority: 'high', listing: LISTING, assignee: 'housekeeping', assigneeType: 'role' },
    ]
    useInternalInbox().selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomMembers)
    expect(wrapper.find('a[href="/tasks"]').exists()).toBe(true)
  })
})

describe('message context menu', () => {
  it('names the single-message actions when nothing is selected', () => {
    const wrapper = mountWith(MessageContextMenu, { props: { kind: 'guest' } })
    expect(wrapper.text()).toContain('Forward to room')
    expect(wrapper.text()).toContain('Create task')
    expect(wrapper.text()).toContain('Select messages')
  })

  it('says out loud that the actions apply to the selection, not the clicked message', () => {
    const wrapper = mountWith(MessageContextMenu, {
      props: { kind: 'guest', selectionMode: true, isSelected: true, selectedCount: 3 },
    })
    expect(wrapper.text()).toContain('Forward 3 messages')
    expect(wrapper.text()).toContain('Create task from 3 messages')
    expect(wrapper.text()).toContain('Remove from selection')
  })

  it('offers Reply only inside a room', () => {
    expect(mountWith(MessageContextMenu, { props: { kind: 'guest' } }).text()).not.toContain('Reply')
    expect(mountWith(MessageContextMenu, { props: { kind: 'internal' } }).text()).toContain('Reply')
  })

  it('withholds Reply once a selection is running, because a quote of four messages is not a reply', () => {
    const wrapper = mountWith(MessageContextMenu, {
      props: { kind: 'internal', selectionMode: true, isSelected: true, selectedCount: 2 },
    })
    expect(wrapper.text()).not.toContain('Reply')
  })
})

describe('guest thread message', () => {
  const guestMessage = {
    id: 'msg-guest-1',
    conversationId: 'conv-1',
    sender: 'guest' as const,
    senderName: 'Anna Schmidt',
    content: 'The AC is blowing warm air.',
    channel: 'WhatsApp',
    timestamp: new Date().toISOString(),
  }

  beforeEach(() => {
    const inbox = useInbox()
    // The translation watcher is a 600ms timer and is not what is under test.
    inbox.autoTranslate.value = false
    inbox.selectedConversationId.value = 'conv-1'
    inbox.clearThreadSelection()
  })

  it('forwards with the guest and property as context, and opens on their listing', async () => {
    const wrapper = mountWith(ThreadMessage, { props: { message: guestMessage } })
    const menu = wrapper.findComponent(MessageContextMenu)
    await menu.vm.$emit('forward')

    const { forwardRequest } = useMessageActions()
    expect(forwardRequest.value?.refs).toHaveLength(1)
    expect(forwardRequest.value!.refs[0]).toMatchObject({
      sourceKind: 'guest',
      conversationId: 'conv-1',
      senderLabel: 'Guest',
      content: 'The AC is blowing warm air.',
    })
    // The label names the conversation's guest and property, not the message
    // sender: a staff reply forwarded on still has to say whose thread it is.
    expect(forwardRequest.value!.refs[0]!.contextLabel).toContain('Sarah Mitchell')
    // conv-1 is on a listing that resolves, so the picker opens on it.
    expect(forwardRequest.value?.preferListingId).toBeDefined()
  })

  it('seeds a task with the conversation listing', async () => {
    const wrapper = mountWith(ThreadMessage, { props: { message: guestMessage } })
    await wrapper.findComponent(MessageContextMenu).vm.$emit('task')

    const { taskRequest } = useMessageActions()
    expect(taskRequest.value?.refs).toHaveLength(1)
    expect(taskRequest.value?.listingName).toBeTruthy()
    // A guest thread has no room to report back into.
    expect(taskRequest.value?.roomId).toBeUndefined()
  })

  it('enters selection from the menu and shows a named checkbox', async () => {
    const inbox = useInbox()
    const wrapper = mountWith(ThreadMessage, { props: { message: guestMessage } })
    expect(wrapper.find('[aria-label="Add to selection"]').exists()).toBe(false)

    await wrapper.findComponent(MessageContextMenu).vm.$emit('startSelect')
    expect(inbox.selectedThreadMessageIds.value).toEqual(['msg-guest-1'])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="Remove from selection"]').exists()).toBe(true)
  })

  it('drops the selection when the conversation changes', async () => {
    const inbox = useInbox()
    mountWith(ThreadMessage, { props: { message: guestMessage } })
    inbox.toggleThreadMessageSelection('msg-guest-1')
    expect(inbox.threadSelectionMode.value).toBe(true)

    inbox.selectedConversationId.value = 'conv-2'
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(inbox.selectedThreadMessageIds.value).toEqual([])
    expect(inbox.threadSelectionMode.value).toBe(false)
  })

  it('leaves a system line outside the context menu', () => {
    const wrapper = mountWith(ThreadMessage, {
      props: { message: { ...guestMessage, sender: 'system', content: 'Reservation confirmed.' } },
    })
    expect(wrapper.text()).toContain('Reservation confirmed.')
    expect(wrapper.findComponent(MessageContextMenu).exists()).toBe(false)
  })
})

describe('listing card', () => {
  const group = {
    listingId: 'lst-1',
    listingName: '5BR Pool the R Villa Luwa',
    rooms: [],
    photo: 'https://example.test/villa.jpg',
    tags: ['Canggu', 'Pool'],
    roleCount: 4,
    memberCount: 6,
  }

  it('renders the photo, the name and the role count', () => {
    const wrapper = mountWith(ListingCard, { props: { group, selected: false, unread: 0 } })
    expect(wrapper.find('img').attributes('src')).toBe('https://example.test/villa.jpg')
    expect(wrapper.text()).toContain('5BR Pool the R Villa Luwa')
    expect(wrapper.text()).toContain('4 roles')
    expect(wrapper.text()).toContain('6 members')
  })

  it('falls back to a placeholder rather than a broken image', () => {
    const wrapper = mountWith(ListingCard, {
      props: { group: { ...group, photo: undefined }, selected: false, unread: 0 },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[data-icon="lucide:building-2"]').exists()).toBe(true)
  })

  it('says one role and one member in the singular', () => {
    const wrapper = mountWith(ListingCard, {
      props: { group: { ...group, roleCount: 1, memberCount: 1 }, selected: false, unread: 0 },
    })
    expect(wrapper.text()).toContain('1 role')
    expect(wrapper.text()).not.toContain('1 roles')
    expect(wrapper.text()).toContain('1 member')
    expect(wrapper.text()).not.toContain('1 members')
  })

  it('shows an unread badge only when something is unread', () => {
    expect(mountWith(ListingCard, { props: { group, selected: false, unread: 0 } }).text())
      .not
      .toContain('0')
    expect(mountWith(ListingCard, { props: { group, selected: false, unread: 3 } }).text())
      .toContain('3')
  })

  it('states its picked state for a screen reader, not just with a colour', () => {
    const on = mountWith(ListingCard, { props: { group, selected: true, unread: 0 } })
    expect(on.find('button').attributes('aria-pressed')).toBe('true')
    const off = mountWith(ListingCard, { props: { group, selected: false, unread: 0 } })
    expect(off.find('button').attributes('aria-pressed')).toBe('false')
  })

  it('emits when picked', async () => {
    const wrapper = mountWith(ListingCard, { props: { group, selected: false, unread: 0 } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })
})

describe('internal nav', () => {
  it('is a search, a tag button and a card per listing, with no rooms menu above them', () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    expect(wrapper.findAllComponents(ListingCard).length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('roles')
    expect(wrapper.text()).toContain('Tags')
    expect(wrapper.text()).not.toContain('All rooms')
    expect(wrapper.text()).not.toContain('Your rooms')
    expect(wrapper.text()).not.toContain('Unread')
  })

  it('opens the first listing before anything is clicked', () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    const cards = wrapper.findAllComponents(ListingCard)
    expect(cards[0]!.props('selected')).toBe(true)
    expect(cards[1]!.props('selected')).toBe(false)
  })

  it('opens a listing when its card is picked', async () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    const internal = useInternalInbox()
    const second = wrapper.findAllComponents(ListingCard)[1]!
    await second.find('button').trigger('click')
    expect(internal.activeListingId.value).toBe(second.props('group').listingId)
  })

  it('keeps a listing open when its card is clicked again', async () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    const internal = useInternalInbox()
    const second = wrapper.findAllComponents(ListingCard)[1]!
    const id = second.props('group').listingId
    await second.find('button').trigger('click')
    await second.find('button').trigger('click')
    expect(internal.activeListingId.value).toBe(id)
  })

  it('puts the tag button on the same row as the search field', () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    const row = wrapper.find('input').element.closest('div')!.parentElement!
    expect(row.querySelector('[data-icon="lucide:tag"]')).not.toBeNull()
  })

  it('offers the listing tags and narrows the cards with them', async () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    const internal = useInternalInbox()
    expect(wrapper.text()).toContain('Tags')

    const umalas = wrapper.findAll('div').find(d => d.text() === 'Umalas')
    expect(umalas).toBeDefined()
    await umalas!.trigger('click')
    expect(internal.activeTagFilters.value).toEqual(['Umalas'])
    await wrapper.vm.$nextTick()
    expect(wrapper.findAllComponents(ListingCard)).toHaveLength(1)
  })

  it('shows a picked tag as a chip that removes itself', async () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    const internal = useInternalInbox()
    internal.toggleTagFilter('Canggu')
    await wrapper.vm.$nextTick()

    const chip = wrapper.find('[aria-label="Remove tag Canggu"]')
    expect(chip.exists()).toBe(true)
    await chip.trigger('click')
    expect(internal.activeTagFilters.value).toEqual([])
  })

  it('says so when no listing survives the filters', async () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    useInternalInbox().roomSearch.value = 'nothing matches this at all'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No listings match these filters')
  })

  it('collapses to the listing photos alone, each still named for a screen reader', () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: true } })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAllComponents(ListingCard)).toHaveLength(0)
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons[0]!.attributes('aria-label')).toBeTruthy()
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
  })

  it('opens a listing from a collapsed photo', async () => {
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: true } })
    const internal = useInternalInbox()
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(internal.activeListingId.value).toBe(internal.listingCardGroups.value[1]!.listingId)
  })
})

describe('loading skeletons', () => {
  function whileLoading() {
    const internal = useInternalInbox()
    internal.isLoading.value = true
    return internal
  }

  it('stands in for the listing cards, not for the whole panel', () => {
    whileLoading()
    const wrapper = mountWith(InternalNav, { props: { isCollapsed: false } })
    expect(wrapper.find('[data-testid="nav-skeleton"]').exists()).toBe(true)
    expect(wrapper.findAllComponents(ListingCard)).toHaveLength(0)
    // Nothing half-real: the search and tag controls are placeholders too.
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('stands in for the room rows', () => {
    whileLoading()
    const wrapper = mountWith(RoomList)
    expect(wrapper.findAll('[data-testid="room-list-skeleton"]')).toHaveLength(5)
    expect(wrapper.text()).not.toContain('No listings match')
  })

  it('stands in for the thread and its composer', () => {
    const internal = whileLoading()
    internal.selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomThread)
    expect(wrapper.find('[data-testid="thread-skeleton"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Checkout at 11:00')
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('stands in for the room panel', () => {
    const internal = whileLoading()
    internal.selectRoom(HOUSEKEEPING_LST1)
    const wrapper = mountWith(RoomMembers)
    expect(wrapper.find('[data-testid="room-panel-skeleton"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Ketut Antara')
  })

  it('never shows a skeleton beside the real thing once loaded', () => {
    useInternalInbox().selectRoom(HOUSEKEEPING_LST1)
    expect(mountWith(InternalNav, { props: { isCollapsed: false } })
      .find('[data-testid="nav-skeleton"]').exists()).toBe(false)
    expect(mountWith(RoomList).find('[data-testid="room-list-skeleton"]').exists()).toBe(false)
    expect(mountWith(RoomThread).find('[data-testid="thread-skeleton"]').exists()).toBe(false)
    expect(mountWith(RoomMembers).find('[data-testid="room-panel-skeleton"]').exists()).toBe(false)
  })
})

describe('viewing a photo full size', () => {
  const room = {
    id: HOUSEKEEPING_LST1,
    listingId: 'lst-1',
    listingName: 'Villa Luwa',
    roomKey: 'role-housekeeping' as const,
    name: 'Housekeeping',
    memberIds: ['user-7'],
  }

  function photoMessage(patch: Record<string, unknown> = {}) {
    return {
      id: 'imsg-photo',
      roomId: HOUSEKEEPING_LST1,
      authorId: 'user-7',
      authorName: 'Ketut Antara',
      authorInitials: 'KA',
      authorRole: 'Housekeeping',
      content: 'Tap in room 3',
      createdAt: '2026-09-20T10:00:00Z',
      mediaUrl: 'blob:tap',
      mediaDims: '1280 × 960',
      ...patch,
    }
  }

  it('opens the photo with its sender, caption and dimensions', async () => {
    const wrapper = mountWith(RoomMessage, { props: { room, message: photoMessage() } })
    const open = wrapper.find('[aria-label="View photo: Tap in room 3"]')
    expect(open.exists()).toBe(true)

    await open.trigger('click')
    expect(useImageViewer().viewedImage.value).toMatchObject({
      url: 'blob:tap',
      senderName: 'Ketut Antara',
      caption: 'Tap in room 3',
      dims: '1280 × 960',
    })
  })

  it('credits your own photo to you rather than to your name', async () => {
    const wrapper = mountWith(RoomMessage, {
      props: { room, message: photoMessage({ authorId: 'user-1', authorName: 'Komang Juliantara' }) },
    })
    await wrapper.find('[aria-label="View photo: Tap in room 3"]').trigger('click')
    expect(useImageViewer().viewedImage.value?.senderName).toBe('You')
  })

  it('has nothing to open once the photo has failed to load', async () => {
    const wrapper = mountWith(RoomMessage, { props: { room, message: photoMessage() } })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('[aria-label="View photo: Tap in room 3"]').exists()).toBe(false)
    expect(useImageViewer().viewedImage.value).toBeNull()
  })

  it('opens a forwarded photo, crediting the original sender', async () => {
    const wrapper = mountWith(ForwardedCard, {
      props: {
        items: [{
          sourceId: 'msg-1',
          sourceKind: 'guest',
          conversationId: 'conv-18',
          contextLabel: 'Lucas Müller · Villa Luwa',
          senderName: 'Lucas Müller',
          senderLabel: 'Guest',
          content: 'The pool is dirty.',
          timestamp: '2026-09-20T10:00:00Z',
          mediaUrl: 'blob:pool',
        }],
      },
    })
    await wrapper.find('[aria-label="View photo from Lucas Müller"]').trigger('click')
    expect(useImageViewer().viewedImage.value).toMatchObject({
      url: 'blob:pool',
      senderName: 'Lucas Müller',
      caption: 'The pool is dirty.',
    })
  })

  it('stays shut until a photo is opened, and closes on request', async () => {
    const viewer = useImageViewer()
    const wrapper = mountWith(ImageViewer)
    expect(wrapper.find('[data-testid="image-viewer"]').exists()).toBe(false)

    viewer.openImage({ url: 'blob:tap', senderName: 'Ketut Antara', caption: 'Tap in room 3' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="image-viewer"]').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toBe('blob:tap')
    expect(wrapper.text()).toContain('Ketut Antara')
    expect(wrapper.text()).toContain('Tap in room 3')

    viewer.closeImage()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="image-viewer"]').exists()).toBe(false)
  })

  it('refuses to open nothing', () => {
    const viewer = useImageViewer()
    viewer.openImage({ url: '' })
    expect(viewer.viewedImage.value).toBeNull()
  })

  it('states it when the photo cannot load in the viewer either', async () => {
    const viewer = useImageViewer()
    const wrapper = mountWith(ImageViewer)
    viewer.openImage({ url: 'blob:gone' })
    await wrapper.vm.$nextTick()

    await wrapper.find('img').trigger('error')
    expect(wrapper.find('[data-testid="viewer-photo-unavailable"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Photo unavailable')
  })
})
