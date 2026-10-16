<script setup lang="ts">
import type { ActivityLog } from '~/components/activities/data/activities'
import { activityLogTypeMeta, formatDuration, logPlace } from '~/components/activities/data/activities'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'

/** One logged activity. `nested` is a log inside a folded row (same work, same day, same listing). */
defineProps<{ log: ActivityLog, long?: boolean, nested?: boolean, tenant?: string }>()
defineEmits<{ edit: [log: ActivityLog], remove: [log: ActivityLog] }>()

const stamp = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex items-center gap-3 px-5 py-3" :class="nested ? 'bg-muted/20 pl-12' : ''">
    <Icon :name="activityLogTypeMeta[log.type].icon" class="size-4 shrink-0 text-muted-foreground" :aria-label="activityLogTypeMeta[log.type].label" />
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p class="truncate text-sm font-medium">
          {{ log.title }}
        </p>
        <Badge v-if="tenant" variant="outline" class="gap-1 font-normal">
          <Icon name="lucide:building" class="size-3" />
          {{ tenant }}
        </Badge>
        <Badge v-if="log.cleaningJobId || log.taskId" variant="outline" class="gap-1 font-normal" :title="log.cleaningJobId ? `Cleaning job ${log.cleaningJobId}` : `Task ${log.taskId}`">
          <Icon name="lucide:link" class="size-3" />
          {{ log.cleaningJobId ? 'Linked job' : 'Linked task' }}
        </Badge>
        <Badge v-if="log.manual" variant="outline" class="gap-1 font-normal">
          <Icon name="lucide:pen-line" class="size-3" />
          Added by manager
        </Badge>
        <Badge v-else-if="log.editedAt" variant="outline" class="gap-1 font-normal" :title="`Edited by ${log.editedBy} on ${stamp.format(new Date(log.editedAt))}`">
          <Icon name="lucide:history" class="size-3" />
          Edited
        </Badge>
        <Badge v-if="long" variant="outline" class="gap-1 border-warning/50 font-normal text-warning-foreground">
          <Icon name="lucide:triangle-alert" class="size-3" />
          Longer than usual
        </Badge>
      </div>
      <p class="truncate text-xs text-muted-foreground">
        {{ logPlace(log) }}<template v-if="log.notes">
          · {{ log.notes }}
        </template>
      </p>
    </div>
    <span class="w-16 shrink-0 text-right text-sm tabular-nums">{{ formatDuration(log.durationMinutes) }}</span>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="icon" class="size-8 shrink-0" :aria-label="`Actions for ${log.title}`">
          <Icon name="lucide:ellipsis" class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem @select="$emit('edit', log)">
          <Icon name="lucide:pencil" class="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem class="text-destructive focus:text-destructive" @select="$emit('remove', log)">
          <Icon name="lucide:trash-2" class="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
