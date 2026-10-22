<script setup lang="ts">
import type { WizardStep } from './data/channel-setup'
import type { ChannelDefinition } from './data/channels'
import { computed, ref, watch } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'
import { useChannelSetup } from '~/composables/useChannelSetup'
import ChannelStepAccount from './ChannelStepAccount.vue'
import ChannelStepConnect from './ChannelStepConnect.vue'
import ChannelStepListings from './ChannelStepListings.vue'
import ChannelStepReadiness from './ChannelStepReadiness.vue'
import { isWizardStep, WIZARD_STEPS } from './data/channel-setup'
import { channelSlug } from './data/channels'

/**
 * One wizard for every channel: account and sign-in, readiness, listings,
 * connect. Only step 1 differs by channel. A step opens once the ones before it
 * are done; what the host enters is saved as they type, so leaving keeps it.
 * The step is in the URL (`?step=`) so the channel page can link straight to one.
 */
const props = defineProps<{ channel: ChannelDefinition }>()

const route = useRoute()
const router = useRouter()
// `?listing=<id>`: adding one listing from its Channels tab. The steps then only show and connect that one.
const only = typeof route.query.listing === 'string' ? [route.query.listing] : undefined
const scopedListing = computed(() => only ? listings.value.find(l => l.id === only[0]) : undefined)
const setup = useChannelSetup(props.channel.name, only)
const { mappingsForChannel } = useChannels()
const slug = channelSlug(props.channel.name)

const live = computed(() => mappingsForChannel(props.channel.name).length > 0)
const connected = ref(false)

const back = computed(() => scopedListing.value
  ? { to: `/listings/${scopedListing.value.id}?tab=channels`, label: scopedListing.value.name }
  : live.value ? { to: `/channels/${slug}`, label: props.channel.name } : { to: '/channels', label: 'Channels' })

const done = computed<Record<WizardStep, boolean>>(() => ({
  account: setup.accountComplete.value,
  readiness: setup.readinessComplete.value,
  listings: setup.listingsComplete.value,
  connect: connected.value,
}))

/** A step can be opened when every step before it is done. */
function canOpen(key: WizardStep) {
  const index = WIZARD_STEPS.findIndex(s => s.key === key)
  return WIZARD_STEPS.slice(0, index).every(s => done.value[s.key])
}

const requested = route.query.step
const step = ref<WizardStep>(isWizardStep(requested) && canOpen(requested) ? requested : setup.firstOpenStep.value)

watch(step, (value) => {
  router.replace({ query: { ...route.query, step: value } })
}, { immediate: true })

const index = computed(() => WIZARD_STEPS.findIndex(s => s.key === step.value))
const current = computed(() => WIZARD_STEPS[index.value]!)
const next = computed(() => WIZARD_STEPS[index.value + 1])
const previous = computed(() => WIZARD_STEPS[index.value - 1])

function go(key: WizardStep) {
  if (canOpen(key))
    step.value = key
}

/** Why Continue is off, in the host's words. */
const blocker = computed(() => {
  if (done.value[step.value])
    return null
  switch (step.value) {
    case 'account': return setup.missing.value.length ? `Still needed: ${setup.missing.value.join(', ')}` : 'Finish signing in first.'
    case 'readiness': return `Still needed: ${setup.gates.value.filter(g => !g.done).map(g => g.label.toLowerCase()).join(', ')}`
    case 'listings': return setup.plan.value.create.length + setup.plan.value.link.length === 0
      ? 'Pick at least one listing to put on the channel.'
      : 'Fill in the ids of every listing you link.'
    default: return null
  }
})
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <header class="flex flex-col gap-3">
      <NuxtLink :to="back.to" class="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Icon name="lucide:arrow-left" class="size-4" aria-hidden="true" />
        {{ back.label }}
      </NuxtLink>
      <div class="flex items-center gap-3">
        <div class="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background">
          <Icon :name="channel.icon" class="size-6" />
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ scopedListing ? `Add ${scopedListing.name} to ${channel.name}` : live ? `${channel.name} setup` : `Connect ${channel.name}` }}
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ channel.description }}
          </p>
        </div>
      </div>
    </header>

    <div class="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
      <nav aria-label="Setup steps">
        <ol class="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          <li v-for="(s, i) in WIZARD_STEPS" :key="s.key" class="shrink-0">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              :class="step === s.key ? 'bg-muted' : 'hover:bg-muted/60'"
              :disabled="!canOpen(s.key)"
              :aria-current="step === s.key ? 'step' : undefined"
              @click="go(s.key)"
            >
              <span
                class="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
                :class="done[s.key] ? 'border-primary bg-primary text-primary-foreground' : step === s.key ? 'border-primary text-primary' : ''"
              >
                <Icon v-if="done[s.key]" name="lucide:check" class="size-3.5" aria-hidden="true" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-medium">{{ s.title }}</span>
                <span class="hidden text-xs text-muted-foreground lg:block">{{ s.description }}</span>
              </span>
            </button>
          </li>
        </ol>
      </nav>

      <Card class="flex flex-col gap-0 p-0">
        <div class="p-5">
          <ChannelStepAccount v-if="step === 'account'" :channel-name="channel.name" />
          <ChannelStepReadiness v-else-if="step === 'readiness'" :channel-name="channel.name" />
          <ChannelStepListings v-else-if="step === 'listings'" :channel-name="channel.name" :only="only" />
          <ChannelStepConnect v-else :channel-name="channel.name" :only="only" @connected="connected = true" />
        </div>
        <footer v-if="current.key !== 'connect'" class="flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <Button v-if="previous" variant="ghost" @click="go(previous.key)">
            <Icon name="lucide:arrow-left" class="mr-1.5 size-4" aria-hidden="true" />
            {{ previous.title }}
          </Button>
          <span v-else />
          <div class="flex items-center gap-3">
            <p v-if="blocker" class="text-xs text-muted-foreground">
              {{ blocker }}
            </p>
            <Button v-if="next" :disabled="!done[step]" @click="go(next.key)">
              Continue
              <Icon name="lucide:arrow-right" class="ml-1.5 size-4" aria-hidden="true" />
            </Button>
          </div>
        </footer>
        <footer v-else-if="!connected && previous" class="border-t p-4">
          <Button variant="ghost" @click="go(previous.key)">
            <Icon name="lucide:arrow-left" class="mr-1.5 size-4" aria-hidden="true" />
            {{ previous.title }}
          </Button>
        </footer>
      </Card>
    </div>
  </div>
</template>
