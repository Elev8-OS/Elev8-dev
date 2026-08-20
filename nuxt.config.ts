import tailwindcss from '@tailwindcss/vite'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  srcDir: 'app/',
  pages: true,

  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
  },

  components: [
    {
      path: '~/components',
      extensions: ['.vue'],
    },
    // Disable path prefix for AI Assistant components so they auto-import
    // as <ElevAIAssistant>, <ElevAIMessage>, etc. instead of
    // <AssistantElevAIAssistant>, etc. This matches how our component
    // templates reference them.
    {
      path: '~/components/assistant',
      extensions: ['.vue'],
      pathPrefix: false,
    },
    // Review Hub analytics components keep their own ReviewAnalytics* names
    // (disable path prefix so they auto-import without the review-hub/analytics nesting)
    {
      path: '~/components/review-hub/analytics',
      extensions: ['.vue'],
      pathPrefix: false,
    },
  ],

  modules: [
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
    '@nuxthub/core',
  ],

  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "~/components/ui"
     */
    componentDir: '~/components/ui',
  },

  colorMode: {
    classSuffix: '',
    preference: 'light',
  },

  icon: {
    mode: 'svg',
    serverBundle: {
      collections: ['lucide', 'logos', 'simple-icons'],
    },
  },

  eslint: {
    config: {
      standalone: false,
    },
  },

  fonts: {
    defaults: {
      weights: [300, 400, 500, 600, 700, 800],
    },
  },

  routeRules: {
    '/components': { redirect: '/components/accordion' },
    '/settings': { redirect: '/settings/profile' },
    '/messages': { redirect: '/inbox' },
    '/owners': { redirect: '/users' },
  },

  imports: {
    dirs: ['./lib'],
  },

  compatibilityDate: '2026-03-13',

  nitro: {
    prerender: {
      ignore: [
        '/examples/forms',
        '/terms',
        '/privacy',
        '/components/pagination',
        '/docs',
      ],
    },
  },
  app: {
    baseURL: '/dashboard/',
  },
})
