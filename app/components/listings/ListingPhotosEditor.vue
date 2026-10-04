<script setup lang="ts">
import { toast } from 'vue-sonner'

/**
 * A listing's photos: upload (several at once), replace, delete, view full
 * size, and drag to reorder. The first photo is the thumbnail. Used by the
 * hero's Manage Photos dialog and Listing Setup > Basics.
 */
const photos = defineModel<string[]>('photos', { required: true })

const MAX_PHOTOS = 20
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

const fileInputEl = ref<HTMLInputElement | null>(null)
const replaceInputEl = ref<HTMLInputElement | null>(null)
const replaceIndex = ref<number | null>(null)
const previewPhoto = ref<string | null>(null)
const dragIndex = ref<number | null>(null)

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function rejectReason(file: File): string | null {
  if (!ALLOWED.includes(file.type))
    return 'not a JPEG, PNG or WebP'
  if (file.size > MAX_SIZE)
    return 'over 10MB'
  return null
}

/** Reads every accepted file, then saves them in one update (one per file would keep only the last). */
async function uploadPhotos(input: HTMLInputElement) {
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length)
    return
  const room = MAX_PHOTOS - photos.value.length
  const accepted = files.filter(f => !rejectReason(f))
  for (const f of files.filter(f => rejectReason(f)))
    toast.error(`${f.name} skipped: ${rejectReason(f)}`)
  if (accepted.length > room)
    toast.info(`Only ${room} more ${room === 1 ? 'photo fits' : 'photos fit'} (max ${MAX_PHOTOS}).`)
  const added = await Promise.all(accepted.slice(0, room).map(readAsDataUrl))
  if (added.length)
    photos.value = [...photos.value, ...added]
}

async function replacePhoto(input: HTMLInputElement) {
  const file = input.files?.[0]
  input.value = ''
  const index = replaceIndex.value
  replaceIndex.value = null
  if (!file || index === null)
    return
  const reason = rejectReason(file)
  if (reason) {
    toast.error(`${file.name} skipped: ${reason}`)
    return
  }
  const src = await readAsDataUrl(file)
  photos.value = photos.value.map((p, i) => i === index ? src : p)
}

function startReplace(index: number) {
  replaceIndex.value = index
  replaceInputEl.value?.click()
}

function deletePhoto(index: number) {
  photos.value = photos.value.filter((_, i) => i !== index)
}

function onDrop(targetIndex: number) {
  const from = dragIndex.value
  dragIndex.value = null
  if (from === null || from === targetIndex)
    return
  const next = [...photos.value]
  const [moved] = next.splice(from, 1)
  next.splice(targetIndex, 0, moved!)
  photos.value = next
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="photos-grid">
    <div
      v-for="(photo, index) in photos"
      :key="photo"
      class="group relative aspect-video cursor-grab overflow-hidden rounded-lg border-2 transition-colors"
      :class="index === 0 ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'"
      draggable="true"
      data-testid="photo-tile"
      @dragstart="dragIndex = index"
      @dragover.prevent
      @drop="onDrop(index)"
    >
      <img :src="photo" :alt="`Photo ${index + 1}`" class="size-full object-cover">

      <!-- Shown on hover and on keyboard focus. -->
      <div class="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/40"
          :aria-label="`View photo ${index + 1}`"
          @click.stop="previewPhoto = photo"
        >
          <Icon name="lucide:expand" class="size-4" />
        </button>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/40"
          :aria-label="`Replace photo ${index + 1}`"
          @click.stop="startReplace(index)"
        >
          <Icon name="lucide:image-plus" class="size-4" />
        </button>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-destructive/80"
          :aria-label="`Delete photo ${index + 1}`"
          @click.stop="deletePhoto(index)"
        >
          <Icon name="lucide:trash-2" class="size-4" />
        </button>
      </div>

      <Badge v-if="index === 0" class="absolute left-1.5 top-1.5 px-1.5 py-0 text-[10px]">
        Thumbnail
      </Badge>
    </div>

    <!-- Upload slot -->
    <button
      v-if="photos.length < MAX_PHOTOS"
      type="button"
      class="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
      data-testid="photo-add"
      @click="fileInputEl?.click()"
    >
      <Icon name="lucide:plus" class="size-6" />
      <span class="text-xs">Add photos</span>
      <span class="text-[10px]">{{ photos.length }}/{{ MAX_PHOTOS }}</span>
    </button>
  </div>

  <input
    ref="fileInputEl"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    multiple
    class="hidden"
    data-testid="photo-file-input"
    @change="uploadPhotos($event.target as HTMLInputElement)"
  >
  <input
    ref="replaceInputEl"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    class="hidden"
    @change="replacePhoto($event.target as HTMLInputElement)"
  >

  <!-- Full preview -->
  <Dialog :open="!!previewPhoto" @update:open="(v) => { if (!v) previewPhoto = null }">
    <DialogContent class="max-w-5xl border-0 bg-black/90 p-2">
      <DialogTitle class="sr-only">
        Photo preview
      </DialogTitle>
      <img v-if="previewPhoto" :src="previewPhoto" alt="Photo preview" class="max-h-[85vh] w-full rounded object-contain">
    </DialogContent>
  </Dialog>
</template>
