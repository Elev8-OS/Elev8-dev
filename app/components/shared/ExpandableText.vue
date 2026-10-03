<script setup lang="ts">
// Explicit imports: guide-app imports this file from outside its own srcDir, where Nuxt auto-imports do not reach.
import { computed, ref } from 'vue'
// Relative, not `~/`: in guide-app `~` is guide-app's own folder.
import { richTextToPlainText } from '../../lib/rich-text'

/**
 * Guest guide body text (rich text from the WYSIWYG editor) at a readable line
 * length, folded to a few lines behind "Show more" when long, so one long tip
 * never buries the rest of the list. Used in the listing's Guest Guide tab and
 * on the guest's guide page (guide-app imports it).
 *
 * ⚠️ `html` must already be safe: `toSafeHtml` in the dashboard, the guide
 * endpoint's sanitizer for guide-app (see `app/lib/rich-text.ts`).
 *
 * "Long" is decided from the text, not measured: over `maxChars` characters or
 * more than `lines` lines. The same text folds the same way everywhere.
 */
const props = withDefaults(defineProps<{
  html: string
  lines?: 2 | 3 | 4
  maxChars?: number
  moreLabel?: string
  lessLabel?: string
}>(), {
  lines: 3,
  maxChars: 220,
  moreLabel: 'Show more',
  lessLabel: 'Show less',
})

const expanded = ref(false)

const plain = computed(() => richTextToPlainText(props.html))
const isLong = computed(() => plain.value.length > props.maxChars || plain.value.split('\n').length > props.lines)

const clampClass = computed(() => ({ 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' })[props.lines])
</script>

<template>
  <div class="max-w-prose">
    <!-- eslint-disable-next-line vue/no-v-html -- safe HTML only, see the note above -->
    <div
      class="prose-guide"
      :class="isLong && !expanded ? clampClass : ''"
      data-testid="expandable-text"
      v-html="html"
    />
    <button
      v-if="isLong"
      type="button"
      class="mt-1 text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
      :aria-expanded="expanded"
      data-testid="expandable-toggle"
      @click="expanded = !expanded"
    >
      {{ expanded ? lessLabel : moreLabel }}
    </button>
  </div>
</template>
