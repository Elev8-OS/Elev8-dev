<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
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
const error = ref('')
const existingIssue = computed(() => {
  const { issues } = useOwnerStatements()
  return issues.value.find(issue => issue.statementId === props.statementId
    && issue.lineId === props.lineId
    && !issue.resolvedAt) ?? null
})

watch(open, (isOpen) => {
  if (isOpen) {
    note.value = ''
    error.value = ''
  }
})

function close() {
  open.value = false
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

  const { raiseIssue } = useOwnerStatements()
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
        <DialogTitle>Raise an issue</DialogTitle>
        <DialogDescription>
          Tell Finance what needs reviewing on “{{ lineLabel }}”.
        </DialogDescription>
      </DialogHeader>

      <div v-if="existingIssue" class="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm" data-testid="existing-issue" role="status">
        <p class="font-medium">
          An issue is already open for this line.
        </p>
        <p class="mt-1 text-muted-foreground">
          Finance is reviewing the open issue. You can follow up from the existing
          issue instead of creating a duplicate. View it below or close this dialog.
        </p>
      </div>

      <div v-else class="space-y-2">
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
        <p v-if="error" id="issue-note-error" class="text-sm text-destructive" role="alert">
          {{ error }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="close">
          Close
        </Button>
        <Button
          v-if="!existingIssue"
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
