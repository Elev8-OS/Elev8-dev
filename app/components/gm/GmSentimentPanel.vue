<script setup lang="ts">
import type { GmSentimentSummary } from '~/components/gm/data/gm-dashboard'
import type { Conversation } from '~/components/inbox/data/conversations'
import { formatDistanceToNow } from 'date-fns'
import { actionCategoryFor } from '~/components/inbox/data/conversations'

const props = defineProps<{
  /** Only the rows the panel renders; the rest are deferred to the inbox. */
  rows: Conversation[]
  hiddenCount: number
  summary: GmSentimentSummary
  regionLabel: string
}>()

const emit = defineEmits<{
  open: [conversationId: string]
  handled: [conversationId: string]
}>()

function needsAction(conv: Conversation): boolean {
  return conv.status === 'action_needed'
}

function since(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

const description = computed(() => {
  if (!props.summary.negative)
    return 'No guest is unhappy right now'
  const guests = props.summary.negative === 1 ? '1 guest' : `${props.summary.negative} guests`
  return `${guests} unhappy · ${props.summary.actionNeeded} awaiting a reply`
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Icon name="lucide:frown" class="size-4 text-red-600 dark:text-red-400" />
        Negative sentiment
      </CardTitle>
      <CardDescription>{{ description }}</CardDescription>
      <CardAction class="flex items-center gap-2">
        <Badge
          v-if="summary.actionNeeded"
          variant="outline"
          class="border-red-500/30 text-red-700 dark:text-red-400"
        >
          <Icon name="lucide:circle-alert" class="size-3.5" />
          {{ summary.actionNeeded }} action needed
        </Badge>
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/inbox">
            Inbox
            <Icon name="lucide:arrow-up-right" class="size-4" />
          </NuxtLink>
        </Button>
      </CardAction>
    </CardHeader>

    <CardContent class="flex flex-col gap-2">
      <!-- One TooltipProvider for the whole list: the row actions are
           icon-only, so each needs a name on hover as well as its
           aria-label. -->
      <TooltipProvider>
        <div
          v-for="conv in rows"
          :key="conv.id"
          data-testid="gm-sentiment-row"
          class="flex flex-col gap-2 rounded-md border p-3"
          :class="needsAction(conv) ? 'border-red-500/30' : 'border-border'"
        >
          <div class="flex items-start gap-2">
            <Avatar class="size-8 shrink-0">
              <AvatarFallback class="text-xs">
                {{ conv.guestInitials }}
              </AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">
                {{ conv.guestName }}
              </div>
              <p class="truncate text-xs text-muted-foreground">
                {{ conv.listingName }} · {{ since(conv.lastMessageAt) }}
              </p>
            </div>

            <!-- The actions live up here rather than on their own row, which
                 is what keeps the card to three lines. -->
            <div class="flex shrink-0 items-center">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open conversation"
                    @click="emit('open', conv.id)"
                  >
                    <Icon name="lucide:message-square" class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open conversation</TooltipContent>
              </Tooltip>
              <Tooltip v-if="needsAction(conv)">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Mark handled"
                    @click="emit('handled', conv.id)"
                  >
                    <Icon name="lucide:check" class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark handled</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div v-if="needsAction(conv) || conv.actionPriority === 'high'" class="flex flex-wrap gap-1.5">
            <Badge
              v-if="needsAction(conv)"
              variant="outline"
              class="border-red-500/40 text-[10px] text-red-700 dark:text-red-400"
            >
              ACTION NEEDED
            </Badge>
            <Badge
              v-if="needsAction(conv)"
              variant="outline"
              class="text-[10px]"
              :class="actionCategoryFor(conv).class"
            >
              {{ actionCategoryFor(conv).label }}
            </Badge>
            <Badge
              v-if="conv.actionPriority === 'high'"
              variant="outline"
              class="border-red-500/40 text-[10px] text-red-700 dark:text-red-400"
            >
              HIGH
            </Badge>
          </div>

          <!-- The note is the reason the GM is being shown this row, so it is
               never truncated away. -->
          <p class="text-sm">
            {{ conv.sentimentNote }}
          </p>
        </div>
      </TooltipProvider>

      <div
        v-if="!rows.length"
        class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
      >
        No negative sentiment in {{ regionLabel === 'All regions' ? 'the portfolio' : regionLabel }}.
      </div>

      <NuxtLink
        v-if="hiddenCount"
        to="/inbox"
        class="text-sm text-muted-foreground hover:underline"
      >
        {{ hiddenCount }} more in the inbox
      </NuxtLink>

      <!-- Region scoping matches conversations by listing name, so say when
           some could not be placed rather than appearing to have lost them. -->
      <p v-if="summary.excluded" class="text-xs text-muted-foreground">
        {{ summary.excluded }} more outside {{ regionLabel }}, or on a property that is no longer listed.
      </p>
    </CardContent>
  </Card>
</template>
