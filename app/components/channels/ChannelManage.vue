<script setup lang="ts">
import type { ChannelDefinition, ChannelMappingStatus } from './data/channels'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { cancellationPolicyOptions, listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'
import { useChannelSetup } from '~/composables/useChannelSetup'
import ChannelStatusBadge from './ChannelStatusBadge.vue'
import { channelListingUrl, channelSlug, MAPPING_STATUS_LABEL } from './data/channels'
import { formatSyncTime } from './data/format'

/**
 * One channel after it is connected: every listing on it with its status, and
 * what to do about each. Setup itself lives in the connect wizard.
 */
const props = defineProps<{ channel: ChannelDefinition }>()

const { accountsForChannel, getAccount, mappingsForChannel } = useChannels()
const setup = useChannelSetup(props.channel.name)
const slug = channelSlug(props.channel.name)
const wizard = (step: string) => `/channels/${slug}/connect?step=${step}`

const accounts = computed(() => accountsForChannel(props.channel.name))
const policyLabel = computed(() => cancellationPolicyOptions.find(o => o.value === setup.state.value.policy)?.label)

const rows = computed(() => {
  const byId = new Map(listings.value.map(l => [l.id, l]))
  return mappingsForChannel(props.channel.name).flatMap((mapping) => {
    const listing = byId.get(mapping.listingId)
    if (!listing)
      return []
    const account = getAccount(mapping.accountId)
    return [{
      mapping,
      listing,
      accountName: account?.accountName ?? '',
      url: channelListingUrl(props.channel.name, mapping.externalId, account?.propertyId),
    }]
  }).sort((a, b) => a.listing.name.localeCompare(b.listing.name))
})

// Problems first in the tiles, so the eye lands on what needs a hand.
const STATUS_ORDER: ChannelMappingStatus[] = ['error', 'attention', 'syncing', 'active']
const counts = computed(() => Object.fromEntries(STATUS_ORDER.map(s => [s, rows.value.filter(r => r.mapping.status === s).length])) as Record<ChannelMappingStatus, number>)

const filter = ref<ChannelMappingStatus | null>(null)
const search = ref('')

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter(r => (!filter.value || r.mapping.status === filter.value)
    && (!q || r.listing.name.toLowerCase().includes(q) || r.listing.location.toLowerCase().includes(q)))
})

function toggleFilter(status: ChannelMappingStatus) {
  filter.value = filter.value === status ? null : status
}

async function retry(listingId: string, name: string) {
  await setup.retry(listingId)
  toast.success(`${name} sent to ${props.channel.name} again`)
}

function unlink(listingId: string, name: string) {
  setup.unlink(listingId)
  toast.info(`${name} unlinked`, { description: `${props.channel.name} gets a new listing instead of the one you linked.` })
}

const removeTarget = ref<{ id: string, name: string } | null>(null)
const removeOpen = ref(false)

function askRemove(id: string, name: string) {
  removeTarget.value = { id, name }
  removeOpen.value = true
}

function confirmRemove() {
  if (!removeTarget.value)
    return
  setup.remove(removeTarget.value.id)
  toast.info(`${removeTarget.value.name} taken off ${props.channel.name}`)
  removeTarget.value = null
}

const turnOffOpen = ref(false)

function turnOff() {
  const count = setup.turnOff()
  toast.info(`${props.channel.name} turned off`, { description: `${count} ${count === 1 ? 'listing stopped' : 'listings stopped'} selling there.` })
}
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <header class="flex flex-col gap-3">
      <NuxtLink to="/channels" class="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Icon name="lucide:arrow-left" class="size-4" aria-hidden="true" />
        Channels
      </NuxtLink>
      <div class="flex flex-wrap items-start gap-3">
        <div class="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background">
          <Icon :name="channel.icon" class="size-6" />
        </div>
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ channel.name }}
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ rows.length }} of {{ listings.length }} listings
            <template v-if="accounts.length">
              · {{ accounts.map(a => a.accountName).join(', ') }}
            </template>
            <template v-if="policyLabel">
              · {{ policyLabel }} cancellation
            </template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button v-if="setup.pendingListings.value.length > 0" as-child>
            <NuxtLink :to="wizard('listings')">
              <Icon name="lucide:plus" class="mr-1.5 size-4" aria-hidden="true" />
              Add listings
            </NuxtLink>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="icon" :aria-label="`More ${channel.name} actions`">
                <Icon name="lucide:ellipsis" class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuItem as-child>
                <NuxtLink :to="wizard('account')">
                  <Icon name="lucide:key-round" class="size-4" aria-hidden="true" />
                  Account and sign-in
                </NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <NuxtLink :to="wizard('readiness')">
                  <Icon name="lucide:list-checks" class="size-4" aria-hidden="true" />
                  Policy and payments
                </NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="text-destructive focus:text-destructive" :disabled="rows.length === 0" @select="turnOffOpen = true">
                <Icon name="lucide:power" class="size-4" aria-hidden="true" />
                Turn off {{ channel.name }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

    <div v-if="rows.length === 0" class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Icon name="lucide:plug" class="size-6 text-muted-foreground" aria-hidden="true" />
      <p class="max-w-sm text-sm text-muted-foreground">
        No listing sells on {{ channel.name }} yet.
      </p>
      <Button as-child>
        <NuxtLink :to="`/channels/${slug}/connect`">
          Connect {{ channel.name }}
        </NuxtLink>
      </Button>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Filter by status">
        <button
          v-for="status in STATUS_ORDER"
          :key="status"
          type="button"
          class="flex flex-col gap-1 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="filter === status ? 'border-primary ring-1 ring-primary' : ''"
          :aria-pressed="filter === status"
          @click="toggleFilter(status)"
        >
          <ChannelStatusBadge :status="status" class="w-fit" />
          <span class="text-2xl font-semibold tabular-nums">{{ counts[status] }}</span>
        </button>
      </div>

      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <BaseSearchInput v-model="search" placeholder="Search listings..." />
          <Button v-if="filter" variant="ghost" size="sm" @click="filter = null">
            Showing {{ MAPPING_STATUS_LABEL[filter] }} only. Show all
          </Button>
        </div>

        <div class="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{{ setup.spec.linkIds?.property ?? channel.listingIdLabel }}</TableHead>
                <TableHead v-if="accounts.length > 1">
                  Account
                </TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead class="w-12">
                  <span class="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in visible" :key="row.mapping.id" class="align-top">
                <TableCell class="min-w-[200px]">
                  <p class="font-medium">
                    {{ row.listing.name }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ row.listing.location }}
                  </p>
                </TableCell>
                <TableCell class="min-w-[220px] max-w-sm whitespace-normal">
                  <ChannelStatusBadge :status="row.mapping.status" />
                  <p
                    v-if="row.mapping.error"
                    class="mt-1.5 text-xs"
                    :class="row.mapping.status === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'"
                  >
                    {{ row.mapping.error }}
                  </p>
                </TableCell>
                <TableCell>
                  <a
                    v-if="row.url"
                    :href="row.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-sm tabular-nums hover:underline"
                    :aria-label="`Open ${row.listing.name} on ${channel.name}`"
                  >
                    {{ row.mapping.externalId }}
                    <Icon name="lucide:external-link" class="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </a>
                  <span v-else class="text-sm tabular-nums">{{ row.mapping.externalId }}</span>
                </TableCell>
                <TableCell v-if="accounts.length > 1" class="text-sm">
                  {{ row.accountName }}
                </TableCell>
                <TableCell class="whitespace-nowrap text-sm text-muted-foreground">
                  {{ row.mapping.status === 'syncing' ? 'Now' : formatSyncTime(row.mapping.lastSyncAt) }}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions for ${row.listing.name}`">
                        <Icon name="lucide:ellipsis" class="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-52">
                      <DropdownMenuItem :disabled="row.mapping.status === 'syncing'" @select="retry(row.listing.id, row.listing.name)">
                        <Icon name="lucide:refresh-cw" class="size-4" aria-hidden="true" />
                        Sync again
                      </DropdownMenuItem>
                      <DropdownMenuItem v-if="setup.spec.linkIds" @select="unlink(row.listing.id, row.listing.name)">
                        <Icon name="lucide:unlink" class="size-4" aria-hidden="true" />
                        Unlink
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-destructive focus:text-destructive" @select="askRemove(row.listing.id, row.listing.name)">
                        <Icon name="lucide:circle-minus" class="size-4" aria-hidden="true" />
                        Take off {{ channel.name }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              <TableRow v-if="visible.length === 0">
                <TableCell :colspan="accounts.length > 1 ? 6 : 5" class="py-8 text-center text-sm text-muted-foreground">
                  No listing matches.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </template>

    <AlertDialog v-model:open="removeOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Take {{ removeTarget?.name }} off {{ channel.name }}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its calendar on {{ channel.name }} is no longer updated, so it can be double booked until you close it there.
            Existing reservations are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="confirmRemove">
            Take off
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog v-model:open="turnOffOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Turn off {{ channel.name }}?</AlertDialogTitle>
          <AlertDialogDescription>
            All {{ rows.length }} listings stop selling on {{ channel.name }}. Their calendars there are no longer updated, so they can be
            double booked. Your account details and existing reservations are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="turnOff">
            Turn off
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
