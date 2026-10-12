<script setup lang="ts">
import type { CarouselApi } from '@/components/ui/carousel'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

export interface AuthSlide {
  src: string
  alt: string
}

const props = withDefaults(defineProps<{
  slides: AuthSlide[]
  /** Milliseconds per slide. */
  interval?: number
}>(), {
  interval: 6000,
})

const api = ref<CarouselApi>()
const selected = ref(0)
const paused = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function onInit(value: CarouselApi): void {
  api.value = value
  selected.value = value?.selectedScrollSnap() ?? 0
  value?.on('select', () => {
    selected.value = value.selectedScrollSnap()
  })
}

function stop(): void {
  if (timer)
    clearInterval(timer)
  timer = null
}

function start(): void {
  stop()
  if (props.slides.length < 2 || paused.value)
    return
  // Motion is opt-out: a reduced-motion viewer keeps the dots, loses the autoplay.
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    return
  timer = setInterval(() => api.value?.scrollNext(), props.interval)
}

function goTo(index: number): void {
  api.value?.scrollTo(index)
  // A manual pick restarts the clock so the chosen slide gets its full time.
  start()
}

function setPaused(value: boolean): void {
  paused.value = value
  if (value)
    stop()
  else
    start()
}

onMounted(start)
onBeforeUnmount(stop)
</script>

<template>
  <Carousel
    :opts="{ loop: true }"
    class="flex w-full max-w-2xl flex-col items-center gap-6"
    @init-api="onInit"
    @mouseenter="setPaused(true)"
    @mouseleave="setPaused(false)"
    @focusin="setPaused(true)"
    @focusout="setPaused(false)"
  >
    <CarouselContent class="w-full">
      <CarouselItem v-for="slide in slides" :key="slide.src" class="flex items-center justify-center">
        <img
          :src="slide.src"
          :alt="slide.alt"
          class="max-h-[calc(100dvh-8rem)] w-auto max-w-full rounded-2xl object-contain"
          draggable="false"
        >
      </CarouselItem>
    </CarouselContent>

    <div v-if="slides.length > 1" class="flex items-center gap-2">
      <button
        v-for="(slide, index) in slides"
        :key="slide.src"
        type="button"
        :aria-label="`Show slide ${index + 1} of ${slides.length}`"
        :aria-current="selected === index ? 'true' : undefined"
        :class="cn(
          'h-2 rounded-full transition-all cursor-pointer',
          selected === index ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50',
        )"
        @click="goTo(index)"
      />
    </div>
  </Carousel>
</template>
