<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useChannels } from '~/composables/useChannels'
import ChannelStatusBadge from './ChannelStatusBadge.vue'
import { channelContentChecks, CONTENT_CHECKS } from './data/channel-content'
import { channelListingUrl, CHANNELS, channelSlug } from './data/channels'
import { formatSyncTime } from './data/format'

/**
 * One listing across every channel: where it sells and how it is doing there,
 * what each channel still misses in its content (fixed in Listing Setup), and
 * sending the content again. Adding it to a channel goes through the connect
 * wizard, scoped to this listing.
 */
const props = defineProps<{ listing: Listing }>()

const { getAccount, getMapping, isConnected, resync, disconnectListing } = useChannels()

const rows = computed(() => CHANNELS.filter(c => isConnected(c.name)).map((channel) => {
  const mapping = getMapping(props.listing.id, channel.name)
  const account = mapping ? getAccount(mapping.accountId) : undefined
  const checks = channelContentChecks(props.listing, channel.name)
  return {
    channel,
    slug: channelSlug(channel.name),
    mapping,
    url: mapping ? channelListingUrl(channel.name, mapping.externalId, account?.propertyId) : null,
    checks,
  }
}))
const notConnected = computed(() => CHANNELS.filter(c => !isConnected(c.name)))
const onChannels = computed(() => rows.value.filter(r => r.mapping))

const addLink = (slug: string) => `/channels/${slug}/connect?step=listings&listing=${props.listing.id}`
const fixLink = (section: string) => `/listings/${props.listing.id}/setup?section=${section}`

async function syncAgain(channel: string) {
  const mapping = getMapping(props.listing.id, channel)
  if (!mapping)
    return
  await resync(mapping.id)
  toast.success(`${props.listing.name} sent to ${channel} again`)
}

// sync-content REPLACES photos and descriptions on the channel, so it asks first.
const sendOpen = ref(false)

async function sendContent() {
  const targets = onChannels.value.map(r => r.mapping!)
  toast.info(`Sending content to ${targets.length} ${targets.length === 1 ? 'channel' : 'channels'}...`)
  await Promise.all(targets.map(m => resync(m.id)))
  toast.success('Content sent', { description: 'Photos and descriptions on the channels now match Elev8.' })
}

const takeOffChannel = ref<string | null>(null)
const takeOffOpen = ref(false)

function askTakeOff(channel: string) {
  takeOffChannel.value = channel
  takeOffOpen.value = true
}

function confirmTakeOff() {
  if (!takeOffChannel.value)
    return
  disconnectListing(props.listing.id, takeOffChannel.value)
  toast.info(`${props.listing.name} taken off ${takeOffChannel.value}`)
  takeOffChannel.value = null
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="flex flex-col gap-3" aria-labelledby="listing-channels-title">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="listing-channels-title" class="text-base font-semibold">
            Where this listing sells
          </h2>
          <p class="text-sm text-muted-foreground">
            {{ onChannels.length }} of {{ rows.length }} connected channels
          </p>
        </div>
        <Button variant="outline" :disabled="onChannels.length === 0" @click="sendOpen = true">
          <Icon name="lucide:send" class="mr-1.5 size-4" aria-hidden="true" />
          Send content to channels
        </Button>
      </div>

      <div v-if="rows.length" class="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channel ID</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead class="w-12">
                <span class="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.channel.name" class="align-top">
              <TableCell>
                <NuxtLink :to="`/channels/${row.slug}`" class="flex items-center gap-2 font-medium hover:underline">
                  <Icon :name="row.channel.icon" class="size-5" aria-hidden="true" />
                  {{ row.channel.name }}
                </NuxtLink>
              </TableCell>
              <TableCell class="min-w-[200px] max-w-sm whitespace-normal">
                <ChannelStatusBadge :status="row.mapping?.status ?? null" />
                <p
                  v-if="row.mapping?.error"
                  class="mt-1.5 text-xs"
                  :class="row.mapping.status === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'"
                >
                  {{ row.mapping.error }}
                </p>
              </TableCell>
              <TableCell>
                <template v-if="row.mapping">
                  <a
                    v-if="row.url"
                    :href="row.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-sm tabular-nums hover:underline"
                    :aria-label="`Open ${listing.name} on ${row.channel.name}`"
                  >
                    {{ row.mapping.externalId }}
                    <Icon name="lucide:external-link" class="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </a>
                  <span v-else class="text-sm tabular-nums">{{ row.mapping.externalId }}</span>
                </template>
              </TableCell>
              <TableCell class="whitespace-nowrap text-sm text-muted-foreground">
                <template v-if="row.mapping">
                  {{ row.mapping.status === 'syncing' ? 'Now' : formatSyncTime(row.mapping.lastSyncAt) }}
                </template>
              </TableCell>
              <TableCell>
                <DropdownMenu v-if="row.mapping">
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions for ${row.channel.name}`">
                      <Icon name="lucide:ellipsis" class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-52">
                    <DropdownMenuItem :disabled="row.mapping.status === 'syncing'" @select="syncAgain(row.channel.name)">
                      <Icon name="lucide:refresh-cw" class="size-4" aria-hidden="true" />
                      Sync again
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem class="text-destructive focus:text-destructive" @select="askTakeOff(row.channel.name)">
                      <Icon name="lucide:circle-minus" class="size-4" aria-hidden="true" />
                      Take off {{ row.channel.name }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button v-else size="sm" variant="outline" as-child>
                  <NuxtLink :to="addLink(row.slug)">
                    Add
                  </NuxtLink>
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p v-if="notConnected.length" class="text-xs text-muted-foreground">
        Not connected yet: {{ notConnected.map(c => c.name).join(', ') }}.
        <NuxtLink to="/channels" class="text-primary hover:underline">
          Connect a channel
        </NuxtLink>
      </p>
    </section>

    <section v-if="rows.length" class="flex flex-col gap-3" aria-labelledby="listing-content-title">
      <div>
        <h2 id="listing-content-title" class="text-base font-semibold">
          Content check
        </h2>
        <p class="text-sm text-muted-foreground">
          What each channel needs from this listing. A red mark stops the channel from publishing it.
        </p>
      </div>
      <div class="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content</TableHead>
              <TableHead v-for="row in rows" :key="row.channel.name" class="text-center">
                <span class="inline-flex items-center gap-1.5">
                  <Icon :name="row.channel.icon" class="size-4" aria-hidden="true" />
                  {{ row.channel.name }}
                </span>
              </TableHead>
              <TableHead class="w-20">
                <span class="sr-only">Fix</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(check, i) in CONTENT_CHECKS" :key="check.key">
              <TableCell class="font-medium">
                {{ check.label }}
              </TableCell>
              <TableCell v-for="row in rows" :key="row.channel.name" class="text-center">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="inline-flex" tabindex="0" :aria-label="`${check.label} on ${row.channel.name}: ${row.checks[i]!.ok ? 'ready' : row.checks[i]!.detail}`">
                      <Icon v-if="row.checks[i]!.ok" name="lucide:circle-check" class="size-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                      <Icon v-else-if="row.checks[i]!.blocking" name="lucide:circle-x" class="size-4 text-destructive" aria-hidden="true" />
                      <Icon v-else name="lucide:triangle-alert" class="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="text-xs">
                    {{ row.checks[i]!.ok ? 'Ready' : row.checks[i]!.detail }}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <NuxtLink
                  v-if="rows.some(r => !r.checks[i]!.ok)"
                  :to="fixLink(check.section)"
                  class="text-sm text-primary hover:underline"
                >
                  Fix
                </NuxtLink>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>

    <AlertDialog v-model:open="sendOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send content to {{ onChannels.map(r => r.channel.name).join(', ') }}?</AlertDialogTitle>
          <AlertDialogDescription>
            The photos and descriptions on these channels are replaced with the ones in Elev8. Changes made directly on a
            channel are lost. Prices, calendar and reservations are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="sendContent">
            Send content
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog v-model:open="takeOffOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Take {{ listing.name }} off {{ takeOffChannel }}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its calendar on {{ takeOffChannel }} is no longer updated, so it can be double booked until you close it there.
            Existing reservations are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="confirmTakeOff">
            Take off
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
