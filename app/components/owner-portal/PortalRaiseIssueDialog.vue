<script setup lang="ts">
// The owner's side of a statement dispute: raise one, then follow it.
//
// The dialog has two faces, decided by whether the line already has an open
// issue. With one open it is a conversation (what was said, what Finance
// answered, a reply box) and the new-issue form is withheld, which is what
// enforces "one open issue per line" in the UI. With none it is the form,
// with any resolved issues on that line listed above it as history so the
// owner can see a question was already answered before asking it again.

import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

const props = defineProps<{
  statementId: string
  lineId: string
  lineLabel: string
  amount: number
}>()

const open = defineModel<boolean>('open', { default: false })
const note = ref('')
const reply = ref('')
const error = ref('')

const { issues, raiseIssue, addIssueMessage } = useOwnerStatements()

const lineIssues = computed(() => issues.value.filter(issue => issue.statementId === props.statementId
  && issue.lineId === props.lineId))

const existingIssue = computed(() => lineIssues.value.find(issue => !issue.resolvedAt) ?? null)
const resolvedIssues = computed(() => lineIssues.value
  .filter(issue => issue.resolvedAt)
  .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')))

const thread = computed(() => existingIssue.value?.thread ?? [])

watch(open, (isOpen) => {
  if (isOpen) {
    note.value = ''
    reply.value = ''
    error.value = ''
  }
})

function formatDate(iso?: string) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function close() {
  open.value = false
}

function sendReply() {
  const message = reply.value.trim()
  const current = existingIssue.value
  if (!message || !current)
    return
  const result = addIssueMessage(current.id, 'owner', message)
  if (!result.ok) {
    error.value = 'This issue is no longer available.'
    return
  }
  reply.value = ''
  toast.success('Reply sent to Finance.')
}

function submit() {
  if (existingIssue.value) {
    return
  }

  const description = note.value.trim()
  if (!description) {
    error.value = 'Add a note before submitting the issue.'
    return
  }

  const result = raiseIssue({
    statementId: props.statementId,
    lineId: props.lineId,
    description,
    amount: props.amount,
  })

  if (!result.ok) {
    error.value = 'This statement line is no longer available.'
    return
  }

  if (result.existing) {
    return
  }

  toast.success('Issue raised. Finance has been notified.')
  close()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ existingIssue ? 'Your open issue' : 'Raise an issue' }}</DialogTitle>
        <DialogDescription>
          <template v-if="existingIssue">
            Finance is reviewing “{{ lineLabel }}”. You can follow up here.
          </template>
          <template v-else>
            Tell Finance what needs reviewing on “{{ lineLabel }}”.
          </template>
        </DialogDescription>
      </DialogHeader>

      <div v-if="existingIssue" class="space-y-4" data-testid="existing-issue" role="status">
        <div class="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <p class="font-medium">
            An issue is already open for this line.
          </p>
          <p class="mt-1">
            {{ existingIssue.description }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            Raised {{ formatDate(existingIssue.createdAt) }}
          </p>
        </div>

        <div class="space-y-2">
          <p v-if="thread.length === 0" class="text-sm text-muted-foreground">
            No reply from Finance yet.
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
                {{ message.author === 'staff' ? 'Finance' : 'You' }}
              </span>
              <span class="text-xs text-muted-foreground">{{ formatDate(message.at) }}</span>
            </div>
            <p class="mt-1 text-sm">
              {{ message.message }}
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="issue-reply">Reply</Label>
          <Textarea
            id="issue-reply"
            v-model="reply"
            data-testid="issue-reply"
            placeholder="Add anything Finance should know…"
            rows="2"
          />
        </div>
      </div>

      <div v-else class="space-y-4">
        <div v-if="resolvedIssues.length > 0" class="space-y-2" data-testid="resolved-issues">
          <p class="text-sm font-medium">
            Previously resolved on this line
          </p>
          <div v-for="issue in resolvedIssues" :key="issue.id" class="rounded-md border p-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <Badge variant="secondary">
                {{ issue.resolution?.type === 'adjusted' ? 'Adjusted' : 'Explained' }}
              </Badge>
              <span class="text-xs text-muted-foreground">{{ formatDate(issue.resolvedAt) }}</span>
            </div>
            <p class="mt-2 text-muted-foreground">
              {{ issue.description }}
            </p>
            <p v-if="issue.resolution?.note" class="mt-1">
              {{ issue.resolution.note }}
            </p>
            <p v-if="issue.resolution?.adjustmentId" class="mt-1 text-xs text-muted-foreground">
              A correction was filed and appears on a later statement.
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="issue-note">Note</Label>
          <Textarea
            id="issue-note"
            v-model="note"
            data-testid="issue-note"
            placeholder="Describe the discrepancy or question…"
            :aria-invalid="Boolean(error)"
            aria-describedby="issue-note-help issue-note-error"
          />
          <p id="issue-note-help" class="text-xs text-muted-foreground">
            This note will be attached to the selected statement line.
          </p>
        </div>
      </div>

      <p v-if="error" id="issue-note-error" class="text-sm text-destructive" role="alert">
        {{ error }}
      </p>

      <DialogFooter>
        <Button variant="outline" @click="close">
          Close
        </Button>
        <Button
          v-if="existingIssue"
          data-testid="send-issue-reply"
          :disabled="!reply.trim()"
          @click="sendReply"
        >
          Send reply
        </Button>
        <Button
          v-else
          data-testid="submit-issue"
          :disabled="!note.trim()"
          @click="submit"
        >
          Submit issue
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
