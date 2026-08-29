<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { reservations, resolveConversationTenantId } from '~/components/inbox/data/conversations'

const STORAGE_KEY = 'elev8-gro-search-history'

function loadHistory(): string[] {
  if (!import.meta.client)
    return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
  }
  catch {
    return []
  }
}

function saveHistory(history: string[]) {
  if (!import.meta.client)
    return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  }
  catch { /* ignore quota errors */ }
}

const gro = useGroScope()
const inbox = useInbox()
const calls = useCallsFilters()

const searchRoot = ref<HTMLElement | null>(null)
const searchOpen = ref(false)
const history = ref<string[]>(loadHistory())

const activeSearch = computed({
  get: () => inbox.inboxView.value === 'calls' ? calls.searchQuery.value : inbox.searchValue.value,
  set: (value: string) => {
    if (inbox.inboxView.value === 'calls')
      calls.searchQuery.value = value
    else
      inbox.searchValue.value = value
  },
})

const activeTenantLabel = computed(() => gro.tenantName(gro.activeTenantId.value))

const suggestions = computed(() => {
  const q = activeSearch.value.trim().toLowerCase()
  if (!q)
    return []

  const rows: Array<{ id: string, label: string, sub: string, tenant: string }> = []
  const seen = new Set<string>()
  for (const c of inbox.visibleConversations.value) {
    const res = reservations[c.reservationId]
    const phone = res?.guestDetails?.phone ?? ''
    const email = res?.guestDetails?.email ?? c.guestEmail ?? ''
    const hay = `${c.guestName} ${c.listingName} ${phone} ${email}`.toLowerCase()
    if (!hay.includes(q))
      continue
    if (seen.has(c.guestName))
      continue
    seen.add(c.guestName)
    rows.push({
      id: c.id,
      label: c.guestName,
      sub: c.listingName,
      tenant: gro.tenantName(resolveConversationTenantId(c)),
    })
  }
  return rows.slice(0, 8)
})

const showHistory = computed(() => !activeSearch.value.trim() && history.value.length > 0)
const showSuggestions = computed(() => activeSearch.value.trim().length > 0)

onClickOutside(searchRoot, () => {
  searchOpen.value = false
})

function commitSearch(value: string) {
  const q = value.trim()
  if (!q)
    return
  activeSearch.value = q
  const next = [q, ...history.value.filter(h => h.toLowerCase() !== q.toLowerCase())].slice(0, 8)
  history.value = next
  saveHistory(next)
  searchOpen.value = false
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitSearch(activeSearch.value)
  }
  else if (event.key === 'Escape') {
    searchOpen.value = false
  }
}

function clearHistory() {
  history.value = []
  saveHistory([])
}

function pickHistory(item: string) {
  activeSearch.value = item
  searchOpen.value = false
}

function pickSuggestion(row: { id: string, label: string }) {
  activeSearch.value = row.label
  searchOpen.value = false
  inbox.inboxView.value = 'conversations'
  inbox.selectedConversationId.value = row.id
}

function initialsFor(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="flex flex-1 items-center gap-2 min-w-0">
    <!-- Tenant switcher -->
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" class="h-8 gap-1.5 px-3 text-xs shrink-0">
          <Icon name="lucide:building-2" class="size-3.5 text-muted-foreground" />
          <span class="max-w-[160px] truncate">{{ activeTenantLabel }}</span>
          <Icon name="lucide:chevrons-up-down" class="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-64">
        <DropdownMenuItem
          :class="{ 'bg-accent': gro.activeTenantId.value === 'all' }"
          @click="gro.setActiveTenant('all')"
        >
          <Icon name="lucide:layers" class="mr-2 size-4" />
          All tenants
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          v-for="tenant in gro.assignedTenants.value"
          :key="tenant.id"
          :class="{ 'bg-accent': gro.activeTenantId.value === tenant.id }"
          @click="gro.setActiveTenant(tenant.id)"
        >
          <div class="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-semibold">
            {{ tenant.logoText }}
          </div>
          <span class="ml-2 truncate">{{ tenant.name }}</span>
          <Icon v-if="gro.activeTenantId.value === tenant.id" name="lucide:check" class="ml-auto size-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Wide guest search with history + autocomplete -->
    <div ref="searchRoot" class="relative flex-1 min-w-0">
      <Icon name="lucide:search" class="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="activeSearch"
        :placeholder="inbox.inboxView.value === 'calls' ? 'Search guests, listings, or numbers across all tenants...' : 'Search guests across all tenants...'"
        class="h-9 pl-9 w-full"
        @focus="searchOpen = true"
        @keydown="onSearchKeydown"
      />

      <div
        v-if="searchOpen && (showHistory || showSuggestions)"
        class="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        <!-- Recent searches -->
        <template v-if="showHistory">
          <div class="flex items-center justify-between px-3 pt-2 pb-1">
            <span class="text-xs font-medium text-muted-foreground">Recent searches</span>
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground"
              @click="clearHistory"
            >
              Clear
            </button>
          </div>
          <div class="max-h-[280px] overflow-y-auto p-1">
            <button
              v-for="item in history"
              :key="item"
              type="button"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              @click="pickHistory(item)"
            >
              <Icon name="lucide:history" class="size-4 shrink-0 text-muted-foreground" />
              <span class="truncate">{{ item }}</span>
            </button>
          </div>
        </template>

        <!-- Autocomplete suggestions -->
        <template v-else-if="showSuggestions">
          <div class="px-3 pt-2 pb-1">
            <span class="text-xs font-medium text-muted-foreground">Guests</span>
          </div>
          <div class="max-h-[280px] overflow-y-auto p-1">
            <button
              v-for="row in suggestions"
              :key="row.id"
              type="button"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              @click="pickSuggestion({ id: row.id, label: row.label })"
            >
              <div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                {{ initialsFor(row.label) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{{ row.label }}</div>
                <div class="truncate text-xs text-muted-foreground">
                  {{ row.sub }} · {{ row.tenant }}
                </div>
              </div>
            </button>
            <div v-if="suggestions.length === 0" class="px-3 py-6 text-center text-sm text-muted-foreground">
              No guests match "{{ activeSearch }}"
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
