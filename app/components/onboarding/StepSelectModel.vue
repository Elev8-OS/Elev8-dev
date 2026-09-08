<script setup lang="ts">
import type { PmsModel } from '~/components/onboarding/data/onboarding'
import { PMS_MODEL_OPTIONS } from '~/components/onboarding/data/onboarding'

const emit = defineEmits<{ (e: 'next'): void, (e: 'back'): void }>()

const { state, selectModel } = useOnboarding()

const chosen = ref<PmsModel | null>(state.value.pmsModel)

function submit(): void {
  if (!chosen.value)
    return
  selectModel(chosen.value)
  emit('next')
}
</script>

<template>
  <form id="ob-model-form" class="flex flex-col gap-6" @submit.prevent="submit">
    <div>
      <h3 class="text-base font-semibold tracking-tight text-foreground">
        How do you want to run ELEV8?
      </h3>
      <p class="text-xs text-muted-foreground mt-0.5">
        This decides which modules you get and what you pay. You can change it later from Settings.
      </p>
    </div>

    <!-- Equal height cards so the consequences line up side by side (PRD 10). -->
    <div class="grid items-stretch gap-4 lg:grid-cols-3">
      <button
        v-for="option in PMS_MODEL_OPTIONS"
        :key="option.id"
        type="button"
        class="flex h-full flex-col rounded-xl border p-5 text-left transition-all hover:border-primary/60 cursor-pointer shadow-xs"
        :class="chosen === option.id ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border/80 bg-card hover:bg-muted/20'"
        :aria-pressed="chosen === option.id"
        @click="chosen = option.id"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-semibold leading-snug text-foreground">
            {{ option.title }}
          </p>
          <span
            class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors"
            :class="chosen === option.id ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
          >
            <Icon v-if="chosen === option.id" name="lucide:check" class="size-3" />
          </span>
        </div>
        <p class="mt-1.5 text-xs text-muted-foreground leading-relaxed">
          {{ option.summary }}
        </p>

        <div
          v-if="option.requiresExternalPms"
          class="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700"
        >
          <span class="size-1.5 rounded-full bg-sky-600" />
          Needs your current system
        </div>

        <dl class="mt-4 flex flex-1 flex-col gap-3 text-xs">
          <div>
            <dt class="font-medium text-foreground">
              Included
            </dt>
            <dd class="mt-1 flex flex-col gap-1">
              <span v-for="line in option.included" :key="line" class="flex gap-1.5 text-muted-foreground">
                <Icon name="lucide:check" class="mt-0.5 size-3 shrink-0 text-emerald-600" />
                {{ line }}
              </span>
            </dd>
          </div>
          <div>
            <dt class="font-medium text-foreground">
              Not included
            </dt>
            <dd class="mt-1 flex flex-col gap-1">
              <span v-for="line in option.notIncluded" :key="line" class="flex gap-1.5 text-muted-foreground">
                <Icon name="lucide:minus" class="mt-0.5 size-3 shrink-0 opacity-60" />
                {{ line }}
              </span>
            </dd>
          </div>
        </dl>

        <p
          v-if="option.warning"
          class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-800"
        >
          {{ option.warning }}
        </p>
      </button>
    </div>
  </form>
</template>
