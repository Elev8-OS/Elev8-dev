<!-- app/pages/guest-guides/[id]/links.vue -->
<script setup lang="ts">
import type { GuestGuideLink, GuideSubmission } from '~/components/guest-guides/data/types'
import { ref, computed } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { toast } from 'vue-sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '~/components/ui/table'
import { Badge } from '~/components/ui/badge'
import LinkDetailDrawer from '~/components/guest-guides/links/LinkDetailDrawer.vue'

const route = useRoute()
const guideId = computed(() => route.params.id as string)

const { guides } = useGuestGuides()
const { links, revokeLink } = useGuestGuideLinks()
const { getSubmissionForLink } = useGuestGuideSubmissions()

const drawerOpen = ref(false)
const selectedLink = ref<GuestGuideLink | null>(null)
const selectedSubmission = ref<GuideSubmission | null>(null)

const guide = computed(() => guides.value.find(g => g.id === guideId.value))
const guideLinks = computed(() => links.value.filter(l => l.guideId === guideId.value))

const statusFilter = ref<'all' | 'pending' | 'opened' | 'submitted' | 'expired' | 'revoked'>('all')
const search = ref('')

const filteredLinks = computed(() => {
  return guideLinks.value.filter(l => {
    if (statusFilter.value !== 'all' && l.status !== statusFilter.value) return false
    if (search.value && !l.guestName.toLowerCase().includes(search.value.toLowerCase())) return false
    return true
  })
})

const statusVariantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  opened: 'secondary',
  submitted: 'default',
  expired: 'secondary',
  revoked: 'destructive',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false })
}

function handleRevoke(id: string) {
  revokeLink(id)
  toast.success('Link revoked')
}

function openLink(link: GuestGuideLink) {
  selectedLink.value = link
  selectedSubmission.value = getSubmissionForLink(link.id)
  drawerOpen.value = true
}
</script>

<template>
  <div class="container mx-auto p-6">
    <div class="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
      <NuxtLink to="/guest-guides" class="hover:underline">
        Guest Guides
      </NuxtLink>
      <span>/</span>
      <span>{{ guide?.title }}</span>
    </div>

    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">Links</h1>
      <p class="text-sm text-muted-foreground">All issued guest guide links for this guide</p>
    </div>

    <div class="mb-4 flex items-center gap-2">
      <Input v-model="search" placeholder="Search guests..." class="max-w-sm" />
      <div class="flex gap-1 rounded-md border p-1">
        <button
          v-for="status in ['all', 'pending', 'opened', 'submitted', 'revoked']"
          :key="status"
          class="rounded-sm px-3 py-1 text-sm"
          :class="statusFilter === status ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
          @click="statusFilter = status as any"
        >
          {{ status }}
        </button>
      </div>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Token</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Reservation</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="link in filteredLinks" :key="link.id" class="cursor-pointer" @click="openLink(link)">
            <TableCell class="font-mono text-xs">{{ link.token.slice(0, 8) }}…</TableCell>
            <TableCell>{{ link.guestName }}</TableCell>
            <TableCell>{{ link.reservationId }}</TableCell>
            <TableCell>{{ link.channel }}</TableCell>
            <TableCell>{{ formatDate(link.sentAt) }}</TableCell>
            <TableCell>
              <Badge :variant="statusVariantMap[link.status] ?? 'outline'">
                {{ link.status }}
              </Badge>
            </TableCell>
            <TableCell>
              <Button v-if="link.status !== 'revoked'" variant="ghost" size="sm" @click.stop="handleRevoke(link.id)">
                Revoke
              </Button>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredLinks.length === 0">
            <TableCell colspan="7" class="py-8 text-center text-muted-foreground">
              No links match your filters.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <LinkDetailDrawer v-model:open="drawerOpen" :link="selectedLink" :submission="selectedSubmission" />
  </div>
</template>