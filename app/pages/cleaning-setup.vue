<script setup lang="ts">
import CleaningSetupWizard from '~/components/cleaning/CleaningSetupWizard.vue'

// Reached from the onboarding checklist's "Set up cleaning"; finishing or
// skipping completes that item and returns to the dashboard.
const { completeChecklistItem } = useOnboarding()

function finish() {
  completeChecklistItem('setup_cleaning')
  navigateTo('/')
}
</script>

<template>
  <div class="w-full py-2">
    <CleaningSetupWizard @done="finish" />
  </div>
</template>
