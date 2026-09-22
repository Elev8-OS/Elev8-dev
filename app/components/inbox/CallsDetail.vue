<script lang="ts" setup>
import type { PhoneCall, PhoneCallStatus, UnmatchedCall } from '~/components/inbox/data/conversations'
import { format, isToday, isYesterday } from 'date-fns'
import { computed } from 'vue'

const inbox = useInbox()
const threeCxCalls = useThreeCxCalls()

const selectedCallId = useState<string | null>('calls-selected-id', () => null)

const selectedCall = computed<PhoneCall | null>(() => {
  if (!selectedCallId.value)
    return null
  return threeCxCalls.getCallById(selectedCallId.value) ?? null
})

const isUnmatched = computed(() => {
  if (!selectedCall.value)
    return false
  return !selectedCall.value.conversationId
})

const answeredBy = computed(() => {
  if (!selectedCall.value?.staffId)
    return null
  return inbox.staffMembers.find(s => s.id === selectedCall.value!.staffId) ?? null
})

const answeredByExtension = computed(() => selectedCall.value?.extensionNumber ?? null)

const selectedConversation = computed(() => {
  if (!selectedCall.value || !selectedCall.value.conversationId)
    return null
  return inbox.conversations.value.find(c => c.id === selectedCall.value!.conversationId) ?? null
})

const transcriptionState = computed(() => selectedCall.value?.transcriptionState ?? 'idle')
const transcriptionError = computed(() => selectedCall.value?.transcriptionError ?? null)
const transcript = computed(() => selectedCall.value?.transcript ?? '')
const summary = computed(() => selectedCall.value?.summary ?? '')

function openInConversation() {
  if (!selectedCall.value)
    return
  inbox.selectedConversationId.value = selectedCall.value.conversationId
  const { inboxView } = useInbox()
  inboxView.value = 'conversations'
}

function retryTranscription() {
  if (!selectedCall.value)
    return
  threeCxCalls.retryTranscription(selectedCall.value.conversationId, selectedCall.value.id)
}

function formatCallTimestamp(ts: string): string {
  const d = new Date(ts)
  if (isToday(d))
    return `Today, ${format(d, 'HH:mm')}`
  if (isYesterday(d))
    return `Yesterday, ${format(d, 'HH:mm')}`
  return format(d, 'd MMM, HH:mm')
}

function formatDuration(seconds: number): string {
  if (seconds === 0)
    return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function getStatusLabel(status: PhoneCallStatus): string {
  if (status === 'completed')
    return 'Completed'
  if (status === 'missed')
    return 'Missed'
  if (status === 'voicemail')
    return 'Voicemail'
  return 'Unknown'
}

function getStatusVariant(status: PhoneCallStatus): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'missed')
    return 'destructive'
  if (status === 'voicemail')
    return 'secondary'
  if (status === 'completed')
    return 'default'
  return 'outline'
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div v-if="!selectedCall" class="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <Icon name="lucide:phone" class="size-12 mb-3" />
      <p class="text-sm font-medium">
        Select a call to view details
      </p>
      <p class="text-xs mt-1 max-w-xs">
        Pick a call from the list to see the transcript, AI summary, and related conversation.
      </p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center gap-3 px-4 h-[56px] border-b shrink-0">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <div class="size-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
            {{ selectedConversation?.guestInitials ?? '?' }}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold truncate">{{ selectedConversation?.guestName ?? (isUnmatched ? selectedCall.from : 'Unknown caller') }}</span>
              <Badge v-if="isUnmatched" variant="secondary" class="text-[10px]">
                Unmatched
              </Badge>
              <Badge v-else :variant="getStatusVariant(selectedCall.status)" class="text-[10px]">
                {{ getStatusLabel(selectedCall.status) }}
              </Badge>
            </div>
            <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Icon :name="selectedCall.direction === 'outbound' ? 'lucide:phone-outgoing' : 'lucide:phone-incoming'" class="size-3" />
              <span>{{ selectedCall.direction === 'outbound' ? `To ${selectedCall.to}` : `From ${selectedCall.from}` }}</span>
              <span>·</span>
              <span>{{ formatCallTimestamp(selectedCall.timestamp) }}</span>
              <span v-if="selectedCall.duration > 0">·</span>
              <span v-if="selectedCall.duration > 0">{{ formatDuration(selectedCall.duration) }}</span>
            </div>
          </div>
        </div>
        <Button v-if="selectedConversation" size="sm" variant="outline" class="h-8 text-xs shrink-0" @click="openInConversation">
          <Icon name="lucide:message-square" class="size-3.5 mr-1.5" />
          Open conversation
        </Button>
      </div>

      <!-- Body -->
      <ScrollArea class="flex-1 min-h-0">
        <div class="p-6 space-y-6 max-w-3xl mx-auto">
          <div v-if="isUnmatched" class="rounded-lg border border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-300">
            <Icon name="lucide:info" class="size-4 inline-block mr-1.5" />
            This call has not been matched to a conversation. Use the Match button in the list to link it.
          </div>

          <!-- Answered by -->
          <section v-if="answeredBy">
            <div class="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <div class="size-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {{ answeredBy.initials }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">
                  {{ answeredBy.name }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ answeredBy.role }}<span v-if="answeredByExtension"> · Ext {{ answeredByExtension }}</span>
                </div>
              </div>
              <Badge variant="outline" class="text-[10px]">
                Answered
              </Badge>
            </div>
          </section>

          <!-- AI Summary -->
          <section v-if="summary">
            <div class="flex items-center gap-2 mb-2">
              <Icon name="lucide:sparkles" class="size-4 text-[#C8A84B]" />
              <h3 class="text-sm font-semibold">
                AI Summary
              </h3>
            </div>
            <p class="text-sm text-muted-foreground leading-relaxed rounded-lg border bg-muted/30 p-3">
              {{ summary }}
            </p>
          </section>

          <!-- Recording -->
          <section v-if="selectedCall.recording_url">
            <div class="flex items-center gap-2 mb-2">
              <Icon name="lucide:audio-lines" class="size-4 text-muted-foreground" />
              <h3 class="text-sm font-semibold">
                Recording
              </h3>
            </div>
            <div class="rounded-lg border bg-muted/30 px-3 py-2">
              <AiElementsAudioPlayer>
                <AiElementsAudioPlayerElement :src="selectedCall.recording_url" />
                <AiElementsAudioPlayerControlBar>
                  <AiElementsAudioPlayerPlayButton />
                  <AiElementsAudioPlayerSeekBackwardButton />
                  <AiElementsAudioPlayerSeekForwardButton />
                  <AiElementsAudioPlayerTimeDisplay />
                  <AiElementsAudioPlayerTimeRange />
                  <AiElementsAudioPlayerDurationDisplay />
                  <AiElementsAudioPlayerMuteButton />
                  <AiElementsAudioPlayerVolumeRange />
                </AiElementsAudioPlayerControlBar>
              </AiElementsAudioPlayer>
            </div>
          </section>

          <!-- Transcript -->
          <section>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <Icon name="lucide:file-text" class="size-4 text-muted-foreground" />
                <h3 class="text-sm font-semibold">
                  Transcript
                </h3>
              </div>
              <Badge v-if="transcriptionState === 'processing'" variant="secondary" class="text-[10px]">
                <Icon name="lucide:loader-2" class="size-3 mr-1 animate-spin" />
                Processing
              </Badge>
              <Badge v-else-if="transcriptionState === 'failed'" variant="destructive" class="text-[10px]">
                Failed
              </Badge>
            </div>

            <div v-if="transcriptionState === 'processing'" class="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <Icon name="lucide:loader-2" class="size-5 mx-auto mb-2 animate-spin" />
              Generating transcript...
            </div>

            <div v-else-if="transcriptionState === 'failed'" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-2">
              <p class="text-destructive">
                {{ transcriptionError ?? 'Transcription failed.' }}
              </p>
              <Button size="sm" variant="outline" class="h-7 text-xs" @click="retryTranscription">
                <Icon name="lucide:refresh-cw" class="size-3 mr-1" />
                Retry
              </Button>
            </div>

            <div v-else-if="transcript" class="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {{ transcript }}
            </div>

            <div v-else class="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <Icon name="lucide:file-x" class="size-5 mx-auto mb-2" />
              No transcript available.
            </div>
          </section>
        </div>
      </ScrollArea>
    </template>
  </div>
</template>
