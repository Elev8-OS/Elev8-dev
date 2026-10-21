<script setup lang="ts">
import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'
import type { Listing } from '~/components/listings/data/listings'
import { GUIDE_CONTENT_META, listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { listings } from '~/components/listings/data/listings'

/**
 * Import a kind of guest guide content from ONE other listing: pick the listing,
 * then add its items to the end or replace this listing's. Writes through the
 * parent (`import`), like the check-in/out steps, house rules and Good to Know
 * import in the dashboard. Pets are part of the house rules, so importing
 * house rules can bring the pet settings too (they replace this listing's).
 */
const props = defineProps<{ kind: GuideContentKind, listingId: string, currentCount: number }>()
const emit = defineEmits<{ import: [items: GuideContentItem[], mode: 'append' | 'replace', source: Listing, withPets: boolean] }>()
const open = defineModel<boolean>('open', { default: false })

const meta = computed(() => GUIDE_CONTENT_META[props.kind])

const search = ref('')
const sourceId = ref('')
const mode = ref<'append' | 'replace'>('append')
const withPets = ref(true)

watch(open, (isOpen) => {
  if (!isOpen)
    return
  search.value = ''
  sourceId.value = ''
  mode.value = props.currentCount ? 'append' : 'replace'
  withPets.value = true
}, { immediate: true })

const sources = computed(() => listings.value
  .filter(l => l.id !== props.listingId)
  .map(l => ({ id: l.id, name: l.name, count: listingGuideItems(l, props.kind).length }))
  .filter(l => l.count > 0 && l.name.toLowerCase().includes(search.value.trim().toLowerCase())))

const source = computed(() => listings.value.find(l => l.id === sourceId.value))
const sourceItems = computed(() => listingGuideItems(source.value, props.kind))

const MODES = [
  { value: 'append', label: 'Add to the end' },
  { value: 'replace', label: 'Replace mine' },
] as const

function apply() {
  if (!source.value)
    return
  emit('import', sourceItems.value, mode.value, source.value, props.kind === 'house_rules' && withPets.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Import {{ meta.label.toLowerCase() }} from a listing</DialogTitle>
        <DialogDescription>
          Pick one listing. Its {{ meta.label.toLowerCase() }} are copied here; the other listing keeps its own.
        </DialogDescription>
      </DialogHeader>

      <BaseSearchInput v-model="search" placeholder="Search listing..." />

      <ScrollArea class="h-64 rounded-md border">
        <div class="flex flex-col gap-1 p-2" role="radiogroup" :aria-label="`Listing to import ${meta.label.toLowerCase()} from`" data-testid="guide-import-sources">
          <div
            v-for="s in sources"
            :key="s.id"
            role="radio"
            tabindex="0"
            :aria-checked="sourceId === s.id"
            class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors"
            :class="sourceId === s.id ? 'border-foreground bg-muted/50' : 'hover:bg-muted/50'"
            @click="sourceId = s.id"
            @keydown.space.prevent="sourceId = s.id"
            @keydown.enter.prevent="sourceId = s.id"
          >
            <span class="flex size-4 shrink-0 items-center justify-center rounded-full border" :class="sourceId === s.id ? 'border-foreground' : 'border-input'">
              <span v-if="sourceId === s.id" class="size-2 rounded-full bg-foreground" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ s.name }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ s.count }} {{ s.count === 1 ? meta.noun : `${meta.noun}s` }}</span>
          </div>
          <p v-if="!sources.length" class="px-3 py-6 text-center text-sm text-muted-foreground">
            No other listing has {{ meta.label.toLowerCase() }} to import.
          </p>
        </div>
      </ScrollArea>

      <div v-if="source" class="flex flex-col gap-2">
        <div class="grid grid-cols-2 gap-2" role="group" aria-label="How to import">
          <button
            v-for="m in MODES"
            :key="m.value"
            type="button"
            class="rounded-md border px-3 py-2 text-sm transition-colors"
            :class="mode === m.value ? 'border-foreground bg-muted/50 font-semibold' : 'text-muted-foreground hover:text-foreground'"
            :aria-pressed="mode === m.value"
            :data-testid="`guide-import-mode-${m.value}`"
            @click="mode = m.value"
          >
            {{ m.label }}
          </button>
        </div>
        <p v-if="mode === 'replace' && currentCount" class="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          This replaces your {{ currentCount }} {{ currentCount === 1 ? meta.noun : `${meta.noun}s` }}.
        </p>
      </div>

      <div
        v-if="source && kind === 'house_rules'"
        role="checkbox"
        tabindex="0"
        :aria-checked="withPets"
        class="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/50"
        data-testid="guide-import-pets"
        @click="withPets = !withPets"
        @keydown.space.prevent="withPets = !withPets"
        @keydown.enter.prevent="withPets = !withPets"
      >
        <span class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border" :class="withPets ? 'border-foreground bg-foreground text-background' : 'border-input'">
          <Icon v-if="withPets" name="lucide:check" class="size-3" />
        </span>
        <span class="flex flex-col gap-0.5">
          <span class="text-sm font-medium">Also import the pet settings</span>
          <span class="text-xs text-muted-foreground">Pets allowed and the pet packages. These replace yours.</span>
        </span>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!source" data-testid="guide-import-apply" @click="apply">
          Import {{ sourceItems.length || '' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
