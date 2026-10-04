<script setup lang="ts">
import { Card, CardContent } from '~/components/ui/card'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import type { Tenant } from './data/tenants'
import { ALL_STAFF_ROLES } from './data/staff'
import { usePlatformAudit } from '~/composables/usePlatformAudit'

const props = defineProps<{ tenant: Tenant }>()
const { log } = usePlatformAudit()
onMounted(() => log('view_users', 'tenant', props.tenant.id))

const users = computed(() => {
  const seed = props.tenant.id.charCodeAt(2) || 1
  const count = 6 + (seed % 7)
  const firstNames = ['Made', 'Wayan', 'Komang', 'Ketut', 'Gede', 'Nengah']
  const lastNames = ['Pratama', 'Sari', 'Wirawan', 'Putri', 'Dewi']
  return Array.from({ length: count }).map((_, i) => ({
    id: `${props.tenant.id}-u-${i}`,
    name: `${firstNames[i % 6]} ${lastNames[i % 5]}`,
    email: `user${i}@${props.tenant.name.toLowerCase().replace(/[^a-z]/g, '')}.io`,
    role: ALL_STAFF_ROLES[i % ALL_STAFF_ROLES.length],
    lastActive: new Date(Date.now() - (i * 3 + 1) * 86_400_000).toISOString(),
  }))
})
</script>

<template>
  <Card>
    <CardContent class="p-0">
      <div class="divide-y">
        <div v-for="u in users" :key="u.id" class="flex items-center gap-3 p-4">
          <Avatar class="size-9">
            <AvatarFallback class="bg-primary/10 text-foreground text-xs">{{ u.name.split(' ').map(p => p[0]).join('') }}</AvatarFallback>
          </Avatar>
          <div class="flex-1">
            <div class="text-sm font-medium">{{ u.name }}</div>
            <div class="text-xs text-muted-foreground">{{ u.email }}</div>
          </div>
          <span class="text-xs rounded-md bg-muted px-2 py-0.5">{{ u.role }}</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>