<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { usePriceLabs } from '~/composables/usePriceLabs'

/**
 * Which pricing engine is connected, whether its credential works, and how
 * its units map to rooms. Connecting and mapping happen in the integration
 * itself (Settings > Integrations > PriceLabs); this is the summary and the
 * way in. The engine is named here: this is the integrations inventory, not
 * a data surface (§15.1).
 */
const pl = usePriceLabs()

const INTEGRATION_LINK = '/settings/integrations?open=pricelabs'

const connection = computed(() => pl.connection.value)
const maskedKey = computed(() => {
  const key = connection.value?.apiKey ?? ''
  return key.length > 10 ? `${key.slice(0, 6)}${'•'.repeat(8)}${key.slice(-4)}` : '••••'
})

const credentialOk = computed(() => (connection.value?.rateLimitRemaining ?? 0) > 0)

const confirmDisconnect = ref(false)

function disconnect() {
  pl.disconnect()
  confirmDisconnect.value = false
  toast.info('Pricing engine disconnected. Elev8 now prices from each room\'s settings.')
}

function shortList(names: string[], shown = 4): string {
  return names.length > shown ? `${names.slice(0, shown).join(', ')} and ${names.length - shown} more` : names.join(', ')
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card class="gap-4 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon name="lucide:chart-spline" class="size-5 text-muted-foreground" />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-semibold">
                PriceLabs
              </h3>
              <Badge v-if="pl.isConnected.value" variant="default" class="text-[11px]">
                Connected
              </Badge>
              <Badge v-else variant="secondary" class="text-[11px]">
                Not connected
              </Badge>
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Computes the nightly curve and market data. Elev8 holds the settings and writes them to it.
            </p>
          </div>
        </div>
        <div class="flex gap-2">
          <Button v-if="pl.isConnected.value" variant="outline" size="sm" @click="confirmDisconnect = true">
            Disconnect
          </Button>
          <Button size="sm" as-child>
            <NuxtLink :to="INTEGRATION_LINK">
              {{ pl.isConnected.value ? 'Manage connection' : 'Connect' }}
            </NuxtLink>
          </Button>
        </div>
      </div>

      <dl v-if="connection" class="grid gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt class="text-xs text-muted-foreground">
            Account
          </dt>
          <dd>{{ connection.accountName }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Credential
          </dt>
          <dd class="flex items-center gap-1.5">
            <Icon :name="credentialOk ? 'lucide:circle-check' : 'lucide:circle-alert'" class="size-3.5" :class="credentialOk ? 'text-primary' : 'text-destructive'" />
            <span class="font-mono text-xs">{{ maskedKey }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">
            Last sync
          </dt>
          <dd>{{ formatDate(connection.lastSyncAt) }}</dd>
        </div>
      </dl>
    </Card>

    <Card v-if="pl.isConnected.value" class="gap-4 p-5" data-testid="provider-mapping">
      <div>
        <h3 class="text-sm font-semibold">
          Room mapping
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          One engine unit per Elev8 room. An unmapped room gets no market curve; Elev8 prices it from its own settings.
        </p>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-md bg-muted/50 p-3">
          <p class="text-lg font-semibold tabular-nums">
            {{ pl.mappedUnits.value.length }}
          </p>
          <p class="text-xs text-muted-foreground">
            Mapped
          </p>
        </div>
        <div class="rounded-md bg-muted/50 p-3">
          <p class="text-lg font-semibold tabular-nums">
            {{ pl.unmappedUnits.value.length }}
          </p>
          <p class="text-xs text-muted-foreground">
            Engine units not mapped
          </p>
        </div>
        <div class="rounded-md bg-muted/50 p-3">
          <p class="text-lg font-semibold tabular-nums" :class="pl.unmappedRooms.value.length ? 'text-destructive' : ''">
            {{ pl.unmappedRooms.value.length }}
          </p>
          <p class="text-xs text-muted-foreground">
            Rooms without a unit
          </p>
        </div>
      </div>
      <div v-if="pl.unmappedRooms.value.length" class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <Icon name="lucide:triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
        <p>
          Not mapped: {{ shortList(pl.unmappedRooms.value.map(r => r.name)) }}.
          <NuxtLink :to="INTEGRATION_LINK" class="font-medium underline">
            Map them
          </NuxtLink>
        </p>
      </div>
    </Card>

    <AlertDialog v-model:open="confirmDisconnect">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect PriceLabs?</AlertDialogTitle>
          <AlertDialogDescription>
            Writes stop and the room mapping is cleared. Prices keep flowing: Elev8 works them out from each room's settings until an engine is connected again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="disconnect">
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
