<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { formatFiscalYearStart } from '@/components/finance/data/datev'
import { useDatev } from '@/composables/useDatev'

// Switching to the Integrations tab is local page state, not navigation — the
// tabs are not routed. Driving it through the URL made the button depend on a
// same-page query change, which is exactly the kind of thing that silently
// stops working. Setting the shared state directly always works.
const activeFinanceTab = useState<string>('finance-active-tab', () => 'overview')
const integrationToOpen = useState<string | null>('finance-open-integration', () => null)

function openDatevSettings() {
  integrationToOpen.value = 'datev'
  activeFinanceTab.value = 'integrations'
}

const {
  settings,
  isConfigured,
  hydrate,
  periodFrom,
  periodTo,
  monthShortcuts,
  setPeriod,
  isPeriodValid,
  eligibleReservations,
  excludedDigest,
  scopeTotal,
  cancelledInPeriod,
  previewRows,
  isGenerating,
  preview,
  generate,
  discardPreview,
  existingExportForPeriod,
  downloadExport,
  emailExport,
  deleteExport,
  exports,
  formatDate,
} = useDatev()

onMounted(hydrate)

const activeShortcut = computed(() =>
  monthShortcuts.value.find(m => m.from === periodFrom.value && m.to === periodTo.value) ?? null,
)

const excludedTotal = computed(() =>
  excludedDigest.value.reduce((sum, row) => sum + row.count, 0),
)

function formatEur(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function handleGenerate() {
  const record = await generate()
  if (!record) {
    toast.error('Check the period and your DATEV settings.')
    return
  }
  toast.success(`${record.recordCount} Buchungssätze ready for review.`)
}

function handleDownload() {
  if (!preview.value)
    return
  downloadExport(preview.value)
  toast.success(`${preview.value.filename} downloaded.`)
  discardPreview()
}

function handleEmail() {
  if (!preview.value)
    return
  emailExport(preview.value)
  toast.success('File saved. Attach it to the e-mail draft.')
  discardPreview()
}

function handleRedownload(id: string) {
  const record = exports.value.find(e => e.id === id)
  if (!record)
    return
  if (!record.content) {
    toast.error('This export predates file retention — regenerate the period instead.')
    return
  }
  downloadExport(record)
  toast.success(`${record.filename} downloaded.`)
}

function handleDelete(id: string) {
  deleteExport(id)
  toast.info('Export removed from history.')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- ── Not configured ────────────────────────────────────────────── -->
    <div v-if="!isConfigured" class="rounded-lg border bg-card p-6">
      <div class="flex items-start gap-4">
        <FinanceDatevLogo class="h-8 w-auto shrink-0" />
        <div class="flex-1">
          <h3 class="text-sm font-semibold">
            DATEV Buchungsstapel
          </h3>
          <p class="mt-1 max-w-xl text-sm text-muted-foreground">
            Generate a posting batch your German tax advisor imports in one click. Before you can
            create a file, add the Beraternummer and Mandantennummer — your advisor provides both.
          </p>
          <Button class="mt-4" size="sm" @click="openDatevSettings">
            Set up DATEV
            <Icon name="lucide:arrow-right" class="ml-1.5 size-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- ── Review a generated file ───────────────────────────────────── -->
    <FinanceDatevPreview
      v-else-if="preview"
      :record="preview"
      :rows="previewRows"
      :advisor-email="settings.advisorEmail"
      @back="discardPreview"
      @download="handleDownload"
      @email="handleEmail"
    />

    <!-- ── Generator ─────────────────────────────────────────────────── -->
    <div v-else class="rounded-lg border bg-card">
      <div class="flex flex-wrap items-start justify-between gap-4 border-b p-4">
        <div class="flex items-start gap-3">
          <FinanceDatevLogo class="h-7 w-auto shrink-0" />
          <div>
            <h3 class="text-sm font-semibold">
              DATEV Buchungsstapel
            </h3>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Berater {{ settings.beraternummer }}
              · Mandant {{ settings.mandantennummer }}
              · {{ settings.skr }}
              · WJ {{ formatFiscalYearStart(settings) }}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" @click="openDatevSettings">
          <Icon name="lucide:settings-2" class="mr-1.5 size-4" />
          Configure
        </Button>
      </div>

      <div class="flex flex-col gap-5 p-4">
        <!-- Period -->
        <div class="flex flex-col gap-2">
          <Label class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Period
          </Label>
          <div class="flex flex-wrap items-center gap-2">
            <Button
              v-for="month in monthShortcuts"
              :key="month.from"
              :variant="activeShortcut?.from === month.from ? 'default' : 'outline'"
              size="sm"
              @click="setPeriod(month.from, month.to)"
            >
              {{ month.label }}
            </Button>
            <Separator orientation="vertical" class="mx-1 h-6" />
            <Input v-model="periodFrom" type="date" class="w-40" aria-label="Period from" />
            <span class="text-sm text-muted-foreground">→</span>
            <Input v-model="periodTo" type="date" class="w-40" aria-label="Period to" />
          </div>
          <p v-if="!isPeriodValid" class="text-xs text-destructive">
            The end date must fall on or after the start date.
          </p>
        </div>

        <!-- Scope -->
        <div class="rounded-md border bg-muted/30 p-3">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span>
              <span class="font-semibold">{{ eligibleReservations.length }}</span>
              <span class="text-muted-foreground"> bookings</span>
            </span>
            <span>
              <span class="font-semibold">EUR {{ formatEur(scopeTotal) }}</span>
            </span>
            <span v-if="cancelledInPeriod > 0" class="text-xs text-muted-foreground">
              {{ cancelledInPeriod }} cancelled ·
              {{ settings.includeCancelled ? 'included as reversals' : 'excluded' }}
            </span>
          </div>
          <div v-if="excludedTotal > 0" class="mt-2 flex flex-col gap-0.5 border-t pt-2">
            <p class="text-xs font-medium text-muted-foreground">
              {{ excludedTotal }} bookings in this period excluded
            </p>
            <p
              v-for="row in excludedDigest"
              :key="row.reason"
              class="text-xs text-muted-foreground"
            >
              · {{ row.count }} — {{ row.reason }}
            </p>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">
            Scope follows the EUR listing gate. Bookings are dated by check-out.
          </p>
        </div>

        <!-- Duplicate-period guard -->
        <div
          v-if="existingExportForPeriod"
          class="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50/60 p-3"
        >
          <Icon name="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p class="text-xs leading-relaxed text-amber-800">
            You already exported this period on
            <span class="font-medium">{{ formatTimestamp(existingExportForPeriod.generatedAt) }}</span>
            ({{ existingExportForPeriod.recordCount }} Buchungssätze). Sending a second file for the
            same period risks double-posted revenue — check with your advisor first.
          </p>
        </div>

        <!-- Generate -->
        <div class="flex items-center justify-end gap-3">
          <p v-if="eligibleReservations.length === 0" class="text-xs text-muted-foreground">
            Nothing to export in this period.
          </p>
          <Button
            :disabled="isGenerating || !isPeriodValid || eligibleReservations.length === 0"
            @click="handleGenerate"
          >
            <Icon
              v-if="isGenerating"
              name="lucide:loader-2"
              class="mr-1.5 size-4 animate-spin"
            />
            <Icon v-else name="lucide:file-plus-2" class="mr-1.5 size-4" />
            {{ isGenerating ? 'Building file…' : 'Create DATEV file' }}
          </Button>
        </div>
      </div>
    </div>

    <!-- ── History ───────────────────────────────────────────────────── -->
    <div class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold">
          Export history
        </h3>
        <p class="text-xs text-muted-foreground">
          What you have already handed to your advisor.
        </p>
      </div>

      <div v-if="exports.length === 0" class="px-4 py-10 text-center">
        <p class="text-sm text-muted-foreground">
          No exports yet.
        </p>
      </div>

      <div v-else class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead class="text-right">
                Records
              </TableHead>
              <TableHead class="text-right">
                Total
              </TableHead>
              <TableHead class="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="record in exports" :key="record.id">
              <TableCell class="text-sm">
                {{ formatDate(record.periodFrom) }} – {{ formatDate(record.periodTo) }}
              </TableCell>
              <TableCell class="font-mono text-xs">
                {{ record.filename }}
                <span
                  v-if="record.emailed"
                  class="ml-1.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700"
                >
                  e-mailed
                </span>
              </TableCell>
              <TableCell class="text-xs text-muted-foreground">
                {{ formatTimestamp(record.generatedAt) }}<br>
                {{ record.generatedBy }}
              </TableCell>
              <TableCell class="text-right font-mono text-xs">
                {{ record.recordCount }}
              </TableCell>
              <TableCell class="text-right font-mono text-xs">
                {{ record.currency }} {{ formatEur(record.totalAmount) }}
              </TableCell>
              <TableCell>
                <div class="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8"
                    :disabled="!record.content"
                    :title="record.content ? 'Download again' : 'File no longer retained'"
                    aria-label="Download again"
                    @click="handleRedownload(record.id)"
                  >
                    <Icon name="lucide:download" class="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8 text-muted-foreground hover:text-destructive"
                    aria-label="Remove from history"
                    @click="handleDelete(record.id)"
                  >
                    <Icon name="lucide:trash-2" class="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
