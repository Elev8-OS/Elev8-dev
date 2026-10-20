<script lang="ts" setup>
import type { Conversation, PhoneCall, Reservation } from '~/components/inbox/data/conversations'
import ReservationExtendDialog from '~/components/reservations/ReservationExtendDialog.vue'
import ReservationExtensionsSection from '~/components/reservations/ReservationExtensionsSection.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { canExtend } from '~/composables/useStayExtension'

interface ReservationPanelProps {
  conversation: Conversation
  reservation: Reservation
}

const props = defineProps<ReservationPanelProps>()

const waModalOpen = ref(false)
const extendOpen = ref(false)

// The inbox `Reservation` is a display copy; extending writes the Reservations
// module's stay, matched on the same id. A thread with no such stay (an
// unmatched sender) has nothing to extend.
const { reservations } = useReservationsModule()
const stay = computed(() => reservations.value.find(r => r.id === props.reservation.id) ?? null)
const extendable = computed(() => Boolean(stay.value && canExtend(stay.value)))
const threeCXCalls = useThreeCxCalls()

const conversationPhoneCalls = computed((): PhoneCall[] =>
  threeCXCalls.getCallsForConversation(props.conversation.id),
)
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex h-[56px] items-center justify-between px-4">
      <h2 class="font-semibold text-sm">
        Reservation
      </h2>
      <div class="flex items-center gap-1">
        <Button v-if="extendable" variant="ghost" size="sm" class="h-7 gap-1.5 text-xs" data-testid="inbox-extend-stay" @click="extendOpen = true">
          <Icon name="lucide:calendar-plus" class="size-3.5" />
          Extend stay
        </Button>
        <Button variant="ghost" size="sm" class="h-7 gap-1.5 text-xs text-green-600" @click="waModalOpen = true">
          <Icon name="i-lucide-message-circle" class="size-3.5" />
          Send WhatsApp
        </Button>
      </div>
    </div>

    <ScrollArea class="flex-1 min-h-0">
      <div class="px-4 pt-2 pb-2">
        <InboxReservationGuest :guest="reservation.guestDetails" :reservation="reservation" :stay-status="conversation.stayStatus" :conversation="conversation" :sentiment="conversation.sentiment" :sentiment-note="conversation.sentimentNote" />
      </div>

      <Separator />

      <!-- The stay's extensions with their payment, so the agent can finish one (mark paid, copy the link, cancel) without leaving the thread -->
      <ReservationExtensionsSection v-if="stay" :reservation="stay" />

      <Tabs default-value="summary" class="flex flex-col">
        <TabsList class="w-full justify-start rounded-none border-b bg-transparent px-2 h-9 overflow-x-auto">
          <TabsTrigger value="summary" class="text-xs shrink-0">
            Summary
          </TabsTrigger>
          <TabsTrigger value="tasks" class="text-xs shrink-0">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="activity" class="text-xs shrink-0">
            Activity
          </TabsTrigger>
          <TabsTrigger value="upsells" class="text-xs shrink-0">
            Upsell
            <Badge v-if="conversation.linkedUpsellOrderIds?.length" class="ml-1 h-4 min-w-4 rounded-full px-1 text-[9px]">
              {{ conversation.linkedUpsellOrderIds.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="smartlock" class="text-xs shrink-0">
            <Icon name="lucide:key-round" class="mr-1 size-3" />
            Smart Lock
          </TabsTrigger>
          <TabsTrigger value="guest-guide" class="text-xs shrink-0">
            <Icon name="lucide:book-open" class="mr-1 size-3" />
            Guest Guide
          </TabsTrigger>
          <TabsTrigger value="history" class="text-xs shrink-0">
            History
            <Badge v-if="reservation.bookingHistory?.length" class="ml-1 h-4 min-w-4 rounded-full px-1 text-[9px]">
              {{ reservation.bookingHistory.length }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div class="p-4">
            <InboxReservationSummary
              :sentiment="conversation.sentiment"
              :sentiment-note="conversation.sentimentNote"
              :last-message="conversation.lastMessage"
              :smart-actions="reservation.smartActions"
            />
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <div class="p-4">
            <InboxReservationTasks :listing-name="reservation.listingName" />
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div class="p-4">
            <InboxReservationActivity :activity="reservation.activity" :reservation="reservation" :phone-calls="conversationPhoneCalls" />
          </div>
        </TabsContent>

        <TabsContent value="upsells">
          <div class="p-4">
            <InboxReservationUpsells :linked-order-ids="conversation.linkedUpsellOrderIds ?? []" />
          </div>
        </TabsContent>

        <TabsContent value="smartlock">
          <div class="p-4">
            <InboxReservationSmartLocks :reservation="reservation" />
          </div>
        </TabsContent>

        <TabsContent value="guest-guide">
          <div class="p-4">
            <InboxReservationGuestGuide :reservation-id="reservation.id" />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div class="p-4">
            <InboxGuestBookingHistory :bookings="reservation.bookingHistory ?? []" />
          </div>
        </TabsContent>
      </Tabs>
    </ScrollArea>

    <InboxWhatsAppSendModal
      v-model:open="waModalOpen"
      :guest-name="reservation.guestDetails.name"
      :phone="reservation.guestDetails.phone"
      :vars="{ property_name: reservation.listingName, check_in_date: reservation.checkIn }"
    />

    <ReservationExtendDialog v-model:open="extendOpen" :reservation="stay" />
  </div>
</template>
