<script setup lang="ts">
import type { GuestRegistration } from './data/guest-registration'
import { providerLabels, statusLabels } from './data/guest-registration'

defineProps<{
  registrations: GuestRegistration[]
}>()

const emit = defineEmits<{
  submit: [reg: GuestRegistration]
  details: [reg: GuestRegistration]
  void: [reg: GuestRegistration]
}>()

function providerBadgeVariant(provider: GuestRegistration['provider']) {
  return provider === 'apoa' ? 'secondary' : 'outline'
}

function statusBadgeVariant(status: GuestRegistration['status']) {
  switch (status) {
    case 'submitted': return 'default'
    case 'pending': return 'secondary'
    case 'failed': return 'destructive'
    case 'void': return 'outline'
    case 'incomplete': return 'secondary'
  }
}

function formatDate(date: string) {
  return date.slice(0, 10)
}
</script>

<template>
  <div class="rounded-lg border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Listing</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Nationality</TableHead>
          <TableHead>Check-in → Check-out</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead class="w-[60px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="reg in registrations" :key="reg.id">
          <TableCell>
            <div class="min-w-0">
              <p class="font-medium">
                {{ reg.guestName }}
              </p>
              <p v-if="reg.idNumber" class="text-xs text-muted-foreground">
                {{ reg.idNumber }}
              </p>
            </div>
          </TableCell>
          <TableCell class="max-w-[200px]">
            <span class="line-clamp-1">{{ reg.listingName }}</span>
          </TableCell>
          <TableCell>
            <Badge :variant="providerBadgeVariant(reg.provider)">
              {{ providerLabels[reg.provider] }}
            </Badge>
          </TableCell>
          <TableCell>
            <span v-if="reg.nationality" class="text-sm">{{ reg.nationality }}</span>
            <span v-else class="text-muted-foreground">—</span>
          </TableCell>
          <TableCell class="text-muted-foreground">
            {{ formatDate(reg.checkIn) }} → {{ formatDate(reg.checkOut) }}
          </TableCell>
          <TableCell>
            <div class="flex items-center gap-1.5">
              <Badge :variant="statusBadgeVariant(reg.status)">
                {{ statusLabels[reg.status] }}
              </Badge>
            </div>
          </TableCell>
          <TableCell class="text-muted-foreground">
            <span v-if="reg.submittedAt" class="text-xs">{{ formatDate(reg.submittedAt) }}</span>
            <span v-else>—</span>
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="h-8 w-8">
                  <Icon name="lucide:more-horizontal" class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-44">
                <DropdownMenuItem
                  v-if="reg.status === 'pending' || reg.status === 'failed'"
                  class="gap-2"
                  @click="emit('submit', reg)"
                >
                  <Icon name="lucide:send" class="size-4" />
                  {{ reg.status === 'failed' ? 'Re-submit' : 'Submit report' }}
                </DropdownMenuItem>
                <DropdownMenuItem class="gap-2" @click="emit('details', reg)">
                  <Icon name="lucide:file-text" class="size-4" /> View details
                </DropdownMenuItem>
                <DropdownMenuSeparator v-if="reg.status === 'pending' || reg.status === 'incomplete'" />
                <DropdownMenuItem
                  v-if="reg.status === 'pending' || reg.status === 'incomplete'"
                  class="gap-2 text-destructive"
                  @click="emit('void', reg)"
                >
                  <Icon name="lucide:ban" class="size-4" /> Void registration
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        <TableRow v-if="!registrations.length">
          <TableCell :colspan="8" class="h-24 text-center text-muted-foreground">
            No guest registrations found. Connect a provider and sync with reservations to see reports here.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
