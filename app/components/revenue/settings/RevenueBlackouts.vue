<script setup lang="ts">
import type { Blackout } from '~/components/revenue/data/revenue-settings'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { allTags } from '~/components/listings/data/listings'
import { newId, parseIsoDate } from '~/components/revenue/data/revenue-policy'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useRevenueSettings } from '~/composables/useRevenueSettings'

/** Dates the engine never auto-applies on (§23.3). Findings still show. */
const store = useRevenueSettings()
const blackouts = computed(() => store.settings.value.blackouts)

const dialogOpen = ref(false)
const form = ref<Blackout>({ id: '', label: '', from: '', to: '', tags: [] })
const isNew = ref(true)

const formIssue = computed(() => {
  if (!form.value.label.trim())
    return 'Give it a name.'
  if (!form.value.from || !form.value.to)
    return 'Pick both dates.'
  if (form.value.from > form.value.to)
    return 'The end date is before the start date.'
  return null
})

function open(blackout?: Blackout) {
  isNew.value = !blackout
  form.value = blackout ? { ...blackout, tags: [...blackout.tags] } : { id: newId('bo'), label: '', from: '', to: '', tags: [] }
  dialogOpen.value = true
}

function toggleTag(tag: string) {
  const tags = form.value.tags
  form.value = { ...form.value, tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] }
}

function save() {
  if (formIssue.value)
    return
  store.saveBlackout({ ...form.value, label: form.value.label.trim() })
  dialogOpen.value = false
  toast.success(isNew.value ? 'Blackout added' : 'Blackout updated')
}

function range(b: Pick<Blackout, 'from' | 'to'>) {
  const fmt = (v: string) => parseIsoDate(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return b.from === b.to ? fmt(b.from) : `${fmt(b.from)} to ${fmt(b.to)}`
}
</script>

<template>
  <Card class="gap-4 p-5" data-testid="blackouts">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold">
          Blackout dates
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          The engine never changes prices on its own on these dates. Recommendations still show; a person decides.
        </p>
      </div>
      <Button size="sm" variant="outline" class="gap-1.5" @click="open()">
        <Icon name="lucide:plus" class="size-3.5" />
        Add blackout
      </Button>
    </div>

    <ul v-if="blackouts.length" class="divide-y rounded-md border">
      <li v-for="b in blackouts" :key="b.id" class="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <Icon name="lucide:calendar-off" class="size-4 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm">
            {{ b.label }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ range(b) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-1">
          <Badge v-if="b.tags.length === 0" variant="secondary" class="text-[11px] font-normal">
            All rooms
          </Badge>
          <Badge v-for="tag in b.tags" :key="tag" variant="outline" class="text-[11px] font-normal">
            {{ tag }}
          </Badge>
        </div>
        <Button size="icon" variant="ghost" class="size-8" :aria-label="`Edit ${b.label}`" @click="open(b)">
          <Icon name="lucide:pencil" class="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" class="size-8" :aria-label="`Remove ${b.label}`" @click="store.removeBlackout(b.id)">
          <Icon name="lucide:trash-2" class="size-3.5" />
        </Button>
      </li>
    </ul>
    <p v-else class="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
      No blackout dates.
    </p>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ isNew ? 'Add blackout' : 'Edit blackout' }}</DialogTitle>
          <DialogDescription>Pick the dates, and the tags it covers. No tag means every room.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <Label for="bo-label">Name</Label>
            <Input id="bo-label" v-model="form.label" placeholder="e.g. Christmas and New Year" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label for="bo-from">From</Label>
              <Input id="bo-from" v-model="form.from" type="date" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="bo-to">To</Label>
              <Input id="bo-to" v-model="form.to" type="date" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Tags</Label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="tag in allTags"
                :key="tag"
                type="button"
                class="rounded-full border px-2.5 py-0.5 text-xs transition-colors"
                :class="form.tags.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
                :aria-pressed="form.tags.includes(tag)"
                @click="toggleTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>
          <p v-if="formIssue && form.label" class="text-xs text-destructive">
            {{ formIssue }}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">
            Cancel
          </Button>
          <Button :disabled="!!formIssue" @click="save">
            {{ isNew ? 'Add blackout' : 'Save' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>
</template>
