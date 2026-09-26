> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Inbox Module (`app/components/inbox/`)

#### Data + Types (`app/components/inbox/data/conversations.ts`)
- `Conversation` type with `status: ConversationStatus | null`, `assignedTo?: string | null`, `tags: string[]`, `guestLanguage?: string`
- `actionCategoryConfig` + `actionCategoryFor(conv)` — label and chip colour per `ActionCategory`, falling back to `other`. Shared by `GroDashboard` and the GM dashboard's `GmSentimentPanel`; it used to be an inline map in `GroDashboard` and was extracted the moment a second surface needed it. Do not re-inline it.
- `Message` type with `aiWritten?: boolean`, `senderRole?: string`, `translatedContent?: string`
- `GuestDetails` type with `language: string`
- `StaffMember` list: You/Admin, Komang Juliantara/Guest Relations, Made Surya/Housekeeping, Wayan Adi/Maintenance
- `Reservation` type + mock data (6 conversations)
- **WhatsApp additions**: `otaSources` includes `WhatsApp` (`logos:whatsapp-icon`, green); `Conversation.waWindowExpired?: boolean` (24h window); `Message.mediaUrl?`/`mediaDims?` (photo messages); `StayStatus` includes `'unmatched'`; `UnmatchedMessage` type. WhatsApp conversations seeded: Max Müller (normal), Lisa Park (complaint + pool photos), Marcel Weber (window expired), + 3 `conv-um-*` unmatched (phone-number as guestName, `listingName: 'Unknown'`)

#### Shared State (`app/composables/useInbox.ts`)
- **Reactive**: `conversations` uses `useState<Conversation[]>` — mutations MUST use spread syntax to trigger Vue reactivity
- **Filters**:
  - `showActionNeeded` — boolean toggle
  - `assignedToMeFilter` — boolean
  - `activeStayFilter` — boolean
  - `activeListingFilter` — multi-select `string[]` (empty = no filter). Checkboxes in sidebar. Selected listings shown as removable chips.
  - `activeTagFilters` — multi-select `string[]` (AND logic). Tags button opens searchable Popover with checkboxes. Selected tags shown as removable chips.
  - `listingSearchText`, `searchValue`, `sortBy`
- **Actions**: `markAsHandled()`, `markAsUnread()`, `assignTo()`, `getAssignedStaff()`, `toggleListingFilter()`, `clearListingFilters()`, `toggleTagFilter()`, `clearTagFilters()`, `clearAllListingFilters()`, ElevAI toggle functions
- **Auto-read**: Selecting a conversation sets `unreadCount = 0`
- **A reservation always has somewhere to write to**: `ensureConversationForReservation(stay)`
  returns the reservation's thread, or opens an **Email** conversation on the guest's address
  (`conv-res-<reservationId>`, once); null only with no thread and no email. `openForReservation`
  does that and selects it (view `conversations`), reporting `created`. Used by the damage claim
  notice and by the **Inbox** button in the reservation detail sheet's header, which is disabled
  (with a tooltip saying why) only when the guest has neither.
- **Key type**: `ConversationStatus = 'action_needed'` (nullable — `null` = no action needed)
- **Phone**: `getPhoneCalls(conversationId)` returns `PhoneCall[]` for the conversation
- **Auto-translate**: `autoTranslate` boolean state (default `true`), `mockTranslate(text, lang)` async mock function (500ms delay)
  - Guest messages → translated to Bahasa Indonesia; Host messages → translated to `guestLanguage`
  - Toggle button (icon `lucide:languages`, ghost variant) in Thread header opens Popover with guest language info + Active/Disabled toggle
  - `ThreadMessage.vue`: when auto-translate ON → bubble shows translated text only + "Translated" label; when OFF → shows original
  - `ReplyBox.vue`: shows "Messages will be auto-translated to {guestLanguage}" indicator when ON

#### Phone Call Features
- `PhoneCall` interface with `direction`, `status`, `duration`, `transcript`, `summary`, `recording_url`
- Phone tab in Thread.vue — call history with transcript expand/collapse, download recording, AI summary block per call (gold-tinted, ElevAI badge)
- Call summaries in Notes tab — same layout as regular notes (caller name + date + ElevAI badge), caller derived from `direction` (outbound → "Komang Juliantara", inbound → guest name)
- Phone call entries in Activity timeline with Send button for unsent templates

#### Image Sending
- `ReplyBox.vue` — paperclip button opens native file picker (images only), preview thumbnail above textarea with X remove button, `canSend` computed enables Send for image-only messages
- `sendMessage()` accepts optional `mediaUrl` and `mediaDims` params, passes to `Message` object
- Image-only messages show "📷 Photo" in conversation list lastMessage
- `ThreadMessage.vue` already renders `mediaUrl` images in bubbles (no change needed)

#### Notes System
- Notes appear in both Messages tab (inline with chat) and Notes tab (dedicated view)
- Notes tab: call summaries first, then staff/guest notes; native checkbox for "Let ElevAI read this note" (Reka UI Checkbox has reactivity bug)
- Edit/delete on staff notes only (`authorId !== 'guest'`); inline edit mode with Textarea + ElevAI checkbox + Save/Cancel
- Messages tab notes: author name shown, edit/delete buttons below bubble, edit mode styled to match yellow bubble
- `useInbox` exports: `addNote()`, `editNote(conversationId, noteId, content, visibleToAI?)`, `deleteNote(conversationId, noteId)`

### Inbox Settings (gear icon in inbox header)

A gear icon (⚙️) sits next to the "Inbox" header title in `InboxLayout.vue`. Clicking it opens a **Popover** with two options:

- **Integrations** → opens a Sheet with `SettingsWhatsAppIntegration`
- **AI Conversation Settings** → opens `InboxAiSettings` Sheet

#### `InboxAiSettings.vue` (`app/components/inbox/AiSettings.vue`)
- `Sheet` (640px wide) with two-column layout: config sidebar (left, 192px) + form (right, scrollable)
- Multi-config support: **default** config (applies to all unlisted properties) + custom configs per listing
- Custom configs have a listing picker (checkboxes from `allProperties`) to select which listings they apply to
- Config form fields: Defer Behavior (5 options), Direct Contact, Use Signature + textarea, Conversation Closing, AI Transparency, Language (guest/always), Stop on Negative Sentiment, Message Delay (min/max), Customize Tone
- `defineModel<boolean>('open')` — controlled by parent
- `inboxView` state was added to `useInbox` but is unused (kept for future use)
