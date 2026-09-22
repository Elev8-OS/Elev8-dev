<!-- app/pages/users/[id].vue -->
<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Skeleton } from '~/components/ui/skeleton'
import { Separator } from '~/components/ui/separator'
import { format, formatDistanceToNow } from 'date-fns'
import { useUsers } from '~/composables/useUsers'
import { useRoles } from '~/composables/useRoles'
import { useUserActivities } from '~/composables/useUserActivities'
import { useUserAttendance } from '~/composables/useUserAttendance'
import { activityTypeMeta } from '~/components/users/data/user-activities'
import type { UserActivityType } from '~/components/users/data/user-activities'
import { attendanceStatusMeta } from '~/components/users/data/user-attendance'
import { listings } from '~/components/listings/data/listings'
import { PREFERRED_LANGUAGES } from '~/components/users/data/users'
import UserDetailSheet from '~/components/users/UserDetailSheet.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const { getUser } = useUsers()
const { getRole } = useRoles()
const { getActivitiesForUser, activityCountByUser, lastActivityForUser } = useUserActivities()
const { getAttendanceForUser, attendanceSummaryForUser } = useUserAttendance()

const userId = computed(() => String(route.params.id))
const user = computed(() => getUser(userId.value))

const role = computed(() => user.value ? getRole(user.value.roleId) : undefined)
const assignedListings = computed(() => {
  if (!user.value) return []
  return listings.value.filter(l => user.value!.listingIds.includes(l.id))
})

const summary = computed(() => user.value ? attendanceSummaryForUser(user.value.id) : null)
const activities = computed(() => user.value ? getActivitiesForUser(user.value.id) : [])
const activityCount30 = computed(() => user.value ? activityCountByUser(user.value.id, 30) : 0)
const lastActivity = computed(() => user.value ? lastActivityForUser(user.value.id) : undefined)
const attendanceRecords = computed(() => user.value ? getAttendanceForUser(user.value.id) : [])

// Activity type filter — empty Set means "show all"
const selectedActivityTypes = ref<Set<UserActivityType>>(new Set())

// Per-type counts (always computed from full activities, not filtered)
const activityTypeCounts = computed(() => {
  const counts: Partial<Record<UserActivityType, number>> = {}
  for (const a of activities.value) {
    counts[a.type] = (counts[a.type] ?? 0) + 1
  }
  return counts
})

// Per-listing activity counts (for the breakdown card)
const activityByListing = computed(() => {
  const counts: { name: string, count: number }[] = []
  const seen = new Map<string, number>()
  for (const a of activities.value) {
    if (!a.listingName) continue
    seen.set(a.listingName, (seen.get(a.listingName) ?? 0) + 1)
  }
  for (const [name, count] of seen) counts.push({ name, count })
  return counts.sort((a, b) => b.count - a.count)
})

const filteredActivities = computed(() => {
  if (selectedActivityTypes.value.size === 0) return activities.value
  return activities.value.filter(a => selectedActivityTypes.value.has(a.type))
})

function toggleActivityType(type: UserActivityType) {
  const next = new Set(selectedActivityTypes.value)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  selectedActivityTypes.value = next
}

function clearActivityTypeFilter() {
  selectedActivityTypes.value = new Set()
}

const preferredLanguageLabel = computed(() => {
  if (!user.value) return ''
  return PREFERRED_LANGUAGES.find(l => l.value === user.value!.preferredLanguage)?.label ?? user.value.preferredLanguage
})

// Edit sheet state
const editSheetOpen = ref(false)
function openEdit() {
  editSheetOpen.value = true
}

// Format helpers
function fmtCurrency(amount: number): string {
  if (!amount) return '—'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}
function fmtHours(h?: number): string {
  if (h === undefined || h === null) return '—'
  return `${h.toFixed(2)} h`
}
function fmtActivityTimestamp(iso: string): { date: string, time: string } {
  const d = new Date(iso)
  return {
    date: format(d, 'EEE, d MMM'),
    time: format(d, 'HH:mm'),
  }
}
function lastActiveLabel(): string {
  if (!lastActivity.value) return 'No activity'
  return formatDistanceToNow(new Date(lastActivity.value.timestamp), { addSuffix: true })
}

const attendanceSummaryCells = computed(() => {
  if (!summary.value) return []
  return [
    { label: 'Present', value: summary.value.present, badgeClass: attendanceStatusMeta.present.badgeClass },
    { label: 'Late', value: summary.value.late, badgeClass: attendanceStatusMeta.late.badgeClass },
    { label: 'Half day', value: summary.value.halfDay, badgeClass: attendanceStatusMeta.half_day.badgeClass },
    { label: 'Absent', value: summary.value.absent, badgeClass: attendanceStatusMeta.absent.badgeClass },
  ]
})

// On-time rate and average clock-in (HH:mm) — derived from attendance records
const attendanceInsights = computed(() => {
  const records = attendanceRecords.value.filter(r => r.clockIn && r.status !== 'absent')
  if (records.length === 0) return { onTimePct: 0, avgClockIn: '—', avgHours: 0 }

  // Count "on-time" = present + half_day (anything not flagged 'late')
  const onTime = records.filter(r => r.status !== 'late').length
  const onTimePct = Math.round((onTime / records.length) * 100)

  // Average clock-in time across records (parse HH:mm → minutes since midnight)
  const totalMins = records.reduce((sum, r) => {
    const [h = 0, m = 0] = r.clockIn.split(':').map(Number)
    return sum + (h * 60 + m)
  }, 0)
  const avgMins = Math.round(totalMins / records.length)
  const avgH = Math.floor(avgMins / 60)
  const avgM = avgMins % 60
  const avgClockIn = `${String(avgH).padStart(2, '0')}:${String(avgM).padStart(2, '0')}`

  // Average total hours per day (from records that have totalHours)
  const hoursRecords = records.filter(r => r.totalHours !== undefined)
  const avgHours = hoursRecords.length === 0
    ? 0
    : hoursRecords.reduce((sum, r) => sum + (r.totalHours ?? 0), 0) / hoursRecords.length

  return { onTimePct, avgClockIn, avgHours }
})
</script>

<template>
  <ClientOnly>
    <div v-if="!user" class="flex flex-col items-center justify-center gap-4 py-24">
      <Icon name="lucide:user-x" class="size-12 text-muted-foreground" />
      <h2 class="text-lg font-semibold">
        User not found
      </h2>
      <p class="text-sm text-muted-foreground">
        The user you’re looking for doesn’t exist or has been removed.
      </p>
      <Button variant="outline" size="sm" @click="router.push('/users')">
        <Icon name="lucide:arrow-left" class="mr-2 size-4" />
        Back to Users
      </Button>
    </div>

    <div v-else class="space-y-6 p-6">
      <!-- Back + Edit -->
      <div class="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" @click="router.push('/users')">
          <Icon name="lucide:arrow-left" class="mr-2 size-4" />
          Back to Users
        </Button>
        <Button size="sm" @click="openEdit">
          <Icon name="lucide:pencil" class="mr-2 size-4" />
          Edit
        </Button>
      </div>

      <!-- Hero -->
      <div class="flex items-start gap-4">
        <Avatar class="size-16">
          <AvatarFallback class="bg-primary/10 text-primary text-xl">
            {{ user.initials }}
          </AvatarFallback>
        </Avatar>
        <div class="flex-1 min-w-0 space-y-1.5">
          <h1 class="text-2xl font-bold tracking-tight truncate">
            {{ user.name }}
          </h1>
          <p class="text-sm text-muted-foreground truncate">
            {{ user.email }}
          </p>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary">
              <Icon name="lucide:shield-check" class="mr-1 size-3" />
              {{ role?.name ?? 'Unknown role' }}
            </Badge>
            <Badge :variant="user.status === 'active' ? 'default' : 'outline'" :class="user.status === 'active' ? 'bg-green-500/10 text-green-700 border-green-500/30' : ''">
              <Icon :name="user.status === 'active' ? 'lucide:user-check' : 'lucide:user-x'" class="mr-1 size-3" />
              {{ user.status === 'active' ? 'Active' : 'Inactive' }}
            </Badge>
            <Badge v-if="user.listingIds.length === 0" variant="outline">
              <Icon name="lucide:globe" class="mr-1 size-3" />
              All listings
            </Badge>
          </div>
        </div>
      </div>

      <!-- KPI strip -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent class="p-4">
            <div class="text-xs text-muted-foreground uppercase tracking-wide">
              Attendance (14d)
            </div>
            <div class="text-2xl font-bold mt-1 text-green-600">
              {{ summary?.attendancePct ?? 0 }}%
            </div>
            <div class="text-xs text-muted-foreground mt-1">
              {{ fmtHours(summary?.totalHours) }} total
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="p-4">
            <div class="text-xs text-muted-foreground uppercase tracking-wide">
              Activities (30d)
            </div>
            <div class="text-2xl font-bold mt-1">
              {{ activityCount30 }}
            </div>
            <div class="text-xs text-muted-foreground mt-1">
              Across all listings
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="p-4">
            <div class="text-xs text-muted-foreground uppercase tracking-wide">
              Last active
            </div>
            <div class="text-lg font-semibold mt-1 truncate">
              {{ lastActiveLabel() }}
            </div>
            <div class="text-xs text-muted-foreground mt-1">
              {{ lastActivity ? activityTypeMeta[lastActivity.type].label : 'No recent activity' }}
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Tabs -->
      <Tabs default-value="profile" class="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <Icon name="lucide:user-round" class="mr-2 size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="activities">
            <Icon name="lucide:activity" class="mr-2 size-4" />
            Activities
            <Badge variant="secondary" class="ml-2">
              {{ activities.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <Icon name="lucide:calendar-clock" class="mr-2 size-4" />
            Attendance
          </TabsTrigger>
        </TabsList>

        <!-- PROFILE -->
        <TabsContent value="profile" class="space-y-4">
          <Card>
            <CardContent class="p-6 space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Full name
                  </div>
                  <div class="text-sm font-medium mt-1">
                    {{ user.name }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Email
                  </div>
                  <div class="text-sm font-medium mt-1 truncate">
                    {{ user.email }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Phone
                  </div>
                  <div class="text-sm font-medium mt-1">
                    {{ user.phone || '—' }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Preferred language
                  </div>
                  <div class="text-sm font-medium mt-1">
                    {{ preferredLanguageLabel }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Employee #
                  </div>
                  <div class="text-sm font-medium mt-1">
                    {{ user.employeeNumber || '—' }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Role
                  </div>
                  <div class="text-sm font-medium mt-1">
                    {{ role?.name ?? 'Unknown' }}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Assigned listings
                </div>
                <div v-if="user.listingIds.length === 0" class="inline-flex items-center gap-1 text-sm text-muted-foreground italic">
                  <Icon name="lucide:globe" class="size-3" />
                  All listings (tenant-wide access)
                </div>
                <div v-else class="flex flex-wrap gap-2">
                  <Badge v-for="l in assignedListings" :key="l.id" variant="outline">
                    {{ l.name }}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div class="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Monthly salary
                  </div>
                  <div class="text-sm font-medium mt-1">
                    {{ fmtCurrency(user.monthlySalaryAmount) }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Working days / month
                  </div>
                  <div class="text-sm font-medium mt-1">
                    {{ user.workingDaysPerMonth || '—' }}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Hours / day
                  </div>
                  <div class="text-sm font-medium mt-1">
                    {{ user.hoursPerDay || '—' }}
                  </div>
                </div>
              </div>

              <div v-if="role?.description" class="rounded-lg border bg-muted/40 p-3">
                <div class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Role description
                </div>
                <p class="text-sm">
                  {{ role.description }}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ACTIVITIES -->
        <TabsContent value="activities" class="space-y-4">
          <!-- Per-listing breakdown (only when activities span multiple listings) -->
          <Card v-if="activityByListing.length > 1">
            <CardContent class="p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="text-xs text-muted-foreground uppercase tracking-wide">
                  Activity by listing
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ activityByListing.length }} listings
                </div>
              </div>
              <div class="space-y-2">
                <div
                  v-for="l in activityByListing"
                  :key="l.name"
                  class="flex items-center gap-3"
                >
                  <div class="flex items-center gap-2 w-40 truncate text-sm">
                    <Icon name="lucide:home" class="size-3.5 text-muted-foreground shrink-0" />
                    <span class="truncate">{{ l.name }}</span>
                  </div>
                  <div class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      class="h-full bg-primary rounded-full transition-all"
                      :style="{ width: `${(l.count / activityByListing[0].count) * 100}%` }"
                    />
                  </div>
                  <div class="text-xs text-muted-foreground w-10 text-right tabular-nums">
                    {{ l.count }}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent class="p-0">
              <!-- Filter chips -->
              <div v-if="activities.length > 0" class="flex flex-wrap items-center gap-1.5 px-4 py-3 border-b">
                <span class="text-xs text-muted-foreground mr-1">Filter:</span>
                <button
                  v-for="(meta, type) in activityTypeMeta"
                  :key="type"
                  type="button"
                  :class="[
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    selectedActivityTypes.size === 0 || selectedActivityTypes.has(type)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted',
                  ]"
                  @click="toggleActivityType(type)"
                >
                  <Icon :name="meta.icon" class="size-3" />
                  {{ meta.label }}
                  <span v-if="activityTypeCounts[type]" class="ml-0.5 opacity-70">
                    {{ activityTypeCounts[type] }}
                  </span>
                </button>
                <Button
                  v-if="selectedActivityTypes.size > 0"
                  variant="ghost"
                  size="sm"
                  class="h-6 px-2 text-xs"
                  @click="clearActivityTypeFilter"
                >
                  Clear
                </Button>
              </div>

              <div v-if="activities.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                <Icon name="lucide:activity" class="size-8 opacity-50" />
                No activities recorded yet.
              </div>
              <div v-else-if="filteredActivities.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                <Icon name="lucide:filter-x" class="size-8 opacity-50" />
                No activities match the selected filters.
                <Button variant="link" size="sm" @click="clearActivityTypeFilter">
                  Clear filters
                </Button>
              </div>
              <ol v-else class="divide-y">
                <li
                  v-for="a in filteredActivities"
                  :key="a.id"
                  class="flex items-start gap-3 px-4 py-3"
                >
                  <div :class="['flex size-9 items-center justify-center rounded-full shrink-0', activityTypeMeta[a.type].tone]">
                    <Icon :name="activityTypeMeta[a.type].icon" class="size-4" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline justify-between gap-2">
                      <div class="text-sm font-medium truncate">
                        {{ a.title }}
                      </div>
                      <div class="text-xs text-muted-foreground whitespace-nowrap">
                        {{ fmtActivityTimestamp(a.timestamp).date }} · {{ fmtActivityTimestamp(a.timestamp).time }}
                      </div>
                    </div>
                    <div v-if="a.description" class="text-xs text-muted-foreground mt-0.5 truncate">
                      {{ a.description }}
                    </div>
                    <div class="flex items-center gap-2 mt-1.5">
                      <Badge v-if="a.listingName" variant="outline" class="text-xs">
                        <Icon name="lucide:home" class="mr-1 size-3" />
                        {{ a.listingName }}
                      </Badge>
                      <Badge v-if="a.durationMinutes" variant="outline" class="text-xs">
                        <Icon name="lucide:clock" class="mr-1 size-3" />
                        {{ a.durationMinutes }} min
                      </Badge>
                      <Badge variant="secondary" class="text-xs">
                        {{ activityTypeMeta[a.type].label }}
                      </Badge>
                    </div>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ATTENDANCE -->
        <TabsContent value="attendance" class="space-y-4">
          <!-- Monthly summary -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card v-for="cell in attendanceSummaryCells" :key="cell.label">
              <CardContent class="p-4">
                <div class="text-xs text-muted-foreground uppercase tracking-wide">
                  {{ cell.label }}
                </div>
                <div :class="['text-2xl font-bold mt-1']">
                  {{ cell.value }}
                </div>
                <Badge :class="['mt-2 text-xs', cell.badgeClass]" variant="outline">
                  days
                </Badge>
              </CardContent>
            </Card>
          </div>

          <!-- Insights strip -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent class="p-4">
                <div class="text-xs text-muted-foreground uppercase tracking-wide">
                  On-time rate
                </div>
                <div class="text-2xl font-bold mt-1 text-green-600">
                  {{ attendanceInsights.onTimePct }}%
                </div>
                <div class="text-xs text-muted-foreground mt-1">
                  Not flagged late
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent class="p-4">
                <div class="text-xs text-muted-foreground uppercase tracking-wide">
                  Avg clock-in
                </div>
                <div class="text-2xl font-bold mt-1 font-mono">
                  {{ attendanceInsights.avgClockIn }}
                </div>
                <div class="text-xs text-muted-foreground mt-1">
                  Across working days
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent class="p-4">
                <div class="text-xs text-muted-foreground uppercase tracking-wide">
                  Avg hours / day
                </div>
                <div class="text-2xl font-bold mt-1">
                  {{ attendanceInsights.avgHours ? `${attendanceInsights.avgHours.toFixed(2)} h` : '—' }}
                </div>
                <div class="text-xs text-muted-foreground mt-1">
                  When present
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- Table -->
          <Card>
            <CardContent class="p-0">
              <div class="rounded-md border overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th class="text-left font-medium px-4 py-3">
                        Date
                      </th>
                      <th class="text-left font-medium px-4 py-3">
                        Clock in
                      </th>
                      <th class="text-left font-medium px-4 py-3">
                        Clock out
                      </th>
                      <th class="text-left font-medium px-4 py-3">
                        Total
                      </th>
                      <th class="text-left font-medium px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in attendanceRecords"
                      :key="r.id"
                      class="border-t hover:bg-muted/30 transition-colors"
                    >
                      <td class="px-4 py-3 font-medium">
                        {{ format(new Date(`${r.date}T00:00:00Z`), 'EEE, d MMM yyyy') }}
                      </td>
                      <td class="px-4 py-3 font-mono">
                        {{ r.clockIn }}
                      </td>
                      <td class="px-4 py-3 font-mono">
                        {{ r.clockOut ?? '—' }}
                      </td>
                      <td class="px-4 py-3">
                        {{ fmtHours(r.totalHours) }}
                      </td>
                      <td class="px-4 py-3">
                        <Badge variant="outline" :class="['text-xs', attendanceStatusMeta[r.status].badgeClass]">
                          {{ attendanceStatusMeta[r.status].label }}
                        </Badge>
                      </td>
                    </tr>
                    <tr v-if="attendanceRecords.length === 0">
                      <td colspan="5" class="px-4 py-12 text-center text-sm text-muted-foreground">
                        <div class="flex flex-col items-center gap-2">
                          <Icon name="lucide:calendar-clock" class="size-8 opacity-50" />
                          No attendance records yet.
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>

    <!-- Edit sheet -->
    <UserDetailSheet
      v-if="user"
      v-model:open="editSheetOpen"
      :user-id="user.id"
    />

    <template #fallback>
      <div class="space-y-6 p-6">
        <Skeleton class="h-9 w-32" />
        <div class="flex items-start gap-4">
          <Skeleton class="size-16 rounded-full" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-7 w-48" />
            <Skeleton class="h-4 w-64" />
            <Skeleton class="h-5 w-32" />
          </div>
        </div>
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-64 w-full" />
      </div>
    </template>
  </ClientOnly>
</template>