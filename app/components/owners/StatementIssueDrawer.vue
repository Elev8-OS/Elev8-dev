<script setup lang="ts">
// StatementIssueDrawer — the staff side of a statement dispute.
//
// Everything that closes an issue lives here: reading what the owner
// disputed, replying on the thread, and resolving it as either 'explained'
// (staff clarified, no money moves) or 'adjusted' (a correction is filed).
// Keeping the adjusted path in this component is deliberate: the correction
// and the resolution that references it are written in the same handler, so a
// dispute can never be closed as "adjusted" without an adjustment behind it.
//
// The issue is looked up from `useOwnerStatements` state by id rather than
// passed in as a snapshot, so replies and resolution render immediately
// (same rule as UpsellOrderDrawer).

import type { OwnerStatementLine } from '~/components/owners/data/owner-statements'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { formatOwnerMoney } from '~/components/owners/data/owner-money'
import { mockOwners } from '~/components/owners/data/owners'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Textarea } from '~/components/ui/textarea'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const props = defineProps<{ issueId: string | null }>()

const open = defineModel<boolean>('open', { default: false })

const { issues, statements, addIssueMessage, resolveIssueWithResolution, recordAdjustment } = useOwnerStatements()
const { currentUser } = useCurrentDashboardUser()

const reply = ref('')
const resolveMode = ref<'explained' | 'adjusted'>('explained')
const resolveNote = ref('')
const adjustAmount = ref<number>(0)
const error = ref('')
const isSubmitting = ref(false)

const issue = computed(() => issues.value.find(i => i.id === props.issueId) ?? null)
const statement = computed(() => {
  const current = issue.value
  if (!current)
    return null
  return statements.value.find(s => s.id === current.statementId) ?? null
})

const currency = computed(() => {
  const current = statement.value
  if (!current)
    return ''
  return current.publishedSnapshot?.currency ?? current.currency
})

const line = computed<OwnerStatementLine | null>(() => {
  const current = statement.value
  const target = issue.value
  if (!current || !target?.lineId)
    return null
  const source = current.publishedSnapshot?.lines ?? current.lines
  return source.find(l => l.id === target.lineId) ?? null
})

const ownerName = computed(() => mockOwners.find(o => o.id === statement.value?.ownerId)?.name ?? statement.value?.ownerId ?? '')
const listingName = computed(() => {
  const id = statement.value?.listingId
  return listings.value.find(l => l.id === id)?.name ?? id ?? ''
})

const isResolved = computed(() => Boolean(issue.value?.resolvedAt))
// A correction amends what the owner was already told, so there has to be a
// published statement to amend. On a draft, the numbers can still be edited
// directly, which is why only the 'explained' path is offered there.
const canAdjust = computed(() => statement.value?.status === 'published')
const thread = computed(() => issue.value?.thread ?? [])

const staffId = computed(() => currentUser.value?.id ?? 'staff-1')

function staffLabel(id: string) {
  return id === currentUser.value?.id ? (currentUser.value?.name ?? id) : id
}

function formatAmount(amount: number) {
  return formatOwnerMoney(amount, currency.value)
}

function formatDate(iso?: string) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false })
}

watch(open, (isOpen) => {
  if (isOpen) {
    reply.value = ''
    resolveMode.value = 'explained'
    resolveNote.value = ''
    adjustAmount.value = 0
    error.value = ''
  }
})

// Switching back to 'explained' must not leave a stale amount behind that a
// later switch would silently reuse.
watch(resolveMode, () => {
  error.value = ''
  adjustAmount.value = 0
})

function sendReply() {
  const message = reply.value.trim()
  const current = issue.value
  if (!message || !current)
    return
  const result = addIssueMessage(current.id, 'staff', message)
  if (!result.ok) {
    error.value = 'This issue is no longer available.'
    return
  }
  reply.value = ''
  toast.success('Reply sent to the owner.')
}

function resolve() {
  const current = issue.value
  if (!current || isSubmitting.value)
    return

  const note = resolveNote.value.trim()
  if (!note) {
    error.value = 'Say what you found before closing the issue.'
    return
  }

  if (resolveMode.value === 'adjusted') {
    if (!canAdjust.value) {
      error.value = 'A correction can only be filed against a published statement.'
      return
    }
    if (!adjustAmount.value) {
      error.value = 'Enter the correction amount.'
      return
    }
  }

  isSubmitting.value = true
  try {
    let adjustmentId: string | undefined

    if (resolveMode.value === 'adjusted') {
      const recorded = recordAdjustment({
        ownerStatementId: current.statementId,
        amount: adjustAmount.value,
        reason: note,
      })
      if (!recorded.ok) {
        error.value = recorded.reason === 'not_published'
          ? 'A correction can only be filed against a published statement.'
          : 'That statement is no longer available.'
        return
      }
      adjustmentId = recorded.adjustment.id
    }

    // The note goes on the thread as well as on the resolution record: the
    // thread is what notifies the owner and what they read, the resolution is
    // the audit trail. Posting first means a failed resolve still leaves the
    // owner with the explanation.
    addIssueMessage(current.id, 'staff', note)

    const result = resolveIssueWithResolution({
      issueId: current.id,
      type: resolveMode.value,
      resolvedBy: staffId.value,
      note,
      adjustmentId,
    })
    if (!result.ok) {
      error.value = result.reason === 'already_resolved'
        ? 'This issue was already resolved.'
        : 'This issue is no longer available.'
      return
    }

    toast.success(resolveMode.value === 'adjusted'
      ? 'Issue resolved. The correction appears on the next statement.'
      : 'Issue resolved and the owner has been told.')
    open.value = false
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
      <SheetHeader class="border-b p-6">
        <SheetTitle>Statement issue</SheetTitle>
        <SheetDescription>
          <template v-if="statement">
            {{ ownerName }} · {{ listingName }} · {{ statement.period }}
          </template>
          <template v-else>
            This issue is no longer available.
          </template>
        </SheetDescription>
      </SheetHeader>

      <div v-if="issue && statement" class="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
        <div class="flex items-center gap-2">
          <Badge v-if="!isResolved" variant="destructive" data-testid="issue-status">
            Open
          </Badge>
          <Badge v-else variant="secondary" data-testid="issue-status">
            Resolved · {{ issue.resolution?.type === 'adjusted' ? 'Adjusted' : 'Explained' }}
          </Badge>
          <span class="text-xs text-muted-foreground">
            Raised {{ formatDate(issue.createdAt) }}
          </span>
        </div>

        <!-- What the owner disputed -->
        <section class="space-y-2 rounded-md border p-3">
          <div class="flex items-start justify-between gap-3">
            <p class="text-sm font-medium">
              {{ line?.label ?? 'Statement line' }}
            </p>
            <span
              class="shrink-0 text-sm font-semibold tabular-nums"
              :class="issue.amount < 0 ? 'text-destructive' : ''"
            >
              {{ formatAmount(issue.amount) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground" data-testid="issue-description">
            {{ issue.description }}
          </p>
        </section>

        <!-- Conversation -->
        <section class="space-y-3">
          <h3 class="text-sm font-medium">
            Conversation
          </h3>
          <p v-if="thread.length === 0" class="text-sm text-muted-foreground">
            No replies yet. The owner is waiting.
          </p>
          <div
            v-for="message in thread"
            :key="message.id"
            class="rounded-md border p-3"
            :class="message.author === 'staff' ? 'bg-muted/40' : ''"
            data-testid="issue-message"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-medium">
                {{ message.author === 'staff' ? 'Finance' : ownerName }}
              </span>
              <span class="text-xs text-muted-foreground">{{ formatDate(message.at) }}</span>
            </div>
            <p class="mt-1 text-sm">
              {{ message.message }}
            </p>
          </div>

          <div v-if="!isResolved" class="space-y-2">
            <Label for="issue-reply">Reply</Label>
            <Textarea
              id="issue-reply"
              v-model="reply"
              data-testid="issue-reply"
              placeholder="Answer the owner…"
              rows="2"
            />
            <Button variant="outline" size="sm" :disabled="!reply.trim()" data-testid="issue-send-reply" @click="sendReply">
              <Icon name="lucide:send" class="mr-1.5 size-4" />
              Send reply
            </Button>
          </div>
        </section>

        <!-- Resolution -->
        <section v-if="!isResolved" class="space-y-3 border-t pt-5">
          <h3 class="text-sm font-medium">
            Close this issue
          </h3>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="rounded-md border p-3 text-left text-sm transition-colors"
              :class="resolveMode === 'explained' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'"
              data-testid="resolve-mode-explained"
              @click="resolveMode = 'explained'"
            >
              <span class="font-medium">Explained</span>
              <span class="mt-1 block text-xs text-muted-foreground">
                The figure was right. Nothing moves.
              </span>
            </button>
            <button
              type="button"
              class="rounded-md border p-3 text-left text-sm transition-colors"
              :class="resolveMode === 'adjusted' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'"
              data-testid="resolve-mode-adjusted"
              @click="resolveMode = 'adjusted'"
            >
              <span class="font-medium">Adjusted</span>
              <span class="mt-1 block text-xs text-muted-foreground">
                File a correction on the next statement.
              </span>
            </button>
          </div>

          <div v-if="resolveMode === 'adjusted'" class="space-y-1.5">
            <Label for="issue-adjust-amount">Correction amount ({{ currency }})</Label>
            <Input
              id="issue-adjust-amount"
              v-model.number="adjustAmount"
              type="number"
              data-testid="issue-adjust-amount"
            />
            <p class="text-xs text-muted-foreground">
              Negative reduces the owner payout, positive pays them more. The
              published statement stays locked; this lands on the next one.
            </p>
            <p v-if="!canAdjust" class="text-xs text-destructive" data-testid="issue-adjust-blocked">
              This statement is not published yet, so there is nothing to correct.
              Edit the draft instead and resolve as explained.
            </p>
          </div>

          <div class="space-y-1.5">
            <Label for="issue-resolve-note">What you found</Label>
            <Textarea
              id="issue-resolve-note"
              v-model="resolveNote"
              data-testid="issue-resolve-note"
              placeholder="The owner sees this on the thread…"
              rows="3"
            />
          </div>

          <p v-if="error" class="text-sm text-destructive" role="alert" data-testid="issue-error">
            {{ error }}
          </p>

          <Button
            class="w-full"
            :disabled="isSubmitting || !resolveNote.trim()"
            data-testid="issue-resolve"
            @click="resolve"
          >
            {{ resolveMode === 'adjusted' ? 'Record correction & resolve' : 'Resolve as explained' }}
          </Button>
        </section>

        <section v-else class="space-y-1 border-t pt-5 text-sm" data-testid="issue-resolution">
          <p class="font-medium">
            Resolved as {{ issue.resolution?.type === 'adjusted' ? 'adjusted' : 'explained' }}
          </p>
          <p class="text-muted-foreground">
            By {{ staffLabel(issue.resolution?.resolvedBy ?? '') }} on {{ formatDate(issue.resolvedAt) }}
          </p>
          <p v-if="issue.resolution?.note" class="text-muted-foreground">
            {{ issue.resolution.note }}
          </p>
          <p v-if="issue.resolution?.adjustmentId" class="text-muted-foreground">
            A correction was filed and appears on the next statement.
          </p>
        </section>
      </div>
    </SheetContent>
  </Sheet>
</template>
