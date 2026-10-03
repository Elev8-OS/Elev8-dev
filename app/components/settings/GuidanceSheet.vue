<script setup lang="ts">
import type { CleaningGuidance } from '~/components/cleaning/data/cleaning-guidance'
import type { GuidanceInput } from '~/composables/useCleaningGuidance'
import { toast } from 'vue-sonner'
import { GUIDANCE_THUMBNAIL_MAX_BYTES, GUIDANCE_THUMBNAIL_TYPES, parseYouTubeId, youtubeThumbnailUrl } from '~/components/cleaning/data/cleaning-guidance'
import { useCleaningGuidance } from '~/composables/useCleaningGuidance'

/** Creates or edits one guidance item (`guidance` null = new): title, text, YouTube links. */
const props = defineProps<{ guidance: CleaningGuidance | null }>()
const open = defineModel<boolean>('open', { default: false })

const { createGuidance, updateGuidance } = useCleaningGuidance()

const title = ref('')
const body = ref('')
const videos = ref<GuidanceInput['videos']>([])
const thumbnailUrl = ref('')
const thumbnailInput = ref<HTMLInputElement | null>(null)
const linkInput = ref('')
const linkError = ref('')

watch(open, (isOpen) => {
  if (!isOpen)
    return
  title.value = props.guidance?.title ?? ''
  body.value = props.guidance?.body ?? ''
  videos.value = JSON.parse(JSON.stringify(props.guidance?.videos ?? []))
  thumbnailUrl.value = props.guidance?.thumbnailUrl ?? ''
  linkInput.value = ''
  linkError.value = ''
}, { immediate: true })

const canSave = computed(() => title.value.trim().length > 0 && (body.value.trim().length > 0 || videos.value.length > 0))

function uploadThumbnail(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  if (!GUIDANCE_THUMBNAIL_TYPES.includes(file.type)) {
    toast.error('Use a PNG, JPG or WebP image')
    return
  }
  if (file.size > GUIDANCE_THUMBNAIL_MAX_BYTES) {
    toast.error('Thumbnail must be less than 2MB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string')
      thumbnailUrl.value = reader.result
  }
  reader.readAsDataURL(file)
}

function addVideo() {
  const youtubeId = parseYouTubeId(linkInput.value)
  if (!youtubeId) {
    linkError.value = 'That is not a YouTube video link.'
    return
  }
  if (videos.value.some(v => v.youtubeId === youtubeId)) {
    linkError.value = 'This video is already attached.'
    return
  }
  videos.value = [...videos.value, { url: linkInput.value.trim(), youtubeId }]
  linkInput.value = ''
  linkError.value = ''
}

function updateVideoTitle(index: number, value: string) {
  videos.value = videos.value.map((v, i) => i === index ? { ...v, title: value } : v)
}

function removeVideo(index: number) {
  videos.value = videos.value.filter((_, i) => i !== index)
}

function save() {
  const input = { title: title.value, body: body.value, thumbnailUrl: thumbnailUrl.value, videos: videos.value }
  if (props.guidance) {
    updateGuidance(props.guidance.id, input)
    toast.success('Guidance saved')
  }
  else {
    createGuidance(input)
    toast.success('Guidance created')
  }
  open.value = false
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
      <SheetHeader class="border-b p-5">
        <SheetTitle>{{ guidance ? 'Edit guidance' : 'New guidance' }}</SheetTitle>
        <SheetDescription>
          Attach it to cleaning steps. Changes reach every step that uses it, including cleanings already scheduled.
        </SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div class="grid gap-1.5">
          <Label>Thumbnail</Label>
          <div class="flex items-center gap-3">
            <div class="flex aspect-video w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Guidance thumbnail" class="size-full object-cover" data-testid="guidance-thumbnail-preview">
              <Icon v-else name="lucide:image" class="size-6 text-muted-foreground" />
            </div>
            <div class="flex flex-col gap-1.5">
              <div class="flex gap-2">
                <Button variant="outline" size="sm" class="gap-1.5" data-testid="guidance-thumbnail-upload" @click="thumbnailInput?.click()">
                  <Icon name="lucide:upload" class="size-3.5" />
                  {{ thumbnailUrl ? 'Replace' : 'Upload' }}
                </Button>
                <Button v-if="thumbnailUrl" variant="ghost" size="sm" class="text-muted-foreground" data-testid="guidance-thumbnail-remove" @click="thumbnailUrl = ''">
                  Remove
                </Button>
              </div>
              <p class="text-[11px] text-muted-foreground">
                PNG, JPG or WebP, under 2MB. Without one, the first video's thumbnail is used.
              </p>
            </div>
            <input
              ref="thumbnailInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="hidden"
              data-testid="guidance-thumbnail-input"
              @change="uploadThumbnail"
            >
          </div>
        </div>

        <div class="grid gap-1.5">
          <Label for="gd-title">Title <span class="text-destructive">*</span></Label>
          <Input id="gd-title" v-model="title" placeholder="e.g. Making a bed to hotel standard" data-testid="guidance-title" />
        </div>

        <div class="grid gap-1.5">
          <Label for="gd-body">Instructions</Label>
          <Textarea id="gd-body" v-model="body" rows="6" placeholder="Write the how-to, step by step." data-testid="guidance-body" />
        </div>

        <div class="grid gap-2">
          <Label for="gd-link">YouTube videos</Label>
          <div class="flex gap-2">
            <Input
              id="gd-link"
              v-model="linkInput"
              placeholder="https://www.youtube.com/watch?v=..."
              class="flex-1"
              data-testid="guidance-link"
              @keydown.enter.prevent="addVideo"
            />
            <Button variant="outline" :disabled="!linkInput.trim()" data-testid="guidance-add-video" @click="addVideo">
              Add
            </Button>
          </div>
          <p v-if="linkError" class="text-xs text-destructive" data-testid="guidance-link-error">
            {{ linkError }}
          </p>

          <div v-for="(video, index) in videos" :key="video.id ?? video.youtubeId" class="flex items-center gap-3 rounded-lg border p-2" data-testid="guidance-video-row">
            <img :src="youtubeThumbnailUrl(video.youtubeId)" alt="" class="h-14 w-24 shrink-0 rounded-md bg-muted object-cover">
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <Input
                :model-value="video.title ?? ''"
                placeholder="Video title (optional)"
                class="h-8 text-xs"
                :aria-label="`Title for video ${index + 1}`"
                @update:model-value="updateVideoTitle(index, String($event))"
              />
              <span class="truncate text-[11px] text-muted-foreground">{{ video.url }}</span>
            </div>
            <Button variant="ghost" size="icon" class="size-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remove video" @click="removeVideo(index)">
              <Icon name="lucide:x" class="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <SheetFooter class="flex-row justify-end gap-2 border-t p-4">
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!canSave" data-testid="guidance-save" @click="save">
          {{ guidance ? 'Save guidance' : 'Create guidance' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
