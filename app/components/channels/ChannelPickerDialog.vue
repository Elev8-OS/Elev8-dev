<script setup lang="ts">
import type { ChannelDefinition } from './data/channels'
import { computed } from 'vue'
import { useChannels } from '~/composables/useChannels'
import { CHANNELS } from './data/channels'

const emit = defineEmits<{ pick: [channel: ChannelDefinition] }>()

const open = defineModel<boolean>('open', { default: false })

const { accountsForChannel } = useChannels()

// Connected channels first: picking one adds another account to it.
const rows = computed(() => CHANNELS
  .map(channel => ({ channel, accounts: accountsForChannel(channel.name).length }))
  .sort((a, b) => Number(b.accounts > 0) - Number(a.accounts > 0)))

function pick(channel: ChannelDefinition) {
  open.value = false
  emit('pick', channel)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
      <DialogHeader class="border-b p-5">
        <DialogTitle>Add a channel</DialogTitle>
        <DialogDescription>
          Choose where to sell your listings. Pick a channel you already use to add another account to it.
        </DialogDescription>
      </DialogHeader>

      <ul class="min-h-0 flex-1 divide-y overflow-y-auto">
        <li v-for="row in rows" :key="row.channel.name">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            :aria-label="row.accounts > 0 ? `Add another ${row.channel.name} account` : `Connect ${row.channel.name}`"
            @click="pick(row.channel)"
          >
            <span class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
              <Icon :name="row.channel.icon" class="size-5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium">{{ row.channel.name }}</span>
              <span class="block text-xs text-muted-foreground">
                <template v-if="row.accounts > 0">
                  {{ row.accounts }} {{ row.accounts === 1 ? 'account' : 'accounts' }} connected. Add another account.
                </template>
                <template v-else>
                  {{ row.channel.description }}
                </template>
              </span>
            </span>
            <Badge
              v-if="row.accounts > 0"
              variant="outline"
              class="shrink-0 gap-1 border-green-500/40 text-green-700 dark:text-green-400"
            >
              <span class="size-1.5 rounded-full bg-green-500" aria-hidden="true" />
              Connected
            </Badge>
            <Icon name="lucide:chevron-right" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </DialogContent>
  </Dialog>
</template>
