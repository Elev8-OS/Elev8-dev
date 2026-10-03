<script setup lang="ts">
import ListingOwnedContentNotice from './ListingOwnedContentNotice.vue'

/** Check-out steps and time come from each listing. The guide only shows or hides the section. */
defineProps<{ modelValue: Record<string, any> }>()
defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()
</script>

<template>
  <ListingOwnedContentNotice kind="checkout" />
</template>
