<script setup lang="ts">
// Owner Statements — thin route wrapper around the shared panel so the
// standalone page and the Users → Owners sub-tab share one implementation.

import OwnerStatementsPanel from '~/components/owners/OwnerStatementsPanel.vue'

definePageMeta({ layout: 'default' })
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <OwnerStatementsPanel />
  </div>
</template>
