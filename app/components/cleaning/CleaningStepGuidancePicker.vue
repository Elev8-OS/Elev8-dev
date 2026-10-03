<script setup lang="ts">
import { useCleaningGuidance } from '~/composables/useCleaningGuidance'

defineProps<{ stepLabel?: string }>()
/** Attach guidance to one cleaning step: a popover of the library with search and checkboxes. */
const ids = defineModel<string[]>({ default: () => [] })
const { sortedGuidance } = useCleaningGuidance()
const search = ref('')

const options = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sortedGuidance.value.filter(g => !q || g.title.toLowerCase().includes(q))
})

function toggle(id: string) {
  ids.value = ids.value.includes(id) ? ids.value.filter(x => x !== id) : [...ids.value, id]
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="relative size-7"
        :class="ids.length ? 'text-primary' : 'text-muted-foreground'"
        :aria-label="ids.length ? `${ids.length} guidance attached${stepLabel ? ` to ${stepLabel}` : ''}` : 'Attach guidance'"
        data-testid="step-guidance-trigger"
      >
        <Icon name="lucide:book-open" class="size-3.5" />
        <span
          v-if="ids.length"
          class="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground"
        >{{ ids.length }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-72 p-0">
      <div class="border-b px-3 py-2 text-xs font-semibold">
        Attach guidance
      </div>
      <div class="border-b p-2">
        <Input v-model="search" placeholder="Search guidance..." class="h-8 text-xs" />
      </div>
      <div class="max-h-60 overflow-y-auto p-1">
        <div
          v-for="g in options"
          :key="g.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
          data-testid="step-guidance-option"
          @click="toggle(g.id)"
        >
          <div
            class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
            :class="ids.includes(g.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
          >
            <Icon v-if="ids.includes(g.id)" name="lucide:check" class="size-3" />
          </div>
          <span class="min-w-0 flex-1 truncate text-xs">{{ g.title }}</span>
          <span v-if="g.videos.length" class="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
            <Icon name="lucide:video" class="size-3" />
            {{ g.videos.length }}
          </span>
        </div>
        <p v-if="!options.length" class="py-4 text-center text-xs text-muted-foreground">
          No guidance found.
        </p>
      </div>
      <div class="border-t p-1">
        <Button variant="ghost" size="sm" class="h-8 w-full justify-start gap-2 text-xs" as-child>
          <NuxtLink to="/settings/guidance">
            <Icon name="lucide:settings-2" class="size-3.5" />
            Manage guidance
          </NuxtLink>
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
