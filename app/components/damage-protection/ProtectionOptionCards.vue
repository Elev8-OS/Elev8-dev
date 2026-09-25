<script setup lang="ts">
import type { ProtectionOptionView } from '~/components/reservations/data/damage-protection'
import type { ProtectionOption } from '~/components/reservations/data/reservations'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'

const props = withDefaults(defineProps<{
  options: ProtectionOptionView[]
  /** Long-stay bands say so: claims may be recorded during the stay. */
  longStay?: boolean
  /**
   * False renders the cards as a read-only preview. Named `selectable` rather
   * than `readonly` because `readonly` resolves to Vue's auto-imported
   * readonly() inside a template, never to the prop.
   */
  selectable?: boolean
}>(), { longStay: false, selectable: true })

const selected = defineModel<ProtectionOption | null>({ default: null })

function pick(option: ProtectionOption) {
  if (props.selectable)
    selected.value = option
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <div
      v-for="view in options"
      :key="view.option"
      class="flex flex-col gap-3 rounded-lg border p-4 transition-colors"
      :class="[
        selected === view.option ? 'border-primary ring-1 ring-primary' : 'border-border',
        selectable ? 'cursor-pointer hover:border-primary/60' : '',
      ]"
      :role="selectable ? 'radio' : undefined"
      :aria-checked="selectable ? selected === view.option : undefined"
      :tabindex="selectable ? 0 : undefined"
      @click="pick(view.option)"
      @keydown.enter.prevent="pick(view.option)"
      @keydown.space.prevent="pick(view.option)"
    >
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-sm font-semibold">
            {{ view.option === 'waiver' ? 'Damage waiver' : 'Security deposit (card on file)' }}
          </p>
          <p class="mt-1 text-2xl font-bold tabular-nums">
            {{ formatProtectionAmount(view.amount, view.currency) }}
          </p>
          <p v-if="view.option === 'deposit'" class="text-xs text-muted-foreground">
            the most your card can be charged
          </p>
        </div>
        <span
          v-if="view.isDefault"
          class="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase"
        >
          Recommended
        </span>
      </div>

      <ul class="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <!-- The waiver's case is made first and in the guest's terms; the
             deposit's terms are stated as they are. A deposit that costs
             nothing upfront would otherwise look like the obvious pick. -->
        <template v-if="view.option === 'waiver'">
          <li>Covers accidental damage up to {{ formatProtectionAmount(view.coverageCap ?? 0, view.currency) }}</li>
          <li>Nothing more to pay after you leave</li>
          <li>No card kept on file</li>
          <li>Pay with any method. Non-refundable</li>
        </template>
        <template v-else>
          <li>A credit card is kept on file. Nothing is charged now</li>
          <li>After check-out, your card can be charged up to {{ formatProtectionAmount(view.amount, view.currency) }} for damage we find</li>
          <li>You pay for any damage yourself, up to that amount</li>
          <li>Your card stays on file until {{ view.settleWithinDays }} days after check-out</li>
          <li v-if="longStay">
            Claims may be recorded during your stay at each scheduled cleaning, not only at check-out
          </li>
        </template>
      </ul>

      <div v-if="view.option === 'waiver' && view.exclusions?.length" class="border-t pt-3">
        <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Not covered
        </p>
        <ul class="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
          <li v-for="exclusion in view.exclusions" :key="exclusion">
            {{ exclusion }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
