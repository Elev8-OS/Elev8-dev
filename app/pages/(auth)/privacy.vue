<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <LayoutAuth>
    <div class="mx-auto grid max-w-lg gap-6">
      <div class="flex flex-col space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p class="text-sm text-muted-foreground">
          Placeholder policy for the Elev8 dashboard demo. Replace this page with the
          reviewed legal copy before launch.
        </p>
      </div>
      <div class="space-y-4 text-sm text-muted-foreground">
        <p>
          We collect the name and email address you provide at sign up so we can identify
          your account and send verification codes.
        </p>
        <p>
          This environment runs on mock data and stores nothing on a server. Guest and
          reservation records shown in the dashboard are sample data.
        </p>
      </div>
      <NuxtLink to="/register" class="text-sm underline underline-offset-4 hover:text-primary">
        Back to sign up
      </NuxtLink>
    </div>
  </LayoutAuth>
</template>
