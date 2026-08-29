<script lang="ts" setup>
import type { PhoneCallStatus } from '~/components/inbox/data/conversations'
import { endOfDay, format, isToday, isYesterday, startOfDay, subDays } from 'date-fns'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

const inbox = useInbox()
const threeCX = useThreeCX()
const { isGro } = useGroScope()
const {
  searchQuery,
  activeCallsFilter,
  staffFilter,
  dateRange,
  filterOpen,
  filteredMatched,
  filteredUnmatched,
  filterCount,
  clearFilters,
} = useCallsFilters()

const selectedCallId = useState<string | null>('calls-selected-id', () => null)

const matchDialogOpen = ref(false)
const matchSearch = ref('')
const matchSelectedUnmatchedId = ref<string | null>(null)

const matchOptions = computed(() => {
  const q = matchSearch.value.trim().toLowerCase()
  return inbox.conversations.value
    .filter(c => c.stayStatus !== 'unmatched' && (!q || c.guestName.toLowerCase().includes(q) || c.listingName.toLowerCase().includes(q)))
    .slice(0, 12)
})

function openMatchDialog(unmatchedId: string) {
  matchSelectedUnmatchedId.value = unmatchedId
  matchSearch.value = ''
  matchDialogOpen.value = true
}

function handleMatchUnmatched() {
  if (!matchSelectedUnmatchedId.value)
    return
  threeCX.matchUnmatchedCall(matchSelectedUnmatchedId.value)
  toast.success('Unmatched call linked to conversation.')
  matchDialogOpen.value = false
  matchSelectedUnmatchedId.value = null
}

function handleDismissUnmatched(id: string) {
  threeCX.dismissUnmatchedCall(id)
  toast.info('Unmatched call dismissed.')
}

function selectCall(id: string) {
  selectedCallId.value = id
  const matched = filteredMatched.value.find(c => c.id === id)
  if (matched && matched.conversationId)
    inbox.selectedConversationId.value = matched.conversationId
  else
    inbox.selectedConversationId.value = undefined
}

function formatCallTimestamp(ts: string): string {
  const d = new Date(ts)
  if (isToday(d))
    return `Today, ${format(d, 'h:mm a')}`
  if (isYesterday(d))
    return `Yesterday, ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, h:mm a')
}

function formatDuration(seconds: number): string {
  if (seconds === 0)
    return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function staffName(staffId: string | null): string {
  if (!staffId)
    return 'Unassigned'
  return inbox.staffMembers.find(s => s.id === staffId)?.name ?? 'Unassigned'
}

function staffInitials(staffId: string | null): string {
  if (!staffId)
    return '?'
  return inbox.staffMembers.find(s => s.id === staffId)?.initials ?? '?'
}

function getStatusIconClass(status: PhoneCallStatus): string {
  if (status === 'completed')
    return 'text-green-600'
  if (status === 'missed')
    return 'text-red-500'
  if (status === 'voicemail')
    return 'text-purple-500'
  return 'text-muted-foreground'
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
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Header -->
    <div class="flex h-[56px] items-center gap-2 px-4 shrink-0 border-b">
      <div v-if="!isGro" class="relative flex-1">
        <Icon name="lucide:search" class="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search calls by guest, listing, or number..." class="pl-8 h-8" />
      </div>
      <Popover v-model:open="filterOpen">
        <PopoverTrigger as-child>
          <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" :class="filterCount > 0 ? 'border-primary text-primary' : ''">
            <Icon name="lucide:sliders-horizontal" class="size-3.5 shrink-0" />
            Filters
            <span v-if="filterCount > 0" class="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] leading-none text-primary-foreground">{{ filterCount }}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-72 p-0" align="end" :side-offset="4">
          <div class="p-3 space-y-3">
            <div>
              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Status</Label>
              <Select :model-value="activeCallsFilter" @update:model-value="(v: any) => activeCallsFilter = v">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                  <SelectItem value="unmatched">Unmatched</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Staff / Extension</Label>
              <Select :model-value="staffFilter" @update:model-value="(v: any) => staffFilter = v">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem v-for="s in inbox.staffMembers" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Date range</Label>
              <Select :model-value="dateRange" @update:model-value="(v: any) => dateRange = v">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last-7-days">Last 7 days</SelectItem>
                  <SelectItem value="last-30-days">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" size="sm" class="w-full text-xs" @click="clearFilters">
              Clear filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <!-- Call list -->
    <ScrollArea class="flex-1 min-h-0">
      <div class="p-4 space-y-2">
        <!-- Unmatched section -->
        <div v-if="filteredUnmatched.length" class="rounded-lg border border-dashed border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20 p-3 mb-2">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="lucide:phone-missed" class="size-4 text-amber-600" />
            <span class="text-xs font-medium text-amber-700 dark:text-amber-400">Unmatched calls ({{ filteredUnmatched.length }})</span>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="call in filteredUnmatched"
              :key="call.id"
              class="flex items-center gap-3 rounded-md bg-background border px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
              :class="selectedCallId === call.id && 'ring-2 ring-primary'"
              @click="selectCall(call.id)"
            >
              <Icon name="lucide:phone-missed" class="size-4 shrink-0" :class="getStatusIconClass(call.status)" />
              <div class="flex-1 min-w-0 space-y-0.5">
                <div class="text-sm font-medium truncate">
                  {{ call.fromNumber }}
                </div>
                <div class="text-[10px] text-muted-foreground">
                  {{ call.status === 'voicemail' ? 'Voicemail' : call.status === 'missed' ? 'Missed call' : 'Completed' }}
                  · Ext {{ call.toExtension }} · {{ formatCallTimestamp(call.timestamp) }}
                </div>
                <div v-if="call.staffId" class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div class="size-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-semibold">
                    {{ staffInitials(call.staffId) }}
                  </div>
                  <span>Answered by {{ staffName(call.staffId) }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <Button size="sm" variant="outline" class="h-7 text-xs" @click="openMatchDialog(call.id)">
                  Match
                </Button>
                <Button size="icon" variant="ghost" class="size-7 text-muted-foreground" @click="handleDismissUnmatched(call.id)">
                  <Icon name="lucide:x" class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Matched calls -->
        <div
          v-for="call in filteredMatched"
          :key="call.id"
          class="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
          :class="selectedCallId === call.id && 'ring-2 ring-primary'"
          @click="selectCall(call.id)"
        >
          <Icon :name="call.direction === 'outbound' ? 'lucide:phone-outgoing' : 'lucide:phone-incoming'" class="size-4 shrink-0" :class="getStatusIconClass(call.status)" />
          <div class="flex flex-col min-w-0 flex-1 gap-0.5">
            <div class="text-sm font-medium truncate">
              {{ call._guestName }}
            </div>
            <div class="text-xs text-muted-foreground truncate">
              {{ call._listingName }}
            </div>
            <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span class="flex items-center gap-1">
                <span>{{ call.direction === 'outbound' ? `To ${call.to}` : `From ${call.from}` }}</span>
                <span v-if="call.duration > 0">· {{ formatDuration(call.duration) }}</span>
                <span>· {{ formatCallTimestamp(call.timestamp) }}</span>
              </span>
            </div>
            <div v-if="call._staffId" class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div class="size-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-semibold">
                {{ staffInitials(call._staffId) }}
              </div>
              <span>Answered by {{ staffName(call._staffId) }}</span>
              <span v-if="call._extensionNumber" class="text-muted-foreground/60">· Ext {{ call._extensionNumber }}</span>
            </div>
          </div>
        </div>

        <div v-if="!filteredMatched.length && !filteredUnmatched.length" class="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Icon name="lucide:phone-off" class="size-10 mb-2" />
          <p class="text-sm">
            No calls match the current filters
          </p>
        </div>
      </div>
    </ScrollArea>

    <Dialog v-model:open="matchDialogOpen">
      <DialogContent class="flex max-h-[80vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Match call to guest</DialogTitle>
          <DialogDescription>Pick a conversation to attach this unmatched call to.</DialogDescription>
        </DialogHeader>
        <Input v-model="matchSearch" placeholder="Search guest or listing..." class="h-9 shrink-0" />
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div class="space-y-1 pr-1">
            <button
              v-for="c of matchOptions"
              :key="c.id"
              type="button"
              class="flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left hover:bg-accent"
              @click="handleMatchUnmatched"
            >
              <span class="text-sm font-medium">{{ c.guestName }}</span>
              <span class="text-xs text-muted-foreground truncate">{{ c.listingName }}</span>
            </button>
            <div v-if="matchOptions.length === 0" class="py-6 text-center text-sm text-muted-foreground">
              No matching conversations.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
