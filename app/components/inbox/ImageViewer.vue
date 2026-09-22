<script lang="ts" setup>
/**
 * A photo at full size. Mounted once in `inbox/Layout.vue`; anything that
 * renders a photo calls `openImage` rather than owning an overlay of its own.
 */
const { viewedImage, isOpen } = useImageViewer()

/**
 * The photo can fail to load here too: a blob URL does not survive a reload,
 * so a thread reopened later can hand the viewer a dead URL.
 */
const broken = ref(false)
watch(viewedImage, () => {
  broken.value = false
})

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
      <img
        v-else-if="viewedImage"
        :src="viewedImage.url"
        :alt="viewedImage.caption || 'Photo'"
        class="max-h-[72vh] w-full rounded-lg object-contain"
        @error="broken = true"
      >

      <p v-if="viewedImage?.caption" class="whitespace-pre-line text-sm">
        {{ viewedImage.caption }}
      </p>
    </DialogContent>
  </Dialog>
</template>
