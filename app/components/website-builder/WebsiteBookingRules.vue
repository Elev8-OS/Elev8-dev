<script setup lang="ts">
import type { WebsiteRuleSet } from '~/components/channels/data/website-channel'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { computed } from 'vue'
import { ruleSetIssues } from '~/components/channels/data/website-channel'
import WebsiteRuleSetForm from '~/components/channels/WebsiteRuleSetForm.vue'

defineProps<{ saving?: boolean }>()
const emit = defineEmits<{ save: [] }>()

const settings = defineModel<WebsiteSettings>('settings', { required: true })

// Rules of this site only: the name and websites are the channel's business, so only the settings are checked.
const issues = computed(() => settings.value.rules
  ? ruleSetIssues({ ...settings.value.rules, name: 'site', websiteIds: ['site'] }, [])
  : [])

function updateRules(rules: WebsiteRuleSet) {
  settings.value = { ...settings.value, rules }
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl" data-testid="we-booking-rules">
    <h3 class="text-xl font-semibold tracking-tight">
      Booking rules
    </h3>
    <p class="mb-6 mt-1 text-sm text-muted-foreground">
      Length of stay discounts and stay rules for direct bookings on this website only.
    </p>

    <section v-if="settings.rules" class="mb-4 rounded-xl border bg-card p-5" data-testid="ws-booking-rules">
      <WebsiteRuleSetForm :rule-set="settings.rules" :issues="issues" site-only @update:rule-set="updateRules" />
    </section>

    <div class="flex items-center justify-end">
      <Button :disabled="issues.length > 0 || saving" data-testid="br-save" @click="emit('save')">
        Save changes
      </Button>
    </div>
  </div>
</template>
