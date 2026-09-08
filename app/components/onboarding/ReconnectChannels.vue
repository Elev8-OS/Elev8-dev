<script setup lang="ts">
import { toast } from 'vue-sonner'
import { CHANNEL_OPTIONS, channelName, providerName } from '~/components/onboarding/data/onboarding'

defineEmits<{ (e: 'done'): void }>()

const { state, toggleChannel, disconnectOldPms, connectedChannels } = useOnboarding()

const busyId = ref<string | null>(null)
const confirmOpen = ref(false)

/** Channels seen in the imported data. These are what the tenant must redo. */
const detected = computed(() =>
  state.value.channelsToReconnect
    .map(id => CHANNEL_OPTIONS.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c)))

const oldPms = computed(() => (state.value.connection ? providerName(state.value.connection.provider) : 'your old system'))
const oldPmsDisconnected = computed(() => state.value.connection?.status === 'disconnected')

function isConnected(id: string): boolean {
  return state.value.channels.some(c => c.id === id && c.connected)
}

async function reconnect(id: string): Promise<void> {
  busyId.value = id
  await new Promise(resolve => setTimeout(resolve, 900))
  toggleChannel(id, true)
  busyId.value = null
  toast.success(`${channelName(id)} reconnected.`)
}

function confirmMigrationDone(): void {
  disconnectOldPms()
  confirmOpen.value = false
  toast.success(`${oldPms.value} disconnected. ELEV8 is now the only system writing to your channels.`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-base font-semibold tracking-tight text-foreground">
        Reconnect your channels
      </h3>
      <p class="text-xs text-muted-foreground mt-0.5">
        Channels do not move across on their own. Until you reconnect each one, ELEV8 is not
        sending it rates or availability.
      </p>
    </div>

    <div v-if="detected.length === 0" class="rounded-xl border border-dashed border-border/80 p-6 text-center">
      <p class="text-sm font-medium text-foreground">
        No channels found in the import
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        You can connect channels any time from Settings.
      </p>
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-2">
      <div
        v-for="channel in detected"
        :key="channel.id"
        class="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <Icon :name="channel.icon" class="size-5 shrink-0" />
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-foreground">
              {{ channel.name }}
            </p>
            <span
              class="mt-0.5 inline-flex items-center gap-1.5 text-[11px]"
              :class="isConnected(channel.id) ? 'text-emerald-600' : 'text-muted-foreground'"
            >
              <span class="size-1.5 rounded-full" :class="isConnected(channel.id) ? 'bg-emerald-600' : 'bg-muted-foreground/50'" />
              {{ isConnected(channel.id) ? 'Connected' : 'Not connected' }}
            </span>
          </div>
        </div>
        <Button
          v-if="!isConnected(channel.id)"
          size="sm"
          variant="outline"
          :disabled="busyId === channel.id"
          @click="reconnect(channel.id)"
        >
          <Icon v-if="busyId === channel.id" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
          Reconnect
        </Button>
        <Icon v-else name="lucide:check" class="size-4 text-emerald-600" />
      </div>
    </div>

    <!-- The old system is cut off only on confirmation, so two systems never
         write to the same channel at once (PRD 6.11). -->
    <div class="flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
      <p class="text-sm font-medium">
        Turn off {{ oldPms }}
      </p>
      <p class="text-xs text-muted-foreground">
        Do this once your channels are back on in ELEV8. Leaving both systems connected risks
        double bookings.
      </p>
      <div>
        <Button
          v-if="!oldPmsDisconnected"
          variant="outline"
          size="sm"
          class="mt-1"
          @click="confirmOpen = true"
        >
          My migration is finished
        </Button>
        <span v-else class="mt-1 inline-flex items-center gap-1.5 text-xs text-green-700">
          <Icon name="lucide:check" class="size-3.5" />
          {{ oldPms }} is disconnected
        </span>
      </div>
    </div>

    <div class="border-t pt-4">
      <p class="text-xs text-muted-foreground">
        {{ connectedChannels.length }} of {{ detected.length }} reconnected
      </p>
    </div>

    <AlertDialog v-model:open="confirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {{ oldPms }}?</AlertDialogTitle>
          <AlertDialogDescription>
            ELEV8 stops reading from {{ oldPms }} and becomes the only system writing to your
            channels. Reconnect anything you still need first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction @click="confirmMigrationDone">
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
