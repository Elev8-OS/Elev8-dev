<script setup lang="ts">
import type { GuideContentItem, GuideContentKindMeta } from '~/components/listings/data/guest-guide-content'
import SetupSelectBox from '~/components/listings/setup/SetupSelectBox.vue'
import ExpandableText from '~/components/shared/ExpandableText.vue'
import { toSafeHtml } from '~/lib/rich-text-sanitize.client'

/**
 * Guest guide items as one row list: a number for steps, the chosen icon for
 * Good to Know, a check for rules; photos as a fixed thumbnail. With
 * `selecting`, each row gets a select tick (`v-model:selected`, item ids).
 */
defineProps<{
  items: GuideContentItem[]
  meta: GuideContentKindMeta
  /** Where numbering starts (a room's steps continue after the property's). */
  startAt?: number
  /** Read-only rows inherited from the property, shown dimmed. */
  muted?: boolean
  selecting?: boolean
}>()
const selected = defineModel<string[]>('selected', { default: () => [] })

function toggle(id: string) {
  selected.value = selected.value.includes(id) ? selected.value.filter(x => x !== id) : [...selected.value, id]
}
</script>

<template>
  <ol class="flex flex-col divide-y rounded-lg border" :class="muted ? 'bg-muted/20' : ''" data-testid="guide-items">
    <li
      v-for="(item, i) in items"
      :key="item.id"
      class="flex items-start gap-3 p-3"
      :class="{ 'bg-muted/40': selecting && selected.includes(item.id) }"
      data-testid="guide-item"
    >
      <SetupSelectBox
        v-if="selecting"
        class="mt-1"
        :checked="selected.includes(item.id)"
        :label="`Select ${item.title}`"
        @toggle="toggle(item.id)"
      />
      <span
        v-if="meta.numbered"
        class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        :class="muted ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'"
      >{{ (startAt ?? 0) + i + 1 }}</span>
      <span v-else-if="meta.iconPicker" class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-foreground">
        <Icon :name="item.icon || 'lucide:info'" class="size-4" />
      </span>
      <Icon v-else name="lucide:check" class="mt-0.5 size-4 shrink-0 text-emerald-600" />
      <div class="min-w-0 flex-1" :class="muted ? 'opacity-80' : ''">
        <p class="text-sm font-medium">
          {{ item.title }}
        </p>
        <ExpandableText v-if="item.text" :html="toSafeHtml(item.text)" class="mt-0.5 text-sm text-muted-foreground" />
      </div>
      <img v-if="item.photoUrl" :src="item.photoUrl" alt="" class="aspect-video w-32 shrink-0 rounded-md border object-cover" data-testid="guide-item-thumb">
    </li>
  </ol>
</template>
