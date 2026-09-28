<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAssistant } from '~/composables/useAssistant'
import ElevAIAssistant from '~/components/assistant/ElevAIAssistant.vue'
import ElevAIFindingsSettings from '~/components/assistant/ElevAIFindingsSettings.vue'

const { isOpen, closePanel } = useAssistant()

const settingsOpen = ref(false)

// ESC to close
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    closePanel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Lock body scroll when open on mobile
watch(isOpen, (open) => {
  if (typeof document === 'undefined') return
  if (open && window.innerWidth < 640) {
    document.body.style.overflow = 'hidden'
  }
  else {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="translate-x-full"
      leave-to-class="translate-x-full"
    >
      <aside
        v-if="isOpen"
        class="fixed right-0 top-0 z-50 flex h-screen w-full sm:w-[480px] flex-col border-l bg-background shadow-xl motion-reduce:transition-none"
        role="complementary"
        aria-label="AI Assistant"
        data-testid="elev-ai-panel"
      >
        <!-- Header -->
        <header class="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div class="flex items-center gap-2">
            <Icon name="elev8:elevai" class="size-4" />
            <h2 class="text-sm font-medium">Ask AI</h2>
          </div>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="AI findings settings"
              data-testid="elev-ai-settings"
              @click="settingsOpen = true"
            >
              <Icon name="lucide:settings-2" class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close AI assistant"
              data-testid="elev-ai-close"
              @click="closePanel"
            >
              <Icon name="lucide:x" class="size-4" />
            </Button>
          </div>
        </header>

        <!-- Chat content slot -->
        <ElevAIAssistant />
      </aside>
    </Transition>

    <!-- Findings settings sheet -->
    <ElevAIFindingsSettings v-model:open="settingsOpen" />
  </Teleport>
</template>