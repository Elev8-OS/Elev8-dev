<script setup lang="ts">
import type { KeyBox, PhysicalKey } from '~/components/key-management/data/keys'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import BaseSearchInput from '~/components/base/SearchInput.vue'
import { getKeyDisplayName, keyTypeLabels } from '~/components/key-management/data/keys'
import KeyActivityTimeline from '~/components/key-management/KeyActivityTimeline.vue'
import KeyBoxCard from '~/components/key-management/KeyBoxCard.vue'
import KeyBoxDialog from '~/components/key-management/KeyBoxDialog.vue'
import KeyBoxKeysDialog from '~/components/key-management/KeyBoxKeysDialog.vue'
import KeyCheckoutDialog from '~/components/key-management/KeyCheckoutDialog.vue'
import KeyHandoverDialog from '~/components/key-management/KeyHandoverDialog.vue'
import KeyHistorySheet from '~/components/key-management/KeyHistorySheet.vue'
import KeyLostDialog from '~/components/key-management/KeyLostDialog.vue'
import KeyRegisterDialog from '~/components/key-management/KeyRegisterDialog.vue'
import KeyTable from '~/components/key-management/KeyTable.vue'
import { listings } from '~/components/listings/data/listings'
import { useKeyManagement } from '~/composables/useKeyManagement'

const {
  filteredKeys,
  stats,
  filters,
  keyBoxes,
  isOverdue,
  returnKey,
  replaceKey,
  removeKeyBox,
  checkOverdueKeys,
} = useKeyManagement()

onMounted(() => {
  checkOverdueKeys()
})

// --- Dialog/sheet targets ---
const registerOpen = ref(false)
const checkoutTarget = ref<PhysicalKey | null>(null)
const handoverTarget = ref<PhysicalKey | null>(null)
const lostTarget = ref<PhysicalKey | null>(null)
const historyTarget = ref<PhysicalKey | null>(null)
const keyBoxDialogOpen = ref(false)
const keyBoxEditTarget = ref<KeyBox | null>(null)
const keyBoxKeysTarget = ref<KeyBox | null>(null)

const checkoutOpen = computed({
  get: () => checkoutTarget.value !== null,
  set: (val: boolean) => {
    if (!val)
      checkoutTarget.value = null
  },
})
const handoverOpen = computed({
  get: () => handoverTarget.value !== null,
  set: (val: boolean) => {
    if (!val)
      handoverTarget.value = null
  },
})
const lostOpen = computed({
  get: () => lostTarget.value !== null,
  set: (val: boolean) => {
    if (!val)
      lostTarget.value = null
  },
})
const historyOpen = computed({
  get: () => historyTarget.value !== null,
  set: (val: boolean) => {
    if (!val)
      historyTarget.value = null
  },
})
const keyBoxKeysOpen = computed({
  get: () => keyBoxKeysTarget.value !== null,
  set: (val: boolean) => {
    if (!val)
      keyBoxKeysTarget.value = null
  },
})

// --- Row action handlers ---
function handleReturn(key: PhysicalKey) {
  const result = returnKey(key.id)
  if (result.success)
    toast.success(`${getKeyDisplayName(key)} returned.`)
  else
    toast.error(result.error ?? 'Failed to return key.')
}

function handleReplace(key: PhysicalKey) {
  const result = replaceKey(key.id)
  if (result.success)
    toast.success(`Replacement registered: ${getKeyDisplayName(result.key!)}.`)
  else
    toast.error(result.error ?? 'Failed to replace key.')
}

// --- Key box handlers ---
function openAddKeyBox() {
  keyBoxEditTarget.value = null
  keyBoxDialogOpen.value = true
}

function openEditKeyBox(box: KeyBox) {
  keyBoxEditTarget.value = box
  keyBoxDialogOpen.value = true
}

function openKeyBoxKeys(box: KeyBox) {
  keyBoxKeysTarget.value = box
}

function handleRemoveKeyBox(box: KeyBox) {
  const result = removeKeyBox(box.id)
  if (result.success)
    toast.success(`Key box "${box.name}" removed.`)
  else
    toast.error(result.error ?? 'Failed to remove key box.')
}

// --- Filters ---
const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Checked out', value: 'checked_out' },
  { label: 'Lost', value: 'lost' },
]

const typeOptions = computed(() => [
  { label: 'All types', value: 'all' },
  ...Object.entries(keyTypeLabels).map(([value, label]) => ({ value, label })),
])

const listingPopoverOpen = ref(false)
const listingSearch = ref('')

const filteredListingsForFilter = computed(() => {
  const query = listingSearch.value.trim().toLowerCase()
  return listings.value.filter(l => !query || l.name.toLowerCase().includes(query))
})

function toggleListing(listingId: string) {
  if (filters.value.listings.includes(listingId))
    filters.value.listings = filters.value.listings.filter(id => id !== listingId)
  else
    filters.value.listings = [...filters.value.listings, listingId]
}

const hasActiveFilters = computed(() =>
  filters.value.search
  || filters.value.status !== 'all'
  || filters.value.type !== 'all'
  || filters.value.listings.length > 0,
)

function clearAllFilters() {
  filters.value.search = ''
  filters.value.status = 'all'
  filters.value.type = 'all'
  filters.value.listings = []
  listingSearch.value = ''
}

const activeTab = ref('keys')
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Key Management
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ stats.checkedOut }} checked out · {{ stats.overdue }} overdue · {{ stats.lost }} lost
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" class="gap-2" @click="openAddKeyBox">
          <Icon name="lucide:package-plus" class="size-4" />
          Add Key Box
        </Button>
        <Button class="gap-2" @click="registerOpen = true">
          <Icon name="lucide:plus" class="size-4" />
          Register Key
        </Button>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Total Keys</CardDescription>
          <CardTitle class="text-2xl">
            {{ stats.total }}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Available</CardDescription>
          <CardTitle class="text-2xl">
            {{ stats.available }}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Checked Out</CardDescription>
          <CardTitle class="text-2xl">
            {{ stats.checkedOut }}
            <span v-if="stats.overdue" class="text-sm font-normal text-destructive">
              {{ stats.overdue }} overdue
            </span>
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Lost</CardDescription>
          <CardTitle class="text-2xl">
            {{ stats.lost }}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Tabs v-model="activeTab">
      <TabsList>
        <TabsTrigger value="keys">
          Keys
        </TabsTrigger>
        <TabsTrigger value="boxes">
          Key Boxes
        </TabsTrigger>
        <TabsTrigger value="activity">
          Activity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="keys" class="mt-6 space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <!-- Search -->
          <BaseSearchInput v-model="filters.search" placeholder="Search keys..." />

          <!-- Status -->
          <Select v-model="filters.status">
            <SelectTrigger class="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Type -->
          <Select v-model="filters.type">
            <SelectTrigger class="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Listing filter -->
          <Popover v-model:open="listingPopoverOpen">
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                class="h-9 gap-1.5 px-3"
                :class="filters.listings.length ? 'border-primary text-foreground hover:bg-primary/10' : ''"
              >
                <Icon name="lucide:building-2" class="size-4" />
                Listings
                <Badge v-if="filters.listings.length" variant="default" class="ml-0.5 h-4 px-1 text-[10px]">
                  {{ filters.listings.length }}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-72 p-0" align="start">
              <div class="border-b p-2">
                <Input v-model="listingSearch" placeholder="Search listings..." class="h-8 text-sm" />
              </div>
              <div class="max-h-56 overflow-auto p-1">
                <button
                  v-for="l in filteredListingsForFilter"
                  :key="l.id"
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  @click="toggleListing(l.id)"
                >
                  <Checkbox :model-value="filters.listings.includes(l.id)" class="size-3.5" />
                  <span class="line-clamp-1">{{ l.name }}</span>
                </button>
                <p v-if="!filteredListingsForFilter.length" class="px-2 py-3 text-sm text-muted-foreground">
                  No listings found.
                </p>
              </div>
              <div v-if="filters.listings.length" class="border-t p-2">
                <Button variant="ghost" size="sm" class="h-6 text-xs text-muted-foreground" @click="filters.listings = []">
                  Clear all
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <!-- Clear all -->
          <Button v-if="hasActiveFilters" variant="ghost" class="h-9 text-xs" @click="clearAllFilters">
            Clear all
          </Button>
        </div>

        <KeyTable
          :keys="filteredKeys"
          :is-overdue="isOverdue"
          @checkout="checkoutTarget = $event"
          @return="handleReturn"
          @handover="handoverTarget = $event"
          @lost="lostTarget = $event"
          @replace="handleReplace"
          @history="historyTarget = $event"
        />
      </TabsContent>

      <TabsContent value="boxes" class="mt-6">
        <div v-if="keyBoxes.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KeyBoxCard
            v-for="box in keyBoxes"
            :key="box.id"
            :key-box="box"
            @edit="openEditKeyBox"
            @remove="handleRemoveKeyBox"
            @view-keys="openKeyBoxKeys"
          />
        </div>
        <div v-else class="flex flex-col items-center gap-3 rounded-lg border py-12 text-center">
          <Icon name="lucide:package-open" class="size-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            No key boxes yet. Add one to track lockbox locations and PINs.
          </p>
          <Button variant="outline" class="gap-2" @click="openAddKeyBox">
            <Icon name="lucide:plus" class="size-4" />
            Add Key Box
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="activity" class="mt-6">
        <KeyActivityTimeline />
      </TabsContent>
    </Tabs>

    <KeyRegisterDialog v-model:open="registerOpen" />
    <KeyCheckoutDialog v-model:open="checkoutOpen" :key-item="checkoutTarget" />
    <KeyHandoverDialog v-model:open="handoverOpen" :key-item="handoverTarget" />
    <KeyLostDialog v-model:open="lostOpen" :key-item="lostTarget" />
    <KeyHistorySheet v-model:open="historyOpen" :key-item="historyTarget" />
    <KeyBoxDialog v-model:open="keyBoxDialogOpen" :key-box="keyBoxEditTarget" />
    <KeyBoxKeysDialog v-model:open="keyBoxKeysOpen" :key-box="keyBoxKeysTarget" />
  </div>
</template>
