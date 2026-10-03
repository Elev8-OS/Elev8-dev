<script setup lang="ts">
import type { CleaningGuidance } from '~/components/cleaning/data/cleaning-guidance'
import { youtubeEmbedUrl, youtubeWatchUrl } from '~/components/cleaning/data/cleaning-guidance'

/** One guidance item as housekeeping reads it: the instructions, then each video embedded. */
defineProps<{ guidance: CleaningGuidance | null }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="guidance-dialog">
      <template v-if="guidance">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="lucide:book-open" class="size-4 text-muted-foreground" />
            {{ guidance.title }}
          </DialogTitle>
          <DialogDescription class="sr-only">
            Guidance for housekeeping
          </DialogDescription>
        </DialogHeader>
        <img
          v-if="guidance.thumbnailUrl"
          :src="guidance.thumbnailUrl"
          alt=""
          class="aspect-video w-full rounded-lg border object-cover"
          data-testid="guidance-dialog-thumbnail"
        >
        <p v-if="guidance.body" class="whitespace-pre-line text-sm leading-relaxed">
          {{ guidance.body }}
        </p>
        <div v-for="video in guidance.videos" :key="video.id" class="flex flex-col gap-1.5" data-testid="guidance-video">
          <p v-if="video.title" class="text-sm font-medium">
            {{ video.title }}
          </p>
          <div class="aspect-video overflow-hidden rounded-lg border bg-muted">
            <iframe
              :src="youtubeEmbedUrl(video.youtubeId)"
              :title="video.title || guidance.title"
              class="size-full"
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            />
          </div>
          <a :href="youtubeWatchUrl(video.youtubeId)" target="_blank" rel="noopener" class="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Icon name="lucide:external-link" class="size-3" />
            Open on YouTube
          </a>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
