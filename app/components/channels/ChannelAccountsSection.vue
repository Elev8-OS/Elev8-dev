<script setup lang="ts">
import type { ChannelAccount, ChannelDefinition } from './data/channels'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useChannels } from '~/composables/useChannels'
import ChannelAccountCard from './ChannelAccountCard.vue'
import ChannelAccountsSheet from './ChannelAccountsSheet.vue'
import ChannelConnectDialog from './ChannelConnectDialog.vue'
import ChannelImportDialog from './ChannelImportDialog.vue'
import ChannelPickerDialog from './ChannelPickerDialog.vue'

const { connectedChannels, disconnectAccount, mappingsForAccount } = useChannels()

// Only connected channels get a card. Add channel lists every channel.
const pickerOpen = ref(false)

const connectTarget = ref<ChannelDefinition | null>(null)
const connectOpen = ref(false)
const manageTarget = ref<ChannelDefinition | null>(null)
const manageOpen = ref(false)
const importTarget = ref<ChannelAccount | null>(null)
const importOpen = ref(false)
const disconnectTarget = ref<ChannelAccount | null>(null)
const disconnectOpen = ref(false)

const disconnectCount = computed(() => disconnectTarget.value ? mappingsForAccount(disconnectTarget.value.id).length : 0)

function openConnect(channel: ChannelDefinition) {
  connectTarget.value = channel
  connectOpen.value = true
}

function openManage(channel: ChannelDefinition) {
  manageTarget.value = channel
  manageOpen.value = true
}

/** Opened right after an account connects, and from the account menu. */
function openImport(account: ChannelAccount) {
  importTarget.value = account
  importOpen.value = true
}

function openDisconnect(account: ChannelAccount) {
  disconnectTarget.value = account
  disconnectOpen.value = true
}

function confirmDisconnect() {
  const account = disconnectTarget.value
  if (!account)
    return
  const count = disconnectAccount(account.id)
  toast.info(`${account.channel} account "${account.accountName}" disconnected`, { description: `${count} ${count === 1 ? 'listing was' : 'listings were'} unpublished.` })
  disconnectTarget.value = null
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-base font-semibold">
        Channel accounts
      </h2>
      <Button v-if="connectedChannels.length > 0" size="sm" @click="pickerOpen = true">
        <Icon name="lucide:plus" class="mr-1.5 size-4" aria-hidden="true" />
        Add channel
      </Button>
    </div>

    <div v-if="connectedChannels.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
      <ChannelAccountCard
        v-for="channel in connectedChannels"
        :key="channel.name"
        :channel="channel"
        @manage="openManage(channel)"
      />
    </div>
    <div v-else class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Icon name="lucide:plug" class="size-6 text-muted-foreground" aria-hidden="true" />
      <p class="max-w-sm text-sm text-muted-foreground">
        No channel is connected. Add one to start selling your listings on Airbnb, Booking.com and more.
      </p>
      <Button size="sm" @click="pickerOpen = true">
        <Icon name="lucide:plus" class="mr-1.5 size-4" aria-hidden="true" />
        Add channel
      </Button>
    </div>

    <ChannelPickerDialog v-model:open="pickerOpen" @pick="openConnect" />

    <ChannelAccountsSheet
      v-model:open="manageOpen"
      :channel="manageTarget"
      @add-account="manageTarget && openConnect(manageTarget)"
      @map-listings="openImport"
      @disconnect="openDisconnect"
    />
    <ChannelConnectDialog v-model:open="connectOpen" :channel="connectTarget" @connected="openImport" />
    <ChannelImportDialog v-model:open="importOpen" :account="importTarget" />

    <AlertDialog v-model:open="disconnectOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {{ disconnectTarget?.accountName }} from {{ disconnectTarget?.channel }}?</AlertDialogTitle>
          <AlertDialogDescription>
            {{ disconnectCount }} {{ disconnectCount === 1 ? 'listing on this account stops' : 'listings on this account stop' }} syncing.
            Their calendars on {{ disconnectTarget?.channel }} are no longer updated, so they can be double booked. Other
            {{ disconnectTarget?.channel }} accounts and existing reservations are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="confirmDisconnect">
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
