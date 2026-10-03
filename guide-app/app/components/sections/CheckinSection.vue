<script setup lang="ts">
import type { GuideStep } from '~/components/GuideStepsList.vue'
import GuideStepsList from '~/components/GuideStepsList.vue'

// The listing owns the time and the steps; the guide only adds the early check-in note.
const props = defineProps<{
  data: {
    earlyCheckinAvailable?: boolean
  }
  listing?: {
    resources?: {
      basics?: {
        checkInTime?: string
      }
    }
  }
  content?: GuideStep[]
  token?: string
}>()

const time = computed(() => props.listing?.resources?.basics?.checkInTime ?? '14:00')
const steps = computed(() => props.content ?? [])

const { translate } = useAutoTranslate()
</script>

<template>
  <section class="rounded-xl border bg-card p-6">
    <div class="mb-3 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name="lucide:log-in" class="size-5" />
      </div>
      <h2 class="text-xl font-semibold">
        {{ translate('Check-in') }}
      </h2>
    </div>
    <div class="mb-4 text-2xl font-bold text-primary">
      {{ translate('From') }} {{ time }}
    </div>
    <GuideStepsList v-if="steps.length" :steps="steps" />
    <p v-if="data.earlyCheckinAvailable" class="mt-4 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
      <Icon name="lucide:check" class="size-3" />
      {{ translate('Early check-in available') }}
    </p>
  </section>
</template>
