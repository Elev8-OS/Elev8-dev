<script setup lang="ts">
import type { CustomSop } from '~/components/listings/data/listing-sops'
import type { Listing } from '~/components/listings/data/listings'
import { findUnit, setRoomSops } from '~/components/listings/data/listing-room-overrides'

/** SOPs only for this room. The property's SOPs apply to it as well. */
const props = defineProps<{ listing: Listing, unitId: string }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const unit = computed(() => findUnit(props.listing, props.unitId))
const sops = computed(() => unit.value?.overrides?.sops ?? [])

function write(next: CustomSop[]) {
  emit('update', setRoomSops(props.listing, props.unitId, next))
}
function patch(id: string, change: Partial<Omit<CustomSop, 'id'>>) {
  write(sops.value.map(s => s.id === id ? { ...s, ...change } : s))
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="room-sops">
    <p class="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Icon name="lucide:link" class="mt-0.5 size-3.5 shrink-0" />
      The property's SOPs apply to this room too. Add an SOP here only for something that is different in {{ unit?.name ?? 'this room' }}.
    </p>

    <div v-for="item in sops" :key="item.id" class="flex flex-col gap-2 rounded-md border p-3" data-testid="room-sop">
      <div class="flex items-center gap-2">
        <Input
          :model-value="item.title"
          placeholder="SOP title, e.g. Jacuzzi in this room"
          aria-label="Room SOP title"
          class="h-8"
          @update:model-value="(v) => patch(item.id, { title: String(v) })"
        />
        <Button variant="ghost" size="icon" class="size-8 shrink-0 text-muted-foreground hover:text-destructive" :aria-label="`Remove ${item.title || 'room SOP'}`" @click="write(sops.filter(s => s.id !== item.id))">
          <Icon name="lucide:trash-2" class="size-4" />
        </Button>
      </div>
      <Textarea
        :model-value="item.text"
        rows="3"
        placeholder="What should the team do in this room?"
        aria-label="Room SOP text"
        @update:model-value="(v) => patch(item.id, { text: String(v) })"
      />
    </div>

    <Button variant="outline" size="sm" class="w-fit gap-1.5" data-testid="room-sop-add" @click="write([...sops, { id: `room-sop-${Date.now()}`, title: '', text: '', group: 'other' }])">
      <Icon name="lucide:plus" class="size-3.5" />
      Add SOP for this room
    </Button>
  </div>
</template>
