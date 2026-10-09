<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import type { AvailabilityQuery } from '~/components/cockpit/data/cockpit'
import { parseDate } from '@internationalized/date'
import BaseDateRangePicker from '~/components/base/DateRangePicker.vue'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

/** Asks for dates and a party size; the board then shows only the units that can take it. */
const props = defineProps<{ todayKey: string }>()
const emit = defineEmits<{ search: [query: AvailabilityQuery] }>()
const open = defineModel<boolean>('open', { default: false })

const range = ref<DateRange>({ start: undefined, end: undefined })
const guests = ref(2)

const minValue = computed(() => parseDate(props.todayKey))
const canSearch = computed(() => !!range.value.start && !!range.value.end && range.value.end.compare(range.value.start) > 0 && guests.value >= 1)

function submit() {
  if (!canSearch.value)
    return
  emit('search', { checkIn: range.value.start!.toString(), checkOut: range.value.end!.toString(), guests: guests.value })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Find availability</DialogTitle>
        <DialogDescription>
          Show only the listings and rooms that are free for every night of the stay.
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4">
        <div class="grid gap-2">
          <Label for="cockpit-find-dates">Check-in and check-out</Label>
          <BaseDateRangePicker id="cockpit-find-dates" v-model="range" :min-value="minValue" placeholder="Pick the stay dates" />
        </div>
        <div class="grid gap-2">
          <Label for="cockpit-find-guests">Guests</Label>
          <Input id="cockpit-find-guests" v-model.number="guests" type="number" min="1" max="30" class="w-28" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!canSearch" @click="submit">
          <Icon name="lucide:search" class="mr-2 size-4" />
          Search
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
