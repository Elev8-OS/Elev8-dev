<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import ReservationExtendDialog from '~/components/reservations/ReservationExtendDialog.vue'
import ReservationTimesDialog from '~/components/reservations/ReservationTimesDialog.vue'
import { CHECK_OUT_TIME_LOCKED_STATUSES, NON_EXTENDABLE_STATUSES } from '~/composables/useReservationsModule'

// "Modify" groups every change to a booking. Editing the whole reservation stays
// with the parent (it already hosts EditReservationDialog, with guest focus);
// the reservation time and extension dialogs live here.
const props = defineProps<{
  reservation: ReservationEntry
  buttonClass?: string
}>()

const emit = defineEmits<{
  edit: []
}>()

const timesOpen = ref(false)
const extendOpen = ref(false)

// Check-out time stays editable while the guest is in (late check-out), so the
// item only locks once the stay is over or cancelled.
const timesLocked = computed(() => CHECK_OUT_TIME_LOCKED_STATUSES.includes(props.reservation.status))
const extendLocked = computed(() => NON_EXTENDABLE_STATUSES.includes(props.reservation.status))
const isCancelled = computed(() => props.reservation.status === 'cancelled')
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" :class="buttonClass ?? 'h-8 gap-1.5'" data-testid="reservation-modify">
        <Icon name="lucide:pencil" class="size-3.5" />
        <span>Modify</span>
        <Icon name="lucide:chevron-down" class="size-3.5 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-60">
      <DropdownMenuItem data-testid="modify-edit" @click="emit('edit')">
        <Icon name="lucide:pencil" class="size-4" />
        <span>Edit reservation</span>
      </DropdownMenuItem>
      <DropdownMenuItem :disabled="timesLocked" data-testid="modify-times" @click="timesOpen = true">
        <Icon name="lucide:clock" class="size-4" />
        <div class="flex flex-col">
          <span>Edit reservation time</span>
          <span v-if="timesLocked" class="text-xs text-muted-foreground">Stay is {{ isCancelled ? 'cancelled' : 'already over' }}</span>
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem :disabled="extendLocked" data-testid="modify-extend" @click="extendOpen = true">
        <Icon name="lucide:calendar-plus" class="size-4" />
        <div class="flex flex-col">
          <span>Extend reservation</span>
          <span v-if="extendLocked" class="text-xs text-muted-foreground">Stay is {{ isCancelled ? 'cancelled' : 'already over' }}</span>
        </div>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <ReservationTimesDialog v-model:open="timesOpen" :reservation="reservation" />
  <ReservationExtendDialog v-model:open="extendOpen" :reservation="reservation" />
</template>
