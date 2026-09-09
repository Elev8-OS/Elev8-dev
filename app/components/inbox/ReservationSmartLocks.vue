<script lang="ts" setup>
import type { Reservation } from '~/components/inbox/data/conversations'
import { listings as allListings } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'

interface Props {
  reservation: Reservation
}

const props = defineProps<Props>()

const smartLock = useSmartLock()

// Find the listing for this reservation by name
const listing = computed(() => allListings.value.find(l => l.name === props.reservation.listingName))

// Locks paired to this listing (both property-level and room-level)
const locks = computed(() => {
  if (!listing.value) return []
  return smartLock.getLocksForListing(listing.value.id)
})

// Active access codes for this reservation
const codes = computed(() => {
  return smartLock.codes.value
    .filter(c => c.reservationId === props.reservation.id && c.status === 'active')
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
})

// Group codes by lockId for easy lookup
const codesByLockId = computed(() => {
  const map: Record<string, typeof codes.value> = {}
  for (const c of codes.value) {
    if (!map[c.lockId]) map[c.lockId] = []
    map[c.lockId]!.push(c)
  }
  return map
})

const isNotConnected = computed(() => !smartLock.isConnected.value)

const generatingLockId = ref<string | null>(null)

async function generateCode(lockId: string) {
  if (!listing.value) return
  if (generatingLockId.value) return
  generatingLockId.value = lockId
  try {
    const result = await smartLock.generateAccessCode({
      lockId,
      reservationId: props.reservation.id,
      guestName: props.reservation.guestDetails.name,
    })
    if (!result.success) {
      toast.error(result.error ?? 'Failed to generate code.')
      return
    }
    toast.success(`Access code generated: ${result.code!.code}`)
  }
  finally {
    generatingLockId.value = null
  }
}

function revokeCode(codeId: string) {
  smartLock.revokeAccessCode(codeId)
  toast.info('Access code revoked.')
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.success('Code copied to clipboard.')
  }
  catch {
    toast.error('Failed to copy. Code: ' + code)
  }
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function lockName(lockId: string): string {
  return locks.value.find(l => l.id === lockId)?.name ?? 'Unknown lock'
}
</script>

<template>
  <div class="space-y-3">
    <!-- Not connected state -->
    <div v-if="isNotConnected" class="rounded-lg border border-dashed p-4 text-center">
      <Icon name="lucide:key-round" class="size-6 text-muted-foreground/60 mx-auto mb-2" />
      <p class="text-sm text-muted-foreground">
        Smart Lock isn't connected.
      </p>
      <NuxtLink to="/settings/integrations" class="text-xs text-primary underline mt-1 inline-block">
        Connect in Settings → Integrations
      </NuxtLink>
    </div>

    <!-- Listing not found -->
    <div v-else-if="!listing" class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
      Listing not found in catalog.
    </div>

    <!-- No locks paired to this listing -->
    <div v-else-if="locks.length === 0" class="rounded-lg border border-dashed p-4 text-center">
      <Icon name="lucide:lock-keyhole" class="size-6 text-muted-foreground/60 mx-auto mb-2" />
      <p class="text-sm text-muted-foreground">
        No smart locks paired to {{ reservation.propertyName }}.
      </p>
      <NuxtLink :to="`/listings/${listing.id}`" class="text-xs text-primary underline mt-1 inline-block">
        Pair a lock in listing settings
      </NuxtLink>
    </div>

    <!-- Locks list -->
    <div v-else class="space-y-2">
      <div
        v-for="lock in locks"
        :key="lock.id"
        class="rounded-lg border p-3 space-y-2"
      >
        <!-- Lock header -->
        <div class="flex items-center gap-2">
          <Icon
            :name="lock.online ? 'lucide:lock' : 'lucide:lock-open'"
            class="size-4 shrink-0"
            :class="lock.online ? 'text-green-600' : 'text-muted-foreground'"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <p class="text-sm font-medium truncate">
                {{ lock.name }}
              </p>
              <Badge v-if="lock.isMain" variant="default" class="text-[9px] px-1 py-0">
                Main
              </Badge>
              <span class="text-[10px] text-muted-foreground">· {{ lock.assignment === 'room' ? `Room: ${lock.unitId}` : 'Property' }}</span>
            </div>
            <p class="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Icon name="lucide:battery" class="size-2.5" :class="lock.batteryLevel <= 20 ? 'text-amber-500' : ''" />
              {{ lock.batteryLevel }}%
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            class="h-7 gap-1 text-xs"
            :disabled="!lock.online || generatingLockId === lock.id"
            @click="generateCode(lock.id)"
          >
            <Icon
              v-if="generatingLockId === lock.id"
              name="lucide:loader-2"
              class="size-3 animate-spin"
            />
            <Icon v-else name="lucide:plus" class="size-3" />
            {{ generatingLockId === lock.id ? 'Generating…' : 'Generate code' }}
          </Button>
        </div>

        <!-- Active codes for this lock -->
        <div v-if="codesByLockId[lock.id]?.length" class="space-y-1.5 pt-1.5 border-t">
          <p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Active codes
          </p>
          <div
            v-for="code in codesByLockId[lock.id]"
            :key="code.id"
            class="rounded-md border bg-muted/30 p-2 space-y-1.5"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="font-mono text-base font-bold tracking-widest">
                  {{ code.code }}
                </p>
                <p v-if="code.purpose" class="truncate text-[10px] font-medium text-amber-700">
                  {{ code.purpose }}
                </p>
                <p class="text-[10px] text-muted-foreground">
                  {{ code.guestName || 'Guest' }} · expires {{ formatExpiry(code.endsAt) }}
                </p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0"
                  title="Copy code"
                  @click="copyCode(code.code)"
                >
                  <Icon name="lucide:copy" class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 hover:text-destructive"
                  title="Revoke"
                  @click="revokeCode(code.id)"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <p v-else class="text-[10px] text-muted-foreground italic">
          No active codes. Click "Generate code" to create one.
        </p>
      </div>
    </div>
  </div>
</template>
