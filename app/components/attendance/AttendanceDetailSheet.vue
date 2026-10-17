<script setup lang="ts">
import type { AttendanceRow } from '~/composables/useAttendanceReport'
import { parseLocalDateKey } from '~/components/activities/data/activities'
import { attendancePhotoUrl, formatWorked, workedMinutes } from '~/components/attendance/data/attendance'
import BasePersonAvatar from '~/components/base/PersonAvatar.vue'
import ImageViewer from '~/components/inbox/ImageViewer.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { useImageViewer } from '~/composables/useImageViewer'
import { useSchedule } from '~/composables/useSchedule'
import { useUsers } from '~/composables/useUsers'
import { scheduleLabelLong, shiftLabel } from '~/lib/schedule'

const props = defineProps<{ row: AttendanceRow | null }>()
const open = defineModel<boolean>('open', { default: false })

const { getUser } = useUsers()
const { scheduleFor } = useSchedule()

const user = computed(() => props.row ? getUser(props.row.userId) : undefined)
const planned = computed(() => props.row ? scheduleFor(props.row.userId, props.row.date) : undefined)
/** This record's own shift: the second record of a split-shift day reads its second shift. */
const scheduled = computed(() => {
  const day = planned.value
  if (!day)
    return ''
  if (!day.working)
    return scheduleLabelLong(day)
  const part = day.segments[(props.row?.segment ?? 1) - 1] ?? day.shift
  const label = shiftLabel(part)
  const named = part.name ? `${part.name}, ${label}` : label
  return day.segments.length > 1 ? `Shift ${props.row?.segment ?? 1} of ${day.segments.length}: ${named}` : named
})
const worked = computed(() => props.row ? workedMinutes(props.row) : undefined)
const dayLabel = computed(() => props.row
  ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseLocalDateKey(props.row.date))
  : '')
const whatsapp = computed(() => user.value?.phone ? `https://wa.me/${user.value.phone.replace(/\D/g, '')}` : undefined)
/** Its own viewer, so a photo opened here never pops the inbox's. */
const VIEWER_SCOPE = 'attendance'
const viewer = useImageViewer(VIEWER_SCOPE)

function viewPhoto(kind: 'in' | 'out') {
  const r = props.row
  if (!r)
    return
  const time = kind === 'in' ? r.clockIn : r.clockOut
  if (!time)
    return
  viewer.openImage({
    url: (kind === 'in' ? r.clockInPhotoUrl : r.clockOutPhotoUrl) ?? attendancePhotoUrl(kind, { name: r.name, date: dayLabel.value, time, place: r.listingName }),
    senderName: r.name,
    caption: kind === 'in' ? 'Check in' : 'Check out',
    timestamp: `${r.date}T${time}`,
    dims: '960 × 1280',
  })
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-md">
      <template v-if="row">
        <SheetHeader>
          <SheetTitle>Attendance detail</SheetTitle>
          <SheetDescription>{{ dayLabel }}</SheetDescription>
        </SheetHeader>

        <div class="space-y-5 px-4 pb-4">
          <div class="flex items-center gap-3">
            <BasePersonAvatar :name="row.name" :src="row.avatarUrl" class="size-11" text-class="text-sm" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">
                {{ row.name }}
              </p>
              <p class="truncate text-sm text-muted-foreground">
                {{ row.roleName }}
              </p>
            </div>
            <Button v-if="whatsapp" variant="outline" size="icon" as-child>
              <a :href="whatsapp" target="_blank" rel="noopener" :aria-label="`Message ${row.name} on WhatsApp`">
                <Icon name="lucide:message-circle" class="size-4" />
              </a>
            </Button>
          </div>

          <Separator />

          <dl class="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
            <div>
              <dt class="text-muted-foreground">
                Scheduled
              </dt>
              <dd class="mt-1 font-medium">
                {{ scheduled }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                Time worked
              </dt>
              <dd class="mt-1 font-medium tabular-nums">
                {{ worked === undefined ? 'Not finished' : formatWorked(worked) }}
              </dd>
            </div>

            <div>
              <dt class="text-muted-foreground">
                Check in
              </dt>
              <dd class="mt-1 flex flex-wrap items-center gap-2">
                <span class="text-xl font-semibold tabular-nums" :class="row.clockInLate && 'text-destructive'">{{ row.clockIn }}</span>
                <Badge v-if="row.clockInLate" variant="outline" class="border-destructive/40 font-normal text-destructive">
                  Late
                </Badge>
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                Check out
              </dt>
              <dd class="mt-1 flex flex-wrap items-center gap-2">
                <span class="text-xl font-semibold tabular-nums" :class="row.clockOutEarly && 'text-destructive'">{{ row.clockOut ?? '-' }}</span>
                <span v-if="row.clockOutNextDay" class="text-xs text-muted-foreground">next day</span>
                <Badge v-if="row.clockOutEarly" variant="outline" class="border-destructive/40 font-normal text-destructive">
                  Early
                </Badge>
              </dd>
            </div>

            <div class="col-span-2">
              <dt class="text-muted-foreground">
                Location
              </dt>
              <dd class="mt-1 flex items-center gap-1.5 font-medium">
                <Icon name="lucide:map-pin" class="size-4 shrink-0 text-muted-foreground" />
                {{ row.listingName }}
              </dd>
            </div>

            <div>
              <dt class="text-muted-foreground">
                Check-in note
              </dt>
              <dd class="mt-1">
                {{ row.clockInNote ?? 'No note' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                Check-out note
              </dt>
              <dd class="mt-1">
                {{ row.clockOutNote ?? 'No note' }}
              </dd>
            </div>
          </dl>

          <div class="grid grid-cols-2 gap-3">
            <Button variant="outline" :disabled="!row.clockInPhoto" @click="viewPhoto('in')">
              <Icon name="lucide:image" class="mr-2 size-4" />
              {{ row.clockInPhoto ? 'View photo' : 'No photo' }}
            </Button>
            <Button variant="outline" :disabled="!row.clockOutPhoto" @click="viewPhoto('out')">
              <Icon name="lucide:image" class="mr-2 size-4" />
              {{ row.clockOutPhoto ? 'View photo' : 'No photo' }}
            </Button>
          </div>

          <Separator />

          <div class="flex flex-wrap gap-2">
            <Button variant="outline" as-child>
              <NuxtLink :to="`/users/${row.userId}`">
                <Icon name="lucide:user-round" class="mr-2 size-4" />
                Profile
              </NuxtLink>
            </Button>
            <Button variant="outline" as-child>
              <NuxtLink :to="`/activities/${row.userId}`">
                <Icon name="lucide:timer" class="mr-2 size-4" />
                Activities
              </NuxtLink>
            </Button>
          </div>
        </div>
      </template>
    </SheetContent>
  </Sheet>
  <ImageViewer :scope="VIEWER_SCOPE" />
</template>
