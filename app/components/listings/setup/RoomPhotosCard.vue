<script setup lang="ts">
import type { Listing } from '~/components/listings/data/listings'
import { findUnit, roomPhotos, setRoomPhotos } from '~/components/listings/data/listing-room-overrides'
import ListingPhotosEditor from '~/components/listings/ListingPhotosEditor.vue'

/** A room's photos: the property's until the room gets its own. */
const props = defineProps<{ listing: Listing, unitId: string }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const unit = computed(() => findUnit(props.listing, props.unitId))
const custom = computed(() => !!unit.value?.overrides?.photos)
const photos = computed(() => roomPhotos(props.listing, unit.value))
</script>

<template>
  <div class="flex flex-col gap-3 rounded-lg border p-4" data-testid="room-photos">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="text-sm font-medium">
        Photos
      </h3>
      <span v-if="custom" class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
        <Icon name="lucide:pencil" class="size-3" />
        Custom for this room
      </span>
      <span v-else class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        <Icon name="lucide:link" class="size-3" />
        Same as property
      </span>
      <button
        v-if="custom"
        type="button"
        class="ml-auto text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        data-testid="room-photos-reset"
        @click="emit('update', setRoomPhotos(listing, unitId, undefined))"
      >
        Use the property's photos
      </button>
    </div>

    <ListingPhotosEditor
      v-if="custom"
      :photos="photos"
      @update:photos="(next) => emit('update', setRoomPhotos(listing, unitId, next))"
    />
    <template v-else>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <img v-for="(src, i) in photos" :key="src" :src="src" :alt="`Property photo ${i + 1}`" class="aspect-video w-full rounded-md object-cover opacity-80">
      </div>
      <Button variant="outline" size="sm" class="w-fit gap-1.5" data-testid="room-photos-customize" @click="emit('update', setRoomPhotos(listing, unitId, [...listing.photos]))">
        <Icon name="lucide:images" class="size-3.5" />
        Use different photos for this room
      </Button>
    </template>
  </div>
</template>
