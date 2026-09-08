<script setup lang="ts">
import type { CalryProvider } from '~/components/onboarding/data/onboarding'
import { toast } from 'vue-sonner'
import {
  CALRY_PROVIDERS,
  getPmsLogo,
  searchProviders,
} from '~/components/onboarding/data/onboarding'

const emit = defineEmits<{ (e: 'connected'): void }>()

const { connectPms, isConnectingPms, state } = useOnboarding()

const query = ref('')
const selected = ref<string | null>(state.value.connection?.provider ?? null)
const authError = ref('')
/** Demo switch so the Calry failure path can be exercised. */
const simulateFailure = ref(false)
const requestOpen = ref(false)
const requestName = ref('')

// Connect PMS Secret Key modal state
const connectDialogOpen = ref(false)
const activeProvider = ref<CalryProvider | null>(null)
const clientId = ref('')
const secretKey = ref('')
const showSecretKey = ref(false)
const secretKeyError = ref('')
const dialogAuthError = ref('')

const results = computed(() => searchProviders(query.value))

function getPmsInstruction(id: string, name: string): string {
  switch (id) {
    case 'guesty':
      return 'In your Guesty account, go to Integrations → Marketplace → ELEV8 or Open API to copy your Client ID and Client Secret.'
    case 'smoobu':
      return 'In your Smoobu account, go to Settings → For Developers → API to generate and copy your API Key.'
    case 'hostaway':
      return 'In your Hostaway account, go to Settings → Integrations → API to copy your Account ID and API Secret.'
    case 'lodgify':
      return 'In your Lodgify account, go to Settings → Public API to create and copy your API Token.'
    case 'beds24':
      return 'In your Beds24 account, go to Settings → Account → Access to generate your Invite Code / API Key.'
    default:
      return `In your ${name} dashboard, navigate to Settings → Integrations → API to find your Secret Key or Token.`
  }
}

function openConnectDialog(provider: CalryProvider): void {
  activeProvider.value = provider
  dialogAuthError.value = ''
  secretKeyError.value = ''
  if (selected.value !== provider.id) {
    secretKey.value = ''
    clientId.value = ''
  }
  connectDialogOpen.value = true
}

async function handleConnectWithKey(): Promise<void> {
  if (!activeProvider.value)
    return
  if (!secretKey.value.trim()) {
    secretKeyError.value = 'Secret key is required to connect.'
    return
  }
  secretKeyError.value = ''
  dialogAuthError.value = ''
  authError.value = ''

  selected.value = activeProvider.value.id
  const result = await connectPms(activeProvider.value.id, { fail: simulateFailure.value })
  if (!result.ok) {
    dialogAuthError.value = result.message
    authError.value = result.message
    selected.value = null
    return
  }
  connectDialogOpen.value = false
  toast.success(result.message)
  emit('connected')
}

async function submit(): Promise<void> {
  if (!selected.value) {
    toast.error('Please select a system to connect.')
    return
  }
  if (!secretKey.value.trim()) {
    const provider = CALRY_PROVIDERS.find(p => p.id === selected.value)
    if (provider) {
      openConnectDialog(provider)
      toast.info(`Please enter your Secret Key for ${provider.name}.`)
      return
    }
  }
  authError.value = ''
  dialogAuthError.value = ''
  const result = await connectPms(selected.value, { fail: simulateFailure.value })
  if (!result.ok) {
    // Nothing is stored on failure, so the tenant restarts from the picker.
    authError.value = result.message
    selected.value = null
    return
  }
  toast.success(result.message)
  emit('connected')
}

function sendRequest(): void {
  if (!requestName.value.trim())
    return
  requestOpen.value = false
  toast.success(`Thanks. We will look into ${requestName.value.trim()} and get back to you.`)
  requestName.value = ''
}
</script>

<template>
  <form id="ob-connect-pms-form" class="flex flex-col gap-6" @submit.prevent="submit">
    <div>
      <h3 class="text-sm font-semibold">
        Which system are you using today?
      </h3>
      <p class="text-xs text-muted-foreground">
        {{ state.pmsModel === 'MIGRATION'
          ? 'We import your listings, reservations and guests once, then you run everything in ELEV8.'
          : 'ELEV8 keeps your listings and reservations in sync with this system.' }}
      </p>
    </div>

    <div class="relative">
      <Icon name="lucide:search" class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="query" class="pl-8" placeholder="Search systems" aria-label="Search systems" />
    </div>

    <div v-if="authError" class="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
      <Icon name="lucide:circle-alert" class="mt-0.5 size-4 shrink-0 text-destructive" />
      <p class="text-xs leading-relaxed text-destructive">
        {{ authError }}
      </p>
    </div>

    <div class="flex flex-col gap-4">
      <section v-if="results.popular.length > 0" class="flex flex-col gap-2">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Most used
        </p>
        <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="provider in results.popular"
            :key="provider.id"
            type="button"
            class="group flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all hover:border-primary/60 cursor-pointer shadow-xs"
            :class="selected === provider.id ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border/80 bg-card hover:bg-muted/20'"
            :aria-pressed="selected === provider.id"
            @click="openConnectDialog(provider)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="flex size-7 shrink-0 items-center justify-center rounded-lg shadow-2xs transition-transform group-hover:scale-105"
                :style="{ backgroundColor: getPmsLogo(provider.id).bg, color: getPmsLogo(provider.id).color }"
                v-html="getPmsLogo(provider.id).svg"
              />
              <span class="truncate text-sm font-medium text-foreground">{{ provider.name }}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span v-if="selected === provider.id && secretKey" class="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Configured
              </span>
              <Icon v-if="selected === provider.id" name="lucide:check" class="size-4 text-primary" />
            </div>
          </button>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {{ query ? `${results.all.length} match${results.all.length === 1 ? '' : 'es'}` : 'All systems' }}
        </p>
        <ScrollArea class="h-64 overflow-hidden rounded-xl border border-border/70 p-2.5 bg-muted/10">
          <div class="grid gap-2.5 pr-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="provider in results.all"
              :key="provider.id"
              type="button"
              class="group flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all hover:border-primary/60 cursor-pointer shadow-xs"
              :class="selected === provider.id ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border/80 bg-card hover:bg-muted/20'"
              :aria-pressed="selected === provider.id"
              @click="openConnectDialog(provider)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class="flex size-7 shrink-0 items-center justify-center rounded-lg shadow-2xs transition-transform group-hover:scale-105"
                  :style="{ backgroundColor: getPmsLogo(provider.id).bg, color: getPmsLogo(provider.id).color }"
                  v-html="getPmsLogo(provider.id).svg"
                />
                <span class="truncate text-sm font-medium text-foreground">{{ provider.name }}</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span v-if="selected === provider.id && secretKey" class="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Configured
                </span>
                <Icon v-if="selected === provider.id" name="lucide:check" class="size-4 text-primary" />
              </div>
            </button>
          </div>
        </ScrollArea>
        <p v-if="results.all.length === 0" class="rounded-xl border border-dashed border-border/80 p-5 text-center text-xs text-muted-foreground">
          Nothing matches "{{ query }}".
        </p>
      </section>
    </div>

    <div class="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-background pt-4">
      <Button variant="link" type="button" class="h-auto p-0 text-xs" @click="requestOpen = true">
        Request another system
      </Button>
      <label for="ob-calry-fail" class="flex items-center gap-2.5 cursor-pointer select-none">
        <span class="text-xs text-muted-foreground transition-colors hover:text-foreground">
          Simulate a failed sign in
        </span>
        <Switch
          id="ob-calry-fail"
          :model-value="simulateFailure"
          @update:model-value="(v) => simulateFailure = Boolean(v)"
        />
      </label>
    </div>

    <!-- Connect to PMS Dialog (Secret Key Modal) -->
    <Dialog v-model:open="connectDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader v-if="activeProvider">
          <div class="flex items-center gap-3 mb-1">
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs"
              :style="{ backgroundColor: getPmsLogo(activeProvider.id).bg, color: getPmsLogo(activeProvider.id).color }"
              v-html="getPmsLogo(activeProvider.id).svg"
            />
            <div>
              <DialogTitle class="text-base font-semibold">
                Connect to {{ activeProvider.name }}
              </DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                Enter your {{ activeProvider.name }} credentials to authorize integration.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div v-if="dialogAuthError" class="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <Icon name="lucide:circle-alert" class="mt-0.5 size-4 shrink-0 text-destructive" />
          <p class="text-xs leading-relaxed text-destructive">
            {{ dialogAuthError }}
          </p>
        </div>

        <div v-if="activeProvider" class="grid gap-3.5 py-1">
          <div class="grid gap-1.5">
            <div class="flex items-center justify-between">
              <Label for="ob-pms-client-id" class="text-xs font-medium">Client ID / Account ID</Label>
              <span class="text-[10px] text-muted-foreground">Optional</span>
            </div>
            <Input
              id="ob-pms-client-id"
              v-model="clientId"
              placeholder="e.g. your client or account identifier"
              class="text-xs"
            />
          </div>

          <div class="grid gap-1.5">
            <div class="flex items-center justify-between">
              <Label for="ob-pms-secret-key" class="text-xs font-medium">
                Secret Key / API Token <span class="text-destructive">*</span>
              </Label>
              <span class="text-[10px] text-muted-foreground">Required</span>
            </div>
            <div class="relative">
              <Input
                id="ob-pms-secret-key"
                v-model="secretKey"
                :type="showSecretKey ? 'text' : 'password'"
                placeholder="e.g. sk_live_... or Bearer token"
                class="pr-10 text-xs font-mono"
                :aria-invalid="Boolean(secretKeyError)"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                tabindex="-1"
                @click="showSecretKey = !showSecretKey"
              >
                <Icon :name="showSecretKey ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" />
              </button>
            </div>
            <p v-if="secretKeyError" class="text-xs text-destructive">
              {{ secretKeyError }}
            </p>
          </div>

          <!-- PMS Instruction tip -->
          <div class="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs text-muted-foreground">
            <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0 text-primary" />
            <p class="leading-relaxed">
              {{ getPmsInstruction(activeProvider.id, activeProvider.name) }}
            </p>
          </div>
        </div>

        <DialogFooter class="flex flex-row justify-end gap-2 pt-2">
          <Button variant="outline" type="button" @click="connectDialogOpen = false">
            Cancel
          </Button>
          <Button
            type="button"
            :disabled="isConnectingPms || !secretKey.trim()"
            class="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            @click="handleConnectWithKey"
          >
            <Icon v-if="isConnectingPms" name="lucide:loader-2" class="mr-2 size-4 animate-spin" />
            Connect & Integrate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Request another system Dialog -->
    <Dialog v-model:open="requestOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request another system</DialogTitle>
          <DialogDescription>
            Tell us what you use. You can keep using ELEV8 manually in the meantime.
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="ob-request-pms">System name</Label>
          <Input id="ob-request-pms" v-model="requestName" placeholder="For example Rentlio" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="requestOpen = false">
            Cancel
          </Button>
          <Button :disabled="!requestName.trim()" @click="sendRequest">
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </form>
</template>
