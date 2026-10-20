<script setup lang="ts">
import type { WizardAnswers } from '~/components/website-builder/data/wizard'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { BRAND_COLORS, FONT_PAIRINGS, fontFamilyFor, STYLE_PRESETS } from '~/components/website-builder/data/wizard'

const answers = defineModel<WizardAnswers>('answers', { required: true })
const settings = defineModel<WebsiteSettings>('settings', { required: true })

const customColor = computed(() => !BRAND_COLORS.includes(settings.value.brandColor))

function setColor(brandColor: string) {
  settings.value = { ...settings.value, brandColor }
}

function setFont(fontPairing: WizardAnswers['fontPairing']) {
  answers.value = { ...answers.value, fontPairing }
  settings.value = { ...settings.value, fontFamily: fontFamilyFor(fontPairing) }
}
</script>

<template>
  <div class="flex w-full flex-col gap-8 pb-8">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">
        Look and feel
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Define the visual identity of your new site. ElevAI applies these choices across all components.
      </p>
    </div>

    <section class="space-y-3">
      <h3 class="text-base font-semibold">
        Choose a style preset
      </h3>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4" role="radiogroup" aria-label="Style preset">
        <button
          v-for="preset in STYLE_PRESETS"
          :key="preset.id"
          type="button"
          role="radio"
          :aria-checked="answers.stylePreset === preset.id"
          class="overflow-hidden rounded-xl border-2 text-left transition-colors"
          :class="answers.stylePreset === preset.id ? 'border-primary' : 'border-border hover:border-muted-foreground/50'"
          :data-testid="`wz-preset-${preset.id}`"
          @click="answers = { ...answers, stylePreset: preset.id }"
        >
          <div class="flex h-28 items-center justify-center bg-gradient-to-br" :class="preset.gradient">
            <Icon :name="preset.template.icon" class="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <div class="p-3">
            <div class="text-sm font-semibold">
              {{ preset.label }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ preset.description }}
            </div>
          </div>
        </button>
      </div>
    </section>

    <section class="space-y-3">
      <h3 class="text-base font-semibold">
        Primary color
      </h3>
      <div class="flex flex-wrap items-center gap-3">
        <button
          v-for="color in BRAND_COLORS"
          :key="color"
          type="button"
          class="size-9 shrink-0 rounded-full border-2 border-background transition-transform"
          :class="settings.brandColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-110'"
          :style="{ backgroundColor: color }"
          :aria-label="`Use color ${color}`"
          :aria-pressed="settings.brandColor === color"
          @click="setColor(color)"
        />
        <label
          class="relative flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:border-muted-foreground/50"
          :class="customColor && 'border-primary'"
        >
          <span class="size-4 shrink-0 rounded-full border" :style="{ backgroundColor: customColor ? settings.brandColor : 'transparent' }" />
          Custom color
          <input
            type="color"
            class="absolute inset-0 size-full cursor-pointer opacity-0"
            :value="settings.brandColor"
            aria-label="Custom brand color"
            @input="setColor(($event.target as HTMLInputElement).value)"
          >
        </label>
      </div>
    </section>

    <section class="space-y-3">
      <h3 class="text-base font-semibold">
        Font pairing
      </h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Font pairing">
        <button
          v-for="pair in FONT_PAIRINGS"
          :key="pair.id"
          type="button"
          role="radio"
          :aria-checked="answers.fontPairing === pair.id"
          class="rounded-xl border-2 p-5 text-left transition-colors"
          :class="answers.fontPairing === pair.id ? 'border-primary' : 'border-border hover:border-muted-foreground/50'"
          :data-testid="`wz-font-${pair.id}`"
          @click="setFont(pair.id)"
        >
          <div class="mb-1 text-xl font-semibold" :style="{ fontFamily: pair.family }">
            {{ pair.heading }}
          </div>
          <div class="text-sm text-muted-foreground">
            {{ pair.subheading }}
          </div>
        </button>
      </div>
    </section>
  </div>
</template>
