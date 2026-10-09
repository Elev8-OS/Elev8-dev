<script setup lang="ts">
import type { ChannelMarkup } from '~/components/revenue/data/revenue-settings'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { newId } from '~/components/revenue/data/revenue-policy'
import RevenueNumberField from '~/components/revenue/policy/RevenueNumberField.vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

/**
 * A percentage on top of the resolved price per channel (§12 step 8), for
 * commission offsets and channel positioning. A room can carry its own,
 * which replaces the channel one for that room.
 */
const store = useRevenueSettings()
const markups = computed(() => store.settings.value.markups)

/** One row per channel; a channel nobody set up yet shows as off at 0%. */
const channelRows = computed(() => store.channels.value.map(channel => ({
  channel,
  markup: markups.value.find(m => m.channel === channel && m.roomKey === null) ?? null,
})))

const roomMarkups = computed(() => markups.value.filter(m => m.roomKey !== null))

function setChannel(channel: string, existing: ChannelMarkup | null, patch: Partial<ChannelMarkup>) {
  store.saveMarkup({ ...(existing ?? { id: newId('mk'), channel, roomKey: null, adjustPct: 0, active: false }), ...patch })
}

function roomName(key: string | null) {
  return store.rooms.value.find(r => r.key === key)?.name ?? 'Removed room'
}

function example(pct: number) {
  return Math.round(100 * (1 + pct / 100) * 100) / 100
}

// ── Room markup dialog ───────────────────────────────────────────────
const dialogOpen = ref(false)
const form = ref({ roomKey: '', channel: '', adjustPct: 0 as number | null })

function openRoomMarkup() {
  form.value = { roomKey: '', channel: store.channels.value[0] ?? '', adjustPct: 0 }
  dialogOpen.value = true
}

function saveRoomMarkup() {
  if (!form.value.roomKey || !form.value.channel)
    return
  const existing = markups.value.find(m => m.roomKey === form.value.roomKey && m.channel === form.value.channel)
  store.saveMarkup({ id: existing?.id ?? newId('mk'), channel: form.value.channel, roomKey: form.value.roomKey, adjustPct: form.value.adjustPct ?? 0, active: true })
  dialogOpen.value = false
  toast.success('Room markup saved')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card class="gap-4 p-5" data-testid="channel-markups">
      <div>
        <h3 class="text-sm font-semibold">
          Channel markups
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Added after the minimum and maximum price, before rounding. Use it to offset a channel's commission.
        </p>
      </div>
      <ul class="divide-y rounded-md border">
        <li v-for="row in channelRows" :key="row.channel" class="flex flex-wrap items-center gap-3 px-3 py-2.5" :data-testid="`markup-${row.channel}`">
          <Switch
            :model-value="row.markup?.active ?? false"
            :aria-label="`${row.channel} markup`"
            @update:model-value="setChannel(row.channel, row.markup, { active: $event })"
          />
          <span class="min-w-0 flex-1 text-sm">{{ row.channel }}</span>
          <span v-if="row.markup?.active" class="text-xs text-muted-foreground tabular-nums">100 becomes {{ example(row.markup.adjustPct) }}</span>
          <RevenueNumberField
            :model-value="row.markup?.adjustPct ?? 0"
            suffix="%"
            :min="-50"
            :max="100"
            :aria-label="`${row.channel} markup percent`"
            class="w-24"
            @update:model-value="setChannel(row.channel, row.markup, { adjustPct: $event ?? 0, active: true })"
          />
        </li>
      </ul>
      <p class="text-xs text-muted-foreground">
        A channel manager that cannot take a separate rate per channel ignores these, and the rooms get one price everywhere.
      </p>
    </Card>

    <Card class="gap-4 p-5" data-testid="room-markups">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">
            Room exceptions
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            A room's own markup on a channel replaces the channel markup for that room.
          </p>
        </div>
        <Button size="sm" variant="outline" class="gap-1.5" @click="openRoomMarkup">
          <Icon name="lucide:plus" class="size-3.5" />
          Add exception
        </Button>
      </div>
      <ul v-if="roomMarkups.length" class="divide-y rounded-md border">
        <li v-for="m in roomMarkups" :key="m.id" class="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <Switch :model-value="m.active" :aria-label="`${roomName(m.roomKey)} on ${m.channel}`" @update:model-value="store.saveMarkup({ ...m, active: $event })" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">
              {{ roomName(m.roomKey) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ m.channel }}
            </p>
          </div>
          <RevenueNumberField :model-value="m.adjustPct" suffix="%" :aria-label="`${roomName(m.roomKey)} markup percent`" class="w-24" @update:model-value="store.saveMarkup({ ...m, adjustPct: $event ?? 0 })" />
          <Button size="icon" variant="ghost" class="size-8" :aria-label="`Remove ${roomName(m.roomKey)} exception`" @click="store.removeMarkup(m.id)">
            <Icon name="lucide:trash-2" class="size-3.5" />
          </Button>
        </li>
      </ul>
      <p v-else class="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        Every room follows its channel markup.
      </p>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add room exception</DialogTitle>
          <DialogDescription>Give one room its own markup on one channel.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label>Room</Label>
            <Select v-model="form.roomKey">
              <SelectTrigger class="w-full" aria-label="Room">
                <SelectValue placeholder="Pick a room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="room in store.rooms.value" :key="room.key" :value="room.key">
                  {{ room.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Channel</Label>
              <Select v-model="form.channel">
                <SelectTrigger class="w-full" aria-label="Channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="channel in store.channels.value" :key="channel" :value="channel">
                    {{ channel }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Markup</Label>
              <RevenueNumberField v-model="form.adjustPct" suffix="%" aria-label="Markup percent" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">
            Cancel
          </Button>
          <Button :disabled="!form.roomKey || !form.channel" @click="saveRoomMarkup">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
