<script setup lang="ts">
// Two-step publication dialog for owner statements.
//
// The dialog renders the calculated draft lines + totals in a fixed display
// order (revenue -> expenses -> commission -> taxes -> adjustments -> net
// payout). Staff must advance through the confirmation step before the
// publish action runs; duplicate clicks during publish are blocked by an
// in-flight flag that disables the confirm button and short-circuits the
// handler. Once published, the dialog locks the values and closes — the
// composable's `publishedSnapshot` is the source of truth and any further
// edits land as separate OwnerStatementAdjustment rows (not edits here).

import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { mockOwners } from '~/components/owners/data/owners'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const props = defineProps<{
  modelValue: boolean
  statementId: string
  publishedBy?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'published': [statementId: string]
}>()

const { statements, publish } = useOwnerStatements()

const statement = computed(() => statements.value.find(s => s.id === props.statementId) ?? null)

const ownerName = computed(() => {
  const current = statement.value
  if (!current)
    return ''
  return mockOwners.find(o => o.id === current.ownerId)?.name ?? ''
})

const listingName = computed(() => {
  const current = statement.value
  if (!current)
    return ''
  return listings.value.find(l => l.id === current.listingId)?.name ?? ''
})

// Step 1: review. Step 2: confirm. Published snapshots lock the values.
const step = ref<'review' | 'confirm'>('review')
const isPublishing = ref(false)

watch(() => props.modelValue, (open) => {
  if (open) {
    // Reset state every time the dialog opens so a previous attempt
    // can be re-run cleanly.
    step.value = 'review'
    isPublishing.value = false
  }
})

// Display lines — picked from live lines for drafts, snapshot for published.
const orderedLines = computed(() => {
  const current = statement.value
  if (!current)
    return []
  const source = current.status === 'published' && current.publishedSnapshot
    ? current.publishedSnapshot.lines
    : current.lines
  // Render in the canonical owner-statement order defined by the brief.
  const order: Array<typeof source[number]['category']> = [
    'revenue',
    'expense',
    'commission',
    'tax',
    'fee',
    'adjustment',
  ]
  return source.slice().sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
})

const displayLines = computed(() => {
  const sectionLabel = (category: string) => {
    if (category === 'revenue')
      return 'Revenue'
    if (category === 'expense')
      return 'Operating expenses'
    if (category === 'commission')
      return 'Management commission'
    if (category === 'tax' || category === 'fee')
      return 'Taxes and fees'
    return 'Adjustments'
  }

  return orderedLines.value.map((line, index, lines) => {
    const section = sectionLabel(line.category)
    const previousSection = index > 0 ? sectionLabel(lines[index - 1]!.category) : null
    return { ...line, section: section !== previousSection ? section : null }
  })
})

const totalAmount = computed(() => {
  const current = statement.value
  if (!current)
    return 0
  if (current.status === 'published' && current.publishedSnapshot) {
    return current.publishedSnapshot.totalAmount
  }
  return current.totalAmount
})

const currency = computed(() => {
  const current = statement.value
  if (!current)
    return ''
  if (current.status === 'published' && current.publishedSnapshot) {
    return current.publishedSnapshot.currency
  }
  return current.currency
})

const isPublished = computed(() => statement.value?.status === 'published')
// Open-issue count for the badge on the confirmation step.
const openIssueCount = computed(() => {
  const current = statement.value
  if (!current)
    return 0
  return current.issues.filter(i => !i.resolvedAt).length
})

function formatCurrency(amount: number, c: string) {
  return `${c} ${amount.toLocaleString('en-US')}`
}

function onOpenChange(value: boolean) {
  emit('update:modelValue', value)
}

function startConfirm() {
  if (isPublished.value)
    return
  step.value = 'confirm'
}

async function confirmPublish() {
  if (isPublishing.value)
    return
  if (isPublished.value)
    return
  const current = statement.value
  if (!current)
    return

  isPublishing.value = true
  const result = publish(props.statementId, props.publishedBy ?? 'staff-1')
  if (result.ok) {
    toast.success('Statement published. Owner has been notified.')
    emit('published', props.statementId)
    emit('update:modelValue', false)
  }
  else {
    toast.error('Could not publish this statement.')
  }
  isPublishing.value = false
}
</script>

<template>
  <Dialog
    :open="modelValue"
    @update:open="onOpenChange"
  >
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {{ isPublished ? 'Published statement' : 'Publish statement' }}
        </DialogTitle>
        <DialogDescription>
          <template v-if="statement">
            {{ ownerName }} · {{ listingName }} · {{ statement.period }}
          </template>
          <template v-else>
            Statement not found.
          </template>
        </DialogDescription>
      </DialogHeader>

      <template v-if="statement">
        <div class="flex flex-col gap-4 py-2">
          <!-- Calculated lines in the canonical order required by the brief. -->
          <div class="flex flex-col gap-1 text-sm">
            <template
              v-for="line in displayLines"
              :key="line.id"
            >
              <p
                v-if="line.section"
                class="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground first:mt-0"
              >
                {{ line.section }}
              </p>
              <div class="flex items-center justify-between rounded-md border px-3 py-2">
                <span class="text-muted-foreground">{{ line.label }}</span>
                <span
                  class="font-medium tabular-nums"
                  :class="line.amount < 0 ? 'text-destructive' : ''"
                >
                  {{ formatCurrency(line.amount, currency) }}
                </span>
              </div>
            </template>
            <div class="mt-2 flex items-center justify-between border-t pt-3">
              <span class="font-semibold">Net owner payout</span>
              <span class="font-semibold tabular-nums">
                {{ formatCurrency(totalAmount, currency) }}
              </span>
            </div>
          </div>

          <!-- Open issue count surfaced on both review + confirm. -->
          <div v-if="openIssueCount > 0" class="flex items-center gap-2 text-xs">
            <Icon name="lucide:alert-circle" class="h-4 w-4 text-amber-500" />
            <span class="text-muted-foreground">
              {{ openIssueCount }} open issue{{ openIssueCount === 1 ? '' : 's' }} attached to this statement.
            </span>
          </div>

          <!-- Published banner / read-only note. -->
          <div
            v-if="isPublished"
            class="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700"
            role="status"
            aria-live="polite"
          >
            This statement is published. Financial values are locked. Any
            corrections must be filed as a next-period adjustment.
          </div>

          <!-- Confirmation step body. -->
          <div v-if="!isPublished && step === 'confirm'" class="space-y-2">
            <p class="text-sm text-muted-foreground">
              This action freezes the financial values below and notifies the
              owner. After publishing, only next-period adjustments can amend
              the payout.
            </p>
          </div>
        </div>
      </template>

      <DialogFooter>
        <Button
          v-if="isPublished"
          variant="outline"
          data-testid="publish-close"
          @click="onOpenChange(false)"
        >
          Close
        </Button>
        <template v-else>
          <Button
            v-if="step === 'review'"
            variant="outline"
            @click="onOpenChange(false)"
          >
            Cancel
          </Button>
          <Button
            v-if="step === 'review'"
            data-testid="publish-start"
            @click="startConfirm"
          >
            Confirm & Review
          </Button>
          <Button
            v-if="step === 'confirm'"
            variant="outline"
            :disabled="isPublishing"
            @click="step = 'review'"
          >
            Back
          </Button>
          <Button
            v-if="step === 'confirm'"
            data-testid="publish-confirm"
            :disabled="isPublishing"
            @click="confirmPublish"
          >
            <Icon
              v-if="isPublishing"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ isPublishing ? 'Publishing…' : 'Publish statement' }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
