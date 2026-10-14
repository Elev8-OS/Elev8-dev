<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { WEBSITE_CHANNEL, websiteChannel } from '~/components/channels/data/website-channel'
import { WEBSITE_STATUS_CLASS, WEBSITE_STATUS_LABEL, websitesForListing } from '~/components/listings/data/listing-websites'
import { websites } from '~/components/website-builder/data/websites'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'

/**
 * Read only: the Website Builder sites that sell this listing and, while the
 * Website channel is added, the rule set each one books under.
 */
const props = defineProps<{ listingId: string }>()

const { hydrate } = useWebsiteChannel()
// After mount, so the server render and the first client render match.
onMounted(hydrate)

const rows = computed(() => websitesForListing(props.listingId, websites.value, websiteChannel.value))
const showRuleSets = computed(() => websiteChannel.value.enabled)
</script>

<template>
  <Card class="p-5">
    <div class="mb-4 flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <Icon :name="WEBSITE_CHANNEL.icon" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 class="text-sm font-semibold">
          Websites
        </h3>
      </div>
      <Button variant="outline" size="sm" as-child>
        <NuxtLink to="/channels">
          Manage rule sets
        </NuxtLink>
      </Button>
    </div>

    <ul v-if="rows.length > 0" class="flex flex-col gap-3">
      <li
        v-for="row in rows"
        :key="row.websiteId"
        class="flex items-center justify-between gap-3 rounded-lg border p-4"
        data-testid="listing-website-row"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">
            {{ row.name }}
          </p>
          <p class="truncate text-xs text-muted-foreground">
            {{ row.url }}
          </p>
          <p v-if="showRuleSets" class="mt-1 text-xs" :class="row.ruleSetName ? '' : 'text-muted-foreground'" data-testid="listing-website-rule-set">
            {{ row.ruleSetName ? `Rule set: ${row.ruleSetName}` : 'No rule set' }}
          </p>
        </div>
        <Badge variant="outline" class="shrink-0" :class="WEBSITE_STATUS_CLASS[row.status]">
          {{ WEBSITE_STATUS_LABEL[row.status] }}
        </Badge>
      </li>
    </ul>
    <div v-else class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground" data-testid="listing-websites-empty">
      No website sells this listing yet.
      <NuxtLink to="/website-builder" class="font-medium text-foreground underline underline-offset-4">
        Open Website Builder
      </NuxtLink>
    </div>
  </Card>
</template>
