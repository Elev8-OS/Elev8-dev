<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useChannelSetup } from '~/composables/useChannelSetup'
import { settingLabel } from './data/channel-setup'
import { authorisationAge } from './data/nextpax'

/** Step 1: the account details the channel needs, then sign-in the channel's own way. */
const props = defineProps<{ channelName: string }>()

const setup = useChannelSetup(props.channelName)
const spec = setup.spec

const linkDraft = ref('')
const linkError = ref<string | null>(null)
const replacingLink = ref(false)
const age = computed(() => authorisationAge(setup.state.value.authorisation?.setAt))

function saveLink() {
  linkError.value = setup.saveAuthorisation(linkDraft.value)
  if (linkError.value)
    return
  linkDraft.value = ''
  replacingLink.value = false
  toast.success('Sign-in link saved')
}

const sso = computed(() => setup.state.value.sso)
const requesting = ref(false)

async function requestSso() {
  requesting.value = true
  await setup.requestSsoLink()
  requesting.value = false
}

function openSso() {
  if (sso.value.link)
    window.open(sso.value.link, '_blank', 'noopener')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section v-if="spec.settings.length" class="flex flex-col gap-4">
      <div>
        <h2 class="text-base font-semibold">
          Account details
        </h2>
        <p class="text-sm text-muted-foreground">
          How {{ channelName }} recognises your account. You find these in your {{ channelName }} extranet.
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div v-for="def in spec.settings" :key="def.settingName" class="flex flex-col gap-1.5">
          <Label :for="`setting-${def.settingName}`">
            {{ settingLabel(def.settingName) }}<span v-if="def.settingRequired" class="text-destructive" aria-hidden="true"> *</span>
          </Label>
          <Select
            v-if="def.settingType === 'select'"
            :model-value="setup.state.value.settings[def.settingName] ?? ''"
            @update:model-value="v => setup.setSetting(def.settingName, String(v ?? ''))"
          >
            <SelectTrigger :id="`setting-${def.settingName}`" class="w-full">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in def.settingOptions" :key="option" :value="option">
                {{ option }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-else
            :id="`setting-${def.settingName}`"
            :model-value="setup.state.value.settings[def.settingName] ?? ''"
            :inputmode="def.settingType === 'number' ? 'numeric' : undefined"
            @update:model-value="v => setup.setSetting(def.settingName, String(v))"
          />
          <p class="text-xs text-muted-foreground">
            {{ def.settingDescription }}
            <template v-if="def.availableOnPropertyLevel">
              A listing can have its own in the Listings step.
            </template>
          </p>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <div>
        <h2 class="text-base font-semibold">
          Sign in
        </h2>
        <p v-if="spec.signIn === 'settings'" class="text-sm text-muted-foreground">
          Nothing to sign in to. {{ spec.settings.length ? 'The details above are' : 'Elev8 uses your Elev8 account as' }} your
          {{ channelName }} connection.
        </p>
        <p v-else-if="spec.signIn === 'link'" class="text-sm text-muted-foreground">
          Elev8 sends you a personal {{ channelName }} sign-in link. Open it and approve Elev8 in your {{ channelName }} account.
        </p>
        <p v-else class="text-sm text-muted-foreground">
          Sign in on {{ channelName }} with your advertiser account, then let Elev8 match your properties.
        </p>
      </div>

      <!-- Airbnb: a link Elev8 prepares, pasted here until it can be requested from the dashboard. -->
      <template v-if="spec.signIn === 'link'">
        <div v-if="setup.state.value.authorisation && !replacingLink" class="flex flex-col gap-3 rounded-lg border p-4">
          <div class="flex flex-wrap items-center gap-2">
            <Icon name="lucide:circle-check" class="size-4 text-green-600 dark:text-green-400" aria-hidden="true" />
            <p class="text-sm font-medium">
              Sign-in link ready
            </p>
            <Badge variant="outline" :class="age.stale ? 'border-amber-500/40 text-amber-700 dark:text-amber-400' : ''">
              {{ age.label }}
            </Badge>
          </div>
          <p v-if="age.stale" class="text-xs text-amber-700 dark:text-amber-400">
            Sign-in links expire. Ask Elev8 for a new one if {{ channelName }} says this one is no longer valid.
          </p>
          <div class="flex flex-wrap gap-2">
            <Button as-child>
              <a :href="setup.state.value.authorisation.url" target="_blank" rel="noopener noreferrer">
                <Icon name="lucide:external-link" class="mr-1.5 size-4" aria-hidden="true" />
                Sign in with {{ channelName }}
              </a>
            </Button>
            <Button variant="ghost" @click="replacingLink = true">
              Replace link
            </Button>
          </div>
        </div>
        <div v-else class="flex flex-col gap-1.5">
          <Label for="authorisation-link">Sign-in link from Elev8</Label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <Input
              id="authorisation-link"
              v-model="linkDraft"
              placeholder="https://"
              :aria-invalid="!!linkError"
              @keydown.enter.prevent="saveLink"
            />
            <Button :disabled="!linkDraft.trim()" @click="saveLink">
              Save link
            </Button>
            <Button v-if="replacingLink" variant="ghost" @click="replacingLink = false">
              Cancel
            </Button>
          </div>
          <p v-if="linkError" class="text-xs text-destructive">
            {{ linkError }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            No link yet? Elev8 support prepares it within one working day.
          </p>
        </div>
      </template>

      <!-- Vrbo: advertiser id, the channel's own sign-in, then confirm the property match. -->
      <template v-else-if="spec.signIn === 'sso'">
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <Label for="sso-advertiser">Advertiser ID<span class="text-destructive" aria-hidden="true"> *</span></Label>
            <Input id="sso-advertiser" :model-value="sso.advertiserId" @update:model-value="v => setup.setSso({ advertiserId: String(v), link: null, signedIn: false })" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="sso-company">Company name</Label>
            <Input id="sso-company" :model-value="sso.companyName" @update:model-value="v => setup.setSso({ companyName: String(v) })" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="sso-email">Email</Label>
            <Input id="sso-email" type="email" :model-value="sso.email" @update:model-value="v => setup.setSso({ email: String(v) })" />
          </div>
        </div>

        <ol class="flex flex-col gap-2">
          <li class="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium" :class="sso.link ? 'border-primary bg-primary text-primary-foreground' : ''">
              <Icon v-if="sso.link" name="lucide:check" class="size-3.5" aria-hidden="true" />
              <template v-else>1</template>
            </span>
            <p class="min-w-0 flex-1 text-sm">
              Get your {{ channelName }} sign-in link
            </p>
            <Button size="sm" :variant="sso.link ? 'ghost' : 'default'" :disabled="!sso.advertiserId.trim() || requesting" @click="requestSso">
              <Icon v-if="requesting" name="lucide:loader-circle" class="mr-1.5 size-4 animate-spin" aria-hidden="true" />
              {{ sso.link ? 'Get a new link' : 'Get link' }}
            </Button>
          </li>
          <li class="flex flex-wrap items-center gap-3 rounded-lg border p-3" :class="sso.link ? '' : 'opacity-50'">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium" :class="sso.signedIn ? 'border-primary bg-primary text-primary-foreground' : ''">
              <Icon v-if="sso.signedIn" name="lucide:check" class="size-3.5" aria-hidden="true" />
              <template v-else>2</template>
            </span>
            <p class="min-w-0 flex-1 text-sm">
              Sign in on {{ channelName }} and approve Elev8
            </p>
            <div class="flex gap-2">
              <Button size="sm" variant="outline" :disabled="!sso.link" @click="openSso">
                <Icon name="lucide:external-link" class="mr-1.5 size-4" aria-hidden="true" />
                Open {{ channelName }}
              </Button>
              <Button size="sm" :disabled="!sso.link || sso.signedIn" @click="setup.setSso({ signedIn: true })">
                I have signed in
              </Button>
            </div>
          </li>
          <li class="flex items-center gap-3 rounded-lg border p-3" :class="sso.signedIn ? '' : 'opacity-50'">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">3</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm">
                Match my {{ channelName }} properties to Elev8 listings
              </p>
              <p class="text-xs text-muted-foreground">
                {{ channelName }} keeps your existing listings and reviews. Turn off only if Elev8 should create new ones.
              </p>
            </div>
            <Switch
              :model-value="sso.confirmMapping"
              :disabled="!sso.signedIn"
              aria-label="Match existing properties"
              @update:model-value="v => setup.setSso({ confirmMapping: !!v })"
            />
          </li>
        </ol>
      </template>
    </section>

    <p v-if="setup.missing.value.length" class="text-xs text-muted-foreground">
      Still needed: {{ setup.missing.value.join(', ') }}
    </p>
  </div>
</template>
