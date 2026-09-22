/**
 * The full-size photo overlay. Its state lives here rather than in a message,
 * so the one viewer can be mounted once in `inbox/Layout.vue` instead of once
 * per message, and so a photo inside a forwarded card can open it without
 * reaching back up through its parent.
 */

export interface ViewedImage {
  url: string
  /** Who sent it, for the line above the photo. */
  senderName?: string
  /** The message text, if the photo had one. */
  caption?: string
  timestamp?: string
  /** "1280 × 960", when it is known. */
  dims?: string
}

export function useImageViewer() {
  const viewedImage = useState<ViewedImage | null>('inbox-viewed-image', () => null)

  const isOpen = computed({
    get: () => viewedImage.value !== null,
    set: (open: boolean) => {
      if (!open)
        viewedImage.value = null
    },
  })

  function openImage(image: ViewedImage) {
    if (!image.url)
      return
    viewedImage.value = image
  }

  function closeImage() {
    viewedImage.value = null
  }

  return { viewedImage, isOpen, openImage, closeImage }
}
