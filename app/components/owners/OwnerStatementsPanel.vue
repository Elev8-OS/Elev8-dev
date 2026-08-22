<script setup lang="ts">
// Owner statements panel — embeddable version of the tenant statement
// workflow (generate drafts → publish → adjustments). Rendered inside the
// Users page Owner tab; the /owner-statements route wraps the same component.

import { toast } from 'vue-sonner'
import StatementPublishDialog from '~/components/owner-statements/StatementPublishDialog.vue'
import { mockOwners } from '~/components/owners/data/owners'
import StatementTable from '~/components/owners/StatementTable.vue'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const { statements, generateForPeriod, recordAdjustment } = useOwnerStatements()

const periodInput = ref('2026-06')
const isGenerating = ref(false)
const selectedStatementId = ref<string | null>(null)
const dialogOpen = ref(false)
const adjustDialogOpen = ref(false)
const adjustTargetId = ref<string | null>(null)
const adjustAmount = ref(0)
const adjustReason = ref('')

const drafts = computed(() => statements.value.filter(s => s.status === 'draft'))
const published = computed(() => statements.value.filter(s => s.status === 'published'))
const openIssuesCount = computed(() => statements.value
  .flatMap(s => s.issues)
  .filter(issue => !issue.resolvedAt)
  .length)

function ownerName(ownerId: string) {
  return mockOwners.find(owner => owner.id === ownerId)?.name ?? ownerId
}

function openPublish(id: string) {
  selectedStatementId.value = id
  dialogOpen.value = true
}

async function handleGenerate() {
  isGenerating.value = true
  try {
    const result = generateForPeriod(periodInput.value)
    if (result.ok) {
      toast.success(`Generated ${result.created} draft${result.created === 1 ? '' : 's'} for ${periodInput.value}.`)
    }
    else {
      toast.error(result.error)
    }
  }
  finally {
    isGenerating.value = false
  }
}

function openAdjust(id: string) {
  adjustTargetId.value = id
  adjustAmount.value = 0
  adjustReason.value = ''
  adjustDialogOpen.value = true
}

function submitAdjust() {
  if (!adjustTargetId.value || !adjustReason.value.trim())
    return
  const result = recordAdjustment({
    ownerStatementId: adjustTargetId.value,
    amount: adjustAmount.value,
    reason: adjustReason.value.trim(),
  })
  if (result.ok) {
    toast.success('Adjustment recorded for next period.')
    adjustDialogOpen.value = false
  }
  else {
    toast.error('Could not record adjustment.')
  }
}

// --- Sortable + paginated statement table ----------------------------------
const sortKey = ref<'owner' | 'listing' | 'period' | 'amount' | 'issues'>('period')
const sortDir = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = 8

type StatementRow = ReturnType<typeof enrichStatement>

function enrichStatement(statement: { id: string, ownerId: string, listingId: string, period: string, currency: string, totalAmount: number, status: string, issues: Array<{ resolvedAt?: string }> }) {
  return {
    ...statement,
    ownerLabel: ownerName(statement.ownerId),
    openIssues: statement.issues.filter(issue => !issue.resolvedAt).length,
  }
}

function toggleSort(key: typeof sortKey.value) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
  page.value = 1
}

function sortedList(list: StatementRow[]) {
  const factor = sortDir.value === 'asc' ? 1 : -1
  return list.slice().sort((a, b) => {
    if (sortKey.value === 'owner')
      return a.ownerLabel.localeCompare(b.ownerLabel) * factor
    if (sortKey.value === 'listing')
      return a.listingId.localeCompare(b.listingId) * factor
    if (sortKey.value === 'amount')
      return (a.totalAmount - b.totalAmount) * factor
    if (sortKey.value === 'issues')
      return (a.openIssues - b.openIssues) * factor
    return a.period.localeCompare(b.period) * factor
  })
}

function paginate(list: StatementRow[]) {
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page.value, totalPages)
  const start = (safePage - 1) * pageSize
  return { rows: list.slice(start, start + pageSize), total, totalPages, currentPage: safePage }
}

const draftPage = computed(() => paginate(sortedList(drafts.value.map(enrichStatement))))
const publishedPage = computed(() => paginate(sortedList(published.value.map(enrichStatement))))
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">
          Owner Statements
        </h1>
        <p class="text-sm text-muted-foreground">
          Review drafts, publish, and track adjustments across all owners.
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <div class="flex flex-col gap-1">
          <label for="generate-period-panel" class="text-xs font-medium text-muted-foreground">
            Period
          </label>
          <Input
            id="generate-period-panel"
            v-model="periodInput"
            class="w-32"
            placeholder="YYYY-MM"
          />
        </div>
        <Button :disabled="isGenerating" @click="handleGenerate">
          <Icon name="lucide:plus" class="mr-1.5 size-4" />
          {{ isGenerating ? 'Generating…' : 'Generate monthly drafts' }}
        </Button>
      </div>
    </div>

    <section class="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm">
            Drafts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold">
            {{ drafts.length }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm">
            Published
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold">
            {{ published.length }}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm">
            Open issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-2xl font-semibold">
            {{ openIssuesCount }}
          </p>
        </CardContent>
      </Card>
    </section>

    <Tabs default-value="drafts">
      <TabsList>
        <TabsTrigger value="drafts">
          Drafts ({{ drafts.length }})
        </TabsTrigger>
        <TabsTrigger value="published">
          Published ({{ published.length }})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="drafts" class="space-y-3">
        <div v-if="drafts.length === 0" class="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Icon name="lucide:file-x-2" class="size-6 opacity-60" />
          <p>
            No draft statements yet. Generate monthly drafts above.
          </p>
        </div>
        <StatementTable
          v-else
          :rows="draftPage.rows"
          :total="draftPage.total"
          :total-pages="draftPage.totalPages"
          :current-page="draftPage.currentPage"
          :sort-key="sortKey"
          :sort-dir="sortDir"
          mode="draft"
          @toggle-sort="toggleSort"
          @page-change="(p: number) => page = p"
          @publish="openPublish"
        />
      </TabsContent>

      <TabsContent value="published" class="space-y-3">
        <div v-if="published.length === 0" class="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Icon name="lucide:file-x-2" class="size-6 opacity-60" />
          <p>
            No published statements yet.
          </p>
        </div>
        <StatementTable
          v-else
          :rows="publishedPage.rows"
          :total="publishedPage.total"
          :total-pages="publishedPage.totalPages"
          :current-page="publishedPage.currentPage"
          :sort-key="sortKey"
          :sort-dir="sortDir"
          mode="published"
          @toggle-sort="toggleSort"
          @page-change="(p: number) => page = p"
          @adjust="openAdjust"
        />
      </TabsContent>
    </Tabs>

    <StatementPublishDialog
      v-if="selectedStatementId"
      v-model="dialogOpen"
      :statement-id="selectedStatementId"
      published-by="staff-1"
      @published="(id) => toast.info(`Statement ${id} published.`)"
    />

    <Dialog v-model:open="adjustDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record adjustment</DialogTitle>
          <DialogDescription>
            Apply a correction against the next period. The published statement remains locked.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label for="adjust-amount-panel">Amount</Label>
            <Input
              id="adjust-amount-panel"
              v-model.number="adjustAmount"
              type="number"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="adjust-reason-panel">Reason</Label>
            <Textarea
              id="adjust-reason-panel"
              v-model="adjustReason"
              placeholder="Describe why this adjustment is required…"
              rows="3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="adjustDialogOpen = false">
            Cancel
          </Button>
          <Button :disabled="!adjustReason.trim()" @click="submitAdjust">
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
