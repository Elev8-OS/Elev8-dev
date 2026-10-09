<script setup lang="ts">
import type { SubstitutionGroup } from '~/components/revenue/data/revenue-settings'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { newId } from '~/components/revenue/data/revenue-policy'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { Input } from '~/components/ui/input'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

/**
 * Rooms that compete for the same guest (§22.3): derived from area and
 * bedrooms, adjustable. A recommendation that would put two rooms of one
 * group in the same narrow price band on the same nights gets a warning.
 */
const store = useRevenueSettings()
const moves = computed(() => store.settings.value.substitution.moves)
const hasAdjustments = computed(() => Object.keys(moves.value).length > 0 || Object.keys(store.settings.value.substitution.names).length > 0)

const roomsByKey = computed(() => new Map(store.rooms.value.map(r => [r.key, r])))

/** Rooms the tenant took out of every group. */
const removed = computed(() => Object.entries(moves.value).filter(([, target]) => target === 'none').map(([key]) => roomsByKey.value.get(key)).filter(r => !!r))

const renaming = ref<string | null>(null)
const nameDraft = ref('')

function startRename(group: SubstitutionGroup) {
  renaming.value = group.key
  nameDraft.value = group.name
}

function saveRename(group: SubstitutionGroup) {
  if (nameDraft.value.trim())
    store.renameGroup(group.key, nameDraft.value.trim())
  renaming.value = null
}

function moveTo(roomKey: string, groupKey: string | null, label: string) {
  store.moveRoom(roomKey, groupKey)
  toast.success(label)
}

function newGroup(roomKey: string) {
  const key = newId('group')
  store.renameGroup(key, `${roomsByKey.value.get(roomKey)?.location ?? 'New'} group`)
  moveTo(roomKey, key, 'Moved to a new group. Move a second room in to make it compete.')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card class="gap-2 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">
            Substitution groups
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Rooms in one group compete for the same guest. Elev8 groups them by area and bedrooms; move a room when that is wrong.
          </p>
        </div>
        <Button v-if="hasAdjustments" size="sm" variant="ghost" class="gap-1.5" @click="store.resetGroups()">
          <Icon name="lucide:rotate-ccw" class="size-3.5" />
          Back to derived
        </Button>
      </div>
    </Card>

    <div class="grid gap-4 md:grid-cols-2">
      <Card v-for="group in store.groups.value" :key="group.key" class="gap-3 p-4" :data-testid="`group-${group.key}`">
        <div class="flex items-center gap-2">
          <template v-if="renaming === group.key">
            <Input v-model="nameDraft" class="h-8" aria-label="Group name" @keydown.enter="saveRename(group)" />
            <Button size="sm" class="h-8" @click="saveRename(group)">
              Save
            </Button>
          </template>
          <template v-else>
            <h4 class="min-w-0 flex-1 truncate text-sm font-medium">
              {{ group.name }}
            </h4>
            <Badge :variant="group.adjusted ? 'outline' : 'secondary'" class="text-[11px] font-normal">
              {{ group.adjusted ? 'Adjusted' : 'Derived' }}
            </Badge>
            <Button size="icon" variant="ghost" class="size-7" :aria-label="`Rename ${group.name}`" @click="startRename(group)">
              <Icon name="lucide:pencil" class="size-3.5" />
            </Button>
          </template>
        </div>
        <ul class="flex flex-col gap-1">
          <li v-for="key in group.roomKeys" :key="key" class="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
            <span class="min-w-0 flex-1 truncate text-sm">{{ roomsByKey.get(key)?.name }}</span>
            <Badge v-if="moves[key]" variant="outline" class="text-[10px] font-normal">
              Moved
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button size="icon" variant="ghost" class="size-7" :aria-label="`Move ${roomsByKey.get(key)?.name}`">
                  <Icon name="lucide:ellipsis" class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-64">
                <DropdownMenuLabel class="text-xs text-muted-foreground">
                  Move to
                </DropdownMenuLabel>
                <DropdownMenuItem
                  v-for="other in store.groups.value.filter(g => g.key !== group.key)"
                  :key="other.key"
                  @click="moveTo(key, other.key, `Moved to ${other.name}`)"
                >
                  {{ other.name }}
                </DropdownMenuItem>
                <DropdownMenuItem @click="newGroup(key)">
                  <Icon name="lucide:plus" class="size-3.5" />
                  New group
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem v-if="moves[key]" @click="moveTo(key, null, 'Put back in its derived group')">
                  <Icon name="lucide:rotate-ccw" class="size-3.5" />
                  Put back where Elev8 placed it
                </DropdownMenuItem>
                <DropdownMenuItem @click="moveTo(key, 'none', 'Taken out of every group')">
                  <Icon name="lucide:circle-minus" class="size-3.5" />
                  Competes with nobody
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ul>
      </Card>
    </div>

    <Card v-if="removed.length" class="gap-2 p-4">
      <h4 class="text-sm font-medium">
        Out of every group
      </h4>
      <ul class="flex flex-col gap-1">
        <li v-for="room in removed" :key="room.key" class="flex items-center gap-2 px-2 py-1">
          <span class="min-w-0 flex-1 truncate text-sm">{{ room.name }}</span>
          <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="moveTo(room.key, null, 'Put back in its derived group')">
            Put back
          </Button>
        </li>
      </ul>
    </Card>
  </div>
</template>
