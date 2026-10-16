<script setup lang="ts">
import type { ActivityLogType, FinishedWork } from '~/components/activities/data/activities'
import type { CleaningType } from '~/components/operations-calendar/data/operations-calendar'
import { toast } from 'vue-sonner'
import { activityLogTypeMeta, CLEANING_LOG_TYPES, formatDuration, toLocalDateKey } from '~/components/activities/data/activities'
import { cleaningTypeLabels } from '~/components/operations-calendar/data/operations-calendar'
import ListingPicker from '~/components/operations-calendar/ListingPicker.vue'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { useActivityReport } from '~/composables/useActivityReport'

const props = defineProps<{
  userId: string
  name: string
  defaultDate?: string
  /** Finished cleaning jobs and tasks of this person that no log covers yet. */
  work?: FinishedWork[]
  /** Open with this one already linked (from the "Finished but not logged" list). */
  initialWork?: FinishedWork | null
}>()
const open = defineModel<boolean>('open', { default: false })

const { addLog, listingsFor, loggableTypesFor, earliestDate } = useActivityReport()

const listingOptions = computed(() => listingsFor(props.userId))
// Cleaning is only offered to housekeeping roles.
const typeOptions = computed(() => loggableTypesFor(props.userId))
const today = computed(() => toLocalDateKey(new Date()))

const type = ref<ActivityLogType>('task')
const title = ref('')
// A cleaning is filed under a kind of cleaning instead of a typed title.
const cleaningType = ref<CleaningType>('check_out')
const listingId = ref('')
const unitId = ref<string | null>(null)
const date = ref(today.value)
const hours = ref('0')
const minutes = ref('30')
const notes = ref('')

// Linking: a log can be the time for one finished cleaning job or task. Picking one fills the form from it.
const NO_LINK = 'none'
const workKey = (w: FinishedWork) => `${w.kind}:${w.id}`
const linkKey = ref(NO_LINK)
const workOptions = computed(() => (props.work ?? []).filter(w => w.type === type.value))
const linked = computed(() => (props.work ?? []).find(w => workKey(w) === linkKey.value))

function fillFrom(w: FinishedWork) {
  type.value = w.type
  if (w.cleaningType)
    cleaningType.value = w.cleaningType
  if (w.type === 'task')
    title.value = w.title
  listingId.value = w.listingId
  unitId.value = w.unitId ?? null
  date.value = w.date
  if (w.minutes) {
    hours.value = String(Math.floor(w.minutes / 60))
    minutes.value = String(w.minutes % 60)
  }
}

watch(linkKey, () => {
  if (linked.value)
    fillFrom(linked.value)
})

// Changing the type drops a link that no longer fits.
watch(type, (t) => {
  if (linked.value && linked.value.type !== t)
    linkKey.value = NO_LINK
})

watch(open, (isOpen) => {
  if (!isOpen)
    return
  linkKey.value = NO_LINK
  type.value = typeOptions.value.includes('task') ? 'task' : typeOptions.value[0]!
  title.value = ''
  cleaningType.value = 'check_out'
  listingId.value = listingOptions.value[0]?.id ?? ''
  unitId.value = null
  date.value = props.defaultDate && props.defaultDate <= today.value ? props.defaultDate : today.value
  hours.value = '0'
  minutes.value = '30'
  notes.value = ''
  if (props.initialWork) {
    // Set the key after the form is reset, so the fill is not undone.
    linkKey.value = workKey(props.initialWork)
    fillFrom(props.initialWork)
  }
})

const total = computed(() => Number.parseInt(hours.value, 10) * 60 + Number.parseInt(minutes.value, 10))
const timeValid = computed(() => {
  const h = Number.parseInt(hours.value, 10)
  const m = Number.parseInt(minutes.value, 10)
  return Number.isInteger(h) && h >= 0 && Number.isInteger(m) && m >= 0 && m < 60 && total.value > 0
})
// A linked job can be older than the report, and its listing may not be one the person is assigned to.
const minDate = computed(() => [earliestDate.value, linked.value?.date].filter((d): d is string => !!d).sort()[0])
const pickerIds = computed(() => [...listingOptions.value.map(l => l.id), ...(linked.value ? [linked.value.listingId] : [])])
const dateValid = computed(() => !!date.value && date.value <= today.value && (!minDate.value || date.value >= minDate.value))
const isCleaning = computed(() => type.value === 'cleaning')
const valid = computed(() => typeOptions.value.includes(type.value) && (isCleaning.value || !!title.value.trim()) && pickerIds.value.includes(listingId.value) && timeValid.value && dateValid.value)

function save() {
  if (!valid.value)
    return
  addLog({ userId: props.userId, listingId: listingId.value, unitId: unitId.value, type: type.value, cleaningType: isCleaning.value ? cleaningType.value : undefined, cleaningJobId: linked.value?.kind === 'cleaning_job' ? linked.value.id : undefined, taskId: linked.value?.kind === 'task' ? linked.value.id : undefined, title: title.value, date: date.value, durationMinutes: total.value, notes: notes.value })
  toast.success('Activity added')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Add activity</DialogTitle>
        <DialogDescription>Add time {{ name }} forgot to log. It is marked as added by a manager and kept in the change history.</DialogDescription>
      </DialogHeader>

      <!-- min-w-0: a dialog is a grid, and a long listing label would otherwise stretch every row past the box. -->
      <div class="min-w-0 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="add-type">Type</Label>
            <Select v-model="type">
              <SelectTrigger id="add-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in typeOptions" :key="t" :value="t">
                  {{ activityLogTypeMeta[t].label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="add-date">Day</Label>
            <Input id="add-date" v-model="date" type="date" :min="minDate" :max="today" />
          </div>
        </div>

        <div v-if="workOptions.length || linked" class="min-w-0 space-y-2">
          <Label for="add-link">{{ isCleaning ? 'Finished cleaning job' : 'Completed task' }}</Label>
          <Select v-model="linkKey">
            <SelectTrigger id="add-link" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NO_LINK">
                Not linked to a {{ isCleaning ? 'job' : 'task' }}
              </SelectItem>
              <SelectItem v-for="w in workOptions" :key="workKey(w)" :value="workKey(w)">
                {{ w.title }} · {{ w.listingName }} · {{ w.date }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="linked" class="text-xs text-muted-foreground">
            {{ linked.minutes ? `Filled in from the job's report (${formatDuration(linked.minutes)}). Check the time before you add it.` : 'Filled in from the completed task. A task has no recorded time, so enter it.' }}
            This log will be the time for it, so it is not offered again.
          </p>
        </div>

        <div v-if="isCleaning" class="space-y-2">
          <Label for="add-cleaning-type">Cleaning type</Label>
          <Select v-model="cleaningType">
            <SelectTrigger id="add-cleaning-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in CLEANING_LOG_TYPES" :key="c" :value="c">
                {{ cleaningTypeLabels[c] }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-else class="space-y-2">
          <Label for="add-title">What was done</Label>
          <Input id="add-title" v-model="title" maxlength="80" placeholder="Reviewed guest feedback" />
        </div>

        <div class="min-w-0 space-y-2">
          <Label>Listing and room</Label>
          <ListingPicker
            v-model="listingId"
            v-model:unit-id="unitId"
            pick-rooms
            in-dialog
            placeholder="Choose a listing"
            :restrict-to-ids="pickerIds"
          />
          <p v-if="!listingOptions.length" class="text-xs text-destructive">
            {{ name }} has no listings assigned.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="add-hours">Time</Label>
          <div class="flex items-end gap-2">
            <div class="w-24 space-y-1">
              <Input id="add-hours" v-model="hours" type="number" min="0" inputmode="numeric" class="text-center" />
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
          <p v-if="!timeValid" class="text-xs text-destructive">
            Enter more than 0 minutes, with minutes between 0 and 59.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="add-notes">Note (optional)</Label>
          <Textarea id="add-notes" v-model="notes" rows="2" placeholder="Why it was added..." />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!valid" @click="save">
          Add activity
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
