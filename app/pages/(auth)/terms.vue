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
          Terms of Service
        </h1>
        <p class="text-sm text-muted-foreground">
          Placeholder terms for the Elev8 dashboard demo. Replace this page with the
          reviewed legal copy before launch.
        </p>
      </div>
      <div class="space-y-4 text-sm text-muted-foreground">
        <p>
          Elev8 is a property management dashboard for vacation rentals. By creating an
          account you agree to use it only for managing properties you are authorised to
          manage.
        </p>
        <p>
          This environment runs on mock data. Nothing entered here is billed, published,
          or shared with a third party.
        </p>
      </div>
      <NuxtLink to="/register" class="text-sm underline underline-offset-4 hover:text-primary">
        Back to sign up
      </NuxtLink>
    </div>
  </LayoutAuth>
</template>
