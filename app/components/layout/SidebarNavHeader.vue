<script setup lang="ts">
import type { Tenant } from '~/components/platform-console/data/tenants'
import { cn } from '@/lib/utils'
import { TENANT_PLAN_LABEL, TENANT_STATUS_LABEL, TIER_LABEL } from '~/components/platform-console/data/tenants'
import { useSidebar } from '~/components/ui/sidebar'
import { useTenantBranding } from '~/composables/useTenantBranding'
import { useTenants } from '~/composables/useTenants'

const { isMobile } = useSidebar()
const { branding } = useTenantBranding()
const { tenants } = useTenants()

const activeTenantId = useState<string>('active-tenant-id', () => tenants.value[0]?.id ?? '')
const activeTenant = computed(() => tenants.value.find(t => t.id === activeTenantId.value) ?? tenants.value[0])

const search = ref('')
const filteredTenants = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return tenants.value
  return tenants.value.filter(t => t.name.toLowerCase().includes(q) || t.contactName.toLowerCase().includes(q))
})

function subscriptionLabel(tenant: Tenant): string {
  return `${TIER_LABEL[tenant.packageTier]} · ${TENANT_PLAN_LABEL[tenant.plan]}`
}

const open = ref(false)
watch(open, (value) => {
  if (!value)
    search.value = ''
})

function selectTenant(tenant: Tenant) {
  activeTenantId.value = tenant.id
  open.value = false
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <Popover v-model:open="open">
        <PopoverTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div
              :class="cn(
                'aspect-square size-8 flex items-center justify-center rounded-lg text-xs font-semibold',
                branding.primaryLogo
                  ? 'border bg-background p-1'
                  : 'bg-sidebar-primary text-sidebar-primary-foreground',
              )"
            >
              <img
                v-if="branding.primaryLogo"
                data-testid="sidebar-brand-logo"
                :src="branding.primaryLogo.dataUrl"
                alt="Tenant primary logo"
                class="max-h-full max-w-full object-contain"
              >
              <span v-else data-testid="sidebar-tenant-initials">{{ activeTenant?.logoText }}</span>
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">
                {{ activeTenant?.name }}
              </span>
              <span v-if="activeTenant" class="truncate text-xs">{{ subscriptionLabel(activeTenant) }}</span>
            </div>
            <Icon name="i-lucide-chevrons-up-down" class="ml-auto" />
          </SidebarMenuButton>
        </PopoverTrigger>
        <PopoverContent
          class="w-72 rounded-lg p-1"
          align="start"
          :side="isMobile ? 'bottom' : 'right'"
        >
          <p class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Tenants
          </p>
          <div class="px-1 pb-1">
            <div class="relative">
              <Icon name="lucide:search" class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="search"
                data-testid="tenant-search"
                placeholder="Search tenants"
                aria-label="Search tenants"
                class="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div class="max-h-72 overflow-y-auto">
            <button
              v-for="tenant in filteredTenants"
              :key="tenant.id"
              type="button"
              data-testid="tenant-option"
              class="flex w-full items-center gap-2 rounded-sm p-2 text-left outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
              @click="selectTenant(tenant)"
            >
              <div class="size-8 shrink-0 flex items-center justify-center border rounded-md bg-background text-xs font-semibold">
                {{ tenant.logoText }}
              </div>
              <div class="grid min-w-0 flex-1 leading-tight">
                <span class="truncate text-sm font-medium">{{ tenant.name }}</span>
                <span class="truncate text-xs text-muted-foreground">
                  {{ subscriptionLabel(tenant) }} · {{ tenant.activeUnits }} {{ tenant.activeUnits === 1 ? 'unit' : 'units' }}
                </span>
              </div>
              <Badge
                v-if="tenant.status !== 'active'"
                :variant="tenant.status === 'suspended' ? 'destructive' : 'secondary'"
                class="shrink-0 text-[10px]"
              >
                {{ TENANT_STATUS_LABEL[tenant.status] }}
              </Badge>
              <Icon v-else-if="tenant.id === activeTenant?.id" name="lucide:check" class="size-4 shrink-0" />
            </button>
            <p v-if="filteredTenants.length === 0" class="px-2 py-4 text-center text-sm text-muted-foreground">
              No tenants found
            </p>
          </div>
          <Separator class="my-1" />
          <NuxtLink
            to="/platform-console/tenants"
            class="flex items-center gap-2 rounded-sm p-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
            @click="open = false"
          >
            <div class="size-6 flex items-center justify-center border rounded-md bg-background">
              <Icon name="lucide:building-2" class="size-4" />
            </div>
            <div class="text-muted-foreground font-medium">
              All tenants
            </div>
          </NuxtLink>
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
