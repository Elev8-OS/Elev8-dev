<script setup lang="ts">
import ListingOwnedContentNotice from './ListingOwnedContentNotice.vue'

/** Good to Know items come from each listing. The guide only shows or hides the section. */
defineProps<{ modelValue: Record<string, any> }>()
defineEmits<{ 'update:modelValue': [v: Record<string, any>] }>()
</script>

<template>
  <ListingOwnedContentNotice kind="good_to_know" />
</template>
