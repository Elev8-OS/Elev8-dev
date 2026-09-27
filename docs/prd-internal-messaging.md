# PRD: Inbox Internal Staff Messaging

| | |
|---|---|
| **Module** | Inbox, third view: Internal (beside Conversations and Calls) |
| **Owner** | Komang Juliantara (Guest Relations) |
| **Status** | Demo built (mock data, timers instead of APIs). Needs backend for production |
| **Date** | 2026-09-27 |
| **Code** | `app/components/inbox/internal/`, `app/components/inbox/data/internal.ts`, `app/composables/useInternalInbox.ts` |
| **Tech notes** | `docs/claude/internal-inbox.md` |

---

## 1. Problem

When a guest reports a problem (broken AC, no hot water, pool is green), the guest relations agent has to pass it to the right people at the right villa. Today that happens outside Elev8, in WhatsApp groups and phone calls. The result:

- The context of the guest message is lost or retyped.
- Nobody knows who at the property has seen it.
- The reply from maintenance does not come back to the person handling the guest.
- Nothing becomes a task, so there is no record that the fix happened.

## 2. Goal

Give staff an internal chat inside the Inbox, **addressed by listing and role** ("the housekeepers on Villa Merapi"), so a guest message can be handed over in one click and the answer read back in the same place.

### Success metrics
- Share of guest issues forwarded from the Inbox instead of handled outside Elev8.
- Median time from a guest message to the first staff reply in a room.
- Share of forwarded issues that are converted into a task.

### Non-goals (this phase)
- Direct messages between two people.
- Forwarding internal messages back to a guest thread (one-way on purpose).
- Room creation, room settings or membership management screens.
- A listing-wide General room (the mobile app has none). To reach everyone at a listing, forward to several role rooms at once.

## 3. Users

| Persona | Need |
|---|---|
| Guest Relations / Guest Experience Manager | Hand a guest issue to the right team and read the answer |
| Housekeeping, Pool, Gardener, Engineering, Electrician, Laundry | See what is asked of them at their villa, reply with text or a photo |
| Housekeeping Manager, Listing Manager | Coordinate the team at a property, raise tasks |
| Admin, General Manager, Owner | Oversee every property's rooms |

---

## 4. Core concepts and business rules

### 4.1 Rooms are derived, never managed
- Each listing has **one room per role** that has at least one active user assigned there.
- There is **no General room** (listing-wide room for everyone). The mobile app has none, and the dashboard must match it.
- Adding a user to a listing opens the room; removing the last user of that role closes it.
- The source of truth is the user's **assigned listings + role**, edited in Users. There is no room CRUD, no membership screen and no archive.
- **Inactive users** are in no room.
- Room order is the same on every listing: the order of the Roles list.
- Room id format: `room-<listingId>-<roleId>`.

### 4.2 Visibility vs. membership
- A user **sees** every room on every listing they are assigned to.
- A user is a **member** only of the room matching their role. Membership shows as a "You" badge on the room row.
- Reason: a guest relations agent must be able to read the maintenance room without being maintenance.
- A user with **no listing scope** (Admin, General Manager, Owner) sees the **whole portfolio**, not nothing.

### 4.3 One listing is always open
- There is no "all listings" view. The room list always shows the rooms of exactly one listing.
- On first entry, the first listing opens. If a search or tag filter hides the open listing, the first remaining listing opens instead. Clearing the filter restores the user's pick.
- **Picking a listing opens no room.** The thread shows "Select a room" and the right panel shows the **listing overview**: every member at the listing and every task there. A room opens only when the user clicks it.
- Clicking the open listing again closes the open room and returns to the listing overview (it never toggles the listing off).

### 4.4 Unread
- Unread = messages posted by **someone else** after the user last opened the room.
- Own messages never count as unread. Posting into a room marks it read.
- Clicking a room marks it read. Being carried into a room by a listing switch does **not** mark it read.
- Unread counts show on the room row, on the listing card, and on the Internal view toggle (total).

### 4.5 Forwards are snapshots
- A forwarded message is **copied** at forward time (text, sender, timestamp, channel, photo). Later edits to the source do not change it.
- The source id is kept for provenance and for the "Open thread" link only, never as a live join.

---

## 5. Functional requirements (Jira stories)

Epic: **Inbox Internal Staff Messaging**

### Story 1: Internal view in the Inbox
**As** a staff member, **I want** an Internal view in the Inbox **so that** I can talk to colleagues without leaving Elev8.

Acceptance criteria:
- The Inbox view toggle has three options: Conversations, Calls, Internal. Only the active view shows its label; the other two are icon buttons with tooltips.
- The Internal button shows a badge with the total unread count.
- The layout has four panels: listing picker, room list, room thread, room details.
- The first time the Internal view is opened in a session, all four panels show skeletons that match their real layout while the rooms load. Later visits in the same session do not show the loader again.

### Story 2: Listing picker
**As** a staff member, **I want** to pick the property I am working on **so that** I only see the rooms that matter there.

Acceptance criteria:
- One search field (matches listing name **or** room name) with a **Tags** button beside it.
- Tag filter uses Popover + search + checkbox list + "Clear all". Multiple tags are ANDed. Picked tags show as removable chips.
- One card per listing: cover photo, name, role count (equals the room count), member count (unique people), unread badge.
- A listing left with no matching rooms is hidden.
- Collapsed panel shows photos only, each with an accessible label and pressed state.
- Rules from 4.3 apply.

### Story 3: Room list
**As** a staff member, **I want** to see the rooms at the open listing **so that** I can choose who to talk to.

Acceptance criteria:
- Panel header names the open listing.
- Flat list of role rooms in Roles order.
- Each row shows room name, last message preview, time, unread badge and a "You" badge where the user is a member.
- A photo with no caption previews as "Photo" with an image icon (no emoji).
- No search inside this panel (the listing picker owns search).

### Story 4: Room thread and composer
**As** a staff member, **I want** to send text and photos into a room **so that** I can report and answer issues.

Acceptance criteria:
- Header shows room name and member avatars.
- Composer placeholder "Message <room name>" and the note "Internal only. Guests never see this."
- Paperclip attaches **one image** (image files only), previewed above the text box with a Remove button. Send is enabled for a photo with no caption.
- The thread scrolls to the newest message on send and on room change.
- A message can be **replied to** (quote of the original, trimmed to one line).
- Switching room clears any draft reply and any message selection.

### Story 5: Delivery state
**As** a sender, **I want** to see whether my message was delivered **so that** I know the team got it.

Acceptance criteria:
- Own messages show `Sending...` (or `Uploading photo...` with a photo), then delivered. Delivered messages show no status line.
- While sending, the bubble is dimmed and the spinner sits on the photo.
- A failed message **stays in the thread** with a destructive ring and **Retry** / **Discard**. Retry resends it unchanged, photo included.
- Retry and Discard are only available on failed messages.
- A photo that cannot load shows a "Photo unavailable" placeholder.

### Story 6: Forward guest messages to rooms
**As** a guest relations agent, **I want** to forward a guest message to one or more rooms **so that** the right teams act on it without me retyping.

Acceptance criteria:
- Right-click on a guest message (or on a selection) offers **Forward**.
- The forward dialog lets the user pick **multiple rooms**, across all rooms in their scope. The listing of the guest's reservation is listed first when it can be resolved.
- One message is posted **per room** (a reply in one room never appears in another).
- The forwarded card shows guest name, listing, sender label (Guest / ElevAI / role), channel, time, content and photo, plus an **Open thread** link back to the guest conversation.
- Internal room messages can also be forwarded to other rooms; their photo travels with them.
- Forwarded content is a snapshot (4.5).

### Story 7: Create a task from messages
**As** a staff member, **I want** to turn messages into a task **so that** the fix is tracked.

Acceptance criteria:
- Right-click (or selection) offers **Create task**, from both guest threads and room threads.
- It opens the **same New Task form as the Tasks page** (listing, owner approval, HostBuddy detection, assignee, priority, due date, images), not a separate inbox form.
- The form has **no Title and no Description field**. The only text field is **Instructions** (required); the task title is the first line of the instructions.
- Instructions are prefilled with **every message in full**: the message text first, then "(sender, role, 26 Aug 2026, 17:15)" in readable local time, never a raw ISO timestamp. So the first line (the title) is the problem itself.
- Photos in the messages are prefilled as the task's images. The listing is prefilled from the room or the guest's reservation.
- When created from a role room, the assignee is prefilled from the role mapping (section 6). If the role has no equivalent, the assignee stays empty rather than guessed.
- The task is saved to the Tasks module.
- Nothing is posted back into the room: there is no "<name> opened a task" line. The new task appears in the room panel's task list.

### Story 8: Context menu and multi-select
**As** a staff member, **I want** to act on several messages at once **so that** I can forward or task a whole exchange.

Acceptance criteria:
- Menu items: Reply (room messages only), Forward, Create task, Select messages / Add or remove from selection / Clear selection, Copy text.
- Once a selection exists, actions apply to the **selection**, and labels say so ("Forward 3 messages").
- Reply is hidden while a selection is active.
- Guest-thread system lines (ElevAI or system notices) have no context menu. Rooms have no system lines.
- A selection bar shows the count; selection mode ends when nothing is selected, and clears on conversation or room change.

### Story 9: Right panel (listing overview and room details)
**As** a staff member, **I want** to see who works at a listing, who is in a room and what work is open **so that** I know who will act.

Acceptance criteria:
- **Listing overview** (a listing is open, no room): header "Listing", the listing (link), **every member at the listing** (each person once, with their role), and **every task at the listing** whoever it is assigned to (person-assigned tasks included), headed "Tasks at this listing".
- **Room details** (a room is open): header "Room", the listing (link), the room members, and the tasks this room answers for.
- A role room shows tasks at that listing assigned to its mapped role. Tasks assigned to a specific person do not appear in role rooms (they appear in the listing overview).
- Open tasks first, then soonest due date, undated last.
- A task card shows title, status, priority and due date, **never the task id**. Clicking it opens the **task detail sheet** (the same one the Tasks page uses) in place.
- Empty states: "No tasks at this listing yet." (overview), "No tasks fall to this role. Right-click a message to raise one." (room).

### Story 10: Photo viewer
**As** a staff member, **I want** to open a photo full size **so that** I can see the damage clearly.

Acceptance criteria:
- Clicking a photo (in a message or a forwarded card) opens it in a viewer. The photo is a button, so it works by keyboard.
- Clicking inside the viewer zooms 2.5x on the clicked point; clicking again fits it back. Each new photo opens fitted.
- The viewer shows the sender ("You" for own photos) and falls back to "Photo unavailable" if the image cannot load.

### Story 11: Real-time messages and notifications
**As** a staff member, **I want** a colleague's message to reach me the moment it is posted **so that** I can act on it without watching the Internal view.

Acceptance criteria:
- A new message from a colleague appears in its room immediately, and the room row, listing card and Internal toggle badges update.
- **Never in the notification bell.** Room messages are pushed in real time instead:

  | Where the user is | What they get |
  |---|---|
  | Dashboard tab in the background | Native browser notification |
  | Dashboard in front, Internal view open | Nothing extra (the thread and badges update in place) |
  | Dashboard in front, any other page or inbox view | In-app toast |

- Every room the user can **see** notifies, not only their own role's room. Their own messages never notify.
- Content: "<Sender> in <Room>", the message preview and the listing name. Several unread in one room roll up into one: "3 new messages in <Room>". One notification per room (a new one replaces the previous one).
- **Open** on the toast, or a click on the native notification, opens Inbox > Internal on that listing and room and marks it read (filters are cleared first).
- If the room is open in front of the user, the message is marked read. If the tab is in the background it stays unread until the user comes back to the tab.
- Desktop alert permission is requested only from a click: a "Turn on" prompt in the room list while the browser has not been asked, and a note when it is blocked. Without permission, a background tab falls back to a toast that is waiting when the user returns.
- Demo only: a colleague in the room replies 8 to 15 seconds after the user posts, so the flow can be shown without a backend.

---

## 5b. Tasks module changes made alongside

These live in the Tasks module but were decided while building task creation from messages:

- **One New Task form** (`tasks/NewTaskDialog.vue`) for the Tasks page and the inbox. No Title, no Description: only **Instructions** (required). The title is the first line of the instructions.
- **Three statuses only**: Not started, In progress, Completed. No Backlog, To do, Done or Cancelled.
- **No cancelling**: a task nobody will do is deleted. An owner rejecting the quote deletes the task.
- **Timeline sentences** built from what happened, with the person's note underneath:
  - "Kadek Dwi Prayoga has created a new task for Apartments Pererenan Public"
  - "Kadek Mia Pratiwi is 31% through the task", then the note, e.g. "we already spoken with pak Andrew, and will discuss it again with ibu Inka to confirm what she would like"
  - "Kadek Dwi Prayoga has completed the task" (a progress update to 100% is a completion)
  - Entries that are not one of these three (a quote sent, an owner's decision) keep their own wording.
- **Task ids are not shown** on task cards; a task is named by its title.

## 6. Role to task assignee mapping

The Tasks module uses a shorter assignee vocabulary than Roles.

| Room role | Task assignee |
|---|---|
| Admin | `admin` |
| Guest Experience Manager | `guest-relations` |
| Listing Manager, General Manager | `listing-manager` |
| Housekeeping, Housekeeping Manager, Laundry | `housekeeping` |
| Engineering, Electrician, Pool, Gardener | `maintenance` |
| Quality Manager, Back Office, Finance & HR, IT Team, Owner | none (left empty) |

---

## 7. Data model

```ts
InternalRoom    { id, listingId, listingName, roomKey (roleId), name, memberIds[] }

InternalMessage { id, roomId, authorId, authorName, authorInitials, authorRole,
                  content, createdAt, mediaUrl?, mediaDims?,
                  forwarded?: ForwardedRef[], replyTo?: InternalReplyRef,
                  sendStatus?: 'sending' | 'sent' | 'failed' }

ForwardedRef    { sourceId, sourceKind: 'guest' | 'internal', conversationId?, roomId?,
                  contextLabel, senderName, senderLabel, content, timestamp,
                  channel?, mediaUrl? }

InternalReplyRef { messageId, senderName, excerpt }

Per user: lastReadAt[roomId]
```

Rooms are not stored; they are computed from Listings + Users (listingIds, roleId, status) + Roles.

---

## 8. Production gaps (backend work needed)

The demo runs on in-memory state and timers. To ship, these need real implementation:

| Area | Demo today | Needed for production |
|---|---|---|
| Persistence | `useState`, lost on reload | Messages and `lastReadAt` stored server-side |
| Real-time | Mock colleague reply on a timer | Websocket delivering new messages into `receiveInternalMessage` |
| Room loading | 900 ms timer over local data | API for room tree and paginated messages per room, with error + retry state |
| Photo upload | Blob URL, fake latency, forced fail by typing `error` | Real upload to storage, persistent URL, progress, cancel |
| Delivery | Timer with random 12% fail | Server acknowledgement |
| Notifications | Toast + native browser notification while the dashboard is open in a tab | Web Push (service worker + push server) to reach a closed browser; mobile push for field staff. Never the bell |
| Guest listing link | Guest conversation matches listing by **name** | Match by listing id |
| Task listing link | Tasks match listing by **name** | Match by listing id |
| Access control | Client-side filtering | Server enforces listing scope per user and tenant |

---

## 9. Out of scope (future candidates)

- Direct messages between two people.
- Reactions, editing or deleting messages.
- Read receipts (who else has read a message).
- Multiple photos, files or video per message.
- Pinch/wheel zoom and next/previous photo in the viewer.
- "Mine" or "Unread" room filters.
- Editing tasks from the room panel.
- Cross-tenant rooms for GROs assigned to several tenants.
- Forwarding internal messages into a guest thread (kept one-way on purpose so internal wording never reaches a guest).

---

## 10. Open questions

1. Should field staff (housekeeping, pool, gardener) use this from the mobile app? If yes, push notifications become required for launch.
2. Message retention: how long are room messages kept, and are they included in any export?
3. Should a new member of a listing see the room history from before they joined?
4. Do we need a "mark all as read" per listing?
5. Should the Quality Manager, Back Office, Finance & HR, IT Team and Owner roles get task assignee equivalents in the Tasks module?
6. With no General room, is a listing-wide announcement needed (for example a "send to all rooms" shortcut in the composer)?

---

## 11. Test coverage (demo)

- `tests/lib/internal-inbox.spec.ts`: 62 tests (room derivation, visibility, tags, unread, task seeding, assignee mapping).
- `tests/composables/useInternalInbox.spec.ts`: 60 tests (open listing fallbacks, sending, forwards, snapshots, selection).
- `tests/components/inbox/InternalInbox.spec.ts`: 85 tests (nav, room list, thread, composer, delivery states, forward dialog, room panel, context menu).
