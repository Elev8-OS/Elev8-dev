<script setup lang="ts">
import { toast } from 'vue-sonner'

defineEmits<{ (e: 'done'): void }>()

const { state, allChannels, toggleChannel, connectedChannels } = useOnboarding()

const busyId = ref<string | null>(null)

function isConnected(id: string): boolean {
  return state.value.channels.some(c => c.id === id && c.connected)
}

async function connect(id: string, name: string): Promise<void> {
  busyId.value = id
  await new Promise(resolve => setTimeout(resolve, 900))
  toggleChannel(id, true)
  busyId.value = null
  toast.success(`${name} connected.`)
}

function disconnect(id: string, name: string): void {
  toggleChannel(id, false)
  toast.info(`${name} disconnected.`)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-sm font-semibold">
        Connect your channels
      </h3>
      <p class="text-xs text-muted-foreground">
        Rates, availability and reservations flow both ways once a channel is connected.
        You can do this later, nothing here blocks you.
      </p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="channel in allChannels"
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
          @click="connect(channel.id, channel.name)"
        >
          <Icon v-if="busyId === channel.id" name="lucide:loader-2" class="mr-1.5 size-3.5 animate-spin" />
          Connect
        </Button>
        <Button v-else size="sm" variant="ghost" class="text-xs" @click="disconnect(channel.id, channel.name)">
          Disconnect
        </Button>
      </div>
    </div>

    <div class="flex items-center justify-between border-t border-border/60 pt-3">
      <p class="text-xs text-muted-foreground">
        {{ connectedChannels.length }} connected
      </p>
    </div>
  </div>
</template>
