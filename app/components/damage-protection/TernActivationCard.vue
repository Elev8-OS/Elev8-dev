<script setup lang="ts">
import TernActivationWizard from '~/components/damage-protection/TernActivationWizard.vue'
import { bankAccountLabel } from '~/components/reservations/data/tern-activation'
import { useTernActivation } from '~/composables/useTernActivation'

/**
 * Where the damage waiver service stands for this tenant, and the way in to
 * activate it. Sits above the policies: nothing that uses the waiver runs
 * until this says active.
 */
const tern = useTernActivation()

const wizardOpen = ref(false)
const wizardMode = ref<'activate' | 'bank'>('activate')

function openWizard(mode: 'activate' | 'bank') {
  wizardMode.value = mode
  wizardOpen.value = true
}

const activation = computed(() => tern.activation.value)

function when(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}
</script>

<template>
  <div class="rounded-lg border p-4" data-testid="tern-activation-card" :data-status="activation.status">
    <!-- Active -->
    <div v-if="activation.status === 'active'" class="flex flex-col gap-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <Icon name="lucide:shield-check" class="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p class="font-medium">
              Damage waiver active
            </p>
            <p class="text-xs text-muted-foreground">
              Registered with Tern {{ when(activation.registeredAt) }} · {{ activation.ternOrganizationId }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button size="sm" variant="outline" data-testid="tern-change-bank" @click="openWizard('bank')">
            Change bank account
          </Button>
          <Button size="sm" variant="ghost" class="text-xs text-muted-foreground" data-testid="tern-replay" @click="tern.replayActivation()">
            Replay activation (demo)
          </Button>
        </div>
      </div>
      <dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-xs text-muted-foreground">
            Claims paid by bank transfer into
          </dt>
          <dd data-testid="tern-card-bank">
            {{ activation.payoutBank ? `${bankAccountLabel(activation.payoutBank)}, ${activation.payoutBank.accountHolder}` : '' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Per-stay fees charged to
          </dt>
          <dd>The card on your Elev8 subscription</dd>
        </div>
      </dl>
    </div>

    <!-- Registering -->
    <div v-else-if="activation.status === 'registering'" class="flex items-center gap-3 text-sm">
      <Icon name="lucide:loader-2" class="size-5 animate-spin text-muted-foreground" />
      Registering your organization with Tern…
    </div>

    <!-- Not activated, or the registration failed -->
    <div v-else class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <Icon
          :name="activation.status === 'registration_failed' ? 'lucide:alert-triangle' : 'lucide:shield'"
          class="mt-0.5 size-5 shrink-0"
          :class="activation.status === 'registration_failed' ? 'text-destructive' : 'text-muted-foreground'"
        />
        <div>
          <p class="font-medium">
            {{ activation.status === 'registration_failed' ? 'Activation did not go through' : 'Activate the damage waiver' }}
          </p>
          <p v-if="activation.status === 'registration_failed'" class="text-sm text-destructive" data-testid="tern-card-error">
            {{ activation.lastError }}
          </p>
          <p v-else class="text-sm text-muted-foreground">
            The waiver is Tern's cover, so it runs once you have signed up: accept the terms and add the bank account
            Tern pays your claims into. The per-stay fees go on the card on your Elev8 subscription. Until then, policies
            with the waiver are paused and deposit-only policies keep working.
          </p>
        </div>
      </div>
      <div>
        <Button size="sm" data-testid="tern-activate-open" @click="openWizard('activate')">
          {{ activation.status === 'registration_failed' ? 'Try again' : 'Activate' }}
        </Button>
      </div>
    </div>

    <TernActivationWizard v-model:open="wizardOpen" :mode="wizardMode" />
  </div>
</template>
