<!-- app/components/users/RolesGrid.vue -->
<script setup lang="ts">
import type { Role, WeekDay } from '~/components/users/data/roles'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useRoles } from '~/composables/useRoles'
import { useSchedule } from '~/composables/useSchedule'
import { useUsers } from '~/composables/useUsers'
import { spansMidnight } from '~/lib/schedule'

defineEmits<{
  edit: [role: Role]
}>()

const { roles } = useRoles()
const { userCountByRole } = useUsers()
const { shifts } = useSchedule()

function hoursChip(wh: Role['workingHours']): string {
  if (wh.scheduleType === 'flexible')
    return 'Flexible'
  const named = (wh.shiftIds ?? []).map(id => shifts.value.find(t => t.id === id)?.name).filter(Boolean)
  if (named.length)
    return named.join(' + ')
  if (!wh.startTime || !wh.endTime)
    return 'Fixed'
  return `${wh.startTime} – ${wh.endTime}${spansMidnight(wh.startTime, wh.endTime) ? ' (+1)' : ''}`
}

function daysChip(days: WeekDay[]): string {
  const order: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  if (days.length === 7)
    return 'Mon–Sun'
  if (days.length === 5 && order.slice(0, 5).every(d => days.includes(d)))
    return 'Mon–Fri'
  if (days.length === 6 && order.slice(0, 6).every(d => days.includes(d)))
    return 'Mon–Sat'
  return days.map(d => d.slice(0, 3)).join(', ')
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    <Card
      v-for="role in roles"
      :key="role.id"
      class="flex flex-col hover:shadow-md transition-shadow"
    >
      <CardHeader class="pb-3">
        <div class="flex items-start justify-between gap-2">
          <CardTitle class="text-base">
            {{ role.name }}
          </CardTitle>
          <Badge variant="outline" class="shrink-0">
            {{ userCountByRole[role.id] ?? 0 }} {{ (userCountByRole[role.id] ?? 0) === 1 ? 'user' : 'users' }}
          </Badge>
        </div>
      </CardHeader>
      <CardContent class="flex-1 flex flex-col gap-4 pt-0">
        <p class="text-sm text-muted-foreground line-clamp-2">
          {{ role.description }}
        </p>

        <div class="flex flex-wrap gap-1.5 mt-auto">
          <Badge variant="secondary" class="text-xs">
            <Icon :name="role.workingHours.scheduleType === 'flexible' ? 'lucide:clock-4' : 'lucide:clock'" class="mr-1 size-3" />
            {{ hoursChip(role.workingHours) }}
          </Badge>
          <Badge variant="secondary" class="text-xs">
            <Icon name="lucide:calendar" class="mr-1 size-3" />
            {{ daysChip(role.workingHours.days) }}
          </Badge>
        </div>

        <Button variant="outline" size="sm" class="w-full" @click="$emit('edit', role)">
          <Icon name="lucide:pencil" class="mr-2 size-4" />
          Edit
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
