<script setup lang="ts">
/**
 * One evidence photo. With `zoomable` it is a button that emits `open`, and the
 * parent shows the photo full size in its image viewer; without it (inside a
 * finding row's own button) it is a plain image, since a button inside a
 * button is not reachable on its own. A photo that cannot load says so rather
 * than showing a broken-image icon.
 */
const props = withDefaults(defineProps<{
  src: string
  alt: string
  size?: 'sm' | 'md'
  zoomable?: boolean
}>(), { size: 'md', zoomable: false })

const emit = defineEmits<{ open: [] }>()

const broken = ref(false)
watch(() => props.src, () => {
  broken.value = false
})

const box = computed(() => (props.size === 'sm' ? 'size-12' : 'size-20'))
</script>

<template>
  <span
    v-if="broken"
    data-testid="claim-photo-unavailable"
    class="flex shrink-0 items-center justify-center rounded-md border bg-muted text-center text-[10px] leading-tight text-muted-foreground"
    :class="box"
    role="img"
    :aria-label="`Photo unavailable: ${alt}`"
  >
    <Icon v-if="size === 'sm'" name="lucide:image-off" class="size-4" />
    <template v-else>Photo unavailable</template>
  </span>
  <button
    v-else-if="zoomable"
    type="button"
    class="block shrink-0 cursor-zoom-in overflow-hidden rounded-md border transition-opacity hover:opacity-80"
    :aria-label="`View photo full size: ${alt}`"
    data-testid="claim-photo-open"
    @click="emit('open')"
  >
    <img :src="src" :alt="alt" :class="box" class="object-cover" data-testid="claim-photo" @error="broken = true">
  </button>
  <img
    v-else
    :src="src"
    :alt="alt"
    :class="box"
    class="shrink-0 rounded-md border object-cover"
    data-testid="claim-photo"
    @error="broken = true"
  >
</template>
