<script setup lang="ts">
import type { GuestVerificationMode, GuestVerificationSettings } from '~/components/listings/data/guest-verification'
import { GUEST_VERIFICATION_MODES } from '~/components/listings/data/guest-verification'

/**
 * The listing's guest verification: who must identify themselves before
 * arrival, plus two optional questions. Every change is emitted at once; the
 * tab saves it onto the listing.
 */
const props = defineProps<{ settings: GuestVerificationSettings }>()
const emit = defineEmits<{ change: [settings: GuestVerificationSettings] }>()

const selected = computed(() => GUEST_VERIFICATION_MODES.find(m => m.value === props.settings.mode)!)

function set(patch: Partial<GuestVerificationSettings>) {
  emit('change', { ...props.settings, ...patch })
}

function setMode(mode: GuestVerificationMode) {
  if (mode !== props.settings.mode)
    set({ mode })
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="guest-verification">
    <div class="grid grid-cols-1 overflow-hidden rounded-lg border-2 border-primary sm:grid-cols-3" role="radiogroup" aria-label="Guest verification">
      <button
        v-for="mode in GUEST_VERIFICATION_MODES"
        :key="mode.value"
        type="button"
        role="radio"
        :aria-checked="settings.mode === mode.value"
        class="flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors [&:not(:first-child)]:border-t-2 [&:not(:first-child)]:border-primary sm:[&:not(:first-child)]:border-t-0 sm:[&:not(:first-child)]:border-l-2"
        :class="settings.mode === mode.value ? 'bg-primary font-medium text-primary-foreground' : 'bg-background hover:bg-muted'"
        :data-testid="`verification-mode-${mode.value}`"
        @click="setMode(mode.value)"
      >
        <Icon v-if="mode.icon" :name="mode.icon" class="size-4" />
        {{ mode.label }}
      </button>
    </div>
    <p class="text-sm text-muted-foreground" data-testid="verification-description">
      {{ selected.description }}
    </p>

    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <Switch
          :model-value="settings.requireAddress"
          aria-label="Require guests to submit a residential address"
          data-testid="verification-address"
          @update:model-value="set({ requireAddress: Boolean($event) })"
        />
        <span class="cursor-pointer text-sm font-medium" @click="set({ requireAddress: !settings.requireAddress })">Require guests to submit a residential address</span>
      </div>
      <div class="flex items-center gap-3">
        <Switch
          :model-value="settings.askBedConfiguration"
          aria-label="Ask guests for preferred bed configuration"
          data-testid="verification-beds"
          @update:model-value="set({ askBedConfiguration: Boolean($event) })"
        />
        <span class="cursor-pointer text-sm font-medium" @click="set({ askBedConfiguration: !settings.askBedConfiguration })">Ask guests for preferred bed configuration</span>
      </div>
    </div>
  </div>
</template>
