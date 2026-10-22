<script setup lang="ts">
import type { ConnectResult } from './data/nextpax'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { cancellationPolicyOptions, listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'
import { useChannelSetup } from '~/composables/useChannelSetup'
import ChannelStatusBadge from './ChannelStatusBadge.vue'
import { ratePlanPairs, settingLabel } from './data/channel-setup'
import { channelSlug } from './data/channels'
import { NEXTPAX_PAYMENT_METHODS } from './data/nextpax-mock'

/** Step 4: one look at what goes out, then the connect and its result per listing. */
const props = defineProps<{ channelName: string, only?: string[] }>()
const emit = defineEmits<{ connected: [] }>()

const setup = useChannelSetup(props.channelName, props.only)
const { getMapping } = useChannels()
const spec = setup.spec

const names = computed(() => new Map(listings.value.map(l => [l.id, l])))
const nameOf = (id: string) => names.value.get(id)?.name ?? id

const SIGN_IN_LABEL = { settings: 'Account details', link: 'Sign-in link', sso: 'Signed in on the channel' }
const policyLabel = computed(() => cancellationPolicyOptions.find(o => o.value === setup.state.value.policy)?.label ?? 'Not set')
const paymentLabels = computed(() => NEXTPAX_PAYMENT_METHODS.filter(m => setup.paymentMethods.value.includes(m.value)).map(m => m.label).join(', '))
/** "Villa Sari (4242, 2 rate plans paired)". */
function linkedLabel(id: string) {
  const choice = setup.choiceFor(id)
  const pairs = ratePlanPairs(choice).length
  return `${nameOf(id)} (${choice.propertyId}${pairs ? `, ${pairs} ${pairs === 1 ? 'rate plan' : 'rate plans'} paired` : ''})`
}

const goingOut = computed(() => setup.plan.value.create.length + setup.plan.value.link.length)
const shortOnPhotos = computed(() => [...setup.plan.value.create, ...setup.plan.value.link]
  .filter(id => (names.value.get(id)?.photos.length ?? 0) < spec.minPhotos)
  .length)

const connecting = ref(false)
const result = ref<ConnectResult | null>(null)

async function connect() {
  connecting.value = true
  const res = await setup.connect()
  connecting.value = false
  if (!res) {
    toast.error(`Could not connect ${props.channelName}`, { description: 'A step is not finished yet.' })
    return
  }
  result.value = res
  emit('connected')
}

// Read live, so a row moves from Syncing to Live while the host watches.
const resultRows = computed(() => (result.value?.properties ?? []).map(p => ({
  id: p.property_id,
  name: nameOf(p.property_id),
  mapping: getMapping(p.property_id, props.channelName),
  rejected: !p.enabled ? p.error ?? 'Rejected by the channel' : null,
})))
const attentionCount = computed(() => resultRows.value.filter(r => r.rejected || r.mapping?.status === 'attention' || r.mapping?.status === 'error').length)
</script>

<template>
  <div class="flex flex-col gap-6">
    <template v-if="!result">
      <div>
        <h2 class="text-base font-semibold">
          Ready to connect
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ channelName }} builds each listing in a few minutes. You can leave this page; the status keeps updating.
        </p>
      </div>

      <dl class="grid gap-x-6 gap-y-4 rounded-lg border p-4 text-sm sm:grid-cols-[160px_1fr]">
        <dt class="text-muted-foreground">
          Account
        </dt>
        <dd>
          {{ SIGN_IN_LABEL[spec.signIn] }}
          <span v-for="def in spec.settings" :key="def.settingName" class="block text-xs text-muted-foreground">
            {{ settingLabel(def.settingName) }}: {{ setup.state.value.settings[def.settingName] || 'Not set' }}
          </span>
        </dd>
        <dt class="text-muted-foreground">
          Cancellation policy
        </dt>
        <dd>{{ policyLabel }}</dd>
        <template v-if="spec.needsPaymentMethods">
          <dt class="text-muted-foreground">
            Payment methods
          </dt>
          <dd>{{ paymentLabels }}</dd>
        </template>
        <dt class="text-muted-foreground">
          Listings
        </dt>
        <dd class="flex flex-col gap-2">
          <p v-if="setup.plan.value.create.length">
            <span class="font-medium">{{ setup.plan.value.create.length }} new:</span>
            {{ setup.plan.value.create.map(nameOf).join(', ') }}
          </p>
          <p v-if="setup.plan.value.link.length">
            <span class="font-medium">{{ setup.plan.value.link.length }} linked:</span>
            {{ setup.plan.value.link.map(linkedLabel).join(', ') }}
          </p>
          <p v-if="setup.plan.value.skip.length" class="text-muted-foreground">
            {{ setup.plan.value.skip.length }} skipped
          </p>
          <p v-if="shortOnPhotos" class="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <Icon name="lucide:triangle-alert" class="size-3" aria-hidden="true" />
            {{ shortOnPhotos }} {{ shortOnPhotos === 1 ? 'listing has' : 'listings have' }} fewer than {{ spec.minPhotos }} photos.
            {{ channelName }} may hold them back.
          </p>
        </dd>
      </dl>

      <div class="flex items-center gap-3">
        <Button :disabled="connecting || goingOut === 0" @click="connect">
          <Icon v-if="connecting" name="lucide:loader-circle" class="mr-1.5 size-4 animate-spin" aria-hidden="true" />
          {{ connecting ? 'Connecting...' : `Connect ${goingOut} ${goingOut === 1 ? 'listing' : 'listings'}` }}
        </Button>
        <p v-if="connecting" class="text-xs text-muted-foreground" aria-live="polite">
          Sending your listings to {{ channelName }}.
        </p>
      </div>
    </template>

    <template v-else>
      <div class="flex items-start gap-3">
        <Icon
          :name="attentionCount ? 'lucide:triangle-alert' : 'lucide:circle-check'"
          class="mt-0.5 size-5 shrink-0"
          :class="attentionCount ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'"
          aria-hidden="true"
        />
        <div>
          <h2 class="text-base font-semibold">
            {{ result.enabled }} {{ result.enabled === 1 ? 'listing' : 'listings' }} sent to {{ channelName }}
          </h2>
          <p class="text-sm text-muted-foreground">
            <template v-if="attentionCount">
              {{ attentionCount }} {{ attentionCount === 1 ? 'needs' : 'need' }} a look. The reason is under each one.
            </template>
            <template v-else>
              Each one goes live once {{ channelName }} has built it.
            </template>
          </p>
        </div>
      </div>

      <ul class="flex flex-col divide-y rounded-lg border" aria-live="polite">
        <li v-for="row in resultRows" :key="row.id" class="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:gap-3">
          <p class="min-w-0 flex-1 text-sm font-medium">
            {{ row.name }}
          </p>
          <div class="flex flex-col items-start gap-1 sm:max-w-sm sm:items-end sm:text-right">
            <ChannelStatusBadge v-if="!row.rejected" :status="row.mapping?.status ?? null" />
            <Badge v-else variant="outline" class="border-destructive/40 text-destructive">
              Rejected
            </Badge>
            <p v-if="row.rejected || row.mapping?.error" class="text-xs" :class="row.rejected || row.mapping?.status === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'">
              {{ row.rejected ?? row.mapping?.error }}
            </p>
          </div>
        </li>
      </ul>

      <div class="flex flex-wrap gap-2">
        <Button v-if="only?.length === 1" as-child>
          <NuxtLink :to="`/listings/${only[0]}?tab=channels`">
            Back to {{ nameOf(only[0]!) }}
          </NuxtLink>
        </Button>
        <Button :variant="only?.length === 1 ? 'outline' : 'default'" as-child>
          <NuxtLink :to="`/channels/${channelSlug(channelName)}`">
            Go to {{ channelName }}
          </NuxtLink>
        </Button>
      </div>
    </template>
  </div>
</template>
