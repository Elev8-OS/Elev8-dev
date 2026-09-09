<script setup lang="ts">
import { BALI_LISTINGS, UPSPELL_CATEGORIES } from '@/components/upsells/data/upsell-services'
import { useUpsellServices } from '@/composables/useUpsellServices'

const { filterCategory, filterStatus, filterListing, filterLockAccess, clearFilters } = useUpsellServices()
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <div class="flex flex-col gap-1">
      <label class="text-xs text-muted-foreground">Category</label>
      <Select v-model="filterCategory">
        <SelectTrigger class="h-8 w-44 text-sm">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All categories
          </SelectItem>
          <SelectItem v-for="cat in UPSPELL_CATEGORIES" :key="cat" :value="cat">
            {{ cat }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-xs text-muted-foreground">Status</label>
      <Select v-model="filterStatus">
        <SelectTrigger class="h-8 w-36 text-sm">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All
          </SelectItem>
          <SelectItem value="active">
            Active
          </SelectItem>
          <SelectItem value="inactive">
            Inactive
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-xs text-muted-foreground">Listing</label>
      <Select v-model="filterListing">
        <SelectTrigger class="h-8 w-56 text-sm">
          <SelectValue placeholder="All listings" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All listings
          </SelectItem>
          <SelectItem v-for="listing in BALI_LISTINGS" :key="listing" :value="listing">
            {{ listing }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-xs text-muted-foreground">Lock access</label>
      <Select v-model="filterLockAccess">
        <SelectTrigger class="h-8 w-44 text-sm">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All
          </SelectItem>
          <SelectItem value="lock">
            Grants lock access
          </SelectItem>
          <SelectItem value="no_lock">
            No lock access
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Button variant="ghost" size="sm" class="h-8 self-end" @click="clearFilters">
      Clear filters
    </Button>
  </div>
</template>
