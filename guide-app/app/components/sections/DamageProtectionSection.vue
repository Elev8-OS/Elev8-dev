<script setup lang="ts">
defineProps<{
  data?: Record<string, any>
}>()
</script>

<template>
  <section>
    <h2 class="text-lg font-semibold">
      {{ data?.title || 'Damage protection' }}
    </h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {{ data?.body || 'Choose how you would like to cover accidental damage during your stay.' }}
    </p>
  </section>
</template>
