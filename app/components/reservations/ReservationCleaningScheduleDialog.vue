<script setup lang="ts">
import type { CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'
import type {
  CustomCleaningFrequency,
  DayOfWeek,
  ReservationCleaningSchedule,
  ReservationCleaningType,
} from '~/components/reservations/data/cleaning-schedule'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import DatePicker from '~/components/base/DatePicker.vue'
import TimePicker from '~/components/base/TimePicker.vue'
import { listings } from '~/components/listings/data/listings'
import {
  CLEANING_TYPE_OPTIONS,
  computeCleaningDates,
  DAY_OF_WEEK_OPTIONS,
  formatListingCleaningSummary,
  generateCleaningJobsForReservation,
  resolveDefaultCleaningSchedule,
} from '~/components/reservations/data/cleaning-schedule'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{
  open: boolean
  reservation: ReservationEntry | null
  cleanerOptions: { id: string, name: string }[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'applied': [schedule: ReservationCleaningSchedule]
  'cleared': []
}>()

const UNASSIGNED = 'unassigned'

const { applyReservationSchedule, clearReservationSchedule } = useCleaningJobs()
const { updateReservation } = useReservationsModule()

// Form state
const cleaningType = ref<ReservationCleaningType>('daily')
const customFrequency = ref<CustomCleaningFrequency>('day')
const dayInterval = ref<number>(2)
const selectedWeekDays = ref<DayOfWeek[]>(['monday', 'thursday', 'friday'])
const startDate = ref<string>('')
const cleaningTime = ref<string>('11:00')
const assigneeId = ref<string>(UNASSIGNED)
const assigneeIds = ref<string[]>([])

function parseIso(d?: string): Date | null {
  if (!d)
    return null
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, day)
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, days: number): string {
  const d = parseIso(iso)
  if (!d)
    return ''
  d.setDate(d.getDate() + days)
  return toIso(d)
}

function fmtDateLabel(iso?: string): string {
  const d = parseIso(iso)
  if (!d)
    return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const dayAfterCheckIn = computed(() => {
  if (!props.reservation?.checkIn)
    return ''
  return addDays(props.reservation.checkIn, 1)
})

const listing = computed(() => {
  if (!props.reservation?.listingId)
    return null
  return listings.value.find(l => l.id === props.reservation!.listingId) ?? null
})

const listingDefaultConfig = computed(() => {
  return listing.value?.maintenance?.defaultCleaningSchedule ?? null
})

const listingDefaultSummary = computed(() => {
  return formatListingCleaningSummary(listingDefaultConfig.value)
})

function applyListingDefaults() {
  const r = props.reservation
  if (!r)
    return
  const defaults = resolveDefaultCleaningSchedule(listingDefaultConfig.value, r.checkIn)
  cleaningType.value = defaults.type
  startDate.value = defaults.startDate || r.checkIn
  cleaningTime.value = defaults.time || '11:00'
  assigneeIds.value = defaults.assigneeIds && defaults.assigneeIds.length
    ? [...defaults.assigneeIds]
    : (defaults.assigneeId && defaults.assigneeId !== UNASSIGNED ? [defaults.assigneeId] : [])
  assigneeId.value = assigneeIds.value[0] || UNASSIGNED
  if (defaults.custom) {
    customFrequency.value = defaults.custom.frequency || 'day'
    dayInterval.value = defaults.custom.dayInterval || 2
    selectedWeekDays.value = defaults.custom.weekDays && defaults.custom.weekDays.length
      ? [...defaults.custom.weekDays]
      : ['monday', 'thursday', 'friday']
  }
}

function initFromReservation() {
  const r = props.reservation
  if (!r)
    return

  if (r.cleaningSchedule) {
    const s = r.cleaningSchedule
    cleaningType.value = s.type
    startDate.value = s.startDate || r.checkIn
    cleaningTime.value = s.time || '11:00'
    assigneeIds.value = s.assigneeIds && s.assigneeIds.length
      ? [...s.assigneeIds]
      : (s.assigneeId && s.assigneeId !== UNASSIGNED ? [s.assigneeId] : [])
    assigneeId.value = assigneeIds.value[0] || UNASSIGNED

    if (s.custom) {
      customFrequency.value = s.custom.frequency || 'day'
      dayInterval.value = s.custom.dayInterval || 2
      selectedWeekDays.value = s.custom.weekDays && s.custom.weekDays.length
        ? [...s.custom.weekDays]
        : ['monday', 'thursday', 'friday']
    }
  }
  else {
    applyListingDefaults()
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen)
      initFromReservation()
  },
  { immediate: true },
)

function selectCleaningType(type: ReservationCleaningType) {
  cleaningType.value = type
  if (type === 'checkout' && props.reservation?.checkOut) {
    startDate.value = props.reservation.checkOut
  }
  else if (type === 'daily' && props.reservation?.checkIn) {
    startDate.value = props.reservation.checkIn
  }
  else if (props.reservation?.checkIn && !startDate.value) {
    startDate.value = props.reservation.checkIn
  }
}

function toggleWeekDay(day: DayOfWeek) {
  if (selectedWeekDays.value.includes(day)) {
    selectedWeekDays.value = selectedWeekDays.value.filter(d => d !== day)
  }
  else {
    selectedWeekDays.value = [...selectedWeekDays.value, day]
  }
}

function setStartDate(date: string) {
  startDate.value = date
}

// Preview calculation
const effectiveStartDate = computed<string>(() => {
  if (!props.reservation)
    return ''
  if (cleaningType.value === 'daily')
    return props.reservation.checkIn
  if (cleaningType.value === 'checkout')
    return props.reservation.checkOut
  return startDate.value || props.reservation.checkIn
})

const previewDates = computed<string[]>(() => {
  if (!props.reservation || !effectiveStartDate.value)
    return []

  return computeCleaningDates({
    type: cleaningType.value,
    startDate: effectiveStartDate.value,
    checkIn: props.reservation.checkIn,
    checkOut: props.reservation.checkOut,
    custom: {
      frequency: customFrequency.value,
      dayInterval: Math.max(1, Number(dayInterval.value) || 1),
      weekDays: selectedWeekDays.value,
    },
  })
})

const canSave = computed(() => {
  if (!props.reservation || previewDates.value.length === 0)
    return false
  if (cleaningType.value === 'custom' && !startDate.value)
    return false
  return true
})

function handleSave() {
  const r = props.reservation
  if (!r || !canSave.value)
    return

  const schedule: ReservationCleaningSchedule = {
    type: cleaningType.value,
    startDate: effectiveStartDate.value || r.checkIn,
    time: cleaningTime.value || '11:00',
    assigneeIds: [...assigneeIds.value],
    assigneeId: assigneeIds.value[0] || (assigneeId.value !== UNASSIGNED ? assigneeId.value : undefined),
    custom: cleaningType.value === 'custom'
      ? {
          frequency: customFrequency.value,
          dayInterval: customFrequency.value === 'day' ? Math.max(1, Number(dayInterval.value) || 1) : undefined,
          weekDays: customFrequency.value === 'week' ? [...selectedWeekDays.value] : undefined,
        }
      : undefined,
  }

  const jobInputs: CleaningJobInput[] = generateCleaningJobsForReservation({
    reservation: r,
    schedule,
    cleaners: props.cleanerOptions,
  })

  // Apply jobs to cleaning store
  applyReservationSchedule(r.id, jobInputs)

  // Persist schedule on reservation
  updateReservation(r.id, { cleaningSchedule: schedule })

  toast.success(`Cleaning schedule saved — ${jobInputs.length} cleaning${jobInputs.length === 1 ? '' : 's'} scheduled`)
  emit('applied', schedule)
  emit('update:open', false)
}

function handleClear() {
  const r = props.reservation
  if (!r)
    return

  clearReservationSchedule(r.id)
  updateReservation(r.id, { cleaningSchedule: undefined })

  toast.info('Cleaning schedule cleared for this reservation')
  emit('cleared')
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden z-[60]">
      <DialogHeader class="px-6 pt-5 pb-3 border-b flex-shrink-0">
        <div class="flex items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="lucide:sparkles" class="size-4" />
          </div>
          <div>
            <DialogTitle class="text-base font-semibold">
              Cleaning Schedule Settings
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground">
              {{ reservation?.guestName }} • {{ reservation?.listingName }}
              <span v-if="reservation" class="ml-1 font-mono text-[11px] text-muted-foreground/80">
                ({{ fmtDateLabel(reservation.checkIn) }} – {{ fmtDateLabel(reservation.checkOut) }})
              </span>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
        <!-- Listing default banner -->
        <div
          v-if="listingDefaultConfig"
          class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border text-xs"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon name="lucide:building-2" class="size-3.5" />
            </div>
            <div class="min-w-0">
              <p class="text-[11px] font-medium text-muted-foreground">
                Listing Default
              </p>
              <p class="text-xs font-medium text-foreground truncate">
                {{ listingDefaultSummary }}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-7 text-xs px-2.5 shrink-0 gap-1"
            @click="applyListingDefaults"
          >
            <Icon name="lucide:rotate-ccw" class="size-3" />
            Reset to default
          </Button>
        </div>

        <!-- 1. Cleaning Type selection -->
        <div class="space-y-2">
          <Label class="text-xs font-semibold text-foreground">
            Cleaning Frequency Mode
          </Label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              v-for="opt in CLEANING_TYPE_OPTIONS"
              :key="opt.type"
              type="button"
              class="flex flex-col items-start p-3 rounded-lg border text-left transition-all relative cursor-pointer"
              :class="[
                cleaningType === opt.type
                  ? 'border-primary bg-primary/5 ring-1 ring-primary text-foreground shadow-xs'
                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground',
              ]"
              @click="selectCleaningType(opt.type)"
            >
              <div class="mb-1">
                <div
                  class="flex size-6 items-center justify-center rounded-md"
                  :class="cleaningType === opt.type ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
                >
                  <Icon :name="opt.icon" class="size-3.5" />
                </div>
              </div>
              <span class="text-xs font-semibold text-foreground">{{ opt.label }}</span>
              <span class="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                {{ opt.description }}
              </span>
            </button>
          </div>
        </div>

        <!-- 2. Custom Cleaning Options -->
        <div
          v-if="cleaningType === 'custom'"
          class="rounded-lg border bg-muted/20 p-3.5 space-y-3.5 border-dashed"
        >
          <div class="grid grid-cols-2 rounded-lg border bg-muted/40 p-0.5 text-xs text-center">
            <button
              type="button"
              class="py-1.5 rounded-md transition-all font-medium cursor-pointer"
              :class="customFrequency === 'day' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="customFrequency = 'day'"
            >
              By Day (Interval)
            </button>
            <button
              type="button"
              class="py-1.5 rounded-md transition-all font-medium cursor-pointer"
              :class="customFrequency === 'week' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="customFrequency = 'week'"
            >
              By Week (Specific Days)
            </button>
          </div>

          <!-- Custom by Day -->
          <div v-if="customFrequency === 'day'" class="space-y-2">
            <Label class="text-xs text-muted-foreground">Cleaning every:</Label>
            <div class="flex flex-wrap items-center gap-1.5 mb-2">
              <Button
                v-for="int in [1, 2, 3, 4, 5, 7]"
                :key="int"
                type="button"
                variant="outline"
                size="sm"
                class="h-7 text-xs px-2.5"
                :class="dayInterval === int ? 'bg-primary text-primary-foreground border-primary' : ''"
                @click="dayInterval = int"
              >
                {{ int === 1 ? 'Everyday' : `Every ${int} days` }}
              </Button>
            </div>
            <div class="flex items-center gap-2 max-w-[200px]">
              <Input
                v-model.number="dayInterval"
                type="number"
                min="1"
                max="30"
                class="h-8 text-xs"
              />
              <span class="text-xs text-muted-foreground whitespace-nowrap">days</span>
            </div>
          </div>

          <!-- Custom by Week -->
          <div v-else class="space-y-2">
            <div class="flex items-center justify-between">
              <Label class="text-xs text-muted-foreground">Clean every week on:</Label>
              <span class="text-[11px] text-muted-foreground">
                {{ selectedWeekDays.length }} day{{ selectedWeekDays.length === 1 ? '' : 's' }} selected
              </span>
            </div>
            <div class="grid grid-cols-7 gap-1">
              <button
                v-for="d in DAY_OF_WEEK_OPTIONS"
                :key="d.id"
                type="button"
                class="flex flex-col items-center justify-center py-2 px-1 rounded-md border text-center transition-all cursor-pointer text-xs"
                :class="[
                  selectedWeekDays.includes(d.id)
                    ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/60',
                ]"
                @click="toggleWeekDay(d.id)"
              >
                <span class="text-[11px] uppercase tracking-wider">{{ d.short }}</span>
              </button>
            </div>
            <p v-if="!selectedWeekDays.length" class="text-[11px] text-destructive">
              Please select at least one day of the week.
            </p>
          </div>
        </div>

        <!-- 3. Start Cleaning Date (Custom mode only) -->
        <div v-if="cleaningType === 'custom'" class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-xs font-semibold text-foreground">
              Start Cleaning On
            </Label>
            <div v-if="reservation" class="flex items-center gap-1">
              <button
                type="button"
                class="text-[11px] text-primary hover:underline px-1 py-0.5 cursor-pointer"
                @click="setStartDate(reservation.checkIn)"
              >
                Check-in ({{ fmtDateLabel(reservation.checkIn) }})
              </button>
              <span class="text-[10px] text-muted-foreground">•</span>
              <button
                v-if="dayAfterCheckIn && dayAfterCheckIn <= reservation.checkOut"
                type="button"
                class="text-[11px] text-primary hover:underline px-1 py-0.5 cursor-pointer"
                @click="setStartDate(dayAfterCheckIn)"
              >
                Next day ({{ fmtDateLabel(dayAfterCheckIn) }})
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Start date</Label>
              <DatePicker
                v-model="startDate"
                :min="reservation?.checkIn"
                :max="reservation?.checkOut"
                placeholder="Pick start date"
              />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">Cleaning time</Label>
              <TimePicker
                v-model="cleaningTime"
                placeholder="Select time"
              />
            </div>
          </div>
        </div>

        <!-- Cleaning time for Daily & Checkout modes -->
        <div v-else class="space-y-1.5">
          <Label class="text-xs font-semibold text-foreground">
            Cleaning Time
          </Label>
          <div class="max-w-[200px]">
            <TimePicker
              v-model="cleaningTime"
              placeholder="Select time"
            />
          </div>
        </div>

        <!-- 4. Cleaner Assignees -->
        <div class="space-y-2">
          <Label class="text-xs font-semibold text-foreground">
            Assign Cleaners
          </Label>
          <StaffMultiSelectDropdown
            v-model="assigneeIds"
            :options="cleanerOptions"
            placeholder="Search and select staff / cleaners..."
            title="Assign Cleaners"
            :show-tags="false"
          />
          <p v-if="assigneeIds.length" class="text-[11px] text-muted-foreground">
            {{ assigneeIds.length }} cleaner{{ assigneeIds.length === 1 ? '' : 's' }} assigned to each scheduled cleaning.
          </p>
          <p v-else class="text-[11px] text-muted-foreground italic">
            No cleaner assigned (unassigned).
          </p>
        </div>

        <!-- 5. Schedule Preview -->
        <div class="rounded-lg border bg-muted/30 p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Icon name="lucide:calendar-check-2" class="size-3.5 text-primary" />
              Schedule Preview
            </span>
            <Badge variant="secondary" class="text-[10px]">
              {{ previewDates.length }} cleaning{{ previewDates.length === 1 ? '' : 's' }} planned
            </Badge>
          </div>

          <div v-if="previewDates.length" class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
            <span
              v-for="d in previewDates"
              :key="d"
              class="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-[11px] font-mono text-muted-foreground"
            >
              <Icon name="lucide:calendar" class="size-2.5 text-primary" />
              {{ fmtDateLabel(d) }}
              <span class="text-[10px] text-muted-foreground/70">@ {{ cleaningTime || '11:00' }}</span>
            </span>
          </div>
          <div v-else class="text-xs text-muted-foreground py-2 text-center">
            No cleanings generated with current configuration.
          </div>
        </div>
      </div>

      <DialogFooter class="px-6 py-3.5 border-t bg-background shrink-0 flex items-center justify-between sm:justify-between">
        <div>
          <Button
            v-if="reservation?.cleaningSchedule"
            type="button"
            variant="ghost"
            size="sm"
            class="text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
            @click="handleClear"
          >
            <Icon name="lucide:trash-2" class="size-3.5 mr-1" />
            Clear schedule
          </Button>
        </div>

        <div class="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="text-xs cursor-pointer"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            class="text-xs gap-1.5 cursor-pointer"
            :disabled="!canSave"
            @click="handleSave"
          >
            <Icon name="lucide:check" class="size-3.5" />
            Apply Schedule
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
