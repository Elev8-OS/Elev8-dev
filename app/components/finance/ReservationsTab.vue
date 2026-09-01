<script setup lang="ts">
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useBexio } from '@/composables/useBexio'
import { useDatev } from '@/composables/useDatev'
import { useJurnal } from '@/composables/useJurnal'
import { useLexware } from '@/composables/useLexware'
import { useListingMappings } from '@/composables/useListingMappings'
import { useReservations } from '@/composables/useReservations'

const {
  reservations,
  unsyncedCount,
  isPushingReservations,
  isPushingSelected,
  lastReservationSync,
  pushReservations,
  pushSelected,
} = useReservations()

const { isConnected: jurnalConnected, formatDate } = useJurnal()
const { isConnected: bexioConnected } = useBexio()
const {
  isConnected: lexwareConnected,
  lexwareDraftReadyCount,
  isPushingLexware,
  pushEligibleReservations,
} = useLexware()
const {
  isConfigured: datevConfigured,
  isEligible: isDatevEligible,
  isGenerating: isGeneratingDatev,
  preview: datevPreview,
  previewRows: datevPreviewRows,
  settings: datevSettings,
  generateFromSelection,
  discardPreview: discardDatevPreview,
  downloadExport: downloadDatevExport,
  emailExport: emailDatevExport,
  hydrate: hydrateDatev,
} = useDatev()
const { getMappingFor, mappedByIntegration } = useListingMappings()

onMounted(hydrateDatev)
const { showConvertedColumn, getAccountingAmount } = useActiveIntegration()

const anyConnected = computed(() => jurnalConnected.value || bexioConnected.value)

const syncTarget = computed(() => {
  const { jurnal, bexio } = mappedByIntegration.value
  const hasJurnal = jurnal > 0 && jurnalConnected.value
  const hasBexio = bexio > 0 && bexioConnected.value
  if (hasJurnal && hasBexio)
    return 'your accounting software'
  if (hasJurnal)
    return 'Jurnal'
  if (hasBexio)
    return 'Bexio'
  return 'your accounting software'
})

// ── Filters ────────────────────────────────────────────────────────────────
const df = new DateFormatter('en-GB', { day: 'numeric', month: 'short' })
const BALI_KEYWORDS = ['Tambora', 'Kalmantan', 'Pererenan', 'Sinabung', 'Merapi', 'Sanur', 'Ubud', 'Canggu']

function getTag(listing: string) {
  return BALI_KEYWORDS.some(k => listing.includes(k)) ? 'Bali' : 'Switzerland'
}

const filterListing = ref('all')
const filterTag = ref('all')
const filterChannel = ref('all')
const filterStatus = ref('all')
const filterSynced = ref('all')
const filterIntegration = ref('all')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dateRange = ref<any>(undefined)
const filterDateFrom = ref('')
const filterDateTo = ref('')

watch(dateRange, (range) => {
  filterDateFrom.value = range?.start ? range.start.toString() : ''
  filterDateTo.value = range?.end ? range.end.toString() : ''
})

const uniqueListings = computed(() =>
  [...new Set(reservations.value.map(r => r.listing))].sort(),
)

const filteredReservations = computed(() => {
  return reservations.value.filter((r) => {
    if (filterListing.value !== 'all' && r.listing !== filterListing.value)
      return false
    if (filterTag.value !== 'all' && getTag(r.listing) !== filterTag.value)
      return false
    if (filterChannel.value !== 'all' && r.channel !== filterChannel.value)
      return false
    if (filterStatus.value !== 'all' && r.status !== filterStatus.value)
      return false
    if (filterSynced.value === 'synced' && !r.synced)
      return false
    if (filterSynced.value === 'unsynced' && r.synced)
      return false
    if (filterDateFrom.value && r.checkIn < filterDateFrom.value)
      return false
    if (filterDateTo.value && r.checkIn > filterDateTo.value)
      return false
    if (filterIntegration.value !== 'all') {
      const mapping = getMappingFor(r.listing)
      if (filterIntegration.value === 'none' && mapping)
        return false
      if (filterIntegration.value === 'jurnal' && mapping?.integration !== 'jurnal')
        return false
      if (filterIntegration.value === 'bexio' && mapping?.integration !== 'bexio')
        return false
      if (filterIntegration.value === 'lexware' && !(r.currency === 'EUR' && r.syncedToLexware))
        return false
    }
    return true
  })
})

function clearFilters() {
  filterListing.value = 'all'
  filterTag.value = 'all'
  filterChannel.value = 'all'
  filterStatus.value = 'all'
  filterSynced.value = 'all'
  filterIntegration.value = 'all'
  dateRange.value = undefined
  filterDateFrom.value = ''
  filterDateTo.value = ''
}

// ── Row selection ──────────────────────────────────────────────────────────
function rowKey(id: string, checkIn: string) {
  return `${id}:${checkIn}`
}

const selected = ref<string[]>([])

const allFilteredKeys = computed(() =>
  filteredReservations.value.map(r => rowKey(r.id, r.checkIn)),
)

const allSelected = computed(
  () => allFilteredKeys.value.length > 0
    && allFilteredKeys.value.every(k => selected.value.includes(k)),
)

const someSelected = computed(
  () => !allSelected.value && allFilteredKeys.value.some(k => selected.value.includes(k)),
)

function toggleAll() {
  if (allSelected.value) {
    selected.value = selected.value.filter(k => !allFilteredKeys.value.includes(k))
  }
  else {
    const toAdd = allFilteredKeys.value.filter(k => !selected.value.includes(k))
    selected.value = [...selected.value, ...toAdd]
  }
}

const clearKey = ref(0)

function clearSelection() {
  selected.value = []
  clearKey.value++
}

function toggleRow(id: string, checkIn: string) {
  const key = rowKey(id, checkIn)
  if (selected.value.includes(key)) {
    selected.value = selected.value.filter(k => k !== key)
  }
  else {
    selected.value = [...selected.value, key]
  }
}

const selectedWithInvoice = computed(() =>
  filteredReservations.value.filter(r => selected.value.includes(rowKey(r.id, r.checkIn))),
)

const selectedUnsynced = computed(() =>
  selectedWithInvoice.value.filter(r => !r.synced),
)

const selectedEurUnsynced = computed(() =>
  selectedWithInvoice.value.filter(r => r.currency === 'EUR' && !r.syncedToLexware),
)

// Rows in the selection that can legally become DATEV postings. Manual picking
// must not be able to smuggle a CHF booking into a German posting batch, so the
// same EUR gate the period export uses applies here.
const selectedDatevEligible = computed(() => selectedWithInvoice.value.filter(isDatevEligible))

const datevDialogOpen = ref(false)
const datevExcluded = ref<{ reason: string, count: number }[]>([])

async function handleExportDatev() {
  const { record, excluded } = await generateFromSelection(selectedWithInvoice.value)
  datevExcluded.value = excluded
  if (!record) {
    toast.error('Nothing in the selection can be exported to DATEV.')
    return
  }
  datevDialogOpen.value = true
}

function handleDatevDownload() {
  if (!datevPreview.value)
    return
  downloadDatevExport(datevPreview.value)
  toast.success(`${datevPreview.value.filename} downloaded.`)
  closeDatevDialog()
}

function handleDatevEmail() {
  if (!datevPreview.value)
    return
  emailDatevExport(datevPreview.value)
  toast.success('File saved. Attach it to the e-mail draft.')
  closeDatevDialog()
}

function closeDatevDialog() {
  datevDialogOpen.value = false
  discardDatevPreview()
}

const pushDestLabel = computed(() => {
  const integs = new Set<string>()
  selectedUnsynced.value.forEach((r) => {
    const mapping = getMappingFor(r.listing)
    if (mapping)
      integs.add(mapping.integration)
  })
  if (integs.size === 1)
    return [...integs][0] === 'jurnal' ? 'Jurnal' : 'Bexio'
  return 'accounting'
})

const selectedCount = computed(() =>
  allFilteredKeys.value.filter(k => selected.value.includes(k)).length,
)

// ── Actions ────────────────────────────────────────────────────────────────
async function handlePushNow() {
  await pushReservations()
  toast.success(`All reservations pushed to ${syncTarget.value}.`)
}

async function handlePushToLexware() {
  const { pushed, skipped } = await pushEligibleReservations()
  if (pushed > 0)
    toast.success(`${pushed} EUR reservation${pushed > 1 ? 's' : ''} pushed to Lexware.`)
  if (skipped > 0)
    toast.info(`${skipped} skipped — connect Lexware first.`)
}

async function handlePushSelected() {
  const dest = pushDestLabel.value
  const keys = selectedUnsynced.value.map(r => ({ id: r.id, checkIn: r.checkIn }))
  await pushSelected(keys)
  toast.success(`${keys.length} reservation${keys.length > 1 ? 's' : ''} pushed to ${dest}.`)
}

function downloadSingleInvoice(invoice: string, guest: string) {
  const content = `Invoice: ${invoice}\nGuest: ${guest}\nGenerated: ${new Date().toLocaleString()}`
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = invoice
  a.click()
  URL.revokeObjectURL(url)
}

function downloadBulkInvoices() {
  const invoices = selectedWithInvoice.value
  if (invoices.length === 0) {
    toast.info('No invoices available in selection.')
    return
  }
  invoices.forEach(r => downloadSingleInvoice(r.invoice!, r.guest))
  toast.success(`${invoices.length} invoice${invoices.length > 1 ? 's' : ''} downloaded.`)
}

function exportCSV() {
  const headers = ['ID', 'Guest', 'Listing', 'Channel', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Amount (CHF)', 'Status', 'Invoice', 'Synced']
  const rows = filteredReservations.value.map(r => [
    r.id,
    r.guest,
    r.listing,
    r.channel,
    r.checkIn,
    r.checkOut,
    r.nights,
    r.guests,
    r.amount,
    r.status,
    r.invoice ?? '',
    r.synced ? 'Yes' : 'No',
  ])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'reservations-export.csv'
  a.click()
  URL.revokeObjectURL(url)
  toast.success('CSV exported.')
}

// ── Display helpers ────────────────────────────────────────────────────────
function formatCHF(amount: number) {
  return `CHF ${amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const channelIcon: Record<string, string> = {
  'Booking.com': 'i-lucide-globe',
  'Airbnb': 'i-lucide-home',
  'Direct': 'i-lucide-link',
}

const statusClass: Record<string, string> = {
  'Unverified': 'text-amber-700 bg-amber-50',
  'Verified': 'text-green-700 bg-green-50',
  'Checked-in': 'text-blue-700 bg-blue-50',
  'Checked-out': 'text-muted-foreground bg-muted/60',
  'Cancelled': 'text-red-700 bg-red-50',
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Sync banner -->
    <div
      v-if="!anyConnected"
      class="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <Icon name="i-lucide-cloud-off" class="h-4 w-4 shrink-0 text-amber-600" />
      <p class="flex-1 text-sm text-amber-800">
        No accounting integration connected. Reservations won't be synced until you connect an integration.
      </p>
      <NuxtLink to="/finance?tab=integrations">
        <Button variant="outline" size="sm" class="h-7 border-amber-300 bg-white text-amber-800 hover:bg-amber-100">
          Connect
        </Button>
      </NuxtLink>
    </div>

    <div
      v-else-if="unsyncedCount > 0"
      class="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
    >
      <Icon name="i-lucide-cloud-upload" class="h-4 w-4 shrink-0 text-blue-600" />
      <p class="flex-1 text-sm text-blue-800">
        <span class="font-medium">{{ unsyncedCount }} {{ unsyncedCount === 1 ? 'reservation' : 'reservations' }}</span>
        not yet synced to {{ syncTarget }}.
        <span v-if="lastReservationSync" class="text-blue-600"> Last sync: {{ formatDate(lastReservationSync) }}.</span>
      </p>
      <Button
        size="sm"
        class="h-7 bg-blue-600 text-white hover:bg-blue-700"
        :disabled="isPushingReservations"
        @click="handlePushNow"
      >
        <Icon
          v-if="isPushingReservations"
          name="i-lucide-loader-2"
          class="mr-1.5 h-3.5 w-3.5 animate-spin"
        />
        <Icon v-else name="i-lucide-upload" class="mr-1.5 h-3.5 w-3.5" />
        {{ isPushingReservations ? 'Pushing…' : 'Push now' }}
      </Button>
    </div>

    <!-- Lexware EUR push banner (shown when Lexware connected + eligible unsynced) -->
    <div
      v-if="lexwareConnected && lexwareDraftReadyCount > 0"
      class="flex items-center gap-3 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3"
    >
      <Icon name="i-lucide-file-text" class="h-4 w-4 shrink-0 text-amber-700" />
      <p class="flex-1 text-sm text-amber-900">
        <span class="font-medium">{{ lexwareDraftReadyCount }} EUR {{ lexwareDraftReadyCount === 1 ? 'reservation' : 'reservations' }}</span>
        ready as Lexware draft invoices.
      </p>
      <Button
        size="sm"
        class="h-7 bg-amber-600 text-white hover:bg-amber-700"
        :disabled="isPushingLexware"
        @click="handlePushToLexware"
      >
        <Icon
          v-if="isPushingLexware"
          name="i-lucide-loader-2"
          class="mr-1.5 h-3.5 w-3.5 animate-spin"
        />
        <Icon v-else name="i-lucide-upload" class="mr-1.5 h-3.5 w-3.5" />
        {{ isPushingLexware ? 'Pushing…' : 'Push to Lexware' }}
      </Button>
    </div>

    <div
      v-else
      class="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3"
    >
      <Icon name="i-lucide-cloud-check" class="h-4 w-4 shrink-0 text-green-600" />
      <p class="flex-1 text-sm text-green-800">
        All reservations synced to {{ syncTarget }}.
        <span v-if="lastReservationSync" class="text-green-600"> Last sync: {{ formatDate(lastReservationSync) }}.</span>
      </p>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3">
      <!-- Listing -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">Listing</label>
        <Select v-model="filterListing">
          <SelectTrigger class="h-8 w-52 text-sm">
            <SelectValue placeholder="All listings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All listings
            </SelectItem>
            <SelectItem v-for="l in uniqueListings" :key="l" :value="l">
              {{ l }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Tag -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">Tag</label>
        <Select v-model="filterTag">
          <SelectTrigger class="h-8 w-36 text-sm">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All tags
            </SelectItem>
            <SelectItem value="Switzerland">
              Switzerland
            </SelectItem>
            <SelectItem value="Bali">
              Bali
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Channel -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">Channel</label>
        <Select v-model="filterChannel">
          <SelectTrigger class="h-8 w-36 text-sm">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All channels
            </SelectItem>
            <SelectItem value="Booking.com">
              Booking.com
            </SelectItem>
            <SelectItem value="Airbnb">
              Airbnb
            </SelectItem>
            <SelectItem value="Direct">
              Direct
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Status -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">Status</label>
        <Select v-model="filterStatus">
          <SelectTrigger class="h-8 w-36 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All statuses
            </SelectItem>
            <SelectItem value="Unverified">
              Unverified
            </SelectItem>
            <SelectItem value="Verified">
              Verified
            </SelectItem>
            <SelectItem value="Checked-in">
              Checked-in
            </SelectItem>
            <SelectItem value="Cancelled">
              Cancelled
            </SelectItem>
            <SelectItem value="Checked-out">
              Checked-out
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Sync status -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">Sync</label>
        <Select v-model="filterSynced">
          <SelectTrigger class="h-8 w-36 text-sm">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All
            </SelectItem>
            <SelectItem value="synced">
              Synced
            </SelectItem>
            <SelectItem value="unsynced">
              Not synced
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Integration -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">Integration</label>
        <Select v-model="filterIntegration">
          <SelectTrigger class="h-8 w-36 text-sm">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All
            </SelectItem>
            <SelectItem value="jurnal">
              Jurnal
            </SelectItem>
            <SelectItem value="bexio">
              Bexio
            </SelectItem>
            <SelectItem value="lexware">
              Lexware
            </SelectItem>
            <SelectItem value="none">
              Not mapped
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Date range -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">Check-in range</label>
        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="h-8 w-48 justify-start text-left text-sm font-normal"
              :class="!dateRange?.start && 'text-muted-foreground'"
            >
              <Icon name="i-lucide-calendar" class="mr-2 h-3.5 w-3.5 shrink-0" />
              <span class="truncate">
                <template v-if="dateRange?.start && dateRange?.end">
                  {{ df.format(dateRange.start.toDate(getLocalTimeZone())) }} – {{ df.format(dateRange.end.toDate(getLocalTimeZone())) }}
                </template>
                <template v-else-if="dateRange?.start">
                  {{ df.format(dateRange.start.toDate(getLocalTimeZone())) }}
                </template>
                <template v-else>Pick a date range</template>
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0" align="start">
            <RangeCalendar
              v-model="dateRange"
              weekday-format="short"
              :number-of-months="2"
              initial-focus
            />
          </PopoverContent>
        </Popover>
      </div>

      <!-- Clear -->
      <Button variant="ghost" size="sm" class="h-8 self-end" @click="clearFilters">
        Clear filters
      </Button>

      <!-- Export CSV (always visible, right-aligned) -->
      <div class="ml-auto flex items-end gap-2">
        <Button variant="outline" size="sm" class="h-8" @click="exportCSV">
          <Icon name="i-lucide-download" class="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>

    <!-- Selection info bar -->
    <div v-if="selectedCount > 0" class="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
      <Icon name="i-lucide-check-square" class="h-4 w-4" />
      <span class="font-medium text-foreground">{{ selectedCount }} row{{ selectedCount > 1 ? 's' : '' }} selected</span>
      <button class="text-xs underline hover:text-foreground" @click="clearSelection">
        Clear
      </button>
      <Separator orientation="vertical" class="mx-1 h-4" />
      <Button
        variant="outline"
        size="sm"
        class="h-7"
        @click="downloadBulkInvoices"
      >
        <Icon name="i-lucide-archive-restore" class="mr-1.5 h-3.5 w-3.5" />
        Download {{ selectedWithInvoice.length }} invoice{{ selectedWithInvoice.length > 1 ? 's' : '' }}
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="h-7"
        @click="exportCSV"
      >
        <Icon name="i-lucide-download" class="mr-1.5 h-3.5 w-3.5" />
        Export CSV
      </Button>
      <Button
        v-if="selectedUnsynced.length > 0 && anyConnected"
        size="sm"
        class="h-7 bg-blue-600 text-white hover:bg-blue-700"
        :disabled="isPushingSelected"
        @click="handlePushSelected"
      >
        <Icon
          v-if="isPushingSelected"
          name="i-lucide-loader-2"
          class="mr-1.5 h-3.5 w-3.5 animate-spin"
        />
        <Icon v-else name="i-lucide-upload" class="mr-1.5 h-3.5 w-3.5" />
        {{ isPushingSelected ? 'Pushing…' : `Push ${selectedUnsynced.length} to ${pushDestLabel}` }}
      </Button>
      <Button
        v-if="lexwareConnected && selectedEurUnsynced.length > 0"
        size="sm"
        class="h-7 bg-amber-600 text-white hover:bg-amber-700"
        :disabled="isPushingLexware"
        @click="handlePushToLexware"
      >
        <Icon
          v-if="isPushingLexware"
          name="i-lucide-loader-2"
          class="mr-1.5 h-3.5 w-3.5 animate-spin"
        />
        <Icon v-else name="i-lucide-upload" class="mr-1.5 h-3.5 w-3.5" />
        {{ isPushingLexware ? 'Pushing…' : `Push ${selectedEurUnsynced.length} to Lexware` }}
      </Button>
      <Button
        v-if="datevConfigured && selectedDatevEligible.length > 0"
        variant="outline"
        size="sm"
        class="h-7"
        :disabled="isGeneratingDatev"
        @click="handleExportDatev"
      >
        <Icon
          v-if="isGeneratingDatev"
          name="i-lucide-loader-2"
          class="mr-1.5 h-3.5 w-3.5 animate-spin"
        />
        <Icon v-else name="i-lucide-file-spreadsheet" class="mr-1.5 h-3.5 w-3.5" />
        {{ isGeneratingDatev ? 'Building…' : `Export ${selectedDatevEligible.length} to DATEV` }}
      </Button>
    </div>

    <!-- Review the hand-picked batch before it reaches the advisor -->
    <Dialog :open="datevDialogOpen" @update:open="(v) => v ? null : closeDatevDialog()">
      <!--
        `sm:max-w-5xl`, not `max-w-5xl`: DialogContent's default is the responsive
        `sm:max-w-lg`, so an unprefixed override loses to it above 640px and the
        preview spills out of a 512px dialog.
      -->
      <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>DATEV export — selected reservations</DialogTitle>
          <DialogDescription>
            Built from your selection, not a calendar period. Review it before handing it over.
          </DialogDescription>
        </DialogHeader>

        <div
          v-if="datevExcluded.length > 0"
          class="flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50/60 p-3"
        >
          <p class="text-xs font-medium text-amber-900">
            Some selected rows are not in the file
          </p>
          <p v-for="row in datevExcluded" :key="row.reason" class="text-xs text-amber-800">
            · {{ row.count }} — {{ row.reason }}
          </p>
        </div>

        <div v-if="datevPreview" class="min-w-0">
          <FinanceDatevPreview
            :record="datevPreview"
            :rows="datevPreviewRows"
            :advisor-email="datevSettings.advisorEmail"
            @back="closeDatevDialog"
            @download="handleDatevDownload"
            @email="handleDatevEmail"
          />
        </div>
      </DialogContent>
    </Dialog>

    <!-- Table -->
    <div class="rounded-md border">
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-10 px-3">
                <Checkbox
                  :key="`header-${clearKey}`"
                  :checked="allSelected ? true : someSelected ? 'indeterminate' : false"
                  aria-label="Select all"
                  @click.stop="toggleAll"
                />
              </TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Listing</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead class="w-16 text-center">
                Nights
              </TableHead>
              <TableHead class="text-right">
                Amount
              </TableHead>
              <TableHead v-if="showConvertedColumn" class="text-right text-muted-foreground">
                Acctg. Amount
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="w-20 text-center">
                Invoice
              </TableHead>
              <TableHead class="w-32 text-center">
                Synced
              </TableHead>
              <TableHead class="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="filteredReservations.length === 0">
              <TableCell :colspan="showConvertedColumn ? 12 : 11" class="py-12 text-center text-sm text-muted-foreground">
                No reservations match the selected filters.
              </TableCell>
            </TableRow>
            <TableRow
              v-for="res in filteredReservations"
              v-else
              :key="rowKey(res.id, res.checkIn)"
              class="hover:bg-muted/50"
              :class="selected.includes(rowKey(res.id, res.checkIn)) && 'bg-muted/40'"
            >
              <TableCell class="px-3">
                <Checkbox
                  :key="`${rowKey(res.id, res.checkIn)}-${clearKey}`"
                  :checked="selected.includes(rowKey(res.id, res.checkIn))"
                  aria-label="Select row"
                  @click.stop="toggleRow(res.id, res.checkIn)"
                />
              </TableCell>
              <TableCell class="font-medium">
                {{ res.guest }}
              </TableCell>
              <TableCell class="max-w-44 truncate text-muted-foreground" :title="res.listing">
                {{ res.listing }}
              </TableCell>
              <TableCell>
                <span class="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon :name="channelIcon[res.channel] ?? 'i-lucide-link'" class="h-3.5 w-3.5" />
                  {{ res.channel }}
                </span>
              </TableCell>
              <TableCell class="tabular-nums text-muted-foreground">
                {{ res.checkIn }}
              </TableCell>
              <TableCell class="text-center tabular-nums">
                {{ res.nights }}
              </TableCell>
              <TableCell class="text-right font-semibold tabular-nums">
                {{ formatCHF(res.amount) }}
              </TableCell>
              <TableCell v-if="showConvertedColumn" class="text-right tabular-nums text-muted-foreground text-xs">
                {{ res.synced ? (getAccountingAmount(res.listing, res.amount) ?? '—') : '—' }}
              </TableCell>
              <TableCell>
                <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="statusClass[res.status]">
                  {{ res.status }}
                </span>
              </TableCell>
              <TableCell class="text-center">
                <Icon
                  name="i-lucide-paperclip"
                  class="mx-auto h-4 w-4 text-muted-foreground"
                  :title="res.invoice"
                />
              </TableCell>
              <TableCell class="text-center">
                <div class="flex flex-col items-center gap-1">
                  <template v-if="res.synced">
                    <div class="inline-flex items-center gap-1.5">
                      <Icon name="i-lucide-cloud-check" class="h-4 w-4 text-green-500" />
                      <span
                        v-if="getMappingFor(res.listing)"
                        class="rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="getMappingFor(res.listing)!.integration === 'jurnal' ? 'text-blue-700 bg-blue-50' : 'text-violet-700 bg-violet-50'"
                      >
                        {{ getMappingFor(res.listing)!.integration === 'jurnal' ? 'Jurnal' : 'Bexio' }}
                      </span>
                    </div>
                  </template>
                  <template v-else>
                    <span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Icon name="i-lucide-cloud-off" class="h-3 w-3" />
                      Not synced
                    </span>
                  </template>
                  <template v-if="res.currency === 'EUR'">
                    <span
                      v-if="res.syncedToLexware"
                      class="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-amber-800"
                    >
                      <Icon name="i-lucide-file-check" class="h-3 w-3" />
                      Lexware
                    </span>
                    <span v-else class="inline-flex items-center gap-1 text-[10px] text-amber-700/70">
                      <Icon name="i-lucide-file-text" class="h-3 w-3" />
                      Lexware pending
                    </span>
                  </template>
                </div>
              </TableCell>
              <TableCell @click.stop>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="h-7 w-7" aria-label="Row actions">
                      <Icon name="i-lucide-ellipsis" class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      v-if="res.invoice"
                      @click="downloadSingleInvoice(res.invoice!, res.guest)"
                    >
                      <Icon name="i-lucide-download" class="mr-2 h-4 w-4" />
                      Download invoice
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <Icon name="i-lucide-eye" class="mr-2 h-4 w-4" />
                      View detail
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
