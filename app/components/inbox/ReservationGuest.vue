<script lang="ts" setup>
import type { CleaningStatus, Conversation, GuestDetails, GuestSentiment, GuestVerification, Reservation, StayStatus } from '~/components/inbox/data/conversations'
import { format } from 'date-fns'
import { toast } from 'vue-sonner'
import { otaSources, resolveConversationTenantId, staffMembers } from '~/components/inbox/data/conversations'
import { cn } from '~/lib/utils'

interface ReservationGuestProps {
  guest: GuestDetails
  reservation: Reservation
  stayStatus: StayStatus
  conversation: Conversation
  sentiment: GuestSentiment
  sentimentNote: string
}

const props = defineProps<ReservationGuestProps>()

const sentimentConfig: Record<string, { emoji: string, label: string, class: string }> = {
  positive: {
    emoji: '😊',
    label: 'Positive',
    class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  neutral: {
    emoji: '😐',
    label: 'Neutral',
    class: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
  negative: {
    emoji: '😠',
    label: 'Negative',
    class: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
}

const sentimentCfg = computed(() => sentimentConfig[props.sentiment] ?? sentimentConfig.neutral!)

const { assignTo, getAssignedStaff, isElevaiEnabled, getElevaiState, enableElevai, pauseElevai, disableElevai } = useInbox()
const gro = useGroScope()
const threeCX = useThreeCX()
const threeCXCalls = useThreeCxCalls()
const isInitiatingCall = ref(false)

async function handleClickToCall() {
  if (!props.guest.phone || isInitiatingCall.value)
    return
  const me = 'staff-2'
  const myExtension = threeCX.getExtensionForStaff(me) ?? '1001'
  isInitiatingCall.value = true
  try {
    await threeCXCalls.simulateOutboundCall({
      fromExtension: myExtension,
      toNumber: props.guest.phone,
      staffId: me,
      conversationId: props.conversation.id,
    })
    toast.success('Call initiated.')
  }
  catch {
    toast.error('Could not start the call. Please try again.')
  }
  finally {
    isInitiatingCall.value = false
  }
}

const initials = computed(() =>
  props.guest.name.split(' ').map(n => n[0]).join(''),
)

const stayStatusConfig: Record<StayStatus, { label: string, class: string }> = {
  inquiry: { label: 'Inquiry', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  current: { label: 'Current Stay', class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  future: { label: 'Upcoming', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  past: { label: 'Checked Out', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  unmatched: { label: 'Unmatched', class: 'bg-background text-muted-foreground border' },
}

const verificationConfig: Record<GuestVerification, { label: string, icon: string, class: string }> = {
  unverified: { label: 'Unverified', icon: 'lucide:circle-dot', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  verified: { label: 'Verified', icon: 'lucide:shield-check', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  check_in: { label: 'Checked In', icon: 'lucide:log-in', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  check_out: { label: 'Checked Out', icon: 'lucide:log-out', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
}

const cleaningStatusConfig: Record<CleaningStatus, { label: string, icon: string, class: string }> = {
  need_cleaning: { label: 'Need Cleaning', icon: 'lucide:spray-can', class: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  in_progress: { label: 'In Progress', icon: 'lucide:spray-can', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  cleaning_finished: { label: 'Cleaning Finished', icon: 'lucide:spray-can', class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
}

const stayCfg = computed(() => stayStatusConfig[props.stayStatus])
const verificationCfg = computed(() => props.conversation.verification ? verificationConfig[props.conversation.verification] : null)
const cleaningCfg = computed(() => props.conversation.cleaningStatus ? cleaningStatusConfig[props.conversation.cleaningStatus] : null)
const otaIconMap: Record<string, string> = Object.fromEntries(otaSources.map(s => [s.name, s.icon]))
const hasDates = computed(() => !!props.reservation.checkIn && !!props.reservation.checkOut)
const checkInDate = computed(() => hasDates.value ? new Date(props.reservation.checkIn) : null)
const checkOutDate = computed(() => hasDates.value ? new Date(props.reservation.checkOut) : null)

const assignedStaff = computed(() => getAssignedStaff(props.conversation))

const assignSearch = ref('')

const filteredStaff = computed(() => {
  const q = assignSearch.value.toLowerCase()
  if (!q)
    return staffMembers
  return staffMembers.filter(s =>
    s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q),
  )
})

const assignOpen = ref(false)

function handleAssign(staffId: string | null) {
  assignTo(props.conversation.id, staffId)
  assignOpen.value = false
  assignSearch.value = ''
  if (staffId) {
    const staff = staffMembers.find(s => s.id === staffId)
    toast.success(`Assigned to ${staff?.name ?? 'staff'}`)
  }
  else {
    toast.info('Unassigned conversation')
  }
}

// ElevAI toggle
const elevaiOn = computed(() => isElevaiEnabled(props.conversation.id))

const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval>
onMounted(() => { ticker = setInterval(() => { now.value = Date.now() }, 15000) })
onUnmounted(() => clearInterval(ticker))

const elevaiPausedMins = computed(() => {
  const s = getElevaiState(props.conversation.id)
  if (!s.on && s.pausedUntil !== undefined) {
    const remaining = s.pausedUntil - now.value
    return remaining > 0 ? Math.ceil(remaining / 60000) : null
  }
  return null
})

function handleElevaiEnable() {
  enableElevai(props.conversation.id)
  toast.success('ElevAI enabled')
}

function handleElevaiPause() {
  pauseElevai(props.conversation.id, 15)
  toast.info('ElevAI paused for 15 minutes')
}

function handleElevaiDisable() {
  disableElevai(props.conversation.id)
  toast.info('ElevAI turned off')
}
</script>

<template>
  <div class="space-y-3">
    <!-- Guest header -->
    <div class="flex items-start gap-3">
      <Avatar class="size-12 shrink-0">
        <AvatarFallback class="text-sm font-semibold">
          {{ initials }}
        </AvatarFallback>
      </Avatar>
      <div class="flex-1 min-w-0 pt-0.5">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm leading-tight">{{ guest.name }}</span>
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <span :class="cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium cursor-default', sentimentCfg.class)">
                  <span class="text-xs leading-none">{{ sentimentCfg.emoji }}</span>
                  {{ sentimentCfg.label }}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" class="max-w-[200px] text-xs">
                <span class="font-medium">ElevAI Sentiment</span>
                <p class="text-muted-foreground mt-0.5">
                  {{ sentimentNote }}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div class="flex items-center gap-1.5 mt-1 flex-wrap">
          <span :class="cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', stayCfg.class)">
            {{ stayCfg.label }}
          </span>
          <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
            <Icon :name="otaIconMap[reservation.otaSource] ?? 'lucide:globe'" class="size-3" />
            {{ reservation.otaSource }}
          </span>
          <span v-if="verificationCfg" :class="cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium gap-1', verificationCfg.class)">
            <Icon :name="verificationCfg.icon" class="size-3" />
            {{ verificationCfg.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- Stay dates card -->
    <div v-if="hasDates" class="rounded-lg border bg-muted/40 p-3 space-y-2.5">
      <div class="flex items-center">
        <div class="flex-1 text-center">
          <div class="text-[10px] text-muted-foreground mb-0.5">
            Check-in
          </div>
          <div class="font-semibold text-sm">
            {{ format(checkInDate!, 'EEEE, d MMM yyyy') }}
          </div>
          <div class="text-[10px] text-muted-foreground">
            {{ format(checkInDate!, 'h:mm a') }}
          </div>
        </div>
        <div class="flex flex-col items-center gap-0.5 px-3">
          <div class="flex items-center gap-1 text-muted-foreground">
            <div class="h-px w-5 bg-border" />
            <Icon name="lucide:moon" class="size-3 text-muted-foreground" />
            <div class="h-px w-5 bg-border" />
          </div>
          <div class="text-[10px] font-medium text-muted-foreground">
            {{ reservation.nights }}n
          </div>
        </div>
        <div class="flex-1 text-center">
          <div class="text-[10px] text-muted-foreground mb-0.5">
            Check-out
          </div>
          <div class="font-semibold text-sm">
            {{ format(checkOutDate!, 'EEEE, d MMM yyyy') }}
          </div>
          <div class="text-[10px] text-muted-foreground">
            {{ format(checkOutDate!, 'h:mm a') }}
          </div>
        </div>
      </div>
      <Separator />
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-muted-foreground">
          <Icon name="lucide:users" class="size-3.5" />
          <span class="text-xs">{{ reservation.guestCount }} guest{{ reservation.guestCount !== 1 ? 's' : '' }}</span>
        </div>
        <div class="text-sm font-semibold">
          {{ reservation.currency }} {{ reservation.totalPrice.toLocaleString() }}
        </div>
      </div>
    </div>

    <!-- Property + Contact -->
    <div class="rounded-lg border bg-muted/50 divide-y">
      <div class="p-3 flex items-start gap-2.5">
        <Icon name="lucide:home" class="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium truncate">
            {{ reservation.listingName }}
          </div>
          <div
            v-if="gro.isGro.value"
            class="mt-0.5 text-[10px] text-muted-foreground"
          >
            {{ gro.tenantName(resolveConversationTenantId(conversation)) }}
          </div>
          <div v-if="cleaningCfg && conversation.listingName !== 'Unknown'" class="mt-1.5">
            <span :class="cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cleaningCfg.class)">
              <Icon :name="cleaningCfg.icon" class="size-3" />
              {{ cleaningCfg.label }}
            </span>
          </div>
        </div>
      </div>
      <div class="p-3 space-y-2">
        <div class="flex items-center gap-2.5">
          <Icon name="lucide:mail" class="size-3.5 shrink-0 text-muted-foreground" />
          <span class="text-xs truncate">{{ guest.email }}</span>
        </div>
        <div class="flex items-center gap-2.5">
          <Icon name="lucide:phone" class="size-3.5 shrink-0 text-muted-foreground" />
          <span class="text-xs flex-1 truncate">{{ guest.phone }}</span>
          <Button
            variant="ghost"
            size="icon"
            class="size-6"
            :disabled="isInitiatingCall || !threeCX.isConnected.value"
            :title="threeCX.isConnected.value ? 'Call guest' : 'Connect 3CX in Settings to enable calls'"
            @click="handleClickToCall"
          >
            <Icon v-if="isInitiatingCall" name="lucide:loader-circle" class="size-3 animate-spin" />
            <Icon v-else name="lucide:phone-call" class="size-3" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Assign To -->
    <Popover v-model:open="assignOpen">
      <PopoverTrigger as-child>
        <Button variant="outline" role="combobox" :aria-expanded="assignOpen" class="w-full justify-start h-auto py-1.5 px-3">
          <template v-if="assignedStaff">
            <Avatar class="size-5 mr-2 shrink-0">
              <AvatarFallback class="text-[9px]">
                {{ assignedStaff.initials }}
              </AvatarFallback>
            </Avatar>
            <div class="text-left">
              <div class="text-xs font-medium">
                {{ assignedStaff.name }}
              </div>
              <div class="text-[10px] text-muted-foreground">
                {{ assignedStaff.role }}
              </div>
            </div>
          </template>
          <template v-else>
            <Icon name="lucide:plus" class="size-4 mr-2 text-muted-foreground" />
            <span class="text-xs text-muted-foreground">Assign staff...</span>
          </template>
          <Icon name="lucide:chevrons-up-down" class="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-[220px] p-0" align="start" :side-offset="4">
        <Command>
          <CommandInput v-model="assignSearch" placeholder="Search staff..." />
          <CommandList>
            <CommandEmpty>No staff found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                v-for="member of filteredStaff"
                :key="member.id"
                :value="member.name"
                class="cursor-pointer hover:bg-accent"
                @select="handleAssign(member.id)"
              >
                <Avatar class="size-6 shrink-0">
                  <AvatarFallback class="text-[10px]">
                    {{ member.initials }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium truncate">
                    {{ member.name }}
                  </div>
                  <div class="text-[10px] text-muted-foreground">
                    {{ member.role }}
                  </div>
                </div>
                <Icon v-if="conversation.assignedTo === member.id" name="lucide:check" class="size-4 shrink-0 text-primary" />
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__unassign__"
                class="cursor-pointer hover:bg-accent"
                @select="handleAssign(null)"
              >
                <Icon name="lucide:user-x" class="size-4 text-muted-foreground" />
                <span class="text-xs text-muted-foreground">Unassign</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>

    <!-- ElevAI Toggle -->
    <div class="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
      <div class="flex items-center gap-2">
        <Icon name="lucide:sparkles" class="size-3.5 text-[#FBC800]" />
        <div>
          <div class="text-xs font-medium">
            ElevAI
          </div>
          <div v-if="elevaiPausedMins" class="text-[10px] text-amber-500 font-medium">
            Paused · {{ elevaiPausedMins }}m left
          </div>
        </div>
      </div>
      <DropdownMenu v-if="elevaiOn">
        <DropdownMenuTrigger as-child>
          <button class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full bg-warning transition-colors">
            <span class="pointer-events-none inline-block size-4 rounded-full bg-white shadow-lg ring-0 transition-transform translate-x-4" style="margin-top: 2px;" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuItem @click="handleElevaiPause">
            <Icon name="lucide:clock" class="size-4 mr-2" />
            Pause for 15 minutes
          </DropdownMenuItem>
          <DropdownMenuItem @click="handleElevaiDisable">
            <Icon name="lucide:power-off" class="size-4 mr-2" />
            Turn off
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        v-else
        class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full bg-muted-foreground/30 transition-colors"
        @click="handleElevaiEnable"
      >
        <span class="pointer-events-none inline-block size-4 rounded-full bg-white shadow-lg ring-0 transition-transform translate-x-0.5" style="margin-top: 2px;" />
      </button>
    </div>
  </div>
</template>
