<script setup lang="ts">
import type { PlaceSuggestion } from '~/components/listings/data/listing-address'
import { searchPlaces } from '~/components/listings/data/listing-address'

/**
 * Address autocomplete for the pinpoint: type, pick a suggestion (mouse or
 * arrow keys + Enter), and `select` fires with its point and address.
 */
const emit = defineEmits<{ select: [place: PlaceSuggestion] }>()

const query = ref('')
const open = ref(false)
const active = ref(0)
const suggestions = computed(() => searchPlaces(query.value))

watch(query, () => {
  active.value = 0
  open.value = !!query.value.trim()
})

function choose(place: PlaceSuggestion | undefined) {
  if (!place)
    return
  emit('select', place)
  query.value = ''
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open.value = false
    return
  }
  if (!open.value || !suggestions.value.length)
    return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % suggestions.value.length
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + suggestions.value.length) % suggestions.value.length
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    choose(suggestions.value[active.value])
  }
}
</script>

<template>
  <div class="relative">
    <Icon name="lucide:search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      v-model="query"
      role="combobox"
      aria-label="Search an address or area"
      aria-autocomplete="list"
      aria-controls="place-search-list"
      :aria-expanded="open"
      :aria-activedescendant="open && suggestions.length ? `place-option-${active}` : undefined"
      placeholder="Search an address or area, e.g. Canggu"
      class="pl-8"
      data-testid="place-search"
      @keydown="onKeydown"
      @focus="open = !!query.trim()"
      @blur="open = false"
    />
    <!-- Above the map's panes (Leaflet uses z-index up to 1000). -->
    <ul
      v-if="open"
      id="place-search-list"
      role="listbox"
      class="absolute inset-x-0 top-full z-[1100] mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      data-testid="place-search-list"
    >
      <li
        v-for="(place, i) in suggestions"
        :id="`place-option-${i}`"
        :key="place.label"
        role="option"
        :aria-selected="i === active"
        class="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm"
        :class="i === active ? 'bg-accent text-accent-foreground' : ''"
        @mousedown.prevent="choose(place)"
        @mouseenter="active = i"
      >
        <Icon name="lucide:map-pin" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span class="flex min-w-0 flex-col">
          <span class="truncate">{{ place.label }}</span>
          <span class="truncate text-xs text-muted-foreground">{{ place.detail }}</span>
        </span>
      </li>
      <li v-if="!suggestions.length" class="px-2 py-1.5 text-sm text-muted-foreground">
        No places match "{{ query.trim() }}". Drop the pin on the map instead.
      </li>
    </ul>
  </div>
</template>
