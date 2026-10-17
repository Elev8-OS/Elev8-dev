<script setup lang="ts">
import { parseLocalDateKey, toLocalDateKey } from '~/components/activities/data/activities'
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'
import BaseSearchInput from '~/components/base/SearchInput.vue'
import ScheduleCell from '~/components/schedule/ScheduleCell.vue'
import ScheduleDayDialog from '~/components/schedule/ScheduleDayDialog.vue'
import ScheduleDefaultsPanel from '~/components/schedule/ScheduleDefaultsPanel.vue'
import SchedulePersonSheet from '~/components/schedule/SchedulePersonSheet.vue'
import ScheduleShiftsPanel from '~/components/schedule/ScheduleShiftsPanel.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { useAttendanceReport } from '~/composables/useAttendanceReport'
import { useRoles } from '~/composables/useRoles'
import { useSchedule } from '~/composables/useSchedule'
import { useScheduleUndo } from '~/composables/useScheduleUndo'
import { useUsers } from '~/composables/useUsers'
import { addDays, toneOf, weekStart } from '~/lib/schedule'
import { cn } from '~/lib/utils'

definePageMeta({ layout: 'default' })

const { users } = useUsers()
const { roles } = useRoles()
const { run } = useScheduleUndo()
const { attendanceStatus, selection: attendanceSelection } = useAttendanceReport()
const { shifts, rotations, scheduleFor, carryOverFor, copyWeek } = useSchedule()

// Tabs: Week (the grid), Shifts (the templates), Defaults (what each role works). Kept in `?tab=` so a link can open one.
const route = useRoute()
const router = useRouter()
const TABS = ['week', 'shifts', 'defaults']
const tab = ref(TABS.includes(String(route.query.tab)) ? String(route.query.tab) : 'week')
watch(tab, v => router.replace({ query: v === 'week' ? {} : { tab: v } }))
watch(() => route.query.tab, (v) => {
  const next = TABS.includes(String(v)) ? String(v) : 'week'
  if (next !== tab.value)
    tab.value = next
})

// What the cells are about: the plan, or what was clocked. Remembered for next time.
type View = 'schedule' | 'attendance'
const VIEW_KEY = 'elev8-schedule-view'
const view = ref<View>('schedule')
onMounted(() => {
  try {
    if (localStorage.getItem(VIEW_KEY) === 'attendance')
      view.value = 'attendance'
  }
  catch {}
})
watch(view, (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  }
  catch {}
})

const ALL = 'all'
const query = ref('')
const roleId = ref(ALL)
const filtered = computed(() => !!query.value.trim() || roleId.value !== ALL)
const roleOptions = computed(() => roles.value.filter(r => users.value.some(u => u.roleId === r.id && u.status === 'active')))

function clearFilters() {
  query.value = ''
  roleId.value = ALL
}

const todayKey = toLocalDateKey(new Date())
const monday = ref(weekStart(todayKey))
const days = computed(() => Array.from({ length: 7 }, (_, i) => addDays(monday.value, i)))
const isThisWeek = computed(() => monday.value === weekStart(todayKey))

const headFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const weekLabel = computed(() => `${dateFmt.format(parseLocalDateKey(days.value[0]!))} to ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseLocalDateKey(days.value[6]!))}`)

const roleName = (id: string) => roles.value.find(r => r.id === id)?.name ?? ''

const people = computed(() => {
  const q = query.value.trim().toLowerCase()
  return users.value
    .filter(u => u.status === 'active' && u.roleId !== 'role-owner')
    .filter(u => roleId.value === ALL || u.roleId === roleId.value)
    .filter(u => !q || u.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const cells = computed(() => people.value.map(u => ({
  user: u,
  rotation: rotations.value[u.id],
  days: days.value.map(date => ({ date, day: scheduleFor(u.id, date), carry: carryOverFor(u.id, date), attendance: attendanceStatus(u.id, date) })),
})))

// Who is off each day, for the footer row.
const offPerDay = computed(() => days.value.map((_, i) => cells.value.filter(c => !c.days[i]!.day.working).length))

// Dialogs
const dayOpen = ref(false)
const dayUserIds = ref<string[]>([])
const dayDate = ref<string | null>(null)
const personOpen = ref(false)
const personUserId = ref<string | null>(null)

function openDay(u: { id: string }, date: string) {
  dayUserIds.value = [u.id]
  dayDate.value = date
  dayOpen.value = true
}

// Several people at once: tick them, then Assign.
const selected = ref<string[]>([])
const allSelected = computed(() => people.value.length > 0 && people.value.every(u => selected.value.includes(u.id)))
// Only people still on screen stay ticked, so a filter never assigns someone you cannot see.
const selectedShown = computed(() => people.value.filter(u => selected.value.includes(u.id)).map(u => u.id))

function toggleSelected(id: string) {
  selected.value = selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value, id]
}

function toggleAll() {
  selected.value = allSelected.value ? [] : people.value.map(u => u.id)
}

function openAssign() {
  dayUserIds.value = selectedShown.value
  dayDate.value = days.value.find(d => d >= todayKey) ?? days.value[0]!
  dayOpen.value = true
}

function copyLastWeek() {
  const ids = selectedShown.value.length ? selectedShown.value : people.value.map(u => u.id)
  let copied = 0
  run(() => copied ? `Copied ${copied} ${copied === 1 ? 'change' : 'changes'} from last week` : 'Last week had no changes, so this week now follows the usual schedule', () => {
    const { count, problem } = copyWeek(ids, addDays(monday.value, -7), monday.value)
    copied = count
    return problem
  })
}

/** Opens Attendance on that day. */
function openAttendance(date: string) {
  attendanceSelection.value = { preset: 'custom', range: { from: date, to: date } }
  navigateTo('/attendance')
}

function openPerson(userId: string) {
  personUserId.value = userId
  personOpen.value = true
}
</script>

<template>
  <ClientOnly>
    <div class="space-y-6 p-4 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-2xl font-bold tracking-tight">
            Schedule
          </h1>
          <p class="text-sm text-muted-foreground">
            <template v-if="tab === 'week'">
              Who works when, {{ weekLabel }}. Click a day to change it.
            </template>
            <template v-else-if="tab === 'shifts'">
              The shifts your team works.
            </template>
            <template v-else>
              What each role works by default.
            </template>
          </p>
        </div>
        <div v-if="tab === 'week'" class="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous week" @click="monday = addDays(monday, -7)">
            <Icon name="lucide:chevron-left" class="size-4" />
          </Button>
          <Button variant="outline" :disabled="isThisWeek" @click="monday = weekStart(todayKey)">
            This week
          </Button>
          <Button variant="outline" size="icon" aria-label="Next week" @click="monday = addDays(monday, 7)">
            <Icon name="lucide:chevron-right" class="size-4" />
          </Button>
        </div>
      </div>

      <Tabs v-model="tab" class="space-y-6">
        <TabsList>
          <TabsTrigger value="week">
            Week
          </TabsTrigger>
          <TabsTrigger value="shifts">
            Shifts
          </TabsTrigger>
          <TabsTrigger value="defaults">
            Role defaults
          </TabsTrigger>
        </TabsList>

        <TabsContent value="week" class="space-y-6">
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
        <Button v-if="filtered" variant="ghost" @click="clearFilters">
          Clear filters
        </Button>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <ToggleGroup :model-value="view" type="single" variant="outline" aria-label="What the cells show" @update:model-value="v => { if (v === 'schedule' || v === 'attendance') view = v }">
            <ToggleGroupItem value="schedule" class="flex-none px-4">
              Schedule
            </ToggleGroupItem>
            <ToggleGroupItem value="attendance" class="flex-none px-4">
              Attendance
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" @click="copyLastWeek">
            <Icon name="lucide:copy" class="mr-2 size-4" />
            Copy last week{{ selectedShown.length ? ` (${selectedShown.length})` : '' }}
          </Button>
          <Button :disabled="!selectedShown.length" @click="openAssign">
            <Icon name="lucide:calendar-plus" class="mr-2 size-4" />
            Assign{{ selectedShown.length ? ` (${selectedShown.length})` : '' }}
          </Button>
        </div>
      </div>

      <div v-if="shifts.length" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span v-for="t in shifts" :key="t.id" class="flex items-center gap-1.5">
          <span :class="cn('size-2.5 rounded-full', toneOf(t.tone).dot)" aria-hidden="true" />
          {{ t.name }} {{ t.start }} to {{ t.end }}
        </span>
      </div>

      <Card class="gap-0 overflow-hidden py-0">
        <CardContent class="p-0">
            <Table v-if="cells.length">
              <TableHeader>
                <TableRow>
                  <TableHead class="min-w-60">
                    <div class="flex items-center gap-3">
                      <div role="checkbox" tabindex="0" :aria-checked="allSelected" aria-label="Select everyone shown" class="flex size-4 cursor-pointer items-center justify-center rounded-[4px] border" :class="allSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'" @click="toggleAll" @keydown.enter.prevent="toggleAll" @keydown.space.prevent="toggleAll">
                        <Icon v-if="allSelected" name="lucide:check" class="size-3" />
                      </div>
                      Staff
                    </div>
                  </TableHead>
                  <TableHead v-for="d in days" :key="d" :class="cn('min-w-32 text-center', d === todayKey && 'text-primary')">
                    {{ headFmt.format(parseLocalDateKey(d)) }}
                    <span class="block text-xs font-normal text-muted-foreground">{{ dateFmt.format(parseLocalDateKey(d)) }}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="c in cells" :key="c.user.id">
                  <TableCell>
                    <div class="flex items-center gap-3">
                      <div role="checkbox" tabindex="0" :aria-checked="selected.includes(c.user.id)" :aria-label="`Select ${c.user.name}`" class="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border" :class="selected.includes(c.user.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'" @click="toggleSelected(c.user.id)" @keydown.enter.prevent="toggleSelected(c.user.id)" @keydown.space.prevent="toggleSelected(c.user.id)">
                        <Icon v-if="selected.includes(c.user.id)" name="lucide:check" class="size-3" />
                      </div>
                      <BasePersonAvatar :name="c.user.name" :src="c.user.avatarUrl" />
                      <div class="min-w-0">
                        <p class="truncate font-medium">
                          {{ c.user.name }}
                        </p>
                        <p class="truncate text-xs text-muted-foreground">
                          {{ roleName(c.user.roleId) }}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" :class="cn('ml-auto size-8 shrink-0', c.rotation && 'text-primary')" :aria-label="`Schedule for ${c.user.name}`" @click="openPerson(c.user.id)">
                        <Icon :name="c.rotation ? 'lucide:repeat' : 'lucide:calendar-cog'" class="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell v-for="cell in c.days" :key="cell.date" class="p-1.5">
                    <ScheduleCell
                      :name="c.user.name"
                      :date="cell.date"
                      :today="todayKey"
                      :day="cell.day"
                      :carry="cell.carry"
                      :attendance="cell.attendance"
                      :view="view"
                      @change="openDay(c.user, cell.date)"
                      @open-attendance="openAttendance(cell.date)"
                    />
                  </TableCell>
                </TableRow>
                <TableRow class="bg-muted/30 hover:bg-muted/30">
                  <TableCell class="text-xs text-muted-foreground">
                    Off each day
                  </TableCell>
                  <TableCell v-for="(n, i) in offPerDay" :key="days[i]" class="text-center">
                    <Badge :variant="n ? 'secondary' : 'outline'" class="tabular-nums">
                      {{ n }}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Empty v-else class="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon name="lucide:calendar-off" class="size-5" />
                </EmptyMedia>
                <EmptyTitle>No staff found</EmptyTitle>
                <EmptyDescription>Try another name or role.</EmptyDescription>
              </EmptyHeader>
            </Empty>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="shifts">
          <ScheduleShiftsPanel />
        </TabsContent>

        <TabsContent value="defaults">
          <ScheduleDefaultsPanel />
        </TabsContent>
      </Tabs>

      <ScheduleDayDialog v-model:open="dayOpen" :user-ids="dayUserIds" :date="dayDate" />
      <SchedulePersonSheet v-model:open="personOpen" :user-id="personUserId" />
    </div>
    <template #fallback>
      <div class="space-y-4 p-6">
        <Skeleton class="h-8 w-48" />
        <Skeleton class="h-96 w-full" />
      </div>
    </template>
  </ClientOnly>
</template>
