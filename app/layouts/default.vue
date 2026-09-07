<script setup lang="ts">
</script>

<template>
  <!--
    The billing alert sits above the sidebar and the header, spanning the full viewport,
    so nothing frames or insets it. The provider hardcodes `min-h-svh`, so the column
    below it has to be told to shrink instead, or the page grows past the viewport.
  -->
  <div class="flex h-svh flex-col">
    <LayoutBillingAlertBar />
    <!--
      `transform-gpu` makes this element the containing block for its `fixed` children, so the
      sidebar's `fixed inset-y-0` resolves against the area below the alert instead of the
      viewport. Without it an expanded sidebar paints over the alert and hides its first words.
      With no alert the provider fills the viewport, so positioning is unchanged.
    -->
    <SidebarProvider :default-open="false" class="min-h-0 flex-1 transform-gpu">
      <LayoutAppSidebar />
      <SidebarInset class="overflow-hidden">
        <LayoutHeader />
        <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
          <PlatformConsoleBannerSlot />
          <div class="@container/main p-4 lg:p-6 grow min-h-0">
            <slot />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    <!-- Teleports to body, so nesting it here does not affect the column layout. -->
    <ElevAIPanel />
  </div>
</template>

<style scoped>

</style>
