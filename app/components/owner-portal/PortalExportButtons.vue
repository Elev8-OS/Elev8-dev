<script setup lang="ts">
// Statement exports. PDF is a real generated file (jsPDF), not the browser
// print dialog: the owner gets a branded document with a stable filename
// rather than whatever their browser's Save as PDF happens to produce.
//
// The file is assembled from the SAME gated detail the page renders, so a
// line the portal hides for this owner cannot reappear in a download.

import type { OwnerExportFormat } from '~/composables/useOwnerStatements'
import { computed, ref, toRef } from 'vue'
import { toast } from 'vue-sonner'
import { ownerStatementFieldForLineCategory } from '~/components/owners/data/owner-permissions'
import { Button } from '~/components/ui/button'
import { useOwnerOperationalFees } from '~/composables/useOwnerOperationalFees'
import { useOwnerPayoutDetails } from '~/composables/useOwnerPayoutDetails'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwners } from '~/composables/useOwners'
import { useOwnerStatementDetail } from '~/composables/useOwnerStatementDetail'
import { useOwnerStatements } from '~/composables/useOwnerStatements'
import { useTenantBranding } from '~/composables/useTenantBranding'
import { buildOwnerStatementPdf } from '~/lib/owner-statement-pdf'

const props = defineProps<{ statementId: string }>()

const { currentOwner, canViewStatementField } = useOwnerPortal()
const { mockExport } = useOwnerStatements()
const { detail } = useOwnerStatementDetail(toRef(props, 'statementId'))
const { mappings } = useOwners()
const { getFeeFor } = useOwnerOperationalFees()
const { branding } = useTenantBranding()
const { currentDetails, payoutAddressLines, payoutBankLines } = useOwnerPayoutDetails()

const exporting = ref<OwnerExportFormat | null>(null)

const mapping = computed(() => {
  const statement = detail.value.statement
  if (!statement)
    return undefined
  return mappings.value.find(m => m.ownerId === statement.ownerId && m.listingId === statement.listingId)
})

/**
 * The lines the file may carry: the frozen snapshot, minus every category
 * whose permission field is off for this owner. Same map the page uses.
 */
const visibleLines = computed(() => {
  const statement = detail.value.statement
  if (!statement)
    return []
  const source = statement.publishedSnapshot?.lines ?? statement.lines
  return source.filter(line => canViewStatementField(ownerStatementFieldForLineCategory[line.category]))
})

async function handleExportPdf() {
  const statement = detail.value.statement
  if (exporting.value || !statement)
    return
  exporting.value = 'pdf'
  try {
    buildOwnerStatementPdf({
      statement,
      owner: currentOwner.value ?? undefined,
      listing: detail.value.listing ?? undefined,
      mapping: mapping.value,
      operationalFee: getFeeFor(statement.ownerId, statement.listingId),
      reservations: detail.value.reservations,
      lines: visibleLines.value,
      adjustments: detail.value.adjustments,
      relatedAdjustments: detail.value.relatedAdjustments,
      ownerAddressLines: payoutAddressLines(currentDetails.value),
      payoutBankLines: payoutBankLines(currentDetails.value),
      showPayout: canViewStatementField('netPayout'),
      branding: { logoDataUrl: branding.value.primaryLogo?.dataUrl },
    }, { download: true })
  }
  catch {
    toast.error('This statement could not be exported.')
    exporting.value = null
    return
  }

  toast.success('PDF statement downloaded.')
  // The file is already in the owner's hands; the activity row is bookkeeping,
  // so a failure here must not read as a failed export.
  await mockExport({
    format: 'pdf',
    statementId: props.statementId,
    actor: currentOwner.value?.name ?? 'owner-portal',
  })
  exporting.value = null
}

async function handleExport(format: OwnerExportFormat) {
  if (exporting.value)
    return
  exporting.value = format
  const result = await mockExport({
    format,
    statementId: props.statementId,
    actor: currentOwner.value?.name ?? 'owner-portal',
  })
  if (result.ok) {
    toast.success(`${format.toUpperCase()} statement export is ready.`)
  }
  else {
    toast.error('This statement could not be exported.')
  }
  exporting.value = null
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" aria-label="Statement exports">
    <Button
      data-portal-chrome
      variant="outline"
      size="sm"
      :disabled="Boolean(exporting)"
      data-testid="export-pdf"
      @click="handleExportPdf"
    >
      <Icon
        :name="exporting === 'pdf' ? 'lucide:loader-2' : 'lucide:file-down'"
        class="mr-2 size-4"
        :class="exporting === 'pdf' ? 'animate-spin' : ''"
        aria-hidden="true"
      />
      {{ exporting === 'pdf' ? 'Preparing…' : 'PDF' }}
    </Button>
    <Button
      data-portal-chrome
      variant="outline"
      size="sm"
      :disabled="Boolean(exporting)"
      data-testid="export-xlsx"
      @click="handleExport('xlsx')"
    >
      <Icon
        :name="exporting === 'xlsx' ? 'lucide:loader-2' : 'lucide:table-2'"
        class="mr-2 size-4"
        :class="exporting === 'xlsx' ? 'animate-spin' : ''"
        aria-hidden="true"
      />
      {{ exporting === 'xlsx' ? 'Exporting…' : 'XLSX' }}
    </Button>
  </div>
</template>
