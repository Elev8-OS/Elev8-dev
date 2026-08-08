<script setup lang="ts">
import type { ReservationEntry, ReservationStatus } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{
  reservation: ReservationEntry | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'openGuest': [id: string]
}>()

const { updateReservationStatus } = useReservationsModule()

const statusOptions = Object.entries(reservationStatusLabels).map(([value, label]) => ({ value, label }))

const statusDotClass = computed(() => {
  const map: Record<ReservationStatus, string> = {
    unverified: 'bg-neutral-400',
    verified: 'bg-green-600',
    checked_in: 'bg-orange-500',
    checked_out: 'bg-blue-600',
    cancelled: 'bg-neutral-400',
    blocked: 'bg-black',
    inquiry: 'bg-amber-500',
  }
  return props.reservation ? map[props.reservation.status] : 'bg-neutral-400'
})

const bookingNoteBody = computed(() => {
  const note = props.reservation?.bookingNote ?? ''
  const idx = note.indexOf('BOOKING NOTE :')
  return idx >= 0 ? note.slice(idx + 'BOOKING NOTE :'.length).trim() : note
})

function onStatusChange(value: unknown) {
  if (!props.reservation)
    return
  const status = value as ReservationStatus
  updateReservationStatus(props.reservation.id, status)
  toast.success(`Status updated to ${reservationStatusLabels[status]}`)
}

const smartLock = useSmartLock()

const df = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function listingPhoto(listingId: string): string {
  return listings.value.find(l => l.id === listingId)?.photos?.[0] ?? ''
}

function channelIcon(channel: string): string {
  if (channel === 'Airbnb')
    return 'logos:airbnb'
  if (channel === 'Booking.com')
    return 'simple-icons:bookingdotcom'
  return 'lucide:globe'
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// --- Smart lock ---
function locksForListing(listingId: string) {
  return smartLock.getLocksForListing(listingId)
}

function codesForReservation(reservation: ReservationEntry) {
  return smartLock.codes.value
    .filter(c => c.reservationId === reservation.id && c.status === 'active')
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
}

const activeCodesCount = computed(() => {
  const r = props.reservation
  return r ? codesForReservation(r).length : 0
})

const generatingLockId = ref<string | null>(null)

async function generateCode(reservation: ReservationEntry, lockId: string) {
  if (generatingLockId.value)
    return
  generatingLockId.value = lockId
  try {
    const result = await smartLock.generateAccessCode({
      lockId,
      reservationId: reservation.id,
      guestName: reservation.guestName,
    })
    if (!result.success) {
      toast.error(result.error ?? 'Failed to generate code.')
      return
    }
    toast.success(`Access code generated: ${result.code!.code}`)
  }
  finally {
    generatingLockId.value = null
  }
}

function revokeCode(codeId: string) {
  smartLock.revokeAccessCode(codeId)
  toast.info('Access code revoked.')
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.success('Code copied to clipboard.')
  }
  catch {
    toast.error(`Failed to copy. Code: ${code}`)
  }
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md" side="right">
      <template v-if="reservation">
        <ScrollArea class="h-full min-h-0 flex-1">
          <div class="flex flex-col">
            <!-- Hero banner -->
            <div class="relative h-36 w-full shrink-0">
              <img
                :src="listingPhoto(reservation.listingId)"
                :alt="reservation.listingName"
                class="h-full w-full object-cover"
              >
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <!-- Status chip (editable) -->
              <div class="absolute top-4 left-4">
                <Select :model-value="reservation.status" @update:model-value="onStatusChange">
                  <SelectTrigger class="h-9 gap-2 border-0 bg-white/95 px-3 text-sm font-semibold shadow-none hover:bg-white">
                    <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span class="size-2 shrink-0 rounded-full" :class="statusDotClass" />
                      {{ reservationStatusLabels[reservation.status] }}
                    </span>
                  </SelectTrigger>
                  <SelectContent class="min-w-[200px]">
                    <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value" class="py-2.5">
                      <span class="flex items-center gap-2 whitespace-nowrap">
                        <ReservationStatusBadge :status="opt.value as ReservationStatus" />
                        <span class="ml-1">{{ opt.label }}</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <!-- Channel logo -->
              <div class="absolute top-4 right-4 flex size-9 items-center justify-center bg-white/90">
                <Icon :name="channelIcon(reservation.channel)" class="size-5" />
              </div>
              <!-- Listing name on banner -->
              <div class="absolute bottom-3 left-4 right-4">
                <NuxtLink :to="`/listings/${reservation.listingId}`" class="text-white hover:underline text-lg font-semibold leading-tight">
                  {{ reservation.listingName }}
                </NuxtLink>
              </div>
            </div>

            <!-- Reservation id + price -->
            <div class="flex items-center justify-between border-b px-5 py-4">
              <div>
                <div class="text-xs text-muted-foreground uppercase tracking-wide">
                  Reservation
                </div>
                <div class="font-mono text-sm font-semibold">
                  {{ reservation.id }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs text-muted-foreground uppercase tracking-wide">
                  Total
                </div>
                <div class="text-xl font-bold">
                  {{ fmtCurrency(reservation.totalPrice, reservation.currency) }}
                </div>
              </div>
            </div>

            <!-- Guest -->
            <div class="border-b px-5 py-4">
              <div class="flex items-center gap-3">
                <Avatar class="size-11">
                  <AvatarFallback class="bg-primary/10 text-primary text-sm">
                    {{ initials(reservation.guestName) }}
                  </AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <button
                    type="button"
                    class="block text-left hover:underline"
                    @click="emit('openGuest', reservation.guestId)"
                  >
                    <span class="font-semibold">{{ reservation.guestName }}</span>
                  </button>
                  <p class="text-xs text-muted-foreground truncate">
                    {{ reservation.guestEmail }} · {{ reservation.guestPhone }}
                  </p>
                </div>
              </div>
              <div v-if="reservation.guestNotes" class="mt-3 flex items-start gap-2 border-l-2 border-primary bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                <Icon name="lucide:notebook-pen" class="mt-0.5 size-3.5 shrink-0" />
                {{ reservation.guestNotes }}
              </div>
            </div>

            <!-- Dates -->
            <div class="border-b px-5 py-4">
              <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Check-in
                  </div>
                  <div class="text-base font-semibold">
                    {{ fmtDate(reservation.checkIn) }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    2:00 PM
                  </div>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <div class="flex h-9 w-9 items-center justify-center bg-primary/10 text-primary">
                    <Icon name="lucide:moon-star" class="size-4" />
                  </div>
                  <span class="text-[11px] font-medium text-muted-foreground">
                    {{ reservation.nights }} nights
                  </span>
                </div>
                <div class="text-right">
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Check-out
                  </div>
                  <div class="text-base font-semibold">
                    {{ fmtDate(reservation.checkOut) }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    11:00 AM
                  </div>
                </div>
              </div>
            </div>

            <!-- Booking note (below dates) -->
            <div v-if="reservation.bookingNote" class="border-b px-5 py-4">
              <div class="border border-amber-400/60 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <p class="font-semibold tracking-wide">
                  ** THIS RESERVATION HAS BEEN PRE-PAID **
                </p>
                <p class="mt-1.5 whitespace-pre-line leading-relaxed text-amber-800 dark:text-amber-200/90">
                  {{ bookingNoteBody }}
                </p>
              </div>
            </div>

            <!-- Details grid -->
            <div class="grid grid-cols-2 gap-4 border-b px-5 py-4">
              <div class="flex items-center gap-2.5">
                <Icon name="lucide:users" class="size-4 text-muted-foreground" />
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Guests
                  </div>
                  <div class="text-sm font-medium">
                    {{ reservation.guestCount }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2.5">
                <Icon :name="channelIcon(reservation.channel)" class="size-4 text-muted-foreground" />
                <div>
                  <div class="text-xs text-muted-foreground uppercase tracking-wide">
                    Channel
                  </div>
                  <div class="text-sm font-medium">
                    {{ reservation.channel }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Smart lock (collapsible accordion) -->
            <Accordion type="single" collapsible class="w-full border-b px-2">
              <AccordionItem value="smartlock" class="border-b-0">
                <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground uppercase tracking-wide hover:no-underline">
                  <span class="flex items-center gap-2">
                    <Icon name="lucide:key-round" class="size-4" />
                    Smart lock
                    <Badge v-if="activeCodesCount" variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
                      {{ activeCodesCount }}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent class="px-3 pb-3">
                  <div v-if="!smartLock.isConnected.value" class="border border-dashed p-3 text-center">
                    <p class="text-xs text-muted-foreground">
                      Smart Lock isn't connected.
                    </p>
                    <NuxtLink to="/settings/integrations" class="mt-1 inline-block text-xs text-primary underline">
                      Connect in Settings
                    </NuxtLink>
                  </div>

                  <div v-else-if="locksForListing(reservation.listingId).length === 0" class="border border-dashed p-3 text-center text-xs text-muted-foreground">
                    No smart locks paired to this listing.
                  </div>

                  <div v-else class="space-y-2">
                    <div
                      v-for="lock in locksForListing(reservation.listingId)"
                      :key="lock.id"
                      class="border p-3"
                    >
                      <div class="flex items-center gap-2">
                        <Icon
                          :name="lock.online ? 'lucide:lock' : 'lucide:lock-open'"
                          class="size-4 shrink-0"
                          :class="lock.online ? 'text-green-600' : 'text-muted-foreground'"
                        />
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-medium truncate">
                            {{ lock.name }}
                          </p>
                          <p class="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Icon name="lucide:battery" class="size-2.5" :class="lock.batteryLevel <= 20 ? 'text-amber-500' : ''" />
                            {{ lock.batteryLevel }}%
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          class="h-7 gap-1 text-xs"
                          :disabled="!lock.online || generatingLockId === lock.id"
                          @click="generateCode(reservation, lock.id)"
                        >
                          <Icon
                            v-if="generatingLockId === lock.id"
                            name="lucide:loader-2"
                            class="size-3 animate-spin"
                          />
                          <Icon v-else name="lucide:plus" class="size-3" />
                          {{ generatingLockId === lock.id ? 'Generating…' : 'Generate code' }}
                        </Button>
                      </div>

                      <div
                        v-for="code in codesForReservation(reservation).filter(c => c.lockId === lock.id)"
                        :key="code.id"
                        class="mt-2 flex items-center justify-between gap-2 border bg-muted/30 p-2"
                      >
                        <div class="min-w-0 flex-1">
                          <p class="font-mono text-base font-bold tracking-widest">
                            {{ code.code }}
                          </p>
                          <p class="text-[10px] text-muted-foreground">
                            {{ code.guestName || 'Guest' }} · expires {{ formatExpiry(code.endsAt) }}
                          </p>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="sm" class="h-7 w-7 p-0" title="Copy code" @click="copyCode(code.code)">
                            <Icon name="lucide:copy" class="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" class="h-7 w-7 p-0 hover:text-destructive" title="Revoke" @click="revokeCode(code.id)">
                            <Icon name="lucide:trash-2" class="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      <p v-if="codesForReservation(reservation).filter(c => c.lockId === lock.id).length === 0" class="mt-2 text-[10px] text-muted-foreground italic">
                        No active codes. Click "Generate code" to create one.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <!-- Actions -->
            <div class="flex gap-2 px-5 py-4">
              <Button variant="outline" size="sm" class="flex-1 gap-1.5" @click="emit('openGuest', reservation.guestId)">
                <Icon name="lucide:user-round" class="size-3.5" />
                Guest profile
              </Button>
              <Button variant="outline" size="sm" class="flex-1 gap-1.5" as-child>
                <NuxtLink :to="`/listings/${reservation.listingId}`">
                  <Icon name="lucide:building-2" class="size-3.5" />
                  View listing
                </NuxtLink>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </template>

      <template v-else>
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle>
            Reservation
          </SheetTitle>
        </SheetHeader>
        <div class="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          No reservation selected.
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
