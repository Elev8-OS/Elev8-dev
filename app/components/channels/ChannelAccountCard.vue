<script setup lang="ts">
import type { ChannelDefinition } from './data/channels'
import { computed } from 'vue'
import { useChannels } from '~/composables/useChannels'

const props = defineProps<{ channel: ChannelDefinition }>()

const emit = defineEmits<{ manage: [] }>()

const { accountsForChannel, mappingsForChannel } = useChannels()

// Only rendered for connected channels. Accounts are listed in the Manage
// accounts sheet, not here, so the card keeps the same height however many there are.
const accountCount = computed(() => accountsForChannel(props.channel.name).length)
const mapped = computed(() => mappingsForChannel(props.channel.name))
const errors = computed(() => mapped.value.filter(m => m.status === 'error').length)
</script>

<template>
  <Card class="flex flex-col gap-3 p-4">
    <div class="flex items-start justify-between gap-2">
      <div class="flex size-10 items-center justify-center rounded-lg border bg-background">
        <Icon :name="channel.icon" class="size-6" />
      </div>
      <Badge variant="outline" class="gap-1 border-green-500/40 text-green-700 dark:text-green-400">
        <span class="size-1.5 rounded-full bg-green-500" aria-hidden="true" />
        Connected
      </Badge>
    </div>

    <div class="flex-1">
      <p class="text-sm font-semibold">
        {{ channel.name }}
      </p>
      <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
        {{ channel.description }}
      </p>
    </div>

    <div class="flex items-center justify-between gap-2 border-t pt-3">
      <div class="min-w-0 text-xs">
        <p class="font-medium tabular-nums">
          {{ mapped.length }} {{ mapped.length === 1 ? 'listing' : 'listings' }}
        </p>
        <p v-if="errors > 0" class="text-destructive">
          {{ errors }} with sync errors
        </p>
        <p v-else class="text-muted-foreground">
          {{ accountCount }} {{ accountCount === 1 ? 'account' : 'accounts' }}
        </p>
      </div>
      <Button variant="outline" size="sm" class="shrink-0" @click="emit('manage')">
        Manage accounts
      </Button>
    </div>
  </Card>
</template>
