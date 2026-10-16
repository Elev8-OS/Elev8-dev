<script setup lang="ts">
import type { ActivityLog, ActivityLogType, FinishedWork } from '~/components/activities/data/activities'
import type { CleaningType } from '~/components/operations-calendar/data/operations-calendar'
import type { ActivityRowGroup } from '~/composables/useActivityReport'
import ActivitiesRangeBar from '~/components/activities/ActivitiesRangeBar.vue'
import ActivityAddDialog from '~/components/activities/ActivityAddDialog.vue'
import ActivityDailyChart from '~/components/activities/ActivityDailyChart.vue'
import ActivityEditDialog from '~/components/activities/ActivityEditDialog.vue'
import ActivityHistorySheet from '~/components/activities/ActivityHistorySheet.vue'
import ActivityListingsSheet from '~/components/activities/ActivityListingsSheet.vue'
import ActivityLogRow from '~/components/activities/ActivityLogRow.vue'
import ActivityPager from '~/components/activities/ActivityPager.vue'
import ActivityRemoveDialog from '~/components/activities/ActivityRemoveDialog.vue'
import ActivityTenantBadge from '~/components/activities/ActivityTenantBadge.vue'
import ActivityTypeBreakdown from '~/components/activities/ActivityTypeBreakdown.vue'
import { activityLogTypeMeta, CLEANING_LOG_TYPES, formatDuration, logPlace, parseLocalDateKey, toLocalDateKey } from '~/components/activities/data/activities'
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'
import { cleaningTypeLabels } from '~/components/operations-calendar/data/operations-calendar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { useActivityReport } from '~/composables/useActivityReport'
import { useRoles } from '~/composables/useRoles'
import { useUsers } from '~/composables/useUsers'
import { eachDay, isWorkDay } from '~/lib/activity-stats'

definePageMeta({ layout: 'default' })

const route = useRoute()
const { getUser } = useUsers()
const { getRole } = useRoles()
const { selection, finishedWorkFor, shownTypesFor, cleaningKindCounts, dayGroups, dailySeries, listingSummary, byTypeFor, otherTenantCount, tenantsFor, tenantName, activeTenantId, targetMinutes, isLong, auditFor } = useActivityReport()

const user = computed(() => getUser(String(route.params.id)))
const roleName = computed(() => user.value ? getRole(user.value.roleId)?.name ?? '' : '')

// Filters
const typeFilter = ref<ActivityLogType[]>([])
// Kinds of cleaning (Daily, Check-out...). They only narrow cleaning logs and show while Cleaning is on.
const cleaningKinds = ref<CleaningType[]>([])
const search = ref('')
const filtered = computed(() => typeFilter.value.length > 0 || cleaningKinds.value.length > 0 || !!search.value.trim())

function clearFilters() {
  typeFilter.value = []
  cleaningKinds.value = []
  search.value = ''
}

// Tenants: a person assigned to several tenants can have time in each. Only the active tenant counts unless the toggle is on.
const includeOtherTenants = ref(false)
const assignedTenants = computed(() => user.value ? tenantsFor(user.value.id) : [])
const hasOtherTenants = computed(() => assignedTenants.value.length > 0)
const activeTenantName = computed(() => tenantName(activeTenantId.value) ?? 'the active tenant')
const otherTenantLogs = computed(() => user.value ? otherTenantCount(user.value.id, selection.value.range) : 0)

watch(() => user.value?.id, () => {
  includeOtherTenants.value = false
})

/** Name of the log's tenant when it is not the active one, else nothing. */
const foreignTenant = (log: ActivityLog) => log.tenantId && log.tenantId !== activeTenantId.value ? tenantName(log.tenantId) : undefined

// Data
const range = computed(() => selection.value.range)
const allGroups = computed(() => user.value ? dayGroups(user.value.id, range.value, { includeOtherTenants: includeOtherTenants.value }) : [])
const groups = computed(() => user.value ? dayGroups(user.value.id, range.value, { types: typeFilter.value, cleaningTypes: cleaningKinds.value, query: search.value, includeOtherTenants: includeOtherTenants.value }) : [])
const series = computed(() => user.value ? dailySeries(user.value.id, range.value, includeOtherTenants.value) : [])
const listingsWorked = computed(() => user.value ? listingSummary(user.value.id, range.value, includeOtherTenants.value) : [])
const history = computed(() => user.value ? auditFor(user.value.id) : [])

const totalMinutes = computed(() => allGroups.value.reduce((sum, g) => sum + g.minutes, 0))
const totalCount = computed(() => allGroups.value.reduce((sum, g) => sum + g.count, 0))
const target = computed(() => user.value ? targetMinutes(user.value.id, range.value) : 0)
// One tenant of several is only part of a working day, so there is nothing to compare with the target.
const targetPct = computed(() => target.value && (!hasOtherTenants.value || includeOtherTenants.value) ? Math.round((totalMinutes.value / target.value) * 100) : undefined)

// Cleaning is only for housekeeping roles, so everyone else sees task and activity tracker only.
const shownTypes = computed(() => user.value ? shownTypesFor(user.value.id) : [])

// Finished cleaning jobs and tasks of this person that no log covers yet. They are read from the Cleaning and
// Tasks modules; `unloggedInRange` is what the selected period shows, `unloggedAll` is what the dialog can link.
const unloggedAll = computed(() => user.value ? finishedWorkFor(user.value.id) : [])
const unloggedInRange = computed(() => user.value ? finishedWorkFor(user.value.id, range.value) : [])
const showAllUnlogged = ref(false)
const shownUnlogged = computed(() => showAllUnlogged.value ? unloggedInRange.value : unloggedInRange.value.slice(0, 5))
// Kinds this person has logs for in the range (with counts), plus any picked one so a chip never vanishes under the cursor.
const kindCounts = computed(() => user.value ? cleaningKindCounts(user.value.id, range.value, includeOtherTenants.value) : {})
const kindOptions = computed(() => CLEANING_LOG_TYPES.filter(k => kindCounts.value[k] || cleaningKinds.value.includes(k)))

const byType = computed(() => user.value ? byTypeFor(user.value.id, range.value, includeOtherTenants.value) : { cleaning: 0, task: 0, tracker: 0 })

const loggedDays = computed(() => new Set(allGroups.value.map(g => g.date)))
// Today is left out: the day is not over, so nothing logged yet is not a gap.
const missingDays = computed(() => {
  const todayKey = toLocalDateKey(new Date())
  return eachDay(range.value).filter(d => d < todayKey && isWorkDay(d) && !loggedDays.value.has(d)).length
})
const longCount = computed(() => allGroups.value.reduce((sum, g) => sum + g.rows.reduce((s, r) => s + r.logs.filter(isLong).length, 0), 0))

// Pagination by day
const page = ref(1)
const pageSize = ref(10)
const pagedGroups = computed(() => groups.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

// Turning Cleaning off drops its kinds, so a hidden filter never keeps narrowing the list.
watch(typeFilter, (types) => {
  if (!types.includes('cleaning'))
    cleaningKinds.value = []
})

watch([() => range.value.from, () => range.value.to, typeFilter, cleaningKinds, search, includeOtherTenants], () => {
  page.value = 1
})

// Folded rows (same work, same day, same listing)
const expanded = ref<string[]>([])

function toggleRow(key: string) {
  expanded.value = expanded.value.includes(key) ? expanded.value.filter(k => k !== key) : [...expanded.value, key]
}

const firstLog = (row: ActivityRowGroup) => row.logs[0]!

// Dialogs
const editing = ref<ActivityLog | null>(null)
const editOpen = ref(false)
const removing = ref<ActivityLog | null>(null)
const removeOpen = ref(false)
const listingsOpen = ref(false)
const historyOpen = ref(false)
const addOpen = ref(false)
// "Log time" on a finished job or task opens the form already linked to it.
const initialWork = ref<FinishedWork | null>(null)

function logWork(work: FinishedWork) {
  initialWork.value = work
  addOpen.value = true
}

function openAdd() {
  initialWork.value = null
  addOpen.value = true
}

function openEdit(log: ActivityLog) {
  editing.value = log
  editOpen.value = true
}

function openRemove(log: ActivityLog) {
  removing.value = log
  removeOpen.value = true
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const formatDay = (key: string) => dayFmt.format(parseLocalDateKey(key))
</script>

<template>
  <ClientOnly>
    <div class="space-y-6 p-4 sm:p-6">
      <Button variant="ghost" class="-ml-3" as-child>
        <NuxtLink to="/activities">
          <Icon name="lucide:arrow-left" class="mr-2 size-4" />
          Activities
        </NuxtLink>
      </Button>

      <Empty v-if="!user" class="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="lucide:user-x" />
          </EmptyMedia>
          <EmptyTitle>Staff member not found</EmptyTitle>
          <EmptyDescription>This person is no longer on the team.</EmptyDescription>
        </EmptyHeader>
        <Button as-child variant="outline">
          <NuxtLink to="/activities">
            Back to activities
          </NuxtLink>
        </Button>
      </Empty>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <BasePersonAvatar :name="user.name" :src="user.avatarUrl" class="size-16" text-class="text-xl" />
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight">
                  {{ user.name }}
                </h1>
                <ActivityTenantBadge :user-id="user.id" />
              </div>
              <p class="text-sm text-muted-foreground">
                {{ roleName }}
              </p>
            </div>
          </div>
          <div class="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <ActivitiesRangeBar />
            <Button variant="outline" @click="listingsOpen = true">
              <Icon name="lucide:building-2" class="mr-2 size-4" />
              {{ listingsWorked.length }} {{ listingsWorked.length === 1 ? 'listing' : 'listings' }}
            </Button>
            <Button variant="outline" as-child>
              <NuxtLink :to="`/users/${user.id}`">
                <Icon name="lucide:user-round" class="mr-2 size-4" />
                Profile
              </NuxtLink>
            </Button>
            <Button variant="outline" @click="historyOpen = true">
              <Icon name="lucide:history" class="mr-2 size-4" />
              History
              <Badge v-if="history.length" variant="secondary" class="ml-2">
                {{ history.length }}
              </Badge>
            </Button>
            <Button @click="openAdd">
              <Icon name="lucide:plus" class="mr-2 size-4" />
              Add activity
            </Button>
          </div>
        </div>

        <Card class="gap-0 py-0">
          <CardContent class="grid divide-y p-0 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <div class="space-y-1 p-5">
              <p class="text-sm text-muted-foreground">
                Total time
              </p>
              <p class="text-2xl font-semibold tabular-nums">
                {{ formatDuration(totalMinutes) }}
              </p>
              <p v-if="targetPct !== undefined" class="text-xs text-muted-foreground">
                {{ targetPct }}% of {{ formatDuration(target) }} target
              </p>
            </div>
            <div class="space-y-1 p-5">
              <p class="text-sm text-muted-foreground">
                Total activity
              </p>
              <p class="text-2xl font-semibold tabular-nums">
                {{ totalCount }}
              </p>
            </div>
            <div class="space-y-1 p-5">
              <p class="text-sm text-muted-foreground">
                Needs a look
              </p>
              <div class="flex flex-wrap gap-1.5 pt-1">
                <Badge v-if="missingDays" variant="outline" class="gap-1 border-warning/50 font-normal text-warning-foreground">
                  <Icon name="lucide:calendar-x" class="size-3" />
                  {{ missingDays }} {{ missingDays === 1 ? 'day' : 'days' }} not logged
                </Badge>
                <Badge v-if="longCount" variant="outline" class="gap-1 border-warning/50 font-normal text-warning-foreground">
                  <Icon name="lucide:triangle-alert" class="size-3" />
                  {{ longCount }} longer than usual
                </Badge>
                <Badge v-if="unloggedInRange.length" variant="outline" class="gap-1 border-warning/50 font-normal text-warning-foreground">
                  <Icon name="lucide:clipboard-check" class="size-3" />
                  {{ unloggedInRange.length }} finished, not logged
                </Badge>
                <span v-if="!missingDays && !longCount && !unloggedInRange.length" class="text-sm text-muted-foreground">Nothing unusual</span>
              </div>
            </div>
            <div class="space-y-2 p-5">
              <p class="text-sm text-muted-foreground">
                Time by type
              </p>
              <ActivityTypeBreakdown :by-type="byType" :types="shownTypes" />
            </div>
          </CardContent>
        </Card>

        <Card v-if="unloggedInRange.length" class="gap-0 py-0">
          <CardContent class="p-0">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
              <h2 class="text-sm font-semibold">
                Finished but not logged
                <span class="ml-1 font-normal text-muted-foreground">{{ unloggedInRange.length }}</span>
              </h2>
              <p class="text-xs text-muted-foreground">
                Cleaning jobs and tasks {{ user.name }} finished that have no time logged yet.
              </p>
            </div>
            <ul class="divide-y">
              <li v-for="w in shownUnlogged" :key="`${w.kind}:${w.id}`" class="flex items-center gap-3 px-5 py-3">
                <Icon :name="activityLogTypeMeta[w.type].icon" class="size-4 shrink-0 text-muted-foreground" :aria-label="activityLogTypeMeta[w.type].label" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ w.title }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{ logPlace(w) }} · {{ formatDay(w.date) }}
                  </p>
                </div>
                <span class="w-16 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{{ w.minutes ? formatDuration(w.minutes) : 'no time' }}</span>
                <Button size="sm" variant="outline" @click="logWork(w)">
                  Log time
                </Button>
              </li>
            </ul>
            <div v-if="unloggedInRange.length > 5" class="border-t px-5 py-2">
              <Button variant="ghost" size="sm" @click="showAllUnlogged = !showAllUnlogged">
                {{ showAllUnlogged ? 'Show fewer' : `Show all ${unloggedInRange.length}` }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card class="gap-0 py-0">
          <CardContent class="space-y-3 p-5">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold">
                Time per day
              </h2>
              <p v-if="user.hoursPerDay" class="text-xs text-muted-foreground">
                Dashed line: {{ user.hoursPerDay }}h working day
              </p>
            </div>
            <ActivityDailyChart :series="series" :target-per-day="Math.round(user.hoursPerDay * 60)" />
          </CardContent>
        </Card>

        <div class="flex flex-wrap items-center gap-2">
          <div class="relative w-full sm:w-64">
            <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="search" class="pl-9" placeholder="Search work or listing" aria-label="Search work or listing" />
          </div>
          <ToggleGroup v-model="typeFilter" type="multiple" variant="outline" aria-label="Type of work">
            <ToggleGroupItem v-for="t in shownTypes" :key="t" :value="t" class="flex-none gap-1.5 whitespace-nowrap px-3">
              <Icon :name="activityLogTypeMeta[t].icon" class="size-4" />
              {{ activityLogTypeMeta[t].label }}
            </ToggleGroupItem>
          </ToggleGroup>
          <Button v-if="filtered" variant="ghost" @click="clearFilters">
            Clear filters
          </Button>
          <div v-if="hasOtherTenants" class="flex items-center gap-2 sm:ml-auto">
            <Switch id="include-other-tenants" :model-value="includeOtherTenants" @update:model-value="includeOtherTenants = $event === true" />
            <Label for="include-other-tenants" class="cursor-pointer">Include transferred tenants</Label>
          </div>
          <div v-if="typeFilter.includes('cleaning') && kindOptions.length" class="flex w-full flex-wrap items-center gap-2">
            <span class="text-sm text-muted-foreground">Cleaning type</span>
            <ToggleGroup v-model="cleaningKinds" type="multiple" variant="outline" aria-label="Kind of cleaning">
              <ToggleGroupItem v-for="k in kindOptions" :key="k" :value="k" class="flex-none gap-1.5 whitespace-nowrap px-3">
                {{ cleaningTypeLabels[k] }}
                <span class="text-xs tabular-nums text-muted-foreground">{{ kindCounts[k] ?? 0 }}</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <p v-if="hasOtherTenants" class="-mt-3 text-xs text-muted-foreground">
          <template v-if="includeOtherTenants">
            Showing time for all {{ assignedTenants.length }} tenants: {{ assignedTenants.map(t => t.name).join(', ') }}.
          </template>
          <template v-else>
            Showing {{ activeTenantName }} only.
            <template v-if="otherTenantLogs">
              {{ otherTenantLogs }} {{ otherTenantLogs === 1 ? 'activity' : 'activities' }} in other tenants {{ otherTenantLogs === 1 ? 'is' : 'are' }} hidden.
            </template>
          </template>
        </p>

        <Empty v-if="!groups.length" class="rounded-lg border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon :name="filtered ? 'lucide:search-x' : 'lucide:timer'" />
            </EmptyMedia>
            <EmptyTitle>{{ filtered ? 'Nothing matches these filters' : 'No activity in this period' }}</EmptyTitle>
            <EmptyDescription>
              {{ filtered ? 'Try another type or search, or clear the filters.' : `${user.name} did not log time between these dates.` }}
            </EmptyDescription>
          </EmptyHeader>
          <Button v-if="filtered" variant="outline" @click="clearFilters">
            Clear filters
          </Button>
        </Empty>

        <div v-else class="space-y-4">
          <Card v-for="group in pagedGroups" :key="group.date" class="gap-0 overflow-hidden py-0">
            <CardContent class="p-0">
              <div class="flex items-center justify-between border-b bg-muted/30 px-5 py-3">
                <h2 class="text-sm font-semibold">
                  {{ formatDay(group.date) }}
                  <span class="ml-2 font-normal text-muted-foreground">{{ group.count }} {{ group.count === 1 ? 'activity' : 'activities' }}</span>
                </h2>
                <span class="text-sm tabular-nums text-muted-foreground">Total {{ formatDuration(group.minutes) }}</span>
              </div>
              <ul class="divide-y">
                <li v-for="row in group.rows" :key="row.key">
                  <ActivityLogRow
                    v-if="row.logs.length === 1"
                    :log="row.logs[0]!"
                    :long="isLong(row.logs[0]!)"
                    :tenant="foreignTenant(row.logs[0]!)"
                    @edit="openEdit"
                    @remove="openRemove"
                  />
                  <template v-else>
                    <button
                      type="button"
                      class="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/30"
                      :aria-expanded="expanded.includes(row.key)"
                      @click="toggleRow(row.key)"
                    >
                      <Icon :name="activityLogTypeMeta[firstLog(row).type].icon" class="size-4 shrink-0 text-muted-foreground" />
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <p class="truncate text-sm font-medium">
                            {{ firstLog(row).title }}
                          </p>
                          <Badge variant="secondary" class="tabular-nums">
                            ×{{ row.logs.length }}
                          </Badge>
                          <Badge v-if="foreignTenant(firstLog(row))" variant="outline" class="gap-1 font-normal">
                            <Icon name="lucide:building" class="size-3" />
                            {{ foreignTenant(firstLog(row)) }}
                          </Badge>
                        </div>
                        <p class="truncate text-xs text-muted-foreground">
                          {{ logPlace(firstLog(row)) }}
                        </p>
                      </div>
                      <span class="w-16 shrink-0 text-right text-sm tabular-nums">{{ formatDuration(row.minutes) }}</span>
                      <Icon name="lucide:chevron-down" class="size-8 shrink-0 p-2 text-muted-foreground transition-transform" :class="expanded.includes(row.key) ? 'rotate-180' : ''" />
                    </button>
                    <div v-if="expanded.includes(row.key)" class="divide-y border-t">
                      <ActivityLogRow
                        v-for="log in row.logs"
                        :key="log.id"
                        nested
                        :log="log"
                        :long="isLong(log)"
                        :tenant="foreignTenant(log)"
                        @edit="openEdit"
                        @remove="openRemove"
                      />
                    </div>
                  </template>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card v-if="groups.length > 5" class="gap-0 py-0">
            <ActivityPager v-model:page="page" v-model:page-size="pageSize" :total="groups.length" :sizes="[5, 10, 20]" unit="days" />
          </Card>
        </div>
      </template>

      <ActivityEditDialog v-model:open="editOpen" :log="editing" />
      <ActivityRemoveDialog v-model:open="removeOpen" :log="removing" />
      <ActivityListingsSheet v-model:open="listingsOpen" :items="listingsWorked" />
      <template v-if="user">
        <ActivityHistorySheet v-model:open="historyOpen" :entries="history" :name="user.name" />
        <ActivityAddDialog v-model:open="addOpen" :user-id="user.id" :name="user.name" :default-date="range.to" :work="unloggedAll" :initial-work="initialWork" />
      </template>
    </div>
  </ClientOnly>
</template>
