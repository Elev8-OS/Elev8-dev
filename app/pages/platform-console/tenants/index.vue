<script setup lang="ts">
definePageMeta({ layout: 'platform-console' })

const { tenants } = useTenants()
</script>

<template>
  <div class="space-y-4 p-6">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">Tenants</h2>
      <p class="text-sm text-muted-foreground">All property managers using Elev8: plan, health and billing at a glance. Pick one for the detail.</p>
    </div>
    <PlatformConsoleTenantDirectory :tenants="tenants" />
  </div>
</template>
