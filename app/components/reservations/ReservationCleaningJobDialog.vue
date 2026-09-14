<script setup lang="ts">
import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import DatePicker from '~/components/base/DatePicker.vue'
import TimePicker from '~/components/base/TimePicker.vue'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { useCleaningJobs } from '~/composables/useCleaningJobs'

const props = defineProps<{
  open: boolean
  reservation: ReservationEntry | null
  job?: CleaningJob | null
  cleanerOptions: { id: string, name: string }[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [jobId?: string]
}>()

const { createJob, updateJob } = useCleaningJobs()

const isEdit = computed(() => Boolean(props.job))

const cleaningDate = ref('')
const cleaningTime = ref('11:00')
const assigneeIds = ref<string[]>([])

function buildCleaningScheduledAt(date: string, time: string) {
  const [hours = '11', minutes = '00'] = time.split(':')
  const pad = (n: number | string) => String(n).padStart(2, '0')
  return `${date}T${pad(hours)}:${pad(minutes)}:00+08:00`
}

function initForm() {
  if (props.job) {
    cleaningDate.value = props.job.scheduledAt.slice(0, 10)
    const timePart = props.job.scheduledAt.slice(11, 16)
    cleaningTime.value = timePart || '11:00'
    assigneeIds.value = [...(props.job.cleanerIds || [])]
  }
  else {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    cleaningDate.value = tomorrow.toISOString().slice(0, 10)
    cleaningTime.value = '11:00'
    assigneeIds.value = []
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    initForm()
  }
}, { immediate: true })

watch(() => props.job, () => {
  if (props.open) {
    initForm()
  }
})

function handleSave() {
  if (!cleaningDate.value)
    return

  const assignees = props.cleanerOptions.filter(c => assigneeIds.value.includes(c.id))
  const scheduledAt = buildCleaningScheduledAt(cleaningDate.value, cleaningTime.value)

  if (isEdit.value && props.job) {
    updateJob(props.job.id, {
      scheduledAt,
      cleanerIds: assignees.map(c => c.id),
      cleanerNames: assignees.map(c => c.name),
    })
    toast.success('Cleaning updated')
    emit('saved', props.job.id)
  }
  else if (props.reservation) {
    createJob({
      listingId: props.reservation.listingId,
      listingName: props.reservation.listingName,
      scheduledAt,
      durationMinutes: 120,
      priority: 'normal',
      status: 'scheduled',
      cleanerIds: assignees.map(c => c.id),
      cleanerNames: assignees.map(c => c.name),
      source: 'custom',
      reservationId: props.reservation.id,
      recurrence: null,
    })
    toast.success('Cleaning scheduled')
    emit('saved')
  }

  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>
          {{ isEdit ? 'Edit scheduled cleaning' : 'Schedule cleaning' }}
        </DialogTitle>
        <DialogDescription>
          {{ isEdit
            ? 'Update the date, time, or assigned cleaners for this cleaning.'
            : 'Add a housekeeping job for this reservation.' }}
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-2">
        <div class="space-y-2">
          <Label>Date</Label>
          <DatePicker v-model="cleaningDate" placeholder="Pick date" />
        </div>
        <div class="space-y-2">
          <Label>Time</Label>
          <TimePicker v-model="cleaningTime" placeholder="Select time" />
        </div>
        <div class="space-y-1.5">
          <Label class="text-xs font-medium">Assignees (optional)</Label>
          <StaffMultiSelectDropdown
            v-model="assigneeIds"
            :options="cleanerOptions"
            placeholder="Search and select staff / cleaners..."
            title="Assign Cleaners"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button :disabled="!cleaningDate" @click="handleSave">
          {{ isEdit ? 'Save changes' : 'Schedule' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
