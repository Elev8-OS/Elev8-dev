<script setup lang="ts">
import type { ActivityAuditEntry } from '~/components/activities/data/activities'
import { parseLocalDateKey } from '~/components/activities/data/activities'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'

defineProps<{ entries: ActivityAuditEntry[], name: string }>()
const open = defineModel<boolean>('open', { default: false })

const ICONS = { added: 'lucide:plus', edited: 'lucide:pencil', deleted: 'lucide:trash-2' } as const
const VERBS = { added: 'added', edited: 'edited', deleted: 'deleted' } as const
const stamp = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Change history</SheetTitle>
        <SheetDescription>Time changes made by managers to {{ name }}'s logs.</SheetDescription>
      </SheetHeader>
      <div class="px-4 pb-4">
        <p v-if="!entries.length" class="py-10 text-center text-sm text-muted-foreground">
          No changes yet. Edits, deletions and added time show up here.
        </p>
        <ol v-else class="space-y-4">
          <li v-for="e in entries" :key="e.id" class="flex gap-3">
            <div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon :name="ICONS[e.action]" class="size-3.5" />
            </div>
            <div class="min-w-0 text-sm">
              <p>
                <span class="font-medium">{{ e.by }}</span> {{ VERBS[e.action] }}
                <span class="font-medium">{{ e.title }}</span>
              </p>
              <p class="text-muted-foreground">
                {{ e.listingName }}, {{ dayFmt.format(parseLocalDateKey(e.date)) }}
              </p>
              <p>{{ e.detail }}</p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ stamp.format(new Date(e.at)) }}
              </p>
            </div>
          </li>
        </ol>
      </div>
    </SheetContent>
  </Sheet>
</template>
