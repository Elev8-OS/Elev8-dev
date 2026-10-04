<script setup lang="ts">
import { Icon } from '#components'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { Badge } from '~/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command'
import type { BannerTargetFilter, TargetScope } from './data/banners'
import { TENANT_PLAN_LABEL, TIER_LABEL, REGION_LABEL } from './data/tenants'
import type { TenantPlan, PackageTier, Region } from './data/tenants'
import { ALL_STAFF_ROLES } from './data/staff'
import type { StaffRoleName } from './data/staff'
import { useTenants } from '~/composables/useTenants'

const props = defineProps<{ modelValue: BannerTargetFilter; visibleRoles: StaffRoleName[] }>()
const emit = defineEmits<{ 'update:modelValue': [BannerTargetFilter]; 'update:visibleRoles': [StaffRoleName[]] }>()

const { tenants } = useTenants()

const activeTab = ref<TargetScope>(props.modelValue.scope)
const excludeInternal = ref(true)

const segmentPlans = ref<TenantPlan[]>(
  props.modelValue.scope === 'segment' ? (props.modelValue.planTypes ?? []) : []
)
const segmentTiers = ref<PackageTier[]>(
  props.modelValue.scope === 'segment' ? (props.modelValue.tiers ?? []) : []
)
const segmentRegions = ref<Region[]>(
  props.modelValue.scope === 'segment' ? (props.modelValue.regions ?? []) : []
)
const segmentCM = ref<boolean | undefined>(
  props.modelValue.scope === 'segment' ? props.modelValue.hasChannelManager : undefined
)

const visibleRolesLocal = ref<StaffRoleName[]>(props.visibleRoles)
const selectedTenants = ref<string[]>(
  props.modelValue.scope === 'individual' ? props.modelValue.tenantIds : []
)

const tenantSearch = ref('')

function emitTargetFilter() {
  if (activeTab.value === 'all') {
    emit('update:modelValue', { scope: 'all' })
  }
  else if (activeTab.value === 'segment') {
    emit('update:modelValue', {
      scope: 'segment',
      planTypes: segmentPlans.value.length ? segmentPlans.value : undefined,
      tiers: segmentTiers.value.length ? segmentTiers.value : undefined,
      regions: segmentRegions.value.length ? segmentRegions.value : undefined,
      hasChannelManager: segmentCM.value,
    })
  }
  else {
    emit('update:modelValue', { scope: 'individual', tenantIds: selectedTenants.value })
  }
  emit('update:visibleRoles', visibleRolesLocal.value)
}

const candidateTenants = computed(() => {
  if (excludeInternal.value) return tenants.value.filter(t => !t.isInternal)
  return tenants.value
})

const matchedTenants = computed(() => {
  const tab = activeTab.value
  if (tab === 'individual') return candidateTenants.value.filter(t => selectedTenants.value.includes(t.id))
  if (tab === 'all') return candidateTenants.value
  return candidateTenants.value.filter((t) => {
    if (segmentPlans.value.length && !segmentPlans.value.includes(t.plan)) return false
    if (segmentTiers.value.length && !segmentTiers.value.includes(t.packageTier)) return false
    if (segmentRegions.value.length && !segmentRegions.value.includes(t.region)) return false
    if (segmentCM.value !== undefined && t.hasChannelManager !== segmentCM.value) return false
    return true
  })
})

const matchedCount = computed(() => matchedTenants.value.length)

function togglePlan(p: TenantPlan) {
  segmentPlans.value = segmentPlans.value.includes(p) ? segmentPlans.value.filter(x => x !== p) : [...segmentPlans.value, p]
  emitTargetFilter()
}
function toggleTier(t: PackageTier) {
  segmentTiers.value = segmentTiers.value.includes(t) ? segmentTiers.value.filter(x => x !== t) : [...segmentTiers.value, t]
  emitTargetFilter()
}
function toggleRegion(r: Region) {
  segmentRegions.value = segmentRegions.value.includes(r) ? segmentRegions.value.filter(x => x !== r) : [...segmentRegions.value, r]
  emitTargetFilter()
}
function toggleTenant(id: string) {
  selectedTenants.value = selectedTenants.value.includes(id) ? selectedTenants.value.filter(x => x !== id) : [...selectedTenants.value, id]
  emitTargetFilter()
}
function toggleRole(r: StaffRoleName) {
  visibleRolesLocal.value = visibleRolesLocal.value.includes(r) ? visibleRolesLocal.value.filter(x => x !== r) : [...visibleRolesLocal.value, r]
  emitTargetFilter()
}

function switchTab(tab: TargetScope) {
  activeTab.value = tab
  emitTargetFilter()
}

const tenantOptions = computed(() => candidateTenants.value.filter(t =>
  !tenantSearch.value || t.name.toLowerCase().includes(tenantSearch.value.toLowerCase()),
))
</script>

<template>
  <div class="space-y-4">
    <Tabs :model-value="activeTab" @update:model-value="(v) => switchTab(v as TargetScope)">
      <TabsList>
        <TabsTrigger value="all">All tenants</TabsTrigger>
        <TabsTrigger value="segment">Segment</TabsTrigger>
        <TabsTrigger value="individual">Specific tenant(s)</TabsTrigger>
      </TabsList>
      <TabsContent value="all" class="space-y-3 mt-4">
        <div class="rounded-md border bg-muted/30 p-4 text-sm">
          <p class="font-medium">This banner will be delivered to all tenants matching the role filter.</p>
          <p class="mt-1 text-muted-foreground">{{ matchedCount }} tenants currently match.</p>
        </div>
      </TabsContent>
      <TabsContent value="segment" class="space-y-3 mt-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1.5 block text-sm font-medium">Plan types</label>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="p in (['per_booking','per_property'] as TenantPlan[])" :key="p"
                type="button"
                class="rounded-md border px-2 py-1 text-xs"
                :class="segmentPlans.includes(p) ? 'border-primary bg-primary/10 text-foreground' : 'hover:bg-muted'"
                @click="togglePlan(p)">
                {{ TENANT_PLAN_LABEL[p] }}
              </button>
            </div>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">Tiers</label>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="t in (Object.keys(TIER_LABEL) as PackageTier[])" :key="t"
                type="button"
                class="rounded-md border px-2 py-1 text-xs"
                :class="segmentTiers.includes(t) ? 'border-primary bg-primary/10 text-foreground' : 'hover:bg-muted'"
                @click="toggleTier(t)">
                {{ TIER_LABEL[t] }}
              </button>
            </div>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">Regions</label>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="r in (Object.keys(REGION_LABEL) as Region[])" :key="r"
                type="button"
                class="rounded-md border px-2 py-1 text-xs"
                :class="segmentRegions.includes(r) ? 'border-primary bg-primary/10 text-foreground' : 'hover:bg-muted'"
                @click="toggleRegion(r)">
                {{ REGION_LABEL[r] }}
              </button>
            </div>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium">Channel Manager</label>
            <div class="flex items-center gap-2">
              <Switch :model-value="segmentCM === true" @update:model-value="(v) => { segmentCM = v ? true : undefined; emitTargetFilter() }" />
              <span class="text-sm">With Channel Manager only</span>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="individual" class="space-y-3 mt-4">
        <div v-if="selectedTenants.length" class="flex flex-wrap gap-1.5">
          <Badge v-for="id in selectedTenants" :key="id" variant="secondary" class="gap-1">
            {{ tenants.find(t => t.id === id)?.name }}
            <button type="button" @click="toggleTenant(id)">
              <Icon name="lucide:x" class="size-3" />
            </button>
          </Badge>
        </div>
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm">
              <Icon name="lucide:plus" class="mr-1.5 size-3.5" />
              Add tenants
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-80 p-0" align="start">
            <Command>
              <CommandInput v-model="tenantSearch" placeholder="Search tenants…" />
              <CommandList>
                <CommandEmpty>No tenants found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem v-for="t in tenantOptions" :key="t.id" :value="t.id" @select="toggleTenant(t.id)">
                    <Icon v-if="selectedTenants.includes(t.id)" name="lucide:check" class="size-4 text-primary" />
                    <div class="flex-1">{{ t.name }}</div>
                    <Badge variant="outline" class="text-xs">{{ TENANT_PLAN_LABEL[t.plan] }}</Badge>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TabsContent>
    </Tabs>

    <div class="rounded-md border bg-muted/30 p-3 flex items-center justify-between">
      <div class="text-sm">
        <strong>{{ matchedCount }}</strong> tenants match
        <span class="text-muted-foreground"> · {{ visibleRolesLocal.length }} roles selected</span>
      </div>
      <div class="flex items-center gap-2">
        <Switch :model-value="excludeInternal" @update:model-value="(v) => { excludeInternal = v; emitTargetFilter() }" />
        <span class="text-xs text-muted-foreground">Exclude internal tenants</span>
      </div>
    </div>

    <div>
      <label class="mb-1.5 block text-sm font-medium">Visible to roles</label>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="r in ALL_STAFF_ROLES" :key="r"
          type="button"
          class="rounded-md border px-2 py-1 text-xs"
          :class="visibleRolesLocal.includes(r) ? 'border-primary bg-primary/10 text-foreground' : 'hover:bg-muted'"
          @click="toggleRole(r)">
          {{ r }}
        </button>
      </div>
    </div>
  </div>
</template>