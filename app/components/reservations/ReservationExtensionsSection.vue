<script setup lang="ts">
import type { ExtensionPaymentMethod, ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { isActiveExtension } from '~/components/reservations/data/reservations'
import ReservationCancelExtensionDialog from '~/components/reservations/ReservationCancelExtensionDialog.vue'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useStayExtension } from '~/composables/useStayExtension'

// Every extension of the stay, and on a linked direct booking, the OTA stay it
// extends. Pending extensions are settled here ("Mark paid").
const props = defineProps<{
  reservation: ReservationEntry
}>()

const { reservations } = useReservationsModule()
const { requests } = usePaymentRequests()
const { markExtensionPaid, canCancelExtension } = useStayExtension()

const cancellingId = ref<string | undefined>()
const cancelOpen = computed({
  get: () => Boolean(cancellingId.value),
  set: (open: boolean) => {
    if (!open)
      cancellingId.value = undefined
  },
})

/** Only offered where it would go through: the outermost, before its nights begin. */
function cancellable(extensionId: string): boolean {
  return canCancelExtension(props.reservation.id, extensionId).ok
}

const METHOD_LABELS: Record<ExtensionPaymentMethod, string> = {
  payment_link: 'Payment link',
  saved_card: 'Saved card',
  at_property: 'At the property',
  already_paid: 'Paid outside Elev8',
}

const extensions = computed(() => [...(props.reservation.extensions ?? [])].reverse())
const pendingCount = computed(() => extensions.value.filter(e => isActiveExtension(e) && e.paymentStatus === 'pending').length)

const parent = computed(() => props.reservation.extensionOf
  ? reservations.value.find(r => r.id === props.reservation.extensionOf) ?? null
  : null)

/** A linked booking that ends where its stay begins carries an early arrival. */
const isEarlyArrival = computed(() => Boolean(parent.value && props.reservation.checkOut <= parent.value.checkIn))

function paymentLink(requestId?: string): string | undefined {
  return requestId ? requests.value.find(r => r.id === requestId)?.paymentLink : undefined
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtMoney(amount: number, currency: string): string {
  const locale = currency === 'CHF' ? 'de-CH' : 'en-US'
  const digits = currency === 'IDR' ? 0 : 2
  return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function markPaid(extensionId: string) {
  if (markExtensionPaid(props.reservation.id, extensionId))
    toast.success('Extension marked as paid')
}

function copyLink(link: string) {
  navigator.clipboard?.writeText(link)
  toast.success('Payment link copied')
}
</script>

<template>
  <div v-if="reservation.extensionOf" class="border-b px-5 py-3" data-testid="extension-of">
    <div class="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
      <Icon name="lucide:link-2" class="size-4 shrink-0 text-muted-foreground" />
      <span class="min-w-0 flex-1">
        {{ isEarlyArrival ? 'Early arrival for' : 'Extension of' }}
        <template v-if="parent">{{ parent.channel }}</template>
        reservation
        <span class="font-mono font-medium">{{ reservation.extensionOf }}</span>
      </span>
      <NuxtLink :to="`/reservations?reservation=${reservation.extensionOf}`" class="shrink-0 font-medium text-primary hover:underline">
        Open
      </NuxtLink>
    </div>
  </div>

  <Accordion v-if="extensions.length" type="single" collapsible class="w-full border-b px-2" data-testid="extensions-section">
    <AccordionItem value="extensions" class="border-b-0">
      <AccordionTrigger class="px-3 py-3 text-xs text-muted-foreground hover:no-underline">
        <span class="flex items-center gap-2">
          <Icon name="lucide:calendar-plus" class="size-4" />
          Extensions
          <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[9px]">
            {{ extensions.length }}
          </Badge>
          <Badge v-if="pendingCount" variant="outline" class="h-4 border-amber-500/40 px-1 text-[9px] text-amber-700 dark:text-amber-400">
            {{ pendingCount }} unpaid
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent class="px-3 pb-3">
        <div class="space-y-2">
          <div
            v-for="ext in extensions"
            :key="ext.id"
            class="rounded-md border px-3 py-2 text-xs"
            :class="ext.cancelledAt ? 'border-dashed bg-transparent' : 'bg-muted/20'"
            data-testid="extension-row"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium" :class="ext.cancelledAt ? 'text-muted-foreground line-through' : ''">
                +{{ ext.extraNights }} night{{ ext.extraNights === 1 ? '' : 's' }}
                <span v-if="ext.direction === 'before'" class="font-normal text-muted-foreground">· early arrival</span>
              </span>
              <span class="text-sm font-medium">{{ fmtMoney(ext.amount, ext.currency) }}</span>
            </div>
            <div class="mt-0.5 flex items-center justify-between gap-2 text-muted-foreground">
              <span v-if="ext.direction === 'before'">Check-in {{ fmtDate(ext.previousCheckIn!) }} to {{ fmtDate(ext.newCheckIn!) }}</span>
              <span v-else>Check-out {{ fmtDate(ext.previousCheckOut!) }} to {{ fmtDate(ext.newCheckOut!) }}</span>
              <span>{{ METHOD_LABELS[ext.paymentMethod] }}</span>
            </div>
            <div v-if="ext.linkedReservationId" class="mt-1 flex items-center gap-1 text-muted-foreground">
              <Icon name="lucide:link-2" class="size-3" />
              Direct booking
              <NuxtLink :to="`/reservations?reservation=${ext.linkedReservationId}`" class="font-mono font-medium text-primary hover:underline">
                {{ ext.linkedReservationId }}
              </NuxtLink>
            </div>
            <div v-if="ext.cancelledAt" class="mt-2 flex items-center justify-between gap-2" data-testid="extension-cancelled">
              <span class="flex items-center gap-1.5">
                <Badge variant="outline" class="text-[10px] text-muted-foreground">
                  Cancelled {{ fmtDate(ext.cancelledAt.slice(0, 10)) }}
                </Badge>
              </span>
            </div>
            <div v-else class="mt-2 flex items-center justify-between gap-2">
              <Badge v-if="ext.paymentStatus === 'paid'" variant="outline" class="border-green-500/30 bg-green-500/10 text-[10px] text-green-700 dark:text-green-400">
                Paid
              </Badge>
              <Badge v-else variant="outline" class="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
                Payment pending
              </Badge>
              <div v-if="ext.paymentStatus === 'pending'" class="flex items-center gap-1">
                <Button
                  v-if="paymentLink(ext.paymentRequestId)"
                  variant="ghost"
                  size="sm"
                  class="h-7 gap-1 px-2 text-xs"
                  @click="copyLink(paymentLink(ext.paymentRequestId)!)"
                >
                  <Icon name="lucide:copy" class="size-3" />
                  Copy link
                </Button>
                <Button variant="outline" size="sm" class="h-7 px-2 text-xs" data-testid="extension-mark-paid" @click="markPaid(ext.id)">
                  Mark paid
                </Button>
              </div>
            </div>
            <div v-if="!ext.cancelledAt && cancellable(ext.id)" class="mt-1 flex justify-end">
              <Button variant="ghost" size="sm" class="h-7 px-2 text-xs text-destructive hover:text-destructive" data-testid="extension-cancel" @click="cancellingId = ext.id">
                {{ ext.direction === 'before' ? 'Cancel early arrival' : 'Cancel extension' }}
              </Button>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
  <ReservationCancelExtensionDialog v-model:open="cancelOpen" :reservation="reservation" :extension-id="cancellingId" />
</template>
