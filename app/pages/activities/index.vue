<script setup lang="ts">
import type { ActivityLogType } from '~/components/activities/data/activities'
import type { ActivityStaffRow } from '~/composables/useActivityReport'
import { toast } from 'vue-sonner'
import ActivitiesRangeBar from '~/components/activities/ActivitiesRangeBar.vue'
import ActivityPager from '~/components/activities/ActivityPager.vue'
import ActivitySparkline from '~/components/activities/ActivitySparkline.vue'
import ActivityTenantBadge from '~/components/activities/ActivityTenantBadge.vue'
import ActivityTimeBar from '~/components/activities/ActivityTimeBar.vue'
import ActivityTypeBreakdown from '~/components/activities/ActivityTypeBreakdown.vue'
import { formatDuration, parseLocalDateKey } from '~/components/activities/data/activities'
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'
import BaseSearchInput from '~/components/base/SearchInput.vue'
import ListingPicker from '~/components/operations-calendar/ListingPicker.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { useActivityReport } from '~/composables/useActivityReport'
import { useRoles } from '~/composables/useRoles'
import { useUsers } from '~/composables/useUsers'
import { downloadActivityXlsx } from '~/lib/activity-export'
import { deltaPercent } from '~/lib/activity-stats'

definePageMeta({ layout: 'default' })

const { selection, staffRows, totals, loggableTypesFor } = useActivityReport()
const { users } = useUsers()
const { roles } = useRoles()

// Filters
const ALL = 'all'
const query = ref('')
const roleId = ref(ALL)
// Listing (and room) filter: '' means every listing.
const listingId = ref('')
const unitId = ref<string | null>(null)

const filters = computed(() => ({
  query: query.value,
  roleId: roleId.value === ALL ? undefined : roleId.value,
  listingId: listingId.value || undefined,
  unitId: unitId.value || undefined,
}))
const filtered = computed(() => !!query.value.trim() || roleId.value !== ALL || !!listingId.value)

function clearFilters() {
  query.value = ''
  roleId.value = ALL
  listingId.value = ''
  unitId.value = null
}

const roleOptions = computed(() => roles.value.filter(r => users.value.some(u => u.roleId === r.id)))

// Data
const rows = computed(() => staffRows(selection.value.range, filters.value))
const summary = computed(() => totals(selection.value.range, filters.value))
// Cleaning only counts when someone listed can clean (housekeeping roles), so a filter on other roles drops it.
const shownTypes = computed<ActivityLogType[]>(() => {
  const cleans = rows.value.some(r => loggableTypesFor(r.userId).includes('cleaning'))
  return cleans ? ['cleaning', 'task', 'tracker'] : ['task', 'tracker']
})

type SortKey = 'name' | 'count' | 'minutes'
const sortKey = ref<SortKey>('minutes')
const sortDesc = ref(true)

const sorted = computed<ActivityStaffRow[]>(() => {
  const dir = sortDesc.value ? -1 : 1
  return [...rows.value].sort((a, b) => {
    if (sortKey.value === 'name')
      return a.name.localeCompare(b.name) * dir
    return (a[sortKey.value] - b[sortKey.value]) * dir || a.name.localeCompare(b.name)
  })
})

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDesc.value = !sortDesc.value
  }
  else {
    sortKey.value = key
    sortDesc.value = key !== 'name'
  }
}

function sortIcon(key: SortKey) {
  if (sortKey.value !== key)
    return 'lucide:chevrons-up-down'
  return sortDesc.value ? 'lucide:arrow-down' : 'lucide:arrow-up'
}

const ariaSort = (key: SortKey) => sortKey.value === key ? (sortDesc.value ? 'descending' : 'ascending') : 'none'

// Pagination
const page = ref(1)
const pageSize = ref(10)
const pageRows = computed(() => sorted.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

watch([() => selection.value.range.from, () => selection.value.range.to, query, roleId, listingId, unitId, sortKey, sortDesc], () => {
  page.value = 1
})

// Export
const exporting = ref(false)

async function exportReport() {
  exporting.value = true
  try {
    await downloadActivityXlsx(sorted.value, selection.value.range.from, selection.value.range.to)
    toast.success('Report exported')
  }
  catch {
    toast.error('The report could not be exported')
  }
  finally {
    exporting.value = false
  }
}

// Copy
const rangeLabel = computed(() => {
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const { from, to } = selection.value.range
  return from === to ? fmt.format(parseLocalDateKey(from)) : `${fmt.format(parseLocalDateKey(from))} to ${fmt.format(parseLocalDateKey(to))}`
})

function delta(current: number, previous?: number) {
  if (previous === undefined)
    return undefined
  const pct = deltaPercent(current, previous)
  if (pct === undefined)
    return undefined
  return { pct, icon: pct >= 0 ? 'lucide:trending-up' : 'lucide:trending-down', text: `${pct > 0 ? '+' : ''}${pct}%` }
}

const countDelta = computed(() => delta(summary.value.count, summary.value.previous?.count))
const minutesDelta = computed(() => delta(summary.value.minutes, summary.value.previous?.minutes))
const listed = computed(() => rows.value.length)
</script>

<template>
  <ClientOnly>
    <div class="space-y-6 p-4 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-2xl font-bold tracking-tight">
            Activities
          </h1>
          <p class="text-sm text-muted-foreground">
            Time and activities logged by your team, {{ rangeLabel }}.
          </p>
        </div>
        <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ActivitiesRangeBar />
          <Button variant="outline" :disabled="exporting || !rows.length" @click="exportReport">
            <Icon name="lucide:download" class="mr-2 size-4" />
            Export to .xlsx
          </Button>
        </div>
      </div>

      <Card class="gap-0 py-0">
        <CardContent class="grid divide-y p-0 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <div class="space-y-1 p-5">
            <p class="text-sm text-muted-foreground">
              Staff with activity
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ summary.staff }}<span class="text-base font-normal text-muted-foreground"> of {{ listed }}</span>
            </p>
          </div>
          <div class="space-y-1 p-5">
            <p class="text-sm text-muted-foreground">
              Total activity
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ summary.count }}
            </p>
            <p v-if="countDelta" class="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Icon :name="countDelta.icon" class="size-3.5" />
              {{ countDelta.text }} vs previous period
            </p>
          </div>
          <div class="space-y-1 p-5">
            <p class="text-sm text-muted-foreground">
              Total time
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ formatDuration(summary.minutes) }}
            </p>
            <p v-if="minutesDelta" class="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Icon :name="minutesDelta.icon" class="size-3.5" />
              {{ minutesDelta.text }} vs previous period
            </p>
          </div>
          <div class="space-y-2 p-5">
            <p class="text-sm text-muted-foreground">
              Time by type
            </p>
            <ActivityTypeBreakdown :by-type="summary.byType" :types="shownTypes" />
          </div>
        </CardContent>
      </Card>

      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <BaseSearchInput v-model="query" placeholder="Search staff" aria-label="Search staff" class="sm:w-64 sm:max-w-none" />
          <Select v-model="roleId">
            <SelectTrigger class="w-full sm:w-48" aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="ALL">
                All roles
              </SelectItem>
              <SelectItem v-for="r in roleOptions" :key="r.id" :value="r.id">
                {{ r.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="w-full sm:w-[28rem]">
            <ListingPicker v-model="listingId" v-model:unit-id="unitId" pick-rooms placeholder="All listings" />
          </div>
          <Button v-if="filtered" variant="ghost" @click="clearFilters">
            Clear filters
          </Button>
        </div>

        <Card class="gap-0 overflow-hidden py-0">
          <CardContent class="p-0">
            <Table v-if="rows.length">
              <TableHeader>
                <TableRow>
                  <TableHead :aria-sort="ariaSort('name')">
                    <button type="button" class="inline-flex items-center gap-1.5 font-medium" @click="sortBy('name')">
                      Staff
                      <Icon :name="sortIcon('name')" class="size-3.5 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead class="hidden md:table-cell">
                    Role
                  </TableHead>
                  <TableHead :aria-sort="ariaSort('count')" class="text-right">
                    <button type="button" class="inline-flex items-center gap-1.5 font-medium" @click="sortBy('count')">
                      Activity
                      <Icon :name="sortIcon('count')" class="size-3.5 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead class="hidden lg:table-cell">
                    Per day
                  </TableHead>
                  <TableHead :aria-sort="ariaSort('minutes')" class="text-right">
                    <button type="button" class="inline-flex items-center gap-1.5 font-medium" @click="sortBy('minutes')">
                      Time
                      <Icon :name="sortIcon('minutes')" class="size-3.5 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead class="hidden xl:table-cell">
                    Flags
                  </TableHead>
                  <TableHead class="w-10">
                    <span class="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in pageRows"
                  :key="row.userId"
                  class="cursor-pointer"
                  tabindex="0"
                  @click="navigateTo(`/activities/${row.userId}`)"
                  @keydown.enter="navigateTo(`/activities/${row.userId}`)"
                >
                  <TableCell>
                    <div class="flex items-center gap-3">
                      <BasePersonAvatar :name="row.name" :src="row.avatarUrl" class="size-8" />
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <p class="truncate font-medium">
                            {{ row.name }}
                          </p>
                          <ActivityTenantBadge :user-id="row.userId" />
                        </div>
                        <p class="truncate text-xs text-muted-foreground md:hidden">
                          {{ row.roleName }}
                        </p>
                        <p
                          v-if="row.missingDays || row.longCount || row.unloggedWork"
                          class="inline-flex items-center gap-1 text-xs text-warning-foreground xl:hidden"
                          :title="`${row.missingDays} days not logged, ${row.longCount} longer than usual, ${row.unloggedWork} finished jobs or tasks not logged`"
                        >
                          <Icon name="lucide:triangle-alert" class="size-3" />
                          {{ row.missingDays + row.longCount + row.unloggedWork }} to check
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="hidden text-muted-foreground md:table-cell">
                    {{ row.roleName }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ row.count }}
                  </TableCell>
                  <TableCell class="hidden lg:table-cell">
                    <ActivitySparkline :values="row.daily" />
                  </TableCell>
                  <TableCell>
                    <ActivityTimeBar :minutes="row.minutes" :target="row.targetMinutes" />
                  </TableCell>
                  <TableCell class="hidden xl:table-cell">
                    <div class="flex flex-wrap gap-1">
                      <Badge v-if="row.missingDays" variant="outline" class="gap-1 border-warning/50 font-normal text-warning-foreground">
                        <Icon name="lucide:calendar-x" class="size-3" />
                        {{ row.missingDays }} {{ row.missingDays === 1 ? 'day' : 'days' }} not logged
                      </Badge>
                      <Badge v-if="row.longCount" variant="outline" class="gap-1 border-warning/50 font-normal text-warning-foreground">
                        <Icon name="lucide:triangle-alert" class="size-3" />
                        {{ row.longCount }} longer than usual
                      </Badge>
                      <Badge v-if="row.unloggedWork" variant="outline" class="gap-1 border-warning/50 font-normal text-warning-foreground">
                        <Icon name="lucide:clipboard-check" class="size-3" />
                        {{ row.unloggedWork }} finished, not logged
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Icon name="lucide:chevron-right" class="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Empty v-else class="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon :name="filtered ? 'lucide:search-x' : 'lucide:timer'" />
                </EmptyMedia>
                <EmptyTitle>{{ filtered ? 'No staff match these filters' : 'No activity in this period' }}</EmptyTitle>
                <EmptyDescription>
                  {{ filtered ? 'Try another role or listing, or clear the filters.' : 'Nobody logged time between these dates. Try a longer range.' }}
                </EmptyDescription>
              </EmptyHeader>
              <Button v-if="filtered" variant="outline" @click="clearFilters">
                Clear filters
              </Button>
            </Empty>

            <ActivityPager v-model:page="page" v-model:page-size="pageSize" :total="sorted.length" unit="staff" />
          </CardContent>
        </Card>
      </div>
    </div>
    <template #fallback>
      <div class="space-y-6 p-6">
        <Skeleton class="h-8 w-48" />
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-72 w-full" />
      </div>
    </template>
  </ClientOnly>
</template>
