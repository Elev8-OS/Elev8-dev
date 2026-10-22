<script setup lang="ts">
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'

defineProps<{
  settings: WebsiteSettings
  templateName?: string | null
  url: string
}>()
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-lg border bg-background" data-testid="we-preview">
    <div class="flex items-center gap-3 border-b bg-muted/50 px-4 py-2.5">
      <div class="flex gap-1.5" aria-hidden="true">
        <span class="size-2.5 rounded-full bg-destructive" />
        <span class="size-2.5 rounded-full bg-warning" />
        <span class="size-2.5 rounded-full bg-green-500" />
      </div>
      <div class="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground">
        {{ url }}
      </div>
      <a :href="url" target="_blank" rel="noopener" aria-label="Open the site in a new tab" class="text-muted-foreground hover:text-foreground">
        <Icon name="lucide:external-link" class="size-4" aria-hidden="true" />
      </a>
    </div>
    <div class="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-muted to-muted-foreground/30 p-4">
      <div class="flex items-center justify-between gap-3 rounded-full bg-background/80 px-5 py-2.5 backdrop-blur">
        <span class="truncate text-lg font-semibold" :style="{ fontFamily: settings.fontFamily }">{{ settings.name }}</span>
        <span class="hidden text-sm text-muted-foreground sm:inline">Properties · About · Contact · Blog</span>
        <span class="rounded-full px-4 py-1.5 text-sm font-medium text-white" :style="{ backgroundColor: settings.brandColor }" data-testid="we-preview-cta">Book now</span>
      </div>
      <div class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <p class="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {{ templateName ?? 'Bali' }}
        </p>
        <p class="max-w-xl text-3xl font-semibold" :style="{ fontFamily: settings.fontFamily }" data-testid="we-preview-headline">
          {{ settings.description || 'Your private retreat in the heart of Bali' }}
        </p>
      </div>
    </div>
  </div>
</template>
