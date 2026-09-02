<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listings } from '~/components/listings/data/listings'
import { useOwnerPortal } from '~/composables/useOwnerPortal'

const { currentOwner, visibleStatements, canViewStatementField } = useOwnerPortal()
const publishedStatements = computed(() => visibleStatements.value
  .filter(statement => statement.status === 'published')
  .slice()
  .sort((a, b) => b.period.localeCompare(a.period)))

function listingName(listingId: string) {
  return listings.value.find(listing => listing.id === listingId)?.name ?? listingId
}

function formatCurrency(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString('id-ID')}`
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm text-muted-foreground">
        Owner portal
      </p>
      <h1 class="text-2xl font-semibold tracking-tight">
        Statements
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Published monthly statements for {{ currentOwner?.name ?? 'your account' }}.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Statement archive</CardTitle>
        <CardDescription>
          Published statements are read-only. Draft statements remain with Finance until they are published.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="publishedStatements.length" class="overflow-x-auto rounded-md border">
          <table class="w-full min-w-[42rem] text-sm">
            <thead class="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-medium">
                  Period
                </th>
                <th class="px-4 py-3 font-medium">
                  Property
                </th>
                <th class="px-4 py-3 font-medium">
                  Status
                </th>
                <th v-if="canViewStatementField('netPayout')" class="px-4 py-3 text-right font-medium">
                  Net payout
                </th>
                <th class="px-4 py-3 text-right font-medium">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="statement in publishedStatements"
                :key="statement.id"
                :data-testid="`statement-${statement.id}`"
              >
                <td class="px-4 py-3 font-medium">
                  {{ statement.period }}
                </td>
                <td class="px-4 py-3">
                  {{ listingName(statement.listingId) }}
                </td>
                <td class="px-4 py-3">
                  <Badge variant="secondary">
                    Published
                  </Badge>
                </td>
                <td v-if="canViewStatementField('netPayout')" class="px-4 py-3 text-right font-medium tabular-nums">
                  {{ formatCurrency(statement.publishedSnapshot?.currency ?? statement.currency, statement.publishedSnapshot?.totalAmount ?? statement.totalAmount) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <Button as-child variant="ghost" size="sm">
                    <NuxtLink :to="`/owner-portal/statements/${statement.id}`">
                      View details
                      <Icon name="lucide:arrow-right" class="ml-2 size-4" aria-hidden="true" />
                    </NuxtLink>
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="rounded-md border border-dashed p-8 text-center" data-testid="statements-empty" role="status">
          <Icon name="lucide:file-text" class="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h2 class="mt-3 font-medium">
            No published statements yet
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Published statements will appear here once Finance completes the monthly review.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
