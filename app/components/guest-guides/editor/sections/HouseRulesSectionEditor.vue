<script setup lang="ts">
import ListingOwnedContentNotice from './ListingOwnedContentNotice.vue'

/** House rules come from each listing. The guide only shows or hides the section. */
defineProps<{ modelValue: Record<string, any> }>()
defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()
</script>

<template>
  <ListingOwnedContentNotice kind="house_rules" />
</template>
