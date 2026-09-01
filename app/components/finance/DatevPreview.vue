<script setup lang="ts">
import type { DatevExportRecord } from '@/components/finance/data/datev'
import type { ReservationEntry } from '@/components/finance/data/revenue'
import type { DatevPostingRecord } from '@/lib/datev-extf'
import { computed, ref } from 'vue'
import { DATEV_FIELD_COUNT, formatAmount, formatBelegdatum } from '@/lib/datev-extf'

interface PreviewRow {
  reservation: ReservationEntry
  posting: DatevPostingRecord
}

const props = defineProps<{
  record: DatevExportRecord
  rows: PreviewRow[]
  advisorEmail: string
}>()

const emit = defineEmits<{
  back: []
  download: []
  email: []
}>()

const activeTab = ref<string>('bookings')

const totals = computed(() => {
  let debit = 0
  let credit = 0
  for (const row of props.rows) {
    if (row.posting.sollHaben === 'S')
      debit += row.posting.umsatz
    else
      credit += row.posting.umsatz
  }
  return { debit, credit }
})

const reversalCount = computed(() => props.rows.filter(r => r.posting.generalumkehr).length)

/** Header + column captions + one line per posting. */
const rawLines = computed(() => props.record.content.split('\r\n').filter(line => line.length > 0))

const fileSizeLabel = computed(() => {
  const bytes = new Blob([props.record.content]).size
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
})

function formatEur(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPeriod(from: string, to: string): string {
  const fmt = (iso: string) => iso.split('-').reverse().join('.')
  return `${fmt(from)} – ${fmt(to)}`
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- File summary strip -->
    <div class="rounded-lg border bg-card">
      <div class="flex flex-wrap items-start justify-between gap-4 p-4">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
            <Icon name="lucide:file-spreadsheet" class="size-5 text-muted-foreground" />
          </div>
          <div>
            <p class="font-mono text-sm font-medium">
              {{ record.filename }}
            </p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ formatPeriod(record.periodFrom, record.periodTo) }}
              · Berater {{ record.beraternummer }}
              · Mandant {{ record.mandantennummer }}
              · {{ record.skr }}
              · {{ fileSizeLabel }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" @click="emit('back')">
            <Icon name="lucide:arrow-left" class="mr-1.5 size-4" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="!advisorEmail"
            :title="advisorEmail ? `Draft to ${advisorEmail}` : 'Add an advisor e-mail in settings'"
            @click="emit('email')"
          >
            <Icon name="lucide:mail" class="mr-1.5 size-4" />
            Download &amp; e-mail
          </Button>
          <Button size="sm" @click="emit('download')">
            <Icon name="lucide:download" class="mr-1.5 size-4" />
            Download
          </Button>
        </div>
      </div>

      <Separator />

      <!-- Totals + validity -->
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-xs">
        <span class="text-muted-foreground">
          <span class="font-medium text-foreground">{{ record.recordCount }}</span> Buchungssätze
        </span>
        <span class="text-muted-foreground">
          Soll <span class="font-medium text-foreground">EUR {{ formatEur(totals.debit) }}</span>
        </span>
        <span v-if="totals.credit > 0" class="text-muted-foreground">
          Haben <span class="font-medium text-foreground">EUR {{ formatEur(totals.credit) }}</span>
        </span>
        <span v-if="reversalCount > 0" class="text-amber-700">
          {{ reversalCount }} Generalumkehr
        </span>
        <span
          class="ml-auto inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700"
        >
          <Icon name="lucide:check" class="size-3" />
          EXTF 700 · v13 · {{ DATEV_FIELD_COUNT }} fields · CP1252 · CRLF
        </span>
      </div>
    </div>

    <!-- Empty period -->
    <div
      v-if="rows.length === 0"
      class="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center"
    >
      <Icon name="lucide:file-x" class="size-8 text-muted-foreground" />
      <p class="text-sm font-medium">
        No postings in this period
      </p>
      <p class="max-w-sm text-xs text-muted-foreground">
        The file is valid but contains only the header rows. Pick a different period, or check
        whether the bookings you expected sit on EUR-tagged listings.
      </p>
    </div>

    <!-- Bookings / Raw -->
    <Tabs v-else v-model="activeTab">
      <TabsList>
        <TabsTrigger value="bookings">
          Bookings
          <span class="ml-1.5 text-xs text-muted-foreground">{{ rows.length }}</span>
        </TabsTrigger>
        <TabsTrigger value="raw">
          Raw file
        </TabsTrigger>
      </TabsList>

      <!-- Reviewable posting table -->
      <TabsContent value="bookings" class="mt-3">
        <div class="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-20">
                  Beleg&shy;datum
                </TableHead>
                <TableHead>Belegfeld 1</TableHead>
                <TableHead>Buchungstext</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead class="text-right">
                  Konto
                </TableHead>
                <TableHead class="text-right">
                  Gegenkonto
                </TableHead>
                <TableHead class="w-12 text-center">
                  S/H
                </TableHead>
                <TableHead class="text-right">
                  Umsatz
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in rows"
                :key="`${row.reservation.id}-${row.reservation.checkOut}`"
                :class="row.posting.generalumkehr ? 'bg-amber-50/50' : ''"
              >
                <TableCell class="font-mono text-xs">
                  {{ formatBelegdatum(row.posting.belegdatum) }}
                </TableCell>
                <TableCell class="font-mono text-xs">
                  {{ row.posting.belegfeld1 }}
                </TableCell>
                <TableCell class="max-w-[22rem] truncate text-xs" :title="row.posting.buchungstext">
                  <span v-if="row.posting.generalumkehr" class="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    GU
                  </span>
                  {{ row.posting.buchungstext }}
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">
                  {{ row.reservation.channel }}
                </TableCell>
                <TableCell class="text-right font-mono text-xs">
                  {{ row.posting.konto }}
                </TableCell>
                <TableCell class="text-right font-mono text-xs">
                  {{ row.posting.gegenkonto }}
                </TableCell>
                <TableCell class="text-center font-mono text-xs">
                  {{ row.posting.sollHaben }}
                </TableCell>
                <TableCell class="text-right font-mono text-xs font-medium">
                  {{ formatAmount(row.posting.umsatz) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Posted on check-out date (service completion). BU-Schlüssel is intentionally empty and
          Festschreibung is 0 — your advisor assigns the VAT keys on import.
        </p>
      </TabsContent>

      <!-- Raw EXTF text -->
      <TabsContent value="raw" class="mt-3">
        <div class="rounded-md border bg-muted/30">
          <ScrollArea class="h-[28rem]">
            <div class="overflow-x-auto">
              <pre class="min-w-max p-3 font-mono text-[11px] leading-relaxed"><code><span
                v-for="(line, index) in rawLines"
                :key="index"
                class="block whitespace-pre"
                :class="index === 0
                  ? 'text-primary'
                  : index === 1 ? 'text-muted-foreground' : ''"
              ><span class="mr-3 inline-block w-8 select-none text-right text-muted-foreground/50">{{ index + 1 }}</span>{{ line }}</span></code></pre>
            </div>
          </ScrollArea>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Line 1 is the EXTF header, line 2 the {{ DATEV_FIELD_COUNT }} column captions, then one
          record per booking. Shown as text — the download is encoded CP1252 with CRLF endings.
        </p>
      </TabsContent>
    </Tabs>
  </div>
</template>
