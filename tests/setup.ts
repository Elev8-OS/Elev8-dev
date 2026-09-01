import { beforeEach, vi } from 'vitest'
import { computed, onMounted, reactive, ref, resolveComponent, shallowRef, watch } from 'vue'
import { useAssistant } from './utils/useAssistant-global'

globalThis.toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}

// Nuxt auto-imports these in the app; expose them globally in tests for convenience.
globalThis.ref = ref
globalThis.computed = computed
globalThis.shallowRef = shallowRef
globalThis.reactive = reactive
globalThis.watch = watch
globalThis.onMounted = onMounted
// Components registered via mount({ global: { components } }) resolve through this.
globalThis.resolveComponent = resolveComponent

// Expose auto-imported composables so tests can call them without an import.
globalThis.useAssistant = useAssistant

// Lightweight useState shim — keyed on a global Map so multiple composables
// can share state across calls. Mirrors Nuxt's useState API just enough
// for unit tests of composables that read/write shared state.
// IMPORTANT: the cached value MUST be a Vue ref so writes trigger reactivity.
const useStateStore = new Map<string, { value: unknown }>()

globalThis.useState = <T>(keyOrInit?: string | (() => T), init?: () => T) => {
  // Match Nuxt's signature: useState(key, init) OR useState(init, key)
  let key: string
  let initializer: (() => T) | undefined
  if (typeof keyOrInit === 'string') {
    key = keyOrInit
    initializer = init
  }
  else if (typeof keyOrInit === 'function') {
    // useState(init) — auto key not used here; caller must pass key for sharing
    key = `__auto_${Math.random().toString(36).slice(2, 9)}`
    initializer = keyOrInit
  }
  else {
    key = `__auto_${Math.random().toString(36).slice(2, 9)}`
    initializer = undefined
  }
  if (!useStateStore.has(key)) {
    // Use ref() so the returned object is reactive — composables that
    // assign `.value = ...` trigger watchers/templates as expected.
    useStateStore.set(key, ref(initializer ? initializer() : undefined as unknown as T) as unknown as { value: unknown })
  }
  return useStateStore.get(key) as { value: T }
}

// Reset shared useState store between tests so each test starts with a clean slate.
beforeEach(() => {
  useStateStore.clear()
  // Mock fetch so assistant.submit() doesn't hit a real network in tests.
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(new Response('', { status: 200 })),
  ) as unknown as typeof fetch
})
