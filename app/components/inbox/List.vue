<script lang="ts" setup>
import type { Conversation } from '~/components/inbox/data/conversations'
import { Search } from 'lucide-vue-next'
import { otaSources } from '~/components/inbox/data/conversations'
import { cn } from '~/lib/utils'

interface ListProps {
  items: Conversation[]
}

defineProps<ListProps>()
const selectedConversationId = defineModel<string | undefined>('selectedConversationId', { required: false })

const { showActionNeeded, unreadFilter, assignedToMeFilter, activeChannelFilter, activeStaffFilter, activeStayFilter, activeDateFilter, searchValue, sortBy, channelOptions, setChannelFilter, clearChannelFilter, staffMembers, toggleStaffFilter, clearStaffFilter } = useInbox()
const { isGro } = useGroScope()

const otaIconMap: Record<string, string> = Object.fromEntries(otaSources.map(s => [s.name, s.icon]))

const dateSubFilters = computed(() => {
  if (activeStayFilter.value === 'future') {
    return [
      { key: 'today', label: 'Today' },
      { key: 'next-3-days', label: 'Next 3 Days' },
      { key: 'next-week', label: 'Next Week' },
    ]
  }
  if (activeStayFilter.value === 'current') {
    return [
      { key: 'today', label: 'Today' },
      { key: 'next-3-days', label: 'Next 3 Days' },
      { key: 'next-week', label: 'Next Week' },
    ]
  }
  return []
})

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'unread', label: 'Unread' },
]

const filterOpen = ref(false)

const activeFilterCount = computed(() => {
  let count = 0
  if (showActionNeeded.value)
    count++
  if (unreadFilter.value)
    count++
  if (assignedToMeFilter.value)
    count++
  if (activeChannelFilter.value)
    count++
  if (activeStaffFilter.value.length > 0)
    count++
  return count
})

function onSelectConversation(id: string) {
  selectedConversationId.value = id
  const { inboxView } = useInbox()
  if (inboxView.value !== 'conversations')
    inboxView.value = 'conversations'
}
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0">
    <div class="flex h-[56px] items-center gap-2 px-4 shrink-0">
      <div v-if="!isGro" class="relative flex-1">
        <Search class="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input v-model="searchValue" placeholder="Search guests, listings, tags..." class="pl-8 h-8" />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs">
            <Icon name="lucide:arrow-up-down" class="size-3.5 shrink-0" />
            <span class="truncate">{{ sortOptions.find(o => o.value === sortBy)?.label }}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem
            v-for="option in sortOptions"
            :key="option.value"
            :class="{ 'bg-accent': sortBy === option.value }"
            @click="sortBy = option.value as any"
          >
            <Icon :name="option.value === 'newest' ? 'lucide:arrow-down-z-a' : option.value === 'oldest' ? 'lucide:arrow-up-z-a' : 'lucide:mail'" class="mr-2 size-4" />
            {{ option.label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover v-model:open="filterOpen">
        <PopoverTrigger as-child>
          <Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" :class="activeFilterCount > 0 ? 'border-primary text-primary' : ''">
            <Icon name="lucide:sliders-horizontal" class="size-3.5 shrink-0" />
            <span class="truncate">Filters</span>
            <span v-if="activeFilterCount > 0" class="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] leading-none text-primary-foreground">{{ activeFilterCount }}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-64 p-0" align="end" :side-offset="4">
          <div class="p-3">
            <div class="text-xs font-medium text-muted-foreground mb-2">
              Status
            </div>
            <div class="flex flex-col gap-1">
              <button
                type="button"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                :class="showActionNeeded ? 'bg-accent' : ''"
                @click="showActionNeeded = !showActionNeeded"
              >
                <div
                  :class="cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                    showActionNeeded ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )"
                >
                  <Icon v-if="showActionNeeded" name="lucide:check" class="size-3" />
                </div>
                <Icon name="lucide:circle-alert" class="size-3.5 text-destructive" />
                Action Needed
              </button>
              <button
                type="button"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                :class="unreadFilter ? 'bg-accent' : ''"
                @click="unreadFilter = !unreadFilter"
              >
                <div
                  :class="cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                    unreadFilter ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )"
                >
                  <Icon v-if="unreadFilter" name="lucide:check" class="size-3" />
                </div>
                <Icon name="lucide:mail" class="size-3.5" />
                Unread
              </button>
              <button
                type="button"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                :class="assignedToMeFilter ? 'bg-accent' : ''"
                @click="assignedToMeFilter = !assignedToMeFilter"
              >
                <div
                  :class="cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                    assignedToMeFilter ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )"
                >
                  <Icon v-if="assignedToMeFilter" name="lucide:check" class="size-3" />
                </div>
                <Icon name="lucide:user-check" class="size-3.5" />
                Assigned to Me
              </button>
            </div>
          </div>

          <Separator />

          <div class="p-3">
            <div class="text-xs font-medium text-muted-foreground mb-2">
              Channel
            </div>
            <div class="flex flex-col gap-1">
              <button
                type="button"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                :class="!activeChannelFilter ? 'bg-accent' : ''"
                @click="clearChannelFilter()"
              >
                <Icon name="lucide:globe" class="size-3.5" />
                All Channels
              </button>
              <button
                v-for="ch of channelOptions"
                :key="ch.channel"
                type="button"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                :class="activeChannelFilter === ch.channel ? 'bg-accent' : ''"
                @click="setChannelFilter(ch.channel)"
              >
                <Icon :name="otaIconMap[ch.channel] ?? 'lucide:globe'" class="size-3.5" />
                {{ ch.channel }}
                <span class="ml-auto text-muted-foreground text-xs">{{ ch.count }}</span>
              </button>
            </div>
          </div>

          <Separator />

          <div class="p-3">
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs font-medium text-muted-foreground">
                Staff
              </div>
              <button
                v-if="activeStaffFilter.length > 0"
                type="button"
                class="text-[10px] text-muted-foreground hover:text-foreground"
                @click="clearStaffFilter()"
              >
                Clear
              </button>
            </div>
            <div class="flex flex-col gap-1">
              <button
                v-for="staff of staffMembers"
                :key="staff.id"
                type="button"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                :class="activeStaffFilter.includes(staff.id) ? 'bg-accent' : ''"
                @click="toggleStaffFilter(staff.id)"
              >
                <div
                  :class="cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                    activeStaffFilter.includes(staff.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )"
                >
                  <Icon v-if="activeStaffFilter.includes(staff.id)" name="lucide:check" class="size-3" />
                </div>
                <div class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium">
                  {{ staff.initials }}
                </div>
                {{ staff.name }}
              </button>
              <button
                type="button"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                :class="activeStaffFilter.includes('unassigned') ? 'bg-accent' : ''"
                @click="toggleStaffFilter('unassigned')"
              >
                <div
                  :class="cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                    activeStaffFilter.includes('unassigned') ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )"
                >
                  <Icon v-if="activeStaffFilter.includes('unassigned')" name="lucide:check" class="size-3" />
                </div>
                <Icon name="lucide:user-x" class="size-3.5 text-muted-foreground" />
                Unassigned
              </button>
            </div>
          </div>

          <div v-if="activeFilterCount > 0" class="border-t px-3 py-2">
            <Button variant="ghost" size="sm" class="w-full h-7 text-xs text-muted-foreground" @click="showActionNeeded = false; unreadFilter = false; assignedToMeFilter = false; clearChannelFilter(); clearStaffFilter()">
              Clear all filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <!-- Date sub-filters for Current/Future -->
    <div v-if="activeStayFilter === 'current' || activeStayFilter === 'future'" class="flex shrink-0 items-center gap-1.5 border-b px-4 py-2">
      <span class="text-[10px] text-muted-foreground shrink-0">
        {{ activeStayFilter === 'future' ? 'Check-in' : 'Check-out' }}:
      </span>
      <Badge
        v-for="df in dateSubFilters"
        :key="df.key"
        :variant="activeDateFilter === df.key ? 'default' : 'outline'"
        class="cursor-pointer select-none text-[10px] px-2 py-0.5"
        @click="activeDateFilter = activeDateFilter === df.key ? null : df.key"
      >
        {{ df.label }}
      </Badge>
    </div>

    <Separator class="shrink-0" />

    <ScrollArea class="flex-1 min-h-0">
      <div v-if="items.length === 0" class="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Icon name="lucide:inbox" class="size-10 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">
          You're all caught up!
        </p>
        <button
          class="text-sm text-muted-foreground hover:underline"
          @click="showActionNeeded = false; unreadFilter = false; assignedToMeFilter = false; clearChannelFilter(); clearStaffFilter()"
        >
          View all conversations
        </button>
      </div>

      <div v-else class="flex flex-col gap-2 px-4 pt-3 pb-4">
        <TransitionGroup name="list">
          <InboxListItem
            v-for="item of items"
            :key="item.id"
            :conversation="item"
            :is-selected="selectedConversationId === item.id"
            @select="onSelectConversation(item.id)"
          />
        </TransitionGroup>
      </div>
    </ScrollArea>
  </div>
</template>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(15px);
}
</style>
