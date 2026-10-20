<script setup lang="ts">
// Full-screen workspace for creating and editing a website: no sidebar, no app header.
</script>

<template>
  <!-- `@container/main` keeps the `@xl/main:` classes of the shared step components working. -->
  <!-- The default layout gets its TooltipProvider from SidebarProvider, so this one needs its own. -->
  <TooltipProvider :delay-duration="0">
    <div class="@container/main flex h-svh flex-col overflow-y-auto bg-background p-4 lg:p-6">
      <slot />
    </div>
  </TooltipProvider>
</template>
