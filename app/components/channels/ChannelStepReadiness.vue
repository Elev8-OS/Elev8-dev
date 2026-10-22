<script setup lang="ts">
import { computed } from 'vue'
import { cancellationPolicyOptions } from '~/components/listings/data/listings'
import { useChannelSetup } from '~/composables/useChannelSetup'
import { NEXTPAX_PAYMENT_METHODS } from './data/nextpax-mock'

/** Step 2: what the channel refuses to switch on without, each fixed right here. */
const props = defineProps<{ channelName: string }>()

const setup = useChannelSetup(props.channelName)

// A custom policy is built on the listing; a channel takes one of the presets.
const policies = cancellationPolicyOptions.filter(o => o.value !== 'custom')
const gate = (key: 'policy' | 'payments') => computed(() => setup.gates.value.find(g => g.key === key))
const policyGate = gate('policy')
const paymentsGate = gate('payments')
</script>

<template>
  <div class="flex flex-col gap-6">
    <section v-if="policyGate" class="flex flex-col gap-3">
      <div class="flex items-start gap-2">
        <Icon
          :name="policyGate.done ? 'lucide:circle-check' : 'lucide:circle-dashed'"
          class="mt-0.5 size-4 shrink-0"
          :class="policyGate.done ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'"
          aria-hidden="true"
        />
        <div>
          <h2 class="text-base font-semibold">
            {{ policyGate.label }}
          </h2>
          <p class="text-sm text-muted-foreground">
            {{ policyGate.hint }}
          </p>
        </div>
      </div>
      <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" :aria-label="`Cancellation policy on ${channelName}`">
        <button
          v-for="option in policies"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="setup.state.value.policy === option.value"
          class="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="setup.state.value.policy === option.value ? 'border-primary ring-1 ring-primary' : ''"
          @click="setup.setPolicy(option.value)"
        >
          <span
            class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border"
            :class="setup.state.value.policy === option.value ? 'border-primary' : 'border-input'"
          >
            <span v-if="setup.state.value.policy === option.value" class="size-2 rounded-full bg-primary" />
          </span>
          <span>
            <span class="block text-sm font-medium">{{ option.label }}</span>
            <span class="block text-xs text-muted-foreground">{{ option.description }}</span>
          </span>
        </button>
      </div>
    </section>

    <section v-if="paymentsGate" class="flex flex-col gap-3">
      <div class="flex items-start gap-2">
        <Icon
          :name="paymentsGate.done ? 'lucide:circle-check' : 'lucide:circle-dashed'"
          class="mt-0.5 size-4 shrink-0"
          :class="paymentsGate.done ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'"
          aria-hidden="true"
        />
        <div>
          <h2 class="text-base font-semibold">
            {{ paymentsGate.label }}
          </h2>
          <p class="text-sm text-muted-foreground">
            {{ paymentsGate.hint }} Shared with every channel.
          </p>
        </div>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <div
          v-for="method in NEXTPAX_PAYMENT_METHODS"
          :key="method.value"
          role="checkbox"
          tabindex="0"
          :aria-checked="setup.paymentMethods.value.includes(method.value)"
          class="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="setup.togglePaymentMethod(method.value)"
          @keydown.space.prevent="setup.togglePaymentMethod(method.value)"
        >
          <div
            class="flex size-4 items-center justify-center rounded-[4px] border"
            :class="setup.paymentMethods.value.includes(method.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
          >
            <Icon v-if="setup.paymentMethods.value.includes(method.value)" name="lucide:check" class="size-3" />
          </div>
          <span>{{ method.label }}</span>
        </div>
      </div>
    </section>

    <p class="flex items-start gap-2 text-xs text-muted-foreground">
      <Icon name="lucide:images" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {{ channelName }} wants at least {{ setup.spec.minPhotos }} {{ setup.spec.minPhotos === 1 ? 'photo' : 'photos' }} per listing.
      The next step flags listings with fewer.
    </p>
  </div>
</template>
