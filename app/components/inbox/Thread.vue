<script lang="ts" setup>
import type { PhoneCall } from '~/components/inbox/data/conversations'
import { differenceInDays, format, isToday, isYesterday } from 'date-fns'
import { toast } from 'vue-sonner'

const { selectedConversation, selectedMessages, selectedReservation, markAsHandled, markAsUnread, isElevaiEnabled, useSuggestion, getNotes, addNote, editNote, deleteNote, rightPanelCollapsed, toggleRightPanel, autoTranslate, matchUnmatched, createFromUnmatched, dismissUnmatched, conversations } = useInbox()
const threeCX = useThreeCX()
const threeCXCalls = useThreeCxCalls()

const activeThreadTab = ref<'messages' | 'notes' | 'phone'>('messages')
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')
const editingNoteVisibleToAI = ref(false)
const templateOpen = ref(false)
const { isConnected: whatsappConnected } = useWhatsApp()
const email = useEmailIntegration()
const { isConnected: emailConnected } = email
const matchOpen = ref(false)
const matchSearch = ref('')

async function handleSimulateInboundEmail() {
  if (!selectedConversation.value)
    return
  const guestEmail = selectedConversation.value.guestEmail
    ?? selectedReservation.value?.guestDetails?.email
  const from = guestEmail || `guest${Date.now()}@mail.com`
  const result = await email.simulateInboundEmail({
    from,
    to: email.activeAccount.value?.address ?? 'acme-inc@mail.elev8-suite.com',
    subject: 'Guest message',
    content: 'Hi — thanks for the update! We\'re all set. Could you confirm the WiFi password?',
  })
  toast.success(result.matched ? 'Inbound email matched to conversation.' : 'Inbound email added as unmatched.')
}

const matchOptions = computed(() => {
  const q = matchSearch.value.trim().toLowerCase()
  return conversations.value
    .filter(c => c.stayStatus !== 'unmatched' && (!q || c.guestName.toLowerCase().includes(q) || c.listingName.toLowerCase().includes(q)))
    .slice(0, 12)
})

function handleMatch(conversationId: string) {
  if (!selectedConversation.value)
    return
  matchUnmatched(selectedConversation.value.id, conversationId)
  matchOpen.value = false
  matchSearch.value = ''
  toast.success('Matched to guest')
}

function handleCreateNew() {
  if (!selectedConversation.value)
    return
  createFromUnmatched(selectedConversation.value.id)
  toast.success('New conversation created')
}

function handleDismiss() {
  if (!selectedConversation.value)
    return
  dismissUnmatched(selectedConversation.value.id)
  toast.info('Conversation dismissed')
}

const newNoteContent = ref('')
const newNoteVisibleToAI = ref(false)

const conversationNotes = computed(() => {
  if (!selectedConversation.value)
    return []
  return getNotes(selectedConversation.value.id)
})

const conversationPhoneCalls = computed(() => {
  if (!selectedConversation.value)
    return []
  return threeCXCalls.getCallsForConversation(selectedConversation.value.id)
})

const isInitiatingCall = ref(false)

async function handleClickToCall() {
  if (!selectedConversation.value || !selectedReservation.value?.guestDetails?.phone)
    return
  const me = 'staff-2'
  const myExtension = threeCX.getExtensionForStaff(me) ?? '1001'
  isInitiatingCall.value = true
  try {
    await threeCXCalls.simulateOutboundCall({
      fromExtension: myExtension,
      toNumber: selectedReservation.value.guestDetails.phone,
      staffId: me,
      conversationId: selectedConversation.value.id,
    })
    toast.success('Call initiated.')
    activeThreadTab.value = 'phone'
  }
  catch {
    toast.error('Could not start the call. Please try again.')
  }
  finally {
    isInitiatingCall.value = false
  }
}

const expandedTranscripts = ref(new Set<string>())

function toggleTranscript(callId: string) {
  const next = new Set(expandedTranscripts.value)
  if (next.has(callId))
    next.delete(callId)
  else next.add(callId)
  expandedTranscripts.value = next
}

function formatTotalDuration(calls: PhoneCall[]): string {
  const total = calls.reduce((acc, c) => acc + c.duration, 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s}s total`
}

const dismissedSuggestions = ref<string[]>([])

const displayMessages = computed(() =>
  selectedMessages.value.filter(m => !m.isAISuggestion),
)

const threadItems = computed(() => {
  const msgs = displayMessages.value.map(m => ({ type: 'message' as const, data: m, timestamp: m.timestamp }))
  const notes = conversationNotes.value
    .filter(n => n.authorId !== 'guest')
    .map(n => ({ type: 'note' as const, data: n, timestamp: n.createdAt }))
  const combined = [...msgs, ...notes]
  combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return combined
})

const aiSuggestion = computed(() =>
  selectedMessages.value.find(m => m.isAISuggestion),
)

function getDateLabel(timestamp: string) {
  const date = new Date(timestamp)
  if (isToday(date))
    return 'Today'
  if (isYesterday(date))
    return 'Yesterday'
  const daysAgo = differenceInDays(new Date(), date)
  if (daysAgo <= 3)
    return format(date, 'EEEE')
  return format(date, 'EEEE, d MMM yyyy')
}

const showSuggestion = computed(() => {
  if (!aiSuggestion.value)
    return false
  if (dismissedSuggestions.value.includes(aiSuggestion.value.id))
    return false
  return selectedConversation.value ? isElevaiEnabled(selectedConversation.value.id) : false
})

function handleUseSuggestion(content: string) {
  useSuggestion(content)
  toast.success('Suggestion applied to reply box')
}

function dismissSuggestion() {
  if (aiSuggestion.value) {
    dismissedSuggestions.value.push(aiSuggestion.value.id)
  }
}

const statusVariantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  action_needed: 'destructive',
}

const statusLabelMap: Record<string, string> = {
  action_needed: 'Action Needed',
}

const stayDateLabel = computed(() => {
  const res = selectedReservation.value
  if (!res?.checkIn || !res?.checkOut)
    return ''
  return `${format(new Date(res.checkIn), 'd MMM yyyy')} – ${format(new Date(res.checkOut), 'd MMM yyyy')}`
})

function handleMarkAsHandled() {
  if (!selectedConversation.value)
    return
  markAsHandled(selectedConversation.value.id)
  toast.success('Marked as handled')
}

function handleMarkAsUnread() {
  if (!selectedConversation.value)
    return
  markAsUnread(selectedConversation.value.id)
  toast.info('Marked as unread')
}

function handleAddNote() {
  if (!selectedConversation.value || !newNoteContent.value.trim())
    return
  addNote(selectedConversation.value.id, newNoteContent.value.trim(), newNoteVisibleToAI.value)
  newNoteContent.value = ''
  newNoteVisibleToAI.value = false
  toast.success('Note added')
}

function startEditNote(noteId: string, content: string, visibleToAI: boolean) {
  editingNoteId.value = noteId
  editingNoteContent.value = content
  editingNoteVisibleToAI.value = visibleToAI
}

function cancelEditNote() {
  editingNoteId.value = null
  editingNoteContent.value = ''
  editingNoteVisibleToAI.value = false
}

function saveEditNote() {
  if (!selectedConversation.value || !editingNoteId.value || !editingNoteContent.value.trim())
    return
  editNote(selectedConversation.value.id, editingNoteId.value, editingNoteContent.value.trim(), editingNoteVisibleToAI.value)
  editingNoteId.value = null
  editingNoteContent.value = ''
  editingNoteVisibleToAI.value = false
  toast.success('Note updated')
}

function handleDeleteNote(noteId: string) {
  if (!selectedConversation.value)
    return
  deleteNote(selectedConversation.value.id, noteId)
  toast.success('Note deleted')
}

function toggleAutoTranslate() {
  autoTranslate.value = !autoTranslate.value
  toast.info(autoTranslate.value ? 'Auto-translate enabled' : 'Auto-translate disabled')
}

function formatNoteDate(timestamp: string) {
  const date = new Date(timestamp)
  return format(date, 'EEEE, MMMM d yyyy, h:mm a')
}

function formatCallDuration(seconds: number): string {
  if (seconds === 0)
    return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatCallTime(timestamp: string): string {
  return format(new Date(timestamp), 'h:mm a')
}

function formatCallDate(timestamp: string): string {
  const date = new Date(timestamp)
  if (isToday(date))
    return 'Today'
  if (isYesterday(date))
    return 'Yesterday'
  return format(date, 'd MMM yyyy')
}
</script>

<template>
  <div v-if="!selectedConversation" class="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
    <Icon name="lucide:message-square" class="size-12" />
    <p class="text-sm">
      Select a conversation
    </p>
  </div>

  <div v-else class="flex flex-col h-full overflow-hidden">
    <div class="flex items-center px-4 h-[56px]">
      <div class="flex flex-col justify-center min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm truncate">{{ selectedConversation.guestName }}</span>
          <Badge v-if="selectedConversation.status === 'action_needed'" :variant="statusVariantMap[selectedConversation.status]" class="text-[10px]">
            {{ statusLabelMap[selectedConversation.status] }}
          </Badge>
        </div>
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon v-if="stayDateLabel" name="lucide:calendar" class="size-3 shrink-0" />
          <span v-if="stayDateLabel" class="shrink-0">{{ stayDateLabel }}</span>
          <span v-if="stayDateLabel" class="shrink-0">·</span>
          <span class="truncate">{{ selectedConversation.listingName }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              v-if="selectedConversation.status === 'action_needed'"
              variant="outline"
              size="sm"
              @click="handleMarkAsHandled"
            >
              <Icon name="lucide:check-circle" class="size-4 mr-1" />
              Mark as Resolved
            </Button>
          </TooltipTrigger>
          <TooltipContent>Resolve action needed for this guest</TooltipContent>
        </Tooltip>
        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :class="autoTranslate ? 'text-primary' : ''"
            >
              <Icon name="lucide:languages" class="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-72 p-0" align="end" :side-offset="4">
            <div class="p-3 space-y-3">
              <div class="flex items-center gap-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon name="lucide:languages" class="size-4 text-muted-foreground" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium">
                    Translation
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ selectedConversation?.guestName }} speaks {{ selectedConversation?.guestLanguage ?? 'unknown' }}
                  </div>
                </div>
              </div>
              <Separator />
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm">
                    Auto-translate
                  </div>
                  <div class="text-[11px] text-muted-foreground">
                    Your preferred language: Bahasa Indonesia
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  :class="autoTranslate ? 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary' : ''"
                  @click="toggleAutoTranslate"
                >
                  {{ autoTranslate ? 'Active' : 'Disabled' }}
                </Button>
              </div>
              <div v-if="autoTranslate" class="rounded-md bg-muted/50 p-2.5">
                <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                  <Icon name="lucide:info" class="size-3" />
                  How it works
                </div>
                <ul class="text-[11px] text-muted-foreground space-y-0.5 ml-4 list-disc">
                  <li>Guest messages translated to Bahasa Indonesia</li>
                  <li>Your replies translated to {{ selectedConversation?.guestLanguage ?? 'guest language' }}</li>
                </ul>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="toggleRightPanel">
              <Icon :name="rightPanelCollapsed ? 'lucide:panel-right' : 'lucide:panel-right-close'" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ rightPanelCollapsed ? 'Show' : 'Hide' }} reservation panel</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon">
              <Icon name="lucide:more-vertical" class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Archive</DropdownMenuItem>
            <DropdownMenuItem>Mute</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="handleMarkAsUnread">
              <Icon name="lucide:mail" class="size-4 mr-2" />
              Mark as Unread
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <Separator />

    <!-- Unmatched action bar -->
    <div v-if="selectedConversation.stayStatus === 'unmatched'" class="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
      <Icon name="lucide:user-x" class="size-4 shrink-0 text-muted-foreground" />
      <span class="flex-1 text-xs text-muted-foreground">Unknown sender — not linked to any guest</span>
      <Button size="sm" variant="outline" class="h-7 text-xs" @click="matchOpen = true">
        Match to Guest
      </Button>
      <Button size="sm" variant="ghost" class="h-7 text-xs text-muted-foreground" @click="handleDismiss">
        Dismiss
      </Button>
    </div>

    <Dialog v-model:open="matchOpen">
      <DialogContent class="flex max-h-[80vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Match to guest</DialogTitle>
          <DialogDescription>Pick a conversation to attach this message to.</DialogDescription>
        </DialogHeader>
        <Input v-model="matchSearch" placeholder="Search guest or listing..." class="h-9 shrink-0" />
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div class="space-y-1 pr-1">
            <button
              v-for="c of matchOptions"
              :key="c.id"
              type="button"
              class="flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left hover:bg-accent"
              @click="handleMatch(c.id)"
            >
              <span class="text-sm font-medium">{{ c.guestName }}</span>
              <span class="text-xs text-muted-foreground truncate">{{ c.listingName }}</span>
            </button>
            <div v-if="matchOptions.length === 0" class="flex flex-col items-center gap-2 py-6 text-center">
              <p class="text-sm text-muted-foreground">
                No existing conversations found.
              </p>
              <Button size="sm" variant="outline" @click="handleCreateNew">
                Create new conversation
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <div class="flex flex-col flex-1 overflow-hidden">
      <div class="flex items-center h-8 px-4 shrink-0 border-b">
        <button
          class="text-xs px-2.5 py-1 font-medium transition-colors h-full border-b-2" :class="[activeThreadTab === 'messages' ? 'text-foreground border-primary' : 'text-muted-foreground hover:text-foreground border-transparent']"
          @click="activeThreadTab = 'messages'"
        >
          Messages
        </button>
        <button
          class="text-xs px-2.5 py-1 font-medium transition-colors h-full border-b-2" :class="[activeThreadTab === 'notes' ? 'text-foreground border-primary' : 'text-muted-foreground hover:text-foreground border-transparent']"
          @click="activeThreadTab = 'notes'"
        >
          Notes
          <Badge v-if="conversationNotes.length" variant="secondary" class="ml-1 text-[10px] h-4 px-1">
            {{ conversationNotes.length }}
          </Badge>
        </button>
        <button
          class="text-xs px-2.5 py-1 font-medium transition-colors h-full border-b-2" :class="[activeThreadTab === 'phone' ? 'text-foreground border-primary' : 'text-muted-foreground hover:text-foreground border-transparent']"
          @click="activeThreadTab = 'phone'"
        >
          Phone
          <Badge v-if="conversationPhoneCalls.length" variant="secondary" class="ml-1 text-[10px] h-4 px-1">
            {{ conversationPhoneCalls.length }}
          </Badge>
        </button>
      </div>

      <div v-if="activeThreadTab === 'messages'" class="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea class="flex-1 min-h-0">
          <div class="flex flex-col gap-4 p-4 pb-32">
            <template v-for="(item, index) of threadItems" :key="item.data.id">
              <div v-if="index === 0 || getDateLabel(item.timestamp) !== getDateLabel(threadItems[index - 1].timestamp)" class="flex items-center justify-center">
                <Badge variant="outline" class="text-xs text-muted-foreground">
                  {{ getDateLabel(item.timestamp) }}
                </Badge>
              </div>
              <InboxThreadMessage v-if="item.type === 'message'" :message="item.data" />
              <div v-else class="flex justify-end">
                <div class="flex flex-col gap-1 max-w-[75%]">
                  <div class="flex items-center gap-2">
                    <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/10">
                      <Icon name="lucide:sticky-note" class="size-4 text-warning" />
                    </div>
                    <span class="text-xs font-medium">Internal Note</span>
                    <span class="text-[10px] text-muted-foreground">· {{ item.data.authorName }}</span>
                    <span v-if="item.data.visibleToAI" class="inline-flex items-center gap-0.5 text-[10px] text-[#FBC800]">
                      <Icon name="lucide:sparkles" class="size-3" />
                      ElevAI
                    </span>
                  </div>
                  <template v-if="editingNoteId === item.data.id">
                    <div class="rounded-2xl bg-warning text-warning-foreground px-3 py-2">
                      <Textarea v-model="editingNoteContent" class="min-h-[60px] text-sm resize-none bg-warning text-warning-foreground placeholder:text-warning-foreground/50 border-warning-foreground/20" />
                      <div class="flex items-center justify-between mt-2">
                        <label class="flex items-center gap-1.5 text-[10px] text-warning-foreground/70 cursor-pointer select-none">
                          <input
                            v-model="editingNoteVisibleToAI"
                            type="checkbox"
                            class="size-3 rounded border-warning-foreground/30 accent-[#FBC800]"
                          >
                          <Icon name="lucide:sparkles" class="size-2.5 text-[#FBC800]" />
                          ElevAI
                        </label>
                        <div class="flex items-center gap-1">
                          <Button variant="ghost" size="sm" class="h-6 text-[10px] text-warning-foreground/70 hover:text-warning-foreground hover:bg-warning-foreground/10" @click="cancelEditNote">
                            Cancel
                          </Button>
                          <Button size="sm" class="h-6 text-[10px] bg-warning-foreground text-warning hover:bg-warning-foreground/90" :disabled="!editingNoteContent.trim()" @click="saveEditNote">
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="rounded-2xl bg-warning text-warning-foreground px-3 py-2 text-sm">
                      {{ item.data.content }}
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] text-muted-foreground">{{ formatNoteDate(item.data.createdAt) }}</span>
                      <div v-if="item.data.authorId !== 'guest'" class="flex items-center gap-0.5">
                        <button type="button" class="text-muted-foreground hover:text-foreground transition-colors" @click="startEditNote(item.data.id, item.data.content, item.data.visibleToAI)">
                          <Icon name="lucide:pencil" class="size-3" />
                        </button>
                        <button type="button" class="text-muted-foreground hover:text-destructive transition-colors" @click="handleDeleteNote(item.data.id)">
                          <Icon name="lucide:trash-2" class="size-3" />
                        </button>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </ScrollArea>

        <div v-if="showSuggestion && aiSuggestion" class="shrink-0 px-4 py-2">
          <InboxHostbuddySuggestion
            :suggestion="aiSuggestion"
            @use="handleUseSuggestion"
            @dismiss="dismissSuggestion"
          />
        </div>

        <div class="shrink-0 border-t bg-background">
          <div v-if="selectedConversation.otaSource === 'WhatsApp' && !whatsappConnected" class="p-3">
            <div class="rounded-md border bg-muted p-3">
              <p class="flex items-center gap-1.5 text-sm font-medium">
                <Icon name="lucide:message-circle" class="size-4 text-muted-foreground" />
                WhatsApp not connected
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                Connect your WhatsApp Business account to send and receive messages.
              </p>
              <Button size="sm" variant="outline" class="mt-2 gap-1" as-child>
                <NuxtLink to="/settings/integrations">
                  Connect WhatsApp
                  <Icon name="lucide:arrow-right" class="size-3.5" />
                </NuxtLink>
              </Button>
            </div>
          </div>
          <div v-else-if="selectedConversation.otaSource === 'WhatsApp' && selectedConversation.waWindowExpired" class="p-3">
            <div class="rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/30">
              <p class="flex items-center gap-1.5 text-sm font-medium text-orange-700 dark:text-orange-300">
                <Icon name="lucide:triangle-alert" class="size-4" />
                Conversation window expired
              </p>
              <p class="mt-1 text-xs text-orange-700/80 dark:text-orange-300/80">
                You can only send template messages now. Free-form replies require the guest to message first.
              </p>
              <Button size="sm" class="mt-2" @click="templateOpen = true">
                Send Template Message
              </Button>
            </div>
          </div>
          <div v-else-if="selectedConversation.otaSource === 'Email' && !emailConnected" class="p-3">
            <div class="rounded-md border bg-muted p-3">
              <p class="flex items-center gap-1.5 text-sm font-medium">
                <Icon name="lucide:mail" class="size-4 text-muted-foreground" />
                Email not connected
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                Connect a sending address to send and receive guest email.
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" class="gap-1" as-child>
                  <NuxtLink to="/settings/integrations">
                    Connect Email
                    <Icon name="lucide:arrow-right" class="size-3.5" />
                  </NuxtLink>
                </Button>
                <Button size="sm" variant="ghost" class="gap-1 text-muted-foreground" @click="handleSimulateInboundEmail">
                  <Icon name="lucide:mail-down" class="size-3.5" />
                  Simulate inbound
                </Button>
              </div>
            </div>
          </div>
          <InboxReplyBox
            v-else
            :channel="selectedConversation.otaSource"
            :conversation-id="selectedConversation.id"
            :stay-status="selectedConversation.stayStatus"
          />
          <div v-if="selectedConversation.otaSource === 'Email' && emailConnected" class="border-t px-3 py-1.5">
            <Button size="xs" variant="ghost" class="gap-1 h-6 text-[11px] text-muted-foreground" @click="handleSimulateInboundEmail">
              <Icon name="lucide:mail-down" class="size-3" />
              Simulate inbound email
            </Button>
          </div>
        </div>
      </div>

      <div v-if="activeThreadTab === 'notes'" class="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea class="flex-1 min-h-0">
          <div class="p-4 space-y-3 pb-32">
            <!-- Call notes from phone calls -->
            <template v-for="call of conversationPhoneCalls" :key="`call-note-${call.id}`">
              <div v-if="call.summary" class="rounded-lg border bg-muted/50 p-3">
                <p class="text-sm leading-relaxed whitespace-pre-line">
                  {{ call.summary }}
                </p>
                <div class="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                  <Icon name="lucide:phone" class="size-3" />
                  <span>{{ call.direction === 'outbound' ? 'Komang Juliantara' : (selectedConversation?.guestName ?? 'Guest') }}</span>
                  <span>·</span>
                  <span>{{ formatNoteDate(call.timestamp) }}</span>
                  <span class="inline-flex items-center gap-0.5 text-[#FBC800]">
                    <Icon name="lucide:sparkles" class="size-3" />
                    ElevAI
                  </span>
                </div>
              </div>
            </template>

            <div v-for="note of conversationNotes" :key="note.id" class="rounded-lg border bg-muted/50 p-3">
              <template v-if="editingNoteId === note.id">
                <Textarea v-model="editingNoteContent" class="min-h-[60px] text-sm resize-none" />
                <div class="flex items-center justify-between mt-2">
                  <label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      v-model="editingNoteVisibleToAI"
                      type="checkbox"
                      class="size-3.5 rounded border-muted-foreground/30 accent-[#FBC800]"
                    >
                    <Icon name="lucide:sparkles" class="size-3 text-[#FBC800]" />
                    Let ElevAI read this note
                  </label>
                  <div class="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" class="h-7 text-xs" @click="cancelEditNote">
                      Cancel
                    </Button>
                    <Button size="sm" class="h-7 text-xs" :disabled="!editingNoteContent.trim()" @click="saveEditNote">
                      Save
                    </Button>
                  </div>
                </div>
              </template>
              <template v-else>
                <p class="text-sm leading-relaxed">
                  {{ note.content }}
                </p>
                <div class="flex items-center justify-between mt-2">
                  <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{{ note.authorName }}</span>
                    <span>·</span>
                    <span>{{ formatNoteDate(note.createdAt) }}</span>
                    <span v-if="note.visibleToAI" class="inline-flex items-center gap-0.5 text-[#FBC800]">
                      <Icon name="lucide:sparkles" class="size-3" />
                      ElevAI
                    </span>
                  </div>
                  <div v-if="note.authorId !== 'guest'" class="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" class="size-6" @click="startEditNote(note.id, note.content, note.visibleToAI)">
                      <Icon name="lucide:pencil" class="size-3 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" class="size-6" @click="handleDeleteNote(note.id)">
                      <Icon name="lucide:trash-2" class="size-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </template>
            </div>
            <div v-if="!conversationNotes.length && !conversationPhoneCalls.length" class="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Icon name="lucide:sticky-note" class="size-10 mb-2" />
              <p class="text-sm">
                No notes yet
              </p>
            </div>
          </div>
        </ScrollArea>
        <div class="shrink-0 border-t bg-background p-3">
          <div class="space-y-2">
            <Textarea v-model="newNoteContent" placeholder="Add a note..." class="min-h-[60px] text-sm resize-none" />
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  v-model="newNoteVisibleToAI"
                  type="checkbox"
                  class="size-3.5 rounded border-muted-foreground/30 accent-[#FBC800]"
                >
                <Icon name="lucide:sparkles" class="size-3 text-[#FBC800]" />
                Let ElevAI read this note
              </label>
              <Button size="sm" :disabled="!newNoteContent.trim()" @click="handleAddNote">
                Add Note
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Phone Tab -->
      <div v-if="activeThreadTab === 'phone'" class="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea class="flex-1 min-h-0">
          <div class="p-4 space-y-3 pb-32">
            <!-- Call summary -->
            <div v-if="conversationPhoneCalls.length" class="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon name="lucide:phone" class="size-3.5" />
                <span>{{ conversationPhoneCalls.length }} calls</span>
              </div>
              <span class="text-muted-foreground/30">|</span>
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon name="lucide:clock" class="size-3.5" />
                <span>{{ formatTotalDuration(conversationPhoneCalls) }}</span>
              </div>
            </div>

            <!-- Call back button -->
            <div v-if="selectedReservation?.guestDetails?.phone" class="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon name="lucide:phone" class="size-4 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">
                  {{ selectedReservation.guestDetails.phone }}
                </div>
                <div class="text-[10px] text-muted-foreground">
                  Guest phone number
                </div>
              </div>
              <Button
                size="sm"
                class="gap-1.5"
                :disabled="isInitiatingCall || !threeCX.isConnected.value"
                @click="handleClickToCall"
              >
                <Icon v-if="isInitiatingCall" name="lucide:loader-circle" class="size-3.5 animate-spin" />
                <Icon v-else name="lucide:phone" class="size-3.5" />
                {{ isInitiatingCall ? 'Calling…' : 'Call' }}
              </Button>
            </div>

            <div v-if="selectedReservation?.guestDetails?.phone && !threeCX.isConnected.value" class="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              <div class="flex items-start gap-2">
                <Icon name="lucide:info" class="size-3.5 mt-0.5 shrink-0" />
                <div>
                  Connect your 3CX account in
                  <NuxtLink to="/settings/integrations" class="underline underline-offset-2 hover:text-foreground">
                    Settings &rarr; Integrations
                  </NuxtLink>
                  to enable click-to-call.
                </div>
              </div>
            </div>

            <!-- Call history -->
            <template v-for="(call, index) of conversationPhoneCalls" :key="call.id">
              <div v-if="index === 0 || formatCallDate(call.timestamp) !== formatCallDate(conversationPhoneCalls[index - 1].timestamp)" class="flex items-center gap-2 pt-2 first:pt-0">
                <span class="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{{ formatCallDate(call.timestamp) }}</span>
                <div class="h-px flex-1 bg-border" />
              </div>
              <div class="rounded-lg border">
                <div class="flex items-start gap-3 p-3">
                  <div
                    class="flex size-8 shrink-0 items-center justify-center rounded-full"
                    :class="{
                      'bg-green-100 dark:bg-green-900': call.status === 'completed' && call.direction === 'outbound',
                      'bg-blue-100 dark:bg-blue-900': call.status === 'completed' && call.direction === 'inbound',
                      'bg-red-100 dark:bg-red-900': call.status === 'missed',
                      'bg-purple-100 dark:bg-purple-900': call.status === 'voicemail',
                    }"
                  >
                    <Icon
                      :name="{
                        outbound: 'lucide:phone-outgoing',
                        inbound: call.status === 'missed' ? 'lucide:phone-missed' : 'lucide:phone-incoming',
                        voicemail: 'lucide:voicemail',
                      }[call.direction === 'outbound' ? 'outbound' : call.status === 'voicemail' ? 'voicemail' : 'inbound'] ?? 'lucide:phone'"
                      class="size-4"
                      :class="{
                        'text-green-600 dark:text-green-400': call.status === 'completed' && call.direction === 'outbound',
                        'text-blue-600 dark:text-blue-400': call.status === 'completed' && call.direction === 'inbound',
                        'text-red-600 dark:text-red-400': call.status === 'missed',
                        'text-purple-600 dark:text-purple-400': call.status === 'voicemail',
                      }"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">
                        {{ call.direction === 'outbound' ? 'Outgoing call' : call.status === 'missed' ? 'Missed call' : call.status === 'voicemail' ? 'Voicemail' : 'Incoming call' }}
                      </span>
                      <span class="text-[10px] text-muted-foreground">{{ formatCallTime(call.timestamp) }}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{{ call.direction === 'outbound' ? `To ${call.to}` : `From ${call.from}` }}</span>
                      <span v-if="call.duration > 0">· {{ formatCallDuration(call.duration) }}</span>
                    </div>
                    <div v-if="call.note" class="mt-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                      {{ call.note }}
                    </div>
                    <div v-if="call.transcriptionState === 'processing'" class="mt-1.5 text-xs leading-relaxed bg-muted/40 border border-dashed rounded px-2 py-1.5">
                      <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Icon name="lucide:loader-circle" class="size-3 animate-spin" />
                        <span>Processing transcript &amp; summary</span>
                      </div>
                    </div>
                    <div v-else-if="call.transcriptionState === 'failed'" class="mt-1.5 text-xs leading-relaxed bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5">
                      <div class="flex items-center gap-1.5 text-[10px] text-destructive">
                        <Icon name="lucide:alert-circle" class="size-3" />
                        <span>{{ call.transcriptionError ?? 'Transcription failed' }}</span>
                        <button
                          type="button"
                          class="ml-auto inline-flex items-center gap-1 text-destructive hover:text-destructive/80 font-medium"
                          @click="threeCXCalls.retryTranscription(selectedConversation!.id, call.id)"
                        >
                          <Icon name="lucide:refresh-cw" class="size-3" />
                          Retry
                        </button>
                      </div>
                    </div>
                    <div v-else-if="call.summary" class="mt-1.5 text-xs leading-relaxed bg-[#FBC800]/5 border border-[#FBC800]/20 rounded px-2 py-1.5">
                      <div class="flex items-center gap-1 mb-0.5 text-[10px] text-[#FBC800]">
                        <Icon name="lucide:sparkles" class="size-2.5" />
                        <span class="font-medium">AI Summary</span>
                      </div>
                      <span class="text-muted-foreground">{{ call.summary }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <template v-if="call.recording_url">
                      <a :href="call.recording_url" download target="_blank">
                        <Button variant="ghost" size="icon" class="size-8">
                          <Icon name="lucide:download" class="size-3.5" />
                        </Button>
                      </a>
                    </template>
                  </div>
                </div>
                <div v-if="call.transcript" class="border-t">
                  <button
                    class="flex items-center gap-1.5 w-full px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    @click="toggleTranscript(call.id)"
                  >
                    <Icon :name="expandedTranscripts.has(call.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="size-3" />
                    Transcript
                  </button>
                  <div v-if="expandedTranscripts.has(call.id)" class="px-3 pb-3">
                    <div class="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-line leading-relaxed">
                      {{ call.transcript }}
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div v-if="!conversationPhoneCalls.length" class="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Icon name="lucide:phone-off" class="size-10 mb-2" />
              <p class="text-sm">
                No call history
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>

    <InboxWhatsAppSendModal
      v-model:open="templateOpen"
      :guest-name="selectedConversation.guestName"
      :phone="selectedReservation?.guestDetails?.phone ?? ''"
      :vars="{ property_name: selectedConversation.listingName }"
    />
  </div>
</template>
