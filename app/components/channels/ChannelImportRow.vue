<script setup lang="ts">
import type { PickerOption } from './ChannelListingPicker.vue'
import type { RemoteListing } from './data/remote-listings'
import ChannelListingPicker from './ChannelListingPicker.vue'

export type ImportRowState = 'suggested' | 'chosen' | 'skipped' | 'linked'

defineProps<{
  remote: RemoteListing
  channel: string
  state: ImportRowState
  options: PickerOption[]
  /** Elev8 listing name, for rows that are already linked. */
  linkedName?: string
}>()

const pick = defineModel<string | null>('pick', { default: null })
</script>

<template>
  <li class="grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4">
    <div class="min-w-0">
      <p class="truncate text-sm font-medium">
        {{ remote.title }}
      </p>
      <p class="flex gap-3 text-xs text-muted-foreground">
        <span class="truncate">{{ remote.location }}</span>
        <span class="shrink-0 tabular-nums">ID {{ remote.externalId }}</span>
      </p>
    </div>

    <Icon name="lucide:arrow-right" class="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />

    <div class="flex min-w-0 items-center gap-2">
      <template v-if="state === 'linked'">
        <p class="min-w-0 flex-1 truncate text-sm">
          {{ linkedName }}
        </p>
        <Badge variant="secondary" class="shrink-0">
          Linked
        </Badge>
      </template>
      <template v-else>
        <div class="min-w-0 flex-1">
          <ChannelListingPicker v-model="pick" :options="options" :label="`Elev8 listing for ${remote.title}`" />
        </div>
        <Badge v-if="state === 'suggested'" variant="outline" class="w-[84px] shrink-0">
          Suggested
        </Badge>
        <Badge v-else-if="state === 'skipped'" variant="outline" class="w-[84px] shrink-0 text-muted-foreground">
          Won't sync
        </Badge>
        <span v-else class="w-[84px] shrink-0" aria-hidden="true" />
      </template>
    </div>
  </li>
</template>
