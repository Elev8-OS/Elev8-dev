<script setup lang="ts">
import type { PropertySelection } from '~/components/website-builder/data/property-listings'
import type { WizardAnswers } from '~/components/website-builder/data/wizard'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { STYLE_PRESETS } from '~/components/website-builder/data/wizard'

const props = defineProps<{
  settings: WebsiteSettings
  answers: WizardAnswers
  property: PropertySelection
}>()

const emit = defineEmits<{
  generate: []
  goTo: [step: 'style' | 'listings' | 'details']
}>()

interface Check {
  label: string
  detail: string
  ok: boolean
  optional?: boolean
  step: 'style' | 'listings' | 'details'
}

const checks = computed<Check[]>(() => {
  const n = props.property.propertyIds.length
  const preset = STYLE_PRESETS.find(p => p.id === props.answers.stylePreset)
  return [
    {
      label: n > 1 ? 'Portfolio listings' : 'Listing selected',
      detail: n ? `${n} ${n === 1 ? 'property' : 'properties'} ${n > 1 ? 'in portfolio' : 'included'}` : 'No listings selected',
      ok: n > 0,
      step: 'listings',
    },
    {
      label: 'Style and branding',
      detail: `${preset?.label ?? 'Minimal'} theme, ${props.settings.fontFamily}`,
      ok: true,
      step: 'style',
    },
    {
      label: 'Website address',
      detail: props.settings.domain || 'Not configured',
      ok: !!props.settings.domain,
      step: 'details',
    },
    {
      label: 'Legal information',
      detail: props.answers.legalCompany ? 'Company and privacy contact filled' : 'Legal details not filled',
      ok: !!(props.answers.legalCompany && props.answers.legalPrivacyEmail),
      optional: true,
      step: 'details',
    },
    {
      label: 'Logo',
      detail: props.settings.logoFile ? 'Logo configured' : 'No logo uploaded. Using the site name as text.',
      ok: !!props.settings.logoFile,
      optional: true,
      step: 'details',
    },
  ]
})

const blocked = computed(() => checks.value.some(c => !c.ok && !c.optional))
</script>

<template>
  <div class="mx-auto w-full max-w-2xl pb-8">
    <h2 class="text-2xl font-semibold tracking-tight">
      Final review
    </h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Review your settings before launching your new website.
    </p>

    <ul class="mt-8 divide-y overflow-hidden rounded-xl border bg-card">
      <li v-for="check in checks" :key="check.label" class="flex items-center gap-4 px-5 py-4" data-testid="wz-check">
        <Icon
          :name="check.ok ? 'lucide:circle-check' : 'lucide:triangle-alert'"
          class="size-6 shrink-0"
          :class="check.ok ? 'text-success' : check.optional ? 'text-muted-foreground' : 'text-warning'"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold">
            {{ check.label }}
          </div>
          <div class="truncate text-xs text-muted-foreground">
            {{ check.detail }}
          </div>
        </div>
        <Badge v-if="check.optional && !check.ok" variant="secondary">
          Optional
        </Badge>
        <Button v-if="!check.ok" variant="ghost" size="sm" class="h-7 text-xs" @click="emit('goTo', check.step)">
          Fix
        </Button>
      </li>
    </ul>

    <div class="mt-8 flex justify-end">
      <Button :disabled="blocked" data-testid="wz-generate" @click="emit('generate')">
        <Icon name="elev8:elevai" class="mr-2 size-4" aria-hidden="true" />
        Generate website
      </Button>
    </div>
  </div>
</template>
