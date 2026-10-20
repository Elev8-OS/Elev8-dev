<script setup lang="ts">
import type { PropertySelection } from '~/components/website-builder/data/property-listings'

// Which listings, room types and rooms the website markets. The step has no Back / Next:
// the create page and the editor own their own navigation and saving.
const selection = defineModel<PropertySelection>({ required: true })
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-lg font-semibold">
        Choose listings
      </h3>
      <p class="text-sm text-muted-foreground">
        Select the listings, room types and rooms you want to feature on your website. Pick one listing for a dedicated property site, or several for a portfolio.
      </p>
    </div>
    <SharedListingRoomPicker v-model="selection" />
  </div>
</template>
