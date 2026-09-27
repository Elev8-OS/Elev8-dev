> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Internal Staff Messaging (`app/components/inbox/internal/` + `app/composables/useInternalInbox.ts`)

Staff talking to each other, addressed by **listing and role**, so a guest message can be
handed to "the housekeepers on Villa Merapi" and the answer read back in the same place.
A third inbox view (`inboxView === 'internal'`) alongside Conversations and Calls.

⚠️ **Rooms are DERIVED, never managed.** `buildRoomsForListing` opens a role room because
somebody with that role is assigned to that listing. Adding a user to a listing opens the room; removing the last one closes it.
There is deliberately no room CRUD, no membership screen and no archive: the source of
truth is `User.listingIds` + `User.roleId`, edited in Users, and a second place to manage
the same thing is a second place for it to be wrong. An **inactive** user is in no room.

⚠️ **There is no General room, deliberately.** The mobile app has no listing-wide room, and
the two must agree on which rooms exist, so every room is a role at a listing. Reaching
everybody at a property means forwarding to several rooms at once. Do not re-add one.

⚠️ **Visibility and membership are different things, and must stay different.** You **see**
every room on a listing you are assigned to; you are a **member** only of the room matching
your role. The whole feature is a guest-relations agent handing a broken AC to maintenance
and reading the reply, which is impossible if seeing a room requires being in it.
`isRoomMember` drives the "You" badge on a room row, nothing else.
⚠️ **An empty `User.listingIds` means the whole portfolio, not none of it**. Admins,
general managers and owners are seeded with no scope and would otherwise be locked out of
the feature they oversee (`visibleListingIdsFor`).

⚠️ **Exactly one listing is always open, and there is no "all listings" state.** The room
list is the roles at one property; rooms from four properties interleaved read as noise.
`activeListingId` is **derived, never stored**, so the view can never point at nothing:
nothing picked yet means the first listing, and a pick that a tag or a search has since
filtered away falls back to the first that survived instead of leaving the room list empty
with a listing selected. The pick itself is remembered, so clearing the filter restores it.
Clicking the open listing again closes any open room and returns to the listing overview;
it never toggles the listing off.

⚠️ **The open ROOM belongs to the open listing, and travels with it.**
`selectedRoom` resolves within `activeListingRooms` (the open listing's rooms), never
across the whole portfolio: switching listing used to leave the thread and the Room panel
showing a room from the property you had just left, so the four panels disagreed about
where you were.

⚠️ **Picking a listing opens NO room.** `selectListing` clears the open room (and the
draft reply and the selection); the thread reads "Select a room" and the side panel
becomes the **listing overview**: every member at the listing (`listingMembers`, once
each, in room order) and every task there whoever it is assigned to (`listingTasks` /
`tasksForListing`). A room opens only when it is clicked. The same blanking happens when
a tag or a search moves `activeListingId` on its own. The thread resolves against the
UNFILTERED rooms of the listing, so searching for another room does not blank the one you
are reading.

**A room is marked read when you click it, or post into it**, never by picking a listing.
`focusRoom(id, { markRead: false })` still exists for opening a room without reading it,
but nothing in the view calls it that way now.

#### Pure module (`app/components/inbox/data/internal.ts`, framework-free)
Same split as `gm-dashboard.ts` and `promo-code-form.ts`: the composable owns the reactive
state and calls in. `InternalRoom`, `InternalMessage`, `ForwardedRef`, `InternalReplyRef`;
`buildRoomsForListing` / `buildRoomGroups` / `filterRoomGroups` (search matches a listing
name **or** a room name, tags are ANDed, and a listing left with no rooms is dropped);
`tagsForGroups`; `tasksForRoom` / `isTaskOpen`;
`forwardRefFromGuestMessage` / `forwardRefFromInternalMessage`; `replyRefFrom`;
`previewLineFor`; `unreadCountFor`; `taskSeedFromRefs`; `taskAssigneeForRoom`.
Room ids are `room-<listingId>-<roleId>` (`roomIdFor`).

- **A photo travels with a forward.** `forwardRefFromInternalMessage` copies `mediaUrl`,
  because a maintenance photo is usually the whole reason the message is being handed on.
  `previewLineFor` answers `📷 Photo` for an uncaptioned one rather than a blank row.
- ⚠️ **A forward is a SNAPSHOT, frozen at forward time** (same rule as a folio catalog
  pick). `ForwardedRef.sourceId` is provenance, never a live join, and
  `sendInternalMessage` **copies** the refs rather than storing the caller's array: a
  later edit upstream must not rewrite what the room was asked to act on. A test asserts it.
- **Unread is "posted after I last opened the room, by somebody else."** Own messages never
  count, so sending into a quiet room cannot light up its own badge; posting also marks the
  room read for the same reason. Only `lastReadAt` per room is stored.
- ⚠️ **`taskAssigneeForRoom` returns `''` rather than guessing.** An unassigned task is one
  somebody has to pick up; a wrongly assigned one is one everybody assumes is handled. The
  Tasks module's `assigneeRoles` vocabulary is much shorter than `RoleId`, so several roles
  collapse onto `maintenance` / `housekeeping` and the rest map to nothing.
- ⚠️ **A guest conversation keys its property by NAME, not id** (`listingIdForName`), and
  only some mock names resolve. It answers `undefined` rather than guessing, and the
  forward dialog copes by simply not pre-sorting.

#### Composables
- **`useInternalInbox`**: `messagesByRoom` / `lastReadAt` / `selectedRoomId` / filters in
  `useState`, seeded by `buildSeedMessages()` (traffic on lst-1, lst-2 and lst-4 so the
  rooms are not empty on a cold load). Key exports: `roomGroups`, `listingCardGroups`,
  `filteredRoomGroups`, `activeListingId`, `activeListing`, `activeRooms`,
  `activeListingRooms`, `availableTags`,
  `selectedRoom`, `selectedRoomMessages`, `roomTasks`, `listingMembers`, `listingTasks`,
  `unreadFor`, `unreadForListing`,
  `totalUnread`, `selectRoom`, `focusRoom`, `selectListing`, `toggleTagFilter`,
  `clearRoomFilters`,
  `sendInternalMessage`, `forwardToRooms`, `membersOf`, `isMine`,
  `refsFromGuestMessages`, `refsFromInternalMessages`, message selection.
  **`forwardToRooms` writes one message PER room**, so a reply in one cannot bleed into
  another. `selectRoom` clears the selection and any draft reply, since both belong to the room
  they were made in.
- **`useMessageActions`**: just the two drafts (`forwardRequest`, `taskRequest`) and their
  open/close. Both threads raise the same dialogs, so `InboxForwardDialog` and
  `InboxCreateTaskDialog` are mounted **once** in `inbox/Layout.vue` rather than once per
  message.

#### Delivery state (`sendStatus`)

`InternalMessage.sendStatus?: 'sending' | 'sent' | 'failed'`, **absent** on anything already
delivered, so no seed needs migrating and a read message renders no status line.
`sendInternalMessage` posts as `sending` and `scheduleDelivery` resolves it against
`sendLatencyFor(hasPhoto)` and `shouldSendFail(content, roll)`.

- **A photo is given a visibly longer round trip** (`SEND_LATENCY_WITH_PHOTO_MS` 1800 vs
  `SEND_LATENCY_MS` 700). The state exists to cover the upload, and an instant spinner
  tells the sender nothing.
- ⚠️ **`shouldSendFail` takes the roll as an argument** rather than reading `Math.random`
  itself, so the failure path is reachable in a test without stubbing a global. Typing
  **`error`** forces a failure, which is the only way to demonstrate the state on purpose:
  a 12 percent chance is not something you can show someone.
- ⚠️ **A failed message keeps its place in the room.** Dropping it would lose what was
  typed, and a photo chosen from a file dialog cannot be recovered by retyping. It renders
  with a destructive ring plus **Retry** and **Discard**; `retryInternalMessage` puts it
  back on the wire unchanged, photo included. Both refuse anything that is not `failed`,
  so a message cannot be discarded mid-flight and leave its timer patching a row that is
  gone.
- **While sending**, the bubble dims and the spinner sits **on the photo**, not only in the
  status line, because the upload is what is taking the time. The line reads
  `Uploading photo…` with a photo and `Sending…` without.
- **Clicking a photo opens it full size** in `InboxImageViewer`, mounted once in
  `inbox/Layout.vue` and driven by `useImageViewer`. State lives in the composable so a
  photo inside a forwarded card can open it without reaching up through its parent.
  **Clicking the photo in the viewer zooms in 2.5x on the point clicked** (the frame then
  scrolls), clicking again fits it back, and each newly opened photo starts fitted.
  ⚠️ **The viewer is scoped**: `useImageViewer(scope = 'inbox')` and
  `<InboxImageViewer :scope>`. The inbox uses the default; the damage claim dialog
  (`damage-claim`) and the cleaning report (`cleaning-report`) each mount their own, so a
  photo opened in one can never also pop another that happens to be mounted. The
  photo is wrapped in a **button**, not a bare `img` with a handler, so it is reachable by
  keyboard and announces what it does; your own photo is credited to "You".
- **A photo that cannot load** falls back to a stated `Photo unavailable` placeholder via
  `@error` on the `img`, and its dimensions are withheld. The viewer carries the same
  fallback, since a thread reopened later can hand it a dead blob URL. A blob URL does not survive a
  reload, so a room reopened later would otherwise show a broken-image icon with no
  explanation.

⚠️ **No emoji as icons, anywhere.** An emoji renders at the mercy of the platform's emoji
font, ignores the theme tokens and takes no size or colour class. `previewLineFor` returns
`{ text, icon? }` with a **lucide name** rather than baking a glyph into the string, and the
room list renders the `Icon`; `ForwardDialog` and `useInbox.sendMessage` do the same for a
photo with no caption. Copy that shape when a preview string needs a visual marker. The
rest of the app still has emoji icons in places (the sentiment chips, the inbox call seed
data, the assistant suggestion chips); they are out of this module's scope but are worth a
sweep.

#### Real-time messages and notifications (`useInternalNotifications`)

A colleague's message is pushed at you as it arrives. ⚠️ **It never goes to the
notification bell**: there is no `INTERNAL_MESSAGE_*` alert type, on purpose. A room
message is a conversation happening now, not an alert to triage later.

- **`receiveInternalMessage(message)`** in `useInternalInbox` is the one entry point for
  incoming traffic. The mock reply calls it today; a websocket handler would call it in
  production. A room outside your scope is ignored. It appends the message, reads the room
  in place when you are looking at it (tab in front, Internal view open, that room open),
  then asks `notificationSurfaceFor` where it goes:

  | Where you are | Surface |
  |---|---|
  | Tab in the background (anywhere in the app) | **native** browser `Notification` |
  | Dashboard in front, Internal view open | **none**: the thread and badges already move |
  | Dashboard in front, anywhere else | **toast** (`toast.info` with an **Open** action) |

- **Every room you can SEE notifies**, not only the ones you are a member of
  (`shouldNotifyFor`): the feature is reading maintenance's answer without being
  maintenance. Your own messages never do.
- **One notification per room**: the toast `id` and the native `tag` are
  `internal-<roomId>`, so a new message replaces the last one from that room, and
  `notificationCopy` rolls the unread count up ("3 new messages in Housekeeping").
- **Open** (toast action or a click on the native notification) runs
  `openRoomFromNotification`: clears the room filters, switches to the Internal view via
  `useInboxView()` (split out of `useInbox` to avoid pulling in the whole guest inbox),
  opens that listing and room (read), and `navigateTo('/inbox')`. The native one also
  focuses the window.
- ⚠️ **A background tab without permission falls back to a toast.** Sonner holds its timer
  while the tab is hidden, so it is still there when you come back.
- **Permission is asked from a click only**: `RoomList.vue` shows a "Turn on" prompt while
  the browser answers `default`, and a note when it answers `denied`. A browser ignores a
  request no gesture started. `unsupported` (no Notification API) shows nothing.
- **Coming back to the tab** with a room open marks it read (`useDocumentVisibility` in
  `inbox/Layout.vue`); messages that landed while the tab was hidden stayed unread until
  then. `Layout.vue` also writes `internalViewOpen`, and clears it on unmount.
- **Mock colleague replies** (`scheduleSimulatedReply`): after your message is delivered,
  another member of the room answers it (quoting it) 8 to 15 s later, long enough to switch
  tabs and watch the native notification arrive. One reply per room at a time
  (`pendingReplyRooms`, module level), none in a room where nobody else sits.
  ⚠️ **`tests/setup.ts` turns `simulateReplies` off** so a spec that runs every timer never
  finds a stranger's message; the notification specs turn it back on.
- ⚠️ **Specs spy on the real `toast`**, not `vi.mock('vue-sonner')`: `tests/setup.ts`
  imports the room store before a spec's mocks register, so the composables hold the real
  module (`tests/composables/useInternalNotifications.spec.ts`).

#### The simulated first load

Entering the Internal view runs a mock fetch of the room tree
(`INTERNAL_LOAD_MS`, 900ms) behind skeletons in all four panels. Nothing is actually
fetched: the rooms are derived from stores already in memory.

- ⚠️ **`isLoading` starts FALSE, not true.** A default of "loading" would put every mounted
  component, and every existing test, into a skeleton it never leaves unless something
  advances a timer. `beginLoad()` is the explicit start.
- **It runs once per session** (`hasLoaded`). A second visit to the view reads what was
  already fetched, so re-running it would be a lie about where the data comes from. Reload
  the page to see it again. A second call mid-flight does not restart the clock.
- `inbox/Layout.vue` calls it from a `watch` on `inboxView`, so a host who never leaves
  Conversations never pays for it.
- **Each skeleton mirrors its own panel row for row** and lives next to the markup it
  stands in for, rather than in a shared file: a skeleton that does not match the real
  layout makes the content jump when it arrives. The thread's alternates sides so it reads
  as a conversation rather than a stack of bars. Nothing renders half-real, so the search
  field, the tag button and the composer are placeholders too.

#### Right-click actions (`InboxMessageContextMenu`, reka-ui `ContextMenu`)
One component for both threads; the only difference is that a room message can also be
replied to. Items: Reply (internal only) · Forward · Create task · Select messages /
Add-Remove from selection / Clear selection · Copy text.
- ⚠️ **Once a selection exists the actions run on the SELECTION, not on whatever was
  right-clicked, and the labels say so** ("Forward 3 messages"). Silently forwarding one
  message while four are ticked is the kind of thing nobody notices until the wrong person
  has been asked to fix the wrong thing.
- **Reply is withheld while a selection is running**: a quote of four messages is not a reply.
- A guest-thread **system line** (a system/ElevAI notice) renders **outside** the context
  menu entirely: there is nothing to forward, task or select. Rooms have no system lines.
- Guest-thread selection lives in `useInbox` (`selectedThreadMessageIds`), and
  `threadSelectionMode` is **derived from it, never its own flag**: a mode that can be on
  with nothing selected renders a bar reading "0 selected". It is cleared when the
  conversation changes.

#### Surfaces
- **`inbox/Layout.vue`**: the view toggle now labels **only the active view** and shows the
  other two as icon-only buttons with tooltips; three labels do not fit the filter panel.
  The Internal button carries the unread badge. Panel 1 is `InboxInternalNav`, and panels
  2/3/4 route to `InboxInternalRoomList` / `InboxInternalRoomThread` /
  `InboxInternalRoomMembers`.
- **`internal/Nav.vue`** is the listing picker: one search field with the **Tags** button
  beside it, removable chips for the picked tags, then a card per listing
  (**`internal/ListingCard.vue`**: cover photo, name, role count, member count, unread
  badge). There is deliberately **no All rooms / Your rooms / Unread menu** above it. The
  member count is the **union** of the rooms, not their sum, so nobody is counted twice.
  The role count equals the room count. Collapsed, the panel keeps the
  photos alone, each still carrying an `aria-label` and `aria-pressed`.
- **`internal/RoomList.vue`**: a flat list of the open listing's rooms, named in the panel
  header. It carries **no search of its own**, since the nav holds the only one, and no
  group headers, since every row belongs to the same listing.
  **`internal/RoomThread.vue`**: header with member avatars, messages, the selection bar,
  and a composer that states "Guests never see this". The composer takes a **photo** via a
  paperclip and a hidden `accept="image/*"` input, previews it above the textarea with a
  Remove button, and enables Send for a photo with no caption, since a photo of a broken
  tap usually says more than a caption would. The thread **pins itself to the newest
  message** on send and on a room change; reka-ui's ScrollArea moves an inner
  `[data-reka-scroll-area-viewport]`, not its own root, and without this a message you just
  sent lands below the fold, which is exactly when the delivery state needs to be visible. ⚠️ The preview carries
  `data-testid="composer-photo"`: `RoomMessage` falls back to the same
  `alt="Attached photo"` on an uncaptioned message, so an alt selector matches both the
  draft and the sent message. The object URL is deliberately **not** revoked on send, since
  the posted message is what renders it; it is dropped when the room changes.
  **`internal/RoomMessage.vue`** + **`internal/ForwardedCard.vue`** (a forwarded guest
  message keeps an "Open thread" link back to its conversation).
  **`internal/RoomMembers.vue`** has two modes. With a room open: the listing link, the
  room's members, and **the tasks this room answers for**. With only a listing open (the
  state right after picking one): header "Listing", every member at the listing, and
  **every task at the listing** ("Tasks at this listing"), which is the only place a
  person-assigned task shows. ⚠️ `tasksForRoom` matches on `Task.listing`, which stores a listing NAME,
  and on the Tasks module's own short `assigneeRoles` vocabulary via `taskAssigneeForRoom`;
  a room whose role has no equivalent there shows nothing rather than borrowing another
  role's work, and a task assigned to a **person** never lands in a role room. Open tasks
  sort first, then soonest due, undated last.
- **`ForwardDialog.vue`** is **multi-target on purpose**: a broken pump is housekeeping's
  problem and maintenance's at the same time, and asking the host to forward twice is how
  one of the two gets forgotten. It draws from **all** rooms in scope, never from the room
  list's own filters, and puts the source listing first. Checkbox rows are `div @click` +
  a custom visual, never a reka-ui `Checkbox` in a `<label>` (double-toggle).
- **`CreateTaskDialog.vue`** is a thin wrapper around **`tasks/NewTaskDialog.vue`**, the
  same New Task form the Tasks page opens (HostBuddy detection, owner approval, images), so
  there is no second, thinner task form. ⚠️ **The form has no Title and no Description
  field, only Instructions (required).** Instructions are stored in `Task.description`, and
  the title is their first line (`taskTitleFromInstructions` in `tasks/data/task-title.ts`).
  The messages are **copied into Instructions in full**, not linked: whoever picks the task
  up was not in the conversation. `taskSeedFromRefs` puts each message's **text first** and
  `(sender, role, 26 Aug 2026, 17:15)` after it (`readableTimestamp`, never raw ISO), so the
  first line, and so the title, is the problem rather than a name. Photos in the messages
  prefill the task's images.
- ⚠️ **Nothing is posted back into the room** when a task is created: there is no
  "<name> opened a task" line (removed on request). The task shows in the room panel's task
  list instead. `InternalMessage` has no `systemKind` / `taskRef`, and `TaskRequest` has no
  `roomId`.
- **Task cards open the task.** A task row in the room panel calls
  `useTaskDetail().openTaskDetailById`, and `inbox/Layout.vue` mounts the same
  `TasksTaskDetailSheet` the Tasks page uses, resolved against the live store so an update
  made in the sheet shows at once. ⚠️ **A task card never shows the task id**
  (`TASK-1234`): a task is named by its title.
- **Task statuses are Not started, In progress and Completed**, nothing else
  (`TASK_STATUSES` in `tasks/data/schema.ts`, a zod enum). `isTaskOpen` treats only
  Completed as closed. There is no Cancelled: an owner rejecting the quote deletes the task.

#### Tests
`tests/lib/internal-inbox.spec.ts` (69: derivation (no General room), notification surface and copy, the inactive-user rule, role ordering,
visibility vs. membership, ANDed tags and the listing scope, card photo / role count /
member count, snapshot labels, unread, task seeding, the assignee mapping and
`tasksForRoom`), `tests/composables/useInternalInbox.spec.ts` (64: which listing is open, picking a listing opens no room, the listing overview
and its fallbacks, sending, per-room forward messages, the frozen snapshot, unread,
selection, lookups), `tests/composables/useInternalNotifications.spec.ts` (17: surface per context, toast vs native vs none, read in place, open from a notification, permission, mock replies), `tests/components/inbox/InternalInbox.spec.ts` (90: the desktop alert prompt, the nav and its
cards, the room list, thread, the photo composer, the sending / failed / broken-photo
states with Retry and Discard asserted by their effect, forward dialog, the room panel's
members and tasks, the context-menu labels, and the guest-thread side).
⚠️ Retry and Discard cannot be asserted with `vi.spyOn` on the composable: the component
calls `useInternalInbox()` itself and gets fresh function references, so the test posts a
real failing message and checks the store instead.
⚠️ Components reach each other through Nuxt auto-imports, so they must be registered in
`global.components` **under the auto-import name** (`InboxInternalRoomMessage`, not
`RoomMessage`): an unresolved component renders as a bare tag and **drops its slot
content**, which makes every text assertion pass vacuously. ⚠️ A `Button` stub must not
re-emit `click`. ⚠️ `tests/setup.ts` exposes `useInbox`, `useInternalInbox`,
`useMessageActions`, `useUsers`, `useRoles` and `useTaskStore` globally for the same reason.
⚠️ Several listings run a room of the same name, so a test that picks "the Housekeeping
room" must scope by listing or count, not match on the name prefix (which also matches
"Housekeeping Manager").

#### NOT implemented (intentionally out of scope)
- **A real websocket**: incoming messages are the mock reply only; no presence, no typing
  indicator. State is `useState` and does not survive a reload (deliberately matching
  `useInbox`, which is also not persisted).
- **Web Push**: a native notification needs the dashboard open in some tab. Reaching a
  closed browser needs a service worker plus a push server.
- **A "new messages" pill** when scrolled up in the open room: the thread pins to the newest
  message on every new one.
- **Direct messages between two people**: every room is a listing plus a role. A one-to-one
  channel would need its own addressing and its own membership rules.
- **Pinch or wheel zoom, and stepping to the next photo in a room**: the viewer shows one
  photo, and a click toggles a single fixed zoom level.
- **Attachments beyond a single image**: no files, no video, no multiple photos per
  message, and the object URL does not survive a reload (the same mock boundary as the
  guest `ReplyBox`).
- **A real upload**: there is no progress percentage, no cancel mid-flight and no resume,
  because nothing is actually uploaded. `scheduleDelivery` is a timer.
- **A real fetch**: `beginLoad` is a timer over data already in memory, so there is no
  error state for the load itself, no retry and no per-room message fetch.
- **Reactions, editing or deleting a room message**.
- **Cross-tenant rooms**: rooms are derived from `listings`, which is already tenant-scoped;
  a GRO's `assignedTenantIds` is not consulted.
- **Forwarding a room message back into a guest thread**: deliberately one-way. A message
  written for colleagues is not a message written for a guest, and a one-click path from one
  to the other is how internal wording reaches the guest.
- **Per-room read receipts**: `lastReadAt` is the current user's own; nobody can see who
  else has read a message.
- **Filtering rooms by "mine" or "unread"**: the nav menu that offered those was removed;
  `isMine` survives as the "You" badge on a room row, and unread as the badges on the room
  rows, the listing cards and the view toggle.
- **Editing a task inline in the room panel**: a task row opens the task detail sheet, where
  the task is edited; raising one is the message context menu's job.
