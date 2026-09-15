<script setup lang="ts">
import type { PmsModel } from '~/components/onboarding/data/onboarding'
import { PMS_MODEL_OPTIONS } from '~/components/onboarding/data/onboarding'

const emit = defineEmits<{ (e: 'next'): void, (e: 'back'): void }>()

const { state, selectModel } = useOnboarding()

const chosen = ref<PmsModel>(state.value.pmsModel || 'PMS_CM')
const hoveredButton = ref<PmsModel | null>(null)

interface ModelMeta {
  icon: string
  badge?: string
  buttonText: string
}

const MODEL_META: Record<PmsModel, ModelMeta> = {
  PMS_CM: {
    icon: 'lucide:layers',
    badge: 'Recommended',
    buttonText: 'Select Full Platform',
  },
  PMS_ONLY: {
    icon: 'lucide:plug',
    buttonText: 'Connect Current PMS',
  },
  MIGRATION: {
    icon: 'lucide:arrow-right-left',
    buttonText: 'Start Migration',
  },
}

function chooseAndSubmit(model: PmsModel): void {
  chosen.value = model
  selectModel(model)
  emit('next')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-base font-semibold tracking-tight text-foreground">
        How do you want to run ELEV8?
      </h3>
      <p class="text-xs text-muted-foreground mt-0.5">
        This decides which modules you get and what you pay. You can change it later from Settings.
      </p>
    </div>

    <!-- Equal height cards with icon at top and action button at bottom -->
    <div class="grid items-stretch gap-5 lg:grid-cols-3">
      <Card
        v-for="option in PMS_MODEL_OPTIONS"
        :key="option.id"
        class="relative flex flex-col justify-between rounded-xl border transition-colors duration-150 overflow-hidden shadow-xs"
        :class="chosen === option.id
          ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.03]'
          : 'border-border/80 bg-card'"
      >
        <CardHeader class="pb-3">
          <!-- Icon at top of card + Optional Badge -->
          <div class="flex items-center justify-between gap-2">
            <div
              class="flex size-11 items-center justify-center rounded-xl border transition-colors"
              :class="chosen === option.id
                ? 'bg-primary text-neutral-950 border-primary shadow-xs'
                : 'bg-muted/80 border-border/80 text-foreground dark:text-foreground'"
            >
              <Icon :name="MODEL_META[option.id].icon" class="size-5.5" />
            </div>
            <Badge
              v-if="MODEL_META[option.id].badge"
              variant="default"
              class="text-[10px] px-2 py-0.5 font-medium bg-primary text-neutral-950"
            >
              {{ MODEL_META[option.id].badge }}
            </Badge>
          </div>

          <CardTitle class="text-base font-bold text-foreground leading-snug pt-3">
            {{ option.title }}
          </CardTitle>

          <CardDescription class="text-xs text-muted-foreground leading-relaxed mt-1">
            {{ option.summary }}
          </CardDescription>

          <div
            v-if="option.requiresExternalPms"
            class="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400"
          >
            <span class="size-1.5 rounded-full bg-sky-500" />
            Needs your current system
          </div>
        </CardHeader>

        <CardContent class="flex-1 space-y-4 pt-1">
          <div class="border-t border-border/50 pt-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Included
            </p>
            <ul class="space-y-1.5 text-xs text-muted-foreground">
              <li v-for="line in option.included" :key="line" class="flex items-start gap-2">
                <Icon name="lucide:check" class="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span class="leading-tight">{{ line }}</span>
              </li>
            </ul>
          </div>

          <div v-if="option.notIncluded.length" class="border-t border-border/50 pt-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Not included
            </p>
            <ul class="space-y-1.5 text-xs text-muted-foreground">
              <li v-for="line in option.notIncluded" :key="line" class="flex items-start gap-2">
                <Icon name="lucide:minus" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                <span class="leading-tight">{{ line }}</span>
              </li>
            </ul>
          </div>

          <div
            v-if="option.warning"
            class="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300"
          >
            <div class="flex items-start gap-1.5">
              <Icon name="lucide:alert-circle" class="size-3.5 shrink-0 text-amber-600 mt-0.5" />
              <span>{{ option.warning }}</span>
            </div>
          </div>
        </CardContent>

        <!-- Button at bottom of card -->
        <CardFooter class="pt-3 pb-5 border-t border-border/50">
          <Button
            type="button"
            :variant="hoveredButton === option.id || chosen === option.id ? 'default' : 'outline'"
            class="w-full h-10 font-medium text-xs sm:text-sm rounded-lg transition-all cursor-pointer"
            :class="(hoveredButton === option.id || chosen === option.id)
              ? 'bg-primary text-neutral-950 font-semibold hover:bg-primary/90 shadow-xs border-primary'
              : 'border-border text-foreground hover:border-primary/60'"
            @mouseenter="hoveredButton = option.id"
            @mouseleave="hoveredButton = null"
            @focus="hoveredButton = option.id"
            @blur="hoveredButton = null"
            @click="chooseAndSubmit(option.id)"
          >
            <span>{{ hoveredButton === option.id ? 'Continue with this setup' : MODEL_META[option.id].buttonText }}</span>
            <Icon
              name="lucide:arrow-right"
              class="size-3.5 ml-1.5 transition-transform duration-200"
              :class="hoveredButton === option.id ? 'translate-x-0.5' : ''"
            />
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
