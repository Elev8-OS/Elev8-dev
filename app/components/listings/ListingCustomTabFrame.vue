<script setup lang="ts">
/**
 * A custom tab's page, shown in a frame with a small toolbar. A cross-origin
 * frame cannot tell us when the site refuses to be embedded (the browser shows
 * its own error page and still fires `load`), so `/api/frame-check` reads the
 * site's headers first and a refusing site gets a card with "Open in new tab"
 * instead of the frame. When the check cannot tell, the frame is shown, the
 * toolbar and footer keep "Open in new tab", and a page with no load event
 * after a few seconds gets the same pointer.
 */
import type { ListingCustomTab } from '~/components/listings/data/listing-custom-tabs'
import { customTabHost } from '~/components/listings/data/listing-custom-tabs'

const props = defineProps<{ tab: ListingCustomTab, canMoveLeft?: boolean, canMoveRight?: boolean }>()
const emit = defineEmits<{ edit: [], remove: [], move: [direction: -1 | 1] }>()

const reloadKey = ref(0)
const loading = ref(true)
const slow = ref(false)
let slowTimer: ReturnType<typeof setTimeout> | undefined
/** From `/api/frame-check`; null while checking or when the check could not tell. */
const embeddable = ref<boolean | null>(null)
const blocked = computed(() => embeddable.value === false)

function startLoading() {
  loading.value = true
  slow.value = false
  clearTimeout(slowTimer)
  slowTimer = setTimeout(() => {
    if (loading.value)
      slow.value = true
  }, 6000)
}

function onLoad() {
  loading.value = false
  slow.value = false
  clearTimeout(slowTimer)
}

function reload() {
  reloadKey.value++
  startLoading()
}

async function checkFrame(url: string) {
  embeddable.value = null
  try {
    const res = await $fetch<{ embeddable: boolean | null }>('/api/frame-check', { query: { url } })
    if (props.tab.url === url)
      embeddable.value = res.embeddable
  }
  catch {
    // Unknown: keep the frame.
  }
}

watch(() => props.tab.url, (url) => {
  startLoading()
  checkFrame(url)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(slowTimer))
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-xl border bg-card">
    <div class="flex items-center gap-2 border-b px-3 py-2">
      <Icon name="lucide:globe" class="size-4 shrink-0 text-muted-foreground" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">
          {{ tab.name }}
        </p>
        <p class="truncate text-xs text-muted-foreground" :title="tab.url">
          {{ customTabHost(tab.url) }}
        </p>
      </div>
      <Button variant="ghost" size="icon" class="size-8" aria-label="Reload" @click="reload">
        <Icon name="lucide:rotate-cw" class="size-4" />
      </Button>
      <Button variant="ghost" size="icon" class="size-8" as-child>
        <a :href="tab.url" target="_blank" rel="noopener noreferrer" aria-label="Open in new tab">
          <Icon name="lucide:external-link" class="size-4" />
        </a>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="size-8" aria-label="Tab options">
            <Icon name="lucide:ellipsis-vertical" class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="emit('edit')">
            <Icon name="lucide:pencil" class="size-4" />
            Edit tab
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="!canMoveLeft" @click="emit('move', -1)">
            <Icon name="lucide:arrow-left" class="size-4" />
            Move left
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="!canMoveRight" @click="emit('move', 1)">
            <Icon name="lucide:arrow-right" class="size-4" />
            Move right
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-destructive focus:text-destructive" @click="emit('remove')">
            <Icon name="lucide:trash-2" class="size-4" />
            Remove tab
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div class="relative h-[calc(100vh-18rem)] min-h-[480px] bg-muted/30">
      <div
        v-if="blocked"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
        data-testid="custom-tab-blocked"
      >
        <Icon name="lucide:frame" class="size-8 text-muted-foreground" />
        <div class="space-y-1">
          <p class="text-sm font-medium">
            {{ customTabHost(tab.url) }} can't be shown here
          </p>
          <p class="max-w-sm text-sm text-muted-foreground">
            This site does not allow being shown inside another page. Open it in a new browser tab instead.
          </p>
        </div>
        <Button size="sm" as-child>
          <a :href="tab.url" target="_blank" rel="noopener noreferrer">
            <Icon name="lucide:external-link" class="size-4" />
            Open in new tab
          </a>
        </Button>
      </div>
      <div
        v-else-if="loading"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <template v-if="!slow">
          <Icon name="lucide:loader-circle" class="size-6 animate-spin text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            Loading {{ customTabHost(tab.url) }}
          </p>
        </template>
        <template v-else>
          <Icon name="lucide:frame" class="size-8 text-muted-foreground" />
          <div class="space-y-1">
            <p class="text-sm font-medium">
              This page is taking a while
            </p>
            <p class="max-w-sm text-sm text-muted-foreground">
              {{ customTabHost(tab.url) }} may not allow being shown inside another page. You can open it in a new browser tab instead.
            </p>
          </div>
          <Button size="sm" as-child>
            <a :href="tab.url" target="_blank" rel="noopener noreferrer">
              <Icon name="lucide:external-link" class="size-4" />
              Open in new tab
            </a>
          </Button>
        </template>
      </div>
      <iframe
        v-if="!blocked"
        :key="`${tab.url}-${reloadKey}`"
        :src="tab.url"
        :title="tab.name"
        class="size-full border-0"
        :class="loading ? 'opacity-0' : 'opacity-100'"
        referrerpolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        allow="clipboard-write; fullscreen"
        @load="onLoad"
      />
    </div>
    <p v-if="!blocked" class="border-t px-3 py-1.5 text-xs text-muted-foreground">
      Page not showing? Some sites block being shown inside another page.
      <a :href="tab.url" target="_blank" rel="noopener noreferrer" class="font-medium text-foreground underline-offset-2 hover:underline">Open in new tab</a>
    </p>
  </div>
</template>
