<script setup lang="ts">
import { computed, ref } from 'vue'
import SettingsEmailIntegration from './EmailIntegration.vue'
import SettingsMinutIntegration from './MinutIntegration.vue'
import SettingsSmartLockIntegration from './SmartLockIntegration.vue'
import SettingsThreeCxIntegration from './ThreeCxIntegration.vue'
import SettingsWhatsAppIntegration from './WhatsAppIntegration.vue'
import { payoutAccounts } from './data/payouts'

const { isConnected: whatsappConnected, whatsappAccounts } = useWhatsApp()
const { isConnected: threeCxConnected, activeAccount: threeCxAccount } = useThreeCX()
const smartLock = useSmartLock()
const { isConnected: minutConnected, devices: minutDevices } = useMinut()
const { isConnected: emailConnected, activeAccount: emailAccount, hasPendingCustom: emailPending } = useEmailIntegration()

type IntegrationId = 'whatsapp' | 'threecx' | 'smartlock' | 'payout' | 'minut' | 'email'

const openIntegration = ref<IntegrationId | null>(null)
const sheetOpen = computed({
  get: () => ['whatsapp', 'threecx', 'smartlock', 'minut', 'email'].includes(openIntegration.value ?? ''),
  set: (val) => {
    if (!val)
      openIntegration.value = null
  },
})

const activeComponent = computed(() => {
  if (openIntegration.value === 'whatsapp') return SettingsWhatsAppIntegration
  if (openIntegration.value === 'threecx') return SettingsThreeCxIntegration
  if (openIntegration.value === 'smartlock') return SettingsSmartLockIntegration
  if (openIntegration.value === 'minut') return SettingsMinutIntegration
  if (openIntegration.value === 'email') return SettingsEmailIntegration
  return null
})

const activeSheetTitle = computed(() => {
  if (openIntegration.value === 'whatsapp') return 'WhatsApp Business'
  if (openIntegration.value === 'threecx') return '3CX Telephony'
  if (openIntegration.value === 'smartlock') return 'Smart Lock (Seam)'
  if (openIntegration.value === 'minut') return 'Minut (Noise & Sensor Monitoring)'
  if (openIntegration.value === 'email') return 'Email (Sending Domain)'
  return ''
})

const whatsappPill = computed(() => {
  if (!whatsappConnected.value) return { label: 'Not connected', tone: 'idle' as const }
  const count = whatsappAccounts.value.length
  return {
    label: count > 1 ? `${count} accounts connected` : 'Connected',
    tone: 'connected' as const,
  }
})

const threeCxPill = computed(() => {
  if (!threeCxConnected.value || !threeCxAccount.value)
    return { label: 'Not connected', tone: 'idle' as const }
  return { label: `Connected · ${threeCxAccount.value.fqdn}`, tone: 'connected' as const }
})

const smartLockPill = computed(() => {
  if (!smartLock.isConnected.value) return { label: 'Not connected', tone: 'idle' as const }
  const count = smartLock.locks.value.length
  return {
    label: count > 0 ? `Connected · ${count} lock${count !== 1 ? 's' : ''}` : 'Connected',
    tone: 'connected' as const,
  }
})

const minutPill = computed(() => {
  if (!minutConnected.value) return { label: 'Not connected', tone: 'idle' as const }
  const count = minutDevices.value.length
  return {
    label: count > 0 ? `Connected · ${count} device${count !== 1 ? 's' : ''}` : 'Connected',
    tone: 'connected' as const,
  }
})

const emailPill = computed(() => {
  if (!emailConnected.value || !emailAccount.value)
    return { label: 'Not connected', tone: 'idle' as const }
  if (emailPending.value)
    return { label: 'Verifying…', tone: 'idle' as const }
  return { label: emailAccount.value.address, tone: 'connected' as const }
})

const payoutPill = computed(() => {
  const count = payoutAccounts.value.length
  if (count === 0) return { label: 'Not configured', tone: 'idle' as const }
  return { label: `${count} account${count !== 1 ? 's' : ''}`, tone: 'connected' as const }
})

const statusToneClass: Record<'connected' | 'idle', string> = {
  connected: 'bg-green-50 text-green-700',
  idle: 'bg-muted text-muted-foreground',
}

const statusDotClass: Record<'connected' | 'idle', string> = {
  connected: 'bg-green-500',
  idle: 'bg-muted-foreground/50',
}

function openSheet(id: IntegrationId) {
  openIntegration.value = id
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <!-- WhatsApp -->
      <div class="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-border/80">
        <div class="mb-3 flex items-start justify-between">
          <div class="flex h-9 w-9 items-center justify-center rounded-md border bg-[#25D366]/10">
            <Icon name="logos:whatsapp-icon" class="size-5" />
          </div>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="statusToneClass[whatsappPill.tone]"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass[whatsappPill.tone]" />
            {{ whatsappPill.label }}
          </span>
        </div>
        <p class="mb-1 text-sm font-medium">
          WhatsApp Business
        </p>
        <p class="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
          Send WhatsApp templates and receive 2-way guest messages in the Inbox.
        </p>
        <Button variant="outline" size="sm" class="self-start" @click="openSheet('whatsapp')">
          {{ whatsappConnected ? 'Manage' : 'Connect' }}
        </Button>
      </div>

      <!-- 3CX Telephony -->
      <div class="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-border/80">
        <div class="mb-3 flex items-start justify-between">
          <div class="flex h-9 w-9 items-center justify-center rounded-md border bg-green-500/10">
            <Icon name="lucide:phone" class="size-5 text-green-600" />
          </div>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="statusToneClass[threeCxPill.tone]"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass[threeCxPill.tone]" />
            {{ threeCxPill.label }}
          </span>
        </div>
        <p class="mb-1 text-sm font-medium">
          3CX Telephony
        </p>
        <p class="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
          Log PBX calls, screen-pop matched guests, and enable click-to-call in the Inbox.
        </p>
        <Button variant="outline" size="sm" class="self-start" @click="openSheet('threecx')">
          {{ threeCxConnected ? 'Manage' : 'Connect' }}
        </Button>
      </div>

      <!-- Smart Lock (Seam) -->
      <div class="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-border/80">
        <div class="mb-3 flex items-start justify-between">
          <div class="flex h-9 w-9 items-center justify-center rounded-md border bg-amber-500/10">
            <Icon name="lucide:key-round" class="size-5 text-amber-600" />
          </div>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="statusToneClass[smartLockPill.tone]"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass[smartLockPill.tone]" />
            {{ smartLockPill.label }}
          </span>
        </div>
        <p class="mb-1 text-sm font-medium">
          Smart Lock (Seam)
        </p>
        <p class="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
          Pair locks to properties or rooms, auto-generate guest access codes, and monitor battery &amp; connectivity.
        </p>
        <Button variant="outline" size="sm" class="self-start" @click="openSheet('smartlock')">
          {{ smartLock.isConnected.value ? 'Manage' : 'Connect' }}
        </Button>
      </div>

      <!-- Email (Sending Domain) -->
      <div class="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-border/80">
        <div class="mb-3 flex items-start justify-between">
          <div class="flex h-9 w-9 items-center justify-center rounded-md border bg-sky-500/10">
            <Icon name="lucide:mail" class="size-5 text-sky-600" />
          </div>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="statusToneClass[emailPill.tone]"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass[emailPill.tone]" />
            {{ emailPill.label }}
          </span>
        </div>
        <p class="mb-1 text-sm font-medium">
          Email (Sending Domain)
        </p>
        <p class="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
          Send and receive guest email as your own domain — connect a branded address or use the free default.
        </p>
        <Button variant="outline" size="sm" class="self-start" @click="openSheet('email')">
          {{ emailConnected ? 'Manage' : 'Connect' }}
        </Button>
      </div>

      <!-- Payout Gateways -->
      <div class="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-border/80">
        <div class="mb-3 flex items-start justify-between">
          <div class="flex h-9 w-9 items-center justify-center rounded-md border bg-blue-500/10">
            <Icon name="lucide:wallet" class="size-5 text-blue-600" />
          </div>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="statusToneClass[payoutPill.tone]"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass[payoutPill.tone]" />
            {{ payoutPill.label }}
          </span>
        </div>
        <p class="mb-1 text-sm font-medium">
          Payout Gateways
        </p>
        <p class="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
          Connect Stripe, Doku, or Xendit for guest payments and settlements.
        </p>
        <Button variant="outline" size="sm" class="self-start" as-child>
          <NuxtLink to="/settings/payouts">
            {{ payoutPill.tone === 'connected' ? 'Manage' : 'Connect' }}
          </NuxtLink>
        </Button>
      </div>

      <!-- Minut (Noise & Sensor Monitoring) -->
      <div class="flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-border/80">
        <div class="mb-3 flex items-start justify-between">
          <div class="flex h-9 w-9 items-center justify-center rounded-md border bg-sky-500/10">
            <Icon name="lucide:audio-waveform" class="size-5 text-sky-600" />
          </div>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="statusToneClass[minutPill.tone]"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass[minutPill.tone]" />
            {{ minutPill.label }}
          </span>
        </div>
        <p class="mb-1 text-sm font-medium">
          Minut (Noise & Sensor Monitoring)
        </p>
        <p class="mb-4 flex-1 text-xs text-muted-foreground leading-relaxed">
          Receive noise, smoke, motion, and sensor events from Minut devices and trigger Journeys on them.
        </p>
        <Button variant="outline" size="sm" class="self-start" @click="openSheet('minut')">
          {{ minutConnected ? 'Manage' : 'Connect' }}
        </Button>
      </div>
    </div>

    <!-- Integration config sheet (WhatsApp + 3CX) -->
    <Sheet v-model:open="sheetOpen">
      <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-3xl" side="right">
        <SheetHeader class="border-b px-6 py-4">
          <div class="flex items-center gap-3">
            <SheetTitle class="text-base">{{ activeSheetTitle }}</SheetTitle>
          </div>
        </SheetHeader>
        <ScrollArea class="flex-1">
          <div class="p-6">
            <component :is="activeComponent" v-if="activeComponent" />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  </div>
</template>
