<script setup lang="ts">
import { Icon } from '#components'
import { cn } from '@/lib/utils'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { REGION_LABEL, TENANT_PLAN_LABEL, TIER_LABEL } from './data/tenants'
import type { Tenant } from './data/tenants'
import { formatMoney, HEALTH_BADGE_CLASS, HEALTH_LABEL } from './data/tenant-billing'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { useTenantBilling } from '~/composables/useTenantBilling'

const props = defineProps<{ tenants: Tenant[] }>()

const { byTenant } = useTenantBilling()
const { can } = useStaffAuth()

const search = ref('')
const planFilter = ref<'all' | 'per_booking' | 'per_property'>('all')
const statusFilter = ref<'all' | 'active' | 'suspended' | 'churned' | 'switching' | 'dunning' | 'no_card'>('all')
const hideInternal = ref(true)
const sortBy = ref<'mrr' | 'name' | 'login'>('mrr')
const tierFilter = ref<string[]>([])
const regionFilter = ref<string[]>([])
const selectedId = ref('')

const tiers = Object.keys(TIER_LABEL) as Array<keyof typeof TIER_LABEL>
const regions = Object.keys(REGION_LABEL) as Array<keyof typeof REGION_LABEL>

function toggleTier(t: string) {
  tierFilter.value = tierFilter.value.includes(t) ? tierFilter.value.filter(x => x !== t) : [...tierFilter.value, t]
}
function toggleRegion(r: string) {
  regionFilter.value = regionFilter.value.includes(r) ? regionFilter.value.filter(x => x !== r) : [...regionFilter.value, r]
}
function clearFilters() {
  search.value = ''
  planFilter.value = 'all'
  statusFilter.value = 'all'
  tierFilter.value = []
  regionFilter.value = []
}
const hasFilters = computed(() => !!search.value || tierFilter.value.length > 0 || regionFilter.value.length > 0 || planFilter.value !== 'all' || statusFilter.value !== 'all')

// Internal tenants are left out of every rollup while they are hidden.
const scope = computed(() => props.tenants.filter(t => !(hideInternal.value && t.isInternal)))
const internalCount = computed(() => props.tenants.filter(t => t.isInternal).length)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const result = scope.value.filter((t) => {
    if (planFilter.value !== 'all' && t.plan !== planFilter.value) return false
    if (statusFilter.value === 'dunning') {
      if (byTenant(t).health !== 'dunning') return false
    }
    else if (statusFilter.value === 'no_card') {
      if (byTenant(t).hasPaymentMethod || t.status === 'churned') return false
    }
    else if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
    if (tierFilter.value.length && !tierFilter.value.includes(t.packageTier)) return false
    if (regionFilter.value.length && !regionFilter.value.includes(t.region)) return false
    if (q && !t.name.toLowerCase().includes(q) && !t.contactName.toLowerCase().includes(q) && !t.contactEmail.toLowerCase().includes(q)) return false
    return true
  })
  if (sortBy.value === 'mrr') result.sort((a, b) => (b.mrrUsd ?? 0) - (a.mrrUsd ?? 0))
  else if (sortBy.value === 'name') result.sort((a, b) => a.name.localeCompare(b.name))
  else result.sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt))
  return result
})

// Keep a valid selection: the first match when the current one is filtered out.
watch(filtered, (rows) => {
  if (!rows.some(t => t.id === selectedId.value)) selectedId.value = rows[0]?.id ?? ''
}, { immediate: true })

const selected = computed(() => props.tenants.find(t => t.id === selectedId.value) ?? null)

const stats = computed(() => {
  const live = scope.value.filter(t => t.status === 'active')
  const perProperty = live.filter(t => t.plan === 'per_property').length
  const dunning = scope.value.filter(t => byTenant(t).health === 'dunning')
  const noCard = scope.value.filter(t => (t.status === 'active' || t.status === 'switching') && !byTenant(t).hasPaymentMethod)
  return [
    { key: 'active', label: 'Active tenants', value: String(live.length), hint: `${perProperty} per property · ${live.length - perProperty} per booking`, icon: 'lucide:building-2', tone: '' },
    { key: 'mrr', label: 'MRR', value: formatMoney(live.reduce((n, t) => n + (t.mrrUsd ?? 0), 0)), hint: 'Recurring, excludes suspended', icon: 'lucide:banknote', tone: '' },
    { key: 'dunning', label: 'In dunning', value: String(dunning.length), hint: `${formatMoney(dunning.reduce((n, t) => n + (t.mrrUsd ?? 0), 0))} MRR at risk`, icon: 'lucide:triangle-alert', tone: 'text-warning-foreground' },
    { key: 'suspended', label: 'Suspended', value: String(scope.value.filter(t => t.status === 'suspended').length), hint: 'Listings deactivated', icon: 'lucide:ban', tone: 'text-destructive' },
    { key: 'nocard', label: 'No payment method', value: String(noCard.length), hint: 'Active, no card on file', icon: 'lucide:credit-card', tone: 'text-destructive' },
    { key: 'units', label: 'Active units', value: String(live.reduce((n, t) => n + t.activeUnits, 0)), hint: 'Across active tenants', icon: 'lucide:door-open', tone: '' },
  ]
})

const formatRelative = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function rowMeta(t: Tenant) {
  const units = t.plan === 'per_booking' ? 'Per-booking credits' : `${t.activeUnits} units`
  return `${REGION_LABEL[t.region]} · ${units}`
}

function rowAmount(t: Tenant) {
  if (t.isInternal) return '-'
  if (t.plan === 'per_property') return `${formatMoney(t.mrrUsd ?? 0)}/mo`
  return t.quotaTotal ? `${t.quotaRemaining} / ${t.quotaTotal} left` : '-'
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" data-testid="tenant-stats">
      <Card v-for="s in stats" :key="s.key" class="py-0">
        <CardContent class="p-4">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon :name="s.icon" class="size-3.5 shrink-0" />
            <span class="truncate">{{ s.label }}</span>
          </div>
          <div :class="cn('mt-1.5 text-2xl font-semibold leading-tight tabular-nums', s.tone)">{{ s.value }}</div>
          <div class="mt-1 truncate text-xs text-muted-foreground">{{ s.hint }}</div>
        </CardContent>
      </Card>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <BaseSearchInput v-model="search" placeholder="Search tenant, contact, email..." class="w-72" />
      <Select v-model="planFilter">
        <SelectTrigger class="h-9 w-36" aria-label="Filter by plan"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All plans</SelectItem>
          <SelectItem value="per_property">{{ TENANT_PLAN_LABEL.per_property }}</SelectItem>
          <SelectItem value="per_booking">{{ TENANT_PLAN_LABEL.per_booking }}</SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="statusFilter">
        <SelectTrigger class="h-9 w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="switching">Switching</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
          <SelectItem value="churned">Churned</SelectItem>
          <SelectItem value="dunning">In dunning</SelectItem>
          <SelectItem value="no_card">No payment method</SelectItem>
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" class="h-9">Tier{{ tierFilter.length ? ` (${tierFilter.length})` : '' }}</Button>
        </PopoverTrigger>
        <PopoverContent class="w-48 p-2">
          <div v-for="t in tiers" :key="t" class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted" @click="toggleTier(t)">
            <div class="flex size-4 items-center justify-center rounded-[4px] border" :class="tierFilter.includes(t) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
              <Icon v-if="tierFilter.includes(t)" name="lucide:check" class="size-3" />
            </div>
            <span class="text-sm">{{ TIER_LABEL[t] }}</span>
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" class="h-9">Region{{ regionFilter.length ? ` (${regionFilter.length})` : '' }}</Button>
        </PopoverTrigger>
        <PopoverContent class="w-48 p-2">
          <div v-for="r in regions" :key="r" class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted" @click="toggleRegion(r)">
            <div class="flex size-4 items-center justify-center rounded-[4px] border" :class="regionFilter.includes(r) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
              <Icon v-if="regionFilter.includes(r)" name="lucide:check" class="size-3" />
            </div>
            <span class="text-sm">{{ REGION_LABEL[r] }}</span>
          </div>
        </PopoverContent>
      </Popover>
      <Select v-model="sortBy">
        <SelectTrigger class="h-9 w-44" aria-label="Sort tenants"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="mrr">Sort: MRR high to low</SelectItem>
          <SelectItem value="name">Sort: Name A to Z</SelectItem>
          <SelectItem value="login">Sort: Last login</SelectItem>
        </SelectContent>
      </Select>
      <Button v-if="hasFilters" variant="ghost" class="h-9" @click="clearFilters">Clear</Button>
      <div class="ml-auto flex items-center gap-2">
        <Switch :model-value="hideInternal" aria-label="Hide internal tenants" @update:model-value="(v: boolean) => (hideInternal = v)" />
        <span class="text-xs text-muted-foreground">Hide internal</span>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-6">
      <!-- Tenant list -->
      <Card class="gap-0 overflow-hidden py-0 xl:col-span-2">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div class="text-sm font-bold">Tenants</div>
          <div class="text-xs text-muted-foreground tabular-nums">{{ filtered.length }} / {{ scope.length }}</div>
        </div>
        <div v-if="!filtered.length" class="py-12 text-center text-sm text-muted-foreground" data-testid="tenant-empty">
          No tenants match these filters.
        </div>
        <div v-else class="max-h-[640px] overflow-auto">
          <button
            v-for="t in filtered"
            :key="t.id"
            type="button"
            :aria-current="t.id === selectedId ? 'true' : undefined"
            :data-testid="`tenant-row-${t.id}`"
            :class="cn(
              'flex w-full items-center justify-between gap-3 border-b border-l-2 px-4 py-3 text-left hover:bg-muted/50',
              t.id === selectedId ? 'border-l-primary bg-muted/50' : 'border-l-transparent',
            )"
            @click="selectedId = t.id"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold">{{ t.logoText }}</div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="truncate font-semibold">{{ t.name }}</span>
                  <Badge v-if="t.isInternal" variant="outline" class="shrink-0 text-[10px]">Internal</Badge>
                  <Badge v-if="!byTenant(t).hasPaymentMethod && t.status !== 'churned'" class="shrink-0 gap-1 border-transparent bg-destructive/10 text-[10px] text-destructive">
                    <Icon name="lucide:credit-card" class="size-3" />No card
                  </Badge>
                </div>
                <div class="mt-0.5 truncate text-xs text-muted-foreground">{{ rowMeta(t) }}</div>
              </div>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1">
              <div class="flex items-center gap-1">
                <PlatformConsoleTenantStatusBadge v-if="t.status !== 'active'" :status="t.status" :switching-to-plan="undefined" />
                <Badge :class="cn('text-[11px]', HEALTH_BADGE_CLASS[byTenant(t).health])">{{ HEALTH_LABEL[byTenant(t).health] }}</Badge>
              </div>
              <span class="font-mono text-xs font-bold tabular-nums">{{ rowAmount(t) }}</span>
            </div>
          </button>
        </div>
      </Card>

      <!-- Detail -->
      <Card class="gap-0 overflow-hidden py-0 xl:col-span-4">
        <div v-if="!selected" class="py-16 text-center text-sm text-muted-foreground">Select a tenant to see their billing.</div>
        <template v-else>
          <div class="flex flex-wrap items-start justify-between gap-3 border-b p-5">
            <div class="flex min-w-0 items-start gap-3">
              <div class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base font-semibold">{{ selected.logoText }}</div>
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="truncate text-lg font-bold">{{ selected.name }}</h3>
                  <Badge v-if="selected.isInternal" variant="outline">Internal</Badge>
                  <PlatformConsoleTenantStatusBadge :status="selected.status" :switching-to-plan="selected.switchingToPlan" />
                </div>
                <div class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <Icon name="lucide:user" class="size-3" />
                  <span>{{ selected.contactName }}</span>
                  <span>·</span>
                  <span class="font-mono">{{ selected.contactEmail }}</span>
                  <span>·</span>
                  <span>Last login {{ formatRelative(selected.lastLoginAt) }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-1.5 pt-1">
                  <PlatformConsoleTenantPlanBadge :plan="selected.plan" :tier="selected.packageTier" :has-channel-manager="selected.hasChannelManager" />
                  <Badge v-if="selected.activeOverridesCount > 0" variant="outline" class="text-xs">{{ selected.activeOverridesCount }} pricing override</Badge>
                  <Badge v-if="selected.liveBannersCount > 0" variant="outline" class="text-xs">{{ selected.liveBannersCount }} live banner</Badge>
                </div>
              </div>
            </div>
            <Button as-child variant="outline" size="sm">
              <NuxtLink :to="`/platform-console/tenants/${selected.id}`">
                Open tenant
                <Icon name="lucide:arrow-right" class="ml-1.5 size-3.5" />
              </NuxtLink>
            </Button>
          </div>

          <div class="p-5">
            <PlatformConsoleTenantBillingTab v-if="can('view_billing')" :key="selected.id" :tenant="selected" />
            <p v-else class="py-8 text-center text-sm text-muted-foreground" data-testid="tenant-billing-hidden">
              Billing is visible to Platform Finance and above. Open the tenant for users and activity.
            </p>
          </div>
        </template>
      </Card>
    </div>

    <p v-if="hideInternal && internalCount > 0" class="text-xs text-muted-foreground">
      {{ internalCount }} internal {{ internalCount === 1 ? 'tenant' : 'tenants' }} hidden from rollups
    </p>
  </div>
</template>
