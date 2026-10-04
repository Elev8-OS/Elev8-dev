<script setup lang="ts">
import { Icon } from '#components'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { Progress } from '~/components/ui/progress'
import { Badge } from '~/components/ui/badge'
import { TIER_LABEL, REGION_LABEL, TENANT_PLAN_LABEL } from './data/tenants'
import type { Tenant } from './data/tenants'

const props = defineProps<{ tenants: Tenant[] }>()
const emit = defineEmits<{ rowClick: [tenantId: string] }>()

const search = ref('')
const planFilter = ref<'all' | 'per_booking' | 'per_property'>('all')
const statusFilter = ref<'all' | 'active' | 'suspended' | 'churned' | 'switching'>('all')
const hideInternal = ref(true)
const sortBy = ref<'mrr' | 'name' | 'login'>('mrr')

const tiers = Object.keys(TIER_LABEL) as Array<keyof typeof TIER_LABEL>
const regions = Object.keys(REGION_LABEL) as Array<keyof typeof REGION_LABEL>

const tierFilter = ref<string[]>([])
const regionFilter = ref<string[]>([])

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

const filtered = computed(() => {
  const result = props.tenants.filter((t) => {
    if (hideInternal.value && t.isInternal) return false
    if (planFilter.value !== 'all' && t.plan !== planFilter.value) return false
    if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
    if (tierFilter.value.length && !tierFilter.value.includes(t.packageTier)) return false
    if (regionFilter.value.length && !regionFilter.value.includes(t.region)) return false
    if (search.value) {
      const q = search.value.toLowerCase()
      if (!t.name.toLowerCase().includes(q)
        && !t.contactName.toLowerCase().includes(q)
        && !t.contactEmail.toLowerCase().includes(q)) return false
    }
    return true
  })

  if (sortBy.value === 'mrr') {
    result.sort((a, b) => (b.mrrUsd ?? 0) - (a.mrrUsd ?? 0))
  }
  else if (sortBy.value === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name))
  }
  else if (sortBy.value === 'login') {
    result.sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt))
  }

  return result
})

const internalCount = computed(() => props.tenants.filter(t => t.isInternal).length)

const formatRelative = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}
</script>

<template>
  <div class="space-y-4 p-6">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <Input v-model="search" placeholder="Search by name, contact…" class="w-72" />
      <div class="flex items-center rounded-md border bg-muted/30 p-0.5">
        <button v-for="p in ['all','per_booking','per_property']" :key="p"
          type="button"
          class="rounded-sm px-2.5 py-1 text-xs"
          :class="planFilter === p ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'"
          @click="planFilter = p as any">
          {{ p === 'all' ? 'All plans' : TENANT_PLAN_LABEL[p as keyof typeof TENANT_PLAN_LABEL] }}
        </button>
      </div>
      <div class="flex items-center rounded-md border bg-muted/30 p-0.5">
        <button v-for="s in ['all','active','suspended','churned','switching']" :key="s"
          type="button"
          class="rounded-sm px-2.5 py-1 text-xs capitalize"
          :class="statusFilter === s ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'"
          @click="statusFilter = s as any">
          {{ s }}
        </button>
      </div>
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" size="sm">
            <span>Tier{{ tierFilter.length ? ` (${tierFilter.length})` : '' }}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-48 p-2">
          <div v-for="t in tiers" :key="t"
            class="flex items-center gap-2 rounded-sm px-2 py-1.5 cursor-pointer hover:bg-muted"
            @click="toggleTier(t)">
            <div class="flex size-4 items-center justify-center rounded-[4px] border"
              :class="tierFilter.includes(t) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
              <Icon v-if="tierFilter.includes(t)" name="lucide:check" class="size-3" />
            </div>
            <span class="text-sm">{{ TIER_LABEL[t] }}</span>
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" size="sm">
            <span>Region{{ regionFilter.length ? ` (${regionFilter.length})` : '' }}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-48 p-2">
          <div v-for="r in regions" :key="r"
            class="flex items-center gap-2 rounded-sm px-2 py-1.5 cursor-pointer hover:bg-muted"
            @click="toggleRegion(r)">
            <div class="flex size-4 items-center justify-center rounded-[4px] border"
              :class="regionFilter.includes(r) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'">
              <Icon v-if="regionFilter.includes(r)" name="lucide:check" class="size-3" />
            </div>
            <span class="text-sm">{{ REGION_LABEL[r] }}</span>
          </div>
        </PopoverContent>
      </Popover>
      <select v-model="sortBy" class="rounded-md border bg-background px-2 py-1.5 text-sm">
        <option value="mrr">Sort: MRR ↓</option>
        <option value="name">Sort: Name A→Z</option>
        <option value="login">Sort: Last login ↓</option>
      </select>
      <Button variant="ghost" size="sm" @click="clearFilters" v-if="search || tierFilter.length || regionFilter.length || planFilter !== 'all' || statusFilter !== 'all'">
        Clear
      </Button>
      <div class="flex items-center gap-2 ml-2">
        <Switch :model-value="hideInternal" @update:model-value="(v) => hideInternal = v" />
        <span class="text-xs text-muted-foreground">Hide internal</span>
      </div>
    </div>

    <!-- Table -->
    <ClientOnly>
      <div class="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>MRR / Quota</TableHead>
              <TableHead class="text-right">Units</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="t in filtered"
              :key="t.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="emit('rowClick', t.id)"
            >
              <TableCell>
                <div class="flex items-center gap-2">
                  <div class="flex size-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-foreground">
                    {{ t.logoText }}
                  </div>
                  <div>
                    <div class="flex items-center gap-1">
                      <span class="text-sm font-medium">{{ t.name }}</span>
                      <Badge v-if="t.isInternal" variant="outline" class="text-xs">Internal</Badge>
                    </div>
                    <div class="text-xs text-muted-foreground">{{ t.contactEmail }}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <PlatformConsoleTenantPlanBadge :plan="t.plan" :tier="t.packageTier" :has-channel-manager="t.hasChannelManager" />
              </TableCell>
              <TableCell>
                <span v-if="t.isInternal" class="text-muted-foreground">—</span>
                <span v-else-if="t.plan === 'per_property'" class="text-sm font-medium">${{ t.mrrUsd }}/mo</span>
                <div v-else class="space-y-1 w-32">
                  <div class="text-xs text-muted-foreground">{{ t.quotaRemaining }} / {{ t.quotaTotal }}</div>
                  <Progress :model-value="((t.quotaRemaining ?? 0) / (t.quotaTotal ?? 1)) * 100" />
                </div>
              </TableCell>
              <TableCell class="text-right text-sm">{{ t.activeUnits }}</TableCell>
              <TableCell>
                <PlatformConsoleTenantStatusBadge :status="t.status" :switching-to-plan="t.switchingToPlan" />
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ formatRelative(t.lastLoginAt) }}</TableCell>
              <TableCell>
                <div v-if="!t.activeOverridesCount && !t.liveBannersCount" class="text-xs text-muted-foreground">—</div>
                <div v-else class="flex items-center gap-1">
                  <Badge v-if="t.activeOverridesCount > 0" variant="outline" class="text-xs">{{ t.activeOverridesCount }} override</Badge>
                  <Badge v-if="t.liveBannersCount > 0" variant="outline" class="text-xs">{{ t.liveBannersCount }} banner</Badge>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="!filtered.length">
              <TableCell :colspan="7" class="text-center text-sm text-muted-foreground py-8">
                No tenants match your filters
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <template #fallback>
        <div class="h-96 rounded-md border bg-muted/20 animate-pulse" />
      </template>
    </ClientOnly>

    <p v-if="hideInternal && internalCount > 0" class="text-xs text-muted-foreground">
      {{ internalCount }} internal {{ internalCount === 1 ? 'tenant' : 'tenants' }} hidden from rollups
    </p>
  </div>
</template>