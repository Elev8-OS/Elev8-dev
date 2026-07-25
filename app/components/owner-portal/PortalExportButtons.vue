<script setup lang="ts">
import type { OwnerExportFormat } from '~/composables/useOwnerStatements'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const props = defineProps<{ statementId: string }>()

const { currentOwner } = useOwnerPortal()
const { mockExport } = useOwnerStatements()
const exporting = ref<OwnerExportFormat | null>(null)

function handlePrint() {
  if (typeof window === 'undefined')
    return
  window.print()
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
      data-testid="export-pdf"
      @click="handlePrint"
    >
      <Icon name="lucide:file-down" class="mr-2 size-4" aria-hidden="true" />
      PDF
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
