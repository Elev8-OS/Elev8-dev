<script setup lang="ts">
import type { AuthSlide } from '~/components/layout/AuthCarousel.vue'
import revenueSlide from '~/assets/images/login-panel-2.png'
import answeringSlide from '~/assets/images/login-panel.png'
import myotakuSlide from '~/assets/images/login-partner-myotaku.webp'

definePageMeta({
  layout: 'blank',
})

const slides: AuthSlide[] = [
  { src: myotakuSlide, alt: 'Myotaku, your all-in-one furnishing partner: rent, lease or buy turnkey packages on flexible terms.' },
  { src: answeringSlide, alt: 'Elev8 phone answering: your guest called at 3 a.m., nobody answered, we would have.' },
  { src: revenueSlide, alt: 'Elev8 revenue management: keep your keys, we grow your revenue.' },
]
</script>

<template>
  <LayoutAuth reverse :slides="slides">
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p class="text-balance text-sm text-muted-foreground">
          Login with your Apple or Google account
        </p>
      </div>
      <AuthSignIn />
    </div>
  </LayoutAuth>
</template>
