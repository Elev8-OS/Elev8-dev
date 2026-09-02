<script setup lang="ts">
// Owner portal — Maintenance.
//
// Built around the three questions an owner actually asks: what needs me, what
// is happening right now, and what has this cost me. Anything awaiting their
// decision comes first and carries the decision inline; everything else is
// scannable history with the receipt attached.

import type { StatusUpdate, Task } from '~/components/tasks/data/schema'
import { toast } from 'vue-sonner'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useTaskOwnerApproval } from '~/composables/useTaskOwnerApproval'

definePageMeta({ layout: 'owner-portal' })

const { currentOwner } = useOwnerPortal()
const { tasksForOwner, approvalsForOwner, ownerApprove, ownerReject } = useTaskOwnerApproval()

const approveTarget = ref<Task | null>(null)
const rejectTarget = ref<Task | null>(null)
const responseNote = ref('')
const expanded = ref<Set<string>>(new Set())

type Filter = 'all' | 'active' | 'completed'
const filter = ref<Filter>('all')

const allTasks = computed<Task[]>(() =>
  currentOwner.value ? tasksForOwner(currentOwner.value.id) : [])

const needsApproval = computed(() =>
  currentOwner.value ? approvalsForOwner(currentOwner.value.id) : [])

/** History = everything that is not sitting on the owner's desk. */
const history = computed(() => {
  const rest = allTasks.value.filter(t => t.ownerApprovalStatus !== 'pending')
  if (filter.value === 'active')
    return rest.filter(t => t.status !== 'done' && t.status !== 'canceled')
  if (filter.value === 'completed')
    return rest.filter(t => t.status === 'done')
  return rest
})

const inProgressCount = computed(() =>
  allTasks.value.filter(t => t.status === 'in progress').length)

/** What the owner has actually been charged this calendar year. */
const spentThisYear = computed(() => {
  const year = String(new Date().getFullYear())
  return allTasks.value
    .filter(t => t.finalInvoiceAmount !== undefined && (t.createdAt ?? '').startsWith(year))
    .reduce((sum, t) => sum + (t.finalInvoiceAmount ?? 0), 0)
})

const filters: Array<{ value: Filter, label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
]

function fmtIdr(amount: number | undefined): string {
  return amount === undefined ? '—' : `IDR ${amount.toLocaleString('id-ID')}`
}

function fmtDate(iso: string | undefined): string {
  if (!iso)
    return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** The task statuses the rest of the app uses, plus the two outcomes only an
 * owner-approved task can reach. */
function state(task: Task): { label: string, tone: string } {
  if (task.ownerApprovalStatus === 'rejected')
    return { label: 'You declined', tone: 'bg-muted text-muted-foreground' }
  if (task.status === 'canceled')
    return { label: 'Cancelled', tone: 'bg-muted text-muted-foreground' }
  if (task.status === 'done')
    return { label: 'Completed', tone: 'bg-green-500/10 text-green-700 dark:text-green-300' }
  if (task.status === 'in progress')
    return { label: 'In progress', tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' }
  return { label: 'Not started', tone: 'bg-muted text-muted-foreground' }
}

/** Over/under the amount the owner agreed to. */
function variance(task: Task): { label: string, over: boolean } | null {
  if (task.finalInvoiceAmount === undefined || task.estimatedCost === undefined)
    return null
  const delta = task.finalInvoiceAmount - task.estimatedCost
  if (delta === 0)
    return null
  return { label: `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('id-ID')}`, over: delta > 0 }
}

/** Progress notes worth showing an owner — skip the internal chatter. */
function activity(task: Task): StatusUpdate[] {
  return [...(task.statusUpdates ?? [])].sort((a, b) => b.date.localeCompare(a.date))
}

function toggle(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id))
    next.delete(id)
  else next.add(id)
  expanded.value = next
}

function doApprove() {
  if (!approveTarget.value)
    return
  const result = ownerApprove(approveTarget.value.id, responseNote.value.trim() || undefined)
  if (result.ok) {
    toast.success('Approved — the team can start the work.')
    approveTarget.value = null
    responseNote.value = ''
  }
  else {
    toast.error('Could not approve this repair.')
  }
}

function doReject() {
  if (!rejectTarget.value)
    return
  const result = ownerReject(rejectTarget.value.id, responseNote.value.trim())
  if (result.ok) {
    toast.success('Declined — the team has been told why.')
    rejectTarget.value = null
    responseNote.value = ''
  }
  else {
    toast.error('Could not decline this repair.')
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">
        Maintenance
      </h1>
      <p class="text-sm text-muted-foreground">
        Repairs on your properties. Anything you are charged for needs your approval before work starts.
      </p>
    </header>

    <!-- The three things an owner wants at a glance -->
    <div class="grid gap-3 sm:grid-cols-3">
      <div
        class="rounded-lg border p-4"
        :class="needsApproval.length ? 'border-amber-500/40 bg-amber-500/5' : ''"
      >
        <p class="text-xs uppercase tracking-wide text-muted-foreground">
          Awaiting you
        </p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ needsApproval.length }}
        </p>
      </div>
      <div class="rounded-lg border p-4">
        <p class="text-xs uppercase tracking-wide text-muted-foreground">
          In progress
        </p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ inProgressCount }}
        </p>
      </div>
      <div class="rounded-lg border p-4">
        <p class="text-xs uppercase tracking-wide text-muted-foreground">
          Charged this year
        </p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ fmtIdr(spentThisYear) }}
        </p>
      </div>
    </div>

    <!-- Needs a decision — first, and impossible to miss -->
    <section v-if="needsApproval.length" class="space-y-3">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <Icon name="lucide:circle-alert" class="size-4 text-amber-600 dark:text-amber-400" />
        Needs your approval
      </h2>

      <div
        v-for="task in needsApproval"
        :key="task.id"
        class="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-4"
      >
        <div class="space-y-1">
          <p class="font-medium leading-snug">
            {{ task.title }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ task.listing }} · reported {{ fmtDate(task.createdAt) }}
          </p>
        </div>

        <p v-if="task.description" class="text-sm text-muted-foreground">
          {{ task.description }}
        </p>

        <div class="flex items-baseline justify-between gap-3 rounded-md border bg-background px-3 py-2.5">
          <span class="text-sm text-muted-foreground">You would be charged</span>
          <span class="text-lg font-semibold tabular-nums">{{ fmtIdr(task.estimatedCost) }}</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button size="sm" @click="approveTarget = task; responseNote = ''">
            <Icon name="lucide:check" class="mr-1.5 size-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="outline" @click="rejectTarget = task; responseNote = ''">
            Decline
          </Button>
        </div>
      </div>
    </section>

    <!-- History -->
    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-semibold">
          Repair history
        </h2>
        <div class="flex gap-1 rounded-md border p-0.5">
          <button
            v-for="option in filters"
            :key="option.value"
            class="rounded px-2.5 py-1 text-xs transition-colors"
            :class="filter === option.value ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="filter = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div v-if="!history.length" class="rounded-lg border border-dashed p-8 text-center">
        <Icon name="lucide:wrench" class="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
        <p class="mt-3 text-sm text-muted-foreground">
          {{ filter === 'all'
            ? 'No repairs recorded on your properties yet.'
            : 'Nothing here right now.' }}
        </p>
      </div>

      <div
        v-for="task in history"
        :key="task.id"
        class="rounded-lg border p-4 space-y-3"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0 space-y-1">
            <p class="font-medium leading-snug">
              {{ task.title }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ task.listing }} · {{ fmtDate(task.createdAt) }}
            </p>
          </div>
          <Badge variant="outline" class="border-transparent" :class="state(task).tone">
            {{ state(task).label }}
          </Badge>
        </div>

        <!-- Money, only when there is any -->
        <div
          v-if="task.estimatedCost !== undefined || task.finalInvoiceAmount !== undefined"
          class="grid gap-x-6 gap-y-1 rounded-md bg-muted/40 px-3 py-2.5 text-sm sm:grid-cols-2"
        >
          <div v-if="task.estimatedCost !== undefined" class="flex justify-between gap-3">
            <span class="text-muted-foreground">You approved</span>
            <span class="tabular-nums">{{ fmtIdr(task.estimatedCost) }}</span>
          </div>
          <div v-if="task.finalInvoiceAmount !== undefined" class="flex justify-between gap-3">
            <span class="text-muted-foreground">Actually charged</span>
            <span class="font-medium tabular-nums">
              {{ fmtIdr(task.finalInvoiceAmount) }}
              <span
                v-if="variance(task)"
                class="ml-1 text-xs"
                :class="variance(task)!.over ? 'text-destructive' : 'text-green-600 dark:text-green-400'"
              >
                ({{ variance(task)!.label }})
              </span>
            </span>
          </div>
        </div>

        <div v-if="task.receipt" class="flex items-center gap-2 text-sm">
          <Icon name="lucide:receipt" class="size-4 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate text-xs">{{ task.receipt.fileName }}</span>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs"
            @click="toast.info(`${task.receipt!.fileName} — receipt files are not stored in this demo.`)"
          >
            View receipt
          </Button>
        </div>

        <p v-if="task.ownerApprovalNote" class="text-xs italic text-muted-foreground">
          Your note: &ldquo;{{ task.ownerApprovalNote }}&rdquo;
        </p>

        <!-- What happened, on demand -->
        <div v-if="activity(task).length" class="border-t pt-2">
          <button
            class="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            :aria-expanded="expanded.has(task.id)"
            @click="toggle(task.id)"
          >
            <Icon
              :name="expanded.has(task.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'"
              class="size-3.5"
            />
            {{ expanded.has(task.id) ? 'Hide' : 'Show' }} what happened
          </button>

          <ul v-if="expanded.has(task.id)" class="mt-2 space-y-2">
            <li v-for="(entry, idx) in activity(task)" :key="idx" class="flex gap-2 text-xs">
              <span class="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <div class="min-w-0 space-y-0.5">
                <p class="text-muted-foreground">
                  <span v-if="entry.actor" class="font-medium text-foreground">{{ entry.actor.name }}</span>
                  <span v-if="entry.actor">&nbsp;</span>{{ entry.note }}
                </p>
                <p class="text-muted-foreground/70">
                  {{ fmtDate(entry.date) }}
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <Dialog :open="!!approveTarget" @update:open="(v: boolean) => { if (!v) approveTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve this repair?</DialogTitle>
          <DialogDescription>
            {{ approveTarget?.title }} at {{ approveTarget?.listing }}.
            You will be charged {{ fmtIdr(approveTarget?.estimatedCost) }}, and you will see the receipt once the work is done.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="approve-note">Note for the team (optional)</Label>
          <Textarea id="approve-note" v-model="responseNote" placeholder="Anything they should know" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="approveTarget = null">
            Cancel
          </Button>
          <Button @click="doApprove">
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!rejectTarget" @update:open="(v: boolean) => { if (!v) rejectTarget = null }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decline this repair</DialogTitle>
          <DialogDescription>
            {{ rejectTarget?.title }} at {{ rejectTarget?.listing }}.
            The work will not go ahead. Tell the team why so they can come back with something else.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="reject-note">Reason</Label>
          <Textarea id="reject-note" v-model="responseNote" placeholder="e.g. Please get a second quote first" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="rejectTarget = null">
            Cancel
          </Button>
          <Button variant="destructive" :disabled="!responseNote.trim()" @click="doReject">
            Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
