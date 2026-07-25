<!-- app/components/owners/OwnerFilters.vue -->
<!--
  Filter bar for the owner directory — search, status, property picker.
  Backed by `useOwners` so the filters live in shared state and
  `filteredOwners` reactively updates the table.
-->
<script setup lang="ts">
import type { OwnerStatus } from '~/components/owners/data/owners'
import { listings } from '~/components/listings/data/listings'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { useOwners } from '~/composables/useOwners'

const { search, statusFilter, propertyFilter } = useOwners()

const propertyOptions = computed(() =>
  listings.value.map(l => ({ id: l.id, name: l.name })),
)

const statusOptions: { value: OwnerStatus | 'all', label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'draft', label: 'Draft' },
  { value: 'inactive', label: 'Inactive' },
]

const hasFilters = computed(() =>
  search.value.trim() !== ''
  || statusFilter.value !== 'all'
  || propertyFilter.value !== 'all',
)

function clearFilters() {
  search.value = ''
  statusFilter.value = 'all'
  propertyFilter.value = 'all'
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="owner-filters">
    <div class="relative min-w-48 max-w-sm flex-1">
      <Icon name="lucide:search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="search"
        placeholder="Search by name or email..."
        class="pl-8"
        aria-label="Search owners"
      />
    </div>

    <Select v-model="statusFilter">
      <SelectTrigger class="w-40" aria-label="Filter by status">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <Select v-model="propertyFilter">
      <SelectTrigger class="w-56" aria-label="Filter by property">
        <SelectValue placeholder="Property" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          All properties
        </SelectItem>
        <SelectItem v-for="opt in propertyOptions" :key="opt.id" :value="opt.id">
          {{ opt.name }}
        </SelectItem>
      </SelectContent>
    </Select>

    <Button v-if="hasFilters" variant="ghost" size="sm" @click="clearFilters">
      <Icon name="lucide:x" class="mr-1 size-3.5" />
      Clear
    </Button>
  </div>
</template>
