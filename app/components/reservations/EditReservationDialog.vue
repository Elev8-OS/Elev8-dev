<script setup lang="ts">
import type { GuestOccupant, ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { nightsBetween } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
  focusGuestIndex?: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const { updateReservation } = useReservationsModule()

const checkIn = ref('')
const checkOut = ref('')
const guestCount = ref(2)
const totalPrice = ref(0)
const currency = ref('USD')
const channel = ref<ReservationEntry['channel']>('Direct')
const guestNotes = ref('')
const occupants = ref<GuestOccupant[]>([])

// Editing state for a single occupant (null = none being edited)
const editingIndex = ref<number | null>(null)
const editName = ref('')
const editCategory = ref<GuestOccupant['category']>('adult')
const editEmail = ref('')
const editPhone = ref('')
const editDob = ref('')
const editNationality = ref('')
const editIdType = ref<GuestOccupant['idType']>('passport')
const editIdNumber = ref('')
const editIsPrimary = ref(false)

watch(() => props.open, (open) => {
  if (open && props.reservation) {
    checkIn.value = props.reservation.checkIn
    checkOut.value = props.reservation.checkOut
    guestCount.value = props.reservation.guestCount
    totalPrice.value = props.reservation.totalPrice
    currency.value = props.reservation.currency
    channel.value = props.reservation.channel
    guestNotes.value = props.reservation.guestNotes
    occupants.value = props.reservation.guests?.map(g => ({ ...g })) ?? []
    editingIndex.value = null
    if (props.focusGuestIndex != null && occupants.value[props.focusGuestIndex]) {
      startEdit(props.focusGuestIndex)
    }
  }
})

const computedNights = computed(() => {
  if (!checkIn.value || !checkOut.value)
    return 0
  return nightsBetween(checkIn.value, checkOut.value)
})

function startEdit(index: number) {
  const g = occupants.value[index]
  if (!g)
    return
  editingIndex.value = index
  editName.value = g.name
  editCategory.value = g.category
  editEmail.value = g.email ?? ''
  editPhone.value = g.phone ?? ''
  editDob.value = g.dob ?? ''
  editNationality.value = g.nationality ?? ''
  editIdType.value = g.idType ?? 'passport'
  editIdNumber.value = g.idNumber ?? ''
  editIsPrimary.value = g.isPrimary ?? false
}

function cancelEdit() {
  editingIndex.value = null
}

function saveOccupant() {
  if (!editName.value.trim()) {
    toast.error('Guest name is required.')
    return
  }
  const occupant: GuestOccupant = {
    id: editingIndex.value !== null ? occupants.value[editingIndex.value]!.id : `occ-${Date.now()}`,
    name: editName.value.trim(),
    category: editCategory.value,
    email: editEmail.value.trim() || undefined,
    phone: editPhone.value.trim() || undefined,
    dob: editDob.value || undefined,
    nationality: editNationality.value.trim() || undefined,
    idType: editIdNumber.value.trim() ? editIdType.value : undefined,
    idNumber: editIdNumber.value.trim() || undefined,
    isPrimary: editIsPrimary.value,
  }
  if (editingIndex.value !== null) {
    occupants.value = occupants.value.map((g, i) => (i === editingIndex.value ? occupant : g))
  }
  else {
    occupants.value = [...occupants.value, occupant]
  }
  guestCount.value = occupants.value.length
  editingIndex.value = null
}

function removeOccupant(index: number) {
  occupants.value = occupants.value.filter((_, i) => i !== index)
  guestCount.value = occupants.value.length
  if (editingIndex.value === index)
    editingIndex.value = null
}

function save() {
  if (!props.reservation || !checkIn.value || !checkOut.value) {
    toast.error('Check-in and check-out dates are required.')
    return
  }
  updateReservation(props.reservation.id, {
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    nights: computedNights.value,
    guestCount: guestCount.value,
    totalPrice: totalPrice.value,
    currency: currency.value,
    channel: channel.value,
    guestNotes: guestNotes.value.trim(),
    guests: occupants.value,
  })
  toast.success('Reservation updated')
  emit('update:open', false)
  emit('saved')
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = { adult: 'Adult', child: 'Child', infant: 'Infant' }
  return map[category] ?? category
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          Edit Reservation
        </DialogTitle>
        <DialogDescription v-if="reservation">
          {{ reservation.id }} · {{ reservation.guestName }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
        <div class="space-y-2">
          <Label>Check-in</Label>
          <Input v-model="checkIn" type="date" />
        </div>
        <div class="space-y-2">
          <Label>Check-out</Label>
          <Input v-model="checkOut" type="date" />
        </div>
        <div class="space-y-2">
          <Label>Guests</Label>
          <Input v-model.number="guestCount" type="number" min="1" />
        </div>
        <div class="space-y-2">
          <Label>Total price</Label>
          <Input v-model.number="totalPrice" type="number" min="0" />
        </div>
        <div class="space-y-2">
          <Label>Currency</Label>
          <Input v-model="currency" placeholder="USD" />
        </div>
        <div class="space-y-2">
          <Label>Channel</Label>
          <Select v-model="channel">
            <SelectTrigger>
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Airbnb">
                Airbnb
              </SelectItem>
              <SelectItem value="Booking.com">
                Booking.com
              </SelectItem>
              <SelectItem value="Direct">
                Direct
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2 sm:col-span-2">
          <Label>Guest notes</Label>
          <Textarea v-model="guestNotes" rows="3" placeholder="Notes about this guest..." />
        </div>
      </div>

      <!-- Guests group editor -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <Label>Guests</Label>
          <span class="text-xs text-muted-foreground">
            {{ occupants.length }} total
          </span>
        </div>

        <!-- Occupant list -->
        <div v-if="occupants.length" class="space-y-2">
          <div
            v-for="(g, i) in occupants"
            :key="g.id"
            class="flex items-center justify-between gap-2 border bg-muted/20 px-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">
                {{ g.name }}
                <Badge v-if="g.isPrimary" variant="secondary" class="ml-1 text-[9px]">
                  Main
                </Badge>
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ categoryLabel(g.category) }}
                <template v-if="g.nationality">
                  · {{ g.nationality }}
                </template>
                <template v-if="g.idNumber">
                  · {{ g.idType }}: {{ g.idNumber }}
                </template>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Edit" @click="startEdit(i)">
                <Icon name="lucide:pencil" class="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" class="h-7 w-7 p-0 hover:text-destructive" title="Remove" @click="removeOccupant(i)">
                <Icon name="lucide:trash-2" class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Add / edit occupant form -->
        <div class="rounded-md border p-3">
          <p class="mb-2 text-xs font-medium text-muted-foreground">
            {{ editingIndex !== null ? 'Edit guest' : 'Add guest' }}
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label class="text-xs">Name</Label>
              <Input v-model="editName" placeholder="Guest name" class="h-8 text-sm" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">Category</Label>
              <Select v-model="editCategory">
                <SelectTrigger class="h-8 text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adult">
                    Adult
                  </SelectItem>
                  <SelectItem value="child">
                    Child
                  </SelectItem>
                  <SelectItem value="infant">
                    Infant
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">Email</Label>
              <Input v-model="editEmail" placeholder="guest@email.com" class="h-8 text-sm" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">Phone</Label>
              <Input v-model="editPhone" placeholder="+62..." class="h-8 text-sm" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">Date of birth</Label>
              <Input v-model="editDob" type="date" class="h-8 text-sm" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">Nationality</Label>
              <Input v-model="editNationality" placeholder="e.g. Indonesian" class="h-8 text-sm" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">ID type</Label>
              <Select v-model="editIdType">
                <SelectTrigger class="h-8 text-sm">
                  <SelectValue placeholder="ID type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">
                    Passport
                  </SelectItem>
                  <SelectItem value="id_card">
                    ID Card
                  </SelectItem>
                  <SelectItem value="drivers_license">
                    Driver's License
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">ID number</Label>
              <Input v-model="editIdNumber" placeholder="ID number" class="h-8 text-sm" />
            </div>
            <label class="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox :model-value="editIsPrimary" @update:model-value="editIsPrimary = !!$event" />
              Main guest (booker)
            </label>
          </div>
          <div class="mt-3 flex justify-end gap-2">
            <Button v-if="editingIndex !== null" variant="ghost" size="sm" @click="cancelEdit">
              Cancel
            </Button>
            <Button size="sm" @click="saveOccupant">
              {{ editingIndex !== null ? 'Save guest' : 'Add guest' }}
            </Button>
          </div>
        </div>
      </div>

      <div class="rounded-md border bg-muted/40 p-3 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Nights</span>
          <span class="font-medium">{{ computedNights }}</span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button @click="save">
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
