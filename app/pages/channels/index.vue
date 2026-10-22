<script setup lang="ts">
import type { ChannelMappingStatus } from '~/components/channels/data/channels'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import ChannelStatusBadge from '~/components/channels/ChannelStatusBadge.vue'
import { CHANNELS, channelSlug } from '~/components/channels/data/channels'
import { formatSyncTime } from '~/components/channels/data/format'
import { WEBSITE_CHANNEL } from '~/components/channels/data/website-channel'
import WebsiteChannelSheet from '~/components/channels/WebsiteChannelSheet.vue'
import { listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'
import { useChannelFeatures, useChannelSetup } from '~/composables/useChannelSetup'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'

definePageMeta({ layout: 'default' })

const { accountsForChannel, connectedChannels, mappedListingCount, mappings, mappingsForChannel } = useChannels()
const setups = Object.fromEntries(CHANNELS.map(c => [c.name, useChannelSetup(c.name)]))

const SIGN_IN_HINT = { settings: 'Account details only', link: 'Sign-in link from Elev8', sso: `Sign in on the channel` }

const STATUSES: ChannelMappingStatus[] = ['error', 'attention', 'syncing', 'active']

const connected = computed(() => connectedChannels.value.map((channel) => {
  const rows = mappingsForChannel(channel.name)
  return {
    channel,
    slug: channelSlug(channel.name),
    total: rows.length,
    accounts: accountsForChannel(channel.name).map(a => a.accountName),
    counts: STATUSES.map(status => ({ status, count: rows.filter(m => m.status === status).length })).filter(c => c.count > 0),
  }
}))

const available = computed(() => CHANNELS
  .filter(c => !connectedChannels.value.some(k => k.name === c.name))
  .map((channel) => {
    const setup = setups[channel.name]!
    const s = setup.state.value
    const started = !!s.policy || !!s.authorisation || !!s.sso.advertiserId || Object.values(s.settings).some(v => v.trim())
    return { channel, slug: channelSlug(channel.name), started, hint: SIGN_IN_HINT[setup.spec.signIn] }
  }))

/** Listings the host should look at, across every channel. */
const problems = computed(() => {
  const byId = new Map(listings.value.map(l => [l.id, l.name]))
  return mappings.value
    .filter(m => m.status === 'error' || m.status === 'attention')
    .sort((a, b) => Number(b.status === 'error') - Number(a.status === 'error'))
    .map(m => ({ mapping: m, listingName: byId.get(m.listingId) ?? m.listingId, slug: channelSlug(m.channel) }))
})

const sentence = computed(() => {
  const total = listings.value.length
  if (connectedChannels.value.length === 0)
    return `None of your ${total} listings sell on a channel yet.`
  const n = connectedChannels.value.length
  const sold = mappedListingCount.value === total ? `All ${total} listings sell` : `${mappedListingCount.value} of your ${total} listings sell`
  return `${sold} on ${n} ${n === 1 ? 'channel' : 'channels'}.`
})

const { currencyFx, webhook, setUpWebhookAgain } = useChannelFeatures()

const webhookOk = computed(() => webhook.value.bookings && webhook.value.messages)
const settingUp = ref(false)

async function redoWebhook() {
  settingUp.value = true
  await setUpWebhookAgain()
  settingUp.value = false
  toast.success('Bookings and messages set up again')
}

function setCurrencyFx(on: boolean) {
  currencyFx.value = on
  toast.success(on ? 'Currency conversion on' : 'Currency conversion off', {
    description: on ? 'Channels that sell in another currency get your prices converted at the daily rate.' : 'Every channel gets your listings\' own currency again.',
  })
}

// Website channel: direct bookings, no OTA account, managed in its own sheet.
const { websiteChannel, hydrate: hydrateWebsite, enable: enableWebsite, disable: disableWebsite } = useWebsiteChannel()
onMounted(hydrateWebsite)

const websiteOpen = ref(false)
const websiteStart = ref<'list' | 'new'>('list')
const removeWebsiteOpen = ref(false)

/** Adding opens a new rule set; the channel is added when it is saved. A channel removed earlier comes back with its rule sets. */
function openWebsite() {
  if (!websiteChannel.value.enabled && websiteChannel.value.ruleSets.length > 0) {
    enableWebsite()
    toast.success('Website channel added back', { description: 'Its rule sets are restored.' })
  }
  websiteStart.value = websiteChannel.value.enabled ? 'list' : 'new'
  websiteOpen.value = true
}

function confirmRemoveWebsite() {
  disableWebsite()
  websiteOpen.value = false
  toast.info('Website channel removed', { description: 'Its settings are kept if you add it again.' })
}
</script>

<template>
  <div class="flex w-full flex-col gap-8">
    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight">
        Channels
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ sentence }}
      </p>
    </header>

    <section v-if="problems.length" class="flex flex-col gap-3" aria-labelledby="channels-problems">
      <h2 id="channels-problems" class="text-base font-semibold">
        Needs a look
      </h2>
      <ul class="flex flex-col divide-y rounded-lg border">
        <li v-for="p in problems" :key="p.mapping.id" class="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">
              {{ p.listingName }} <span class="font-normal text-muted-foreground">on {{ p.mapping.channel }}</span>
            </p>
            <p class="text-xs text-muted-foreground">
              {{ p.mapping.error }}
            </p>
          </div>
          <ChannelStatusBadge :status="p.mapping.status" class="w-fit" />
          <Button size="sm" variant="outline" class="w-fit" as-child>
            <NuxtLink :to="`/channels/${p.slug}`">
              Open {{ p.mapping.channel }}
            </NuxtLink>
          </Button>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="channels-yours">
      <h2 id="channels-yours" class="text-base font-semibold">
        Your channels
      </h2>
      <div v-if="connected.length || websiteChannel.enabled" class="flex flex-col divide-y rounded-lg border">
        <NuxtLink
          v-for="row in connected"
          :key="row.channel.name"
          :to="`/channels/${row.slug}`"
          class="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Icon :name="row.channel.icon" class="size-6" />
          </span>
          <span class="min-w-[160px] flex-1">
            <span class="block text-sm font-semibold">{{ row.channel.name }}</span>
            <span class="block text-xs text-muted-foreground">
              {{ row.total }} of {{ listings.length }} listings · {{ row.accounts.join(', ') }}
            </span>
          </span>
          <span class="flex flex-wrap items-center gap-1.5">
            <span v-for="c in row.counts" :key="c.status" class="inline-flex items-center gap-1">
              <ChannelStatusBadge :status="c.status" />
              <span class="text-xs tabular-nums text-muted-foreground">{{ c.count }}</span>
            </span>
          </span>
          <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </NuxtLink>
        <button
          v-if="websiteChannel.enabled"
          type="button"
          class="flex flex-wrap items-center gap-3 p-4 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
          @click="openWebsite"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Icon :name="WEBSITE_CHANNEL.icon" class="size-6" />
          </span>
          <span class="min-w-[160px] flex-1">
            <span class="block text-sm font-semibold">{{ WEBSITE_CHANNEL.name }}</span>
            <span class="block text-xs text-muted-foreground">Direct bookings on your websites and booking widgets</span>
          </span>
          <span class="text-xs text-muted-foreground">Rule sets</span>
          <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
      <p v-else class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No channel connected yet. Pick one below.
      </p>
    </section>

    <section v-if="available.length || !websiteChannel.enabled" class="flex flex-col gap-3" aria-labelledby="channels-add">
      <div>
        <h2 id="channels-add" class="text-base font-semibold">
          Add a channel
        </h2>
        <p class="text-xs text-muted-foreground">
          Four steps: account, readiness, listings, connect.
        </p>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
        <Card v-for="a in available" :key="a.channel.name" class="flex flex-col gap-3 p-4">
          <div class="flex items-start justify-between gap-2">
            <span class="flex size-10 items-center justify-center rounded-lg border bg-background">
              <Icon :name="a.channel.icon" class="size-6" />
            </span>
            <Badge v-if="a.started" variant="outline">
              Started
            </Badge>
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold">
              {{ a.channel.name }}
            </p>
            <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {{ a.channel.description }}
            </p>
          </div>
          <div class="flex items-center justify-between gap-2 border-t pt-3">
            <span class="text-xs text-muted-foreground">{{ a.hint }}</span>
            <Button size="sm" :variant="a.started ? 'default' : 'outline'" as-child>
              <NuxtLink :to="`/channels/${a.slug}/connect`">
                {{ a.started ? 'Continue' : 'Connect' }}
              </NuxtLink>
            </Button>
          </div>
        </Card>
        <Card v-if="!websiteChannel.enabled" class="flex flex-col gap-3 p-4">
          <span class="flex size-10 items-center justify-center rounded-lg border bg-background">
            <Icon :name="WEBSITE_CHANNEL.icon" class="size-6" />
          </span>
          <div class="flex-1">
            <p class="text-sm font-semibold">
              {{ WEBSITE_CHANNEL.name }}
            </p>
            <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {{ WEBSITE_CHANNEL.description }}
            </p>
          </div>
          <div class="flex items-center justify-between gap-2 border-t pt-3">
            <span class="text-xs text-muted-foreground">Rule sets, no account</span>
            <Button size="sm" variant="outline" @click="openWebsite">
              Add
            </Button>
          </div>
        </Card>
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="channels-account">
      <h2 id="channels-account" class="text-base font-semibold">
        For every channel
      </h2>
      <div class="flex flex-wrap items-start gap-3 rounded-lg border p-4" data-testid="channels-webhook">
        <Icon name="lucide:radio-tower" class="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div class="min-w-[200px] flex-1">
          <p class="flex flex-wrap items-center gap-2 text-sm font-medium">
            Bookings and guest messages
            <Badge
              variant="outline"
              :class="webhookOk ? 'border-green-500/40 text-green-700 dark:text-green-400' : 'border-destructive/40 text-destructive'"
            >
              {{ webhookOk ? 'Arriving on their own' : 'Not arriving' }}
            </Badge>
          </p>
          <p class="text-xs text-muted-foreground">
            New bookings, requests and messages from every channel land in Reservations and the Inbox. Set up {{ formatSyncTime(webhook.setUpAt) }}.
            Missing one? Use Sync bookings on Reservations.
          </p>
        </div>
        <Button variant="outline" size="sm" :disabled="settingUp" @click="redoWebhook">
          <Icon v-if="settingUp" name="lucide:loader-circle" class="mr-1.5 size-4 animate-spin" aria-hidden="true" />
          Set up again
        </Button>
      </div>
      <div class="flex items-start gap-3 rounded-lg border p-4">
        <Icon name="lucide:arrow-left-right" class="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">
            Convert prices to each channel's currency
          </p>
          <p class="text-xs text-muted-foreground">
            Off: every channel gets the listing's own currency. On: a channel that sells in another currency gets your prices
            converted at the daily exchange rate, so what guests pay there can differ from your price. Elev8 keeps your amounts as they are.
          </p>
        </div>
        <Switch :model-value="currencyFx" aria-label="Convert prices to each channel's currency" @update:model-value="v => setCurrencyFx(!!v)" />
      </div>
      <p class="text-xs text-muted-foreground">
        Rate plans, promotions and price adjustments are set per listing, in its Pricing tab.
      </p>
    </section>

    <WebsiteChannelSheet v-model:open="websiteOpen" :start="websiteStart" @remove="removeWebsiteOpen = true" />

    <AlertDialog v-model:open="removeWebsiteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove the Website channel?</AlertDialogTitle>
          <AlertDialogDescription>
            Your websites stop taking direct bookings under these rule sets, and booking widgets that use one go back to their own
            discounts. Existing reservations are not affected, and the rule sets are kept if you add the channel again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="confirmRemoveWebsite">
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
