<!-- app/pages/owners/index.vue -->
<!--
  Tenant-side Owner directory — KPI strip, filter bar, table, and detail sheet.
-->
<script setup lang="ts">
import type { Owner } from '~/components/owners/data/owners'
import OwnerDetailSheet from '~/components/owners/OwnerDetailSheet.vue'
import OwnerFilters from '~/components/owners/OwnerFilters.vue'
import OwnerMaintenancePanel from '~/components/owners/OwnerMaintenancePanel.vue'
import OwnerOnboardingDialog from '~/components/owners/OwnerOnboardingDialog.vue'
import OwnersKpis from '~/components/owners/OwnersKpis.vue'
import OwnersTable from '~/components/owners/OwnersTable.vue'
import OwnerStayApprovalsPanel from '~/components/owners/OwnerStayApprovalsPanel.vue'
import { Button } from '~/components/ui/button'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

definePageMeta({
  layout: 'default',
})

const onboardingOpen = ref(false)
const detailOpen = ref(false)
const selectedOwnerId = ref<string | undefined>(undefined)
const activeTab = ref<'owners' | 'stay-requests' | 'maintenance'>('owners')

function onSelectOwner(owner: Owner) {
  selectedOwnerId.value = owner.id
  detailOpen.value = true
}

function onCreated(ownerId: string) {
  selectedOwnerId.value = ownerId
  detailOpen.value = true
}
</script>

<template>
  <ClientOnly>
    <div class="space-y-6 p-6">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-2xl font-bold tracking-tight">
            Owners
          </h1>
          <p class="text-sm text-muted-foreground">
            Manage property owners, ownership shares, commission rules, and portal permissions.
          </p>
        </div>
        <Button @click="onboardingOpen = true">
          <Icon name="lucide:plus" class="mr-2 size-4" />
          Add owner
        </Button>
      </div>

      <Tabs v-model="activeTab" default-value="owners">
        <TabsList>
          <TabsTrigger value="owners">
            Owners
          </TabsTrigger>
          <TabsTrigger value="stay-requests">
            Stay Requests
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            Maintenance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owners" class="space-y-3">
          <OwnersKpis />

          <div class="space-y-3">
            <OwnerFilters />
            <OwnersTable @select-owner="onSelectOwner" />
          </div>
        </TabsContent>

        <TabsContent value="stay-requests">
          <OwnerStayApprovalsPanel />
        </TabsContent>

        <TabsContent value="maintenance">
          <OwnerMaintenancePanel />
        </TabsContent>
      </Tabs>
    </div>

    <OwnerOnboardingDialog
      v-model="onboardingOpen"
      @created="onCreated"
    />
    <OwnerDetailSheet
      v-model:open="detailOpen"
      :owner-id="selectedOwnerId"
    />

    <template #fallback>
      <div class="space-y-6 p-6">
        <Skeleton class="h-9 w-48" />
        <Skeleton class="h-4 w-72" />
        <Skeleton class="h-24 w-full" />
        <Skeleton class="h-64 w-full" />
      </div>
    </template>
  </ClientOnly>
</template>
