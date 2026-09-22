<!-- app/components/guest-guides/links/LinkDetailDrawer.vue -->
<script setup lang="ts">
import type { GuestGuideLink, GuideSubmission } from '../data/types'
import { Button } from '~/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '~/components/ui/sheet'
import { Badge } from '~/components/ui/badge'

const props = defineProps<{
  open: boolean
  link: GuestGuideLink | null
  submission: GuideSubmission | null
}>()

defineEmits<{ 'update:open': [v: boolean] }>()

function formatDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false }) : '—'
}

function maskIdNumber(num?: string): string {
  if (!num || num.length < 4) return num ?? '—'
  return `****${num.slice(-4)}`
}
</script>

<template>
  <Sheet :open="open" @update:open="$emit('update:open', $event)">
    <SheetContent class="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader v-if="link">
        <SheetTitle>{{ link.guestName }}</SheetTitle>
        <SheetDescription>
          <Badge>{{ link.status }}</Badge>
          <span class="ml-2 text-xs">{{ formatDate(link.sentAt) }}</span>
        </SheetDescription>
      </SheetHeader>

      <div v-if="link" class="mt-6 space-y-6">
        <div>
          <h3 class="mb-2 text-sm font-medium text-muted-foreground">Link</h3>
          <div class="rounded-md bg-muted p-2 font-mono text-xs break-all">
            https://guide.elev8-suite.com/{{ link.token }}
          </div>
        </div>

        <div v-if="submission" class="space-y-4">
          <h3 class="text-sm font-medium text-muted-foreground">Submitted data</h3>
          <dl class="space-y-2 text-sm">
            <div v-if="submission.arrivalTime">
              <dt class="text-muted-foreground">Arrival time</dt>
              <dd>{{ formatDate(submission.arrivalTime) }}</dd>
            </div>
            <div v-if="submission.guests != null">
              <dt class="text-muted-foreground">Guests</dt>
              <dd>{{ submission.guests }}</dd>
            </div>
            <div v-if="submission.mobile">
              <dt class="text-muted-foreground">Mobile</dt>
              <dd>{{ submission.mobile }}</dd>
            </div>
            <div v-if="submission.idType">
              <dt class="text-muted-foreground">ID type</dt>
              <dd>{{ submission.idType }}</dd>
            </div>
            <div v-if="submission.idNumber">
              <dt class="text-muted-foreground">ID number</dt>
              <dd class="font-mono">{{ maskIdNumber(submission.idNumber) }}</dd>
            </div>
            <div v-if="submission.requests">
              <dt class="text-muted-foreground">Requests</dt>
              <dd>{{ submission.requests }}</dd>
            </div>
            <div v-if="submission.upsellsAdded && submission.upsellsAdded.length > 0">
              <dt class="text-muted-foreground">Upsells added</dt>
              <dd>
                <ul class="list-disc pl-4">
                  <li v-for="u in submission.upsellsAdded" :key="u.serviceId">
                    Service {{ u.serviceId }} × {{ u.qty }}
                  </li>
                </ul>
              </dd>
            </div>
            <div v-if="submission.smartLockViewedAt">
              <dt class="text-muted-foreground">Smart lock viewed</dt>
              <dd>{{ formatDate(submission.smartLockViewedAt) }}</dd>
            </div>
          </dl>
        </div>
        <div v-else class="text-sm text-muted-foreground">
          No submission yet.
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
