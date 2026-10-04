<script setup lang="ts">
import type * as Leaflet from 'leaflet'
import type { LatLng } from '~/components/listings/data/listing-address'
import 'leaflet/dist/leaflet.css'

/**
 * A map with one draggable pin (Leaflet + OpenStreetMap tiles). Drag the pin
 * or click the map to move it; `move` fires with the new point. Leaflet needs
 * the DOM, so it is loaded on mount (render this inside <ClientOnly>).
 */
const props = defineProps<{ pin: LatLng }>()
const emit = defineEmits<{ move: [pin: LatLng] }>()

const el = ref<HTMLElement | null>(null)
let map: Leaflet.Map | null = null
let marker: Leaflet.Marker | null = null
let resizeObserver: ResizeObserver | null = null

// A div icon: Leaflet's default marker images do not resolve through the bundler.
const PIN_HTML = `<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" stroke="white" stroke-width="1.5" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.6" fill="white" stroke="none"/></svg>`

onMounted(async () => {
  const L = await import('leaflet')
  if (!el.value)
    return
  map = L.map(el.value, { scrollWheelZoom: false }).setView([props.pin.lat, props.pin.lng], 15)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  const icon = L.divIcon({ html: PIN_HTML, className: 'text-foreground', iconSize: [32, 32], iconAnchor: [16, 30] })
  marker = L.marker([props.pin.lat, props.pin.lng], { draggable: true, icon, keyboard: true, title: 'Property pin' }).addTo(map)
  marker.on('dragend', () => {
    const { lat, lng } = marker!.getLatLng()
    emit('move', { lat, lng })
  })
  map.on('click', (e: Leaflet.LeafletMouseEvent) => {
    marker!.setLatLng(e.latlng)
    emit('move', { lat: e.latlng.lat, lng: e.latlng.lng })
  })
  // The map often mounts inside an accordion that is still opening; a map
  // sized while hidden draws grey tiles until it is told its real size.
  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(el.value)
})

// Follow the pin when it changes from outside (e.g. another listing loaded).
watch(() => props.pin, (pin) => {
  if (!marker || !map)
    return
  const current = marker.getLatLng()
  if (current.lat !== pin.lat || current.lng !== pin.lng) {
    marker.setLatLng([pin.lat, pin.lng])
    map.panTo([pin.lat, pin.lng])
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.remove()
  map = null
  marker = null
})
</script>

<template>
  <!-- `isolate` keeps Leaflet's high z-index panes under dialogs and sheets. -->
  <div ref="el" class="isolate h-56 w-full overflow-hidden rounded-md border" data-testid="location-pin-map" />
</template>
