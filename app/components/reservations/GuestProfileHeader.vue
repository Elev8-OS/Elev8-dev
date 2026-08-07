<script setup lang="ts">
import type { GuestProfile } from '~/components/reservations/data/reservations'

const props = defineProps<{ guest: GuestProfile }>()

const emit = defineEmits<{
  newReservation: []
}>()

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function callPhone(phone: string) {
  window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`
}
</script>

<template>
  <div class="flex items-start gap-4">
    <Avatar class="size-16">
      <AvatarFallback class="bg-primary/10 text-primary text-xl">
        {{ initials(guest.name) }}
      </AvatarFallback>
    </Avatar>
    <div class="flex-1 min-w-0 space-y-1.5">
      <h1 class="text-2xl font-bold tracking-tight truncate">
        {{ guest.name }}
      </h1>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <a :href="`mailto:${guest.email}`" class="hover:underline truncate">
          {{ guest.email }}
        </a>
        <button type="button" class="hover:underline" @click="callPhone(guest.phone)">
          {{ guest.phone }}
        </button>
        <span>{{ guest.language }}</span>
        <span>Joined {{ fmtDate(guest.createdAt) }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <Badge v-for="tag in guest.tags" :key="tag" variant="secondary">
          {{ tag }}
        </Badge>
        <Badge variant="outline">
          {{ guest.previousStays }} previous {{ guest.previousStays === 1 ? 'stay' : 'stays' }}
        </Badge>
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <Button variant="outline" size="sm" class="gap-1.5">
        <Icon name="lucide:message-circle" class="size-3.5" />
        Send WhatsApp
      </Button>
      <Button size="sm" class="gap-1.5" @click="emit('newReservation')">
        <Icon name="lucide:plus" class="size-3.5" />
        New Reservation
      </Button>
    </div>
  </div>
</template>
