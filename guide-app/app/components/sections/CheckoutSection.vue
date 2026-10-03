<script setup lang="ts">
import type { GuideStep } from '~/components/GuideStepsList.vue'
import GuideStepsList from '~/components/GuideStepsList.vue'

// The listing owns the time and the steps.
const props = defineProps<{
  data: Record<string, unknown>
  listing?: {
    resources?: {
      basics?: {
        checkOutTime?: string
      }
    }
  }
  content?: GuideStep[]
  token?: string
}>()

const time = computed(() => props.listing?.resources?.basics?.checkOutTime ?? '11:00')
const steps = computed(() => props.content ?? [])

const { translate } = useAutoTranslate()
</script>

<template>
  <section class="rounded-xl border bg-card p-6">
    <div class="mb-3 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name="lucide:log-out" class="size-5" />
      </div>
      <h2 class="text-xl font-semibold">
        {{ translate('Check-out') }}
      </h2>
    </div>
    <div class="mb-4 text-2xl font-bold text-primary">
      {{ translate('By') }} {{ time }}
    </div>
    <GuideStepsList v-if="steps.length" :steps="steps" />
  </section>
</template>
