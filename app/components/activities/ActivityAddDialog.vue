<script setup lang="ts">
import type { ActivityLogType } from '~/components/activities/data/activities'
import type { CleaningType } from '~/components/operations-calendar/data/operations-calendar'
import { toast } from 'vue-sonner'
import { activityLogTypeMeta, CLEANING_LOG_TYPES, toLocalDateKey } from '~/components/activities/data/activities'
import { cleaningTypeLabels } from '~/components/operations-calendar/data/operations-calendar'
import ListingPicker from '~/components/operations-calendar/ListingPicker.vue'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { useActivityReport } from '~/composables/useActivityReport'

const props = defineProps<{ userId: string, name: string, defaultDate?: string }>()
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

watch(open, (isOpen) => {
  if (!isOpen)
    return
  type.value = typeOptions.value.includes('task') ? 'task' : typeOptions.value[0]!
  title.value = ''
  cleaningType.value = 'check_out'
  listingId.value = listingOptions.value[0]?.id ?? ''
  unitId.value = null
  date.value = props.defaultDate && props.defaultDate <= today.value ? props.defaultDate : today.value
  hours.value = '0'
  minutes.value = '30'
  notes.value = ''
})

const total = computed(() => Number.parseInt(hours.value, 10) * 60 + Number.parseInt(minutes.value, 10))
const timeValid = computed(() => {
  const h = Number.parseInt(hours.value, 10)
  const m = Number.parseInt(minutes.value, 10)
  return Number.isInteger(h) && h >= 0 && Number.isInteger(m) && m >= 0 && m < 60 && total.value > 0
})
const dateValid = computed(() => !!date.value && date.value <= today.value && (!earliestDate.value || date.value >= earliestDate.value))
const isCleaning = computed(() => type.value === 'cleaning')
const valid = computed(() => typeOptions.value.includes(type.value) && (isCleaning.value || !!title.value.trim()) && listingOptions.value.some(l => l.id === listingId.value) && timeValid.value && dateValid.value)

function save() {
  if (!valid.value)
    return
  addLog({ userId: props.userId, listingId: listingId.value, unitId: unitId.value, type: type.value, cleaningType: isCleaning.value ? cleaningType.value : undefined, title: title.value, date: date.value, durationMinutes: total.value, notes: notes.value })
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
            <Input id="add-date" v-model="date" type="date" :min="earliestDate" :max="today" />
          </div>
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
            :restrict-to-ids="listingOptions.map(l => l.id)"
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
