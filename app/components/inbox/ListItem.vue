<script lang="ts" setup>
import type { CleaningStatus, Conversation, StayStatus } from '~/components/inbox/data/conversations'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'vue-sonner'
import { otaSources, resolveConversationTenantId } from '~/components/inbox/data/conversations'
import { cn } from '~/lib/utils'

interface ListItemProps {
  conversation: Conversation
  isSelected: boolean
}

interface ListItemEmits {
  select: []
}

const props = defineProps<ListItemProps>()
const emit = defineEmits<ListItemEmits>()

const statusVariantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  action_needed: 'destructive',
}

const statusLabelMap: Record<string, string> = {
  action_needed: 'Action Needed',
}

const stayStatusConfig: Record<StayStatus, { label: string, class: string }> = {
  inquiry: { label: 'Inquiry', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  current: { label: 'Current', class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  future: { label: 'Future', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  past: { label: 'Past', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  unmatched: { label: 'Unmatched', class: 'bg-background text-muted-foreground border' },
}

const cleaningIconColor: Record<CleaningStatus, string> = {
  need_cleaning: 'text-red-500',
  in_progress: 'text-yellow-500',
  cleaning_finished: 'text-green-500',
}

const cleaningLabel: Record<CleaningStatus, string> = {
  need_cleaning: 'Need Cleaning',
  in_progress: 'In Progress',
  cleaning_finished: 'Cleaning Finished',
}

function handleCleaningClick(conv: Conversation) {
  // Mark as need_cleaning when clicking finished
  const { conversations } = useInbox()
  const idx = conversations.value.findIndex(c => c.id === conv.id)
  if (idx !== -1) {
    conversations.value[idx] = { ...conversations.value[idx], cleaningStatus: 'need_cleaning' }
    toast.info('Marked as Need Cleaning')
  }
}

const otaIconMap: Record<string, string> = Object.fromEntries(otaSources.map(s => [s.name, s.icon]))
const stayConfig = computed(() => stayStatusConfig[props.conversation.stayStatus])

const gro = useGroScope()
const tenantId = computed(() => resolveConversationTenantId(props.conversation))
const tenantName = computed(() => gro.tenantName(tenantId.value))

const stayDateLabel = computed(() => {
  if (!props.conversation.checkIn || !props.conversation.checkOut)
    return ''
  const checkIn = new Date(props.conversation.checkIn)
  const checkOut = new Date(props.conversation.checkOut)
  return `${format(checkIn, 'd MMM yyyy')} – ${format(checkOut, 'd MMM yyyy')}`
})
</script>

<template>
  <button
    :class="cn(
      'flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent',
      isSelected && 'bg-muted',
    )"
    @click="emit('select')"
  >
    <div class="w-full flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
        >
          {{ conversation.guestInitials }}
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold truncate">{{ conversation.guestName }}</span>
            <Badge v-if="conversation.unreadCount > 0" class="h-5 min-w-5 rounded-full px-1.5 text-[10px]" variant="default">
              {{ conversation.unreadCount }}
            </Badge>
          </div>
          <div class="flex items-center gap-1.5">
            <Tooltip v-if="conversation.cleaningStatus && conversation.listingName !== 'Unknown'" :delay-duration="0">
              <TooltipTrigger as-child>
                <span
                  role="button"
                  :class="cn('inline-flex items-center', conversation.cleaningStatus === 'cleaning_finished' && 'cursor-pointer hover:opacity-70')"
                  @click.stop="conversation.cleaningStatus === 'cleaning_finished' && handleCleaningClick(conversation)"
                >
                  <Icon name="lucide:spray-can" :class="cn('size-3 shrink-0', cleaningIconColor[conversation.cleaningStatus])" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" class="text-xs">
                {{ cleaningLabel[conversation.cleaningStatus] }}
                <span v-if="conversation.cleaningStatus === 'cleaning_finished'" class="text-muted-foreground"> · Click to mark</span>
              </TooltipContent>
            </Tooltip>
            <span class="text-xs text-muted-foreground truncate">{{ conversation.listingName }}</span>
            <span
              v-if="gro.isGro.value"
              class="inline-flex shrink-0 items-center rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground"
            >
              {{ tenantName }}
            </span>
          </div>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-xs text-muted-foreground">
          {{ formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true }) }}
        </div>
        <Badge v-if="conversation.status === 'action_needed'" :variant="statusVariantMap[conversation.status]" class="text-[10px]">
          {{ statusLabelMap[conversation.status] }}
        </Badge>
      </div>
    </div>

    <div class="w-full flex items-center gap-3 min-w-0">
      <p class="line-clamp-1 text-xs text-muted-foreground flex-1 min-w-0">
        {{ conversation.lastMessage }}
      </p>
    </div>

    <div class="w-full flex items-center justify-between gap-3">
      <Icon :name="otaIconMap[conversation.otaSource] ?? 'lucide:globe'" class="size-4 shrink-0" />
      <div class="flex items-center gap-1.5 min-w-0">
        <span v-if="stayDateLabel" class="text-[10px] text-muted-foreground truncate">{{ stayDateLabel }}</span>
        <span :class="cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium', stayConfig.class)">
          {{ stayConfig.label }}
        </span>
      </div>
    </div>
  </button>
</template>
