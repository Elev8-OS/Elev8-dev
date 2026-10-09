<script setup lang="ts">
import { Badge } from '~/components/ui/badge'
import { Card } from '~/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'

/** A collapsible card for the advanced parts of the Revenue tab. */
defineProps<{
  title: string
  description: string
  /** Shown in the header while collapsed, e.g. "3 rules". */
  summary?: string
  testId?: string
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Collapsible v-model:open="open" as-child>
    <Card class="gap-0 p-0" :data-testid="testId">
      <CollapsibleTrigger as-child>
        <button type="button" class="flex w-full items-start gap-3 p-5 text-left" :aria-expanded="open">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-semibold">
                {{ title }}
              </h3>
              <Badge v-if="summary && !open" variant="secondary" class="text-[11px] font-normal">
                {{ summary }}
              </Badge>
              <slot name="badges" />
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ description }}
            </p>
          </div>
          <Icon name="lucide:chevron-down" class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform" :class="open ? 'rotate-180' : ''" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="flex flex-col gap-6 border-t px-5 py-5">
          <slot />
        </div>
      </CollapsibleContent>
    </Card>
  </Collapsible>
</template>
