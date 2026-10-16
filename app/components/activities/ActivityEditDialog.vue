<script setup lang="ts">
import type { ActivityLog } from '~/components/activities/data/activities'
import { toast } from 'vue-sonner'
import { activityLogTypeMeta, logPlace } from '~/components/activities/data/activities'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useActivityReport } from '~/composables/useActivityReport'

const props = defineProps<{ log: ActivityLog | null }>()
const open = defineModel<boolean>('open', { default: false })

const { updateLog } = useActivityReport()

const hours = ref('0')
const minutes = ref('0')
const notes = ref('')

watch(() => [props.log, open.value] as const, ([log, isOpen]) => {
  if (!log || !isOpen)
    return
  hours.value = String(Math.floor(log.durationMinutes / 60))
  minutes.value = String(log.durationMinutes % 60)
  notes.value = log.notes ?? ''
}, { immediate: true })

const hoursNum = computed(() => Number.parseInt(hours.value, 10))
const minutesNum = computed(() => Number.parseInt(minutes.value, 10))
const valid = computed(() =>
  Number.isInteger(hoursNum.value) && hoursNum.value >= 0
  && Number.isInteger(minutesNum.value) && minutesNum.value >= 0 && minutesNum.value < 60)
const total = computed(() => valid.value ? hoursNum.value * 60 + minutesNum.value : 0)
const changed = computed(() => !!props.log && valid.value
  && (total.value !== props.log.durationMinutes || notes.value.trim() !== (props.log.notes ?? '')))

function save() {
  if (!props.log || !changed.value)
    return
  updateLog(props.log.id, { durationMinutes: total.value, notes: notes.value })
  toast.success('Activity updated')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit activity</DialogTitle>
        <DialogDescription>Correct the time that was logged. The day and listing stay as logged.</DialogDescription>
      </DialogHeader>

      <div v-if="log" class="space-y-4">
        <div class="rounded-lg border p-3">
          <div class="flex items-center gap-2 font-medium">
            <Icon :name="activityLogTypeMeta[log.type].icon" class="size-4 text-muted-foreground" />
            {{ log.title }}
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ logPlace(log) }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="activity-hours">Time</Label>
          <div class="flex items-end gap-2">
            <div class="w-24 space-y-1">
              <Input id="activity-hours" v-model="hours" type="number" min="0" inputmode="numeric" class="text-center" />
              <p class="text-center text-xs text-muted-foreground">
                Hours
              </p>
            </div>
            <span class="pb-6 text-lg">:</span>
            <div class="w-24 space-y-1">
              <Input v-model="minutes" type="number" min="0" max="59" inputmode="numeric" class="text-center" aria-label="Minutes" />
              <p class="text-center text-xs text-muted-foreground">
                Minutes
              </p>
            </div>
          </div>
          <p v-if="!valid" class="text-xs text-destructive">
            Enter whole hours and minutes between 0 and 59.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="activity-notes">Note (optional)</Label>
          <Textarea id="activity-notes" v-model="notes" rows="3" placeholder="Write a note..." />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!changed" @click="save">
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
