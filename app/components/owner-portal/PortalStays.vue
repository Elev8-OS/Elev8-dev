<script setup lang="ts">
import type { OwnerStay, OwnerStaySyncTarget } from '~/components/owners/data/owner-stays'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwnerStays } from '~/composables/useOwnerStays'

const { myStays, currentOwner } = useOwnerPortal()
const { cancelStay, retrySync } = useOwnerStays()
void currentOwner
const dialogOpen = ref(false)
const editing = ref<OwnerStay | null>(null)

const active = computed(() => myStays.value.filter(s => s.status === 'active'))
const cancelled = computed(() => myStays.value.filter(s => s.status === 'cancelled'))

function edit(stay: OwnerStay) {
  editing.value = stay
  dialogOpen.value = true
}

function cancel(stay: OwnerStay) {
  cancelStay(stay.id, 'Cancelled by owner')
}

function retry(stay: OwnerStay, target: OwnerStaySyncTarget) {
  retrySync(stay.id, target)
}

function saved() {
  editing.value = null
}
</script>

<template>
  <div class="flex min-h-0 flex-col gap-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">
          My Stays
        </h1><p class="text-sm text-muted-foreground">
          Manage owner-use reservations for your properties.
        </p>
      </div><Button @click="editing = null; dialogOpen = true">
        <Icon name="lucide:plus" class="mr-2 size-4" />Create stay
      </Button>
    </div><Tabs default-value="calendar" class="min-h-0">
      <TabsList>
        <TabsTrigger value="calendar">
          Calendar
        </TabsTrigger><TabsTrigger value="list">
          List
        </TabsTrigger>
      </TabsList><TabsContent value="calendar" class="min-h-0">
        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Card v-for="stay in active" :key="stay.id">
            <CardHeader>
              <CardTitle class="text-base">
                {{ stay.checkIn }} → {{ stay.checkOut }}
              </CardTitle><CardDescription>{{ stay.guestName }} · {{ stay.nights }} nights</CardDescription>
            </CardHeader><CardContent>
              <PortalSyncStatus :stay="stay" @retry="retry(stay, $event)" /><div class="mt-3 flex gap-2">
                <Button size="sm" variant="outline" @click="edit(stay)">
                  Edit
                </Button><Button size="sm" variant="ghost" @click="cancel(stay)">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card><p v-if="!active.length" class="text-sm text-muted-foreground">
            No active stays.
          </p>
        </div>
      </TabsContent><TabsContent value="list">
        <div class="overflow-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Dates</TableHead><TableHead>Guest</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>
              <TableRow v-for="stay in [...active, ...cancelled]" :key="stay.id">
                <TableCell>{{ stay.checkIn }} → {{ stay.checkOut }}</TableCell><TableCell>{{ stay.guestName }}</TableCell><TableCell>{{ stay.status }}</TableCell><TableCell class="text-right">
                  <Button v-if="stay.status === 'active'" size="sm" variant="ghost" @click="edit(stay)">
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs><PortalStayDialog v-model:open="dialogOpen" :stay="editing" :owner-id="currentOwner?.id ?? 'own-1'" @saved="saved" />
  </div>
</template>
