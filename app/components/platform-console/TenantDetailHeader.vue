<script setup lang="ts">
import { Icon } from '#components'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import type { Tenant } from './data/tenants'
import { TENANT_PLAN_LABEL } from './data/tenants'

defineProps<{ tenant: Tenant }>()
const formatRelative = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  return `${days} days ago`
}
</script>

<template>
  <div class="border-b bg-card px-6 py-5">
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-start gap-4">
        <div class="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-foreground">
          {{ tenant.logoText }}
        </div>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-semibold">{{ tenant.name }}</h2>
            <Badge v-if="tenant.isInternal" variant="outline">Internal</Badge>
          </div>
          <div class="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{{ TENANT_PLAN_LABEL[tenant.plan] }} · {{ tenant.packageTier }}</span>
            <span>·</span>
            <span>{{ tenant.activeUnits }} units</span>
            <span>·</span>
            <span>Last login {{ formatRelative(tenant.lastLoginAt) }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="lucide:user" class="size-3" />
            <span>{{ tenant.contactName }}</span>
            <span>·</span>
            <span>{{ tenant.contactEmail }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <PlatformConsoleTenantStatusBadge :status="tenant.status" :switching-to-plan="tenant.switchingToPlan" />
        <Button variant="outline" size="sm" disabled>
          <Icon name="lucide:external-link" class="mr-1.5 size-3.5" />
          View in tenant dashboard
        </Button>
      </div>
    </div>
  </div>
</template>