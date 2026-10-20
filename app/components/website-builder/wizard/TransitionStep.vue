<script setup lang="ts">
// Short interstitial between the questions and the real setup.
const emit = defineEmits<{ done: [] }>()

const visible = ref(false)
const timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  visible.value = true
  timers.push(setTimeout(() => {
    visible.value = false
    timers.push(setTimeout(() => emit('done'), 500))
  }, 1800))
})
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <div class="flex min-h-96 flex-col items-center justify-center" data-testid="wz-transition">
    <Transition
      enter-active-class="transition-opacity duration-500"
      leave-active-class="transition-opacity duration-500"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <h2 v-if="visible" class="text-center text-4xl font-bold tracking-tight">
        Let's set up your website.
      </h2>
    </Transition>
  </div>
</template>
