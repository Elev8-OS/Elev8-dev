<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'
import { getChannel, MAPPING_STATUS_LABEL } from './data/channels'
import { formatSyncTime } from './data/format'

const props = defineProps<{ listingId: string | null, channel: string | null }>()

const open = defineModel<boolean>('open', { default: false })

const { getMapping, accountsForChannel, connectListings, moveToAccount, disconnectListing, updateExternalId, resync } = useChannels()

const listing = computed(() => listings.value.find(l => l.id === props.listingId))
const definition = computed(() => props.channel ? getChannel(props.channel) : undefined)
const mapping = computed(() => props.listingId && props.channel ? getMapping(props.listingId, props.channel) : undefined)

const channelAccounts = computed(() => props.channel ? accountsForChannel(props.channel) : [])

const externalId = ref('')
const accountId = ref('')
const busy = ref(false)
const confirmDisconnect = ref(false)

watch(open, (value) => {
  if (value) {
    externalId.value = mapping.value?.externalId ?? ''
    accountId.value = mapping.value?.accountId ?? channelAccounts.value[0]?.id ?? ''
    busy.value = false
    confirmDisconnect.value = false
  }
})

const statusDotClass = computed(() => {
  switch (mapping.value?.status) {
    case 'syncing': return 'bg-amber-500 animate-pulse'
    case 'error': return 'bg-destructive'
    default: return 'bg-green-500'
  }
})

const idChanged = computed(() => !!mapping.value && externalId.value.trim() !== '' && externalId.value.trim() !== mapping.value.externalId)
const accountChanged = computed(() => !!mapping.value && !!accountId.value && accountId.value !== mapping.value.accountId)
const accountName = computed(() => channelAccounts.value.find(a => a.id === accountId.value)?.accountName ?? '')

async function connect() {
  if (!listing.value || !props.channel || !accountId.value)
    return
  busy.value = true
  const target = `${props.channel} (${accountName.value})`
  const pending = connectListings(accountId.value, [{ listingId: listing.value.id, externalId: externalId.value }])
  open.value = false
  toast.info(`Publishing ${listing.value.name} to ${target}...`)
  await pending
  toast.success(`${listing.value.name} is live on ${target}`)
}

async function save() {
  const current = mapping.value
  if (!current)
    return
  if (idChanged.value)
    updateExternalId(current.id, externalId.value)
  open.value = false
  if (!accountChanged.value) {
    toast.success('Mapping updated')
    return
  }
  const name = accountName.value
  toast.info(`Moving to ${name}...`)
  await moveToAccount(current.id, accountId.value)
  toast.success(`Now synced through ${name}`)
}

async function runResync() {
  if (!mapping.value)
    return
  busy.value = true
  await resync(mapping.value.id)
  busy.value = false
  toast.success('Resynced', { description: 'Availability, rates and restrictions were pushed again.' })
}

function disconnect() {
  if (!listing.value || !props.channel)
    return
  disconnectListing(listing.value.id, props.channel)
  toast.info(`${listing.value.name} disconnected from ${props.channel}`)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="listing && definition" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon :name="definition.icon" class="size-5" />
          {{ mapping ? 'Manage' : 'Connect to' }} {{ definition.name }}
        </DialogTitle>
        <DialogDescription class="truncate">
          {{ listing.name }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div v-if="mapping" class="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
          <div>
            <p class="text-xs text-muted-foreground">
              Status
            </p>
            <p class="flex items-center gap-1.5 font-medium">
              <span class="size-2 rounded-full" :class="statusDotClass" aria-hidden="true" />
              {{ MAPPING_STATUS_LABEL[mapping.status] }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">
              Last sync
            </p>
            <p class="font-medium">
              {{ formatSyncTime(mapping.lastSyncAt) }}
            </p>
          </div>
        </div>

        <div v-if="mapping?.error" class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <Icon name="lucide:circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{{ mapping.error }}</span>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="channel-account">{{ definition.name }} account</Label>
          <Select v-if="channelAccounts.length > 1" v-model="accountId">
            <SelectTrigger id="channel-account" class="w-full">
              <SelectValue placeholder="Choose account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="a in channelAccounts" :key="a.id" :value="a.id">
                {{ a.accountName }}<span v-if="a.propertyId" class="text-muted-foreground"> · ID {{ a.propertyId }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-else id="channel-account" class="text-sm">
            {{ accountName }}
          </p>
          <p v-if="accountChanged" class="text-xs text-muted-foreground">
            The listing is removed from the old account and pushed to this one.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="channel-external-id">{{ definition.listingIdLabel }}</Label>
          <Input
            id="channel-external-id"
            v-model="externalId"
            inputmode="numeric"
            :placeholder="mapping ? '' : 'Leave empty to match automatically'"
          />
          <p v-if="!mapping" class="text-xs text-muted-foreground">
            Leave it empty and Elev8 creates the listing on {{ definition.name }}, or matches an existing one by name and address.
          </p>
        </div>

        <div v-if="confirmDisconnect" class="flex flex-col gap-3 rounded-lg border border-destructive/40 p-3">
          <p class="text-sm">
            Stop syncing this listing? Its calendar on {{ definition.name }} is no longer updated, so it can be double booked.
          </p>
          <div class="flex justify-end gap-2">
            <Button size="sm" variant="outline" @click="confirmDisconnect = false">
              Keep
            </Button>
            <Button size="sm" variant="destructive" @click="disconnect">
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter v-if="!confirmDisconnect" class="gap-2 sm:justify-between">
        <template v-if="mapping">
          <Button variant="ghost" class="text-destructive hover:text-destructive" :disabled="busy" @click="confirmDisconnect = true">
            <Icon name="lucide:unlink" class="mr-1.5 size-4" aria-hidden="true" />
            Disconnect
          </Button>
          <div class="flex gap-2">
            <Button variant="outline" :disabled="busy || mapping.status === 'syncing'" @click="runResync">
              <Icon name="lucide:refresh-cw" class="mr-1.5 size-4" :class="busy ? 'animate-spin' : ''" aria-hidden="true" />
              Resync
            </Button>
            <Button :disabled="!(idChanged || accountChanged) || busy || mapping.status === 'syncing'" @click="save">
              Save
            </Button>
          </div>
        </template>
        <template v-else>
          <Button variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button :disabled="busy || !accountId" @click="connect">
            <Icon name="lucide:link" class="mr-1.5 size-4" aria-hidden="true" />
            Connect listing
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
