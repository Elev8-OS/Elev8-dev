<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { toast } from 'vue-sonner'
import { Icon } from '#components'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import type { BannerSeverity, BannerStatus } from '~/components/platform-console/data/banners'
import {
  SEVERITY_LABEL, BANNER_STATUS_LABEL, MAINTENANCE_PHASE_LABEL, MAINTENANCE_IMPACT_LABEL,
  bannerKind, canResolve, maintenancePhase,
} from '~/components/platform-console/data/banners'
import { formatCountdown, formatUtc } from '~/lib/platform-banner-time'
import { usePlatformBanners } from '~/composables/usePlatformBanners'
import { usePlatformAudit } from '~/composables/usePlatformAudit'
import { useTenants } from '~/composables/useTenants'

definePageMeta({ layout: 'platform-console' })

const { banners, resolveRecipients, retractBanner, duplicateBanner, postUpdate, resolveBanner } = usePlatformBanners()
const { auditLog } = usePlatformAudit()
const { tenants } = useTenants()
const router = useRouter()

type Row = typeof banners.value[number]
type Tab = 'all' | 'live' | 'scheduled' | 'ended'

const search = ref('')
const tab = ref<Tab>('all')
const severityFilter = ref<BannerSeverity | 'all'>('all')

// Detail sheet. The banner is looked up in the store so an update or resolve shows in the open sheet.
const selectedId = ref<string | null>(null)
const selected = computed(() => banners.value.find(b => b.id === selectedId.value) ?? null)
const sheetOpen = ref(false)

const retractConfirm = ref<{ id: string, title: string, wasLive: boolean } | null>(null)
// Open state is separate from the target: the dialog's action button closes the dialog
// before our click handler runs, so clearing the target on close left nothing to retract.
const retractOpen = ref(false)
const retractReason = ref('')

// "Now" for countdowns. Zero until mounted so the server and client agree on first paint.
const now = ref(0)
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  tick = setInterval(() => { now.value = Date.now() }, 30_000)
})
onBeforeUnmount(() => clearInterval(tick))

function tabOf(b: Row): Exclude<Tab, 'all'> {
  if (b.status === 'live') return 'live'
  if (b.status === 'scheduled') return 'scheduled'
  return 'ended'
}

const STATUS_RANK: Record<Exclude<Tab, 'all'>, number> = { live: 0, scheduled: 1, ended: 2 }

const tabCounts = computed(() => ({
  all: banners.value.length,
  live: banners.value.filter(b => tabOf(b) === 'live').length,
  scheduled: banners.value.filter(b => tabOf(b) === 'scheduled').length,
  ended: banners.value.filter(b => tabOf(b) === 'ended').length,
}))

const filtered = computed(() => banners.value
  .filter((b) => {
    if (tab.value !== 'all' && tabOf(b) !== tab.value) return false
    if (severityFilter.value !== 'all' && b.severity !== severityFilter.value) return false
    if (search.value && !b.title.toLowerCase().includes(search.value.toLowerCase())) return false
    return true
  })
  .sort((a, b) => {
    const byStatus = STATUS_RANK[tabOf(a)] - STATUS_RANK[tabOf(b)]
    if (byStatus !== 0) return byStatus
    // Upcoming things sort soonest first; everything else newest first.
    if (tabOf(a) === 'scheduled') return a.startAt.localeCompare(b.startAt)
    return b.createdAt.localeCompare(a.createdAt)
  }))

const eligibleTenantCount = computed(() => tenants.value.filter(t => !t.isInternal).length)
const reachedTenantCount = computed(() => {
  const ids = new Set<string>()
  for (const b of banners.value) {
    if (b.status === 'live') resolveRecipients(b).forEach(id => ids.add(id))
  }
  return ids.size
})

const maintenanceQueue = computed(() => banners.value
  .filter(b => bannerKind(b) === 'maintenance' && b.maintenance && ['live', 'scheduled'].includes(b.status) && !b.resolvedAt)
  .sort((a, b) => a.maintenance!.startAt.localeCompare(b.maintenance!.startAt)))

const stats = computed(() => [
  { key: 'live', label: 'Live now', value: String(tabCounts.value.live), hint: 'Showing on tenant dashboards', icon: 'lucide:radio' },
  { key: 'scheduled', label: 'Scheduled', value: String(tabCounts.value.scheduled), hint: 'Waiting for their start time', icon: 'lucide:calendar-clock' },
  { key: 'maintenance', label: 'Maintenance planned', value: String(maintenanceQueue.value.length), hint: 'Upcoming or under way', icon: 'lucide:wrench' },
  { key: 'reach', label: 'Tenants reached', value: `${reachedTenantCount.value} of ${eligibleTenantCount.value}`, hint: 'By banners that are live', icon: 'lucide:users' },
])

const ACTIVITY_LABEL: Record<string, { text: string, icon: string }> = {
  banner_scheduled: { text: 'Scheduled', icon: 'lucide:calendar-clock' },
  banner_live: { text: 'Went live', icon: 'lucide:radio' },
  banner_updated: { text: 'Update posted', icon: 'lucide:message-square-text' },
  banner_resolved: { text: 'Marked resolved', icon: 'lucide:circle-check' },
  banner_retracted: { text: 'Retracted', icon: 'lucide:ban' },
  banner_retracted_before_live: { text: 'Retracted before going live', icon: 'lucide:ban' },
  banner_expired: { text: 'Expired', icon: 'lucide:timer-off' },
}

const recentActivity = computed(() => auditLog.value
  .filter(e => e.targetType === 'banner' && e.action in ACTIVITY_LABEL)
  .slice()
  .reverse()
  .slice(0, 6)
  .map(e => ({
    id: e.id,
    ...ACTIVITY_LABEL[e.action]!,
    title: banners.value.find(b => b.id === e.targetId)?.title ?? 'Removed banner',
    at: e.createdAt,
  })))

function tileClass(b: Row): string {
  if (b.severity === 'critical') return 'bg-destructive/10 text-destructive'
  if (b.severity === 'warning') return 'bg-warning/25 text-warning-foreground'
  return 'bg-primary/10 text-primary'
}

function rowIcon(b: Row): string {
  if (b.resolvedAt) return 'lucide:circle-check'
  if (bannerKind(b) === 'maintenance') return 'lucide:wrench'
  if (b.severity === 'critical') return 'lucide:octagon-alert'
  if (b.severity === 'warning') return 'lucide:triangle-alert'
  return 'lucide:info'
}

function statusVariant(s: BannerStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'live') return 'default'
  if (s === 'scheduled') return 'secondary'
  return 'outline'
}

function audience(b: Row): string {
  const count = resolveRecipients(b).length
  if (b.targetFilter.scope === 'all') return `All tenants (${count})`
  if (b.targetFilter.scope === 'individual') return `${count} tenant${count === 1 ? '' : 's'}`
  const f = b.targetFilter
  const parts: string[] = []
  if (f.tiers?.length) parts.push(f.tiers.join(', '))
  if (f.regions?.length) parts.push(f.regions.join(', '))
  return `${parts.join(' · ') || 'Segment'} (${count})`
}

function rowSchedule(b: Row): string {
  if (b.maintenance && bannerKind(b) === 'maintenance') {
    return `${formatUtc(b.maintenance.startAt)} to ${b.maintenance.endAt.slice(11, 16)} UTC`
  }
  if (b.status === 'scheduled') return `Appears ${formatUtc(b.startAt)}`
  return `${formatUtc(b.startAt)}${b.endAt ? ` to ${formatUtc(b.endAt)}` : ''}`
}

function windowCountdown(b: Row): string {
  const w = b.maintenance
  if (!w || !now.value) return ''
  const phase = maintenancePhase(b, now.value)
  if (phase === 'upcoming') return `Starts in ${formatCountdown(new Date(w.startAt).getTime(), now.value)}`
  if (phase === 'in_progress') return `Ends in ${formatCountdown(new Date(w.endAt).getTime(), now.value)}`
  return 'Window ended, waiting to be resolved'
}

function view(b: Row) {
  selectedId.value = b.id
  sheetOpen.value = true
}

function retract(b: Row) {
  retractConfirm.value = { id: b.id, title: b.title, wasLive: b.status === 'live' }
  retractReason.value = ''
  retractOpen.value = true
}
function doRetract() {
  if (!retractConfirm.value) return
  try {
    retractBanner(retractConfirm.value.id, 'staff-1', retractReason.value || 'No reason provided')
    toast.success('Banner retracted.')
  }
  catch (e: any) {
    toast.error(e.message ?? 'Failed')
  }
  finally {
    retractConfirm.value = null
    retractOpen.value = false
  }
}

function dup(b: Row) {
  try {
    duplicateBanner(b.id)
  }
  catch (e: any) {
    toast.error(e.message ?? 'Could not duplicate')
    return
  }
  toast.success('Banner duplicated.')
}

const updateDialog = ref<{ id: string, title: string, mode: 'update' | 'resolve' } | null>(null)
const updateOpen = computed({
  get: () => !!updateDialog.value,
  set: (v: boolean) => { if (!v) updateDialog.value = null },
})
function openUpdate(b: Row, mode: 'update' | 'resolve') {
  updateDialog.value = { id: b.id, title: b.title, mode }
}
function submitUpdate(message: string) {
  const d = updateDialog.value
  if (!d) return
  try {
    if (d.mode === 'resolve') {
      resolveBanner(d.id, 'staff-1', message)
      toast.success('Marked as resolved.')
    }
    else {
      postUpdate(d.id, 'staff-1', message)
      toast.success('Update posted.')
    }
  }
  catch (e: any) {
    toast.error(e.message ?? 'Failed')
  }
  finally {
    updateDialog.value = null
  }
}

function goNew() {
  router.push('/platform-console/broadcasts/new')
}
</script>

<template>
  <div class="space-y-4 p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">Broadcasts</h2>
        <p class="text-sm text-muted-foreground">Tell tenants about maintenance, incidents and news. Messages appear on their dashboard.</p>
      </div>
      <PlatformConsoleRoleGate action="compose_banner">
        <Button @click="goNew">
          <Icon name="lucide:plus" class="mr-1.5 size-4" />
          New broadcast
        </Button>
      </PlatformConsoleRoleGate>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="broadcast-stats">
      <Card v-for="s in stats" :key="s.key" class="py-0">
        <CardContent class="flex items-start gap-3 p-4">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon :name="s.icon" class="size-4" />
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ s.label }}</div>
            <div class="text-2xl font-semibold leading-tight tabular-nums">{{ s.value }}</div>
            <div class="truncate text-xs text-muted-foreground">{{ s.hint }}</div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 xl:grid-cols-4">
      <div class="space-y-3 xl:col-span-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <Tabs v-model="tab">
            <TabsList>
              <TabsTrigger value="all">All <span class="ml-1.5 text-xs text-muted-foreground tabular-nums">{{ tabCounts.all }}</span></TabsTrigger>
              <TabsTrigger value="live">Live <span class="ml-1.5 text-xs text-muted-foreground tabular-nums">{{ tabCounts.live }}</span></TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled <span class="ml-1.5 text-xs text-muted-foreground tabular-nums">{{ tabCounts.scheduled }}</span></TabsTrigger>
              <TabsTrigger value="ended">Ended <span class="ml-1.5 text-xs text-muted-foreground tabular-nums">{{ tabCounts.ended }}</span></TabsTrigger>
            </TabsList>
          </Tabs>
          <div class="flex items-center gap-2">
            <BaseSearchInput v-model="search" placeholder="Search by title..." class="w-56" />
            <Select v-model="severityFilter">
              <SelectTrigger class="h-9 w-36" aria-label="Filter by severity"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem v-for="s in (['info', 'warning', 'critical'] as BannerSeverity[])" :key="s" :value="s">{{ SEVERITY_LABEL[s] }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Empty v-if="!filtered.length" class="border" data-testid="broadcast-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="lucide:megaphone" />
            </EmptyMedia>
            <EmptyTitle>{{ banners.length ? 'Nothing matches' : 'No broadcasts yet' }}</EmptyTitle>
            <EmptyDescription>
              {{ banners.length ? 'Try another tab, severity or search.' : 'Send tenants a maintenance notice or an announcement.' }}
            </EmptyDescription>
          </EmptyHeader>
          <PlatformConsoleRoleGate v-if="!banners.length" action="compose_banner">
            <Button @click="goNew">Create your first broadcast</Button>
          </PlatformConsoleRoleGate>
        </Empty>

        <ul v-else class="space-y-2">
          <li
            v-for="b in filtered"
            :key="b.id"
            data-testid="broadcast-row"
            class="group flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="tabOf(b) === 'ended' && 'opacity-80'"
            role="button"
            tabindex="0"
            @click="view(b)"
            @keydown.enter.self="view(b)"
          >
            <div class="flex size-9 shrink-0 items-center justify-center rounded-md" :class="tileClass(b)">
              <Icon :name="rowIcon(b)" class="size-4" />
            </div>

            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="truncate text-sm font-medium">{{ b.title }}</span>
                <Badge v-if="maintenancePhase(b)" variant="outline" class="text-[11px]">{{ MAINTENANCE_PHASE_LABEL[maintenancePhase(b)!] }}</Badge>
                <Badge v-else-if="b.resolvedAt" variant="outline" class="text-[11px]">Resolved</Badge>
              </div>
              <p class="line-clamp-1 text-sm text-muted-foreground">{{ b.body }}</p>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span class="inline-flex items-center gap-1"><Icon name="lucide:users" class="size-3.5" />{{ audience(b) }}</span>
                <span class="inline-flex items-center gap-1"><Icon name="lucide:clock" class="size-3.5" />{{ rowSchedule(b) }}</span>
                <span v-if="b.updates?.length" class="inline-flex items-center gap-1"><Icon name="lucide:message-square-text" class="size-3.5" />{{ b.updates.length }} {{ b.updates.length === 1 ? 'update' : 'updates' }}</span>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2" @click.stop>
              <PlatformConsoleRoleGate action="compose_banner">
                <Button v-if="canResolve(b)" variant="outline" size="sm" @click="openUpdate(b, 'resolve')">
                  <Icon name="lucide:circle-check" class="mr-1.5 size-3.5" />
                  Resolve
                </Button>
              </PlatformConsoleRoleGate>
              <Badge :variant="statusVariant(b.status)">
                <span v-if="b.status === 'live'" class="mr-1 size-1.5 animate-pulse rounded-full bg-primary-foreground" />
                {{ BANNER_STATUS_LABEL[b.status] }}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions for ${b.title}`">
                    <Icon name="lucide:more-horizontal" class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="view(b)">
                    <Icon name="lucide:eye" class="mr-2 size-4" />View
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="dup(b)">
                    <Icon name="lucide:copy" class="mr-2 size-4" />Duplicate
                  </DropdownMenuItem>
                  <PlatformConsoleRoleGate action="compose_banner">
                    <DropdownMenuItem v-if="b.status === 'live'" @click="openUpdate(b, 'update')">
                      <Icon name="lucide:message-square-plus" class="mr-2 size-4" />Post update
                    </DropdownMenuItem>
                    <DropdownMenuItem v-if="canResolve(b)" @click="openUpdate(b, 'resolve')">
                      <Icon name="lucide:circle-check" class="mr-2 size-4" />Mark resolved
                    </DropdownMenuItem>
                  </PlatformConsoleRoleGate>
                  <PlatformConsoleRoleGate action="retract_banner">
                    <DropdownMenuItem v-if="['live', 'scheduled'].includes(b.status)" class="text-destructive" @click="retract(b)">
                      <Icon name="lucide:ban" class="mr-2 size-4" />Retract
                    </DropdownMenuItem>
                  </PlatformConsoleRoleGate>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        </ul>
      </div>

      <div class="space-y-4 xl:col-span-1">
        <Card data-testid="maintenance-queue">
          <CardHeader class="pb-0">
            <CardTitle class="flex items-center gap-2 text-sm">
              <Icon name="lucide:wrench" class="size-4 text-muted-foreground" />
              Maintenance schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p v-if="!maintenanceQueue.length" class="text-sm text-muted-foreground">No maintenance planned. Tenants hear about it here first.</p>
            <ul v-else class="divide-y">
              <li v-for="b in maintenanceQueue" :key="b.id" class="space-y-1.5 py-3 first:pt-0 last:pb-0">
                <button type="button" class="text-left text-sm font-medium hover:underline" @click="view(b)">{{ b.title }}</button>
                <div class="text-xs text-muted-foreground">{{ rowSchedule(b) }}</div>
                <div v-if="windowCountdown(b)" class="text-xs font-medium">{{ windowCountdown(b) }}</div>
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="m in b.maintenance!.affected" :key="m" variant="secondary" class="text-[11px]">{{ m }}</Badge>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card data-testid="recent-activity">
          <CardHeader class="pb-0">
            <CardTitle class="flex items-center gap-2 text-sm">
              <Icon name="lucide:history" class="size-4 text-muted-foreground" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p v-if="!recentActivity.length" class="text-sm text-muted-foreground">Nothing yet.</p>
            <ul v-else class="space-y-3">
              <li v-for="a in recentActivity" :key="a.id" class="flex items-start gap-2">
                <Icon :name="a.icon" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div class="min-w-0">
                  <div class="text-sm">{{ a.text }}</div>
                  <div class="truncate text-xs text-muted-foreground">{{ a.title }}</div>
                  <div class="text-xs text-muted-foreground">{{ formatUtc(a.at) }}</div>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>

    <Sheet v-model:open="sheetOpen">
      <SheetContent v-if="selected" class="w-[520px] sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>{{ selected.title }}</SheetTitle>
        </SheetHeader>
        <div class="space-y-5 overflow-y-auto p-4 text-sm">
          <PlatformConsoleBannerCard :banner="selected" :max-updates="0" />

          <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2.5">
            <dt class="text-muted-foreground">Status</dt>
            <dd><Badge :variant="statusVariant(selected.status)">{{ BANNER_STATUS_LABEL[selected.status] }}</Badge></dd>
            <dt class="text-muted-foreground">Severity</dt>
            <dd>{{ SEVERITY_LABEL[selected.severity] }}</dd>
            <dt class="text-muted-foreground">Audience</dt>
            <dd>{{ audience(selected) }}</dd>
            <dt class="text-muted-foreground">Visible to roles</dt>
            <dd>{{ selected.visibleRoles.join(', ') }}</dd>
            <dt class="text-muted-foreground">Shows</dt>
            <dd>{{ formatUtc(selected.startAt) }}<template v-if="selected.endAt"><br>until {{ formatUtc(selected.endAt) }}</template></dd>
            <template v-if="selected.maintenance">
              <dt class="text-muted-foreground">Window</dt>
              <dd>{{ formatUtc(selected.maintenance.startAt) }}<br>to {{ formatUtc(selected.maintenance.endAt) }}</dd>
              <dt class="text-muted-foreground">Affected</dt>
              <dd class="flex flex-wrap gap-1">
                <Badge v-for="m in selected.maintenance.affected" :key="m" variant="secondary" class="text-[11px]">{{ m }}</Badge>
              </dd>
              <dt class="text-muted-foreground">Impact</dt>
              <dd>{{ MAINTENANCE_IMPACT_LABEL[selected.maintenance.impact] }}</dd>
            </template>
            <dt class="text-muted-foreground">Created</dt>
            <dd>{{ formatUtc(selected.createdAt) }}</dd>
            <template v-if="selected.retractionReason">
              <dt class="text-muted-foreground">Retracted</dt>
              <dd>{{ selected.retractionReason }}</dd>
            </template>
          </dl>

          <div v-if="selected.updates?.length" class="space-y-2 border-t pt-4">
            <div class="font-medium">Updates</div>
            <ul class="space-y-2">
              <li v-for="u in selected.updates" :key="u.id" class="flex gap-2">
                <Icon :name="u.kind === 'resolved' ? 'lucide:circle-check' : 'lucide:message-square-text'" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <div class="text-xs text-muted-foreground">{{ formatUtc(u.createdAt) }}</div>
                  <div>{{ u.message }}</div>
                </div>
              </li>
            </ul>
          </div>

          <div class="flex flex-wrap gap-2 border-t pt-4">
            <PlatformConsoleRoleGate action="compose_banner">
              <Button v-if="selected.status === 'live'" variant="outline" size="sm" @click="openUpdate(selected, 'update')">
                <Icon name="lucide:message-square-plus" class="mr-1.5 size-3.5" />Post update
              </Button>
              <Button v-if="canResolve(selected)" variant="outline" size="sm" @click="openUpdate(selected, 'resolve')">
                <Icon name="lucide:circle-check" class="mr-1.5 size-3.5" />Mark resolved
              </Button>
            </PlatformConsoleRoleGate>
            <Button variant="outline" size="sm" @click="dup(selected)">
              <Icon name="lucide:copy" class="mr-1.5 size-3.5" />Duplicate
            </Button>
            <PlatformConsoleRoleGate action="retract_banner">
              <Button v-if="['live', 'scheduled'].includes(selected.status)" variant="outline" size="sm" class="text-destructive" @click="retract(selected)">
                <Icon name="lucide:ban" class="mr-1.5 size-3.5" />Retract
              </Button>
            </PlatformConsoleRoleGate>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    <PlatformConsoleBannerUpdateDialog
      v-if="updateDialog"
      v-model:open="updateOpen"
      :mode="updateDialog.mode"
      :banner-title="updateDialog.title"
      @submit="submitUpdate"
    />

    <AlertDialog v-model:open="retractOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retract "{{ retractConfirm?.title }}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {{ retractConfirm?.wasLive
              ? 'The banner disappears from every tenant dashboard right away.'
              : 'This banner has not gone live yet, so no tenant will ever see it.' }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div class="px-6 pb-2">
          <Label class="text-xs">Reason (optional)</Label>
          <Input v-model="retractReason" placeholder="Why are you retracting this?" class="mt-1" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="doRetract">Retract</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
