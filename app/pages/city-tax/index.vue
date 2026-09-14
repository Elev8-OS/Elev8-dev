<script setup lang="ts">
import type { CityTaxWorklistRow } from '~/composables/useCityTax'
import type { CityTaxPaymentMethod, ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import CityTaxTable from '~/components/city-tax/CityTaxTable.vue'
import CityTaxCollectDialog from '~/components/reservations/CityTaxCollectDialog.vue'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import { formatCityTaxTotals } from '~/components/reservations/data/city-tax'
import { useCityTax } from '~/composables/useCityTax'

const cityTax = useCityTax()

// There is no scheduler in this app, so catch up on mount, the same way the
// guest registration page calls checkOverdueRegistrations().
onMounted(() => cityTax.emitCityTaxAlerts())

const tab = ref<'overdue' | 'due_today' | 'upcoming' | 'settled'>('due_today')
const search = ref('')
const channelFilter = ref<'all' | 'Airbnb' | 'Booking.com' | 'Direct'>('all')
const listingFilter = ref<string>('all')
const selected = ref<string[]>([])
const bulkOpen = ref(false)
const detailTarget = ref<ReservationEntry | null>(null)

const detailOpen = computed({
  get: () => detailTarget.value !== null,
  set: (value: boolean) => {
    if (!value)
      detailTarget.value = null
  },
})

const bucket = computed<CityTaxWorklistRow[]>(() => {
  switch (tab.value) {
    case 'overdue': return cityTax.overdue.value
    case 'due_today': return cityTax.dueToday.value
    case 'upcoming': return cityTax.upcoming.value
    default: return cityTax.settled.value
  }
})

const listingOptions = computed(() => {
  const names = new Set(cityTax.rows.value.map(row => row.reservation.listingName))
  return ['all', ...[...names].sort()]
})

const visibleRows = computed(() => bucket.value.filter((row) => {
  const term = search.value.trim().toLowerCase()
  const matchesSearch = term.length === 0 || row.reservation.guestName.toLowerCase().includes(term)
  const matchesChannel = channelFilter.value === 'all' || row.reservation.channel === channelFilter.value
  const matchesListing = listingFilter.value === 'all' || row.reservation.listingName === listingFilter.value
  return matchesSearch && matchesChannel && matchesListing
}))

const selectedRows = computed(() => visibleRows.value.filter(row => selected.value.includes(row.reservation.id)))
const bulkAmountLabel = computed(() =>
  formatCityTaxTotals(selectedRows.value.flatMap(row => row.assessment.totals)))

watch(tab, () => {
  selected.value = []
})

function openDetail(row: CityTaxWorklistRow) {
  detailTarget.value = row.reservation
}

function bulkCollect(payload: { method: CityTaxPaymentMethod, note?: string }) {
  const count = selectedRows.value.length
  for (const row of selectedRows.value)
    cityTax.markCollected(row.reservation.id, payload)
  selected.value = []
  toast.success(`Marked ${count} stays collected`)
}

function checkForAlerts() {
  cityTax.emitCityTaxAlerts()
  toast.info('Checked every stay for an outstanding city tax')
}
</script>

<template>
  <div class="flex flex-col gap-4 p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-bold tracking-tight">
          City Tax
        </h2>
        <p class="text-sm text-muted-foreground">
          Every stay where the tourist levy is yours to collect, not the channel's.
        </p>
      </div>
      <Button variant="outline" @click="checkForAlerts">
        <Icon name="lucide:bell-ring" class="mr-2 size-4" />
        Check for alerts
      </Button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">
            Overdue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-bold text-destructive tabular-nums">
            {{ cityTax.overdue.value.length }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">
            Due today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-bold tabular-nums">
            {{ cityTax.dueToday.value.length }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">
            Outstanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <!-- One line per currency. Nothing here is converted. -->
          <p class="text-lg font-bold tabular-nums">
            {{ formatCityTaxTotals(cityTax.outstandingTotal.value) }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-xs font-medium text-muted-foreground">
            Collected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-lg font-bold tabular-nums">
            {{ formatCityTaxTotals(cityTax.collectedTotal.value) }}
          </p>
        </CardContent>
      </Card>
    </div>

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger value="overdue">
          Overdue ({{ cityTax.overdue.value.length }})
        </TabsTrigger>
        <TabsTrigger value="due_today">
          Due today ({{ cityTax.dueToday.value.length }})
        </TabsTrigger>
        <TabsTrigger value="upcoming">
          Upcoming ({{ cityTax.upcoming.value.length }})
        </TabsTrigger>
        <TabsTrigger value="settled">
          Settled ({{ cityTax.settled.value.length }})
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="flex flex-wrap items-center gap-2">
      <Input v-model="search" placeholder="Search guest" class="h-9 w-56" />
      <Select v-model="channelFilter">
        <SelectTrigger class="h-9 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All channels
          </SelectItem>
          <SelectItem value="Airbnb">
            Airbnb
          </SelectItem>
          <SelectItem value="Booking.com">
            Booking.com
          </SelectItem>
          <SelectItem value="Direct">
            Direct
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="listingFilter">
        <SelectTrigger class="h-9 w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in listingOptions" :key="option" :value="option">
            {{ option === 'all' ? 'All properties' : option }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="selected.length > 0" class="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <span class="text-sm">{{ selected.length }} selected · {{ bulkAmountLabel }}</span>
      <Button size="sm" variant="ghost" @click="selected = []">
        Clear
      </Button>
      <Button size="sm" @click="bulkOpen = true">
        Mark collected
      </Button>
    </div>

    <CityTaxTable
      :rows="visibleRows"
      :selectable="tab !== 'settled'"
      :selected="selected"
      :empty-label="tab === 'settled' ? 'Nothing settled yet.' : 'Nothing outstanding here.'"
      @open-detail="openDetail"
      @update:selected="(ids) => selected = ids"
    />

    <CityTaxCollectDialog v-model:open="bulkOpen" :amount-label="bulkAmountLabel" @confirm="bulkCollect" />
    <ReservationDetailSheet v-model:open="detailOpen" :reservation="detailTarget" />
  </div>
</template>
