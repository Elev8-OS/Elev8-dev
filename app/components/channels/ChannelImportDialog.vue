<script setup lang="ts">
import type { ImportRowState } from './ChannelImportRow.vue'
import type { PickerOption } from './ChannelListingPicker.vue'
import type { ChannelAccount } from './data/channels'
import type { RemoteListing } from './data/remote-listings'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'
import ChannelImportRow from './ChannelImportRow.vue'
import { getChannel } from './data/channels'
import { suggestMatches } from './data/remote-listings'

const props = defineProps<{ account: ChannelAccount | null }>()

const open = defineModel<boolean>('open', { default: false })

const { fetchRemoteListings, getAccount, getMapping, mappingsForAccount, connectListings } = useChannels()

type Filter = 'all' | 'suggested' | 'unmatched'

const loading = ref(false)
const remotes = ref<RemoteListing[]>([])
const suggestions = ref<Record<string, string | null>>({})
const picks = ref<Record<string, string | null>>({})
const filter = ref<Filter>('all')
const showLinked = ref(false)

const definition = computed(() => props.account ? getChannel(props.account.channel) : undefined)

/** Remote id → Elev8 listing id, for listings this account already syncs. */
const linkedByRemote = computed(() => new Map(
  props.account ? mappingsForAccount(props.account.id).map(m => [m.externalId, m.listingId]) : [],
))

const openRemotes = computed(() => remotes.value.filter(r => !linkedByRemote.value.has(r.externalId)))
const linkedRemotes = computed(() => remotes.value.filter(r => linkedByRemote.value.has(r.externalId)))

let request = 0

watch(open, async (value) => {
  const account = props.account
  if (!value || !account)
    return
  const current = ++request
  loading.value = true
  filter.value = 'all'
  showLinked.value = false
  const fetched = await fetchRemoteListings(account.id)
  // A reopen for another account while fetching wins.
  if (current !== request)
    return
  remotes.value = fetched
  const candidates = listings.value
    .filter(l => !getMapping(l.id, account.channel))
    .map(l => ({ id: l.id, name: l.name, location: l.location }))
  const linked = new Set(mappingsForAccount(account.id).map(m => m.externalId))
  suggestions.value = suggestMatches(fetched.filter(r => !linked.has(r.externalId)), candidates)
  picks.value = { ...suggestions.value }
  loading.value = false
})

function rowState(remote: RemoteListing): ImportRowState {
  if (linkedByRemote.value.has(remote.externalId))
    return 'linked'
  const pick = picks.value[remote.externalId] ?? null
  if (pick === null)
    return 'skipped'
  return pick === suggestions.value[remote.externalId] ? 'suggested' : 'chosen'
}

const visibleRemotes = computed(() => openRemotes.value.filter((r) => {
  if (filter.value === 'suggested')
    return rowState(r) === 'suggested'
  if (filter.value === 'unmatched')
    return (picks.value[r.externalId] ?? null) === null
  return true
}))

const counts = computed(() => {
  const states = openRemotes.value.map(rowState)
  return {
    suggested: states.filter(s => s === 'suggested').length,
    unmatched: states.filter(s => s === 'skipped').length,
    connecting: states.filter(s => s === 'suggested' || s === 'chosen').length,
  }
})

function optionsFor(remote: RemoteListing): PickerOption[] {
  const account = props.account
  if (!account)
    return []
  const chosenElsewhere = new Set(Object.entries(picks.value)
    .filter(([id, pick]) => id !== remote.externalId && pick)
    .map(([, pick]) => pick!))
  return listings.value.map((l) => {
    const existing = getMapping(l.id, account.channel)
    let disabledReason: string | undefined
    if (existing?.accountId === account.id)
      disabledReason = 'Already linked on this account'
    else if (existing)
      disabledReason = `On ${account.channel} through ${getAccount(existing.accountId)?.accountName ?? 'another account'}`
    else if (chosenElsewhere.has(l.id))
      disabledReason = 'Chosen for another listing'
    return { id: l.id, name: l.name, location: l.location, disabledReason }
  })
}

function setPick(remoteId: string, listingId: string | null) {
  picks.value = { ...picks.value, [remoteId]: listingId }
}

function linkedName(remote: RemoteListing) {
  const id = linkedByRemote.value.get(remote.externalId)
  return listings.value.find(l => l.id === id)?.name ?? ''
}

async function connect() {
  const account = props.account
  if (!account)
    return
  const items = openRemotes.value
    .map(r => ({ listingId: picks.value[r.externalId] ?? null, externalId: r.externalId }))
    .filter((i): i is { listingId: string, externalId: string } => i.listingId !== null)
  if (items.length === 0)
    return
  open.value = false
  const target = `${account.channel} (${account.accountName})`
  toast.info(`Connecting ${items.length} ${items.length === 1 ? 'listing' : 'listings'} to ${target}...`)
  const count = await connectListings(account.id, items)
  toast.success(`${count} ${count === 1 ? 'listing is' : 'listings are'} live on ${target}`)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="account && definition" class="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
      <DialogHeader class="border-b p-5">
        <DialogTitle class="flex items-center gap-2">
          <Icon :name="definition.icon" class="size-5" />
          Map {{ account.channel }} listings
        </DialogTitle>
        <DialogDescription>
          Match each listing on {{ account.accountName }} to the Elev8 listing it is. Elev8 then syncs its calendar, rates and messages.
        </DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <Icon name="lucide:loader-circle" class="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <p class="text-sm text-muted-foreground" role="status">
          Getting your listings from {{ account.channel }}...
        </p>
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
          <Tabs v-model="filter">
            <TabsList>
              <TabsTrigger value="all">
                All {{ openRemotes.length }}
              </TabsTrigger>
              <TabsTrigger value="suggested">
                Suggested {{ counts.suggested }}
              </TabsTrigger>
              <TabsTrigger value="unmatched">
                Not matched {{ counts.unmatched }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p class="text-xs text-muted-foreground">
            Suggestions compare the listing title and location.
          </p>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <ul v-if="visibleRemotes.length > 0" class="divide-y">
            <ChannelImportRow
              v-for="r in visibleRemotes"
              :key="r.externalId"
              :remote="r"
              :channel="account.channel"
              :state="rowState(r)"
              :options="optionsFor(r)"
              :pick="picks[r.externalId] ?? null"
              @update:pick="setPick(r.externalId, $event)"
            />
          </ul>
          <p v-else-if="openRemotes.length === 0" class="px-5 py-10 text-center text-sm text-muted-foreground">
            Every listing on this account is already linked to an Elev8 listing.
          </p>
          <p v-else class="px-5 py-10 text-center text-sm text-muted-foreground">
            No listings in this view.
          </p>

          <div v-if="linkedRemotes.length > 0" class="border-t">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-5 py-3 text-left text-sm text-muted-foreground hover:bg-muted/50"
              :aria-expanded="showLinked"
              @click="showLinked = !showLinked"
            >
              <Icon :name="showLinked ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="size-4" aria-hidden="true" />
              {{ linkedRemotes.length }} already linked
            </button>
            <ul v-if="showLinked" class="divide-y border-t bg-muted/20">
              <ChannelImportRow
                v-for="r in linkedRemotes"
                :key="r.externalId"
                :remote="r"
                :channel="account.channel"
                state="linked"
                :options="[]"
                :linked-name="linkedName(r)"
              />
            </ul>
          </div>
        </div>

        <DialogFooter class="flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-muted-foreground">
            <template v-if="counts.connecting > 0">
              {{ counts.connecting }} {{ counts.connecting === 1 ? 'listing' : 'listings' }} will be connected.
            </template>
            <template v-if="counts.unmatched > 0">
              {{ counts.unmatched }} won't sync.
            </template>
          </p>
          <div class="flex gap-2">
            <Button variant="outline" @click="open = false">
              Cancel
            </Button>
            <Button :disabled="counts.connecting === 0" @click="connect">
              Connect {{ counts.connecting }} {{ counts.connecting === 1 ? 'listing' : 'listings' }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
