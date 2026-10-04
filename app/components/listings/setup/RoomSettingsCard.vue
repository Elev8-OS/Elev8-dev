<script setup lang="ts">
import type { ListingDetailField } from '~/components/listings/data/listing-details'
import type { Listing } from '~/components/listings/data/listings'
import { findUnit, isRoomCustom, resetRoomField, ROOM_OVERRIDE_FIELDS, roomFieldValue, setRoomField } from '~/components/listings/data/listing-room-overrides'

/**
 * The fields a room may set for itself. Each shows the property's value until
 * the room changes it ("Same as property"), then the room's own ("Custom for
 * this room") with a reset.
 */
const props = defineProps<{ listing: Listing, unitId: string }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const unit = computed(() => findUnit(props.listing, props.unitId))

function write(field: ListingDetailField, value: unknown, end = false) {
  emit('update', setRoomField(props.listing, props.unitId, field, String(value), end))
}
</script>

<template>
  <div class="flex flex-col gap-4 rounded-lg border p-4" data-testid="room-settings">
    <div class="flex flex-col gap-0.5">
      <h3 class="text-sm font-medium">
        Room settings
      </h3>
      <p class="text-xs text-muted-foreground">
        These start as the property's. Change one only if this room is different.
      </p>
    </div>

    <div v-for="field in ROOM_OVERRIDE_FIELDS" :key="field.key" class="flex flex-col gap-1.5" :data-testid="`room-field-${field.key}`">
      <div class="flex flex-wrap items-center gap-2">
        <Label :for="`room-${field.key}`">{{ field.label }}</Label>
        <span
          v-if="isRoomCustom(unit, field.key)"
          class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
          data-testid="room-field-custom"
        >
          <Icon name="lucide:pencil" class="size-3" />
          Custom for this room
        </span>
        <span v-else class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground" data-testid="room-field-inherited">
          <Icon name="lucide:link" class="size-3" />
          Same as property
        </span>
        <button
          v-if="isRoomCustom(unit, field.key)"
          type="button"
          class="ml-auto text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          :aria-label="`Reset ${field.label} to the property's`"
          @click="emit('update', resetRoomField(listing, unitId, field.key))"
        >
          Reset to property
        </button>
      </div>

      <div v-if="field.input === 'time-range'" class="flex items-center gap-2">
        <Input :id="`room-${field.key}`" type="time" class="w-36" :model-value="roomFieldValue(listing, unit, field)" @update:model-value="(v) => write(field, v)" />
        <span class="text-sm text-muted-foreground">to</span>
        <Input type="time" class="w-36" :aria-label="`${field.label} until`" :model-value="roomFieldValue(listing, unit, field, true)" @update:model-value="(v) => write(field, v, true)" />
      </div>
      <Textarea
        v-else-if="field.input === 'textarea'"
        :id="`room-${field.key}`"
        rows="3"
        :model-value="roomFieldValue(listing, unit, field)"
        @update:model-value="(v) => write(field, v)"
      />
      <Input
        v-else
        :id="`room-${field.key}`"
        :type="field.input === 'time' ? 'time' : field.input === 'password' ? 'password' : 'text'"
        :class="field.input === 'time' ? 'w-36' : ''"
        :model-value="roomFieldValue(listing, unit, field)"
        @update:model-value="(v) => write(field, v)"
      />
    </div>
  </div>
</template>
