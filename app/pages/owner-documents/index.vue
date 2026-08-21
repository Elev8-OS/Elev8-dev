<script setup lang="ts">
// Document Center — thin route wrapper around the shared panel so the
// standalone page and the Users → Owners sub-tab share one implementation.

import OwnerDocumentsPanel from '~/components/owners/OwnerDocumentsPanel.vue'

definePageMeta({ layout: 'default' })
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <OwnerDocumentsPanel />
  </div>
</template>
