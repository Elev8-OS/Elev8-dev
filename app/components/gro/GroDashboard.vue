<script setup lang="ts">
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'vue-sonner'
import { resolveConversationTenantId } from '~/components/inbox/data/conversations'

const gro = useGroScope()
const inbox = useInbox()
const dashboard = useGroDashboard()

const scopeLabel = computed(() => dashboard.tenantName(gro.activeTenantId.value))

function openTenant(tenantId: string) {
  gro.setActiveTenant(tenantId)
  navigateTo('/inbox')
  toast.info(`Showing ${dashboard.tenantName(tenantId)} in inbox`)
}

function openConversation(conversationId: string) {
  inbox.selectedConversationId.value = conversationId
  inbox.inboxView.value = 'conversations'
  navigateTo('/inbox')
}

function markComplete(conversationId: string) {
  inbox.markAsHandled(conversationId)
  toast.success('Marked as complete')
}

const kpiCards = computed(() => [
  { key: 'tenants', label: 'Assigned tenants', value: dashboard.kpis.value.tenants, icon: 'lucide:building-2', tone: 'default' },
  { key: 'conversations', label: 'Conversations', value: dashboard.kpis.value.conversations, icon: 'lucide:message-square', tone: 'default' },
  { key: 'actionNeeded', label: 'Action needed', value: dashboard.kpis.value.actionNeeded, icon: 'lucide:circle-alert', tone: 'destructive' },
  { key: 'unread', label: 'Unread messages', value: dashboard.kpis.value.unread, icon: 'lucide:mail', tone: 'default' },
  { key: 'current', label: 'Current stays', value: dashboard.kpis.value.currentStays, icon: 'lucide:home', tone: 'default' },
  { key: 'upcoming', label: 'Upcoming stays', value: dashboard.kpis.value.upcoming, icon: 'lucide:calendar-plus', tone: 'default' },
  { key: 'missedCalls', label: 'Missed calls', value: dashboard.kpis.value.missedCalls, icon: 'lucide:phone-missed', tone: 'destructive' },
  { key: 'alerts', label: 'Active alerts', value: dashboard.kpis.value.activeAlerts, icon: 'lucide:bell', tone: 'default' },
])

const sentimentConfig: Record<string, { emoji: string, label: string, class: string }> = {
  positive: { emoji: '😊', label: 'Positive', class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  neutral: { emoji: '😐', label: 'Neutral', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  negative: { emoji: '😠', label: 'Negative', class: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

function sentimentFor(sentiment: string) {
  return sentimentConfig[sentiment] ?? sentimentConfig.neutral!
}

const categoryConfig: Record<string, { label: string, class: string }> = {
  cleanliness: { label: 'CLEANLINESS', class: 'border-green-500/40 text-green-600 dark:text-green-400' },
  guest_requests: { label: 'GUEST REQUESTS', class: 'border-blue-500/40 text-blue-600 dark:text-blue-400' },
  maintenance: { label: 'MAINTENANCE', class: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  reservation_changes: { label: 'RESERVATION CHANGES', class: 'border-purple-500/40 text-purple-600 dark:text-purple-400' },
  check_in_detected: { label: 'CHECK IN DETECTED', class: 'border-cyan-500/40 text-cyan-600 dark:text-cyan-400' },
  check_out_detected: { label: 'CHECK OUT DETECTED', class: 'border-cyan-500/40 text-cyan-600 dark:text-cyan-400' },
  temperature: { label: 'TEMPERATURE', class: 'border-orange-500/40 text-orange-600 dark:text-orange-400' },
  other: { label: 'OTHER', class: 'border-muted-foreground/40 text-muted-foreground' },
}

function categoryFor(conv: { actionCategory?: string }) {
  if (conv.actionCategory && categoryConfig[conv.actionCategory])
    return categoryConfig[conv.actionCategory]!
  return categoryConfig.other!
}

function formatCreatedAt(iso: string) {
  return format(new Date(iso), 'MMM d h:mm a')
}

// Sorting state for both tables
type SortKey = string
const tenantSort = reactive<{ key: SortKey, dir: 'asc' | 'desc' }>({ key: 'actionNeeded', dir: 'desc' })
const queueSort = reactive<{ key: SortKey, dir: 'asc' | 'desc' }>({ key: 'created', dir: 'desc' })

function toggleSort(sortState: { key: SortKey, dir: 'asc' | 'desc' }, key: SortKey) {
  if (sortState.key === key) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortState.key = key
    sortState.dir = 'desc'
  }
}

function sortIcon(sortState: { key: SortKey, dir: 'asc' | 'desc' }, key: SortKey) {
  if (sortState.key !== key)
    return 'lucide:chevrons-up-down'
  return sortState.dir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'
}

const sortedTenantRows = computed(() => {
  const rows = [...dashboard.tenantRows.value]
  const { key, dir } = tenantSort
  const dirMul = dir === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    if (key === 'name')
      return a.name.localeCompare(b.name) * dirMul
    const av = a[key as keyof typeof a] as number
    const bv = b[key as keyof typeof b] as number
    return (av - bv) * dirMul
  })
  return rows
})

const sortedQueue = computed(() => {
  const items = [...dashboard.queue.value]
  const { key, dir } = queueSort
  const dirMul = dir === 'asc' ? 1 : -1
  items.sort((a, b) => {
    if (key === 'guest')
      return a.guestName.localeCompare(b.guestName) * dirMul
    if (key === 'property')
      return a.listingName.localeCompare(b.listingName) * dirMul
    if (key === 'category')
      return categoryFor(a).label.localeCompare(categoryFor(b).label) * dirMul
    if (key === 'sentiment')
      return a.sentiment.localeCompare(b.sentiment) * dirMul
    if (key === 'created')
      return (new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime()) * dirMul
    return 0
  })
  return items
})

// Pagination for the needs-attention queue
const queuePage = ref(1)
const queuePageSize = 10

const queuePageCount = computed(() => Math.max(1, Math.ceil(sortedQueue.value.length / queuePageSize)))

const paginatedQueue = computed(() => {
  const start = (queuePage.value - 1) * queuePageSize
  return sortedQueue.value.slice(start, start + queuePageSize)
})

watch(queuePageCount, (count) => {
  if (queuePage.value > count)
    queuePage.value = count
})

function queuePageNumbers(): (number | 'ellipsis')[] {
  const total = queuePageCount.value
  if (total <= 5)
    return Array.from({ length: total }, (_, i) => i + 1)
  const current = queuePage.value
  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = Array.from(pages).filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1)
      result.push('ellipsis')
    result.push(p)
    prev = p
  }
  return result
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <h2 class="text-2xl font-bold tracking-tight">
          GRO Dashboard
        </h2>
        <Badge variant="secondary" class="gap-1">
          <Icon name="lucide:building-2" class="size-3" />
          {{ scopeLabel }}
        </Badge>
      </div>
      <Button variant="outline" @click="navigateTo('/inbox')">
        <Icon name="lucide:inbox" class="mr-2 size-4" />
        Open Inbox
      </Button>
    </div>

    <main class="@container/main flex flex-1 flex-col gap-4 md:gap-8">
      <!-- KPI grid -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card v-for="card in kpiCards" :key="card.key" class="@container/card">
          <CardHeader>
            <CardDescription>{{ card.label }}</CardDescription>
            <CardTitle
              class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
              :class="card.tone === 'destructive' && card.value > 0 ? 'text-destructive' : ''"
            >
              {{ card.value }}
            </CardTitle>
            <CardAction>
              <Icon :name="card.icon" class="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      <!-- Tenant table -->
      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>
            Cross-tenant inbox and call load, sorted by action needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="cursor-pointer select-none" @click="toggleSort(tenantSort, 'name')">
                  <span class="inline-flex items-center gap-1">
                    Tenant <Icon :name="sortIcon(tenantSort, 'name')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none text-right" @click="toggleSort(tenantSort, 'conversations')">
                  <span class="inline-flex items-center gap-1">
                    Conversations <Icon :name="sortIcon(tenantSort, 'conversations')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none text-right" @click="toggleSort(tenantSort, 'actionNeeded')">
                  <span class="inline-flex items-center gap-1">
                    Action needed <Icon :name="sortIcon(tenantSort, 'actionNeeded')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none text-right" @click="toggleSort(tenantSort, 'unread')">
                  <span class="inline-flex items-center gap-1">
                    Unread <Icon :name="sortIcon(tenantSort, 'unread')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none text-right" @click="toggleSort(tenantSort, 'current')">
                  <span class="inline-flex items-center gap-1">
                    Current <Icon :name="sortIcon(tenantSort, 'current')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none text-right" @click="toggleSort(tenantSort, 'future')">
                  <span class="inline-flex items-center gap-1">
                    Upcoming <Icon :name="sortIcon(tenantSort, 'future')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none text-right" @click="toggleSort(tenantSort, 'missedCalls')">
                  <span class="inline-flex items-center gap-1">
                    Missed calls <Icon :name="sortIcon(tenantSort, 'missedCalls')" class="size-3" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in sortedTenantRows"
                :key="row.id"
                class="cursor-pointer"
                @click="openTenant(row.id)"
              >
                <TableCell>
                  <div class="flex items-center gap-2">
                    <div class="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold">
                      {{ row.logoText }}
                    </div>
                    <span class="font-medium">{{ row.name }}</span>
                  </div>
                </TableCell>
                <TableCell class="text-right">{{ row.conversations }}</TableCell>
                <TableCell class="text-right">
                  <Badge v-if="row.actionNeeded > 0" variant="destructive">{{ row.actionNeeded }}</Badge>
                  <span v-else class="text-muted-foreground">—</span>
                </TableCell>
                <TableCell class="text-right">{{ row.unread }}</TableCell>
                <TableCell class="text-right">{{ row.current }}</TableCell>
                <TableCell class="text-right">{{ row.future }}</TableCell>
                <TableCell class="text-right">
                  <span :class="row.missedCalls > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'">
                    {{ row.missedCalls }}
                  </span>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="sortedTenantRows.length === 0" :colspan="7">
                No assigned tenants yet.
              </TableEmpty>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <!-- Needs attention queue -->
      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            Action-needed and unread conversations across all assigned tenants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="dashboard.queue.value.length === 0" class="py-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon name="lucide:check-check" class="size-6" />
                </EmptyMedia>
                <EmptyTitle>You're all caught up</EmptyTitle>
                <EmptyDescription>
                  No action-needed or unread conversations right now.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
          <template v-else>
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead class="cursor-pointer select-none" @click="toggleSort(queueSort, 'guest')">
                  <span class="inline-flex items-center gap-1">
                    Guest <Icon :name="sortIcon(queueSort, 'guest')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none" @click="toggleSort(queueSort, 'property')">
                  <span class="inline-flex items-center gap-1">
                    Property <Icon :name="sortIcon(queueSort, 'property')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead class="cursor-pointer select-none" @click="toggleSort(queueSort, 'category')">
                  <span class="inline-flex items-center gap-1">
                    Category <Icon :name="sortIcon(queueSort, 'category')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none" @click="toggleSort(queueSort, 'sentiment')">
                  <span class="inline-flex items-center gap-1">
                    Sentiment <Icon :name="sortIcon(queueSort, 'sentiment')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="cursor-pointer select-none" @click="toggleSort(queueSort, 'created')">
                  <span class="inline-flex items-center gap-1">
                    Created <Icon :name="sortIcon(queueSort, 'created')" class="size-3" />
                  </span>
                </TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="conv in paginatedQueue"
                :key="conv.id"
                class="cursor-pointer"
                @click="openConversation(conv.id)"
              >
                <TableCell>
                  <div class="flex items-center gap-2">
                    <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {{ conv.guestInitials }}
                    </div>
                    <span class="font-medium">{{ conv.guestName }}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="max-w-[220px]">
                    <div class="truncate text-sm">{{ conv.listingName }}</div>
                    <div class="truncate text-xs text-muted-foreground">
                      {{ dashboard.tenantName(resolveConversationTenantId(conv)) }}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p class="max-w-[320px] text-sm text-muted-foreground whitespace-normal break-words">
                    {{ conv.lastMessage }}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" class="text-[10px]" :class="categoryFor(conv).class">
                    {{ categoryFor(conv).label }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" :class="sentimentFor(conv.sentiment).class">
                    <span class="text-xs leading-none">{{ sentimentFor(conv.sentiment).emoji }}</span>
                    {{ sentimentFor(conv.sentiment).label }}
                  </span>
                </TableCell>
                <TableCell>
                  <div class="text-xs text-muted-foreground whitespace-nowrap">
                    {{ formatCreatedAt(conv.lastMessageAt) }}
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-7"
                      title="Mark as complete"
                      @click.stop="markComplete(conv.id)"
                    >
                      <Icon name="lucide:check" class="size-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-7"
                      title="Go to inbox"
                      @click.stop="openConversation(conv.id)"
                    >
                      <Icon name="lucide:inbox" class="size-4 text-primary" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <!-- Pagination -->
          <div class="flex items-center justify-between border-t px-6 py-3">
            <div class="text-xs text-muted-foreground">
              Showing {{ (queuePage - 1) * queuePageSize + 1 }}–{{ Math.min(queuePage * queuePageSize, sortedQueue.length) }} of {{ sortedQueue.length }}
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                :disabled="queuePage === 1"
                @click="queuePage > 1 && queuePage--"
              >
                <Icon name="lucide:chevron-left" class="size-4" />
              </Button>
              <template v-for="(p, i) in queuePageNumbers()" :key="p === 'ellipsis' ? `ellipsis-${i}` : p">
                <span v-if="p === 'ellipsis'" class="px-1 text-sm text-muted-foreground">…</span>
                <Button
                  v-else
                  variant="ghost"
                  size="sm"
                  class="min-w-8 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                  :data-active="queuePage === p || undefined"
                  @click="queuePage = p"
                >
                  {{ p }}
                </Button>
              </template>
              <Button
                variant="outline"
                size="sm"
                :disabled="queuePage === queuePageCount"
                @click="queuePage < queuePageCount && queuePage++"
              >
                <Icon name="lucide:chevron-right" class="size-4" />
              </Button>
            </div>
          </div>
          </template>
        </CardContent>
      </Card>
    </main>
  </div>
</template>
