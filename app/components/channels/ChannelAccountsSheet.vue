<script setup lang="ts">
import type { ChannelAccount, ChannelDefinition } from './data/channels'
import { computed } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { useChannels } from '~/composables/useChannels'

const props = defineProps<{ channel: ChannelDefinition | null }>()

const emit = defineEmits<{ addAccount: [], mapListings: [account: ChannelAccount], disconnect: [account: ChannelAccount] }>()

const open = defineModel<boolean>('open', { default: false })

const { accountsForChannel, mappings } = useChannels()

const rows = computed(() => props.channel
  ? accountsForChannel(props.channel.name).map((account) => {
      const mine = mappings.value.filter(m => m.accountId === account.id)
      return {
        account,
        count: mine.length,
        errors: mine.filter(m => m.status === 'error').length,
      }
    })
  : [])

const covered = computed(() => rows.value.reduce((n, r) => n + r.count, 0))
const total = computed(() => listings.value.length)

// The last account can be disconnected from here, which leaves the sheet empty.
const hasAccounts = computed(() => rows.value.length > 0)
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent v-if="channel" class="flex w-full flex-col gap-0 p-0 sm:max-w-md">
      <SheetHeader class="border-b p-5">
        <div class="flex items-center gap-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
            <Icon :name="channel.icon" class="size-5" />
          </div>
          <div class="min-w-0">
            <SheetTitle>{{ channel.name }} accounts</SheetTitle>
            <SheetDescription class="tabular-nums">
              {{ covered }} of {{ total }} listings on {{ channel.name }}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <ul v-if="hasAccounts" class="flex flex-col">
          <li v-for="row in rows" :key="row.account.id" class="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted/60">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ row.account.accountName }}
              </p>
              <p v-if="row.account.propertyId" class="text-xs text-muted-foreground tabular-nums">
                Property ID {{ row.account.propertyId }}
              </p>
              <p v-if="row.errors > 0" class="flex items-center gap-1 text-xs text-destructive">
                <Icon name="lucide:circle-alert" class="size-3" aria-hidden="true" />
                {{ row.errors }} with sync errors
              </p>
            </div>
            <span class="text-right text-sm tabular-nums">
              {{ row.count }}
              <span class="sr-only">{{ row.count === 1 ? 'listing' : 'listings' }}</span>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="size-8 shrink-0" :aria-label="`${row.account.accountName} options`">
                  <Icon name="lucide:ellipsis" class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="emit('mapListings', row.account)">
                  <Icon name="lucide:arrow-left-right" class="size-4" />
                  Map listings
                </DropdownMenuItem>
                <DropdownMenuItem class="text-destructive focus:text-destructive" @click="emit('disconnect', row.account)">
                  <Icon name="lucide:unlink" class="size-4" />
                  Disconnect account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ul>
        <p v-else class="p-4 text-center text-sm text-muted-foreground">
          No {{ channel.name }} accounts left. Add one to sell your listings on {{ channel.name }} again.
        </p>
      </div>

      <SheetFooter class="border-t p-4">
        <Button class="w-full" @click="emit('addAccount')">
          <Icon name="lucide:plus" class="mr-1.5 size-4" aria-hidden="true" />
          Add {{ channel.name }} account
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
