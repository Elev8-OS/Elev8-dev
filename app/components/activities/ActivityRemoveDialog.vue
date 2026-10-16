<script setup lang="ts">
import type { ActivityLog } from '~/components/activities/data/activities'
import { toast } from 'vue-sonner'
import { formatDuration, logPlace } from '~/components/activities/data/activities'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { useActivityReport } from '~/composables/useActivityReport'

const props = defineProps<{ log: ActivityLog | null }>()
const open = defineModel<boolean>('open', { default: false })

const { removeLog } = useActivityReport()

function confirm() {
  if (!props.log)
    return
  removeLog(props.log.id)
  toast.success('Activity deleted')
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
        <AlertDialogDescription>
          <template v-if="log">
            "{{ log.title }}" at {{ logPlace(log) }} ({{ formatDuration(log.durationMinutes) }}) will be removed from the time tracked. This cannot be undone.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="confirm">
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
