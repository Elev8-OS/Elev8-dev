<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import { Toaster } from '@/components/ui/sonner'
import { getBrandingFaviconHref } from '~/components/settings/data/branding'
import 'vue-sonner/style.css'

const colorMode = useColorMode()
const color = computed(() => colorMode.value === 'dark' ? '#09090b' : '#ffffff')
const { theme } = useAppSettings()
const { branding } = useTenantBranding()

useHead(() => {
  const currentTheme = theme
  return {
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { key: 'theme-color', name: 'theme-color', content: color.value },
    ],
    link: [
      { rel: 'icon', href: getBrandingFaviconHref(branding.value) },
    ],
    htmlAttrs: { lang: 'en' },
    bodyAttrs: {
      class: computed(() => `color-${currentTheme.value?.color || 'default'} theme-${currentTheme.value?.type || 'default'}`),
    },
    script: [
      {
        innerHTML: `if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(function(rs){for(var i=0;i<rs.length;i++)rs[i].unregister()}); if ('caches' in window) { caches.keys().then(function(keys){for(var i=0;i<keys.length;i++)caches.delete(keys[i])}); } }`,
        tagPosition: 'head',
      },
    ],
  }
})

const title = 'Nuxt Shadcn-Vue TailwindCSS 4 - Dashboard Template'
const description = 'This dashboard, built with Nuxt, Shadcn Vue, and TailwindCSS. It includes a dark mode toggle and is optimized for performance and data efficiency.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogUrl: 'http://localhost:3000/dashboard',
  ogImage: '/social-card.png',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: '/social-card.png',
  twitterCard: 'summary_large_image',
})

const router = useRouter()

defineShortcuts({
  'G-H': () => router.push('/'),
})

const textDirection = useTextDirection({ initialValue: 'ltr' })
const dir = computed(() => textDirection.value === 'rtl' ? 'rtl' : 'ltr')
</script>

<template>
  <Body class="overscroll-none antialiased bg-background text-foreground">
    <ConfigProvider :dir="dir">
      <div id="app" vaul-drawer-wrapper class="relative">
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>

        <AppSettings />
      </div>

      <Toaster :theme="colorMode.preference as any || 'system'" />
    </ConfigProvider>
  </Body>
</template>
