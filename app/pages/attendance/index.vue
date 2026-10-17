<script setup lang="ts">
import type { AttendanceFlag, AttendanceRow } from '~/composables/useAttendanceReport'
import { toast } from 'vue-sonner'
import ActivitiesRangeBar from '~/components/activities/ActivitiesRangeBar.vue'
import ActivityPager from '~/components/activities/ActivityPager.vue'
import { parseLocalDateKey } from '~/components/activities/data/activities'
import AttendanceDetailSheet from '~/components/attendance/AttendanceDetailSheet.vue'
import { formatWorked, workedMinutes } from '~/components/attendance/data/attendance'
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
import { useAttendanceReport } from '~/composables/useAttendanceReport'
import { useRoles } from '~/composables/useRoles'
import { useUsers } from '~/composables/useUsers'
import { downloadAttendanceXlsx } from '~/lib/attendance-export'

definePageMeta({ layout: 'default' })

const { records, selection, earliestDate, rows, totals, staffSummaries } = useAttendanceReport()
const { users } = useUsers()
const { roles } = useRoles()

// Filters
const ALL = 'all'
const query = ref('')
const roleId = ref(ALL)
const listingId = ref('')
const flag = ref<AttendanceFlag | typeof ALL>(ALL)

const FLAG_OPTIONS: { value: AttendanceFlag, label: string }[] = [
  { value: 'late', label: 'Late check-in' },
  { value: 'early', label: 'Early check-out' },
  { value: 'open', label: 'No check-out' },
]

const filters = computed(() => ({
  query: query.value,
  roleId: roleId.value === ALL ? undefined : roleId.value,
  listingId: listingId.value || undefined,
  flag: flag.value === ALL ? undefined : flag.value,
}))
const filtered = computed(() => !!query.value.trim() || roleId.value !== ALL || !!listingId.value || flag.value !== ALL)

function clearFilters() {
  query.value = ''
  roleId.value = ALL
  listingId.value = ''
  flag.value = ALL
}

const roleOptions = computed(() => roles.value.filter(r => users.value.some(u => u.roleId === r.id)))

// Data. The summary ignores the problem filter so its cards stay a way to jump to one.
const range = computed(() => selection.value.range)
const summary = computed(() => totals(range.value, { ...filters.value, flag: undefined }))
const allRows = computed(() => rows(range.value, filters.value))

type SortKey = 'date' | 'name'
const sortKey = ref<SortKey>('date')
const sortDesc = ref(true)

const sorted = computed<AttendanceRow[]>(() => {
  const dir = sortDesc.value ? -1 : 1
  return [...allRows.value].sort((a, b) => {
    if (sortKey.value === 'name')
      return a.name.localeCompare(b.name) * dir || b.date.localeCompare(a.date)
    return a.date.localeCompare(b.date) * dir || a.name.localeCompare(b.name)
  })
})

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDesc.value = !sortDesc.value
  }
  else {
    sortKey.value = key
    sortDesc.value = key === 'date'
  }
}

const sortIcon = (key: SortKey) => sortKey.value !== key ? 'lucide:chevrons-up-down' : sortDesc.value ? 'lucide:arrow-down' : 'lucide:arrow-up'
const ariaSort = (key: SortKey) => sortKey.value === key ? (sortDesc.value ? 'descending' : 'ascending') : 'none'

// Pagination
const page = ref(1)
const pageSize = ref(10)
const pageRows = computed(() => sorted.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

watch([() => range.value.from, () => range.value.to, query, roleId, listingId, flag, sortKey, sortDesc], () => {
  page.value = 1
})

// Detail
const detailOpen = ref(false)
const detailRow = ref<AttendanceRow | null>(null)

function openDetail(row: AttendanceRow) {
  detailRow.value = row
  detailOpen.value = true
}

// Export
const exporting = ref(false)

async function exportReport() {
  exporting.value = true
  try {
    await downloadAttendanceXlsx(staffSummaries(range.value, filters.value), range.value.from, range.value.to)
    toast.success('Attendance exported')
  }
  catch {
    toast.error('The attendance could not be exported')
  }
  finally {
    exporting.value = false
  }
}

const rangeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const rangeLabel = computed(() => {
  const { from, to } = range.value
  return from === to ? rangeFmt.format(parseLocalDateKey(from)) : `${rangeFmt.format(parseLocalDateKey(from))} to ${rangeFmt.format(parseLocalDateKey(to))}`
})
const rowDayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function toggleFlag(value: AttendanceFlag) {
  flag.value = flag.value === value ? ALL : value
}
</script>

<template>
  <ClientOnly>
    <div class="space-y-6 p-4 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-2xl font-bold tracking-tight">
            Attendance
          </h1>
          <p class="text-sm text-muted-foreground">
            When your team clocked in and out, {{ rangeLabel }}.
          </p>
        </div>
        <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ActivitiesRangeBar v-model:selection="selection" :earliest="earliestDate" />
          <Button variant="outline" :disabled="exporting || !allRows.length" @click="exportReport">
            <Icon name="lucide:download" class="mr-2 size-4" />
            Export to .xlsx
          </Button>
        </div>
      </div>

      <Card class="gap-0 py-0">
        <CardContent class="grid divide-y p-0 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          <div class="space-y-1 p-5">
            <p class="text-sm text-muted-foreground">
              Clocked in
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ summary.staff }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ summary.records }} {{ summary.records === 1 ? 'record' : 'records' }}
            </p>
          </div>
          <div class="space-y-1 p-5">
            <p class="text-sm text-muted-foreground">
              On time
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ summary.onTimePct === undefined ? '-' : `${summary.onTimePct}%` }}
            </p>
            <p class="text-xs text-muted-foreground">
              of check-ins
            </p>
          </div>
          <button type="button" class="space-y-1 p-5 text-left transition-colors hover:bg-muted/50" :aria-pressed="flag === 'late'" @click="toggleFlag('late')">
            <p class="text-sm text-muted-foreground">
              Late check-ins
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ summary.late }}
            </p>
          </button>
          <button type="button" class="space-y-1 p-5 text-left transition-colors hover:bg-muted/50" :aria-pressed="flag === 'early'" @click="toggleFlag('early')">
            <p class="text-sm text-muted-foreground">
              Early check-outs
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ summary.early }}
            </p>
            <p v-if="summary.noCheckOut" class="text-xs text-muted-foreground">
              {{ summary.noCheckOut }} with no check-out
            </p>
          </button>
          <div class="space-y-1 p-5">
            <p class="text-sm text-muted-foreground">
              Absences
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ summary.absentDays }}
            </p>
            <p class="text-xs text-muted-foreground">
              Scheduled shift, no check-in
            </p>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <BaseSearchInput v-model="query" placeholder="Search staff..." />
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
          <Select v-model="flag">
            <SelectTrigger class="w-full sm:w-48" aria-label="Check-in status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="ALL">
                All records
              </SelectItem>
              <SelectItem v-for="f in FLAG_OPTIONS" :key="f.value" :value="f.value">
                {{ f.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="w-full sm:w-80">
            <ListingPicker v-model="listingId" placeholder="All locations" />
          </div>
          <Button v-if="filtered" variant="ghost" @click="clearFilters">
            Clear filters
          </Button>
        </div>

        <Card class="gap-0 overflow-hidden py-0">
          <CardContent class="p-0">
            <Table v-if="allRows.length">
              <TableHeader>
                <TableRow>
                  <TableHead :aria-sort="ariaSort('date')">
                    <button type="button" class="inline-flex items-center gap-1.5 font-medium" @click="sortBy('date')">
                      Date
                      <Icon :name="sortIcon('date')" class="size-3.5 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead :aria-sort="ariaSort('name')">
                    <button type="button" class="inline-flex items-center gap-1.5 font-medium" @click="sortBy('name')">
                      Staff
                      <Icon :name="sortIcon('name')" class="size-3.5 text-muted-foreground" />
                    </button>
                  </TableHead>
                  <TableHead class="hidden lg:table-cell">
                    Role
                  </TableHead>
                  <TableHead class="hidden md:table-cell">
                    Location
                  </TableHead>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                  <TableHead class="hidden text-right sm:table-cell">
                    Worked
                  </TableHead>
                  <TableHead class="w-10">
                    <span class="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in pageRows"
                  :key="row.id"
                  class="cursor-pointer"
                  tabindex="0"
                  @click="openDetail(row)"
                  @keydown.enter="openDetail(row)"
                >
                  <TableCell class="whitespace-nowrap">
                    {{ rowDayFmt.format(parseLocalDateKey(row.date)) }}
                    <Badge v-if="row.segment && row.segment > 1" variant="outline" class="ml-1.5">
                      Shift {{ row.segment }}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-3">
                      <BasePersonAvatar :name="row.name" :src="row.avatarUrl" class="size-8" />
                      <div class="min-w-0">
                        <p class="truncate font-medium">
                          {{ row.name }}
                        </p>
                        <p class="truncate text-xs text-muted-foreground lg:hidden">
                          {{ row.roleName }}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="hidden text-muted-foreground lg:table-cell">
                    {{ row.roleName }}
                  </TableCell>
                  <TableCell class="hidden max-w-64 md:table-cell">
                    <p class="flex items-center gap-1.5 truncate">
                      <Icon name="lucide:map-pin" class="size-3.5 shrink-0 text-muted-foreground" />
                      <span class="truncate">{{ row.listingName }}</span>
                    </p>
                  </TableCell>
                  <TableCell class="tabular-nums" :class="row.clockInLate && 'font-medium text-destructive'">
                    {{ row.clockIn }}
                    <Badge v-if="row.clockInLate" variant="outline" class="ml-1.5 border-destructive/40 font-normal text-destructive">
                      Late
                    </Badge>
                  </TableCell>
                  <TableCell class="tabular-nums" :class="row.clockOutEarly && 'font-medium text-destructive'">
                    {{ row.clockOut ?? '-' }}<span v-if="row.clockOutNextDay" class="ml-1 text-xs text-muted-foreground">+1</span>
                    <Badge v-if="row.clockOutEarly" variant="outline" class="ml-1.5 border-destructive/40 font-normal text-destructive">
                      Early
                    </Badge>
                  </TableCell>
                  <TableCell class="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                    {{ workedMinutes(row) === undefined ? '-' : formatWorked(workedMinutes(row)!) }}
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
                  <Icon :name="filtered ? 'lucide:search-x' : 'lucide:clock'" />
                </EmptyMedia>
                <EmptyTitle>{{ filtered ? 'No records match these filters' : 'Nobody has clocked in yet' }}</EmptyTitle>
                <EmptyDescription>
                  {{ filtered ? 'Try another role, location or status, or clear the filters.' : records.length ? 'No check-ins between these dates. Try a longer range.' : 'Check-ins from the mobile app show up here.' }}
                </EmptyDescription>
              </EmptyHeader>
              <Button v-if="filtered" variant="outline" @click="clearFilters">
                Clear filters
              </Button>
            </Empty>

            <ActivityPager v-model:page="page" v-model:page-size="pageSize" :total="sorted.length" unit="records" />
          </CardContent>
        </Card>
      </div>

      <AttendanceDetailSheet v-model:open="detailOpen" :row="detailRow" />
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
