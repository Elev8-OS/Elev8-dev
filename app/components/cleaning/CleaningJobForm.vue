<script setup lang="ts">
import type { CleaningJob, CleaningJobInput, CleaningJobPriority, CleaningJobRecurrence, CleaningJobSource, CleaningJobStatus } from '~/components/cleaning/data/cleaning-jobs'
import { cleanerOptions, cleaningJobSourceLabels, cleaningJobStatusLabels } from '~/components/cleaning/data/cleaning-jobs'
import { listings } from '~/components/listings/data/listings'
import GuestInfoCard from '~/components/operations-calendar/GuestInfoCard.vue'
import ListingPicker from '~/components/operations-calendar/ListingPicker.vue'

const props = withDefaults(defineProps<{
  modelValue?: Partial<CleaningJob> | null
  defaultListingId?: string | null
  defaultListingName?: string | null
  defaultScheduledAt?: string | null
  defaultScheduledAtTo?: string | null
  mode?: 'create' | 'edit'
}>(), {
  modelValue: null,
  defaultListingId: null,
  defaultListingName: null,
  defaultScheduledAt: null,
  defaultScheduledAtTo: null,
  mode: 'edit',
})

const emit = defineEmits<{
  save: [job: CleaningJobInput]
  cancel: []
}>()

const isCreate = computed(() => props.mode === 'create')

// --- Date + time helpers ---
const DEFAULT_START_TIME = '11:00'
const DEFAULT_DURATION_MINUTES = 120

function ensureDateTime(value: string) {
  if (!value)
    return { date: '', time: '' }
  const date = value.slice(0, 10)
  const hasTime = value.includes('T') && value.length >= 16
  const time = hasTime ? value.slice(11, 16) : ''
  return { date, time }
}

function buildScheduledAt(date: string, time: string) {
  if (!date)
    return ''
  if (!time)
    return `${date}T${DEFAULT_START_TIME}:00+08:00`
  return `${date}T${time}:00+08:00`
}

function diffMinutes(from: string, to: string) {
  if (!from || !to)
    return 0
  const [fh, fm] = from.split(':').map(Number)
  const [th, tm] = to.split(':').map(Number)
  if (fh === undefined || fm === undefined || th === undefined || tm === undefined)
    return 0
  const fromMins = fh * 60 + fm
  const toMins = th * 60 + tm
  return Math.max(0, toMins - fromMins)
}

// --- Form state ---
const form = reactive<CleaningJobInput>({
  listingId: props.modelValue?.listingId ?? props.defaultListingId ?? '',
  listingName: props.modelValue?.listingName ?? props.defaultListingName ?? '',
  scheduledAt: props.modelValue?.scheduledAt ?? props.defaultScheduledAt ?? '',
  cleanerIds: props.modelValue?.cleanerIds ?? [],
  cleanerNames: props.modelValue?.cleanerNames ?? [],
  teamName: props.modelValue?.teamName ?? 'Housekeeping',
  status: (props.modelValue?.status ?? 'scheduled') as CleaningJobStatus,
  priority: (props.modelValue?.priority ?? 'normal') as CleaningJobPriority,
  durationMinutes: props.modelValue?.durationMinutes ?? DEFAULT_DURATION_MINUTES,
  notes: props.modelValue?.notes ?? '',
  source: (props.modelValue?.source ?? 'manual') as CleaningJobSource,
  reservationId: props.modelValue?.reservationId ?? null,
  recurrence: props.modelValue?.recurrence ?? null,
})

const recurrenceEnabled = ref(Boolean(props.modelValue?.recurrence?.enabled))
const recurrenceFrequency = ref<CleaningJobRecurrence['frequency']>(props.modelValue?.recurrence?.frequency ?? 'weekly')
const recurrenceInterval = ref(props.modelValue?.recurrence?.interval ?? 1)

function resetRecurrenceFields() {
  recurrenceFrequency.value = 'weekly'
  recurrenceInterval.value = 1
}

function onRecurrenceToggle(value: boolean) {
  recurrenceEnabled.value = value
  if (!value)
    resetRecurrenceFields()
}

// --- Date + time derived state ---
const initialDateTime = ensureDateTime(props.modelValue?.scheduledAt ?? props.defaultScheduledAt ?? '')
const cleaningDate = ref<string>(initialDateTime.date)
const cleaningTimeEnabled = ref<boolean>(Boolean(initialDateTime.time))
const cleaningTimeFrom = ref<string>(initialDateTime.time || DEFAULT_START_TIME)
const cleaningTimeTo = ref<string>(props.defaultScheduledAtTo ? ensureDateTime(props.defaultScheduledAtTo).time : '')

// --- Housekeeping picker ---
const cleanerPickerOpen = ref(false)
const cleanerSearch = ref('')

const filteredCleanerOptions = computed(() => {
  if (!cleanerSearch.value.trim())
    return cleanerOptions
  const q = cleanerSearch.value.toLowerCase()
  return cleanerOptions.filter(c =>
    c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q),
  )
})

const cleanerDisplayLabel = computed(() => {
  if (!form.cleanerIds.length)
    return 'Assign housekeeping'
  return resolveCleanerNames(form.cleanerIds)
    .map((name, idx) => {
      const opt = cleanerOptions.find(c => c.name === name)
      return opt ? `${name} · ${opt.role}` : name
    })
    .join(', ')
})

function resolveCleanerNames(ids: string[]) {
  return ids
    .map(id => cleanerOptions.find(option => option.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}

function toggleCleaner(cleanerId: string) {
  if (form.cleanerIds.includes(cleanerId)) {
    form.cleanerIds = form.cleanerIds.filter(id => id !== cleanerId)
  }
  else {
    form.cleanerIds = [...form.cleanerIds, cleanerId]
  }
  form.cleanerNames = resolveCleanerNames(form.cleanerIds)
}

function clearStaff() {
  form.cleanerIds = []
  form.cleanerNames = []
}

// --- Priority toggle ---
const isHighPriority = computed<boolean>({
  get: () => form.priority === 'high',
  set: value => { form.priority = value ? 'high' : 'normal' },
})

// --- Required validation ---
const isValidTimeRange = computed(() => {
  if (!cleaningTimeEnabled.value)
    return true
  if (!cleaningTimeFrom.value)
    return false
  if (!cleaningTimeTo.value)
    return true
  return diffMinutes(cleaningTimeFrom.value, cleaningTimeTo.value) > 0
})

const canSubmit = computed(() =>
  Boolean(form.listingId)
  && Boolean(cleaningDate.value)
  && form.cleanerIds.length > 0
  && isValidTimeRange.value,
)

// --- Sync scheduledAt + duration from date/time pickers ---
function syncScheduledAt() {
  if (!cleaningDate.value) {
    form.scheduledAt = ''
    return
  }
  if (!cleaningTimeEnabled.value) {
    form.scheduledAt = `${cleaningDate.value}T${DEFAULT_START_TIME}:00+08:00`
    return
  }
  form.scheduledAt = buildScheduledAt(cleaningDate.value, cleaningTimeFrom.value)
  if (cleaningTimeTo.value) {
    const mins = diffMinutes(cleaningTimeFrom.value, cleaningTimeTo.value)
    if (mins > 0)
      form.durationMinutes = mins
  }
}

watch([cleaningDate, cleaningTimeEnabled, cleaningTimeFrom, cleaningTimeTo], syncScheduledAt)

// --- Existing watchers ---
watch(() => form.listingId, (listingId) => {
  if (!listingId)
    return
  const listing = listings.value.find(item => item.id === listingId)
  if (listing) {
    form.listingName = listing.name
  }
}, { immediate: true })

watch(() => props.modelValue, (next) => {
  if (!next)
    return
  form.listingId = next.listingId ?? props.defaultListingId ?? ''
  form.listingName = next.listingName ?? props.defaultListingName ?? ''
  form.scheduledAt = next.scheduledAt ?? props.defaultScheduledAt ?? ''
  form.cleanerIds = next.cleanerIds ?? []
  form.cleanerNames = next.cleanerNames ?? []
  form.teamName = next.teamName ?? 'Housekeeping'
  form.status = (next.status ?? 'scheduled') as CleaningJobStatus
  form.priority = (next.priority ?? 'normal') as CleaningJobPriority
  form.durationMinutes = next.durationMinutes ?? DEFAULT_DURATION_MINUTES
  form.notes = next.notes ?? ''
  form.source = (next.source ?? 'manual') as CleaningJobSource
  form.reservationId = next.reservationId ?? null
  recurrenceEnabled.value = Boolean(next.recurrence?.enabled)
  recurrenceFrequency.value = next.recurrence?.frequency ?? 'weekly'
  recurrenceInterval.value = next.recurrence?.interval ?? 1

  const dt = ensureDateTime(next.scheduledAt ?? '')
  cleaningDate.value = dt.date
  cleaningTimeEnabled.value = Boolean(dt.time)
  cleaningTimeFrom.value = dt.time || DEFAULT_START_TIME
  cleaningTimeTo.value = ''
}, { immediate: true })

const recurrenceModel = computed<CleaningJobRecurrence | null>(() => recurrenceEnabled.value
  ? {
      enabled: true,
      frequency: recurrenceFrequency.value,
      interval: recurrenceInterval.value,
    }
  : null)

function submit() {
  emit('save', {
    ...form,
    teamName: 'Housekeeping',
    recurrence: recurrenceModel.value,
  })
}
</script>

<template>
  <div class="grid gap-4">
    <p class="text-xs text-muted-foreground">
      Fields marked with <span class="text-destructive">*</span> are required.
    </p>

    <div class="grid gap-1.5">
      <Label>Listing <span class="text-destructive">*</span></Label>
      <ListingPicker
        v-model="form.listingId"
        v-model:listing-name="form.listingName"
        placeholder="Choose a listing"
      />
      <Input v-if="!isCreate" v-model="form.listingName" placeholder="Listing name" class="mt-2" />
      <GuestInfoCard v-if="form.listingId" :listing-id="form.listingId" :target-date="cleaningDate" />
    </div>

    <div class="grid gap-1.5">
      <Label>Date <span class="text-destructive">*</span></Label>
      <Input v-model="cleaningDate" type="date" />
    </div>

    <div class="grid gap-1.5 rounded-md border p-3">
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-sm font-medium leading-tight">Set time cleaning</span>
          <span class="text-xs text-muted-foreground">Specify the From/To window for this cleaning</span>
        </div>
        <Switch v-model="cleaningTimeEnabled" />
      </div>
      <div v-if="cleaningTimeEnabled" class="mt-2 grid gap-3 md:grid-cols-2">
        <div class="grid gap-1.5">
          <Label class="text-xs uppercase tracking-wide text-muted-foreground">From <span class="text-destructive">*</span></Label>
          <Input v-model="cleaningTimeFrom" type="time" />
        </div>
        <div class="grid gap-1.5">
          <Label class="text-xs uppercase tracking-wide text-muted-foreground">To</Label>
          <Input v-model="cleaningTimeTo" type="time" />
        </div>
      </div>
    </div>

    <div class="grid gap-1.5">
      <Label>Housekeeping <span class="text-destructive">*</span></Label>
      <Popover v-model:open="cleanerPickerOpen">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            :class="[
              'h-9 w-full justify-start gap-1.5 px-3 text-sm font-normal',
              !form.cleanerIds.length ? 'text-muted-foreground' : '',
            ]"
          >
            <Icon name="lucide:brush-cleaning" class="h-4 w-4 shrink-0 text-muted-foreground" />
            <span class="flex-1 truncate text-left">{{ cleanerDisplayLabel }}</span>
            <Icon name="lucide:chevrons-up-down" class="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-72 p-0" align="start" :side-offset="4">
          <div class="flex items-center gap-2 border-b px-3 py-2">
            <Icon name="lucide:search" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              v-model="cleanerSearch"
              class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search staff…"
            >
            <button v-if="cleanerSearch" class="shrink-0 text-muted-foreground hover:text-foreground" @click="cleanerSearch = ''">
              <Icon name="lucide:x" class="h-3.5 w-3.5" />
            </button>
          </div>
          <ScrollArea class="h-56">
            <div class="p-1">
              <template v-if="filteredCleanerOptions.length > 0">
                <button
                  v-for="cleaner in filteredCleanerOptions"
                  :key="cleaner.id"
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  :class="form.cleanerIds.includes(cleaner.id) ? 'bg-accent' : ''"
                  @click="toggleCleaner(cleaner.id)"
                >
                  <div
                    class="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border" :class="[
                      form.cleanerIds.includes(cleaner.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    ]"
                  >
                    <Icon v-if="form.cleanerIds.includes(cleaner.id)" name="lucide:check" class="h-3 w-3" />
                  </div>
                  <div class="flex min-w-0 flex-col text-left">
                    <span class="truncate text-sm leading-tight">{{ cleaner.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ cleaner.role }}</span>
                  </div>
                </button>
              </template>
              <p v-else class="py-6 text-center text-sm text-muted-foreground">
                No staff found
              </p>
            </div>
          </ScrollArea>
          <div v-if="form.cleanerIds.length" class="flex items-center justify-between border-t px-3 py-2">
            <span class="text-xs text-muted-foreground">{{ form.cleanerIds.length }} selected</span>
            <button class="text-xs text-muted-foreground hover:text-foreground" @click="clearStaff">
              Clear
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <div class="grid gap-1.5" :class="isCreate ? 'md:grid-cols-1' : 'md:grid-cols-3'">
      <div v-if="!isCreate" class="grid gap-1.5">
        <Label>Status</Label>
        <Select :model-value="form.status" @update:model-value="value => { form.status = value as CleaningJobStatus }">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="([value, label]) in Object.entries(cleaningJobStatusLabels)" :key="value" :value="value">
              {{ label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="grid gap-1.5">
        <Label>Priority</Label>
        <div class="flex items-center justify-between rounded-md border p-3 bg-background">
          <div class="flex flex-col">
            <span class="text-sm font-medium leading-tight">High priority</span>
            <span class="text-xs text-muted-foreground">Flag this cleaning as urgent</span>
          </div>
          <Switch v-model="isHighPriority" />
        </div>
      </div>
      <div v-if="!isCreate" class="grid gap-1.5">
        <Label>Source</Label>
        <Select :model-value="form.source" @update:model-value="value => { form.source = value as CleaningJobSource }">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="([value, label]) in Object.entries(cleaningJobSourceLabels)" :key="value" :value="value">
              {{ label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="rounded-lg border bg-muted/30 p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium">
            Recurrence
          </p>
          <p class="text-xs text-muted-foreground">
            Repeat this cleaning on a weekly or monthly cadence.
          </p>
          <p v-if="!isCreate && recurrenceEnabled" class="mt-1 text-xs text-muted-foreground">
            Saving will overwrite the existing recurrence on this cleaning job.
          </p>
        </div>
        <Switch :model-value="recurrenceEnabled" @update:model-value="onRecurrenceToggle" />
      </div>
      <div v-if="recurrenceEnabled" class="mt-4 grid gap-3 md:grid-cols-2">
        <div class="grid gap-1.5">
          <Label>Frequency</Label>
          <Select :model-value="recurrenceFrequency" @update:model-value="value => { recurrenceFrequency = value as CleaningJobRecurrence['frequency'] }">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">
                Weekly
              </SelectItem>
              <SelectItem value="monthly">
                Monthly
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-1.5">
          <Label>Interval</Label>
          <Input v-model.number="recurrenceInterval" type="number" min="1" step="1" />
        </div>
      </div>
    </div>

    <div class="flex items-center justify-end gap-2 pt-2">
      <Button variant="outline" @click="emit('cancel')">
        Cancel
      </Button>
      <Button :disabled="!canSubmit" @click="submit">
        Save Cleaning Job
      </Button>
    </div>
  </div>
</template>
