<script setup lang="ts">
import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import PromoCodeCreateDialog from '~/components/promo-code/PromoCodeCreateDialog.vue'
import PromoCodeDetailDialog from '~/components/promo-code/PromoCodeDetailDialog.vue'
import PromoCodeEditDialog from '~/components/promo-code/PromoCodeEditDialog.vue'
import PromoCodeTable from '~/components/promo-code/PromoCodeTable.vue'
import { usePromoCodes } from '~/composables/usePromoCodes'

definePageMeta({ layout: 'default' })

const {
  filteredCodes,
  filters,
  activeCount,
  expiredCount,
  totalRedemptions,
  duplicatePromoCode,
  toggleActive,
  deletePromoCode,
  clearFilters,
} = usePromoCodes()

const createOpen = ref(false)
const editOpen = ref(false)
const detailOpen = ref(false)
const editTarget = ref<PromoCode | null>(null)
const detailTarget = ref<PromoCode | null>(null)

function onView(code: PromoCode) {
  detailTarget.value = code
  detailOpen.value = true
}

function onEdit(code: PromoCode) {
  editTarget.value = code
  editOpen.value = true
}

function onDuplicate(id: string) {
  const created = duplicatePromoCode(id)
  if (created)
    toast.success(`Duplicated as ${created.code}`)
}

function onDelete(id: string) {
  const code = filteredCodes.value.find(c => c.id === id)
  if (!code)
    return
  if (!window.confirm(`Delete code ${code.code}? This cannot be undone.`))
    return
  deletePromoCode(id)
  toast.success(`Code ${code.code} deleted`)
}

const hasActiveFilters = computed(() => {
  return filters.value.search !== '' || filters.value.status !== 'all' || filters.value.sortBy !== 'recent'
})
</script>

<template>
  <div class="w-full flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Promo Codes
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ activeCount }} active · {{ expiredCount }} expired · {{ totalRedemptions }} total redemptions
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled>
          <Icon name="lucide:download" class="size-4 mr-1.5" />
          Export
        </Button>
        <Button @click="createOpen = true">
          <Icon name="i-lucide-plus" class="size-4 mr-1.5" />
          Create Code
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-3">
      <Card>
        <CardContent class="p-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-xs text-muted-foreground">
                Active
              </p>
              <p class="text-2xl font-bold">
                {{ activeCount }}
              </p>
            </div>
            <div class="flex size-9 items-center justify-center rounded-full bg-green-500/15 text-green-600">
              <Icon name="lucide:ticket-percent" class="size-4" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-xs text-muted-foreground">
                Expired
              </p>
              <p class="text-2xl font-bold">
                {{ expiredCount }}
              </p>
            </div>
            <div class="flex size-9 items-center justify-center rounded-full bg-gray-500/15 text-gray-600">
              <Icon name="lucide:clock" class="size-4" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-xs text-muted-foreground">
                Total redemptions
              </p>
              <p class="text-2xl font-bold">
                {{ totalRedemptions }}
              </p>
            </div>
            <div class="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon name="lucide:check-circle" class="size-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex-1 min-w-[200px] max-w-xs">
        <Input v-model="filters.search" placeholder="Search codes..." class="h-9" />
      </div>
      <Select v-model="filters.status">
        <SelectTrigger class="h-9 w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All statuses
          </SelectItem>
          <SelectItem value="active">
            Active
          </SelectItem>
          <SelectItem value="inactive">
            Inactive
          </SelectItem>
          <SelectItem value="expired">
            Expired
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="filters.sortBy">
        <SelectTrigger class="h-9 w-[160px]">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">
            Most recent
          </SelectItem>
          <SelectItem value="code">
            Code (A–Z)
          </SelectItem>
          <SelectItem value="redemptions">
            Redemptions
          </SelectItem>
        </SelectContent>
      </Select>
      <Button v-if="hasActiveFilters" variant="ghost" size="sm" @click="clearFilters">
        <Icon name="lucide:x" class="size-3.5 mr-1" />
        Clear filters
      </Button>
    </div>

    <PromoCodeTable
      :codes="filteredCodes"
      @view="onView"
      @edit="onEdit"
      @duplicate="onDuplicate"
      @delete="onDelete"
      @toggle-active="toggleActive"
    />

    <Empty v-if="filteredCodes.length === 0" class="rounded-lg border py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="lucide:ticket-percent" class="size-5" />
        </EmptyMedia>
        <EmptyTitle>No promo codes yet</EmptyTitle>
        <EmptyDescription>
          Create your first promo code to start running campaigns on your booking widgets and website.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button @click="createOpen = true">
          <Icon name="i-lucide-plus" class="size-4 mr-1.5" />
          Create Your First Code
        </Button>
      </EmptyContent>
    </Empty>

    <PromoCodeCreateDialog v-model:open="createOpen" />
    <PromoCodeEditDialog v-model:open="editOpen" :promo-code="editTarget" />
    <PromoCodeDetailDialog
      v-model:open="detailOpen"
      :promo-code="detailTarget"
      @edit="(c) => { detailOpen = false; onEdit(c) }"
      @duplicate="(id) => { detailOpen = false; onDuplicate(id) }"
    />
  </div>
</template>
