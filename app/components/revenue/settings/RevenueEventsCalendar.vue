<script setup lang="ts">
import type { CalendarEvent, CalendarEventKind, DemandImpact, ReviewCadence } from '~/components/revenue/data/revenue-settings'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { staffMembers } from '~/components/inbox/data/conversations'
import { allLocations } from '~/components/listings/data/listings'
import { isoDate, newId, parseIsoDate } from '~/components/revenue/data/revenue-policy'
import { cadenceLabels, eventKindLabels, impactLabels, nextReviewDue } from '~/components/revenue/data/revenue-settings'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

/**
 * The events and season calendar the engine reads as the Calendar signal.
 * Elev8 curates a shared list; a tenant can hide a curated row and add its
 * own. It needs an owner and a review rhythm, not just a table (§19).
 */
const store = useRevenueSettings()
const settings = computed(() => store.settings.value)

const ALL_AREAS = '__all__'
const showHidden = ref(false)

const today = isoDate(new Date())
const events = computed(() => settings.value.events
  .filter(e => (showHidden.value || !e.hidden) && e.to >= today)
  .sort((a, b) => a.from.localeCompare(b.from)))
const hiddenCount = computed(() => settings.value.events.filter(e => e.hidden).length)

const review = computed(() => settings.value.review)
const due = computed(() => nextReviewDue(review.value, today))
const overdue = computed(() => due.value <= today)
const owner = computed(() => staffMembers.find(s => s.id === review.value.ownerId) ?? null)

function fmt(value: string) {
  return parseIsoDate(value.slice(0, 10)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function range(e: CalendarEvent) {
  return e.from === e.to ? fmt(e.from) : `${fmt(e.from)} to ${fmt(e.to)}`
}

const impactClass: Record<DemandImpact, string> = {
  high: 'border-primary/40 text-primary',
  medium: '',
  low: 'text-muted-foreground',
}

function markReviewed() {
  store.markReviewed()
  toast.success('Calendar marked as reviewed')
}

// ── Event dialog ─────────────────────────────────────────────────────
const dialogOpen = ref(false)
const isNew = ref(true)
const form = ref<CalendarEvent>(blankEvent())

function blankEvent(): CalendarEvent {
  return { id: newId('ev'), name: '', kind: 'event', from: '', to: '', impact: 'medium', area: null, source: 'tenant', hidden: false }
}

const formIssue = computed(() => {
  if (!form.value.name.trim())
    return 'Give it a name.'
  if (!form.value.from || !form.value.to)
    return 'Pick both dates.'
  if (form.value.from > form.value.to)
    return 'The end date is before the start date.'
  return null
})

function open(event?: CalendarEvent) {
  isNew.value = !event
  form.value = event ? { ...event } : blankEvent()
  dialogOpen.value = true
}

function save() {
  if (formIssue.value)
    return
  store.saveEvent({ ...form.value, name: form.value.name.trim() })
  dialogOpen.value = false
  toast.success(isNew.value ? 'Event added' : 'Event updated')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Ownership and review -->
    <Card class="gap-4 p-5" data-testid="calendar-review">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">
            Calendar review
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Someone owns the calendar and checks it on a rhythm, so a festival that moved does not keep pricing the wrong week.
          </p>
        </div>
        <Badge v-if="overdue" variant="destructive" class="text-[11px]">
          Review due
        </Badge>
        <Badge v-else variant="outline" class="text-[11px] font-normal">
          Next review {{ fmt(due) }}
        </Badge>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <Label>Owner</Label>
          <Select :model-value="review.ownerId ?? undefined" @update:model-value="store.patchReview({ ownerId: String($event) })">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Pick a person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="person in staffMembers" :key="person.id" :value="person.id">
                {{ person.name }} · {{ person.role }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Review every</Label>
          <Select :model-value="review.cadence" @update:model-value="store.patchReview({ cadence: $event as ReviewCadence })">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="(label, value) in cadenceLabels" :key="value" :value="value">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Last reviewed</Label>
          <div class="flex items-center gap-2">
            <span class="flex-1 text-sm">{{ review.lastReviewedAt ? fmt(review.lastReviewedAt) : 'Never' }}</span>
            <Button size="sm" variant="outline" @click="markReviewed">
              Mark reviewed
            </Button>
          </div>
        </div>
      </div>
      <p v-if="!owner" class="text-xs text-destructive">
        Nobody owns the calendar yet.
      </p>
    </Card>

    <!-- Events -->
    <Card class="gap-4 p-5" data-testid="calendar-events">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">
            Events and seasons
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Upcoming dates that move demand. Curated by Elev8 for every tenant; add your own on top.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="hiddenCount" class="flex items-center gap-2 text-xs text-muted-foreground">
            Show hidden ({{ hiddenCount }})
            <Switch v-model="showHidden" aria-label="Show hidden events" />
          </div>
          <Button size="sm" variant="outline" class="gap-1.5" @click="open()">
            <Icon name="lucide:plus" class="size-3.5" />
            Add event
          </Button>
        </div>
      </div>

      <ul class="divide-y rounded-md border">
        <li v-for="e in events" :key="e.id" class="flex flex-wrap items-center gap-3 px-3 py-2.5" :class="e.hidden ? 'opacity-60' : ''" :data-testid="`event-${e.id}`">
          <Icon :name="e.kind === 'season' ? 'lucide:sun' : e.kind === 'holiday' ? 'lucide:flag' : 'lucide:ticket'" class="size-4 text-muted-foreground" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">
              {{ e.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ range(e) }} · {{ e.area ?? 'All areas' }}
            </p>
          </div>
          <Badge variant="outline" class="text-[11px] font-normal" :class="impactClass[e.impact]">
            {{ impactLabels[e.impact] }}
          </Badge>
          <Badge :variant="e.source === 'elev8' ? 'secondary' : 'outline'" class="text-[11px] font-normal">
            {{ e.source === 'elev8' ? 'Elev8' : 'Yours' }}
          </Badge>
          <template v-if="e.source === 'elev8'">
            <Button size="sm" variant="ghost" class="h-8 px-2 text-xs" @click="store.setEventHidden(e.id, !e.hidden)">
              {{ e.hidden ? 'Use' : 'Hide' }}
            </Button>
          </template>
          <template v-else>
            <Button size="icon" variant="ghost" class="size-8" :aria-label="`Edit ${e.name}`" @click="open(e)">
              <Icon name="lucide:pencil" class="size-3.5" />
            </Button>
            <Button size="icon" variant="ghost" class="size-8" :aria-label="`Remove ${e.name}`" @click="store.removeEvent(e.id)">
              <Icon name="lucide:trash-2" class="size-3.5" />
            </Button>
          </template>
        </li>
        <li v-if="events.length === 0" class="p-4 text-center text-xs text-muted-foreground">
          No upcoming events.
        </li>
      </ul>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ isNew ? 'Add event' : 'Edit event' }}</DialogTitle>
          <DialogDescription>Dates the engine should treat as stronger or weaker demand.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label for="ev-name">Name</Label>
            <Input id="ev-name" v-model="form.name" placeholder="e.g. Bali Spirit Festival" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label for="ev-from">From</Label>
              <Input id="ev-from" v-model="form.from" type="date" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="ev-to">To</Label>
              <Input id="ev-to" v-model="form.to" type="date" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select :model-value="form.kind" @update:model-value="form = { ...form, kind: $event as CalendarEventKind }">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="(label, value) in eventKindLabels" :key="value" :value="value">
                    {{ label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Demand</Label>
              <Select :model-value="form.impact" @update:model-value="form = { ...form, impact: $event as DemandImpact }">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="(label, value) in impactLabels" :key="value" :value="value">
                    {{ label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Area</Label>
            <Select :model-value="form.area ?? ALL_AREAS" @update:model-value="form = { ...form, area: $event === ALL_AREAS ? null : String($event) }">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="ALL_AREAS">
                  All areas
                </SelectItem>
                <SelectItem v-for="area in allLocations" :key="area" :value="area">
                  {{ area }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-if="formIssue && form.name" class="text-xs text-destructive">
            {{ formIssue }}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">
            Cancel
          </Button>
          <Button :disabled="!!formIssue" @click="save">
            {{ isNew ? 'Add event' : 'Save' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
