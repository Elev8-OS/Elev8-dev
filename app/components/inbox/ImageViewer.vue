<script lang="ts" setup>
/**
 * A photo at full size. Mounted once per surface (`inbox/Layout.vue` for the
 * inbox); anything that renders a photo calls `openImage` with the same scope
 * rather than owning an overlay of its own.
 */
import { nextTick } from 'vue'

const props = withDefaults(defineProps<{ scope?: string }>(), { scope: 'inbox' })

const { viewedImage, isOpen } = useImageViewer(props.scope)

/** How far a click zooms in. Enough to read a hairline crack in a phone photo. */
const ZOOM = 2.5

/**
 * The photo can fail to load here too: a blob URL does not survive a reload,
 * so a thread reopened later can hand the viewer a dead URL.
 */
const broken = ref(false)
const zoomed = ref(false)
const frameEl = ref<HTMLElement | null>(null)
watch(viewedImage, () => {
  broken.value = false
  zoomed.value = false
})

/**
 * Click to zoom in on the point clicked, click again to fit. The frame then
 * scrolls, so the rest of the photo is a scroll away rather than cropped.
 */
async function toggleZoom(event: MouseEvent) {
  if (zoomed.value) {
    zoomed.value = false
    return
  }
  const img = event.currentTarget instanceof HTMLElement
    ? event.currentTarget.querySelector('img')
    : null
  const rect = img?.getBoundingClientRect()
  // A keyboard press has no pointer position, so it zooms on the centre.
  const fx = rect && rect.width && event.detail > 0 ? (event.clientX - rect.left) / rect.width : 0.5
  const fy = rect && rect.height && event.detail > 0 ? (event.clientY - rect.top) / rect.height : 0.5
  zoomed.value = true
  await nextTick()
  const frame = frameEl.value
  if (!frame)
    return
  frame.scrollLeft = fx * frame.scrollWidth - frame.clientWidth / 2
  frame.scrollTop = fy * frame.scrollHeight - frame.clientHeight / 2
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <!-- Sized to the viewport rather than the dialog default, and padded down,
         so the photo is the thing on screen and not a thumbnail in a card. -->
    <DialogContent
      class="max-w-[min(1100px,92vw)] gap-3 p-4 sm:max-w-[min(1100px,92vw)]"
      data-testid="image-viewer"
    >
      <DialogHeader class="pr-8 text-left">
        <DialogTitle class="text-sm">
          {{ viewedImage?.senderName ?? 'Photo' }}
        </DialogTitle>
        <DialogDescription class="text-xs">
          <template v-if="viewedImage?.timestamp">
            {{ timeLabel(viewedImage.timestamp) }}
          </template>
          <template v-if="viewedImage?.dims">
            · {{ viewedImage.dims }}
          </template>
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="broken"
        class="flex items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-sm text-muted-foreground"
        data-testid="viewer-photo-unavailable"
      >
        <Icon name="lucide:image-off" class="size-4" />
        Photo unavailable
      </div>
      <div
        v-else-if="viewedImage"
        ref="frameEl"
        class="max-h-[72vh] rounded-lg"
        :class="zoomed ? 'overflow-auto' : 'overflow-hidden'"
        data-testid="viewer-frame"
      >
        <button
          type="button"
          class="block w-full"
          :class="zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'"
          :style="zoomed ? { width: `${ZOOM * 100}%` } : undefined"
          :aria-label="zoomed ? 'Zoom out' : 'Zoom in'"
          :aria-pressed="zoomed"
          data-testid="viewer-zoom"
          @click="toggleZoom"
        >
          <img
            :src="viewedImage.url"
            :alt="viewedImage.caption || 'Photo'"
            class="w-full rounded-lg"
            :class="zoomed ? 'max-w-none' : 'max-h-[72vh] object-contain'"
            @error="broken = true"
          >
        </button>
      </div>
      <p v-if="viewedImage && !broken" class="text-xs text-muted-foreground">
        {{ zoomed ? 'Click the photo to fit it back to the screen. Scroll to move around.' : 'Click the photo to zoom in.' }}
      </p>

      <p v-if="viewedImage?.caption" class="whitespace-pre-line text-sm">
        {{ viewedImage.caption }}
      </p>
    </DialogContent>
  </Dialog>
</template>
