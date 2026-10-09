<script setup lang="ts">
import type { RevenueRoom } from '~/components/revenue/data/revenue-policy'
import { computed, ref, watch } from 'vue'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { ScrollArea } from '~/components/ui/scroll-area'

/** Pick the rooms whose seasons are replaced by this room's. */
const props = defineProps<{ rooms: RevenueRoom[], seasonCount: number }>()
const emit = defineEmits<{ copy: [roomKeys: string[]] }>()
const open = defineModel<boolean>('open', { default: false })

const search = ref('')
const selected = ref<string[]>([])

watch(open, (value) => {
  if (value) {
    search.value = ''
    selected.value = []
  }
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? props.rooms.filter(r => `${r.name} ${r.location}`.toLowerCase().includes(q)) : props.rooms
})

const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(r => selected.value.includes(r.key)))

function toggle(key: string) {
  selected.value = selected.value.includes(key) ? selected.value.filter(k => k !== key) : [...selected.value, key]
}

function toggleAll() {
  const keys = filtered.value.map(r => r.key)
  selected.value = allSelected.value
    ? selected.value.filter(k => !keys.includes(k))
    : [...new Set([...selected.value, ...keys])]
}

function confirm() {
  emit('copy', selected.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Copy seasons to other rooms</DialogTitle>
        <DialogDescription>
          The {{ seasonCount }} season{{ seasonCount === 1 ? '' : 's' }} saved on this room replace the seasons of the rooms you pick. Each gets a new version straight away.
        </DialogDescription>
      </DialogHeader>

      <Input v-model="search" placeholder="Search rooms" class="h-9" />
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{{ selected.length }} selected</span>
        <button type="button" class="font-medium text-foreground hover:underline" @click="toggleAll">
          {{ allSelected ? 'Clear all' : 'Select all' }}
        </button>
      </div>
      <ScrollArea class="h-64 rounded-md border">
        <div class="flex flex-col p-1">
          <div
            v-for="room in filtered"
            :key="room.key"
            class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted"
            :data-testid="`copy-room-${room.key}`"
            @click="toggle(room.key)"
          >
            <div
              class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
              :class="selected.includes(room.key) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
            >
              <Icon v-if="selected.includes(room.key)" name="lucide:check" class="size-3" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm">
                {{ room.name }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ room.location }}
              </p>
            </div>
          </div>
          <p v-if="filtered.length === 0" class="p-4 text-center text-sm text-muted-foreground">
            No rooms match.
          </p>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="selected.length === 0" @click="confirm">
          Copy to {{ selected.length }} room{{ selected.length === 1 ? '' : 's' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
