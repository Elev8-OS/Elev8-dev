<script setup lang="ts">
import { toast } from 'vue-sonner'
import { mockOwners } from '~/components/owners/data/owners'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const { statements, publish, generateForPeriod, recordAdjustment } = useOwnerStatements()

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
  .filter(issue => !issue.resolvedAt).length)

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
</script>

<template>
  <div class="space-y-6 p-4 sm:p-6 lg:p-8">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Owner Statements
        </h1>
        <p class="text-sm text-muted-foreground">
          Review drafts, publish, and track adjustments across all owners.
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <div class="flex flex-col gap-1">
          <label for="generate-period" class="text-xs font-medium text-muted-foreground">
            Period
          </label>
          <Input
            id="generate-period"
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
    </header>

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
        <Card v-if="drafts.length === 0">
          <CardContent class="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Icon name="lucide:file-x-2" class="size-6 opacity-60" />
            <p>
              No draft statements yet. Generate monthly drafts above.
            </p>
          </CardContent>
        </Card>
        <Card v-for="statement in drafts" :key="statement.id">
          <CardHeader>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle class="text-base">
                  {{ ownerName(statement.ownerId) }}
                </CardTitle>
                <CardDescription>
                  {{ statement.listingId }} · {{ statement.period }} · {{ statement.currency }} {{ statement.totalAmount.toLocaleString('en-US') }}
                </CardDescription>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Badge v-if="statement.issues.some(issue => !issue.resolvedAt)" variant="destructive">
                  {{ statement.issues.filter(issue => !issue.resolvedAt).length }} open issue
                </Badge>
                <Button variant="default" size="sm" @click="openPublish(statement.id)">
                  Publish
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </TabsContent>

      <TabsContent value="published" class="space-y-3">
        <Card v-if="published.length === 0">
          <CardContent class="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Icon name="lucide:file-x-2" class="size-6 opacity-60" />
            <p>
              No published statements yet.
            </p>
          </CardContent>
        </Card>
        <Card v-for="statement in published" :key="statement.id">
          <CardHeader>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle class="text-base">
                  {{ ownerName(statement.ownerId) }}
                </CardTitle>
                <CardDescription>
                  {{ statement.listingId }} · {{ statement.period }} · {{ statement.currency }} {{ statement.totalAmount.toLocaleString('en-US') }}
                </CardDescription>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Badge v-if="statement.issues.some(issue => !issue.resolvedAt)" variant="destructive">
                  {{ statement.issues.filter(issue => !issue.resolvedAt).length }} open issue
                </Badge>
                <Badge variant="secondary">
                  Read-only
                </Badge>
                <Button variant="outline" size="sm" @click="openAdjust(statement.id)">
                  Add adjustment
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
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
            <Label for="adjust-amount">Amount</Label>
            <Input
              id="adjust-amount"
              v-model.number="adjustAmount"
              type="number"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="adjust-reason">Reason</Label>
            <Textarea
              id="adjust-reason"
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
