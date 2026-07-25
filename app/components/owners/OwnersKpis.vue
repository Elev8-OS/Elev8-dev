<!-- app/components/owners/OwnersKpis.vue -->
<!--
  KPI strip for the owner directory — Total, Active, Invited, Properties Assigned.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent } from '~/components/ui/card'
import { useOwners } from '~/composables/useOwners'

const { owners, mappings } = useOwners()

const totalCount = computed(() => owners.value.length)

const activeCount = computed(
  () => owners.value.filter(o => o.status === 'active').length,
)

const invitedCount = computed(
  () => owners.value.filter(o => o.status === 'invited').length,
)

const propertiesAssigned = computed(() => {
  const ids = new Set<string>()
  for (const m of mappings.value) ids.add(m.listingId)
  return ids.size
})
</script>

<template>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="owners-kpis">
    <Card>
      <CardContent class="p-4">
        <div class="text-xs uppercase tracking-wide text-muted-foreground">
          Total owners
        </div>
        <div class="mt-1 text-2xl font-bold">
          {{ totalCount }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs uppercase tracking-wide text-muted-foreground">
          Active
        </div>
        <div class="mt-1 text-2xl font-bold text-green-600">
          {{ activeCount }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs uppercase tracking-wide text-muted-foreground">
          Invited
        </div>
        <div class="mt-1 text-2xl font-bold text-amber-600">
          {{ invitedCount }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs uppercase tracking-wide text-muted-foreground">
          Properties assigned
        </div>
        <div class="mt-1 text-2xl font-bold">
          {{ propertiesAssigned }}
        </div>
      </CardContent>
    </Card>
  </div>
</template>
