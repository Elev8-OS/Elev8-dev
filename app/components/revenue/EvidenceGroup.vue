<script setup lang="ts">
import type { EvidenceItem } from '~/components/revenue/data/health'
import { computed } from 'vue'
import { familyLabels } from '~/components/revenue/data/health'

const props = defineProps<{
  title: string
  tone: 'supporting' | 'against' | 'unknown' | 'agreement'
  items?: EvidenceItem[]
  /** Plain strings, used for the unknowns list. */
  notes?: string[]
}>()

const tone = computed(() => ({
  supporting: { heading: 'text-muted-foreground', bar: 'bg-border' },
  against: { heading: 'text-destructive', bar: 'bg-destructive/40' },
  unknown: { heading: 'text-warning-foreground', bar: 'bg-warning' },
  agreement: { heading: 'text-foreground', bar: 'bg-primary/40' },
}[props.tone]))

const isEmpty = computed(() => !props.items?.length && !props.notes?.length)
</script>

<template>
  <section v-if="!isEmpty" class="flex flex-col gap-3">
    <h3 class="text-[11px] font-semibold tracking-[0.09em] uppercase" :class="tone.heading">
      {{ title }}
    </h3>

    <ul class="flex flex-col gap-3">
      <li v-for="(item, index) in items ?? []" :key="`item-${index}`" class="flex gap-3">
        <span class="w-0.5 shrink-0 rounded-full" :class="tone.bar" aria-hidden="true" />
        <p class="text-sm leading-relaxed">
          {{ item.claim }}
          <!-- Family and age, never a vendor: a claim usually spans several sources. -->
          <span class="mt-1 block text-xs font-medium text-muted-foreground">
            {{ familyLabels[item.family] }} · {{ item.metric }} · {{ item.observedAt }}
          </span>
        </p>
      </li>

      <li v-for="(note, index) in notes ?? []" :key="`note-${index}`" class="flex gap-3">
        <span class="w-0.5 shrink-0 rounded-full" :class="tone.bar" aria-hidden="true" />
        <p class="text-sm leading-relaxed">
          {{ note }}
        </p>
      </li>
    </ul>
  </section>
</template>
