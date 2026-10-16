<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { pageWindow } from '~/lib/activity-stats'

/** Footer for a paged list: range text, page size, numbered pages. Hidden while everything fits the smallest page size. */
const props = withDefaults(defineProps<{
  total: number
  sizes?: number[]
  /** What is being counted, plural: "results", "days". */
  unit?: string
}>(), { sizes: () => [10, 25, 50], unit: 'results' })

const page = defineModel<number>('page', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / pageSize.value)))
const from = computed(() => props.total ? (page.value - 1) * pageSize.value + 1 : 0)
const to = computed(() => Math.min(page.value * pageSize.value, props.total))
const pages = computed(() => pageWindow(page.value, pageCount.value))

// A smaller page size or a shorter list can leave the page past the end.
watch([pageCount], () => {
  if (page.value > pageCount.value)
    page.value = pageCount.value
})

function setSize(v: string) {
  pageSize.value = Number(v)
  page.value = 1
}
</script>

<template>
  <div v-if="total > Math.min(...sizes)" class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
    <div class="flex items-center gap-3 text-muted-foreground">
      <span>Showing {{ from }} to {{ to }} of {{ total }} {{ unit }}</span>
      <Select :model-value="String(pageSize)" @update:model-value="setSize(String($event))">
        <SelectTrigger class="h-8 w-28" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in sizes" :key="s" :value="String(s)">
            {{ s }} per page
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
    <nav v-if="pageCount > 1" class="flex items-center gap-1" aria-label="Pagination">
      <Button variant="outline" size="icon" class="size-8" aria-label="Previous page" :disabled="page <= 1" @click="page -= 1">
        <Icon name="lucide:chevron-left" class="size-4" />
      </Button>
      <template v-for="(p, i) in pages" :key="i">
        <span v-if="p === null" class="px-1 text-muted-foreground">…</span>
        <Button
          v-else
          :variant="p === page ? 'default' : 'ghost'"
          size="icon"
          class="size-8 tabular-nums"
          :aria-label="`Page ${p}`"
          :aria-current="p === page ? 'page' : undefined"
          @click="page = p"
        >
          {{ p }}
        </Button>
      </template>
      <Button variant="outline" size="icon" class="size-8" aria-label="Next page" :disabled="page >= pageCount" @click="page += 1">
        <Icon name="lucide:chevron-right" class="size-4" />
      </Button>
    </nav>
  </div>
</template>
